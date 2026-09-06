import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { loadCorpus } from "./corpus.js";
import { toRankedLocations, type SearchLocation } from "./hybrid-results.js";
import { loadQualitySuite, observeQuality, summarizeQuality } from "./quality.js";
import { percentile } from "./stats.js";

const packageRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const invocationDirectory = path.resolve(process.env["INIT_CWD"] ?? process.cwd());

interface ProjectStatus {
  readonly initialized: boolean;
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
}

interface ProjectContext {
  readonly indexPath: string;
  readonly config: {
    readonly projectId: string;
    readonly embedding: unknown;
    readonly search: unknown;
  };
}

interface SearchStore {
  close(): void;
}

interface SearchProvider {
  dispose(): Promise<void>;
}

interface SearchResponse {
  readonly results: readonly SearchLocation[];
  readonly diagnostics: { readonly timings: { readonly totalMs: number } };
}

interface RootRuntime {
  readonly getStatus: (projectRoot: string) => Promise<ProjectStatus>;
  readonly loadProjectContext: (projectRoot: string) => Promise<ProjectContext>;
  readonly createEmbeddingProvider: (config: unknown) => SearchProvider;
  readonly IndexStore: new (indexPath: string, temporary?: boolean) => SearchStore;
  readonly executeSearch: (options: {
    readonly store: SearchStore;
    readonly provider: SearchProvider;
    readonly collectionId: string;
    readonly config: unknown;
    readonly request: {
      readonly query: string;
      readonly top: number;
      readonly includeSnippet: false;
    };
  }) => Promise<SearchResponse>;
}

function resolveUserPath(value: string): string {
  return path.resolve(invocationDirectory, value);
}

function reportPath(value: string): string {
  const relative = path.relative(invocationDirectory, value);
  if (relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.replaceAll(path.sep, "/");
  }
  return value;
}

function defaultOutput(): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return path.join(packageRoot, "results", `${timestamp}-hybrid.json`);
}

function help(): string {
  return `DocSeek hybrid navigation benchmark

Usage:
  npm --prefix bench/embedding run benchmark:hybrid -- --project <path> [options]

Options:
  --project <path>          Initialized DocSeek project with no pending changes
  --cases <path>            Quality suite (default: cases/inferforge.json)
  --output <path>           Raw JSON result path
  --help                    Show this message
`;
}

async function rootModule(relativePath: string): Promise<unknown> {
  const modulePath = path.join(repositoryRoot, "dist", relativePath);
  await access(modulePath);
  return import(pathToFileURL(modulePath).href);
}

async function loadRootRuntime(): Promise<RootRuntime> {
  const [status, config, embedding, storage, search] = await Promise.all([
    rootModule("application/get-status.js"),
    rootModule("config/config-file.js"),
    rootModule("embedding/factory.js"),
    rootModule("storage/index-store.js"),
    rootModule("application/execute-search.js"),
  ]);
  return {
    getStatus: (status as { getStatus: RootRuntime["getStatus"] }).getStatus,
    loadProjectContext: (config as { loadProjectContext: RootRuntime["loadProjectContext"] })
      .loadProjectContext,
    createEmbeddingProvider: (
      embedding as { createEmbeddingProvider: RootRuntime["createEmbeddingProvider"] }
    ).createEmbeddingProvider,
    IndexStore: (storage as { IndexStore: RootRuntime["IndexStore"] }).IndexStore,
    executeSearch: (search as { executeSearch: RootRuntime["executeSearch"] }).executeSearch,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      cases: { type: "string" },
      output: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(help());
    return;
  }
  if (!values.project) {
    throw new Error("--project is required.");
  }

  const projectRoot = resolveUserPath(values.project);
  const casesPath = values.cases
    ? resolveUserPath(values.cases)
    : path.join(packageRoot, "cases", "inferforge.json");
  const outputPath = values.output ? resolveUserPath(values.output) : defaultOutput();
  const runtime = await loadRootRuntime();
  const status = await runtime.getStatus(projectRoot);
  if (!status.initialized) {
    throw new Error("The benchmark project is not initialized.");
  }
  if (status.added > 0 || status.modified > 0 || status.deleted > 0) {
    throw new Error("The benchmark project has pending documentation changes.");
  }

  const context = await runtime.loadProjectContext(projectRoot);
  const corpus = loadCorpus(context.indexPath);
  const suite = await loadQualitySuite(casesPath);
  const temporaryIndexPath = path.join(packageRoot, "cache", `hybrid-index-${process.pid}.db`);
  await mkdir(path.dirname(temporaryIndexPath), { recursive: true });
  await copyFile(context.indexPath, temporaryIndexPath);
  const store = new runtime.IndexStore(temporaryIndexPath, true);
  const provider = runtime.createEmbeddingProvider(context.config.embedding);
  const observations = [];
  const latencies: number[] = [];
  try {
    for (const testCase of suite.cases) {
      const searches = [];
      for (let run = 0; run < 2; run += 1) {
        const response = await runtime.executeSearch({
          store,
          provider,
          collectionId: context.config.projectId,
          config: context.config.search,
          request: { query: testCase.query, top: 5, includeSnippet: false },
        });
        latencies.push(response.diagnostics.timings.totalMs);
        searches.push(toRankedLocations(response.results, corpus.chunks));
      }
      observations.push(observeQuality(testCase, searches, corpus.chunks));
    }
  } finally {
    try {
      store.close();
      await provider.dispose();
    } finally {
      await Promise.all(
        [temporaryIndexPath, `${temporaryIndexPath}-journal`].map((filePath) =>
          rm(filePath, { force: true }),
        ),
      );
    }
  }

  const quality = summarizeQuality(observations);
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    command: {
      project: reportPath(projectRoot),
      cases: reportPath(casesPath),
      repeatedSearches: 2,
      top: 5,
    },
    corpus: {
      totalChunksInIndex: corpus.totalChunksInIndex,
      documentCount: corpus.documentCount,
      totalCharacters: corpus.totalCharacters,
      fingerprint: corpus.fingerprint,
    },
    configuration: {
      embedding: context.config.embedding,
      search: context.config.search,
    },
    quality,
    timings: {
      searchP50Ms: percentile(latencies, 0.5),
      searchP95Ms: percentile(latencies, 0.95),
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `hybrid probes=${quality.sparse?.probes ?? quality.observations.length} recall@5=${quality.metrics.recallAt5.toFixed(3)} top1=${quality.metrics.top1.toFixed(3)} rescue@5=${quality.sparse?.semanticRescueRateAt5.toFixed(3) ?? "-"} compression@5=${quality.sparse?.candidateCompressionRateAt5.toFixed(3) ?? "-"}`,
  );
  console.log(`result ${outputPath}`);
}

await main();
