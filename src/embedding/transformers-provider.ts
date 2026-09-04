import { createHash } from "node:crypto";

import type { EmbeddingProvider } from "../domain/contracts.js";
import { DocSeekError, errorMessage } from "../domain/errors.js";
import type { EmbeddingConfig } from "../domain/types.js";
import { orderEmbeddingTexts, restoreEmbeddingOrder } from "./batching.js";
import { configureModelNetwork, huggingFaceEndpoint, modelCacheDirectory } from "./network.js";
import { meanPoolAndNormalize } from "./pooling.js";
import { prepareTokenBatch } from "./token-inputs.js";

const EMBEDDING_IMPLEMENTATION_VERSION = 5;

interface ModelTensor<T> {
  readonly dims: readonly number[];
  readonly data: ArrayLike<T>;
}

interface ModelInputs {
  readonly input_ids: ModelTensor<bigint>;
  readonly attention_mask: ModelTensor<bigint>;
  readonly [name: string]: ModelTensor<bigint>;
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

interface FeatureModel {
  (inputs: ModelInputs): Promise<ModelOutput>;
  dispose(): Promise<void>;
}

interface EmbeddingRuntime {
  readonly tokenizer: Tokenizer;
  readonly model: FeatureModel;
  createInt64Tensor(data: BigInt64Array, dimensions: readonly number[]): ModelTensor<bigint>;
}

export function embeddingFingerprint(config: EmbeddingConfig): string {
  const value = JSON.stringify({
    implementation: EMBEDDING_IMPLEMENTATION_VERSION,
    provider: config.provider,
    model: config.model,
    dtype: config.dtype,
    queryPrefix: config.queryPrefix,
    documentPrefix: config.documentPrefix,
    maxTokens: config.maxTokens,
    batchSize: config.batchSize,
  });
  return createHash("sha256").update(value).digest("hex");
}

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly fingerprint: string;
  readonly #config: EmbeddingConfig;
  #runtimePromise: Promise<EmbeddingRuntime> | undefined;

  constructor(config: EmbeddingConfig) {
    this.#config = config;
    this.fingerprint = embeddingFingerprint(config);
  }

  async embedDocuments(texts: readonly string[]): Promise<readonly Float32Array[]> {
    return this.#embed(texts.map((text) => `${this.#config.documentPrefix}${text}`));
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const [embedding] = await this.#embed([`${this.#config.queryPrefix}${text}`]);
    if (!embedding) {
      throw new DocSeekError("EMBEDDING_FAILED", "The embedding model returned no query vector.");
    }
    return embedding;
  }

  async dispose(): Promise<void> {
    if (this.#runtimePromise) {
      const pending = this.#runtimePromise;
      this.#runtimePromise = undefined;
      try {
        const runtime = await pending;
        await runtime.model.dispose();
      } catch {
        // A failed model load has no complete runtime to release.
      }
    }
  }

  async #getRuntime(): Promise<EmbeddingRuntime> {
    this.#runtimePromise ??= (async () => {
      try {
        await configureModelNetwork();
        const { AutoModel, AutoTokenizer, Tensor, env } = await import("@huggingface/transformers");
        const cacheDirectory = modelCacheDirectory();
        env.cacheDir = cacheDirectory;
        const endpoint = huggingFaceEndpoint();
        if (endpoint) {
          env.remoteHost = endpoint;
        }
        const [tokenizer, model] = await Promise.all([
          AutoTokenizer.from_pretrained(this.#config.model, {
            cache_dir: cacheDirectory,
          }),
          AutoModel.from_pretrained(this.#config.model, {
            dtype: this.#config.dtype,
            cache_dir: cacheDirectory,
          }),
        ]);
        return {
          tokenizer: tokenizer as unknown as Tokenizer,
          model: model as unknown as FeatureModel,
          createInt64Tensor: (data, dimensions) => new Tensor("int64", data, [...dimensions]),
        };
      } catch (error) {
        throw new DocSeekError(
          "MODEL_LOAD_FAILED",
          `Could not load embedding model '${this.#config.model}': ${errorMessage(error)}. Check network or set DOCSEEK_HF_ENDPOINT.`,
          { cause: error },
        );
      }
    })();
    return this.#runtimePromise;
  }

  async #embed(texts: readonly string[]): Promise<readonly Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    const runtime = await this.#getRuntime();
    const ordered = orderEmbeddingTexts(texts);
    const orderedVectors: Float32Array[] = [];
    for (let offset = 0; offset < ordered.length; offset += this.#config.batchSize) {
      const batch = ordered.slice(offset, offset + this.#config.batchSize).map((item) => item.text);
      const encoded = runtime.tokenizer(batch, {
        padding: false,
        truncation: false,
        return_tensor: false,
      });
      const prepared = prepareTokenBatch(
        {
          inputIds: encoded.input_ids,
          ...(encoded.token_type_ids ? { tokenTypeIds: encoded.token_type_ids } : {}),
        },
        this.#config.maxTokens,
        runtime.tokenizer.pad_token_id,
        Number.isSafeInteger(runtime.tokenizer.sep_token_id)
          ? runtime.tokenizer.sep_token_id
          : runtime.tokenizer.eos_token_id,
      );
      const inputs: ModelInputs = {
        input_ids: runtime.createInt64Tensor(prepared.inputIds, prepared.dimensions),
        attention_mask: runtime.createInt64Tensor(prepared.attentionMask, prepared.dimensions),
        ...(prepared.tokenTypeIds
          ? {
              token_type_ids: runtime.createInt64Tensor(prepared.tokenTypeIds, prepared.dimensions),
            }
          : {}),
      };
      const output = await runtime.model(inputs);
      const vectors = meanPoolAndNormalize(
        output.last_hidden_state.data,
        output.last_hidden_state.dims,
        inputs.attention_mask.data,
      );
      if (vectors.length !== batch.length) {
        throw new DocSeekError(
          "EMBEDDING_COUNT_MISMATCH",
          `Expected ${batch.length} vectors in a model batch, received ${vectors.length}.`,
        );
      }
      orderedVectors.push(...vectors);
    }
    return restoreEmbeddingOrder(ordered, orderedVectors);
  }
}
