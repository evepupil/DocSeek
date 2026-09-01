import type { SearchCandidate, SearchResult } from "../domain/types.js";

interface RankedCandidate {
  readonly candidate: SearchCandidate;
  readonly rawScore: number;
  readonly vectorRank?: number;
  readonly keywordRank?: number;
}

const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;
const RRF_CONSTANT = 60;

function snippet(content: string, maxLength = 240): string {
  const compact = content.replace(/\s+/gu, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

export function fuseCandidates(
  vectorCandidates: readonly SearchCandidate[],
  keywordCandidates: readonly SearchCandidate[],
  top: number,
  includeSnippet: boolean,
): readonly SearchResult[] {
  const merged = new Map<number, RankedCandidate>();

  for (const candidate of vectorCandidates) {
    merged.set(candidate.chunkId, {
      candidate,
      vectorRank: candidate.rank,
      rawScore: VECTOR_WEIGHT / (RRF_CONSTANT + candidate.rank),
    });
  }

  for (const candidate of keywordCandidates) {
    const existing = merged.get(candidate.chunkId);
    merged.set(candidate.chunkId, {
      candidate: existing?.candidate ?? candidate,
      ...(existing?.vectorRank ? { vectorRank: existing.vectorRank } : {}),
      keywordRank: candidate.rank,
      rawScore: (existing?.rawScore ?? 0) + KEYWORD_WEIGHT / (RRF_CONSTANT + candidate.rank),
    });
  }

  const ranked = [...merged.values()].sort((left, right) => {
    const scoreOrder = right.rawScore - left.rawScore;
    if (scoreOrder !== 0) {
      return scoreOrder;
    }
    const vectorOrder =
      (left.vectorRank ?? Number.MAX_SAFE_INTEGER) - (right.vectorRank ?? Number.MAX_SAFE_INTEGER);
    if (vectorOrder !== 0) {
      return vectorOrder;
    }
    const keywordOrder =
      (left.keywordRank ?? Number.MAX_SAFE_INTEGER) -
      (right.keywordRank ?? Number.MAX_SAFE_INTEGER);
    if (keywordOrder !== 0) {
      return keywordOrder;
    }
    const pathOrder = left.candidate.path.localeCompare(right.candidate.path);
    if (pathOrder !== 0) {
      return pathOrder;
    }
    return left.candidate.startLine - right.candidate.startLine;
  });

  const maximum = ranked[0]?.rawScore ?? 1;
  return ranked.slice(0, top).map(({ candidate, rawScore }) => ({
    path: candidate.path,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    heading: candidate.heading,
    score: Number((rawScore / maximum).toFixed(4)),
    ...(includeSnippet ? { snippet: snippet(candidate.content) } : {}),
  }));
}
