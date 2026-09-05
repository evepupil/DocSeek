import { describe, expect, it } from "vitest";

import { prepareTokenBatch } from "../src/token-inputs.js";

describe("benchmark token inputs", () => {
  it("keeps short rows and pads to the longest row", () => {
    const result = prepareTokenBatch(
      {
        inputIds: [
          [1, 2],
          [3, 4, 5],
        ],
      },
      8,
      0,
      2,
    );
    expect(result.dimensions).toEqual([2, 3]);
    expect([...result.inputIds]).toEqual([1n, 2n, 0n, 3n, 4n, 5n]);
    expect([...result.attentionMask]).toEqual([1n, 1n, 0n, 1n, 1n, 1n]);
  });

  it("keeps both ends of long rows with a separator", () => {
    const result = prepareTokenBatch(
      {
        inputIds: [[0, 1, 2, 3, 4, 5, 6, 7, 8]],
        tokenTypeIds: [[0, 0, 0, 0, 1, 1, 1, 1, 1]],
      },
      6,
      9,
      99,
    );
    expect([...result.inputIds]).toEqual([0n, 1n, 2n, 99n, 7n, 8n]);
    expect([...(result.tokenTypeIds ?? [])]).toEqual([0n, 0n, 0n, 0n, 1n, 1n]);
    expect([...result.attentionMask]).toEqual([1n, 1n, 1n, 1n, 1n, 1n]);
  });

  it("rejects mismatched token type rows", () => {
    expect(() => prepareTokenBatch({ inputIds: [[1, 2]], tokenTypeIds: [[0]] }, 8, 0, 2)).toThrow(
      "does not match its input row",
    );
  });
});
