import { createHash } from "node:crypto";

import type { EmbeddingProvider } from "../domain/contracts.js";
import { DocSeekError, errorMessage } from "../domain/errors.js";
import type { EmbeddingConfig } from "../domain/types.js";
import { configureModelNetwork, huggingFaceEndpoint, modelCacheDirectory } from "./network.js";

interface ExtractionOutput {
  readonly dims: readonly number[];
  readonly data: ArrayLike<number>;
}

interface FeatureExtractor {
  (
    texts: string | string[],
    options: { pooling: "mean"; normalize: true },
  ): Promise<ExtractionOutput>;
  dispose(): Promise<void>;
}

export function embeddingFingerprint(config: EmbeddingConfig): string {
  const value = JSON.stringify({
    provider: config.provider,
    model: config.model,
    dtype: config.dtype,
    queryPrefix: config.queryPrefix,
    documentPrefix: config.documentPrefix,
  });
  return createHash("sha256").update(value).digest("hex");
}

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly fingerprint: string;
  readonly #config: EmbeddingConfig;
  #extractorPromise: Promise<FeatureExtractor> | undefined;

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
    if (this.#extractorPromise) {
      const pending = this.#extractorPromise;
      this.#extractorPromise = undefined;
      try {
        const extractor = await pending;
        await extractor.dispose();
      } catch {
        // A failed model load has no allocated pipeline to release.
      }
    }
  }

  async #getExtractor(): Promise<FeatureExtractor> {
    this.#extractorPromise ??= (async () => {
      try {
        await configureModelNetwork();
        const { env, pipeline } = await import("@huggingface/transformers");
        env.cacheDir = modelCacheDirectory();
        const endpoint = huggingFaceEndpoint();
        if (endpoint) {
          env.remoteHost = endpoint;
        }
        const extractor = await pipeline("feature-extraction", this.#config.model, {
          dtype: this.#config.dtype,
        });
        return extractor;
      } catch (error) {
        throw new DocSeekError(
          "MODEL_LOAD_FAILED",
          `Could not load embedding model '${this.#config.model}': ${errorMessage(error)}. Check network or set DOCSEEK_HF_ENDPOINT.`,
          { cause: error },
        );
      }
    })();
    return this.#extractorPromise;
  }

  async #embed(texts: readonly string[]): Promise<readonly Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    const extractor = await this.#getExtractor();
    const embeddings: Float32Array[] = [];
    for (let offset = 0; offset < texts.length; offset += this.#config.batchSize) {
      const batch = texts.slice(offset, offset + this.#config.batchSize);
      const output = await extractor([...batch], { pooling: "mean", normalize: true });
      if (output.dims.length !== 2 || output.dims[0] !== batch.length || !output.dims[1]) {
        throw new DocSeekError(
          "EMBEDDING_SHAPE_INVALID",
          `Unexpected embedding shape: [${output.dims.join(", ")}].`,
        );
      }

      const dimension = output.dims[1];
      for (let row = 0; row < batch.length; row += 1) {
        const vector = new Float32Array(dimension);
        for (let column = 0; column < dimension; column += 1) {
          const value = output.data[row * dimension + column];
          if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new DocSeekError(
              "EMBEDDING_VALUE_INVALID",
              "The embedding model returned an invalid value.",
            );
          }
          vector[column] = value;
        }
        embeddings.push(vector);
      }
    }
    return embeddings;
  }
}
