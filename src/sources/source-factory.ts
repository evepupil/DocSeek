import type { DocumentSource } from "../domain/contracts.js";
import type { DiscoveredDocument, DocSeekConfig, SourceConfig } from "../domain/types.js";
import { MarkdownDirectorySource } from "./markdown-directory-source.js";

const sourceFactories: Record<
  SourceConfig["kind"],
  (source: SourceConfig, projectRoot: string) => DocumentSource
> = {
  "markdown-directory": (source, projectRoot) => new MarkdownDirectorySource(source, projectRoot),
};

export function createDocumentSources(
  config: DocSeekConfig,
  projectRoot: string,
): readonly DocumentSource[] {
  return config.sources.map((source) => sourceFactories[source.kind](source, projectRoot));
}

export async function discoverDocuments(
  config: DocSeekConfig,
  projectRoot: string,
): Promise<readonly DiscoveredDocument[]> {
  const sources = createDocumentSources(config, projectRoot);
  const discovered = (await Promise.all(sources.map(async (source) => source.discover()))).flat();
  return discovered.sort((left, right) => {
    const sourceOrder = left.sourceId.localeCompare(right.sourceId);
    return sourceOrder === 0 ? left.documentKey.localeCompare(right.documentKey) : sourceOrder;
  });
}
