import type { BenchmarkDtype, PoolingStrategy, ProviderId } from "./types.js";

export function supportsConfigurablePooling(id: ProviderId): boolean {
  return id === "transformers" || id === "transformers-core" || id === "direct-ort";
}

export function modelUsesPlainText(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes("bge-small-zh") || normalized.includes("granite-embedding");
}

export function benchmarkPooling(model: string, requested: string | undefined): PoolingStrategy {
  const selected = requested ?? (modelUsesPlainText(model) ? "cls" : "mean");
  if (selected !== "mean" && selected !== "cls") {
    throw new Error("--pooling must be mean or cls.");
  }
  return selected;
}

export function benchmarkDtype(id: ProviderId, requested: string | undefined): BenchmarkDtype {
  const selected = requested ?? (id === "static-ort" ? "int8" : "q8");
  if (
    selected !== "fp32" &&
    selected !== "fp16" &&
    selected !== "q8" &&
    selected !== "int8" &&
    selected !== "uint8" &&
    selected !== "q4"
  ) {
    throw new Error("--dtype must be fp32, fp16, q8, int8, uint8, or q4.");
  }
  if (id === "static-ort" && selected !== "int8") {
    throw new Error("static-ort uses model_int8.onnx and requires --dtype int8.");
  }
  return selected;
}

export function validateProviderOptions(options: {
  readonly id: ProviderId;
  readonly poolingSpecified: boolean;
  readonly documentPrefix: string;
  readonly queryPrefix: string;
}): void {
  if (options.poolingSpecified && !supportsConfigurablePooling(options.id)) {
    throw new Error(
      "--pooling is only supported by transformers, transformers-core, and direct-ort.",
    );
  }
  if (
    options.id === "static-ort" &&
    (options.documentPrefix.length > 0 || options.queryPrefix.length > 0)
  ) {
    throw new Error("static-ort requires empty document and query prefixes.");
  }
}
