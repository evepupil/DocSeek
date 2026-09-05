import { access } from "node:fs/promises";
import path from "node:path";

import { packageVersion } from "../package-version.js";
import type {
  EmbeddingBatchResult,
  EmbeddingProvider,
  ProviderDescriptor,
  ProviderOptions,
  PoolingStrategy,
} from "../types.js";
import { embedInBatches } from "./shared.js";
import { onnxThreadOptions } from "./session-options.js";

interface ExtractionOutput {
  readonly dims: readonly number[];
  readonly data: ArrayLike<number>;
}

interface FeatureExtractor {
  (
    texts: string[],
    options: { pooling: PoolingStrategy; normalize: true },
  ): Promise<ExtractionOutput>;
  dispose(): Promise<void>;
}

function cachedModelDirectory(options: ProviderOptions): string {
  return options.modelPath ?? path.join(options.modelCacheDir, ...options.model.split("/"));
}

export class TransformersProvider implements EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #options: ProviderOptions;
  #extractor: FeatureExtractor | undefined;

  constructor(options: ProviderOptions) {
    if (options.maxLength !== 512) {
      throw new Error(
        "The Transformers.js pipeline uses the model tokenizer limit. Use direct-ort to benchmark another maximum length.",
      );
    }
    this.#options = options;
    this.descriptor = {
      id: "transformers",
      tool: "@huggingface/transformers",
      toolVersion: packageVersion("@huggingface/transformers"),
      runtime: "onnxruntime-node",
      runtimeVersion: packageVersion("onnxruntime-node"),
      model: options.model,
      modelFormat: "ONNX",
      dtype: options.dtype,
      device: "cpu",
      pooling: options.pooling,
      inputStrategy: "tokenizer-default",
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
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = this.#options.modelCacheDir;
    const sessionOptions = onnxThreadOptions(this.#options);
    this.#extractor = await pipeline("feature-extraction", this.#options.model, {
      dtype: this.#options.dtype,
      cache_dir: this.#options.modelCacheDir,
      ...(sessionOptions ? { session_options: sessionOptions } : {}),
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
      throw new Error("Transformers.js returned no query vector.");
    }
    return vector;
  }

  async dispose(): Promise<void> {
    if (this.#extractor) {
      await this.#extractor.dispose();
      this.#extractor = undefined;
    }
  }

  async #embedBatch(texts: readonly string[]): Promise<readonly Float32Array[]> {
    if (!this.#extractor) {
      throw new Error("Transformers.js provider has not been loaded.");
    }
    const output = await this.#extractor([...texts], {
      pooling: this.#options.pooling,
      normalize: true,
    });
    const batch = output.dims[0];
    const dimension = output.dims[1];
    if (batch !== texts.length || !dimension) {
      throw new Error(`Unexpected Transformers.js output shape [${output.dims.join(", ")}].`);
    }
    return Array.from({ length: batch }, (_, row) => {
      const vector = new Float32Array(dimension);
      for (let column = 0; column < dimension; column += 1) {
        vector[column] = output.data[row * dimension + column] ?? Number.NaN;
      }
      return vector;
    });
  }
}
