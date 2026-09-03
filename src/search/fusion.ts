import type { SearchCandidate, SearchConfig, SearchResult } from "../domain/types.js";
import { scoreCandidate } from "./scoring.js";

interface RankedCandidate {
  readonly candidate: SearchCandidate;
  readonly vectorRank?: number;
  readonly keywordRank?: number;
}

export interface FusionOptions {
  readonly top?: number;
  readonly includeSnippet: boolean;
  readonly includeExplanation: boolean;
  readonly queryTerms: readonly string[];
  readonly config: SearchConfig;
}

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
  options: FusionOptions,
): readonly SearchResult[] {
  const merged = new Map<number, RankedCandidate>();

  for (const candidate of vectorCandidates) {
    merged.set(candidate.chunkId, { candidate, vectorRank: candidate.rank });
  }

  for (const candidate of keywordCandidates) {
    const existing = merged.get(candidate.chunkId);
    merged.set(candidate.chunkId, {
      candidate: existing?.candidate ?? candidate,
      ...(existing?.vectorRank !== undefined ? { vectorRank: existing.vectorRank } : {}),
      keywordRank: candidate.rank,
    });
  }

  const ranked = [...merged.values()]
    .map((entry) => ({
      ...entry,
      signals: scoreCandidate(
        entry.candidate,
        options.queryTerms,
        entry.vectorRank,
        entry.keywordRank,
        options.config,
      ),
    }))
    .filter((entry) => entry.signals.trusted)
    .sort((left, right) => {
      const scoreOrder = right.signals.score - left.signals.score;
      if (scoreOrder !== 0) {
        return scoreOrder;
      }
      const confidenceOrder =
        right.signals.explanation.confidence - left.signals.explanation.confidence;
      if (confidenceOrder !== 0) {
        return confidenceOrder;
      }
      const vectorOrder =
        (left.vectorRank ?? Number.MAX_SAFE_INTEGER) -
        (right.vectorRank ?? Number.MAX_SAFE_INTEGER);
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

  return ranked.slice(0, options.top ?? ranked.length).map(({ candidate, signals }) => ({
    path: candidate.path,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    heading: candidate.heading,
    score: Number(signals.score.toFixed(4)),
    ...(options.includeSnippet ? { snippet: snippet(candidate.content) } : {}),
    ...(options.includeExplanation
      ? {
          explanation: {
            ...signals.explanation,
            semanticStrength: Number(signals.explanation.semanticStrength.toFixed(4)),
            lexicalStrength: Number(signals.explanation.lexicalStrength.toFixed(4)),
            fusionStrength: Number(signals.explanation.fusionStrength.toFixed(4)),
            confidence: Number(signals.explanation.confidence.toFixed(4)),
            ...(signals.explanation.vectorDistance !== undefined
              ? { vectorDistance: Number(signals.explanation.vectorDistance.toFixed(6)) }
              : {}),
          },
        }
      : {}),
  }));
}
