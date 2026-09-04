export function normalizeVector(values: ArrayLike<number>): Float32Array {
  let squaredNorm = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Vector contains an invalid value at position ${index}.`);
    }
    squaredNorm += value * value;
  }
  const norm = Math.sqrt(squaredNorm);
  if (norm === 0) {
    throw new Error("Vector has zero length.");
  }
  const normalized = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    normalized[index] = (values[index] ?? 0) / norm;
  }
  return normalized;
}

export function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error(`Cannot compare vector dimensions ${left.length} and ${right.length}.`);
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function validateVectors(vectors: readonly Float32Array[], expectedCount: number): number {
  if (vectors.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} vectors, received ${vectors.length}.`);
  }
  const dimension = vectors[0]?.length ?? 0;
  if (dimension === 0) {
    throw new Error("Embedding provider returned empty vectors.");
  }
  for (const [row, vector] of vectors.entries()) {
    if (vector.length !== dimension) {
      throw new Error(`Vector ${row} has dimension ${vector.length}; expected ${dimension}.`);
    }
    let squaredNorm = 0;
    for (const [column, value] of vector.entries()) {
      if (!Number.isFinite(value)) {
        throw new Error(`Vector ${row} contains an invalid value at column ${column}.`);
      }
      squaredNorm += value * value;
    }
    const norm = Math.sqrt(squaredNorm);
    if (Math.abs(norm - 1) > 0.02) {
      throw new Error(`Vector ${row} is not normalized; length is ${norm.toFixed(6)}.`);
    }
  }
  return dimension;
}
