import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import { DocSeekError } from "../domain/errors.js";
import type { SearchRequest, SearchResult } from "../domain/types.js";
import { loadProjectContext } from "../config/config-file.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { locateInitializedProject } from "../project/find-root.js";
import { fuseCandidates } from "../search/fusion.js";
import { buildFtsQuery } from "../search/terms.js";
import { IndexStore } from "../storage/index-store.js";

export async function searchDocs(
  startDir: string,
  request: SearchRequest,
  createProvider: EmbeddingProviderFactory = createEmbeddingProvider,
): Promise<readonly SearchResult[]> {
  if (request.query.trim().length === 0) {
    throw new DocSeekError("QUERY_EMPTY", "Search query cannot be empty.");
  }
  if (!Number.isSafeInteger(request.top) || request.top < 1 || request.top > 100) {
    throw new DocSeekError("TOP_INVALID", "Search result count must be an integer from 1 to 100.");
  }

  const rootDir = await locateInitializedProject(startDir);
  const context = await loadProjectContext(rootDir);
  const store = new IndexStore(context.indexPath);
  const counts = store.counts(context.config.projectId);
  if (counts.chunks === 0) {
    store.close();
    return [];
  }

  const provider = createProvider(context.config.embedding);
  const currentFingerprint = store.getMetadata("embedding_fingerprint");
  if (currentFingerprint !== provider.fingerprint) {
    store.close();
    await provider.dispose();
    throw new DocSeekError(
      "EMBEDDING_CONFIG_CHANGED",
      "Embedding configuration changed. Run `docseek init` to rebuild the index.",
    );
  }

  const scopedRequest: SearchRequest = {
    ...request,
    collectionIds: request.collectionIds ?? [context.config.projectId],
  };
  const candidateLimit = Math.min(500, Math.max(50, request.top * 10));

  try {
    const queryVector = await provider.embedQuery(request.query);
    const vectorCandidates = store.vectorCandidates(queryVector, scopedRequest, candidateLimit);
    const ftsQuery = buildFtsQuery(request.query);
    const keywordCandidates = ftsQuery
      ? store.keywordCandidates(ftsQuery, scopedRequest, candidateLimit)
      : [];
    return fuseCandidates(vectorCandidates, keywordCandidates, request.top, request.includeSnippet);
  } finally {
    try {
      store.close();
    } finally {
      await provider.dispose();
    }
  }
}
