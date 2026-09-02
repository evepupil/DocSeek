export const CONFIG_VERSION = 1 as const;

export type EmbeddingDtype = "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4";
export type SourceKind = "markdown-directory";
export type DocumentMediaType = "text/markdown";

export interface EmbeddingConfig {
  readonly provider: "transformers";
  readonly model: string;
  readonly dtype: EmbeddingDtype;
  readonly queryPrefix: string;
  readonly documentPrefix: string;
  readonly batchSize: number;
}

export interface ChunkingConfig {
  readonly maxChars: number;
}

export interface SearchConfig {
  readonly vectorWeight: number;
  readonly keywordWeight: number;
  readonly semanticBestDistance: number;
  readonly semanticWeakDistance: number;
  readonly minimumConfidence: number;
  readonly candidatePool: number;
}

export interface SourceConfig {
  readonly id: string;
  readonly kind: SourceKind;
  readonly path: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly tags: readonly string[];
}

export interface DocSeekConfig {
  readonly version: typeof CONFIG_VERSION;
  readonly projectId: string;
  readonly embedding: EmbeddingConfig;
  readonly chunking: ChunkingConfig;
  readonly search: SearchConfig;
  readonly sources: readonly SourceConfig[];
}

export interface ProjectLocation {
  readonly rootDir: string;
  readonly usedGitFallback: boolean;
}

export interface ProjectContext {
  readonly rootDir: string;
  readonly docseekDir: string;
  readonly configPath: string;
  readonly indexPath: string;
  readonly config: DocSeekConfig;
}

export interface DiscoveredDocument {
  readonly sourceId: string;
  readonly documentKey: string;
  readonly locator: string;
  readonly displayPath: string;
  readonly absolutePath: string;
  readonly mediaType: DocumentMediaType;
  readonly content: string;
  readonly contentHash: string;
  readonly modifiedAtMs: number;
  readonly sizeBytes: number;
  readonly tags: readonly string[];
}

export interface IndexableChunk {
  readonly ordinal: number;
  readonly heading: readonly string[];
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
  readonly contentHash: string;
}

export interface DocumentSnapshot {
  readonly id: number;
  readonly sourceId: string;
  readonly documentKey: string;
  readonly contentHash: string;
}

export interface EmbeddedChunk extends IndexableChunk {
  readonly embedding: Float32Array;
  readonly headingTerms: string;
  readonly searchTerms: string;
}

export interface IndexChanges {
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
  readonly unchanged: number;
}

export interface IndexSummary extends IndexChanges {
  readonly documents: number;
  readonly chunks: number;
}

export interface StatusResult extends IndexChanges {
  readonly rootDir: string;
  readonly initialized: boolean;
  readonly model?: string;
  readonly documents: number;
  readonly chunks: number;
  readonly lastUpdatedAt?: string;
}

export interface SearchRequest {
  readonly query: string;
  readonly top: number;
  readonly path?: string;
  readonly includeSnippet: boolean;
  readonly includeExplanation?: boolean;
  readonly collectionIds?: readonly string[];
  readonly sourceIds?: readonly string[];
  readonly tags?: readonly string[];
}

export interface SearchExplanation {
  readonly vectorRank?: number;
  readonly keywordRank?: number;
  readonly vectorDistance?: number;
  readonly semanticStrength: number;
  readonly lexicalStrength: number;
  readonly fusionStrength: number;
  readonly confidence: number;
}

export interface SearchResult {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly heading: readonly string[];
  readonly score: number;
  readonly snippet?: string;
  readonly explanation?: SearchExplanation;
}

export interface SearchTimings {
  readonly embeddingMs: number;
  readonly vectorSearchMs: number;
  readonly keywordSearchMs: number;
  readonly fusionMs: number;
  readonly totalMs: number;
}

export interface SearchDiagnostics {
  readonly queryTerms: readonly string[];
  readonly vectorCandidates: number;
  readonly keywordCandidates: number;
  readonly timings: SearchTimings;
}

export interface SearchResponse {
  readonly results: readonly SearchResult[];
  readonly diagnostics: SearchDiagnostics;
}

export interface SearchCandidate {
  readonly chunkId: number;
  readonly sourceId: string;
  readonly documentKey: string;
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly heading: readonly string[];
  readonly content: string;
  readonly indexedTerms: readonly string[];
  readonly rank: number;
  readonly distance?: number;
}
