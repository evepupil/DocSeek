import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  benchmarkDtype,
  benchmarkPooling,
  modelUsesPlainText,
  supportsConfigurablePooling,
  validateProviderOptions,
} from "./provider-options.js";
import { summarizeNumbers } from "./stats.js";
import type { BatchingStrategy, ProviderId, WorkerConfig, WorkerResult } from "./types.js";

const resultMarker = "DOCSEEK_EMBEDDING_BENCH_RESULT ";
const packageRoot = path.resolve(import.meta.dirname, "../..");
const invocationDirectory = path.resolve(process.env["INIT_CWD"] ?? process.cwd());

function resolveUserPath(value: string): string {
  return path.resolve(invocationDirectory, value);
}

function help(): string {
  return `DocSeek embedding benchmark

Usage:
  npm --prefix bench/embedding run benchmark -- --provider <name> [options]

Options:
  --provider <name>          transformers | transformers-core | direct-ort | static-ort | fastembed | llama-cpp
  --batch-size <n>           Repeat to compare several sizes (default: 8, 16, 32)
  --batching <name>          sequential | length-bucketed (default: sequential)
  --intra-op-threads <n>     ONNX work inside one operation (default: runtime choice)
  --inter-op-threads <n>     ONNX parallel graph operations (default: runtime choice)
  --runs <n>                 Fresh child processes per batch size (default: 3)
  --query-runs <n>           Repeated query embeddings per quality case (default: 2)
  --limit <n>                Evenly sample the corpus for a quick run
  --index <path>             Source DocSeek index (required)
  --cases <path>             Semantic quality cases
  --model <name>             Model id; FastEmbed also accepts custom or bge-small-zh
  --model-path <path>        Model directory, ONNX file, or llama.cpp GGUF (provider-specific)
  --model-cache <path>       Transformers.js model cache
  --work-cache <path>        Ignored benchmark cache
  --dtype <name>             Model precision label (static-ort: int8; otherwise q8)
  --max-length <n>           Maximum input tokens (default: 512)
  --document-prefix <text>   Document prefix (default: passage: )
  --query-prefix <text>      Query prefix (default: query: )
  --pooling <name>           mean | cls (known BGE/Granite models default to cls)
  --output <path>            Raw JSON result path
  --help                     Show this message
`;
}

function positiveInteger(name: string, value: string | undefined, fallback?: number): number {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function providerId(value: string | undefined): ProviderId {
  if (
    value !== "transformers" &&
    value !== "transformers-core" &&
    value !== "direct-ort" &&
    value !== "static-ort" &&
    value !== "fastembed" &&
    value !== "llama-cpp"
  ) {
    throw new Error(
      "--provider must be transformers, transformers-core, direct-ort, static-ort, fastembed, or llama-cpp.",
    );
  }
  return value;
}

function defaultModel(id: ProviderId): string {
  if (id === "static-ort") {
    return "sentence-transformers/static-similarity-mrl-multilingual-v1";
  }
  if (id === "fastembed") {
    return "custom";
  }
  if (id === "llama-cpp") {
    return "bge-m3";
  }
  return "Xenova/multilingual-e5-small";
}

function defaultDocumentPrefix(id: ProviderId, model: string): string {
  return id === "llama-cpp" || id === "static-ort" || modelUsesPlainText(model) ? "" : "passage: ";
}

function defaultQueryPrefix(id: ProviderId, model: string): string {
  return id === "llama-cpp" || id === "static-ort" || modelUsesPlainText(model) ? "" : "query: ";
}

function batchingStrategy(value: string | undefined): BatchingStrategy {
  const selected = value ?? "sequential";
  if (selected !== "sequential" && selected !== "length-bucketed") {
    throw new Error("--batching must be sequential or length-bucketed.");
  }
  return selected;
}

function defaultModelCache(): string {
  return path.join(packageRoot, "cache", "models");
}

function defaultOutput(provider: ProviderId): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return path.join(packageRoot, "results", `${timestamp}-${provider}.json`);
}

function reportPath(value: string): string {
  const relative = path.relative(invocationDirectory, value);
  if (relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.replaceAll(path.sep, "/");
  }
  return value;
}

async function runWorker(config: WorkerConfig): Promise<WorkerResult> {
  const workerPath = path.join(import.meta.dirname, "worker.js");
  const encoded = Buffer.from(JSON.stringify(config), "utf8").toString("base64url");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, encoded], {
      cwd: packageRoot,
      env: { ...process.env, NO_COLOR: "1" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => process.stderr.write(chunk));
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      const markerLine = stdout.split(/\r?\n/u).findLast((line) => line.startsWith(resultMarker));
      if (!markerLine) {
        reject(new Error(`Worker exited with ${code ?? "unknown"} and returned no result.`));
        return;
      }
      try {
        resolve(JSON.parse(markerLine.slice(resultMarker.length)) as WorkerResult);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

function printSummary(results: readonly WorkerResult[]): void {
  const successful = results.filter((result) => result.ok);
  const batchSizes = [...new Set(results.map((result) => result.batchSize))].sort(
    (left, right) => left - right,
  );
  console.log("batch runs embed_ms[min/median/max] chunks/s peak_mib recall@5 top1 mrr rescue@5");
  for (const batchSize of batchSizes) {
    const runs = successful.filter((result) => result.batchSize === batchSize);
    if (runs.length === 0) {
      console.log(`${batchSize} 0 failed`);
      continue;
    }
    const embedding = summarizeNumbers(runs.map((run) => run.timings.documentEmbeddingMs));
    const throughput = summarizeNumbers(runs.map((run) => run.throughput.chunksPerSecond));
    const memory = summarizeNumbers(runs.map((run) => run.memory.peakRssMiB));
    const quality = runs[0]?.quality.metrics;
    const sparse = runs[0]?.quality.sparse;
    console.log(
      `${batchSize} ${runs.length} ${embedding.minimum.toFixed(0)}/${embedding.median.toFixed(0)}/${embedding.maximum.toFixed(0)} ${throughput.median.toFixed(1)} ${memory.maximum.toFixed(0)} ${quality?.recallAt5.toFixed(3) ?? "-"} ${quality?.top1.toFixed(3) ?? "-"} ${quality?.meanReciprocalRank.toFixed(3) ?? "-"} ${sparse?.semanticRescueRateAt5.toFixed(3) ?? "-"}`,
    );
  }
  for (const failure of results.filter((result) => !result.ok)) {
    console.error(`FAIL batch ${failure.batchSize} run ${failure.run}: ${failure.error}`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      provider: { type: "string" },
      "batch-size": { type: "string", multiple: true },
      batching: { type: "string" },
      "intra-op-threads": { type: "string" },
      "inter-op-threads": { type: "string" },
      runs: { type: "string" },
      "query-runs": { type: "string" },
      limit: { type: "string" },
      index: { type: "string" },
      cases: { type: "string" },
      model: { type: "string" },
      "model-path": { type: "string" },
      "model-cache": { type: "string" },
      "work-cache": { type: "string" },
      dtype: { type: "string" },
      "max-length": { type: "string" },
      "document-prefix": { type: "string" },
      "query-prefix": { type: "string" },
      pooling: { type: "string" },
      output: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(help());
    return;
  }
  const id = providerId(values.provider);
  if (!values.index) {
    throw new Error("--index is required so benchmark runs cannot silently use a stale corpus.");
  }
  const batchSizes = (values["batch-size"] ?? ["8", "16", "32"]).map((value) =>
    positiveInteger("--batch-size", value),
  );
  const runs = positiveInteger("--runs", values.runs, 3);
  const queryRuns = positiveInteger("--query-runs", values["query-runs"], 2);
  const limit = values.limit ? positiveInteger("--limit", values.limit) : undefined;
  const outputPath = values.output ? resolveUserPath(values.output) : defaultOutput(id);
  const model = values.model ?? defaultModel(id);
  const documentPrefix = values["document-prefix"] ?? defaultDocumentPrefix(id, model);
  const queryPrefix = values["query-prefix"] ?? defaultQueryPrefix(id, model);
  validateProviderOptions({
    id,
    poolingSpecified: values.pooling !== undefined,
    documentPrefix,
    queryPrefix,
  });
  const baseConfig = {
    id,
    model,
    ...(values["model-path"] ? { modelPath: resolveUserPath(values["model-path"]) } : {}),
    modelCacheDir: values["model-cache"]
      ? resolveUserPath(values["model-cache"])
      : defaultModelCache(),
    workCacheDir: values["work-cache"]
      ? resolveUserPath(values["work-cache"])
      : path.join(packageRoot, "cache"),
    dtype: benchmarkDtype(id, values.dtype),
    maxLength: positiveInteger("--max-length", values["max-length"], 512),
    documentPrefix,
    queryPrefix,
    pooling: benchmarkPooling(model, values.pooling),
    batchingStrategy: batchingStrategy(values.batching),
    ...(values["intra-op-threads"]
      ? { intraOpThreads: positiveInteger("--intra-op-threads", values["intra-op-threads"]) }
      : {}),
    ...(values["inter-op-threads"]
      ? { interOpThreads: positiveInteger("--inter-op-threads", values["inter-op-threads"]) }
      : {}),
    indexPath: resolveUserPath(values.index),
    casesPath: values.cases
      ? resolveUserPath(values.cases)
      : path.join(packageRoot, "cases", "inferforge.json"),
    queryRuns,
    ...(limit ? { limit } : {}),
  } satisfies Omit<WorkerConfig, "batchSize" | "run">;

  const results: WorkerResult[] = [];
  for (const batchSize of batchSizes) {
    for (let run = 1; run <= runs; run += 1) {
      console.error(`Running ${id}, batch ${batchSize}, run ${run}/${runs}...`);
      results.push(await runWorker({ ...baseConfig, batchSize, run }));
    }
  }
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    command: {
      provider: baseConfig.id,
      model: baseConfig.model,
      ...(baseConfig.modelPath ? { modelPath: reportPath(baseConfig.modelPath) } : {}),
      modelCache: reportPath(baseConfig.modelCacheDir),
      workCache: reportPath(baseConfig.workCacheDir),
      index: reportPath(baseConfig.indexPath),
      cases: reportPath(baseConfig.casesPath),
      dtype: baseConfig.dtype,
      maxLength: baseConfig.maxLength,
      documentPrefix: baseConfig.documentPrefix,
      queryPrefix: baseConfig.queryPrefix,
      ...(supportsConfigurablePooling(baseConfig.id) || baseConfig.id === "static-ort"
        ? { pooling: baseConfig.pooling }
        : {}),
      batchingStrategy: baseConfig.batchingStrategy,
      ...(baseConfig.intraOpThreads !== undefined
        ? { intraOpThreads: baseConfig.intraOpThreads }
        : {}),
      ...(baseConfig.interOpThreads !== undefined
        ? { interOpThreads: baseConfig.interOpThreads }
        : {}),
      batchSizes,
      runs,
      queryRuns: baseConfig.queryRuns,
      ...(baseConfig.limit ? { limit: baseConfig.limit } : {}),
    },
    results,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(results);
  console.log(`result ${outputPath}`);
  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

await main();
