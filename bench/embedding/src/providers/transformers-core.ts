import { access } from "node:fs/promises";
import path from "node:path";

import { packageVersion } from "../package-version.js";
import { poolAndNormalize } from "../pooling.js";
import { prepareTokenBatch } from "../token-inputs.js";
import type {
  EmbeddingBatchResult,
  EmbeddingProvider,
  ProviderDescriptor,
  ProviderOptions,
} from "../types.js";
import { embedInBatches } from "./shared.js";
import { onnxThreadOptions } from "./session-options.js";

interface ModelTensor<T> {
  readonly dims: readonly number[];
  readonly data: ArrayLike<T>;
}

interface ModelInputs {
  readonly input_ids: ModelTensor<bigint>;
  readonly attention_mask: ModelTensor<bigint>;
  readonly token_type_ids?: ModelTensor<bigint>;
}

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

interface ModelOutput {
  readonly last_hidden_state: ModelTensor<number>;
}

interface EmbeddingModel {
  (inputs: ModelInputs): Promise<ModelOutput>;
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
  #createInt64Tensor:
    ((data: BigInt64Array, dimensions: readonly number[]) => ModelTensor<bigint>) | undefined;

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
      await access(cachedModelDirectory(this.#options));
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<void> {
    const { AutoModel, AutoTokenizer, Tensor, env } = await import("@huggingface/transformers");
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
    this.#createInt64Tensor = (data, dimensions) => new Tensor("int64", data, [...dimensions]);
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
    this.#createInt64Tensor = undefined;
  }

  async #embedBatch(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const tokenizer = this.#tokenizer;
    const model = this.#model;
    const createInt64Tensor = this.#createInt64Tensor;
    if (!tokenizer || !model || !createInt64Tensor) {
      throw new Error("Transformers.js core provider has not been loaded.");
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
    const inputs: ModelInputs = {
      input_ids: createInt64Tensor(prepared.inputIds, prepared.dimensions),
      attention_mask: createInt64Tensor(prepared.attentionMask, prepared.dimensions),
      ...(prepared.tokenTypeIds
        ? { token_type_ids: createInt64Tensor(prepared.tokenTypeIds, prepared.dimensions) }
        : {}),
    };
    const output = await model(inputs);
    const hidden = output.last_hidden_state;
    if (!(hidden.data instanceof Float32Array)) {
      throw new Error("Transformers.js core did not return Float32 hidden states.");
    }
    return poolAndNormalize(
      this.#options.pooling,
      hidden.data,
      hidden.dims,
      prepared.attentionMask,
    );
  }
}
