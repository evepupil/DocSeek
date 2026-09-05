import { describe, expect, it } from "vitest";

import {
  prepareStaticTokenBatch,
  truncateAndNormalizeSentenceEmbeddings,
} from "../src/providers/static-ort.js";

describe("static ONNX benchmark provider", () => {
  it("keeps the head and tail without adding special tokens", () => {
    const batch = prepareStaticTokenBatch(
      [
        [10, 11, 12, 13, 14, 15],
        [20, 21],
      ],
      4,
      0,
    );

    expect(batch.dimensions).toEqual([2, 4]);
    expect(Array.from(batch.inputIds)).toEqual([10n, 11n, 14n, 15n, 20n, 21n, 0n, 0n]);
    expect(Array.from(batch.attentionMask)).toEqual([1n, 1n, 1n, 1n, 1n, 1n, 0n, 0n]);
  });

  it("truncates Matryoshka vectors before normalizing them", () => {
    const vectors = truncateAndNormalizeSentenceEmbeddings(
      new Float32Array([3, 4, 100, 100, 5, 12, 100, 100]),
      [2, 4],
      2,
    );

    expect(Array.from(vectors[0] ?? [])).toEqual([0.6000000238418579, 0.800000011920929]);
    expect(vectors[1]?.[0]).toBeCloseTo(5 / 13, 6);
    expect(vectors[1]?.[1]).toBeCloseTo(12 / 13, 6);
  });

  it("rejects empty token rows", () => {
    expect(() => prepareStaticTokenBatch([[]], 288, 0)).toThrow("has no tokens");
  });
});
