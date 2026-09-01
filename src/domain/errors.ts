export class DocSeekError extends Error {
  readonly code: string;
  override readonly cause?: unknown;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "DocSeekError";
    this.code = code;
    if (options && "cause" in options) {
      this.cause = options.cause;
    }
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
