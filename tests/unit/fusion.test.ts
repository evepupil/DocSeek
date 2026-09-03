import { describe, expect, it } from "vitest";

import type { SearchCandidate, SearchConfig } from "../../src/domain/types.js";
import { fuseCandidates } from "../../src/search/fusion.js";
import { tokenizeForFts } from "../../src/search/terms.js";

const searchConfig: SearchConfig = {
  vectorWeight: 0.45,
  keywordWeight: 0.55,
  semanticBestDistance: 0.09,
  semanticWeakDistance: 0.15,
  minimumConfidence: 0.5,
  candidatePool: 100,
};

function candidate(
  chunkId: number,
  path: string,
  rank: number,
  content = "Relevant content",
  distance?: number,
): SearchCandidate {
  return {
    chunkId,
    sourceId: "project",
    documentKey: path,
    path,
    startLine: 10,
    endLine: 20,
    heading: ["Heading"],
    content,
    indexedTerms: tokenizeForFts(`Heading ${content}`),
    rank,
    ...(distance !== undefined ? { distance } : {}),
  };
}

function options(overrides?: { readonly explain?: boolean; readonly snippet?: boolean }) {
  return {
    top: 5,
    includeSnippet: overrides?.snippet ?? false,
    includeExplanation: overrides?.explain ?? false,
    queryTerms: ["relevant"],
    config: searchConfig,
  };
}

describe("fuseCandidates", () => {
  it("promotes results found by both retrieval routes", () => {
    const results = fuseCandidates(
      [
        candidate(1, "semantic.md", 1, "Relevant content", 0.1),
        candidate(2, "both.md", 2, "Relevant content", 0.11),
      ],
      [candidate(2, "both.md", 1), candidate(3, "keyword.md", 2)],
      options(),
    );

    expect(results[0]?.path).toBe("both.md");
  });

  it("lets an exact keyword result outrank weak semantic candidates", () => {
    const results = fuseCandidates(
      [
        candidate(1, "semantic.md", 1, "Generic model configuration", 0.13),
        candidate(2, "exact.md", 60, "GPU scheduler cold starts", 0.17),
      ],
      [candidate(2, "exact.md", 1, "GPU scheduler cold starts")],
      {
        ...options(),
        queryTerms: ["gpu", "scheduler"],
      },
    );

    expect(results[0]?.path).toBe("exact.md");
  });

  it("filters candidates with no credible semantic or lexical signal", () => {
    const results = fuseCandidates(
      [candidate(1, "unrelated.md", 1, "Documentation index", 0.14)],
      [candidate(1, "unrelated.md", 1, "Documentation index")],
      {
        ...options(),
        queryTerms: ["zxqv-9999", "香蕉协议"],
      },
    );

    expect(results).toEqual([]);
  });

  it("uses stable ordering and exposes absolute scores with optional diagnostics", () => {
    const results = fuseCandidates(
      [
        candidate(1, "b.md", 1, "Relevant content", 0.11),
        candidate(2, "a.md", 1, "Relevant content", 0.11),
      ],
      [],
      options({ explain: true, snippet: true }),
    );

    expect(results.map((result) => result.path)).toEqual(["a.md", "b.md"]);
    expect(results[0]?.score).toBeLessThan(1);
    expect(results[0]?.snippet).toBe("Relevant content");
    expect(results[0]?.explanation?.vectorRank).toBe(1);
    expect(results[0]?.explanation?.lexicalStrength).toBeGreaterThan(0);
    expect(results[0]?.explanation?.confidence).toBeGreaterThan(0);
  });

  it("returns every trusted candidate when no final limit is supplied", () => {
    const vectorCandidates = Array.from({ length: 7 }, (_, index) =>
      candidate(index + 1, `${index + 1}.md`, index + 1, "Relevant content", 0.1),
    );

    const unlimited = fuseCandidates(vectorCandidates, [], {
      includeSnippet: false,
      includeExplanation: false,
      queryTerms: ["relevant"],
      config: searchConfig,
    });
    const limited = fuseCandidates(vectorCandidates, [], {
      ...options(),
      top: 3,
    });

    expect(unlimited).toHaveLength(7);
    expect(limited).toHaveLength(3);
  });
});
