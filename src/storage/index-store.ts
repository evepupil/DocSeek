import path from "node:path";

import type Database from "better-sqlite3";

import { DocSeekError } from "../domain/errors.js";
import type {
  DiscoveredDocument,
  DocSeekConfig,
  DocumentSnapshot,
  EmbeddedChunk,
  SearchCandidate,
  SearchRequest,
} from "../domain/types.js";
import { openDatabase, vectorBuffer } from "./database.js";
import { findKeywordCandidates, findVectorCandidates } from "./search-queries.js";

interface SourceRow {
  readonly id: number;
  readonly source_key: string;
}

interface DocumentRow extends DocumentSnapshot {
  readonly sourceId: string;
  readonly documentKey: string;
  readonly contentHash: string;
}

interface CountRow {
  readonly count: number;
}

interface MetadataRow {
  readonly value: string;
}

export class IndexStore {
  readonly #database: Database.Database;

  constructor(indexPath: string, temporary = false) {
    this.#database = openDatabase(indexPath, temporary);
  }

  close(): void {
    this.#database.close();
  }

  getMetadata(key: string): string | undefined {
    const row = this.#database.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as
      MetadataRow | undefined;
    return row?.value;
  }

  setMetadata(key: string, value: string): void {
    this.#database
      .prepare(
        "INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  syncCollection(config: DocSeekConfig, rootDir: string): void {
    const now = new Date().toISOString();
    this.#database
      .prepare(
        `INSERT INTO collections(id, root_path, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET root_path = excluded.root_path`,
      )
      .run(config.projectId, path.resolve(rootDir), now);

    const upsertSource = this.#database.prepare(
      `INSERT INTO sources(collection_id, source_key, kind, root_path, config_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(collection_id, source_key) DO UPDATE SET
         kind = excluded.kind,
         root_path = excluded.root_path,
         config_json = excluded.config_json`,
    );

    this.#database.transaction(() => {
      for (const source of config.sources) {
        upsertSource.run(
          config.projectId,
          source.id,
          source.kind,
          path.resolve(rootDir, source.path),
          JSON.stringify(source),
        );
      }

      for (const source of config.sources) {
        const sourceRow = this.#sourceRow(config.projectId, source.id);
        this.#replaceTags("source_tags", "source_id", sourceRow.id, source.tags);
      }
    })();
  }

  deleteSourcesExcept(collectionId: string, sourceIds: readonly string[]): void {
    if (sourceIds.length === 0) {
      this.#database.prepare("DELETE FROM sources WHERE collection_id = ?").run(collectionId);
      return;
    }
    this.#database
      .prepare(
        `DELETE FROM sources
         WHERE collection_id = ? AND source_key NOT IN (${sourceIds.map(() => "?").join(", ")})`,
      )
      .run(collectionId, ...sourceIds);
  }

  documentSnapshots(collectionId: string): readonly DocumentSnapshot[] {
    const rows = this.#database
      .prepare(
        `SELECT d.id, s.source_key AS sourceId, d.document_key AS documentKey, d.content_hash AS contentHash
         FROM documents d
         JOIN sources s ON s.id = d.source_id
         WHERE s.collection_id = ?`,
      )
      .all(collectionId) as DocumentRow[];
    return rows;
  }

  replaceDocument(
    collectionId: string,
    document: DiscoveredDocument,
    chunks: readonly EmbeddedChunk[],
  ): void {
    const source = this.#sourceRow(collectionId, document.sourceId);
    const dimension = chunks[0]?.embedding.length;
    if (dimension) {
      for (const chunk of chunks) {
        if (chunk.embedding.length !== dimension) {
          throw new DocSeekError(
            "EMBEDDING_DIMENSION_MISMATCH",
            "A document contains mixed vector dimensions.",
          );
        }
      }
      this.#assertOrSetDimension(dimension);
    }

    const insertDocument = this.#database.prepare(
      `INSERT INTO documents(
         source_id, document_key, locator, display_path, media_type, content_hash,
         modified_at_ms, size_bytes, indexed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertChunk = this.#database.prepare(
      `INSERT INTO chunks(
         document_id, ordinal, heading_json, start_line, end_line, content, content_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEmbedding = this.#database.prepare(
      "INSERT INTO chunk_embeddings(chunk_id, dimension, embedding) VALUES (?, ?, ?)",
    );
    const insertFts = this.#database.prepare(
      "INSERT INTO chunks_fts(rowid, heading_terms, content_terms) VALUES (?, ?, ?)",
    );

    this.#database.transaction(() => {
      this.#database
        .prepare("DELETE FROM documents WHERE source_id = ? AND document_key = ?")
        .run(source.id, document.documentKey);
      const documentResult = insertDocument.run(
        source.id,
        document.documentKey,
        document.locator,
        document.displayPath,
        document.mediaType,
        document.contentHash,
        document.modifiedAtMs,
        document.sizeBytes,
        new Date().toISOString(),
      );
      const documentId = Number(documentResult.lastInsertRowid);
      this.#replaceTags("document_tags", "document_id", documentId, document.tags);

      for (const chunk of chunks) {
        const chunkResult = insertChunk.run(
          documentId,
          chunk.ordinal,
          JSON.stringify(chunk.heading),
          chunk.startLine,
          chunk.endLine,
          chunk.content,
          chunk.contentHash,
        );
        const chunkId = Number(chunkResult.lastInsertRowid);
        insertEmbedding.run(chunkId, chunk.embedding.length, vectorBuffer(chunk.embedding));
        insertFts.run(chunkId, chunk.headingTerms, chunk.searchTerms);
      }
    })();
  }

  deleteDocument(collectionId: string, sourceId: string, documentKey: string): void {
    this.#database
      .prepare(
        `DELETE FROM documents
         WHERE document_key = ? AND source_id = (
           SELECT id FROM sources WHERE collection_id = ? AND source_key = ?
         )`,
      )
      .run(documentKey, collectionId, sourceId);
  }

  counts(collectionId: string): { readonly documents: number; readonly chunks: number } {
    const documents = this.#database
      .prepare(
        `SELECT COUNT(*) AS count FROM documents d
         JOIN sources s ON s.id = d.source_id
         WHERE s.collection_id = ?`,
      )
      .get(collectionId) as CountRow;
    const chunks = this.#database
      .prepare(
        `SELECT COUNT(*) AS count FROM chunks c
         JOIN documents d ON d.id = c.document_id
         JOIN sources s ON s.id = d.source_id
         WHERE s.collection_id = ?`,
      )
      .get(collectionId) as CountRow;
    return { documents: documents.count, chunks: chunks.count };
  }

  vectorCandidates(
    vector: Float32Array,
    request: SearchRequest,
    limit: number,
  ): readonly SearchCandidate[] {
    this.#assertQueryDimension(vector.length);
    return findVectorCandidates(this.#database, vector, request, limit);
  }

  keywordCandidates(
    ftsQuery: string,
    request: SearchRequest,
    limit: number,
  ): readonly SearchCandidate[] {
    return findKeywordCandidates(this.#database, ftsQuery, request, limit);
  }

  #sourceRow(collectionId: string, sourceId: string): SourceRow {
    const row = this.#database
      .prepare("SELECT id, source_key FROM sources WHERE collection_id = ? AND source_key = ?")
      .get(collectionId, sourceId) as SourceRow | undefined;
    if (!row) {
      throw new DocSeekError(
        "SOURCE_NOT_FOUND",
        `Document source '${sourceId}' is not registered.`,
      );
    }
    return row;
  }

  #replaceTags(
    table: "source_tags" | "document_tags",
    ownerColumn: string,
    ownerId: number,
    tags: readonly string[],
  ): void {
    this.#database.prepare(`DELETE FROM ${table} WHERE ${ownerColumn} = ?`).run(ownerId);
    for (const name of new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))) {
      this.#database.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)").run(name);
      this.#database
        .prepare(
          `INSERT INTO ${table}(${ownerColumn}, tag_id)
           SELECT ?, id FROM tags WHERE name = ? COLLATE NOCASE`,
        )
        .run(ownerId, name);
    }
  }

  #assertOrSetDimension(dimension: number): void {
    const current = this.getMetadata("embedding_dimension");
    if (!current) {
      this.setMetadata("embedding_dimension", String(dimension));
      return;
    }
    if (Number(current) !== dimension) {
      throw new DocSeekError(
        "EMBEDDING_DIMENSION_MISMATCH",
        `Index expects ${current}-dimensional vectors, but the model returned ${dimension}. Run \`docseek init\` to rebuild it.`,
      );
    }
  }

  #assertQueryDimension(dimension: number): void {
    const current = this.getMetadata("embedding_dimension");
    if (current && Number(current) !== dimension) {
      throw new DocSeekError(
        "EMBEDDING_DIMENSION_MISMATCH",
        `Index expects ${current}-dimensional vectors, but the model returned ${dimension}. Run \`docseek init\` to rebuild it.`,
      );
    }
  }
}
