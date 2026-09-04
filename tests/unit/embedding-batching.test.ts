import { describe, expect, it } from "vitest";

import { orderEmbeddingTexts, restoreEmbeddingOrder } from "../../src/embedding/batching.js";

describe("embedding batching", () => {
  it("groups shorter text first and keeps equal lengths stable", () => {
    expect(orderEmbeddingTexts(["long", "a", "same", "size"])).toEqual([
      { originalIndex: 1, text: "a" },
      { originalIndex: 0, text: "long" },
      { originalIndex: 2, text: "same" },
      { originalIndex: 3, text: "size" },
    ]);
  });

  it("restores vectors to their document positions", () => {
    const ordered = orderEmbeddingTexts(["long", "x", "mid"]);
    const restored = restoreEmbeddingOrder(
      ordered,
      ordered.map((item) => new Float32Array([item.originalIndex])),
    );
    expect(restored.map((vector) => vector[0])).toEqual([0, 1, 2]);
  });
});
