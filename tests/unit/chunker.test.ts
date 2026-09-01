import { describe, expect, it } from "vitest";

import { chunkMarkdown } from "../../src/markdown/chunker.js";

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
});
