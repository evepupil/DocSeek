import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  INSTRUCTION_END_MARKER,
  INSTRUCTION_START_MARKER,
  renderInstructionBlock,
} from "../../src/instructions/content.js";
import {
  installGlobalInstructions,
  resolveGlobalInstructionTargets,
} from "../../src/instructions/global-installer.js";
import {
  maskInstructionBlock,
  mergeInstructionBlock,
} from "../../src/instructions/managed-block.js";

describe("managed DocSeek instructions", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
    );
  });

  async function temporaryHome(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "docseek-instructions-"));
    temporaryDirectories.push(directory);
    return directory;
  }

  it("resolves Codex and Claude configuration directory overrides", async () => {
    const homeDir = await temporaryHome();
    const targets = resolveGlobalInstructionTargets({
      homeDir,
      environment: {
        CODEX_HOME: "custom-codex",
        CLAUDE_CONFIG_DIR: path.join(homeDir, "custom-claude"),
      },
    });

    expect(targets.map((target) => target.filePath)).toEqual([
      path.join(homeDir, "custom-codex", "AGENTS.md"),
      path.join(homeDir, "custom-claude", "CLAUDE.md"),
    ]);
  });

  it("appends once and replaces one complete managed block", () => {
    const existing = "# Existing rules\n\nKeep this line.\n";
    const appended = mergeInstructionBlock(existing);

    expect(appended.action).toBe("append");
    expect(appended.content.startsWith(existing)).toBe(true);
    expect(appended.content.match(/DOCSEEK:INSTRUCTIONS:START/gu)).toHaveLength(1);

    const stale = appended.content.replace(
      "## Documentation lookup with DocSeek",
      "## Old DocSeek rules",
    );
    const replaced = mergeInstructionBlock(stale);
    expect(replaced.action).toBe("replace");
    expect(replaced.content).toContain("Keep this line.");
    expect(replaced.content).toContain("## Documentation lookup with DocSeek");
    expect(replaced.content).not.toContain("Old DocSeek rules");
    expect(mergeInstructionBlock(replaced.content).action).toBe("unchanged");
  });

  it.each([
    INSTRUCTION_START_MARKER,
    INSTRUCTION_END_MARKER,
    `${INSTRUCTION_END_MARKER}\n${INSTRUCTION_START_MARKER}`,
    `${INSTRUCTION_START_MARKER}\n${INSTRUCTION_START_MARKER}\n${INSTRUCTION_END_MARKER}`,
  ])("rejects malformed markers without changing content", (content) => {
    expect(mergeInstructionBlock(content)).toEqual({
      action: "invalid",
      content,
      reason: "DocSeek instruction markers are incomplete, reversed, or duplicated",
    });
  });

  it("preserves BOM and CRLF while installing over an old block", async () => {
    const homeDir = await temporaryHome();
    const [codex] = resolveGlobalInstructionTargets({ homeDir, environment: {} });
    if (!codex) {
      throw new Error("Codex target was not resolved.");
    }
    await mkdir(path.dirname(codex.filePath), { recursive: true });
    const original = `\uFEFF# Existing\r\n\r\n${INSTRUCTION_START_MARKER}\r\nold\r\n${INSTRUCTION_END_MARKER}\r\n\r\nTail\r\n`;
    await writeFile(codex.filePath, original, "utf8");

    const [result] = await installGlobalInstructions([codex]);
    const installed = await readFile(codex.filePath, "utf8");

    expect(result?.status).toBe("updated");
    expect(installed.startsWith("\uFEFF# Existing\r\n")).toBe(true);
    expect(installed).toContain(renderInstructionBlock("\r\n"));
    expect(installed).toContain("\r\n\r\nTail\r\n");
    expect(installed).not.toContain("\r\nold\r\n");
  });

  it("creates both default targets and stays unchanged on the second run", async () => {
    const homeDir = await temporaryHome();
    const targets = resolveGlobalInstructionTargets({ homeDir, environment: {} });

    const created = await installGlobalInstructions(targets);
    const unchanged = await installGlobalInstructions(targets);

    expect(created.map((result) => result.status)).toEqual(["created", "created"]);
    expect(unchanged.map((result) => result.status)).toEqual(["unchanged", "unchanged"]);
    await expect(readFile(path.join(homeDir, ".codex", "AGENTS.md"), "utf8")).resolves.toBe(
      `${renderInstructionBlock()}\n`,
    );
    await expect(readFile(path.join(homeDir, ".claude", "CLAUDE.md"), "utf8")).resolves.toBe(
      `${renderInstructionBlock()}\n`,
    );
  });

  it("continues with Claude when the Codex target is unsafe", async () => {
    const homeDir = await temporaryHome();
    const targets = resolveGlobalInstructionTargets({ homeDir, environment: {} });
    const codex = targets[0];
    if (!codex) {
      throw new Error("Codex target was not resolved.");
    }
    await mkdir(codex.filePath, { recursive: true });

    const results = await installGlobalInstructions(targets);

    expect(results.map((result) => result.status)).toEqual(["skipped", "created"]);
    expect(results[0]?.reason).toBe("target is not a regular file");
  });

  it("refuses a symbolic-link target while continuing other targets", async () => {
    const homeDir = await temporaryHome();
    const targets = resolveGlobalInstructionTargets({ homeDir, environment: {} });
    const codex = targets[0];
    if (!codex) {
      throw new Error("Codex target was not resolved.");
    }
    const linkedDirectory = path.join(homeDir, "linked-rules");
    await mkdir(linkedDirectory);
    await mkdir(path.dirname(codex.filePath), { recursive: true });
    await symlink(linkedDirectory, codex.filePath, "junction");

    const results = await installGlobalInstructions(targets);

    expect(results.map((result) => result.status)).toEqual(["skipped", "created"]);
    expect(results[0]?.reason).toBe("target is a symbolic link");
  });

  it("masks a valid managed block without changing line positions", () => {
    const content = [
      "# Rules",
      "",
      INSTRUCTION_START_MARKER,
      "## Documentation lookup with DocSeek",
      "secret search instructions",
      INSTRUCTION_END_MARKER,
      "",
      "## Project decision",
      "",
      "Keep this searchable.",
    ].join("\n");

    const masked = maskInstructionBlock(content);

    expect(masked.length).toBe(content.length);
    expect(masked.split("\n")).toHaveLength(content.split("\n").length);
    expect(masked).not.toContain("secret search instructions");
    expect(masked).toContain("## Project decision\n\nKeep this searchable.");
  });

  it("keeps malformed blocks visible rather than masking unrelated content", () => {
    const content = `${INSTRUCTION_START_MARKER}\nKeep visible.`;
    expect(maskInstructionBlock(content)).toBe(content);
  });
});
