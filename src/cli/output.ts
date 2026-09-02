import type { SearchDiagnostics, SearchResult, StatusResult } from "../domain/types.js";

function formatTimings(diagnostics: SearchDiagnostics): string {
  const { timings } = diagnostics;
  return `Timing: embedding ${timings.embeddingMs.toFixed(1)} ms, vector ${timings.vectorSearchMs.toFixed(1)} ms, keyword ${timings.keywordSearchMs.toFixed(1)} ms, fusion ${timings.fusionMs.toFixed(1)} ms, total ${timings.totalMs.toFixed(1)} ms`;
}

export function formatSearchText(
  results: readonly SearchResult[],
  diagnostics?: SearchDiagnostics,
): string {
  const body =
    results.length === 0
      ? "No matching documentation found."
      : results
          .map((result) => {
            const lines = [
              `${result.score.toFixed(2)}  ${result.path}:${result.startLine}-${result.endLine}`,
            ];
            if (result.heading.length > 0) {
              lines.push(`      ${result.heading.join(" > ")}`);
            }
            if (result.snippet) {
              lines.push(`      ${result.snippet}`);
            }
            if (result.explanation) {
              const ranks = [
                result.explanation.vectorRank
                  ? `vector #${result.explanation.vectorRank}`
                  : undefined,
                result.explanation.keywordRank
                  ? `keyword #${result.explanation.keywordRank}`
                  : undefined,
              ].filter((value) => value !== undefined);
              lines.push(
                `      signals: semantic ${result.explanation.semanticStrength.toFixed(2)}, lexical ${result.explanation.lexicalStrength.toFixed(2)}, confidence ${result.explanation.confidence.toFixed(2)}${ranks.length > 0 ? `, ${ranks.join(", ")}` : ""}`,
              );
            }
            return lines.join("\n");
          })
          .join("\n\n");
  return `${body}${diagnostics ? `\n\n${formatTimings(diagnostics)}` : ""}\n`;
}

export function formatSearchJson(
  results: readonly SearchResult[],
  diagnostics?: SearchDiagnostics,
): string {
  return `${JSON.stringify(
    {
      results: results.map((result) => ({
        path: result.path,
        start_line: result.startLine,
        end_line: result.endLine,
        heading: result.heading,
        score: result.score,
        ...(result.snippet ? { snippet: result.snippet } : {}),
        ...(result.explanation
          ? {
              explanation: {
                vector_rank: result.explanation.vectorRank,
                keyword_rank: result.explanation.keywordRank,
                vector_distance: result.explanation.vectorDistance,
                semantic_strength: result.explanation.semanticStrength,
                lexical_strength: result.explanation.lexicalStrength,
                fusion_strength: result.explanation.fusionStrength,
                confidence: result.explanation.confidence,
              },
            }
          : {}),
      })),
      ...(diagnostics
        ? {
            diagnostics: {
              query_terms: diagnostics.queryTerms,
              vector_candidates: diagnostics.vectorCandidates,
              keyword_candidates: diagnostics.keywordCandidates,
              timings_ms: {
                embedding: diagnostics.timings.embeddingMs,
                vector_search: diagnostics.timings.vectorSearchMs,
                keyword_search: diagnostics.timings.keywordSearchMs,
                fusion: diagnostics.timings.fusionMs,
                total: diagnostics.timings.totalMs,
              },
            },
          }
        : {}),
    },
    undefined,
    2,
  )}\n`;
}

export function formatStatusText(status: StatusResult): string {
  if (!status.initialized) {
    return `DocSeek is not initialized in ${status.rootDir}.\n`;
  }

  return [
    `Project: ${status.rootDir}`,
    `Model: ${status.model ?? "unknown"}`,
    `Indexed: ${status.documents} documents, ${status.chunks} chunks`,
    `Pending: ${status.added} added, ${status.modified} modified, ${status.deleted} deleted`,
    `Updated: ${status.lastUpdatedAt ?? "never"}`,
    "",
  ].join("\n");
}
