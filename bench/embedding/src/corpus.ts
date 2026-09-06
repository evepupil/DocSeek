import { createHash } from "node:crypto";

import Database from "better-sqlite3";
import { z } from "zod";

import type { BenchmarkChunk, CorpusSnapshot } from "./types.js";

interface ChunkRow {
  readonly id: number;
  readonly display_path: string;
  readonly heading_json: string;
  readonly start_line: number;
  readonly end_line: number;
  readonly content: string;
  readonly content_hash: string;
}

const headingSchema = z.array(z.string());

function embeddingText(heading: readonly string[], content: string): string {
  const headingText = heading.join(" > ");
  return headingText.length > 0 ? `${headingText}\n\n${content}` : content;
}

function evenlySample<T>(values: readonly T[], limit: number | undefined): readonly T[] {
  if (limit === undefined || limit >= values.length) {
    return values;
  }
  if (limit <= 0) {
    throw new RangeError("Corpus limit must be greater than zero.");
  }
  return Array.from({ length: limit }, (_, index) => {
    const sourceIndex = Math.floor((index * values.length) / limit);
    const value = values[sourceIndex];
    if (value === undefined) {
      throw new Error(`Could not sample corpus row ${sourceIndex}.`);
    }
    return value;
  });
}

export function loadCorpus(indexPath: string, limit?: number): CorpusSnapshot {
  const database = new Database(indexPath, { readonly: true, fileMustExist: true });
  try {
    const rows = database
      .prepare(
        `SELECT c.id, d.display_path, c.heading_json, c.start_line, c.end_line,
                c.content, c.content_hash
           FROM chunks c
           JOIN documents d ON d.id = c.document_id
          ORDER BY d.display_path, c.ordinal`,
      )
      .all() as ChunkRow[];
    const selected = evenlySample(rows, limit);
    const chunks: BenchmarkChunk[] = selected.map((row) => {
      const heading = headingSchema.parse(JSON.parse(row.heading_json) as unknown);
      return {
        id: row.id,
        path: row.display_path,
        heading,
        startLine: row.start_line,
        endLine: row.end_line,
        contentHash: row.content_hash,
        content: row.content,
        text: embeddingText(heading, row.content),
      };
    });
    const fingerprint = createHash("sha256");
    fingerprint.update(`total:${rows.length}\nselected:${chunks.length}\n`);
    for (const chunk of chunks) {
      fingerprint.update(`${chunk.id}:${chunk.contentHash}\n`);
    }
    return {
      chunks,
      totalChunksInIndex: rows.length,
      documentCount: new Set(chunks.map((chunk) => chunk.path)).size,
      totalCharacters: chunks.reduce((total, chunk) => total + chunk.text.length, 0),
      fingerprint: fingerprint.digest("hex"),
    };
  } finally {
    database.close();
  }
}
