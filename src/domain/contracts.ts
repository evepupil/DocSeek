import type { DiscoveredDocument, EmbeddingConfig, IndexableChunk } from "./types.js";

export interface DocumentSource {
  readonly id: string;
  discover(): Promise<readonly DiscoveredDocument[]>;
}

export interface EmbeddingProvider {
  readonly fingerprint: string;
  embedDocuments(texts: readonly string[]): Promise<readonly Float32Array[]>;
  embedQuery(text: string): Promise<Float32Array>;
  dispose(): Promise<void>;
}

export interface DocumentParser {
  parse(document: DiscoveredDocument, maxChars: number): readonly IndexableChunk[];
}

export type EmbeddingProviderFactory = (config: EmbeddingConfig) => EmbeddingProvider;
