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
    }),
    chunking: z.strictObject({
      max_chars: z.int().min(256).max(32_000),
    }),
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((config, context) => {
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
    },
    chunking: { maxChars: raw.chunking.max_chars },
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
    },
    chunking: { max_chars: config.chunking.maxChars },
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
    },
    chunking: { max_chars: 1800 },
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
