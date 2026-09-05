import type { EmbeddingProvider, ProviderOptions } from "../types.js";
import { DirectOrtProvider } from "./direct-ort.js";
import { FastEmbedProvider } from "./fastembed.js";
import { LlamaCppProvider } from "./llama-cpp.js";
import { StaticOrtProvider } from "./static-ort.js";
import { TransformersCoreProvider } from "./transformers-core.js";
import { TransformersProvider } from "./transformers.js";

export function createProvider(options: ProviderOptions): EmbeddingProvider {
  switch (options.id) {
    case "transformers":
      return new TransformersProvider(options);
    case "transformers-core":
      return new TransformersCoreProvider(options);
    case "direct-ort":
      return new DirectOrtProvider(options);
    case "static-ort":
      return new StaticOrtProvider(options);
    case "fastembed":
      return new FastEmbedProvider(options);
    case "llama-cpp":
      return new LlamaCppProvider(options);
  }
}
