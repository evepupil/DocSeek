import type { EmbeddingProvider } from "../domain/contracts.js";
import type { EmbeddingConfig } from "../domain/types.js";
import { TransformersEmbeddingProvider } from "./transformers-provider.js";

const providerFactories: Record<
  EmbeddingConfig["provider"],
  (config: EmbeddingConfig) => EmbeddingProvider
> = {
  transformers: (config) => new TransformersEmbeddingProvider(config),
};

export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  return providerFactories[config.provider](config);
}
