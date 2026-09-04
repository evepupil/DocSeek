import { createHash } from "node:crypto";
import { access, copyFile, link, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type * as FastEmbedApi from "fastembed";
import type { FlagEmbedding } from "fastembed";

import { packageVersion } from "../package-version.js";
import type {
  EmbeddingBatchResult,
  EmbeddingProvider,
  ProviderDescriptor,
  ProviderOptions,
} from "../types.js";
import { normalizeVector } from "../vectors.js";
import { orderTexts, restoreVectorOrder } from "./shared.js";

const FASTEMBED_MODELS: Readonly<Record<string, "BGESmallZH" | "MLE5Large">> = {
  "bge-small-zh": "BGESmallZH",
  "multilingual-e5-large": "MLE5Large",
};

const require = createRequire(import.meta.url);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function linkOrCopy(source: string, destination: string): Promise<void> {
  if (await exists(destination)) {
    return;
  }
  try {
    await link(source, destination);
  } catch {
    await copyFile(source, destination);
  }
}

async function prepareCustomModel(sourceDirectory: string, workCacheDir: string): Promise<string> {
  const modelPath = path.join(sourceDirectory, "onnx", "model_quantized.onnx");
  const modelStat = await stat(modelPath);
  const key = createHash("sha256")
    .update(`${path.resolve(sourceDirectory)}:${modelStat.size}:${modelStat.mtimeMs}`)
    .digest("hex")
    .slice(0, 16);
  const destination = path.join(workCacheDir, `fastembed-custom-${key}`);
  await mkdir(path.join(destination, "onnx"), { recursive: true });
  for (const filename of ["config.json", "tokenizer.json", "tokenizer_config.json"] as const) {
    await copyFile(path.join(sourceDirectory, filename), path.join(destination, filename));
  }
  await linkOrCopy(modelPath, path.join(destination, "onnx", "model_quantized.onnx"));
  const specialTokensPath = path.join(destination, "special_tokens_map.json");
  if (!(await exists(specialTokensPath))) {
    const tokenizerConfig = JSON.parse(
      await readFile(path.join(sourceDirectory, "tokenizer_config.json"), "utf8"),
    ) as Record<string, unknown>;
    const specialTokens = Object.fromEntries(
      ["bos_token", "cls_token", "eos_token", "mask_token", "pad_token", "sep_token", "unk_token"]
        .filter((name) => tokenizerConfig[name] !== undefined)
        .map((name) => [name, tokenizerConfig[name]]),
    );
    await writeFile(specialTokensPath, `${JSON.stringify(specialTokens, null, 2)}\n`, "utf8");
  }
  return destination;
}

function sourceModelDirectory(options: ProviderOptions): string {
  return options.modelPath ?? path.join(options.modelCacheDir, ...options.model.split("/"));
}

export class FastEmbedProvider implements EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #options: ProviderOptions;
  #embedding: FlagEmbedding | undefined;

  constructor(options: ProviderOptions) {
    this.#options = options;
    this.descriptor = {
      id: "fastembed",
      tool: "fastembed",
      toolVersion: packageVersion("fastembed"),
      runtime: "onnxruntime-node",
      runtimeVersion: "1.21.0",
      model: options.model,
      modelFormat: options.model === "custom" ? "ONNX custom" : "FastEmbed ONNX archive",
      dtype: options.dtype,
      device: "cpu",
      batchingStrategy: options.batchingStrategy,
      maxLength: options.maxLength,
      ...(options.intraOpThreads !== undefined ? { intraOpThreads: options.intraOpThreads } : {}),
      ...(options.interOpThreads !== undefined ? { interOpThreads: options.interOpThreads } : {}),
    };
  }

  async cachePresent(): Promise<boolean> {
    if (this.#options.model === "custom") {
      return exists(path.join(sourceModelDirectory(this.#options), "onnx", "model_quantized.onnx"));
    }
    return exists(path.join(this.#options.workCacheDir, `fast-${this.#options.model}`));
  }

  async load(): Promise<void> {
    // The ESM build expects a default export removed by the secure tar release. The package's
    // CommonJS entry handles the same named exports and lets the benchmark retain the override.
    const { EmbeddingModel, ExecutionProvider, FlagEmbedding } =
      require("fastembed") as typeof FastEmbedApi;
    if (this.#options.model === "custom") {
      const prepared = await prepareCustomModel(
        sourceModelDirectory(this.#options),
        this.#options.workCacheDir,
      );
      this.#embedding = await FlagEmbedding.init({
        model: EmbeddingModel.CUSTOM,
        modelAbsoluteDirPath: prepared,
        modelName: path.join("onnx", "model_quantized.onnx"),
        executionProviders: [ExecutionProvider.CPU],
        maxLength: this.#options.maxLength,
        showDownloadProgress: false,
      });
      return;
    }
    const enumName = FASTEMBED_MODELS[this.#options.model];
    if (!enumName) {
      throw new Error(
        `Unsupported FastEmbed model '${this.#options.model}'. Use custom, bge-small-zh, or multilingual-e5-large.`,
      );
    }
    this.#embedding = await FlagEmbedding.init({
      model: EmbeddingModel[enumName],
      executionProviders: [ExecutionProvider.CPU],
      maxLength: this.#options.maxLength,
      cacheDir: this.#options.workCacheDir,
      showDownloadProgress: false,
    });
  }

  async embedDocuments(
    texts: readonly string[],
    batchSize: number,
    onBatch: () => void,
  ): Promise<EmbeddingBatchResult> {
    if (!this.#embedding) {
      throw new Error("FastEmbed provider has not been loaded.");
    }
    const vectors: Float32Array[] = [];
    let batchCalls = 0;
    const inputs = texts.map((text) => `${this.#options.documentPrefix}${text}`);
    const ordered = orderTexts(inputs, this.#options.batchingStrategy);
    for await (const batch of this.#embedding.embed(
      ordered.map((item) => item.text),
      batchSize,
    )) {
      vectors.push(...batch.map((vector) => normalizeVector(vector)));
      batchCalls += 1;
      onBatch();
    }
    return { vectors: restoreVectorOrder(ordered, vectors), batchCalls };
  }

  async embedQuery(text: string): Promise<Float32Array> {
    if (!this.#embedding) {
      throw new Error("FastEmbed provider has not been loaded.");
    }
    const iterator = this.#embedding.embed([`${this.#options.queryPrefix}${text}`], 1);
    const batch = await iterator.next();
    const vector = batch.value?.[0];
    if (!vector) {
      throw new Error("FastEmbed returned no query vector.");
    }
    return normalizeVector(vector);
  }

  dispose(): Promise<void> {
    // FastEmbed 2.1.0 does not expose its ONNX session for disposal. Each run uses a child process.
    this.#embedding = undefined;
    return Promise.resolve();
  }
}
