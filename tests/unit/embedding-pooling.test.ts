import { describe, expect, it } from "vitest";

import { meanPoolAndNormalize } from "../../src/embedding/pooling.js";

describe("embedding pooling", () => {
  it("ignores padding and returns unit vectors", () => {
    const result = meanPoolAndNormalize(
      new Float32Array([1, 0, 0, 1, 9, 9]),
      [1, 3, 2],
      BigInt64Array.from([1n, 1n, 0n]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(result[0]?.[1]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("rejects mismatched tensor shapes", () => {
    expect(() => meanPoolAndNormalize(new Float32Array([1, 2]), [1, 1, 3], [1])).toThrow(
      "Unexpected embedding tensors",
    );
  });
});
