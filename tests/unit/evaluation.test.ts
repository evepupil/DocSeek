import { describe, expect, it } from "vitest";

import type { SearchResult, SearchTimings } from "../../src/domain/types.js";
import {
  matchingRank,
  percentile,
  stableResults,
  summarizeQuality,
  type QualityObservation,
} from "../../src/evaluation/metrics.js";
import type { QualityCase } from "../../src/evaluation/schema.js";

const timings: SearchTimings = {
  embeddingMs: 1,
  vectorSearchMs: 2,
  keywordSearchMs: 3,
  fusionMs: 4,
  totalMs: 10,
};

function result(path: string, score = 0.8): SearchResult {
  return {
    path,
    startLine: 10,
    endLine: 20,
    heading: ["Architecture", "Scheduler"],
    score,
  };
}

function testCase(id: string, category: QualityCase["category"], expected = true): QualityCase {
  return {
    id,
    category,
    query: id,
    ...(expected ? { expected: [{ path: "expected.md", heading: "Scheduler" }] } : {}),
  };
}

describe("quality evaluation metrics", () => {
  it("matches accepted paths and headings and keeps stable result fields", () => {
    const results = [result("other.md"), result("expected.md")];

    expect(matchingRank(results, [{ path: "expected.md", heading: "Scheduler" }])).toBe(2);
    expect(stableResults(results)).toBe(stableResults(results));
  });

  it("summarizes positive, exact, negative, and deterministic cases", () => {
    const observations: QualityObservation[] = [
      {
        testCase: testCase("semantic", "semantic"),
        results: [result("expected.md")],
        deterministic: true,
        timings,
      },
      {
        testCase: testCase("exact", "exact"),
        results: [result("other.md"), result("expected.md")],
        deterministic: true,
        timings,
      },
      {
        testCase: testCase("negative", "negative", false),
        results: [],
        deterministic: true,
        timings,
      },
    ];

    const summary = summarizeQuality(observations);
    expect(summary.metrics).toEqual({
      positiveRecallAt5: 1,
      positiveTop1: 0.5,
      meanReciprocalRank: 0.75,
      exactTop1: 0,
      negativeRejection: 1,
      determinism: 1,
    });
    expect(summary.failures).toContain("exact: exact term expected at rank 1, got 2");
  });

  it("calculates nearest-rank percentiles", () => {
    expect(percentile([40, 10, 30, 20], 0.5)).toBe(20);
    expect(percentile([40, 10, 30, 20], 0.95)).toBe(40);
    expect(percentile([], 0.5)).toBe(0);
  });
});
