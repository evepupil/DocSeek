import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { DOCSEEK_VERSION } from "../../src/version.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const packageSchema = z.object({
  version: z.string(),
  bin: z.object({
    docseek: z.string(),
  }),
  files: z.array(z.string()),
  scripts: z.object({
    postinstall: z.string(),
  }),
});

describe("npm package manifest", () => {
  it("keeps an npm-compatible executable entry", async () => {
    const packageJson: unknown = JSON.parse(
      await readFile(path.join(projectRoot, "package.json"), "utf8"),
    );
    const manifest = packageSchema.parse(packageJson);
    const sourceEntry = await readFile(path.join(projectRoot, "src/index.ts"), "utf8");
    const postinstall = await readFile(
      path.join(projectRoot, "scripts", "postinstall.mjs"),
      "utf8",
    );

    expect(manifest.version).toBe(DOCSEEK_VERSION);
    expect(manifest.bin.docseek).toBe("dist/index.js");
    expect(manifest.files).toContain("dist/instructions");
    expect(manifest.files).toContain("dist/version.*");
    expect(manifest.files).toContain("scripts/postinstall.mjs");
    expect(manifest.scripts.postinstall).toBe("node scripts/postinstall.mjs");
    expect(sourceEntry.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(postinstall).toContain('process.env.npm_config_global === "true"');
  });
});
