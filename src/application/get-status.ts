import { access } from "node:fs/promises";

import type { StatusResult } from "../domain/types.js";
import { loadProjectContext, projectPaths } from "../config/config-file.js";
import { locateProjectForInit } from "../project/find-root.js";
import { discoverDocuments } from "../sources/source-factory.js";
import { IndexStore } from "../storage/index-store.js";
import { calculateChanges } from "./change-set.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getStatus(startDir: string): Promise<StatusResult> {
  const location = await locateProjectForInit(startDir);
  const paths = projectPaths(location.rootDir);
  if (!(await exists(paths.configPath)) || !(await exists(paths.indexPath))) {
    return {
      rootDir: location.rootDir,
      initialized: false,
      added: 0,
      modified: 0,
      deleted: 0,
      unchanged: 0,
      documents: 0,
      chunks: 0,
    };
  }

  const context = await loadProjectContext(location.rootDir);
  const store = new IndexStore(context.indexPath);
  try {
    const documents = await discoverDocuments(context.config, context.rootDir);
    const changes = calculateChanges(documents, store.documentSnapshots(context.config.projectId));
    const counts = store.counts(context.config.projectId);
    const lastUpdatedAt = store.getMetadata("last_updated_at");
    return {
      rootDir: context.rootDir,
      initialized: true,
      model: context.config.embedding.model,
      added: changes.added,
      modified: changes.modified,
      deleted: changes.deleted,
      unchanged: changes.unchanged,
      documents: counts.documents,
      chunks: counts.chunks,
      ...(lastUpdatedAt ? { lastUpdatedAt } : {}),
    };
  } finally {
    store.close();
  }
}
