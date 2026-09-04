import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "../../src/config/schema.js";
import { embeddingFingerprint } from "../../src/embedding/transformers-provider.js";

describe("embedding fingerprint", () => {
  it("changes when the maximum semantic input length changes", () => {
    const embedding = createDefaultConfig().embedding;
    expect(embeddingFingerprint(embedding)).not.toBe(
      embeddingFingerprint({ ...embedding, maxTokens: embedding.maxTokens + 1 }),
    );
  });

  it("changes with batch size because batch composition can change numeric results", () => {
    const embedding = createDefaultConfig().embedding;
    expect(embeddingFingerprint(embedding)).not.toBe(
      embeddingFingerprint({ ...embedding, batchSize: embedding.batchSize + 1 }),
    );
  });
});
