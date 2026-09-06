import type { BenchmarkChunk, QualityObservation, RankedLocation } from "./types.js";

export interface SearchLocation {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly heading: readonly string[];
  readonly score: number;
}

export interface RouteCoverage {
  readonly vectorRecallAt5: number;
  readonly keywordRecallAt5: number;
  readonly unionRecallAt5: number;
  readonly hybridRecallAt5: number;
  readonly unionHits: number;
  readonly retainedUnionHits: number;
  readonly unionRetentionRateAt5: number;
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

function hitAt5(observation: QualityObservation): boolean {
  return observation.expectedRank !== undefined && observation.expectedRank <= 5;
}

export function summarizeRouteCoverage(
  vector: readonly QualityObservation[],
  keyword: readonly QualityObservation[],
  hybrid: readonly QualityObservation[],
): RouteCoverage {
  if (vector.length !== keyword.length || vector.length !== hybrid.length || vector.length === 0) {
    throw new Error("Route coverage requires equally sized, non-empty observations.");
  }

  let vectorHits = 0;
  let keywordHits = 0;
  let unionHits = 0;
  let hybridHits = 0;
  let retainedUnionHits = 0;
  for (let index = 0; index < vector.length; index += 1) {
    const vectorEntry = vector[index];
    const keywordEntry = keyword[index];
    const hybridEntry = hybrid[index];
    if (!vectorEntry || !keywordEntry || !hybridEntry) {
      throw new Error(`Route coverage observation ${index} is missing.`);
    }
    if (vectorEntry.caseId !== keywordEntry.caseId || vectorEntry.caseId !== hybridEntry.caseId) {
      throw new Error(`Route coverage cases are misaligned at ${index}.`);
    }

    const vectorHit = hitAt5(vectorEntry);
    const keywordHit = hitAt5(keywordEntry);
    const hybridHit = hitAt5(hybridEntry);
    const unionHit = vectorHit || keywordHit;
    vectorHits += Number(vectorHit);
    keywordHits += Number(keywordHit);
    unionHits += Number(unionHit);
    hybridHits += Number(hybridHit);
    retainedUnionHits += Number(unionHit && hybridHit);
  }

  return {
    vectorRecallAt5: vectorHits / vector.length,
    keywordRecallAt5: keywordHits / vector.length,
    unionRecallAt5: unionHits / vector.length,
    hybridRecallAt5: hybridHits / vector.length,
    unionHits,
    retainedUnionHits,
    unionRetentionRateAt5: unionHits > 0 ? retainedUnionHits / unionHits : 0,
  };
}
