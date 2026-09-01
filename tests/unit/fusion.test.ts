import { describe, expect, it } from "vitest";

import type { SearchCandidate } from "../../src/domain/types.js";
import { fuseCandidates } from "../../src/search/fusion.js";

function candidate(chunkId: number, path: string, rank: number): SearchCandidate {
  return {
    chunkId,
    sourceId: "project",
    documentKey: path,
    path,
    startLine: 10,
    endLine: 20,
    heading: ["Heading"],
    content: "Relevant content",
    rank,
  };
}

describe("fuseCandidates", () => {
  it("promotes results found by both retrieval routes", () => {
    const results = fuseCandidates(
      [candidate(1, "semantic.md", 1), candidate(2, "both.md", 2)],
      [candidate(2, "both.md", 1), candidate(3, "keyword.md", 2)],
      3,
      false,
    );

    expect(results[0]?.path).toBe("both.md");
    expect(results[0]?.score).toBe(1);
  });

  it("uses stable path ordering for exact ties", () => {
    const results = fuseCandidates([candidate(1, "b.md", 1), candidate(2, "a.md", 1)], [], 2, true);

    expect(results.map((result) => result.path)).toEqual(["a.md", "b.md"]);
    expect(results[0]?.snippet).toBe("Relevant content");
  });
});
