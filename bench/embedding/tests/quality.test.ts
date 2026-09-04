import { describe, expect, it } from "vitest";

import { observeQuality, rankLocations, summarizeQuality } from "../src/quality.js";
import type { BenchmarkChunk } from "../src/types.js";

const chunks: readonly BenchmarkChunk[] = [
  {
    id: 1,
    path: "docs/a.md",
    heading: ["A", "Target"],
    startLine: 1,
    endLine: 3,
    contentHash: "a",
    text: "first",
  },
  {
    id: 2,
    path: "docs/b.md",
    heading: ["B"],
    startLine: 5,
    endLine: 8,
    contentHash: "b",
    text: "second",
  },
];

describe("semantic quality", () => {
  it("ranks by cosine similarity and matches path plus heading", () => {
    const ranked = rankLocations(
      chunks,
      [new Float32Array([1, 0]), new Float32Array([0, 1])],
      new Float32Array([1, 0]),
    );
    const observation = observeQuality(
      "case",
      [{ path: "docs/a.md", heading: "Target" }],
      [ranked, ranked],
    );
    expect(observation.expectedRank).toBe(1);
    expect(observation.stable).toBe(true);
    expect(summarizeQuality([observation]).metrics).toEqual({
      recallAt5: 1,
      top1: 1,
      meanReciprocalRank: 1,
      stability: 1,
    });
  });

  it("detects changed top-five ordering", () => {
    const first = rankLocations(
      chunks,
      [new Float32Array([1, 0]), new Float32Array([0, 1])],
      new Float32Array([1, 0]),
    );
    const second = [...first].reverse();
    expect(observeQuality("case", [{ path: "docs/a.md" }], [first, second]).stable).toBe(false);
  });
});
