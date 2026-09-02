import type { SearchResult, SearchTimings } from "../domain/types.js";
import type { QualityCase, QualityExpectation } from "./schema.js";

export interface QualityObservation {
  readonly testCase: QualityCase;
  readonly results: readonly SearchResult[];
  readonly deterministic: boolean;
  readonly timings: SearchTimings;
}

export interface QualityMetrics {
  readonly positiveRecallAt5: number;
  readonly positiveTop1: number;
  readonly meanReciprocalRank: number;
  readonly exactTop1: number;
  readonly negativeRejection: number;
  readonly determinism: number;
}

export interface QualitySummary {
  readonly metrics: QualityMetrics;
  readonly failures: readonly string[];
}

function matchesExpectation(result: SearchResult, expectation: QualityExpectation): boolean {
  return (
    result.path === expectation.path &&
    (!expectation.heading ||
      result.heading.some((heading) => heading.includes(expectation.heading ?? "")))
  );
}

export function matchingRank(
  results: readonly SearchResult[],
  expected: readonly QualityExpectation[] | undefined,
): number | undefined {
  if (!expected) {
    return undefined;
  }
  const index = results.findIndex((result) =>
    expected.some((expectation) => matchesExpectation(result, expectation)),
  );
  return index >= 0 ? index + 1 : undefined;
}

export function stableResults(results: readonly SearchResult[]): string {
  return JSON.stringify(
    results.map(({ path, startLine, endLine, heading, score }) => ({
      path,
      startLine,
      endLine,
      heading,
      score,
    })),
  );
}

export function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

export function summarizeQuality(observations: readonly QualityObservation[]): QualitySummary {
  const failures: string[] = [];
  let positiveCount = 0;
  let positiveHits = 0;
  let positiveTopOne = 0;
  let reciprocalRankTotal = 0;
  let exactCount = 0;
  let exactTopOne = 0;
  let negativeCount = 0;
  let negativeRejected = 0;
  let deterministicCount = 0;

  for (const observation of observations) {
    const { testCase, results, deterministic } = observation;
    if (deterministic) {
      deterministicCount += 1;
    } else {
      failures.push(`${testCase.id}: repeated results changed`);
    }

    if (testCase.category === "negative") {
      negativeCount += 1;
      if (results.length === 0) {
        negativeRejected += 1;
      } else {
        const first = results[0];
        failures.push(
          `${testCase.id}: expected no result, got ${first ? `${first.path}:${first.startLine}` : "empty"}`,
        );
      }
      continue;
    }

    positiveCount += 1;
    const rank = matchingRank(results, testCase.expected);
    if (rank !== undefined && rank <= 5) {
      positiveHits += 1;
      reciprocalRankTotal += 1 / rank;
    } else {
      const first = results[0];
      failures.push(
        `${testCase.id}: expected location missing; first was ${first ? `${first.path}:${first.startLine}` : "empty"}`,
      );
    }
    if (rank === 1) {
      positiveTopOne += 1;
    }
    if (testCase.category === "exact") {
      exactCount += 1;
      if (rank === 1) {
        exactTopOne += 1;
      } else {
        failures.push(`${testCase.id}: exact term expected at rank 1, got ${rank ?? "missing"}`);
      }
    }
  }

  return {
    metrics: {
      positiveRecallAt5: positiveCount > 0 ? positiveHits / positiveCount : 0,
      positiveTop1: positiveCount > 0 ? positiveTopOne / positiveCount : 0,
      meanReciprocalRank: positiveCount > 0 ? reciprocalRankTotal / positiveCount : 0,
      exactTop1: exactCount > 0 ? exactTopOne / exactCount : 0,
      negativeRejection: negativeCount > 0 ? negativeRejected / negativeCount : 0,
      determinism: observations.length > 0 ? deterministicCount / observations.length : 0,
    },
    failures,
  };
}
