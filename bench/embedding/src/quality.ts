import { readFile } from "node:fs/promises";

import { z } from "zod";

import type {
  BenchmarkChunk,
  ExpectedLocation,
  QualityObservation,
  QualitySuite,
  RankedLocation,
  SemanticQualityResult,
} from "./types.js";
import { cosineSimilarity } from "./vectors.js";

const expectedLocationSchema = z.object({
  path: z.string().min(1),
  heading: z.string().min(1).optional(),
});

const qualitySuiteSchema = z.object({
  version: z.literal(1),
  cases: z
    .array(
      z.object({
        id: z.string().min(1),
        query: z.string().min(1),
        expected: z.array(expectedLocationSchema).min(1),
      }),
    )
    .min(1),
});

export async function loadQualitySuite(filePath: string): Promise<QualitySuite> {
  const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
  const parsed = qualitySuiteSchema.parse(value);
  return {
    version: parsed.version,
    cases: parsed.cases.map((testCase) => ({
      id: testCase.id,
      query: testCase.query,
      expected: testCase.expected.map((expected) => ({
        path: expected.path,
        ...(expected.heading ? { heading: expected.heading } : {}),
      })),
    })),
  };
}

function matches(location: RankedLocation, expected: ExpectedLocation): boolean {
  return (
    location.path === expected.path &&
    (!expected.heading || location.heading.some((part) => part.includes(expected.heading ?? "")))
  );
}

export function rankLocations(
  chunks: readonly BenchmarkChunk[],
  documentVectors: readonly Float32Array[],
  queryVector: Float32Array,
): readonly RankedLocation[] {
  if (chunks.length !== documentVectors.length) {
    throw new Error("Corpus and document vector counts do not match.");
  }
  return chunks
    .map((chunk, index) => {
      const vector = documentVectors[index];
      if (!vector) {
        throw new Error(`Document vector ${index} is missing.`);
      }
      return {
        chunkId: chunk.id,
        path: chunk.path,
        heading: chunk.heading,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        score: cosineSimilarity(queryVector, vector),
      } satisfies RankedLocation;
    })
    .sort((left, right) => right.score - left.score || left.chunkId - right.chunkId);
}

export function observeQuality(
  caseId: string,
  expected: readonly ExpectedLocation[],
  rankings: readonly (readonly RankedLocation[])[],
): QualityObservation {
  const first = rankings[0] ?? [];
  const expectedIndex = first.findIndex((location) =>
    expected.some((candidate) => matches(location, candidate)),
  );
  const stableKey = (locations: readonly RankedLocation[]): string =>
    locations
      .slice(0, 5)
      .map((location) => location.chunkId)
      .join(",");
  const stable = rankings.every((ranking) => stableKey(ranking) === stableKey(first));
  return {
    caseId,
    ...(expectedIndex >= 0 ? { expectedRank: expectedIndex + 1 } : {}),
    stable,
    top: first.slice(0, 5).map((location) => ({
      ...location,
      score: Number(location.score.toFixed(6)),
    })),
  };
}

export function summarizeQuality(
  observations: readonly QualityObservation[],
): SemanticQualityResult {
  if (observations.length === 0) {
    throw new Error("Quality evaluation requires at least one observation.");
  }
  let recallAt5 = 0;
  let top1 = 0;
  let reciprocalRanks = 0;
  let stable = 0;
  for (const observation of observations) {
    const rank = observation.expectedRank;
    if (rank !== undefined && rank <= 5) {
      recallAt5 += 1;
    }
    if (rank === 1) {
      top1 += 1;
    }
    if (rank !== undefined) {
      reciprocalRanks += 1 / rank;
    }
    if (observation.stable) {
      stable += 1;
    }
  }
  return {
    metrics: {
      recallAt5: recallAt5 / observations.length,
      top1: top1 / observations.length,
      meanReciprocalRank: reciprocalRanks / observations.length,
      stability: stable / observations.length,
    },
    observations,
  };
}
