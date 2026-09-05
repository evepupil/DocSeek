export type ProviderId =
  "transformers" | "transformers-core" | "direct-ort" | "static-ort" | "fastembed" | "llama-cpp";
export type BenchmarkDtype = "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4";
export type BatchingStrategy = "sequential" | "length-bucketed";
export type PoolingStrategy = "mean" | "cls";

export interface BenchmarkChunk {
  readonly id: number;
  readonly path: string;
  readonly heading: readonly string[];
  readonly startLine: number;
  readonly endLine: number;
  readonly contentHash: string;
  readonly text: string;
}

export interface CorpusSnapshot {
  readonly chunks: readonly BenchmarkChunk[];
  readonly totalChunksInIndex: number;
  readonly documentCount: number;
  readonly totalCharacters: number;
  readonly fingerprint: string;
}

export interface ExpectedLocation {
  readonly path: string;
  readonly heading?: string;
}

export interface QualityCase {
  readonly id: string;
  readonly query: string;
  readonly expected: readonly ExpectedLocation[];
}

export interface QualitySuite {
  readonly version: 1;
  readonly cases: readonly QualityCase[];
}

export interface RankedLocation {
  readonly chunkId: number;
  readonly path: string;
  readonly heading: readonly string[];
  readonly startLine: number;
  readonly endLine: number;
  readonly score: number;
}

export interface QualityObservation {
  readonly caseId: string;
  readonly expectedRank?: number;
  readonly stable: boolean;
  readonly top: readonly RankedLocation[];
}

export interface SemanticQualityMetrics {
  readonly recallAt5: number;
  readonly top1: number;
  readonly meanReciprocalRank: number;
  readonly stability: number;
}

export interface SemanticQualityResult {
  readonly metrics: SemanticQualityMetrics;
  readonly observations: readonly QualityObservation[];
}

export interface ProviderOptions {
  readonly id: ProviderId;
  readonly model: string;
  readonly modelPath?: string;
  readonly modelCacheDir: string;
  readonly workCacheDir: string;
  readonly dtype: BenchmarkDtype;
  readonly maxLength: number;
  readonly documentPrefix: string;
  readonly queryPrefix: string;
  readonly pooling: PoolingStrategy;
  readonly batchingStrategy: BatchingStrategy;
  readonly intraOpThreads?: number;
  readonly interOpThreads?: number;
}

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly tool: string;
  readonly toolVersion: string;
  readonly runtime?: string;
  readonly runtimeVersion?: string;
  readonly model: string;
  readonly modelFormat: string;
  readonly dtype: string;
  readonly device: string;
  readonly pooling?: PoolingStrategy;
  readonly inputStrategy?: string;
  readonly batchingStrategy: BatchingStrategy;
  readonly maxLength: number;
  readonly intraOpThreads?: number;
  readonly interOpThreads?: number;
}

export interface EmbeddingBatchResult {
  readonly vectors: readonly Float32Array[];
  readonly batchCalls: number;
}

export interface EmbeddingProvider {
  readonly descriptor: ProviderDescriptor;
  cachePresent(): Promise<boolean>;
  load(batchSize: number): Promise<void>;
  embedDocuments(
    texts: readonly string[],
    batchSize: number,
    onBatch: () => void,
  ): Promise<EmbeddingBatchResult>;
  embedQuery(text: string): Promise<Float32Array>;
  dispose(): Promise<void>;
}

export interface WorkerConfig extends ProviderOptions {
  readonly indexPath: string;
  readonly casesPath: string;
  readonly batchSize: number;
  readonly queryRuns: number;
  readonly limit?: number;
  readonly run: number;
}

export interface BenchmarkRun {
  readonly ok: true;
  readonly run: number;
  readonly environment: {
    readonly platform: string;
    readonly architecture: string;
    readonly node: string;
    readonly cpu: string;
    readonly logicalProcessors: number;
    readonly totalMemoryMiB: number;
  };
  readonly provider: ProviderDescriptor;
  readonly batchSize: number;
  readonly cacheWarmBefore: boolean;
  readonly corpus: Omit<CorpusSnapshot, "chunks">;
  readonly dimension: number;
  readonly batchCalls: number;
  readonly timings: {
    readonly corpusLoadMs: number;
    readonly providerLoadMs: number;
    readonly documentEmbeddingMs: number;
    readonly sqliteWriteMs: number;
    readonly queryEmbeddingP50Ms: number;
    readonly queryEmbeddingP95Ms: number;
    readonly totalMs: number;
  };
  readonly throughput: {
    readonly chunksPerSecond: number;
    readonly charactersPerSecond: number;
  };
  readonly memory: {
    readonly startingRssMiB: number;
    readonly peakRssMiB: number;
  };
  readonly quality: SemanticQualityResult;
}

export interface FailedBenchmarkRun {
  readonly ok: false;
  readonly run: number;
  readonly provider: ProviderId;
  readonly batchSize: number;
  readonly error: string;
}

export type WorkerResult = BenchmarkRun | FailedBenchmarkRun;
