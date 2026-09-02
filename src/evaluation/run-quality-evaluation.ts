import { readFile } from "node:fs/promises";
import path from "node:path";

import { executeSearch } from "../application/execute-search.js";
import { getStatus } from "../application/get-status.js";
import { initializeProject } from "../application/init-project.js";
import { updateProject } from "../application/update-project.js";
import { loadProjectContext } from "../config/config-file.js";
import type { SearchRequest, SearchTimings } from "../domain/types.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { IndexStore } from "../storage/index-store.js";
import { percentile, stableResults, summarizeQuality, type QualityObservation } from "./metrics.js";
import { qualitySuiteSchema, type QualityCase } from "./schema.js";

interface ThresholdCheck {
  readonly name: string;
  readonly value: number;
  readonly threshold: number;
  readonly passed: boolean;
}

function searchRequest(testCase: QualityCase): SearchRequest {
  return {
    query: testCase.query,
    top: 5,
    includeSnippet: false,
    ...(testCase.path ? { path: testCase.path } : {}),
  };
}

function thresholdChecks(
  metrics: ReturnType<typeof summarizeQuality>["metrics"],
  thresholds: ReturnType<typeof qualitySuiteSchema.parse>["thresholds"],
): readonly ThresholdCheck[] {
  return [
    {
      name: "positive_recall_at_5",
      value: metrics.positiveRecallAt5,
      threshold: thresholds.positive_recall_at_5,
    },
    {
      name: "positive_top_1",
      value: metrics.positiveTop1,
      threshold: thresholds.positive_top_1,
    },
    {
      name: "exact_top_1",
      value: metrics.exactTop1,
      threshold: thresholds.exact_top_1,
    },
    {
      name: "negative_rejection",
      value: metrics.negativeRejection,
      threshold: thresholds.negative_rejection,
    },
    {
      name: "determinism",
      value: metrics.determinism,
      threshold: thresholds.determinism,
    },
  ].map((check) => ({ ...check, passed: check.value >= check.threshold }));
}

function printTiming(name: string, values: readonly number[]): void {
  console.log(
    `INFO ${name}_ms: p50 ${percentile(values, 0.5).toFixed(1)}, p95 ${percentile(values, 0.95).toFixed(1)}`,
  );
}

function printReport(
  checks: readonly ThresholdCheck[],
  observations: readonly QualityObservation[],
  meanReciprocalRank: number,
  failures: readonly string[],
): void {
  console.log(`DocSeek quality evaluation: ${observations.length} cases`);
  for (const check of checks) {
    console.log(
      `${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.value.toFixed(3)} (minimum ${check.threshold.toFixed(3)})`,
    );
  }
  console.log(`INFO mean_reciprocal_rank: ${meanReciprocalRank.toFixed(3)}`);

  const timings = observations.map((observation) => observation.timings);
  printTiming(
    "cached_latency",
    timings.map((timing) => timing.totalMs),
  );
  const phases: readonly [string, (timing: SearchTimings) => number][] = [
    ["embedding", (timing) => timing.embeddingMs],
    ["vector_search", (timing) => timing.vectorSearchMs],
    ["keyword_search", (timing) => timing.keywordSearchMs],
    ["fusion", (timing) => timing.fusionMs],
  ];
  for (const [name, select] of phases) {
    printTiming(name, timings.map(select));
  }
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
}

export async function runQualityEvaluation(projectRoot: string): Promise<number> {
  const suitePath = path.join(projectRoot, "eval", "search-quality.json");
  const rawSuite: unknown = JSON.parse(await readFile(suitePath, "utf8"));
  const suite = qualitySuiteSchema.parse(rawSuite);
  const initialStatus = await getStatus(projectRoot);
  if (initialStatus.initialized) {
    await updateProject(projectRoot);
  } else {
    await initializeProject(projectRoot);
  }

  const context = await loadProjectContext(projectRoot);
  const store = new IndexStore(context.indexPath);
  const provider = createEmbeddingProvider(context.config.embedding);
  const observations: QualityObservation[] = [];

  try {
    const firstCase = suite.cases[0];
    if (firstCase) {
      await executeSearch({
        store,
        provider,
        collectionId: context.config.projectId,
        config: context.config.search,
        request: searchRequest(firstCase),
      });
    }

    for (const testCase of suite.cases) {
      const request = searchRequest(testCase);
      const first = await executeSearch({
        store,
        provider,
        collectionId: context.config.projectId,
        config: context.config.search,
        request,
      });
      const second = await executeSearch({
        store,
        provider,
        collectionId: context.config.projectId,
        config: context.config.search,
        request,
      });
      observations.push({
        testCase,
        results: first.results,
        deterministic: stableResults(first.results) === stableResults(second.results),
        timings: first.diagnostics.timings,
      });
    }
  } finally {
    store.close();
    await provider.dispose();
  }

  const summary = summarizeQuality(observations);
  const checks = thresholdChecks(summary.metrics, suite.thresholds);
  printReport(checks, observations, summary.metrics.meanReciprocalRank, summary.failures);
  return checks.every((check) => check.passed) ? 0 : 1;
}
