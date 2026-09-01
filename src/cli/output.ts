import type { SearchResult, StatusResult } from "../domain/types.js";

export function formatSearchText(results: readonly SearchResult[]): string {
  if (results.length === 0) {
    return "No matching documentation found.\n";
  }

  return `${results
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
      return lines.join("\n");
    })
    .join("\n\n")}\n`;
}

export function formatSearchJson(results: readonly SearchResult[]): string {
  return `${JSON.stringify(
    {
      results: results.map((result) => ({
        path: result.path,
        start_line: result.startLine,
        end_line: result.endLine,
        heading: result.heading,
        score: result.score,
        ...(result.snippet ? { snippet: result.snippet } : {}),
      })),
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
