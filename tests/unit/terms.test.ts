import { describe, expect, it } from "vitest";

import { buildFtsQuery, tokenizeForFts, tokenizeForSearch } from "../../src/search/terms.js";

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

  it("removes single characters and common question words from search terms", () => {
    const terms = tokenizeForSearch("为什么要查 GPU 冷启动");

    expect(terms).toEqual(expect.arrayContaining(["gpu", "冷启", "冷启动", "启动"]));
    expect(terms).not.toContain("冷");
    expect(terms).not.toContain("为什么");
  });
});
