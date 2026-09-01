import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../src/storage/database.js";

interface TableColumn {
  readonly name: string;
}

describe("database migrations", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map(async (directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("upgrades a version-one document table with media type support", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "docseek-migration-"));
    temporaryDirectories.push(directory);
    const indexPath = path.join(directory, "index.db");
    const oldDatabase = new Database(indexPath);
    oldDatabase.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations(version, applied_at) VALUES (1, '2026-09-01T00:00:00.000Z');
      CREATE TABLE documents (id INTEGER PRIMARY KEY);
    `);
    oldDatabase.close();

    const upgraded = openDatabase(indexPath, true);
    try {
      const columns = upgraded.prepare("PRAGMA table_info(documents)").all() as TableColumn[];
      expect(columns.map((column) => column.name)).toContain("media_type");
      expect(
        upgraded.prepare("SELECT MAX(version) AS version FROM schema_migrations").get(),
      ).toEqual({ version: 2 });
    } finally {
      upgraded.close();
    }
  });
});
