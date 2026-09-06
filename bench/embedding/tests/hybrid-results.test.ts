import { describe, expect, it } from "vitest";

import { summarizeRouteCoverage, toRankedLocations } from "../src/hybrid-results.js";
import type { BenchmarkChunk, QualityObservation } from "../src/types.js";

const chunk: BenchmarkChunk = {
  id: 42,
  path: "docs/target.md",
  heading: ["Target"],
  startLine: 10,
  endLine: 20,
  contentHash: "hash",
  content: "body",
  text: "Target\n\nbody",
};

describe("hybrid benchmark results", () => {
  it("maps production search locations back to stable chunk ids", () => {
    expect(
      toRankedLocations(
        [
          {
            path: chunk.path,
            heading: chunk.heading,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            score: 0.8,
          },
        ],
        [chunk],
      ),
    ).toEqual([
      {
        chunkId: 42,
        path: chunk.path,
        heading: ["Target"],
        startLine: 10,
        endLine: 20,
        score: 0.8,
      },
    ]);
  });

  it("rejects locations from another corpus", () => {
    expect(() =>
      toRankedLocations(
        [{ path: "docs/missing.md", heading: [], startLine: 1, endLine: 2, score: 0.1 }],
        [chunk],
      ),
    ).toThrow("absent from the benchmark corpus");
  });

  it("measures how many route hits survive fusion", () => {
    const observation = (caseId: string, expectedRank?: number): QualityObservation => ({
      caseId,
      intentId: caseId,
      kind: "single-term",
      terms: [caseId],
      ...(expectedRank !== undefined ? { expectedRank } : {}),
      stable: true,
      literalCandidateCount: 0,
      literalExpectedMatch: false,
      top: [],
    });

    expect(
      summarizeRouteCoverage(
        [observation("vector", 2), observation("keyword")],
        [observation("vector"), observation("keyword", 1)],
        [observation("vector", 3), observation("keyword")],
      ),
    ).toEqual({
      vectorRecallAt5: 0.5,
      keywordRecallAt5: 0.5,
      unionRecallAt5: 1,
      hybridRecallAt5: 0.5,
      unionHits: 2,
      retainedUnionHits: 1,
      unionRetentionRateAt5: 0.5,
    });
  });
});
