import { DocSeekError } from "../domain/errors.js";
import type { DiscoveredDocument, EmbeddedChunk, IndexableChunk } from "../domain/types.js";
import { embeddingText } from "../markdown/chunker.js";
import { parseDocument } from "../markdown/parser.js";
import { buildFtsText } from "../search/terms.js";

export interface PreparedIndexDocument {
  readonly document: DiscoveredDocument;
  readonly chunks: readonly IndexableChunk[];
}

export interface EmbeddedIndexDocument {
  readonly document: DiscoveredDocument;
  readonly chunks: readonly EmbeddedChunk[];
}

export interface PreparedIndexBatch {
  readonly documents: readonly PreparedIndexDocument[];
  readonly embeddingTexts: readonly string[];
}

export function prepareIndexBatch(
  documents: readonly DiscoveredDocument[],
  maxChars: number,
): PreparedIndexBatch {
  const prepared = documents.map((document) => ({
    document,
    chunks: parseDocument(document, maxChars),
  }));
  return {
    documents: prepared,
    embeddingTexts: prepared.flatMap((entry) => entry.chunks.map(embeddingText)),
  };
}

export function attachEmbeddings(
  batch: PreparedIndexBatch,
  embeddings: readonly Float32Array[],
): readonly EmbeddedIndexDocument[] {
  if (embeddings.length !== batch.embeddingTexts.length) {
    throw new DocSeekError(
      "EMBEDDING_COUNT_MISMATCH",
      `Expected ${batch.embeddingTexts.length} vectors for the changed documents, received ${embeddings.length}.`,
    );
  }

  let offset = 0;
  return batch.documents.map((entry) => {
    const chunks = entry.chunks.map((chunk) => {
      const embedding = embeddings[offset];
      offset += 1;
      if (!embedding) {
        throw new DocSeekError(
          "EMBEDDING_MISSING",
          `Missing vector ${chunk.ordinal + 1} for ${entry.document.displayPath}.`,
        );
      }
      return {
        ...chunk,
        embedding,
        headingTerms: buildFtsText(chunk.heading.join(" ")),
        searchTerms: buildFtsText(chunk.content),
      };
    });
    return { document: entry.document, chunks };
  });
}
