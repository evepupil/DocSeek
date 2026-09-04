import { access } from "node:fs/promises";
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

interface TokenizerTensor {
  readonly dims: readonly number[];
  readonly data: ArrayLike<bigint>;
}

interface TokenizedBatch {
  readonly input_ids: TokenizerTensor;
  readonly attention_mask: TokenizerTensor;
}

interface Tokenizer {
  (
    texts: readonly string[],
    options: { padding: true; truncation: true; max_length: number },
  ): TokenizedBatch;
}

function modelDirectory(options: ProviderOptions): string {
  return options.modelPath && !options.modelPath.endsWith(".onnx")
    ? options.modelPath
    : path.join(options.modelCacheDir, ...options.model.split("/"));
}

function modelFile(options: ProviderOptions): string {
  if (options.modelPath?.endsWith(".onnx")) {
    return options.modelPath;
  }
  const filename = options.dtype === "q8" ? "model_quantized.onnx" : `model_${options.dtype}.onnx`;
  return path.join(modelDirectory(options), "onnx", filename);
}

function toBigInt64(values: ArrayLike<bigint>): BigInt64Array {
  return BigInt64Array.from(Array.from(values));
}

export function meanPoolAndNormalize(
  hiddenState: Float32Array,
  hiddenDims: readonly number[],
  attentionMask: ArrayLike<bigint>,
): readonly Float32Array[] {
  const batch = hiddenDims[0];
  const tokens = hiddenDims[1];
  const dimension = hiddenDims[2];
  if (!batch || !tokens || !dimension || hiddenState.length !== batch * tokens * dimension) {
    throw new Error(`Unexpected ONNX hidden state shape [${hiddenDims.join(", ")}].`);
  }
  if (attentionMask.length !== batch * tokens) {
    throw new Error("Attention mask does not match the hidden state shape.");
  }
  return Array.from({ length: batch }, (_, row) => {
    const pooled = new Float32Array(dimension);
    let includedTokens = 0;
    for (let token = 0; token < tokens; token += 1) {
      if (attentionMask[row * tokens + token] === 0n) {
        continue;
      }
      includedTokens += 1;
      const offset = (row * tokens + token) * dimension;
      for (let column = 0; column < dimension; column += 1) {
        pooled[column] = (pooled[column] ?? 0) + (hiddenState[offset + column] ?? 0);
      }
    }
    if (includedTokens === 0) {
      throw new Error(`ONNX row ${row} has no unmasked tokens.`);
    }
    for (let column = 0; column < dimension; column += 1) {
      pooled[column] = (pooled[column] ?? 0) / includedTokens;
    }
    return normalizeVector(pooled);
  });
}

export class DirectOrtProvider implements EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #options: ProviderOptions;
  #ort: typeof Ort | undefined;
  #session: Ort.InferenceSession | undefined;
  #tokenizer: Tokenizer | undefined;

  constructor(options: ProviderOptions) {
    this.#options = options;
    this.descriptor = {
      id: "direct-ort",
      tool: "onnxruntime-node",
      toolVersion: packageVersion("onnxruntime-node"),
      runtime: "@huggingface/transformers tokenizer",
      runtimeVersion: packageVersion("@huggingface/transformers"),
      model: options.model,
      modelFormat: "ONNX",
      dtype: options.dtype,
      device: "cpu",
      batchingStrategy: options.batchingStrategy,
      maxLength: options.maxLength,
      ...(options.intraOpThreads !== undefined ? { intraOpThreads: options.intraOpThreads } : {}),
      ...(options.interOpThreads !== undefined ? { interOpThreads: options.interOpThreads } : {}),
    };
  }

  async cachePresent(): Promise<boolean> {
    try {
      await access(modelFile(this.#options));
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<void> {
    const [{ AutoTokenizer, env }, ort] = await Promise.all([
      import("@huggingface/transformers"),
      import("onnxruntime-node"),
    ]);
    env.cacheDir = this.#options.modelCacheDir;
    this.#ort = ort;
    this.#tokenizer = (await AutoTokenizer.from_pretrained(this.#options.model, {
      cache_dir: this.#options.modelCacheDir,
    })) as unknown as Tokenizer;
    const threadOptions = onnxThreadOptions(this.#options);
    this.#session = await ort.InferenceSession.create(modelFile(this.#options), {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
      ...threadOptions,
    });
  }

  async embedDocuments(
    texts: readonly string[],
    batchSize: number,
    onBatch: () => void,
  ): Promise<EmbeddingBatchResult> {
    return embedInBatches(
      texts.map((text) => `${this.#options.documentPrefix}${text}`),
      batchSize,
      (batch) => this.#embedBatch(batch),
      onBatch,
      this.#options.batchingStrategy,
    );
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const [vector] = await this.#embedBatch([`${this.#options.queryPrefix}${text}`]);
    if (!vector) {
      throw new Error("Direct ONNX Runtime returned no query vector.");
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
      throw new Error("Direct ONNX Runtime provider has not been loaded.");
    }
    const tokens = tokenizer(texts, {
      padding: true,
      truncation: true,
      max_length: this.#options.maxLength,
    });
    const dimensions = [...tokens.input_ids.dims];
    const inputIds = toBigInt64(tokens.input_ids.data);
    const attentionMask = toBigInt64(tokens.attention_mask.data);
    const feeds: Record<string, Ort.Tensor> = {
      input_ids: new ort.Tensor("int64", inputIds, dimensions),
      attention_mask: new ort.Tensor("int64", attentionMask, dimensions),
    };
    if (session.inputNames.includes("token_type_ids")) {
      feeds["token_type_ids"] = new ort.Tensor(
        "int64",
        new BigInt64Array(inputIds.length),
        dimensions,
      );
    }
    const output = await session.run(feeds);
    const hiddenState = output["last_hidden_state"];
    if (!hiddenState || !(hiddenState.data instanceof Float32Array)) {
      throw new Error("Direct ONNX Runtime did not return a Float32 last_hidden_state tensor.");
    }
    return meanPoolAndNormalize(hiddenState.data, hiddenState.dims, attentionMask);
  }
}
