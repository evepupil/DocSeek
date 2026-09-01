import { describe, expect, it } from "vitest";

import type { DiscoveredDocument, DocumentSnapshot } from "../../src/domain/types.js";
import { calculateChanges } from "../../src/application/change-set.js";

function discovered(documentKey: string, contentHash: string): DiscoveredDocument {
  return {
    sourceId: "project",
    documentKey,
    locator: `file:///${documentKey}`,
    displayPath: documentKey,
    absolutePath: documentKey,
    mediaType: "text/markdown",
    content: "content",
    contentHash,
    modifiedAtMs: 1,
    sizeBytes: 7,
    tags: [],
  };
}

function indexed(id: number, documentKey: string, contentHash: string): DocumentSnapshot {
  return { id, sourceId: "project", documentKey, contentHash };
}

describe("calculateChanges", () => {
  it("classifies added, modified, deleted, and unchanged documents", () => {
    const changes = calculateChanges(
      [
        discovered("added.md", "a"),
        discovered("modified.md", "new"),
        discovered("same.md", "same"),
      ],
      [
        indexed(1, "modified.md", "old"),
        indexed(2, "same.md", "same"),
        indexed(3, "deleted.md", "d"),
      ],
    );

    expect(changes).toMatchObject({ added: 1, modified: 1, deleted: 1, unchanged: 1 });
    expect(changes.changedDocuments.map((document) => document.documentKey)).toEqual([
      "added.md",
      "modified.md",
    ]);
    expect(changes.deletedDocuments[0]?.documentKey).toBe("deleted.md");
  });
});
