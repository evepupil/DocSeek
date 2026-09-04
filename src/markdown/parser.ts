import type { DocumentParser } from "../domain/contracts.js";
import type { DiscoveredDocument, DocumentMediaType, IndexableChunk } from "../domain/types.js";
import { maskInstructionBlock } from "../instructions/managed-block.js";
import { chunkMarkdown } from "./chunker.js";

class MarkdownDocumentParser implements DocumentParser {
  parse(document: DiscoveredDocument, maxChars: number): readonly IndexableChunk[] {
    return chunkMarkdown(maskInstructionBlock(document.content), maxChars);
  }
}

const parsers: Record<DocumentMediaType, DocumentParser> = {
  "text/markdown": new MarkdownDocumentParser(),
};

export function parseDocument(
  document: DiscoveredDocument,
  maxChars: number,
): readonly IndexableChunk[] {
  return parsers[document.mediaType].parse(document, maxChars);
}
