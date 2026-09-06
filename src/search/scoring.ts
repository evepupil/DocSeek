import type {
  ConfidenceReason,
  SearchCandidate,
  SearchConfig,
  SearchExplanation,
  SearchQueryMode,
} from "../domain/types.js";

const RRF_CONSTANT = 8;
const RRF_COMPONENT_WEIGHT = 0.6;
const LEXICAL_COMPONENT_WEIGHT = 0.2;
const SEMANTIC_COMPONENT_WEIGHT = 0.2;
const STRONG_DUAL_RANK = 5;
const DUAL_CONFIDENCE_FACTOR = 0.7;
const TERM_VECTOR_RANK = 3;
const TERM_KEYWORD_RANK = 3;
const TERM_LEXICAL_CONFIDENCE_FACTOR = 0.5;
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

function semanticWeakDistance(
  config: SearchConfig,
  queryMode: SearchQueryMode,
  allowTermRelaxation: boolean,
): number {
  if (queryMode === "natural" || !allowTermRelaxation) {
    return config.semanticWeakDistance;
  }
  return config.semanticWeakDistance + (config.semanticWeakDistance - config.semanticBestDistance);
}

function semanticStrength(
  distance: number | undefined,
  config: SearchConfig,
  queryMode: SearchQueryMode,
  allowTermRelaxation: boolean,
): number {
  if (distance === undefined) {
    return 0;
  }
  const weakDistance = semanticWeakDistance(config, queryMode, allowTermRelaxation);
  const range = weakDistance - config.semanticBestDistance;
  return clamp((weakDistance - distance) / range);
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
  queryMode: SearchQueryMode,
  allowTermRelaxation: boolean,
): CandidateSignals {
  const lexical = lexicalStrength(queryTerms, candidate);
  const semantic = semanticStrength(candidate.distance, config, queryMode, allowTermRelaxation);
  const fusion = normalizedRrf(vectorRank, keywordRank, config);
  const confidence = Math.max(lexical, semantic);
  const strongDual =
    vectorRank !== undefined &&
    keywordRank !== undefined &&
    vectorRank <= STRONG_DUAL_RANK &&
    keywordRank <= STRONG_DUAL_RANK;
  const signalTrusted = confidence >= config.minimumConfidence;
  const dualTrusted = strongDual && confidence >= config.minimumConfidence * DUAL_CONFIDENCE_FACTOR;
  const termVectorTrusted =
    queryMode === "terms" &&
    allowTermRelaxation &&
    vectorRank !== undefined &&
    vectorRank <= TERM_VECTOR_RANK &&
    candidate.distance !== undefined &&
    candidate.distance <= semanticWeakDistance(config, queryMode, allowTermRelaxation);
  const termKeywordTrusted =
    queryMode === "terms" &&
    allowTermRelaxation &&
    keywordRank !== undefined &&
    keywordRank <= TERM_KEYWORD_RANK &&
    lexical >= config.minimumConfidence * TERM_LEXICAL_CONFIDENCE_FACTOR;
  const confidenceReason: ConfidenceReason = signalTrusted
    ? "signal"
    : dualTrusted
      ? "dual-route"
      : termVectorTrusted
        ? "term-vector"
        : termKeywordTrusted
          ? "term-keyword"
          : "rejected";
  const trusted = signalTrusted || dualTrusted || termVectorTrusted || termKeywordTrusted;
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
      confidenceReason,
    },
  };
}
