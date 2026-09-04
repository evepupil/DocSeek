import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { mergeInstructionBlock } from "./managed-block.js";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export type InstructionInstallStatus = "created" | "updated" | "unchanged" | "skipped";

export interface InstructionTarget {
  readonly id: "codex" | "claude";
  readonly label: string;
  readonly filePath: string;
}

export interface InstructionInstallResult extends InstructionTarget {
  readonly status: InstructionInstallStatus;
  readonly reason?: string;
}

export interface InstructionTargetOptions {
  readonly homeDir?: string;
  readonly environment?: NodeJS.ProcessEnv;
}

function configuredDirectory(value: string | undefined, fallback: string, homeDir: string): string {
  const configured = value?.trim();
  if (!configured) {
    return fallback;
  }
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(homeDir, configured);
}

export function resolveGlobalInstructionTargets(
  options: InstructionTargetOptions = {},
): readonly InstructionTarget[] {
  const homeDir = options.homeDir ?? os.homedir();
  const environment = options.environment ?? process.env;
  const codexHome = configuredDirectory(
    environment["CODEX_HOME"],
    path.join(homeDir, ".codex"),
    homeDir,
  );
  const claudeHome = configuredDirectory(
    environment["CLAUDE_CONFIG_DIR"],
    path.join(homeDir, ".claude"),
    homeDir,
  );
  return [
    { id: "codex", label: "Codex", filePath: path.join(codexHome, "AGENTS.md") },
    { id: "claude", label: "Claude", filePath: path.join(claudeHome, "CLAUDE.md") },
  ];
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function sanitizedFileError(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return `filesystem error (${error.code})`;
  }
  return "filesystem error";
}

function decodeUtf8(
  bytes: Buffer,
): { readonly content: string; readonly bom: boolean } | undefined {
  const bom = bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM);
  try {
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(
        bom ? bytes.subarray(UTF8_BOM.length) : bytes,
      ),
      bom,
    };
  } catch {
    return undefined;
  }
}

function encodeUtf8(content: string, bom: boolean): Buffer {
  const encoded = Buffer.from(content, "utf8");
  return bom ? Buffer.concat([UTF8_BOM, encoded]) : encoded;
}

async function installTarget(target: InstructionTarget): Promise<InstructionInstallResult> {
  let exists = true;
  try {
    const stats = await lstat(target.filePath);
    if (stats.isSymbolicLink()) {
      return { ...target, status: "skipped", reason: "target is a symbolic link" };
    }
    if (!stats.isFile()) {
      return { ...target, status: "skipped", reason: "target is not a regular file" };
    }
  } catch (error) {
    if (isMissing(error)) {
      exists = false;
    } else {
      return { ...target, status: "skipped", reason: sanitizedFileError(error) };
    }
  }

  let content = "";
  let bom = false;
  if (exists) {
    try {
      const decoded = decodeUtf8(await readFile(target.filePath));
      if (!decoded) {
        return { ...target, status: "skipped", reason: "target is not valid UTF-8" };
      }
      content = decoded.content;
      bom = decoded.bom;
    } catch (error) {
      return { ...target, status: "skipped", reason: sanitizedFileError(error) };
    }
  }

  const merged = mergeInstructionBlock(content);
  if (merged.action === "invalid") {
    return { ...target, status: "skipped", reason: merged.reason ?? "invalid markers" };
  }
  if (merged.action === "unchanged") {
    return { ...target, status: "unchanged" };
  }

  try {
    await mkdir(path.dirname(target.filePath), { recursive: true });
    await writeFile(target.filePath, encodeUtf8(merged.content, bom));
    return { ...target, status: exists ? "updated" : "created" };
  } catch (error) {
    return { ...target, status: "skipped", reason: sanitizedFileError(error) };
  }
}

export async function installGlobalInstructions(
  targets: readonly InstructionTarget[] = resolveGlobalInstructionTargets(),
): Promise<readonly InstructionInstallResult[]> {
  const results: InstructionInstallResult[] = [];
  for (const target of targets) {
    results.push(await installTarget(target));
  }
  return results;
}

export function formatInstructionInstallResult(result: InstructionInstallResult): string {
  const reason = result.reason ? `: ${result.reason}` : "";
  return `${result.label}: ${result.status} ${result.filePath}${reason}`;
}
