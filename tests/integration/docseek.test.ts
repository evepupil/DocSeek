import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { EmbeddingProvider, EmbeddingProviderFactory } from "../../src/domain/contracts.js";
import { initializeProject } from "../../src/application/init-project.js";
import { updateProject } from "../../src/application/update-project.js";
import { getStatus } from "../../src/application/get-status.js";
import { searchDocs } from "../../src/application/search-docs.js";
import { runCli } from "../../src/cli/create-cli.js";
import { writeConfig } from "../../src/config/config-file.js";
import { createDefaultConfig } from "../../src/config/schema.js";

class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly fingerprint = "test-embedding-v1";

  embedDocuments(texts: readonly string[]): Promise<readonly Float32Array[]> {
    return Promise.resolve(texts.map(vectorFor));
  }

  embedQuery(text: string): Promise<Float32Array> {
    return Promise.resolve(vectorFor(text));
  }

  async dispose(): Promise<void> {}
}

const createProvider: EmbeddingProviderFactory = () => new DeterministicEmbeddingProvider();

function vectorFor(text: string): Float32Array {
  const lower = text.toLowerCase();
  if (/冷启动|启动延迟|cold start|startup delay/u.test(lower)) {
    return new Float32Array([1, 0.05, 0.05]);
  }
  if (/lifecycle|生命周期/u.test(lower)) {
    return new Float32Array([0.05, 1, 0.05]);
  }
  return new Float32Array([0.05, 0.05, 1]);
}

describe("DocSeek integration", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map(async (directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function createProject(): Promise<string> {
    const project = await mkdtemp(path.join(os.tmpdir(), "docseek-test-"));
    temporaryDirectories.push(project);
    await mkdir(path.join(project, ".git"));
    await mkdir(path.join(project, "docs", "architecture"), { recursive: true });
    await mkdir(path.join(project, "docs", "design"), { recursive: true });
    await writeFile(
      path.join(project, "docs", "architecture", "engine.md"),
      [
        "# Architecture",
        "",
        "## Engine",
        "",
        "### Scheduler",
        "",
        "Worker 扩容需要考虑 GPU 冷启动时间。专用标识 GPU-WARMUP-42。",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(project, "docs", "design", "worker.md"),
      ["# Worker", "", "## Lifecycle", "", "Worker 生命周期包含启动和退出。", ""].join("\n"),
    );
    return project;
  }

  it("initializes, searches, reports status, and updates incrementally", async () => {
    const project = await createProject();
    const initialized = await initializeProject(project, createProvider);

    expect(initialized).toMatchObject({ documents: 2, added: 2, modified: 0, deleted: 0 });
    expect(initialized.chunks).toBe(2);
    expect(await readFile(path.join(project, ".gitignore"), "utf8")).toContain("/.docseek/");

    const semantic = await searchDocs(
      project,
      { query: "worker 扩容为什么有启动延迟", top: 3, includeSnippet: false },
      createProvider,
    );
    expect(semantic[0]).toMatchObject({
      path: "docs/architecture/engine.md",
      heading: ["Architecture", "Engine", "Scheduler"],
      startLine: 5,
      endLine: 7,
    });

    const keyword = await searchDocs(
      project,
      { query: "GPU-WARMUP-42", top: 3, includeSnippet: true },
      createProvider,
    );
    expect(keyword[0]?.path).toBe("docs/architecture/engine.md");
    expect(keyword[0]?.snippet).toContain("GPU-WARMUP-42");

    const filtered = await searchDocs(
      project,
      {
        query: "启动",
        top: 3,
        path: "design/",
        includeSnippet: false,
      },
      createProvider,
    );
    expect(filtered.map((result) => result.path)).toEqual(["docs/design/worker.md"]);

    await writeFile(
      path.join(project, "docs", "design", "worker.md"),
      "# Worker\n\n## Lifecycle\n\nWorker 生命周期已经更新。\n",
    );
    await rm(path.join(project, "docs", "architecture", "engine.md"));
    await writeFile(path.join(project, "docs", "new.md"), "# New document\n\nFresh content.\n");

    const pending = await getStatus(project);
    expect(pending).toMatchObject({ added: 1, modified: 1, deleted: 1, unchanged: 0 });

    const updated = await updateProject(project, createProvider);
    expect(updated).toMatchObject({ added: 1, modified: 1, deleted: 1, documents: 2 });
    const settled = await getStatus(project);
    expect(settled).toMatchObject({ added: 0, modified: 0, deleted: 0, unchanged: 2 });
  });

  it("provides stable machine-readable CLI output", async () => {
    const project = await createProject();
    await initializeProject(project, createProvider);
    let standardOutput = "";
    let standardError = "";

    const exitCode = await runCli(["search", "cold start", "--json", "--top", "1"], {
      cwd: () => project,
      writeOut: (value) => {
        standardOutput += value;
      },
      writeError: (value) => {
        standardError += value;
      },
      createEmbeddingProvider: createProvider,
    });

    expect(exitCode).toBe(0);
    expect(standardError).toBe("");
    expect(JSON.parse(standardOutput)).toEqual({
      results: [
        expect.objectContaining({
          path: "docs/architecture/engine.md",
          start_line: 5,
          end_line: 7,
        }),
      ],
    });

    standardOutput = "";
    const explainedExitCode = await runCli(
      ["search", "cold start", "--json", "--top", "1", "--explain"],
      {
        cwd: () => project,
        writeOut: (value) => {
          standardOutput += value;
        },
        writeError: (value) => {
          standardError += value;
        },
        createEmbeddingProvider: createProvider,
      },
    );
    const explainedJson: unknown = JSON.parse(standardOutput);
    const explained = z
      .object({
        results: z.array(
          z.object({
            explanation: z.object({
              semantic_strength: z.number(),
              confidence: z.number(),
            }),
          }),
        ),
        diagnostics: z.object({
          query_terms: z.array(z.string()),
          timings_ms: z.record(z.string(), z.number()),
        }),
      })
      .parse(explainedJson);
    expect(explainedExitCode).toBe(0);
    expect(explained.results).toHaveLength(1);
    expect(explained.results[0]?.explanation.confidence).toBeGreaterThan(0);
    expect(explained.diagnostics.query_terms.length).toBeGreaterThan(0);
    expect(explained.diagnostics.timings_ms["total"]).toBeTypeOf("number");
  });

  it("returns no locations for an unsupported query", async () => {
    const project = await createProject();
    await initializeProject(project, createProvider);

    const results = await searchDocs(
      project,
      { query: "zxqv-9999 量子香蕉协议", top: 5, includeSnippet: false },
      createProvider,
    );

    expect(results).toEqual([]);
  });

  it("indexes multiple sources and applies source tags without changing the pipeline", async () => {
    const project = await createProject();
    await mkdir(path.join(project, "external"));
    await writeFile(
      path.join(project, "external", "memory.md"),
      "# Project memory\n\nCross-project decision marker.\n",
    );

    const base = createDefaultConfig();
    const defaultSource = base.sources[0];
    if (!defaultSource) {
      throw new Error("Default config did not create a project source.");
    }
    const projectSource = {
      ...defaultSource,
      path: "docs",
    };
    const config = {
      ...base,
      sources: [
        projectSource,
        {
          id: "memory",
          kind: "markdown-directory" as const,
          path: "external",
          include: ["**/*.md"],
          exclude: [],
          tags: ["memory"],
        },
      ],
    };
    await writeConfig(project, config);

    const initialized = await initializeProject(project, createProvider);
    expect(initialized.documents).toBe(3);

    const tagged = await searchDocs(
      project,
      {
        query: "Cross-project decision marker",
        top: 5,
        includeSnippet: false,
        tags: ["memory"],
      },
      createProvider,
    );
    expect(tagged.map((result) => result.path)).toEqual(["external/memory.md"]);

    const memorySource = config.sources[1];
    if (!memorySource) {
      throw new Error("Test config did not create the memory source.");
    }
    const retaggedConfig = {
      ...config,
      sources: [projectSource, { ...memorySource, tags: ["archive"] }],
    };
    await writeConfig(project, retaggedConfig);
    const retagged = await updateProject(project, createProvider);
    expect(retagged).toMatchObject({ modified: 0, unchanged: 3 });
    const oldTag = await searchDocs(
      project,
      {
        query: "Cross-project decision marker",
        top: 5,
        includeSnippet: false,
        tags: ["memory"],
      },
      createProvider,
    );
    expect(oldTag).toEqual([]);
    const newTag = await searchDocs(
      project,
      {
        query: "Cross-project decision marker",
        top: 5,
        includeSnippet: false,
        tags: ["archive"],
      },
      createProvider,
    );
    expect(newTag.map((result) => result.path)).toEqual(["external/memory.md"]);

    await writeConfig(project, { ...config, sources: [projectSource] });
    const updated = await updateProject(project, createProvider);
    expect(updated).toMatchObject({ deleted: 1, documents: 2 });
  });
});
