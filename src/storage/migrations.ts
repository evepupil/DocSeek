import type Database from "better-sqlite3";

const SCHEMA_VERSION = 2;

const migrationOne = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    root_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sources (
    id INTEGER PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    root_path TEXT NOT NULL,
    config_json TEXT NOT NULL,
    UNIQUE(collection_id, source_key)
  );

  CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    document_key TEXT NOT NULL,
    locator TEXT NOT NULL,
    display_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    modified_at_ms REAL NOT NULL,
    size_bytes INTEGER NOT NULL,
    indexed_at TEXT NOT NULL,
    UNIQUE(source_id, document_key)
  );

  CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    heading_json TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    UNIQUE(document_id, ordinal)
  );

  CREATE TABLE chunk_embeddings (
    chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    dimension INTEGER NOT NULL,
    embedding BLOB NOT NULL
  );

  CREATE VIRTUAL TABLE chunks_fts USING fts5(
    heading_terms,
    content_terms,
    tokenize = 'unicode61 remove_diacritics 2'
  );

  CREATE TRIGGER chunks_after_delete
  AFTER DELETE ON chunks
  BEGIN
    DELETE FROM chunks_fts WHERE rowid = OLD.id;
  END;

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE source_tags (
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(source_id, tag_id)
  );

  CREATE TABLE document_tags (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(document_id, tag_id)
  );

  CREATE INDEX documents_source_hash ON documents(source_id, content_hash);
  CREATE INDEX chunks_document ON chunks(document_id, ordinal);
  CREATE INDEX sources_collection ON sources(collection_id, source_key);
`;

const migrationTwo = `
  ALTER TABLE documents ADD COLUMN media_type TEXT NOT NULL DEFAULT 'text/markdown';
`;

interface VersionRow {
  readonly version: number;
}

export function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const row = database
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as VersionRow;

  if (row.version > SCHEMA_VERSION) {
    throw new Error(
      `Index schema ${row.version} is newer than supported schema ${SCHEMA_VERSION}.`,
    );
  }

  if (row.version < 1) {
    database.transaction(() => {
      database.exec(migrationOne);
      database
        .prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(1, new Date().toISOString());
    })();
  }

  if (row.version < 2) {
    database.transaction(() => {
      database.exec(migrationTwo);
      database
        .prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(2, new Date().toISOString());
    })();
  }
}
