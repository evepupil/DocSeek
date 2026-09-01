import { createHash } from "node:crypto";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type { Heading, RootContent } from "mdast";

import type { IndexableChunk } from "../domain/types.js";

interface HeadingEntry {
  readonly depth: number;
  readonly text: string;
}

interface Section {
  readonly heading: readonly string[];
  readonly headingNode?: Heading;
  readonly body: readonly RootContent[];
}

interface ChunkSlice {
  readonly startLine: number;
  readonly endLine: number;
  readonly content?: string;
}

function nodeRange(node: RootContent): ChunkSlice | undefined {
  const position = node.position;
  if (!position) {
    return undefined;
  }
  return { startLine: position.start.line, endLine: position.end.line };
}

function sliceLines(lines: readonly string[], range: ChunkSlice): string {
  return lines.slice(range.startLine - 1, range.endLine).join("\n");
}

function splitLineRange(
  lines: readonly string[],
  range: ChunkSlice,
  maxChars: number,
): readonly ChunkSlice[] {
  const slices: ChunkSlice[] = [];
  let currentLines: string[] = [];
  let currentStartLine = range.startLine;

  const flush = (endLine: number): void => {
    if (currentLines.length > 0) {
      slices.push({
        startLine: currentStartLine,
        endLine,
        content: currentLines.join("\n"),
      });
      currentLines = [];
    }
  };

  for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? "";
    if (line.length > maxChars) {
      flush(lineNumber - 1);
      for (let offset = 0; offset < line.length; offset += maxChars) {
        slices.push({
          startLine: lineNumber,
          endLine: lineNumber,
          content: line.slice(offset, offset + maxChars),
        });
      }
      currentStartLine = lineNumber + 1;
      continue;
    }

    const currentLength = currentLines.join("\n").length;
    const nextLength = currentLength + line.length + (currentLines.length > 0 ? 1 : 0);
    if (currentLines.length > 0 && nextLength > maxChars) {
      flush(lineNumber - 1);
      currentStartLine = lineNumber;
    }
    currentLines.push(line);
  }

  flush(range.endLine);
  return slices;
}

function splitSection(
  section: Section,
  lines: readonly string[],
  maxChars: number,
): readonly ChunkSlice[] {
  const blocks = section.body.flatMap((node) => {
    const range = nodeRange(node);
    return range ? [range] : [];
  });

  if (blocks.length === 0) {
    return [];
  }

  const result: ChunkSlice[] = [];
  let group: ChunkSlice | undefined;

  const flush = (): void => {
    if (group) {
      result.push(group);
      group = undefined;
    }
  };

  for (const block of blocks) {
    const blockLength = sliceLines(lines, block).length;
    if (blockLength > maxChars) {
      flush();
      result.push(...splitLineRange(lines, block, maxChars));
      continue;
    }

    if (!group) {
      group = block;
      continue;
    }

    const combined = { startLine: group.startLine, endLine: block.endLine };
    if (sliceLines(lines, combined).length > maxChars) {
      flush();
      group = block;
    } else {
      group = combined;
    }
  }

  flush();

  if (section.headingNode?.position && result[0]) {
    const first = result[0];
    const headingStart = section.headingNode.position.start.line;
    result[0] = {
      startLine: headingStart,
      endLine: first.endLine,
      ...(first.content
        ? {
            content: `${lines.slice(headingStart - 1, section.headingNode.position.end.line).join("\n")}\n${first.content}`,
          }
        : {}),
    };
  }

  return result;
}

function buildSections(children: readonly RootContent[]): readonly Section[] {
  const sections: Section[] = [];
  const headingStack: HeadingEntry[] = [];
  let currentHeading: readonly string[] = [];
  let currentHeadingNode: Heading | undefined;
  let currentBody: RootContent[] = [];

  const flush = (): void => {
    if (currentBody.length > 0) {
      sections.push({
        heading: currentHeading,
        ...(currentHeadingNode ? { headingNode: currentHeadingNode } : {}),
        body: currentBody,
      });
    }
    currentBody = [];
  };

  for (const node of children) {
    if (node.type !== "heading") {
      currentBody.push(node);
      continue;
    }

    flush();
    let lastHeading = headingStack.at(-1);
    while (lastHeading && lastHeading.depth >= node.depth) {
      headingStack.pop();
      lastHeading = headingStack.at(-1);
    }
    const text = toString(node).trim();
    if (text.length > 0) {
      headingStack.push({ depth: node.depth, text });
    }
    currentHeading = headingStack.map((entry) => entry.text);
    currentHeadingNode = node;
  }

  flush();
  return sections;
}

export function chunkMarkdown(content: string, maxChars: number): readonly IndexableChunk[] {
  const root = fromMarkdown(content);
  const lines = content.split(/\r?\n/u);
  const chunks: IndexableChunk[] = [];

  for (const section of buildSections(root.children)) {
    for (const range of splitSection(section, lines, maxChars)) {
      const chunkContent = (range.content ?? sliceLines(lines, range)).trim();
      if (chunkContent.length === 0) {
        continue;
      }
      const hashInput = `${section.heading.join(" > ")}\n${chunkContent}`;
      chunks.push({
        ordinal: chunks.length,
        heading: section.heading,
        startLine: range.startLine,
        endLine: range.endLine,
        content: chunkContent,
        contentHash: createHash("sha256").update(hashInput).digest("hex"),
      });
    }
  }

  return chunks;
}

export function embeddingText(chunk: IndexableChunk): string {
  const heading = chunk.heading.join(" > ");
  return heading.length > 0 ? `${heading}\n\n${chunk.content}` : chunk.content;
}
