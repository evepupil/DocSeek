import { access, rm } from "node:fs/promises";

import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import type { IndexSummary } from "../domain/types.js";
import { createDefaultConfig } from "../config/schema.js";
import {
  loadProjectContext,
  projectPaths,
  readConfig,
  writeConfig,
} from "../config/config-file.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { locateProjectForInit } from "../project/find-root.js";
import { ensureDocSeekIgnored } from "../project/gitignore.js";
import { discoverDocuments } from "../sources/source-factory.js";
import { prepareTemporaryIndex, promoteTemporaryIndex } from "../storage/database.js";
import { IndexStore } from "../storage/index-store.js";
import { indexDocuments } from "./index-documents.js";

export interface InitResult extends IndexSummary {
  readonly rootDir: string;
  readonly usedGitFallback: boolean;
}

async function configExists(rootDir: string): Promise<boolean> {
  try {
    await access(projectPaths(rootDir).configPath);
    return true;
  } catch {
    return false;
  }
}

export async function initializeProject(
  startDir: string,
  createProvider: EmbeddingProviderFactory = createEmbeddingProvider,
): Promise<InitResult> {
  const location = await locateProjectForInit(startDir);
  await ensureDocSeekIgnored(location.rootDir);

  if (!(await configExists(location.rootDir))) {
    await writeConfig(location.rootDir, createDefaultConfig());
  } else {
    await readConfig(location.rootDir);
  }

  const context = await loadProjectContext(location.rootDir);
  const documents = await discoverDocuments(context.config, context.rootDir);
  const temporaryPath = await prepareTemporaryIndex(context.indexPath);
  const store = new IndexStore(temporaryPath, true);

  let summary: IndexSummary;
  try {
    summary = await indexDocuments({
      config: context.config,
      rootDir: context.rootDir,
      store,
      documents,
      createEmbeddingProvider: createProvider,
    });
  } catch (error) {
    store.close();
    await rm(temporaryPath, { force: true });
    throw error;
  }

  store.close();
  await promoteTemporaryIndex(temporaryPath, context.indexPath);
  return { ...summary, rootDir: context.rootDir, usedGitFallback: location.usedGitFallback };
}
