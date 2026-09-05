import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type * as Ort from "onnxruntime-node";

import { packageVersion } from "../package-version.js";
import type {
  EmbeddingBatchResult,
  EmbeddingProvider,
  ProviderDescriptor,
  ProviderOptions,
} from "../types.js";
import { normalizeVector } from "../vectors.js";
import { embedInBatches } from "./shared.js";
import { onnxThreadOptions } from "./session-options.js";

const MODEL_FILENAME = "model_int8.onnx";
const TOKENIZER_FILENAME = "tokenizer.json";
const OUTPUT_DIMENSION = 256;

const TOKENIZER_CONFIG = {
  tokenizer_class: "BertTokenizer",
  model_max_length: Number.MAX_SAFE_INTEGER,
  do_lower_case: true,
  unk_token: "[UNK]",
  sep_token: "[SEP]",
  pad_token: "[PAD]",
  cls_token: "[CLS]",
  mask_token: "[MASK]",
} as const;

interface TokenizedBatch {
  readonly input_ids: readonly (readonly number[])[];
}

interface StaticTokenizer {
  (
    texts: readonly string[],
    options: {
      padding: false;
      truncation: false;
      return_tensor: false;
      add_special_tokens: false;
    },
  ): TokenizedBatch;
  readonly pad_token_id: number;
}

export interface PreparedStaticTokenBatch {
  readonly dimensions: readonly [number, number];
  readonly inputIds: BigInt64Array;
  readonly attentionMask: BigInt64Array;
}

function modelDirectory(options: ProviderOptions): string {
  return options.modelPath ?? path.join(options.modelCacheDir, ...options.model.split("/"));
}

function modelFile(options: ProviderOptions): string {
  return path.join(modelDirectory(options), MODEL_FILENAME);
}

function tokenizerFile(options: ProviderOptions): string {
  return path.join(modelDirectory(options), TOKENIZER_FILENAME);
}

function selectHeadAndTail(inputIds: readonly number[], maximumTokens: number): readonly number[] {
  if (inputIds.length <= maximumTokens) {
    return inputIds;
  }
  const headLength = Math.ceil(maximumTokens / 2);
  const tailLength = maximumTokens - headLength;
  return [
    ...inputIds.slice(0, headLength),
    ...(tailLength > 0 ? inputIds.slice(inputIds.length - tailLength) : []),
  ];
}

export function prepareStaticTokenBatch(
  rows: readonly (readonly number[])[],
  maximumTokens: number,
  paddingTokenId: number,
): PreparedStaticTokenBatch {
  if (
    rows.length === 0 ||
    !Number.isSafeInteger(maximumTokens) ||
    maximumTokens <= 0 ||
    !Number.isSafeInteger(paddingTokenId) ||
    paddingTokenId < 0
  ) {
    throw new Error(
      "Static embedding batches require text, a positive maximum length, and a valid padding token.",
    );
  }
  const selected = rows.map((row, rowIndex) => {
    if (row.length === 0) {
      throw new Error(`Static embedding input row ${rowIndex} has no tokens.`);
    }
    for (const [tokenIndex, token] of row.entries()) {
      if (!Number.isSafeInteger(token) || token < 0) {
        throw new Error(
          `Static embedding input row ${rowIndex} has an invalid token at position ${tokenIndex}.`,
        );
      }
    }
    return selectHeadAndTail(row, maximumTokens);
  });
  const sequenceLength = Math.max(...selected.map((row) => row.length));
  const inputIds = new BigInt64Array(selected.length * sequenceLength).fill(BigInt(paddingTokenId));
  const attentionMask = new BigInt64Array(inputIds.length);
  selected.forEach((row, rowIndex) => {
    const offset = rowIndex * sequenceLength;
    row.forEach((token, tokenIndex) => {
      inputIds[offset + tokenIndex] = BigInt(token);
      attentionMask[offset + tokenIndex] = 1n;
    });
  });
  return {
    dimensions: [selected.length, sequenceLength],
    inputIds,
    attentionMask,
  };
}

export function truncateAndNormalizeSentenceEmbeddings(
  values: Float32Array,
  dimensions: readonly number[],
  outputDimension: number = OUTPUT_DIMENSION,
): readonly Float32Array[] {
  if (
    dimensions.length !== 2 ||
    !Number.isSafeInteger(dimensions[0]) ||
    !Number.isSafeInteger(dimensions[1]) ||
    (dimensions[0] ?? 0) <= 0 ||
    (dimensions[1] ?? 0) <= 0
  ) {
    throw new Error(
      `Static embedding output must be two-dimensional; received [${dimensions.join(", ")}].`,
    );
  }
  const batchSize = dimensions[0] ?? 0;
  const modelDimension = dimensions[1] ?? 0;
  if (
    !Number.isSafeInteger(outputDimension) ||
    outputDimension <= 0 ||
    outputDimension > modelDimension
  ) {
    throw new Error(
      `Static embedding output dimension ${outputDimension} is invalid for model dimension ${modelDimension}.`,
    );
  }
  if (values.length !== batchSize * modelDimension) {
    throw new Error(
      `Static embedding output contains ${values.length} values; expected ${batchSize * modelDimension}.`,
    );
  }
  return Array.from({ length: batchSize }, (_, row) => {
    const offset = row * modelDimension;
    return normalizeVector(values.subarray(offset, offset + outputDimension));
  });
}

export class StaticOrtProvider implements EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #options: ProviderOptions;
  #ort: typeof Ort | undefined;
  #session: Ort.InferenceSession | undefined;
  #tokenizer: StaticTokenizer | undefined;

  constructor(options: ProviderOptions) {
    this.#options = options;
    this.descriptor = {
      id: options.id,
      tool: "onnxruntime-node",
      toolVersion: packageVersion("onnxruntime-node"),
      runtime: "@huggingface/transformers tokenizer",
      runtimeVersion: packageVersion("@huggingface/transformers"),
      model: options.model,
      modelFormat: `StaticEmbedding ONNX (sentence_embedding, truncate_dim=${OUTPUT_DIMENSION})`,
      dtype: `int8 weights, fp32[${OUTPUT_DIMENSION}] output`,
      device: "cpu",
      pooling: "mean",
      inputStrategy: "head-tail-without-special-tokens",
      batchingStrategy: options.batchingStrategy,
      maxLength: options.maxLength,
      ...(options.intraOpThreads !== undefined ? { intraOpThreads: options.intraOpThreads } : {}),
      ...(options.interOpThreads !== undefined ? { interOpThreads: options.interOpThreads } : {}),
    };
  }

  async cachePresent(): Promise<boolean> {
    try {
      await Promise.all([access(modelFile(this.#options)), access(tokenizerFile(this.#options))]);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<void> {
    const [tokenizerJson, transformers, ort] = await Promise.all([
      readFile(tokenizerFile(this.#options), "utf8"),
      import("@huggingface/transformers"),
      import("onnxruntime-node"),
    ]);
    const tokenizerDefinition: unknown = JSON.parse(tokenizerJson);
    const tokenizer = new transformers.PreTrainedTokenizer(
      tokenizerDefinition,
      TOKENIZER_CONFIG,
    ) as unknown as StaticTokenizer;
    if (!Number.isSafeInteger(tokenizer.pad_token_id) || tokenizer.pad_token_id < 0) {
      throw new Error("Static embedding tokenizer does not define a valid padding token.");
    }
    const threadOptions = onnxThreadOptions(this.#options);
    const session = await ort.InferenceSession.create(modelFile(this.#options), {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
      ...threadOptions,
    });
    if (
      !session.inputNames.includes("input_ids") ||
      !session.inputNames.includes("attention_mask") ||
      !session.outputNames.includes("sentence_embedding")
    ) {
      await session.release();
      throw new Error(
        "Static embedding ONNX model must accept input_ids and attention_mask and return sentence_embedding.",
      );
    }
    this.#tokenizer = tokenizer;
    this.#ort = ort;
    this.#session = session;
  }

  async embedDocuments(
    texts: readonly string[],
    batchSize: number,
    onBatch: () => void,
  ): Promise<EmbeddingBatchResult> {
    return embedInBatches(
      texts,
      batchSize,
      (batch) => this.#embedBatch(batch),
      onBatch,
      this.#options.batchingStrategy,
    );
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const [vector] = await this.#embedBatch([text]);
    if (!vector) {
      throw new Error("Static ONNX Runtime returned no query vector.");
    }
    return vector;
  }

  async dispose(): Promise<void> {
    if (this.#session) {
      await this.#session.release();
      this.#session = undefined;
    }
    this.#tokenizer = undefined;
    this.#ort = undefined;
  }

  async #embedBatch(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const tokenizer = this.#tokenizer;
    const session = this.#session;
    const ort = this.#ort;
    if (!tokenizer || !session || !ort) {
      throw new Error("Static ONNX Runtime provider has not been loaded.");
    }
    const encoded = tokenizer(texts, {
      padding: false,
      truncation: false,
      return_tensor: false,
      add_special_tokens: false,
    });
    const prepared = prepareStaticTokenBatch(
      encoded.input_ids,
      this.#options.maxLength,
      tokenizer.pad_token_id,
    );
    const dimensions = [...prepared.dimensions];
    const output = await session.run({
      input_ids: new ort.Tensor("int64", prepared.inputIds, dimensions),
      attention_mask: new ort.Tensor("int64", prepared.attentionMask, dimensions),
    });
    const sentenceEmbedding = output["sentence_embedding"];
    if (!sentenceEmbedding || !(sentenceEmbedding.data instanceof Float32Array)) {
      throw new Error("Static ONNX Runtime did not return a Float32 sentence_embedding tensor.");
    }
    return truncateAndNormalizeSentenceEmbeddings(sentenceEmbedding.data, sentenceEmbedding.dims);
  }
}
