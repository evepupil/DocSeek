import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DOCSEEK_IGNORE = "/.docseek/";

export async function ensureDocSeekIgnored(projectRoot: string): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let current = "";

  try {
    current = await readFile(gitignorePath, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const alreadyIgnored = current
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .some((line) => line === DOCSEEK_IGNORE || line === ".docseek/");

  if (alreadyIgnored) {
    return false;
  }

  const separator = current.includes("\r\n") ? "\r\n" : "\n";
  const prefix = current.length > 0 && !current.endsWith("\n") ? separator : "";
  await writeFile(gitignorePath, `${current}${prefix}${DOCSEEK_IGNORE}${separator}`, "utf8");
  return true;
}
