import type Database from "better-sqlite3";

import { DocSeekError } from "../domain/errors.js";
import type { SearchCandidate, SearchRequest } from "../domain/types.js";
import { normalizePathFilter } from "../project/paths.js";
import { vectorBuffer } from "./database.js";

interface CandidateRow {
  readonly chunk_id: number;
  readonly source_id: string;
  readonly document_key: string;
  readonly display_path: string;
  readonly start_line: number;
  readonly end_line: number;
  readonly heading_json: string;
  readonly content: string;
  readonly heading_terms: string;
  readonly content_terms: string;
  readonly distance?: number;
}

interface FilterSql {
  readonly clauses: readonly string[];
  readonly parameters: readonly (string | number)[];
}

function parseHeading(value: string): readonly string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new DocSeekError("INDEX_DATA_INVALID", "A stored heading path is invalid.");
  }
  return parsed;
}

function buildFilters(request: SearchRequest): FilterSql {
  const clauses: string[] = [];
  const parameters: (string | number)[] = [];

  if (request.path) {
    const escaped = normalizePathFilter(request.path).replace(/[\\%_]/gu, "\\$&");
    clauses.push("LOWER(REPLACE(d.display_path, '\\', '/')) LIKE ? ESCAPE '\\'");
    parameters.push(`%${escaped}%`);
  }

  if (request.collectionIds && request.collectionIds.length > 0) {
    clauses.push(`s.collection_id IN (${request.collectionIds.map(() => "?").join(", ")})`);
    parameters.push(...request.collectionIds);
  }

  if (request.sourceIds && request.sourceIds.length > 0) {
    clauses.push(`s.source_key IN (${request.sourceIds.map(() => "?").join(", ")})`);
    parameters.push(...request.sourceIds);
  }

  if (request.tags && request.tags.length > 0) {
    const placeholders = request.tags.map(() => "?").join(", ");
    clauses.push(`(
      EXISTS (
        SELECT 1 FROM document_tags dt
        JOIN tags document_tag ON document_tag.id = dt.tag_id
        WHERE dt.document_id = d.id AND document_tag.name IN (${placeholders})
      )
      OR EXISTS (
        SELECT 1 FROM source_tags st
        JOIN tags source_tag ON source_tag.id = st.tag_id
        WHERE st.source_id = s.id AND source_tag.name IN (${placeholders})
      )
    )`);
    parameters.push(...request.tags, ...request.tags);
  }

  return { clauses, parameters };
}

function candidateFromRow(row: CandidateRow, rank: number): SearchCandidate {
  return {
    chunkId: row.chunk_id,
    sourceId: row.source_id,
    documentKey: row.document_key,
    path: row.display_path,
    startLine: row.start_line,
    endLine: row.end_line,
    heading: parseHeading(row.heading_json),
    content: row.content,
    indexedTerms: `${row.heading_terms} ${row.content_terms}`
      .split(/\s+/u)
      .filter((term) => term.length > 0),
    rank,
    ...(typeof row.distance === "number" ? { distance: row.distance } : {}),
  };
}

export function findVectorCandidates(
  database: Database.Database,
  vector: Float32Array,
  request: SearchRequest,
  limit: number,
): readonly SearchCandidate[] {
  const filters = buildFilters(request);
  const where = filters.clauses.length > 0 ? `WHERE ${filters.clauses.join(" AND ")}` : "";
  const rows = database
    .prepare(
      `SELECT DISTINCT
         c.id AS chunk_id,
         s.source_key AS source_id,
         d.document_key,
         d.display_path,
         c.start_line,
         c.end_line,
         c.heading_json,
         c.content,
         f.heading_terms,
         f.content_terms,
         vec_distance_cosine(e.embedding, ?) AS distance
       FROM chunk_embeddings e
       JOIN chunks c ON c.id = e.chunk_id
       JOIN chunks_fts f ON f.rowid = c.id
       JOIN documents d ON d.id = c.document_id
       JOIN sources s ON s.id = d.source_id
       ${where}
       ORDER BY distance ASC, d.display_path ASC, c.start_line ASC, c.id ASC
       LIMIT ?`,
    )
    .all(vectorBuffer(vector), ...filters.parameters, limit) as CandidateRow[];
  return rows.map((row, index) => candidateFromRow(row, index + 1));
}

export function findKeywordCandidates(
  database: Database.Database,
  ftsQuery: string,
  request: SearchRequest,
  limit: number,
): readonly SearchCandidate[] {
  const filters = buildFilters(request);
  const clauses = ["chunks_fts MATCH ?", ...filters.clauses];
  const rows = database
    .prepare(
      `SELECT DISTINCT
         c.id AS chunk_id,
         s.source_key AS source_id,
         d.document_key,
         d.display_path,
         c.start_line,
         c.end_line,
         c.heading_json,
         c.content,
         chunks_fts.heading_terms,
         chunks_fts.content_terms,
         bm25(chunks_fts, 4.0, 1.0) AS keyword_score
       FROM chunks_fts
       JOIN chunks c ON c.id = chunks_fts.rowid
       JOIN documents d ON d.id = c.document_id
       JOIN sources s ON s.id = d.source_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY keyword_score ASC, d.display_path ASC, c.start_line ASC, c.id ASC
       LIMIT ?`,
    )
    .all(ftsQuery, ...filters.parameters, limit) as CandidateRow[];
  return rows.map((row, index) => candidateFromRow(row, index + 1));
}
