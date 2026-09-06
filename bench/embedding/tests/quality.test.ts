import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  literalBaseline,
  loadQualitySuite,
  observeQuality,
  parseQualitySuite,
  rankLocations,
  summarizeQuality,
} from "../src/quality.js";
import type { BenchmarkChunk, QualityCase } from "../src/types.js";

const chunks: readonly BenchmarkChunk[] = [
  {
    id: 1,
    path: "docs/a.md",
    heading: ["A", "Target"],
    startLine: 1,
    endLine: 3,
    contentHash: "a",
    content: "unrelated target wording",
    text: "refund repeated heading\n\nunrelated target wording",
  },
  {
    id: 2,
    path: "docs/b.md",
    heading: ["B"],
    startLine: 5,
    endLine: 8,
    contentHash: "b",
    content: "refund appears only in this distractor",
    text: "refund appears only in this distractor",
  },
];

const sparseCase: QualityCase = {
  id: "intent/single",
  intentId: "intent",
  kind: "single-term",
  terms: ["refund"],
  query: "refund",
  expected: [{ path: "docs/a.md", heading: "Target" }],
};

describe("semantic quality", () => {
  it("ranks by cosine similarity and matches path plus heading", () => {
    const ranked = rankLocations(
      chunks,
      [new Float32Array([1, 0]), new Float32Array([0, 1])],
      new Float32Array([1, 0]),
    );
    const observation = observeQuality(sparseCase, [ranked, ranked], chunks);
    expect(observation.expectedRank).toBe(1);
    expect(observation.stable).toBe(true);
    const summary = summarizeQuality([observation]);
    expect(summary.metrics).toEqual({
      recallAt5: 1,
      top1: 1,
      meanReciprocalRank: 1,
      stability: 1,
    });
    expect(summary.sparse).toMatchObject({
      intents: 1,
      probes: 1,
      semanticRescueEligible: 1,
      semanticRescueHitsAt5: 1,
      semanticRescueRateAt5: 1,
    });
    expect(summary.sparse?.byKind).toHaveLength(1);
  });

  it("detects changed top-five ordering", () => {
    const first = rankLocations(
      chunks,
      [new Float32Array([1, 0]), new Float32Array([0, 1])],
      new Float32Array([1, 0]),
    );
    const second = [...first].reverse();
    expect(observeQuality(sparseCase, [first, second], chunks).stable).toBe(false);
  });

  it("counts rg-style literal candidates independently of vector ranking", () => {
    expect(literalBaseline(sparseCase, chunks)).toEqual({
      candidateCount: 1,
      expectedMatch: false,
    });
  });

  it("parses grouped sparse probes and keeps legacy suites compatible", () => {
    const sparse = parseQualitySuite({
      version: 2,
      intents: [
        {
          id: "refund-policy",
          expected: [{ path: "docs/a.md", heading: "Target" }],
          probes: [
            { id: "single", kind: "single-term", terms: ["赔付"] },
            { id: "bundle", kind: "term-bundle", terms: ["SLA", "退款"] },
            {
              id: "alternate",
              kind: "alternate-vocabulary",
              terms: ["breach", "compensation"],
            },
          ],
        },
      ],
    });
    expect(sparse.cases.map((testCase) => testCase.query)).toEqual([
      "赔付",
      "SLA 退款",
      "breach compensation",
    ]);
    expect(sparse.cases.every((testCase) => testCase.intentId === "refund-policy")).toBe(true);

    const legacy = parseQualitySuite({
      version: 1,
      cases: [{ id: "old", query: "old query", expected: [{ path: "docs/a.md" }] }],
    });
    expect(legacy.cases[0]).toMatchObject({
      id: "old",
      intentId: "old",
      kind: "legacy",
      terms: ["old query"],
    });
  });

  it("keeps the InferForge sparse suite balanced", async () => {
    const suite = await loadQualitySuite(
      path.resolve(import.meta.dirname, "../cases/inferforge.json"),
    );
    const counts = new Map<string, number>();
    for (const testCase of suite.cases) {
      counts.set(testCase.kind, (counts.get(testCase.kind) ?? 0) + 1);
    }

    expect(suite.version).toBe(2);
    expect(new Set(suite.cases.map((testCase) => testCase.intentId)).size).toBe(30);
    expect(suite.cases).toHaveLength(90);
    expect(Object.fromEntries(counts)).toEqual({
      "single-term": 30,
      "term-bundle": 30,
      "alternate-vocabulary": 30,
    });

    const legacy = await loadQualitySuite(
      path.resolve(import.meta.dirname, "../cases/inferforge-paraphrase.json"),
    );
    expect(legacy.version).toBe(1);
    expect(legacy.cases).toHaveLength(18);
  });
});
