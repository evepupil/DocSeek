import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import { DocSeekError } from "../domain/errors.js";
import type { DiscoveredDocument, DocSeekConfig, IndexSummary } from "../domain/types.js";
import type { IndexStore } from "../storage/index-store.js";
import { calculateChanges } from "./change-set.js";
import { attachEmbeddings, prepareIndexBatch } from "./index-batch.js";

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
    const batch = prepareIndexBatch(changes.changedDocuments, config.chunking.maxChars);
    const embeddings =
      batch.embeddingTexts.length > 0
        ? await provider.embedDocuments(batch.embeddingTexts)
        : ([] satisfies readonly Float32Array[]);
    for (const entry of attachEmbeddings(batch, embeddings)) {
      store.replaceDocument(config.projectId, entry.document, entry.chunks);
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
