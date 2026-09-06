import { describe, expect, it } from "vitest";

import { toRankedLocations } from "../src/hybrid-results.js";
import type { BenchmarkChunk } from "../src/types.js";

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
});
