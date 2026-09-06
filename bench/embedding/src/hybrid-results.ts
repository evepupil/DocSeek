import type { BenchmarkChunk, RankedLocation } from "./types.js";

export interface SearchLocation {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly heading: readonly string[];
  readonly score: number;
}

function locationKey(path: string, startLine: number, endLine: number): string {
  return `${path}\0${startLine}\0${endLine}`;
}

export function toRankedLocations(
  results: readonly SearchLocation[],
  chunks: readonly BenchmarkChunk[],
): readonly RankedLocation[] {
  const chunkIds = new Map(
    chunks.map((chunk) => [locationKey(chunk.path, chunk.startLine, chunk.endLine), chunk.id]),
  );
  return results.map((result) => {
    const chunkId = chunkIds.get(locationKey(result.path, result.startLine, result.endLine));
    if (chunkId === undefined) {
      throw new Error(
        `Search result ${result.path}:${result.startLine}-${result.endLine} is absent from the benchmark corpus.`,
      );
    }
    return { chunkId, ...result };
  });
}
