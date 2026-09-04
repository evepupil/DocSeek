import { describe, expect, it } from "vitest";

import type { DiscoveredDocument } from "../../src/domain/types.js";
import {
  INSTRUCTION_END_MARKER,
  INSTRUCTION_START_MARKER,
} from "../../src/instructions/content.js";
import { chunkMarkdown } from "../../src/markdown/chunker.js";
import { parseDocument } from "../../src/markdown/parser.js";

describe("chunkMarkdown", () => {
  it("keeps heading hierarchy and source line ranges", () => {
    const markdown = [
      "# Architecture",
      "",
      "System overview.",
      "",
      "## Engine",
      "",
      "Engine details.",
      "",
      "### Scheduler",
      "",
      "Scale-out considers GPU cold starts.",
      "",
    ].join("\n");

    const chunks = chunkMarkdown(markdown, 1_000);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({
      heading: ["Architecture"],
      startLine: 1,
      endLine: 3,
    });
    expect(chunks[1]).toMatchObject({
      heading: ["Architecture", "Engine"],
      startLine: 5,
      endLine: 7,
    });
    expect(chunks[2]).toMatchObject({
      heading: ["Architecture", "Engine", "Scheduler"],
      startLine: 9,
      endLine: 11,
    });
  });

  it("splits an oversized section at block boundaries", () => {
    const markdown = [
      "# Long section",
      "",
      "A".repeat(120),
      "",
      "B".repeat(120),
      "",
      "C".repeat(120),
    ].join("\n");

    const chunks = chunkMarkdown(markdown, 180);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.heading[0] === "Long section")).toBe(true);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[1]?.startLine).toBeGreaterThan(1);
  });

  it("indexes content before the first heading", () => {
    const [chunk] = chunkMarkdown("Project introduction without a heading.\n", 1_000);
    expect(chunk).toMatchObject({ heading: [], startLine: 1, endLine: 1 });
  });

  it("splits a single oversized line without losing content", () => {
    const chunks = chunkMarkdown(`# Heading\n\n${"x".repeat(500)}\n`, 100);
    const indexedCharacters = chunks.reduce(
      (total, chunk) => total + (chunk.content.match(/x/gu)?.length ?? 0),
      0,
    );

    expect(chunks).toHaveLength(5);
    expect(indexedCharacters).toBe(500);
    expect(chunks.every((chunk) => chunk.endLine === 3)).toBe(true);
  });

  it("excludes managed instructions while preserving later source lines", () => {
    const content = [
      "# Agent rules",
      "",
      INSTRUCTION_START_MARKER,
      "## Documentation lookup with DocSeek",
      "",
      "Search instructions must not be indexed.",
      INSTRUCTION_END_MARKER,
      "",
      "## Project decision",
      "",
      "Keep this project fact searchable.",
    ].join("\n");
    const document: DiscoveredDocument = {
      sourceId: "project",
      documentKey: "project:AGENTS.md",
      locator: "AGENTS.md",
      displayPath: "AGENTS.md",
      absolutePath: "C:/project/AGENTS.md",
      mediaType: "text/markdown",
      content,
      contentHash: "hash",
      modifiedAtMs: 0,
      sizeBytes: content.length,
      tags: [],
    };

    const chunks = parseDocument(document, 1_000);
    const projectChunk = chunks.find((chunk) => chunk.heading.includes("Project decision"));

    expect(chunks.map((chunk) => chunk.content).join("\n")).not.toContain(
      "Search instructions must not be indexed.",
    );
    expect(projectChunk).toMatchObject({ startLine: 9, endLine: 11 });
  });
});
