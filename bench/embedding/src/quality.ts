import { readFile } from "node:fs/promises";

import { z } from "zod";

import type {
  BenchmarkChunk,
  ExpectedLocation,
  QualityCase,
  QualityObservation,
  QualitySuite,
  RankedLocation,
  SemanticQualityMetrics,
  SemanticQualityResult,
  SparseKindMetrics,
  SparseQueryKind,
} from "./types.js";
import { cosineSimilarity } from "./vectors.js";

const expectedLocationSchema = z.object({
  path: z.string().min(1),
  heading: z.string().min(1).optional(),
});

const qualitySuiteV1Schema = z.object({
  version: z.literal(1),
  cases: z
    .array(
      z.object({
        id: z.string().min(1),
        query: z.string().min(1),
        expected: z.array(expectedLocationSchema).min(1),
      }),
    )
    .min(1),
});

const sparseQueryKinds = ["single-term", "term-bundle", "alternate-vocabulary"] as const;
const sparseProbeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(sparseQueryKinds),
  terms: z.array(z.string().trim().min(1)).min(1).max(5),
});
const sparseIntentSchema = z
  .object({
    id: z.string().min(1),
    expected: z.array(z.object({ path: z.string().min(1), heading: z.string().min(1) })).min(1),
    probes: z.array(sparseProbeSchema).length(3),
  })
  .superRefine((intent, context) => {
    const kinds = new Set(intent.probes.map((probe) => probe.kind));
    for (const kind of sparseQueryKinds) {
      if (!kinds.has(kind)) {
        context.addIssue({ code: "custom", message: `Intent requires one ${kind} probe.` });
      }
    }
    const ids = intent.probes.map((probe) => probe.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Probe ids must be unique within an intent." });
    }
    const single = intent.probes.find((probe) => probe.kind === "single-term");
    if (single && single.terms.length !== 1) {
      context.addIssue({ code: "custom", message: "A single-term probe must contain one term." });
    }
  });
const qualitySuiteV2Schema = z
  .object({
    version: z.literal(2),
    intents: z.array(sparseIntentSchema).min(1),
  })
  .superRefine((suite, context) => {
    const ids = suite.intents.map((intent) => intent.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Intent ids must be unique." });
    }
  });

const qualitySuiteSchema = z.discriminatedUnion("version", [
  qualitySuiteV1Schema,
  qualitySuiteV2Schema,
]);

export function parseQualitySuite(value: unknown): QualitySuite {
  const parsed = qualitySuiteSchema.parse(value);
  if (parsed.version === 1) {
    return {
      version: 1,
      cases: parsed.cases.map((testCase) => ({
        id: testCase.id,
        intentId: testCase.id,
        kind: "legacy",
        terms: [testCase.query],
        query: testCase.query,
        expected: testCase.expected.map((expected) => ({
          path: expected.path,
          ...(expected.heading ? { heading: expected.heading } : {}),
        })),
      })),
    };
  }
  return {
    version: 2,
    cases: parsed.intents.flatMap((intent) =>
      intent.probes.map((probe) => ({
        id: `${intent.id}/${probe.id}`,
        intentId: intent.id,
        kind: probe.kind,
        terms: probe.terms,
        query: probe.terms.join(" "),
        expected: intent.expected,
      })),
    ),
  };
}

export async function loadQualitySuite(filePath: string): Promise<QualitySuite> {
  const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
  return parseQualitySuite(value);
}

function matches(
  location: Pick<RankedLocation, "path" | "heading">,
  expected: ExpectedLocation,
): boolean {
  return (
    location.path === expected.path &&
    (!expected.heading || location.heading.some((part) => part.includes(expected.heading ?? "")))
  );
}

export interface LiteralBaseline {
  readonly candidateCount: number;
  readonly expectedMatch: boolean;
}

export function literalBaseline(
  testCase: QualityCase,
  chunks: readonly BenchmarkChunk[],
): LiteralBaseline {
  const terms = testCase.terms.map((term) => term.toLowerCase());
  const candidates = chunks.filter((chunk) => {
    const searchable = chunk.content.toLowerCase();
    return terms.some((term) => searchable.includes(term));
  });
  return {
    candidateCount: candidates.length,
    expectedMatch: candidates.some((chunk) =>
      testCase.expected.some((expected) => matches(chunk, expected)),
    ),
  };
}

export function rankLocations(
  chunks: readonly BenchmarkChunk[],
  documentVectors: readonly Float32Array[],
  queryVector: Float32Array,
): readonly RankedLocation[] {
  if (chunks.length !== documentVectors.length) {
    throw new Error("Corpus and document vector counts do not match.");
  }
  return chunks
    .map((chunk, index) => {
      const vector = documentVectors[index];
      if (!vector) {
        throw new Error(`Document vector ${index} is missing.`);
      }
      return {
        chunkId: chunk.id,
        path: chunk.path,
        heading: chunk.heading,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        score: cosineSimilarity(queryVector, vector),
      } satisfies RankedLocation;
    })
    .sort((left, right) => right.score - left.score || left.chunkId - right.chunkId);
}

export function observeQuality(
  testCase: QualityCase,
  rankings: readonly (readonly RankedLocation[])[],
  chunks: readonly BenchmarkChunk[],
): QualityObservation {
  const first = rankings[0] ?? [];
  const expectedIndex = first.findIndex((location) =>
    testCase.expected.some((candidate) => matches(location, candidate)),
  );
  const literal = literalBaseline(testCase, chunks);
  const stableKey = (locations: readonly RankedLocation[]): string =>
    locations
      .slice(0, 5)
      .map((location) => location.chunkId)
      .join(",");
  const stable = rankings.every((ranking) => stableKey(ranking) === stableKey(first));
  return {
    caseId: testCase.id,
    intentId: testCase.intentId,
    kind: testCase.kind,
    terms: testCase.terms,
    ...(expectedIndex >= 0 ? { expectedRank: expectedIndex + 1 } : {}),
    stable,
    literalCandidateCount: literal.candidateCount,
    literalExpectedMatch: literal.expectedMatch,
    top: first.slice(0, 5).map((location) => ({
      ...location,
      score: Number(location.score.toFixed(6)),
    })),
  };
}

function coreMetrics(observations: readonly QualityObservation[]): SemanticQualityMetrics {
  let recallAt5 = 0;
  let top1 = 0;
  let reciprocalRanks = 0;
  let stable = 0;
  for (const observation of observations) {
    const rank = observation.expectedRank;
    if (rank !== undefined && rank <= 5) {
      recallAt5 += 1;
    }
    if (rank === 1) {
      top1 += 1;
    }
    if (rank !== undefined) {
      reciprocalRanks += 1 / rank;
    }
    if (observation.stable) {
      stable += 1;
    }
  }
  return {
    recallAt5: recallAt5 / observations.length,
    top1: top1 / observations.length,
    meanReciprocalRank: reciprocalRanks / observations.length,
    stability: stable / observations.length,
  };
}

function rate(hits: number, eligible: number): number {
  return eligible > 0 ? hits / eligible : 0;
}

function kindMetrics(
  kind: SparseQueryKind,
  observations: readonly QualityObservation[],
): SparseKindMetrics {
  const selected = observations.filter((observation) => observation.kind === kind);
  const literalMisses = selected.filter((observation) => !observation.literalExpectedMatch);
  const semanticRescues = literalMisses.filter(
    (observation) => observation.expectedRank !== undefined && observation.expectedRank <= 5,
  );
  return {
    kind,
    probes: selected.length,
    ...coreMetrics(selected),
    literalMisses: literalMisses.length,
    semanticRescueRateAt5: rate(semanticRescues.length, literalMisses.length),
  };
}

function sparseMetrics(observations: readonly QualityObservation[]) {
  const sparse = observations.filter((observation) => observation.kind !== "legacy");
  if (sparse.length === 0) {
    return undefined;
  }
  const byIntent = new Map<string, QualityObservation[]>();
  for (const observation of sparse) {
    const entries = byIntent.get(observation.intentId) ?? [];
    entries.push(observation);
    byIntent.set(observation.intentId, entries);
  }
  const intentProbeRecall = [...byIntent.values()].map(
    (entries) =>
      entries.filter((entry) => entry.expectedRank !== undefined && entry.expectedRank <= 5)
        .length / entries.length,
  );
  const literalMisses = sparse.filter((observation) => !observation.literalExpectedMatch);
  const semanticRescues = literalMisses.filter(
    (observation) => observation.expectedRank !== undefined && observation.expectedRank <= 5,
  );
  const compressionEligible = sparse.filter(
    (observation) => observation.literalExpectedMatch && observation.literalCandidateCount > 5,
  );
  const compressionHits = compressionEligible.filter(
    (observation) => observation.expectedRank !== undefined && observation.expectedRank <= 5,
  );
  return {
    intents: byIntent.size,
    probes: sparse.length,
    macroIntentRecallAt5:
      intentProbeRecall.reduce((total, value) => total + value, 0) / intentProbeRecall.length,
    intentAnyRecallAt5: rate(
      [...byIntent.values()].filter((entries) =>
        entries.some((entry) => entry.expectedRank !== undefined && entry.expectedRank <= 5),
      ).length,
      byIntent.size,
    ),
    literalTargetRate: rate(
      sparse.filter((observation) => observation.literalExpectedMatch).length,
      sparse.length,
    ),
    semanticRescueEligible: literalMisses.length,
    semanticRescueHitsAt5: semanticRescues.length,
    semanticRescueRateAt5: rate(semanticRescues.length, literalMisses.length),
    candidateCompressionEligible: compressionEligible.length,
    candidateCompressionHitsAt5: compressionHits.length,
    candidateCompressionRateAt5: rate(compressionHits.length, compressionEligible.length),
    byKind: sparseQueryKinds
      .filter((kind) => sparse.some((observation) => observation.kind === kind))
      .map((kind) => kindMetrics(kind, sparse)),
  };
}

export function summarizeQuality(
  observations: readonly QualityObservation[],
): SemanticQualityResult {
  if (observations.length === 0) {
    throw new Error("Quality evaluation requires at least one observation.");
  }
  const sparse = sparseMetrics(observations);
  return {
    metrics: coreMetrics(observations),
    ...(sparse ? { sparse } : {}),
    observations,
  };
}
