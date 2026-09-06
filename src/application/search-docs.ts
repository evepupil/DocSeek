import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import { DocSeekError } from "../domain/errors.js";
import type { SearchRequest, SearchResponse, SearchResult } from "../domain/types.js";
import { loadProjectContext } from "../config/config-file.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { locateInitializedProject } from "../project/find-root.js";
import { classifyQueryMode } from "../search/query-mode.js";
import { IndexStore } from "../storage/index-store.js";
import { executeSearch } from "./execute-search.js";

function emptySearchResponse(request: SearchRequest): SearchResponse {
  return {
    results: [],
    diagnostics: {
      queryMode: classifyQueryMode(request.query, request.queryParts),
      queryTerms: [],
      vectorCandidates: 0,
      keywordCandidates: 0,
      timings: {
        embeddingMs: 0,
        vectorSearchMs: 0,
        keywordSearchMs: 0,
        fusionMs: 0,
        totalMs: 0,
      },
    },
  };
}

export async function searchDocsDetailed(
  startDir: string,
  request: SearchRequest,
  createProvider: EmbeddingProviderFactory = createEmbeddingProvider,
): Promise<SearchResponse> {
  if (request.query.trim().length === 0) {
    throw new DocSeekError("QUERY_EMPTY", "Search query cannot be empty.");
  }
  if (
    request.top !== undefined &&
    (!Number.isSafeInteger(request.top) || request.top < 1 || request.top > 100)
  ) {
    throw new DocSeekError("TOP_INVALID", "Search result count must be an integer from 1 to 100.");
  }

  const rootDir = await locateInitializedProject(startDir);
  const context = await loadProjectContext(rootDir);
  const store = new IndexStore(context.indexPath);
  const counts = store.counts(context.config.projectId);
  if (counts.chunks === 0) {
    store.close();
    return emptySearchResponse(request);
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

  try {
    return await executeSearch({
      store,
      provider,
      collectionId: context.config.projectId,
      config: context.config.search,
      request,
    });
  } finally {
    try {
      store.close();
    } finally {
      await provider.dispose();
    }
  }
}

export async function searchDocs(
  startDir: string,
  request: SearchRequest,
  createProvider: EmbeddingProviderFactory = createEmbeddingProvider,
): Promise<readonly SearchResult[]> {
  return (await searchDocsDetailed(startDir, request, createProvider)).results;
}
