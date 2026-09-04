import { describe, expect, it } from "vitest";

import type { DiscoveredDocument } from "../../src/domain/types.js";
import { attachEmbeddings, prepareIndexBatch } from "../../src/application/index-batch.js";

function document(documentKey: string, content: string): DiscoveredDocument {
  return {
    sourceId: "project",
    documentKey,
    locator: `file:///${documentKey}`,
    displayPath: documentKey,
    absolutePath: documentKey,
    mediaType: "text/markdown",
    content,
    contentHash: documentKey,
    modifiedAtMs: 1,
    sizeBytes: content.length,
    tags: [],
  };
}

describe("cross-document index batch", () => {
  it("flattens changed documents once and restores vector ownership", () => {
    const batch = prepareIndexBatch(
      [
        document("first.md", "# First\n\nFirst body."),
        document("second.md", "# Second\n\nSecond body."),
      ],
      1800,
    );
    expect(batch.embeddingTexts).toEqual([
      "First\n\n# First\n\nFirst body.",
      "Second\n\n# Second\n\nSecond body.",
    ]);

    const embedded = attachEmbeddings(batch, [new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(embedded.map((entry) => entry.document.documentKey)).toEqual(["first.md", "second.md"]);
    expect(embedded[0]?.chunks[0]?.embedding).toEqual(new Float32Array([1, 0]));
    expect(embedded[1]?.chunks[0]?.embedding).toEqual(new Float32Array([0, 1]));
  });

  it("rejects a provider that returns the wrong vector count", () => {
    const batch = prepareIndexBatch([document("only.md", "# Only\n\nBody.")], 1800);
    expect(() => attachEmbeddings(batch, [])).toThrow("Expected 1 vectors");
  });
});
