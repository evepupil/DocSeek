import { access } from "node:fs/promises";

import type { Llama, LlamaEmbeddingContext, LlamaModel } from "node-llama-cpp";

import { packageVersion } from "../package-version.js";
import type {
  EmbeddingBatchResult,
  EmbeddingProvider,
  ProviderDescriptor,
  ProviderOptions,
} from "../types.js";
import { normalizeVector } from "../vectors.js";

export class LlamaCppProvider implements EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #options: ProviderOptions;
  #llama: Llama | undefined;
  #model: LlamaModel | undefined;
  #context: LlamaEmbeddingContext | undefined;

  constructor(options: ProviderOptions) {
    if (!options.modelPath) {
      throw new Error("llama-cpp requires --model-path pointing to an embedding GGUF file.");
    }
    this.#options = options;
    this.descriptor = {
      id: "llama-cpp",
      tool: "node-llama-cpp",
      toolVersion: packageVersion("node-llama-cpp"),
      runtime: "llama.cpp",
      model: options.model,
      modelFormat: "GGUF",
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
      await access(this.#options.modelPath ?? "");
      return true;
    } catch {
      return false;
    }
  }

  async load(batchSize: number): Promise<void> {
    const { getLlama } = await import("node-llama-cpp");
    this.#llama = await getLlama({
      gpu: false,
      build: "never",
      skipDownload: true,
      progressLogs: false,
    });
    this.#model = await this.#llama.loadModel({
      modelPath: this.#options.modelPath ?? "",
      gpuLayers: 0,
    });
    this.#context = await this.#model.createEmbeddingContext({
      contextSize: this.#options.maxLength,
      batchSize,
      threads: this.#options.intraOpThreads ?? 0,
    });
  }

  async embedDocuments(
    texts: readonly string[],
    _batchSize: number,
    onBatch: () => void,
  ): Promise<EmbeddingBatchResult> {
    if (!this.#context) {
      throw new Error("llama.cpp provider has not been loaded.");
    }
    const vectors: Float32Array[] = [];
    for (const text of texts) {
      vectors.push(await this.#embed(`${this.#options.documentPrefix}${text}`));
      onBatch();
    }
    return { vectors, batchCalls: texts.length };
  }

  async embedQuery(text: string): Promise<Float32Array> {
    if (!this.#context) {
      throw new Error("llama.cpp provider has not been loaded.");
    }
    return this.#embed(`${this.#options.queryPrefix}${text}`);
  }

  async dispose(): Promise<void> {
    await this.#context?.dispose();
    await this.#model?.dispose();
    await this.#llama?.dispose();
    this.#context = undefined;
    this.#model = undefined;
    this.#llama = undefined;
  }

  async #embed(text: string): Promise<Float32Array> {
    if (!this.#context || !this.#model) {
      throw new Error("llama.cpp provider has not been loaded.");
    }
    const maximumContentTokens = Math.max(1, this.#options.maxLength - 2);
    const tokens = this.#model.tokenize(text).slice(0, maximumContentTokens);
    const embedding = await this.#context.getEmbeddingFor(tokens);
    return normalizeVector(embedding.vector);
  }
}
