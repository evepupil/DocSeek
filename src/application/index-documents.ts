import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import { DocSeekError } from "../domain/errors.js";
import type {
  DiscoveredDocument,
  DocSeekConfig,
  EmbeddedChunk,
  IndexSummary,
} from "../domain/types.js";
import { embeddingText } from "../markdown/chunker.js";
import { parseDocument } from "../markdown/parser.js";
import { buildFtsText } from "../search/terms.js";
import type { IndexStore } from "../storage/index-store.js";
import { calculateChanges } from "./change-set.js";

interface IndexDocumentsOptions {
  readonly config: DocSeekConfig;
  readonly rootDir: string;
  readonly store: IndexStore;
  readonly documents: readonly DiscoveredDocument[];
  readonly createEmbeddingProvider: EmbeddingProviderFactory;
}

export async function indexDocuments(options: IndexDocumentsOptions): Promise<IndexSummary> {
  const { config, rootDir, store, documents, createEmbeddingProvider } = options;
  const provider = createEmbeddingProvider(config.embedding);
  try {
    const currentFingerprint = store.getMetadata("embedding_fingerprint");
    if (currentFingerprint && currentFingerprint !== provider.fingerprint) {
      throw new DocSeekError(
        "EMBEDDING_CONFIG_CHANGED",
        "Embedding configuration changed. Run `docseek init` to rebuild the index.",
      );
    }
    store.setMetadata("embedding_fingerprint", provider.fingerprint);
    store.syncCollection(config, rootDir);

    const changes = calculateChanges(documents, store.documentSnapshots(config.projectId));
    for (const document of changes.changedDocuments) {
      const chunks = parseDocument(document, config.chunking.maxChars);
      const embeddings = await provider.embedDocuments(chunks.map(embeddingText));
      if (embeddings.length !== chunks.length) {
        throw new DocSeekError(
          "EMBEDDING_COUNT_MISMATCH",
          `Expected ${chunks.length} vectors for ${document.displayPath}, received ${embeddings.length}.`,
        );
      }

      const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new DocSeekError(
            "EMBEDDING_MISSING",
            `Missing vector ${index + 1} for ${document.displayPath}.`,
          );
        }
        return {
          ...chunk,
          embedding,
          headingTerms: buildFtsText(chunk.heading.join(" ")),
          searchTerms: buildFtsText(chunk.content),
        };
      });
      store.replaceDocument(config.projectId, document, embeddedChunks);
    }

    for (const document of changes.deletedDocuments) {
      store.deleteDocument(config.projectId, document.sourceId, document.documentKey);
    }
    store.deleteSourcesExcept(
      config.projectId,
      config.sources.map((source) => source.id),
    );

    store.setMetadata("last_updated_at", new Date().toISOString());
    const counts = store.counts(config.projectId);
    return {
      added: changes.added,
      modified: changes.modified,
      deleted: changes.deleted,
      unchanged: changes.unchanged,
      documents: counts.documents,
      chunks: counts.chunks,
    };
  } finally {
    await provider.dispose();
  }
}
