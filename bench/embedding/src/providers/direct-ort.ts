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
import { poolAndNormalize } from "../pooling.js";
import { prepareTokenBatch } from "../token-inputs.js";
import { embedInBatches } from "./shared.js";
import { onnxThreadOptions } from "./session-options.js";

interface EncodedArrays {
  readonly input_ids: readonly (readonly number[])[];
  readonly token_type_ids?: readonly (readonly number[])[];
}

interface Tokenizer {
  (
    texts: readonly string[],
    options: { padding: false; truncation: false; return_tensor: false },
  ): EncodedArrays;
  readonly pad_token_id: number;
  readonly sep_token_id: number;
  readonly eos_token_id: number;
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
      pooling: options.pooling,
      inputStrategy: "head-tail-with-separator",
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
    const encoded = tokenizer(texts, {
      padding: false,
      truncation: false,
      return_tensor: false,
    });
    const prepared = prepareTokenBatch(
      {
        inputIds: encoded.input_ids,
        ...(encoded.token_type_ids ? { tokenTypeIds: encoded.token_type_ids } : {}),
      },
      this.#options.maxLength,
      tokenizer.pad_token_id,
      Number.isSafeInteger(tokenizer.sep_token_id)
        ? tokenizer.sep_token_id
        : tokenizer.eos_token_id,
    );
    const dimensions = [...prepared.dimensions];
    const feeds: Record<string, Ort.Tensor> = {
      input_ids: new ort.Tensor("int64", prepared.inputIds, dimensions),
      attention_mask: new ort.Tensor("int64", prepared.attentionMask, dimensions),
    };
    if (session.inputNames.includes("token_type_ids")) {
      feeds["token_type_ids"] = new ort.Tensor(
        "int64",
        prepared.tokenTypeIds ?? new BigInt64Array(prepared.inputIds.length),
        dimensions,
      );
    }
    const output = await session.run(feeds);
    const hiddenState = output["last_hidden_state"];
    if (!hiddenState || !(hiddenState.data instanceof Float32Array)) {
      throw new Error("Direct ONNX Runtime did not return a Float32 last_hidden_state tensor.");
    }
    return poolAndNormalize(
      this.#options.pooling,
      hiddenState.data,
      hiddenState.dims,
      prepared.attentionMask,
    );
  }
}
