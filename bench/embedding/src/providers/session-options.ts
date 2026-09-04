import type { ProviderOptions } from "../types.js";

export interface OnnxThreadOptions {
  readonly intraOpNumThreads?: number;
  readonly interOpNumThreads?: number;
  readonly executionMode: "sequential";
}

export function onnxThreadOptions(options: ProviderOptions): OnnxThreadOptions | undefined {
  if (options.intraOpThreads === undefined && options.interOpThreads === undefined) {
    return undefined;
  }
  return {
    ...(options.intraOpThreads !== undefined ? { intraOpNumThreads: options.intraOpThreads } : {}),
    ...(options.interOpThreads !== undefined ? { interOpNumThreads: options.interOpThreads } : {}),
    executionMode: "sequential",
  };
}
