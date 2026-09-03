import { describe, expect, it } from "vitest";

import type { SearchResult } from "../../src/domain/types.js";
import { formatSearchTree } from "../../src/cli/search-tree.js";

function result(
  path: string,
  heading: readonly string[],
  startLine: number,
  endLine: number,
  score: number,
): SearchResult {
  return { path, heading, startLine, endLine, score };
}

describe("formatSearchTree", () => {
  it("groups common paths, files, headings, and line ranges", () => {
    const results = [
      result("docs/mod/a.md", ["A", "3. Sim", "3.4 X"], 10, 12, 0.8),
      result("docs/mod/a.md", ["A", "3. Sim", "3.2 Y"], 20, 20, 0.6),
      result("docs/mod/b.md", ["B", "Overview"], 5, 6, 0.7),
    ];

    expect(formatSearchTree(results)).toBe(
      [
        "docs/mod/",
        "├─ a.md › 3. Sim ×2 .700",
        "│  ├─ 3.4 X L10-12 .800",
        "│  └─ 3.2 Y L20 .600",
        "└─ b.md › Overview L5-6 .700",
        "",
      ].join("\n"),
    );
  });

  it("uses a virtual root and stays stable when input order changes", () => {
    const results = [
      result("README.md", ["README"], 1, 3, 0.8),
      result("docs/a.md", ["A", "Details"], 4, 8, 0.9),
    ];

    expect(formatSearchTree(results)).toBe(formatSearchTree([...results].reverse()));
    expect(formatSearchTree(results).startsWith("./\n")).toBe(true);
  });

  it("collapses single-result paths and orders branches by their best match", () => {
    const results = [
      result("docs/average.md", ["Average", "Many"], 1, 2, 0.7),
      result("docs/average.md", ["Average", "Many"], 3, 4, 0.7),
      result("docs/peak.md", ["Peak", "Deep", "Answer"], 10, 12, 0.9),
      result("docs/peak.md", ["Peak", "Other"], 20, 22, 0.3),
      result("docs/only/one.md", ["One", "Nested", "Leaf"], 30, 30, 0.6),
    ];

    expect(formatSearchTree(results)).toBe(
      [
        "docs/",
        "├─ peak.md ×2 .600",
        "│  ├─ Deep › Answer L10-12 .900",
        "│  └─ Other L20-22 .300",
        "├─ average.md › Many ×2 .700",
        "│  ├─ L1-2 .700",
        "│  └─ L3-4 .700",
        "└─ only/one.md › Nested › Leaf L30 .600",
        "",
      ].join("\n"),
    );
  });

  it("keeps the empty result message compact", () => {
    expect(formatSearchTree([])).toBe("No matching documentation found.\n");
  });
});
