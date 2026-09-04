import { describe, expect, it } from "vitest";

import { percentile, summarizeNumbers } from "../src/stats.js";

describe("benchmark statistics", () => {
  it("uses nearest-rank percentiles", () => {
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0.95)).toBe(5);
  });

  it("summarizes an empty or populated sample", () => {
    expect(summarizeNumbers([])).toEqual({ minimum: 0, median: 0, maximum: 0 });
    expect(summarizeNumbers([9, 3, 6])).toEqual({ minimum: 3, median: 6, maximum: 9 });
  });
});
