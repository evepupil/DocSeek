import { access } from "node:fs/promises";
import path from "node:path";

import { DocSeekError } from "../domain/errors.js";
import type { ProjectLocation } from "../domain/types.js";

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findUp(startDir: string, marker: string): Promise<string | undefined> {
  const current = path.resolve(startDir);
  if (await exists(path.join(current, marker))) {
    return current;
  }

  const parent = path.dirname(current);
  return parent === current ? undefined : findUp(parent, marker);
}

export async function locateProjectForInit(startDir: string): Promise<ProjectLocation> {
  const initialized = await findUp(startDir, path.join(".docseek", "config.toml"));
  if (initialized) {
    return { rootDir: initialized, usedGitFallback: false };
  }

  const gitRoot = await findUp(startDir, ".git");
  if (gitRoot) {
    return { rootDir: gitRoot, usedGitFallback: false };
  }

  return { rootDir: path.resolve(startDir), usedGitFallback: true };
}

export async function locateInitializedProject(startDir: string): Promise<string> {
  const initialized = await findUp(startDir, path.join(".docseek", "config.toml"));
  if (!initialized) {
    throw new DocSeekError(
      "PROJECT_NOT_INITIALIZED",
      "No DocSeek index found. Run `docseek init` from the project first.",
    );
  }
  return initialized;
}
