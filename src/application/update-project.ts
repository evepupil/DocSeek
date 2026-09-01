import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import type { IndexSummary } from "../domain/types.js";
import { loadProjectContext } from "../config/config-file.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { locateInitializedProject } from "../project/find-root.js";
import { discoverDocuments } from "../sources/source-factory.js";
import { IndexStore } from "../storage/index-store.js";
import { indexDocuments } from "./index-documents.js";

export interface UpdateResult extends IndexSummary {
  readonly rootDir: string;
}

export async function updateProject(
  startDir: string,
  createProvider: EmbeddingProviderFactory = createEmbeddingProvider,
): Promise<UpdateResult> {
  const rootDir = await locateInitializedProject(startDir);
  const context = await loadProjectContext(rootDir);
  const documents = await discoverDocuments(context.config, context.rootDir);
  const store = new IndexStore(context.indexPath);

  try {
    const summary = await indexDocuments({
      config: context.config,
      rootDir: context.rootDir,
      store,
      documents,
      createEmbeddingProvider: createProvider,
    });
    return { ...summary, rootDir };
  } finally {
    store.close();
  }
}
