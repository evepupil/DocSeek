import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import fg from "fast-glob";

import type { DocumentSource } from "../domain/contracts.js";
import type { DiscoveredDocument, SourceConfig } from "../domain/types.js";
import { isPathInside, toPosixPath } from "../project/paths.js";

export class MarkdownDirectorySource implements DocumentSource {
  readonly id: string;
  readonly #config: SourceConfig;
  readonly #projectRoot: string;
  readonly #sourceRoot: string;

  constructor(config: SourceConfig, projectRoot: string) {
    this.id = config.id;
    this.#config = config;
    this.#projectRoot = projectRoot;
    this.#sourceRoot = path.resolve(projectRoot, config.path);
  }

  async discover(): Promise<readonly DiscoveredDocument[]> {
    const matches = await fg([...this.#config.include], {
      absolute: true,
      cwd: this.#sourceRoot,
      dot: true,
      followSymbolicLinks: false,
      ignore: [...this.#config.exclude],
      onlyFiles: true,
      unique: true,
    });

    const documents = await Promise.all(
      matches
        .sort((left, right) => left.localeCompare(right))
        .map(async (absolutePath) => {
          const [content, fileStat] = await Promise.all([
            readFile(absolutePath, "utf8"),
            stat(absolutePath),
          ]);
          const documentKey = toPosixPath(path.relative(this.#sourceRoot, absolutePath));
          const projectRelativePath = toPosixPath(path.relative(this.#projectRoot, absolutePath));
          const displayPath = isPathInside(this.#projectRoot, absolutePath)
            ? projectRelativePath
            : `${this.id}/${documentKey}`;

          return {
            sourceId: this.id,
            documentKey,
            locator: pathToFileURL(absolutePath).href,
            displayPath,
            absolutePath,
            mediaType: "text/markdown",
            content,
            contentHash: createHash("sha256").update(content).digest("hex"),
            modifiedAtMs: fileStat.mtimeMs,
            sizeBytes: fileStat.size,
            tags: [],
          } satisfies DiscoveredDocument;
        }),
    );

    return documents;
  }
}
