import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse, stringify } from "smol-toml";

import { DocSeekError, errorMessage } from "../domain/errors.js";
import type { DocSeekConfig, ProjectContext } from "../domain/types.js";
import { fromRawConfig, rawConfigSchema, toRawConfig } from "./schema.js";

export function projectPaths(rootDir: string): Omit<ProjectContext, "config"> {
  const docseekDir = path.join(rootDir, ".docseek");
  return {
    rootDir,
    docseekDir,
    configPath: path.join(docseekDir, "config.toml"),
    indexPath: path.join(docseekDir, "index.db"),
  };
}

export async function readConfig(rootDir: string): Promise<DocSeekConfig> {
  const { configPath } = projectPaths(rootDir);
  try {
    const text = await readFile(configPath, "utf8");
    const parsed = rawConfigSchema.safeParse(parse(text));
    if (!parsed.success) {
      throw new DocSeekError(
        "INVALID_CONFIG",
        `Invalid ${path.relative(rootDir, configPath)}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      );
    }
    return fromRawConfig(parsed.data);
  } catch (error) {
    if (error instanceof DocSeekError) {
      throw error;
    }
    throw new DocSeekError(
      "CONFIG_READ_FAILED",
      `Could not read DocSeek config: ${errorMessage(error)}`,
      {
        cause: error,
      },
    );
  }
}

export async function writeConfig(rootDir: string, config: DocSeekConfig): Promise<void> {
  const { docseekDir, configPath } = projectPaths(rootDir);
  await mkdir(docseekDir, { recursive: true });
  const temporaryPath = `${configPath}.tmp`;
  const backupPath = `${configPath}.previous`;
  const contents = `# Local DocSeek configuration. This directory is ignored by Git.\n${stringify(toRawConfig(config))}`;
  await writeFile(temporaryPath, contents, "utf8");
  await rm(backupPath, { force: true });

  const hadPrevious = await access(configPath).then(
    () => true,
    () => false,
  );

  if (hadPrevious) {
    await rename(configPath, backupPath);
  }

  try {
    await rename(temporaryPath, configPath);
    await rm(backupPath, { force: true });
  } catch (error) {
    if (hadPrevious) {
      await rename(backupPath, configPath);
    }
    throw error;
  }
}

export async function loadProjectContext(rootDir: string): Promise<ProjectContext> {
  return { ...projectPaths(rootDir), config: await readConfig(rootDir) };
}
