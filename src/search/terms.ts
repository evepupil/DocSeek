const hanSequence = /\p{Script=Han}+/gu;
const latinToken = /[\p{Script=Latin}\p{N}_./:-]+/gu;

function addLatinTerms(text: string, terms: Set<string>): void {
  for (const match of text.matchAll(latinToken)) {
    const raw = match[0];
    const normalized = raw.toLowerCase().replace(/^[./:-]+|[./:-]+$/gu, "");
    if (normalized.length > 0) {
      terms.add(normalized);
    }

    const parts = raw
      .replace(/([a-z\d])([A-Z])/gu, "$1 $2")
      .split(/[_.:/-]+|\s+/u)
      .map((part) => part.toLowerCase())
      .filter((part) => part.length > 0);
    for (const part of parts) {
      terms.add(part);
    }
  }
}

function addHanTerms(text: string, terms: Set<string>): void {
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike && /\p{Script=Han}/u.test(segment.segment)) {
      terms.add(segment.segment);
    }
  }

  for (const match of text.matchAll(hanSequence)) {
    const characters = match[0].match(/\p{Script=Han}/gu) ?? [];
    if (characters.length <= 8) {
      terms.add(characters.join(""));
    }
    const onlyCharacter = characters[0];
    if (characters.length === 1 && onlyCharacter) {
      terms.add(onlyCharacter);
    }
    for (let index = 0; index < characters.length - 1; index += 1) {
      const first = characters[index];
      const second = characters[index + 1];
      if (first && second) {
        terms.add(`${first}${second}`);
      }
    }
  }
}

export function tokenizeForFts(text: string): readonly string[] {
  const normalized = text.normalize("NFKC");
  const terms = new Set<string>();
  addLatinTerms(normalized, terms);
  addHanTerms(normalized, terms);
  return [...terms].sort((left, right) => left.localeCompare(right));
}

export function buildFtsText(text: string): string {
  return tokenizeForFts(text).join(" ");
}

export function buildFtsQuery(text: string): string | undefined {
  const terms = tokenizeForFts(text);
  if (terms.length === 0) {
    return undefined;
  }
  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
}
