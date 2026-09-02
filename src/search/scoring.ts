import type { SearchCandidate, SearchConfig, SearchExplanation } from "../domain/types.js";

const RRF_CONSTANT = 60;
const RRF_COMPONENT_WEIGHT = 0.35;
const LEXICAL_COMPONENT_WEIGHT = 0.5;
const SEMANTIC_COMPONENT_WEIGHT = 0.15;
const STRONG_DUAL_RANK = 5;
const DUAL_CONFIDENCE_FACTOR = 0.7;
const hanOnly = /^\p{Script=Han}+$/u;

export interface CandidateSignals {
  readonly score: number;
  readonly trusted: boolean;
  readonly explanation: SearchExplanation;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function termWeight(term: string): number {
  if (!hanOnly.test(term)) {
    return 4;
  }
  const length = term.match(/\p{Script=Han}/gu)?.length ?? 0;
  if (length >= 4) {
    return 3;
  }
  return length === 3 ? 2 : 1;
}

function lexicalStrength(queryTerms: readonly string[], candidate: SearchCandidate): number {
  if (queryTerms.length === 0) {
    return 0;
  }
  const candidateTerms = new Set(candidate.indexedTerms);
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const term of queryTerms) {
    const weight = termWeight(term);
    totalWeight += weight;
    if (candidateTerms.has(term)) {
      matchedWeight += weight;
    }
  }

  if (matchedWeight === 0 || totalWeight === 0) {
    return 0;
  }
  const coverage = matchedWeight / totalWeight;
  const evidence = 1 - Math.exp(-matchedWeight / 3);
  return Math.sqrt(coverage * evidence);
}

function semanticStrength(distance: number | undefined, config: SearchConfig): number {
  if (distance === undefined) {
    return 0;
  }
  const range = config.semanticWeakDistance - config.semanticBestDistance;
  return clamp((config.semanticWeakDistance - distance) / range);
}

function normalizedRrf(
  vectorRank: number | undefined,
  keywordRank: number | undefined,
  config: SearchConfig,
): number {
  const totalWeight = config.vectorWeight + config.keywordWeight;
  const maximum = totalWeight / (RRF_CONSTANT + 1);
  const vector = vectorRank ? config.vectorWeight / (RRF_CONSTANT + vectorRank) : 0;
  const keyword = keywordRank ? config.keywordWeight / (RRF_CONSTANT + keywordRank) : 0;
  return maximum > 0 ? clamp((vector + keyword) / maximum) : 0;
}

export function scoreCandidate(
  candidate: SearchCandidate,
  queryTerms: readonly string[],
  vectorRank: number | undefined,
  keywordRank: number | undefined,
  config: SearchConfig,
): CandidateSignals {
  const lexical = lexicalStrength(queryTerms, candidate);
  const semantic = semanticStrength(candidate.distance, config);
  const fusion = normalizedRrf(vectorRank, keywordRank, config);
  const confidence = Math.max(lexical, semantic);
  const strongDual =
    vectorRank !== undefined &&
    keywordRank !== undefined &&
    vectorRank <= STRONG_DUAL_RANK &&
    keywordRank <= STRONG_DUAL_RANK;
  const trusted =
    confidence >= config.minimumConfidence ||
    (strongDual && confidence >= config.minimumConfidence * DUAL_CONFIDENCE_FACTOR);
  const score = clamp(
    fusion * RRF_COMPONENT_WEIGHT +
      lexical * LEXICAL_COMPONENT_WEIGHT +
      semantic * SEMANTIC_COMPONENT_WEIGHT,
  );

  return {
    score,
    trusted,
    explanation: {
      ...(vectorRank !== undefined ? { vectorRank } : {}),
      ...(keywordRank !== undefined ? { keywordRank } : {}),
      ...(candidate.distance !== undefined ? { vectorDistance: candidate.distance } : {}),
      semanticStrength: semantic,
      lexicalStrength: lexical,
      fusionStrength: fusion,
      confidence,
    },
  };
}
