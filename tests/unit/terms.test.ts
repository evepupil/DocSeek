import { describe, expect, it } from "vitest";

import { buildFtsQuery, tokenizeForFts } from "../../src/search/terms.js";

describe("FTS term generation", () => {
  it("keeps technical identifiers and adds Chinese bigrams", () => {
    const terms = tokenizeForFts("Scheduler scale-out 为什么考虑 GPU 冷启动");

    expect(terms).toEqual(
      expect.arrayContaining(["scheduler", "scale-out", "scale", "out", "gpu", "冷启", "启动"]),
    );
  });

  it("builds a quoted FTS OR query", () => {
    const query = buildFtsQuery("GPU cold-start");
    expect(query).toContain('"gpu"');
    expect(query).toContain(" OR ");
  });

  it("returns no FTS query for punctuation only", () => {
    expect(buildFtsQuery("--- / ...")).toBeUndefined();
  });
});
