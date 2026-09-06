import { performance } from "node:perf_hooks";

import type { EmbeddingProvider } from "../domain/contracts.js";
import type { SearchConfig, SearchRequest, SearchResponse } from "../domain/types.js";
import { fuseCandidates } from "../search/fusion.js";
import { classifyQueryMode, hasSufficientTermEvidence } from "../search/query-mode.js";
import { buildFtsQuery, tokenizeForSearch } from "../search/terms.js";
import type { IndexStore } from "../storage/index-store.js";

interface ExecuteSearchOptions {
  readonly store: IndexStore;
  readonly provider: EmbeddingProvider;
  readonly collectionId: string;
  readonly config: SearchConfig;
  readonly request: SearchRequest;
}

function elapsed(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(3));
}

export async function executeSearch(options: ExecuteSearchOptions): Promise<SearchResponse> {
  const { store, provider, collectionId, config, request } = options;
  const totalStartedAt = performance.now();
  const scopedRequest: SearchRequest = {
    ...request,
    collectionIds: request.collectionIds ?? [collectionId],
  };
  const candidateLimit = Math.min(500, Math.max(config.candidatePool, (request.top ?? 0) * 10));
  const queryMode = classifyQueryMode(request.query, request.queryParts);
  const queryTerms = tokenizeForSearch(request.query);

  const embeddingStartedAt = performance.now();
  const queryVector = await provider.embedQuery(request.query);
  const embeddingMs = elapsed(embeddingStartedAt);

  const vectorStartedAt = performance.now();
  const vectorCandidates = store.vectorCandidates(queryVector, scopedRequest, candidateLimit);
  const vectorSearchMs = elapsed(vectorStartedAt);

  const keywordStartedAt = performance.now();
  const ftsQuery = buildFtsQuery(request.query);
  const keywordCandidates = ftsQuery
    ? store.keywordCandidates(ftsQuery, scopedRequest, candidateLimit)
    : [];
  const allowTermRelaxation =
    queryMode === "terms" &&
    hasSufficientTermEvidence(request.queryParts, keywordCandidates.slice(0, config.candidatePool));
  const keywordSearchMs = elapsed(keywordStartedAt);

  const fusionStartedAt = performance.now();
  const results = fuseCandidates(vectorCandidates, keywordCandidates, {
    includeSnippet: request.includeSnippet,
    includeExplanation: request.includeExplanation ?? false,
    allowTermRelaxation,
    queryMode,
    queryTerms,
    config,
    ...(request.top !== undefined ? { top: request.top } : {}),
  });
  const fusionMs = elapsed(fusionStartedAt);

  return {
    results,
    diagnostics: {
      queryMode,
      queryTerms,
      vectorCandidates: vectorCandidates.length,
      keywordCandidates: keywordCandidates.length,
      timings: {
        embeddingMs,
        vectorSearchMs,
        keywordSearchMs,
        fusionMs,
        totalMs: elapsed(totalStartedAt),
      },
    },
  };
}
