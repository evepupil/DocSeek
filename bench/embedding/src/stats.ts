export interface NumericSummary {
  readonly minimum: number;
  readonly median: number;
  readonly maximum: number;
}

export function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (ratio < 0 || ratio > 1) {
    throw new RangeError("Percentile ratio must be between zero and one.");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

export function summarizeNumbers(values: readonly number[]): NumericSummary {
  if (values.length === 0) {
    return { minimum: 0, median: 0, maximum: 0 };
  }
  return {
    minimum: Math.min(...values),
    median: percentile(values, 0.5),
    maximum: Math.max(...values),
  };
}
