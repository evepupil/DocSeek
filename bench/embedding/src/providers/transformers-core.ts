import { access } from "node:fs/promises";
import path from "node:path";

import { packageVersion } from "../package-version.js";
import type {
  EmbeddingBatchResult,
  EmbeddingProvider,
  ProviderDescriptor,
  ProviderOptions,
} from "../types.js";
import { meanPoolAndNormalize } from "./direct-ort.js";
import { embedInBatches } from "./shared.js";
import { onnxThreadOptions } from "./session-options.js";

interface ModelTensor<T> {
  readonly dims: readonly number[];
  readonly data: ArrayLike<T>;
}

interface TokenizedBatch {
  readonly input_ids: ModelTensor<bigint>;
  readonly attention_mask: ModelTensor<bigint>;
  readonly [name: string]: ModelTensor<bigint>;
}

interface Tokenizer {
  (
    texts: readonly string[],
    options: { padding: true; truncation: true; max_length: number },
  ): TokenizedBatch;
}

interface ModelOutput {
  readonly last_hidden_state: ModelTensor<number>;
}

interface EmbeddingModel {
  (inputs: TokenizedBatch): Promise<ModelOutput>;
  dispose(): Promise<void>;
}

function cachedModelDirectory(options: ProviderOptions): string {
  return options.modelPath ?? path.join(options.modelCacheDir, ...options.model.split("/"));
}

export class TransformersCoreProvider implements EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #options: ProviderOptions;
  #tokenizer: Tokenizer | undefined;
  #model: EmbeddingModel | undefined;

  constructor(options: ProviderOptions) {
    this.#options = options;
    this.descriptor = {
      id: "transformers-core",
      tool: "@huggingface/transformers core",
      toolVersion: packageVersion("@huggingface/transformers"),
      runtime: "onnxruntime-node",
      runtimeVersion: packageVersion("onnxruntime-node"),
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
      await access(cachedModelDirectory(this.#options));
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<void> {
    const { AutoModel, AutoTokenizer, env } = await import("@huggingface/transformers");
    env.cacheDir = this.#options.modelCacheDir;
    const sessionOptions = onnxThreadOptions(this.#options);
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(this.#options.model, {
        cache_dir: this.#options.modelCacheDir,
      }),
      AutoModel.from_pretrained(this.#options.model, {
        dtype: this.#options.dtype,
        cache_dir: this.#options.modelCacheDir,
        ...(sessionOptions ? { session_options: sessionOptions } : {}),
      }),
    ]);
    this.#tokenizer = tokenizer as unknown as Tokenizer;
    this.#model = model as unknown as EmbeddingModel;
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
      throw new Error("Transformers.js core returned no query vector.");
    }
    return vector;
  }

  async dispose(): Promise<void> {
    await this.#model?.dispose();
    this.#model = undefined;
    this.#tokenizer = undefined;
  }

  async #embedBatch(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const tokenizer = this.#tokenizer;
    const model = this.#model;
    if (!tokenizer || !model) {
      throw new Error("Transformers.js core provider has not been loaded.");
    }
    const tokens = tokenizer(texts, {
      padding: true,
      truncation: true,
      max_length: this.#options.maxLength,
    });
    const output = await model(tokens);
    const hidden = output.last_hidden_state;
    if (!(hidden.data instanceof Float32Array)) {
      throw new Error("Transformers.js core did not return Float32 hidden states.");
    }
    return meanPoolAndNormalize(hidden.data, hidden.dims, tokens.attention_mask.data);
  }
}
