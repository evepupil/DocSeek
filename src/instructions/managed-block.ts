import {
  INSTRUCTION_END_MARKER,
  INSTRUCTION_START_MARKER,
  renderInstructionBlock,
} from "./content.js";

export type MergeAction = "append" | "replace" | "unchanged" | "invalid";

export interface MergeResult {
  readonly action: MergeAction;
  readonly content: string;
  readonly reason?: string;
}

function occurrenceOffsets(content: string, marker: string): readonly number[] {
  const offsets: number[] = [];
  let offset = content.indexOf(marker);
  while (offset >= 0) {
    offsets.push(offset);
    offset = content.indexOf(marker, offset + marker.length);
  }
  return offsets;
}

function newlineFor(content: string): "\r\n" | "\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function appendSeparator(content: string, newline: string): string {
  const withoutBom = content.startsWith("\uFEFF") ? content.slice(1) : content;
  if (withoutBom.length === 0 || /(?:\r\n|\n){2}$/u.test(withoutBom)) {
    return "";
  }
  return /(?:\r\n|\n)$/u.test(withoutBom) ? newline : `${newline}${newline}`;
}

function managedRange(
  content: string,
): { readonly start: number; readonly end: number } | undefined {
  const starts = occurrenceOffsets(content, INSTRUCTION_START_MARKER);
  const ends = occurrenceOffsets(content, INSTRUCTION_END_MARKER);
  if (starts.length !== 1 || ends.length !== 1) {
    return undefined;
  }
  const start = starts[0];
  const endMarker = ends[0];
  if (start === undefined || endMarker === undefined || start >= endMarker) {
    return undefined;
  }
  return { start, end: endMarker + INSTRUCTION_END_MARKER.length };
}

export function mergeInstructionBlock(content: string): MergeResult {
  const starts = occurrenceOffsets(content, INSTRUCTION_START_MARKER);
  const ends = occurrenceOffsets(content, INSTRUCTION_END_MARKER);
  const newline = newlineFor(content);
  const block = renderInstructionBlock(newline);

  if (starts.length === 0 && ends.length === 0) {
    return {
      action: "append",
      content: `${content}${appendSeparator(content, newline)}${block}${newline}`,
    };
  }

  const range = managedRange(content);
  if (!range) {
    return {
      action: "invalid",
      content,
      reason: "DocSeek instruction markers are incomplete, reversed, or duplicated",
    };
  }

  const updated = `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;
  return updated === content
    ? { action: "unchanged", content }
    : { action: "replace", content: updated };
}

export function maskInstructionBlock(content: string): string {
  const range = managedRange(content);
  if (!range) {
    return content;
  }
  const masked = content.slice(range.start, range.end).replace(/[^\r\n]/gu, " ");
  return `${content.slice(0, range.start)}${masked}${content.slice(range.end)}`;
}
