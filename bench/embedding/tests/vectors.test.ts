import { describe, expect, it } from "vitest";

import { clsPoolAndNormalize, meanPoolAndNormalize } from "../src/pooling.js";
import { embedInBatches } from "../src/providers/shared.js";
import { cosineSimilarity, normalizeVector, validateVectors } from "../src/vectors.js";

describe("benchmark vectors", () => {
  it("normalizes and compares vectors", () => {
    const first = normalizeVector([3, 4]);
    const second = normalizeVector([6, 8]);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1, 6);
    expect(validateVectors([first, second], 2)).toBe(2);
  });

  it("mean-pools only unmasked tokens", () => {
    const pooled = meanPoolAndNormalize(
      new Float32Array([1, 0, 0, 1, 9, 9]),
      [1, 3, 2],
      BigInt64Array.from([1n, 1n, 0n]),
    );
    expect(pooled[0]?.[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(pooled[0]?.[1]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("selects and normalizes the first token for CLS pooling", () => {
    const pooled = clsPoolAndNormalize(new Float32Array([3, 4, 9, 9, 5, 12, 8, 15]), [2, 2, 2]);
    expect(Array.from(pooled[0] ?? [])).toEqual([0.6000000238418579, 0.800000011920929]);
    expect(pooled[1]?.[0]).toBeCloseTo(5 / 13, 6);
    expect(pooled[1]?.[1]).toBeCloseTo(12 / 13, 6);
  });

  it("restores vectors after length-bucketed batching", async () => {
    const result = await embedInBatches(
      ["long text", "x", "medium"],
      2,
      (batch) => Promise.resolve(batch.map((text) => normalizeVector([text.length, 1]))),
      () => undefined,
      "length-bucketed",
    );
    expect(result.batchCalls).toBe(2);
    expect(result.vectors.map((vector) => Math.round((vector[0] ?? 0) * 100))).toEqual([
      99, 71, 99,
    ]);
  });
});
