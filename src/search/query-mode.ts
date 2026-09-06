import type { SearchCandidate, SearchQueryMode } from "../domain/types.js";
import { tokenizeForSearch } from "./terms.js";

const chineseQuestion = /什么|为什么|为何|怎么|怎样|如何|是否|能否|哪里|哪儿|多少|应该|怎么办|吗/u;
const englishQuestion = /\b(?:what|where|when|why|how|does|do|are|is|should|can|could|would)\b/iu;

export function classifyQueryMode(
  query: string,
  queryParts: readonly string[] | undefined,
): SearchQueryMode {
  if (!queryParts) {
    return "natural";
  }

  const parts = queryParts.map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "natural";
  }

  const combined = parts.join(" ");
  if (chineseQuestion.test(combined) || englishQuestion.test(combined)) {
    return "natural";
  }
  if (parts.length >= 2 && parts.length <= 5) {
    return "terms";
  }
  if (parts.length !== 1) {
    return "natural";
  }

  const words = combined.split(/\s+/u);
  return combined.length <= 32 && words.length <= 3 ? "terms" : "natural";
}

export function hasSufficientTermEvidence(
  queryParts: readonly string[] | undefined,
  keywordCandidates: readonly Pick<SearchCandidate, "indexedTerms">[],
): boolean {
  const parts = (queryParts ?? []).map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0 || keywordCandidates.length === 0) {
    return false;
  }

  const indexedTerms = new Set(keywordCandidates.flatMap((candidate) => candidate.indexedTerms));
  const recognizedParts = parts.filter((part) =>
    tokenizeForSearch(part).some((term) => indexedTerms.has(term)),
  ).length;
  return recognizedParts >= Math.min(2, parts.length);
}
