import { access, rename, rm } from "node:fs/promises";

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

import { migrate } from "./migrations.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function openDatabase(filePath: string, temporary = false): Database.Database {
  const database = new Database(filePath);
  sqliteVec.load(database);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma(temporary ? "journal_mode = DELETE" : "journal_mode = WAL");
  migrate(database);
  return database;
}

export function vectorBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export async function prepareTemporaryIndex(indexPath: string): Promise<string> {
  const temporaryPath = `${indexPath}.next`;
  await rm(temporaryPath, { force: true });
  await rm(`${temporaryPath}-wal`, { force: true });
  await rm(`${temporaryPath}-shm`, { force: true });
  return temporaryPath;
}

export async function promoteTemporaryIndex(
  temporaryPath: string,
  indexPath: string,
): Promise<void> {
  const backupPath = `${indexPath}.previous`;
  await rm(backupPath, { force: true });
  await rm(`${indexPath}-wal`, { force: true });
  await rm(`${indexPath}-shm`, { force: true });

  const hadPrevious = await exists(indexPath);
  if (hadPrevious) {
    await rename(indexPath, backupPath);
  }

  try {
    await rename(temporaryPath, indexPath);
    await rm(backupPath, { force: true });
  } catch (error) {
    if (hadPrevious && (await exists(backupPath))) {
      await rename(backupPath, indexPath);
    }
    throw error;
  }
}
