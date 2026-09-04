import { DocSeekError } from "../domain/errors.js";

function normalize(values: Float32Array): Float32Array {
  let squaredNorm = 0;
  for (const value of values) {
    squaredNorm += value * value;
  }
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new DocSeekError(
      "EMBEDDING_VALUE_INVALID",
      "The embedding model returned a zero vector.",
    );
  }
  for (let index = 0; index < values.length; index += 1) {
    values[index] = (values[index] ?? 0) / norm;
  }
  return values;
}

export function meanPoolAndNormalize(
  hiddenState: ArrayLike<number>,
  hiddenDimensions: readonly number[],
  attentionMask: ArrayLike<bigint | number>,
): readonly Float32Array[] {
  const batch = hiddenDimensions[0];
  const tokens = hiddenDimensions[1];
  const dimension = hiddenDimensions[2];
  if (
    !batch ||
    !tokens ||
    !dimension ||
    hiddenState.length !== batch * tokens * dimension ||
    attentionMask.length !== batch * tokens
  ) {
    throw new DocSeekError(
      "EMBEDDING_SHAPE_INVALID",
      `Unexpected embedding tensors: hidden [${hiddenDimensions.join(", ")}], mask length ${attentionMask.length}.`,
    );
  }

  return Array.from({ length: batch }, (_, row) => {
    const pooled = new Float32Array(dimension);
    let includedTokens = 0;
    for (let token = 0; token < tokens; token += 1) {
      const mask = Number(attentionMask[row * tokens + token] ?? 0);
      if (mask === 0) {
        continue;
      }
      includedTokens += 1;
      const offset = (row * tokens + token) * dimension;
      for (let column = 0; column < dimension; column += 1) {
        const value = hiddenState[offset + column];
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new DocSeekError(
            "EMBEDDING_VALUE_INVALID",
            "The embedding model returned an invalid value.",
          );
        }
        pooled[column] = (pooled[column] ?? 0) + value;
      }
    }
    if (includedTokens === 0) {
      throw new DocSeekError(
        "EMBEDDING_SHAPE_INVALID",
        `Embedding row ${row} has no unmasked tokens.`,
      );
    }
    for (let column = 0; column < dimension; column += 1) {
      pooled[column] = (pooled[column] ?? 0) / includedTokens;
    }
    return normalize(pooled);
  });
}
