import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const packageSchema = z.object({
  bin: z.object({
    docseek: z.string(),
  }),
});

describe("npm package manifest", () => {
  it("keeps an npm-compatible executable entry", async () => {
    const packageJson: unknown = JSON.parse(
      await readFile(path.join(projectRoot, "package.json"), "utf8"),
    );
    const manifest = packageSchema.parse(packageJson);
    const sourceEntry = await readFile(path.join(projectRoot, "src/index.ts"), "utf8");

    expect(manifest.bin.docseek).toBe("dist/index.js");
    expect(sourceEntry.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
