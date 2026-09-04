import { randomUUID } from "node:crypto";

import { z } from "zod";

import { CONFIG_VERSION, type DocSeekConfig } from "../domain/types.js";

const sourceSchema = z.strictObject({
  id: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/u),
  kind: z.literal("markdown-directory"),
  path: z.string().trim().min(1),
  include: z.array(z.string().trim().min(1)).min(1),
  exclude: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});

const defaultSearchConfig = {
  vector_weight: 0.45,
  keyword_weight: 0.55,
  semantic_best_distance: 0.09,
  semantic_weak_distance: 0.15,
  minimum_confidence: 0.5,
  candidate_pool: 100,
};

const searchSchema = z
  .strictObject({
    vector_weight: z.number().min(0).max(1),
    keyword_weight: z.number().min(0).max(1),
    semantic_best_distance: z.number().min(0).max(2),
    semantic_weak_distance: z.number().min(0).max(2),
    minimum_confidence: z.number().min(0).max(1),
    candidate_pool: z.int().min(10).max(500),
  })
  .default(defaultSearchConfig);

export const rawConfigSchema = z
  .strictObject({
    version: z.literal(CONFIG_VERSION),
    project_id: z.uuid(),
    embedding: z.strictObject({
      provider: z.literal("transformers"),
      model: z.string().trim().min(1),
      dtype: z.enum(["fp32", "fp16", "q8", "int8", "uint8", "q4"]),
      query_prefix: z.string(),
      document_prefix: z.string(),
      batch_size: z.int().min(1).max(128),
      max_tokens: z.int().min(32).max(8192).default(288),
    }),
    chunking: z.strictObject({
      max_chars: z.int().min(256).max(32_000),
    }),
    search: searchSchema,
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((config, context) => {
    if (config.search.vector_weight + config.search.keyword_weight <= 0) {
      context.addIssue({
        code: "custom",
        message: "At least one search weight must be greater than zero",
        path: ["search"],
      });
    }
    if (config.search.semantic_best_distance >= config.search.semantic_weak_distance) {
      context.addIssue({
        code: "custom",
        message: "semantic_best_distance must be smaller than semantic_weak_distance",
        path: ["search", "semantic_best_distance"],
      });
    }
    const seen = new Set<string>();
    for (const [index, source] of config.sources.entries()) {
      if (seen.has(source.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate source id: ${source.id}`,
          path: ["sources", index, "id"],
        });
      }
      seen.add(source.id);
    }
  });

export type RawConfig = z.infer<typeof rawConfigSchema>;

export function fromRawConfig(raw: RawConfig): DocSeekConfig {
  return {
    version: raw.version,
    projectId: raw.project_id,
    embedding: {
      provider: raw.embedding.provider,
      model: raw.embedding.model,
      dtype: raw.embedding.dtype,
      queryPrefix: raw.embedding.query_prefix,
      documentPrefix: raw.embedding.document_prefix,
      batchSize: raw.embedding.batch_size,
      maxTokens: raw.embedding.max_tokens,
    },
    chunking: { maxChars: raw.chunking.max_chars },
    search: {
      vectorWeight: raw.search.vector_weight,
      keywordWeight: raw.search.keyword_weight,
      semanticBestDistance: raw.search.semantic_best_distance,
      semanticWeakDistance: raw.search.semantic_weak_distance,
      minimumConfidence: raw.search.minimum_confidence,
      candidatePool: raw.search.candidate_pool,
    },
    sources: raw.sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      path: source.path,
      include: source.include,
      exclude: source.exclude,
      tags: source.tags,
    })),
  };
}

export function toRawConfig(config: DocSeekConfig): RawConfig {
  return {
    version: config.version,
    project_id: config.projectId,
    embedding: {
      provider: config.embedding.provider,
      model: config.embedding.model,
      dtype: config.embedding.dtype,
      query_prefix: config.embedding.queryPrefix,
      document_prefix: config.embedding.documentPrefix,
      batch_size: config.embedding.batchSize,
      max_tokens: config.embedding.maxTokens,
    },
    chunking: { max_chars: config.chunking.maxChars },
    search: {
      vector_weight: config.search.vectorWeight,
      keyword_weight: config.search.keywordWeight,
      semantic_best_distance: config.search.semanticBestDistance,
      semantic_weak_distance: config.search.semanticWeakDistance,
      minimum_confidence: config.search.minimumConfidence,
      candidate_pool: config.search.candidatePool,
    },
    sources: config.sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      path: source.path,
      include: [...source.include],
      exclude: [...source.exclude],
      tags: [...source.tags],
    })),
  };
}

export function createDefaultConfig(): DocSeekConfig {
  return fromRawConfig({
    version: CONFIG_VERSION,
    project_id: randomUUID(),
    embedding: {
      provider: "transformers",
      model: "Xenova/multilingual-e5-small",
      dtype: "q8",
      query_prefix: "query: ",
      document_prefix: "passage: ",
      batch_size: 8,
      max_tokens: 288,
    },
    chunking: { max_chars: 1800 },
    search: defaultSearchConfig,
    sources: [
      {
        id: "project",
        kind: "markdown-directory",
        path: ".",
        include: ["**/*.md"],
        exclude: ["**/.git/**", "**/.docseek/**", "**/node_modules/**"],
        tags: [],
      },
    ],
  });
}
