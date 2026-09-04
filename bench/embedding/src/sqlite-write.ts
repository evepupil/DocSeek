import { mkdtemp, rm, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

export async function measureSqliteWrite(vectors: readonly Float32Array[]): Promise<number> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "docseek-embedding-bench-"));
  const databasePath = path.join(directory, "vectors.db");
  const startedAt = performance.now();
  const database = new Database(databasePath);
  try {
    database.pragma("journal_mode = DELETE");
    database.exec(`
      CREATE TABLE embeddings (
        id INTEGER PRIMARY KEY,
        dimension INTEGER NOT NULL,
        embedding BLOB NOT NULL
      )
    `);
    const insert = database.prepare(
      "INSERT INTO embeddings(id, dimension, embedding) VALUES (?, ?, ?)",
    );
    database.transaction(() => {
      vectors.forEach((vector, index) => {
        const buffer = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
        insert.run(index + 1, vector.length, buffer);
      });
    })();
    return performance.now() - startedAt;
  } finally {
    database.close();
    await rm(databasePath, { force: true });
    await rm(`${databasePath}-journal`, { force: true });
    await rmdir(directory);
  }
}
