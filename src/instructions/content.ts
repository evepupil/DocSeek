export const INSTRUCTION_START_MARKER = "<!-- DOCSEEK:INSTRUCTIONS:START -->";
export const INSTRUCTION_END_MARKER = "<!-- DOCSEEK:INSTRUCTIONS:END -->";

const instructionLines = [
  INSTRUCTION_START_MARKER,
  "## Documentation lookup with DocSeek",
  "",
  "- Before the first search in a project, run `docseek status`; run `docseek init` first when uninitialized, or `docseek update` when changes are pending.",
  '- When project documentation location or wording is unknown, run `docseek search "<concept>" "<synonym>"`.',
  "- Prefer short concepts, aliases, abbreviations, and domain terms. Multiple arguments form one query.",
  "- Treat results as navigation and read the returned Markdown ranges before drawing conclusions.",
  "- Keep compact output by default. Add `--path` or `--top` to narrow; use `--json`, `--snippet`, or `--explain` only when needed.",
  INSTRUCTION_END_MARKER,
] as const;

export function renderInstructionBlock(newline = "\n"): string {
  return instructionLines.join(newline);
}
