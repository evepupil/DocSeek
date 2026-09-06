export const INSTRUCTION_START_MARKER = "<!-- DOCSEEK:INSTRUCTIONS:START -->";
export const INSTRUCTION_END_MARKER = "<!-- DOCSEEK:INSTRUCTIONS:END -->";

const instructionLines = [
  INSTRUCTION_START_MARKER,
  "## Documentation lookup with DocSeek",
  "",
  "- Before the first search in a project, run `docseek status`; run `docseek init` first when uninitialized, or `docseek update` when changes are pending.",
  "- Use DocSeek like semantic `grep` / `rg`: search with divergent candidate terms instead of a complete natural-language question.",
  '- Start with 2-5 short candidates such as synonyms, abbreviations, translations, domain terms, and likely project jargon: `docseek search "SLA" "违约" "退款" "赔付"`.',
  "- Multiple arguments form one query. Broaden the candidate terms when the first search misses; use `--path` or `--top` only after useful locations appear.",
  "- Treat results as navigation and read the returned Markdown ranges before drawing conclusions.",
  "- Keep compact output by default; use `--json`, `--snippet`, or `--explain` only when needed.",
  INSTRUCTION_END_MARKER,
] as const;

export function renderInstructionBlock(newline = "\n"): string {
  return instructionLines.join(newline);
}
