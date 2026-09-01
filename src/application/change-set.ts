import type { DiscoveredDocument, DocumentSnapshot, IndexChanges } from "../domain/types.js";

export interface DocumentChangeSet extends IndexChanges {
  readonly changedDocuments: readonly DiscoveredDocument[];
  readonly deletedDocuments: readonly DocumentSnapshot[];
}

function key(sourceId: string, documentKey: string): string {
  return `${sourceId}\0${documentKey}`;
}

export function calculateChanges(
  discovered: readonly DiscoveredDocument[],
  indexed: readonly DocumentSnapshot[],
): DocumentChangeSet {
  const indexedByKey = new Map(
    indexed.map((document) => [key(document.sourceId, document.documentKey), document]),
  );
  const discoveredKeys = new Set<string>();
  const changedDocuments: DiscoveredDocument[] = [];
  let added = 0;
  let modified = 0;
  let unchanged = 0;

  for (const document of discovered) {
    const documentKey = key(document.sourceId, document.documentKey);
    discoveredKeys.add(documentKey);
    const previous = indexedByKey.get(documentKey);
    if (!previous) {
      added += 1;
      changedDocuments.push(document);
    } else if (previous.contentHash !== document.contentHash) {
      modified += 1;
      changedDocuments.push(document);
    } else {
      unchanged += 1;
    }
  }

  const deletedDocuments = indexed.filter(
    (document) => !discoveredKeys.has(key(document.sourceId, document.documentKey)),
  );

  return {
    added,
    modified,
    deleted: deletedDocuments.length,
    unchanged,
    changedDocuments,
    deletedDocuments,
  };
}
