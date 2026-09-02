import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { fromRawConfig, rawConfigSchema, toRawConfig } from "../../src/config/schema.js";

function legacyConfig() {
  return {
    version: 1,
    project_id: randomUUID(),
    embedding: {
      provider: "transformers",
      model: "test-model",
      dtype: "q8",
      query_prefix: "query: ",
      document_prefix: "passage: ",
      batch_size: 8,
    },
    chunking: { max_chars: 1800 },
    sources: [
      {
        id: "project",
        kind: "markdown-directory",
        path: ".",
        include: ["**/*.md"],
        exclude: [],
        tags: [],
      },
    ],
  };
}

describe("search configuration", () => {
  it("adds calibrated defaults when an older config has no search section", () => {
    const parsed = rawConfigSchema.parse(legacyConfig());
    const config = fromRawConfig(parsed);

    expect(config.search).toEqual({
      vectorWeight: 0.45,
      keywordWeight: 0.55,
      semanticBestDistance: 0.09,
      semanticWeakDistance: 0.15,
      minimumConfidence: 0.5,
      candidatePool: 100,
    });
    expect(toRawConfig(config).search).toEqual(parsed.search);
  });

  it("rejects zero total weight and reversed semantic distance bounds", () => {
    const config = {
      ...legacyConfig(),
      search: {
        vector_weight: 0,
        keyword_weight: 0,
        semantic_best_distance: 0.2,
        semantic_weak_distance: 0.1,
        minimum_confidence: 0.5,
        candidate_pool: 100,
      },
    };

    const result = rawConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "At least one search weight must be greater than zero",
          "semantic_best_distance must be smaller than semantic_weak_distance",
        ]),
      );
    }
  });
});
