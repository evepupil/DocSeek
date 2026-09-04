import os from "node:os";

import { z } from "zod";

import { loadCorpus } from "./corpus.js";
import { RssSampler } from "./memory.js";
import { createProvider } from "./providers/factory.js";
import { loadQualitySuite, observeQuality, rankLocations, summarizeQuality } from "./quality.js";
import { measureSqliteWrite } from "./sqlite-write.js";
import { percentile } from "./stats.js";
import type { BenchmarkRun, FailedBenchmarkRun, WorkerConfig, WorkerResult } from "./types.js";
import { validateVectors } from "./vectors.js";

const processStartedAt = performance.now();
const resultMarker = "DOCSEEK_EMBEDDING_BENCH_RESULT ";

const workerConfigSchema = z.object({
  id: z.enum(["transformers", "transformers-core", "direct-ort", "fastembed", "llama-cpp"]),
  model: z.string().min(1),
  modelPath: z.string().min(1).optional(),
  modelCacheDir: z.string().min(1),
  workCacheDir: z.string().min(1),
  dtype: z.enum(["fp32", "fp16", "q8", "int8", "uint8", "q4"]),
  maxLength: z.number().int().positive(),
  documentPrefix: z.string(),
  queryPrefix: z.string(),
  batchingStrategy: z.enum(["sequential", "length-bucketed"]),
  intraOpThreads: z.number().int().positive().optional(),
  interOpThreads: z.number().int().positive().optional(),
  indexPath: z.string().min(1),
  casesPath: z.string().min(1),
  batchSize: z.number().int().positive(),
  queryRuns: z.number().int().positive(),
  limit: z.number().int().positive().optional(),
  run: z.number().int().positive(),
});

function environment(): BenchmarkRun["environment"] {
  const processors = os.cpus();
  return {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    cpu: processors[0]?.model.trim() ?? "unknown",
    logicalProcessors: processors.length,
    totalMemoryMiB: os.totalmem() / (1024 * 1024),
  };
}

async function runBenchmark(config: WorkerConfig): Promise<BenchmarkRun> {
  const sampler = new RssSampler();
  sampler.start();
  const corpusStartedAt = performance.now();
  const corpus = loadCorpus(config.indexPath, config.limit);
  const suite = await loadQualitySuite(config.casesPath);
  const corpusLoadMs = performance.now() - corpusStartedAt;
  const provider = createProvider(config);
  const cacheWarmBefore = await provider.cachePresent();
  try {
    const providerStartedAt = performance.now();
    await provider.load(config.batchSize);
    const providerLoadMs = performance.now() - providerStartedAt;
    sampler.sample();

    const documentStartedAt = performance.now();
    const embedded = await provider.embedDocuments(
      corpus.chunks.map((chunk) => chunk.text),
      config.batchSize,
      () => {
        sampler.sample();
      },
    );
    const documentEmbeddingMs = performance.now() - documentStartedAt;
    const dimension = validateVectors(embedded.vectors, corpus.chunks.length);
    const sqliteWriteMs = await measureSqliteWrite(embedded.vectors);

    const queryLatencies: number[] = [];
    const observations = [];
    for (const testCase of suite.cases) {
      const rankings = [];
      for (let run = 0; run < config.queryRuns; run += 1) {
        const queryStartedAt = performance.now();
        const queryVector = await provider.embedQuery(testCase.query);
        queryLatencies.push(performance.now() - queryStartedAt);
        validateVectors([queryVector], 1);
        rankings.push(rankLocations(corpus.chunks, embedded.vectors, queryVector));
        sampler.sample();
      }
      observations.push(observeQuality(testCase.id, testCase.expected, rankings));
    }
    const quality = summarizeQuality(observations);
    const durationSeconds = documentEmbeddingMs / 1000;
    const peakRssMiB = sampler.stop();
    return {
      ok: true,
      run: config.run,
      environment: environment(),
      provider: provider.descriptor,
      batchSize: config.batchSize,
      cacheWarmBefore,
      corpus: {
        totalChunksInIndex: corpus.totalChunksInIndex,
        documentCount: corpus.documentCount,
        totalCharacters: corpus.totalCharacters,
        fingerprint: corpus.fingerprint,
      },
      dimension,
      batchCalls: embedded.batchCalls,
      timings: {
        corpusLoadMs,
        providerLoadMs,
        documentEmbeddingMs,
        sqliteWriteMs,
        queryEmbeddingP50Ms: percentile(queryLatencies, 0.5),
        queryEmbeddingP95Ms: percentile(queryLatencies, 0.95),
        totalMs: performance.now() - processStartedAt,
      },
      throughput: {
        chunksPerSecond: corpus.chunks.length / durationSeconds,
        charactersPerSecond: corpus.totalCharacters / durationSeconds,
      },
      memory: {
        startingRssMiB: sampler.startingRssMiB,
        peakRssMiB,
      },
      quality,
    };
  } finally {
    sampler.stop();
    await provider.dispose();
  }
}

function failedResult(config: WorkerConfig, error: unknown): FailedBenchmarkRun {
  return {
    ok: false,
    run: config.run,
    provider: config.id,
    batchSize: config.batchSize,
    error: error instanceof Error ? error.message : String(error),
  };
}

async function main(): Promise<void> {
  const encoded = process.argv[2];
  if (!encoded) {
    throw new Error("Benchmark worker configuration is missing.");
  }
  const raw: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  const parsed = workerConfigSchema.parse(raw);
  const config: WorkerConfig = {
    id: parsed.id,
    model: parsed.model,
    ...(parsed.modelPath ? { modelPath: parsed.modelPath } : {}),
    modelCacheDir: parsed.modelCacheDir,
    workCacheDir: parsed.workCacheDir,
    dtype: parsed.dtype,
    maxLength: parsed.maxLength,
    documentPrefix: parsed.documentPrefix,
    queryPrefix: parsed.queryPrefix,
    batchingStrategy: parsed.batchingStrategy,
    ...(parsed.intraOpThreads ? { intraOpThreads: parsed.intraOpThreads } : {}),
    ...(parsed.interOpThreads ? { interOpThreads: parsed.interOpThreads } : {}),
    indexPath: parsed.indexPath,
    casesPath: parsed.casesPath,
    batchSize: parsed.batchSize,
    queryRuns: parsed.queryRuns,
    ...(parsed.limit ? { limit: parsed.limit } : {}),
    run: parsed.run,
  };
  let result: WorkerResult;
  try {
    result = await runBenchmark(config);
  } catch (error) {
    result = failedResult(config, error);
  }
  process.stdout.write(`${resultMarker}${JSON.stringify(result)}\n`);
}

await main();
