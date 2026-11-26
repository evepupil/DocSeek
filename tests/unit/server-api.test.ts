import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { EmbeddingProvider, EmbeddingProviderFactory } from "../../src/domain/contracts.js";
import { INSTRUCTION_START_MARKER } from "../../src/instructions/content.js";
import { createDocSeekRequestHandler } from "../../src/server/api-handlers.js";
import {
  extractFileRange,
  parseQueryTerms,
  parseSearchPayload,
  resolveSafeMarkdownPath,
} from "../../src/server/api-helpers.js";

function vectorFor(text: string): Float32Array {
  const lower = text.toLowerCase();
  if (/hybrid|混合检索|fts5/u.test(lower)) {
    return new Float32Array([1, 0.05, 0.05]);
  }
  if (/tree|紧凑树/u.test(lower)) {
    return new Float32Array([0.05, 1, 0.05]);
  }
  return new Float32Array([0.05, 0.05, 1]);
}

class StubEmbeddingProvider implements EmbeddingProvider {
  readonly fingerprint = "server-test-v1";

  embedDocuments(texts: readonly string[]): Promise<readonly Float32Array[]> {
    return Promise.resolve(texts.map(vectorFor));
  }

  embedQuery(text: string): Promise<Float32Array> {
    return Promise.resolve(vectorFor(text));
  }

  async dispose(): Promise<void> {}
}

const stubProviderFactory: EmbeddingProviderFactory = () => new StubEmbeddingProvider();

describe("server API helpers", () => {
  it("parses quoted and unquoted divergent search terms", () => {
    expect(parseQueryTerms('"混合检索" "cold start" FTS5')).toEqual([
      "混合检索",
      "cold start",
      "FTS5",
    ]);
    expect(parseQueryTerms("  single   term  ")).toEqual(["single", "term"]);
  });

  it("validates search payloads and rejects invalid limits or empty queries", () => {
    const parsed = parseSearchPayload({
      query: '"FTS5" vector',
      top: 10,
      path: "docs/",
      snippet: true,
      explain: true,
    });
    expect(parsed).toEqual({
      query: "FTS5 vector",
      queryParts: ["FTS5", "vector"],
      top: 10,
      path: "docs/",
      includeSnippet: true,
      includeExplanation: true,
    });

    expect(() => parseSearchPayload({ query: "   " })).toThrow();
    expect(() => parseSearchPayload({ query: "fts", top: 101 })).toThrow();
  });

  it("blocks path traversal and non-Markdown file access", () => {
    const root = path.resolve("/tmp/docseek-workspace");
    expect(resolveSafeMarkdownPath(root, "docs/guide.md")).toBe(
      path.join(root, "docs", "guide.md"),
    );
    expect(resolveSafeMarkdownPath(root, "../secret.md")).toBeUndefined();
    expect(resolveSafeMarkdownPath(root, "package.json")).toBeUndefined();
    expect(resolveSafeMarkdownPath(root, "/etc/passwd")).toBeUndefined();
  });

  it("extracts highlighted line windows cleanly", () => {
    const content = ["line 1", "line 2", "line 3", "line 4", "line 5"].join("\n");
    const range = extractFileRange(content, 2, 3, 1);
    expect(range.totalLines).toBe(5);
    expect(range.windowStart).toBe(1);
    expect(range.windowEnd).toBe(4);
    expect(range.lines.map((line) => [line.lineNumber, line.highlighted])).toEqual([
      [1, false],
      [2, true],
      [3, true],
      [4, false],
    ]);
  });
});

describe("DocSeek HTTP server", () => {
  const tempDirs: string[] = [];
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => {
              resolve();
            });
          }),
      ),
    );
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  async function startTestServer(): Promise<{ baseUrl: string; rootDir: string }> {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "docseek-server-"));
    tempDirs.push(rootDir);
    await mkdir(path.join(rootDir, ".git"));
    await mkdir(path.join(rootDir, "docs"), { recursive: true });
    await writeFile(
      path.join(rootDir, "docs", "hybrid.md"),
      [
        "# Hybrid Retrieval",
        "",
        "## FTS5 Fusion",
        "",
        "DocSeek combines vector similarity and SQLite FTS5 hybrid retrieval.",
        "",
      ].join("\n"),
    );

    const handler = createDocSeekRequestHandler({
      rootDir,
      createEmbeddingProvider: stubProviderFactory,
    });
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    servers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const address = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${address.port}`, rootDir };
  }

  it("serves UI, health, status, init, search, file inspection, and instructions", async () => {
    const { baseUrl } = await startTestServer();

    const homeResponse = await fetch(`${baseUrl}/`);
    expect(homeResponse.status).toBe(200);
    const homeHtml = await homeResponse.text();
    expect(homeHtml).toContain("DocSeek");

    const health = (await (await fetch(`${baseUrl}/api/health`)).json()) as { ok: boolean };
    expect(health.ok).toBe(true);

    const beforeStatus = (await (await fetch(`${baseUrl}/api/status`)).json()) as {
      initialized: boolean;
      discoveredDocuments: number;
    };
    expect(beforeStatus.initialized).toBe(false);
    expect(beforeStatus.discoveredDocuments).toBe(1);

    const preInitSearch = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "FTS5" }),
    });
    expect(preInitSearch.status).toBe(409);

    const initResponse = await fetch(`${baseUrl}/api/init`, { method: "POST" });
    expect(initResponse.status).toBe(200);
    const initPayload = (await initResponse.json()) as {
      result: { documents: number; chunks: number };
      status: { initialized: boolean };
    };
    expect(initPayload.result.documents).toBe(1);
    expect(initPayload.status.initialized).toBe(true);

    const searchResponse = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: '"FTS5" hybrid', snippet: true, explain: true }),
    });
    expect(searchResponse.status).toBe(200);
    const searchPayload = (await searchResponse.json()) as {
      results: { path: string; startLine: number; endLine: number }[];
      treeText: string;
      jsonText: string;
    };
    expect(searchPayload.results[0]?.path).toBe("docs/hybrid.md");
    expect(searchPayload.treeText).toContain("hybrid.md");
    expect(searchPayload.jsonText).toContain('"docs/hybrid.md"');

    const fileResponse = await fetch(
      `${baseUrl}/api/file?path=docs/hybrid.md&start=3&end=5`,
    );
    expect(fileResponse.status).toBe(200);
    const filePayload = (await fileResponse.json()) as {
      path: string;
      lines: { lineNumber: number; highlighted: boolean }[];
    };
    expect(filePayload.path).toBe("docs/hybrid.md");
    expect(filePayload.lines.some((line) => line.lineNumber === 5 && line.highlighted)).toBe(true);

    const blockedResponse = await fetch(`${baseUrl}/api/file?path=../package.json`);
    expect(blockedResponse.status).toBe(400);

    const instructionsPayload = (await (await fetch(`${baseUrl}/api/instructions`)).json()) as {
      block: string;
    };
    expect(instructionsPayload.block).toContain(INSTRUCTION_START_MARKER);
  });
});
