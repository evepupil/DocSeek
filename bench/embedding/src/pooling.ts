import type { PoolingStrategy } from "./types.js";
import { normalizeVector } from "./vectors.js";

interface HiddenStateShape {
  readonly batch: number;
  readonly tokens: number;
  readonly dimension: number;
}

function parseHiddenStateShape(
  hiddenState: Float32Array,
  hiddenDims: readonly number[],
): HiddenStateShape {
  const batch = hiddenDims[0];
  const tokens = hiddenDims[1];
  const dimension = hiddenDims[2];
  if (!batch || !tokens || !dimension || hiddenState.length !== batch * tokens * dimension) {
    throw new Error(`Unexpected ONNX hidden state shape [${hiddenDims.join(", ")}].`);
  }
  return { batch, tokens, dimension };
}

export function meanPoolAndNormalize(
  hiddenState: Float32Array,
  hiddenDims: readonly number[],
  attentionMask: ArrayLike<bigint>,
): readonly Float32Array[] {
  const { batch, tokens, dimension } = parseHiddenStateShape(hiddenState, hiddenDims);
  if (attentionMask.length !== batch * tokens) {
    throw new Error("Attention mask does not match the hidden state shape.");
  }
  return Array.from({ length: batch }, (_, row) => {
    const pooled = new Float32Array(dimension);
    let includedTokens = 0;
    for (let token = 0; token < tokens; token += 1) {
      if (attentionMask[row * tokens + token] === 0n) {
        continue;
      }
      includedTokens += 1;
      const offset = (row * tokens + token) * dimension;
      for (let column = 0; column < dimension; column += 1) {
        pooled[column] = (pooled[column] ?? 0) + (hiddenState[offset + column] ?? 0);
      }
    }
    if (includedTokens === 0) {
      throw new Error(`ONNX row ${row} has no unmasked tokens.`);
    }
    for (let column = 0; column < dimension; column += 1) {
      pooled[column] = (pooled[column] ?? 0) / includedTokens;
    }
    return normalizeVector(pooled);
  });
}

export function clsPoolAndNormalize(
  hiddenState: Float32Array,
  hiddenDims: readonly number[],
): readonly Float32Array[] {
  const { batch, tokens, dimension } = parseHiddenStateShape(hiddenState, hiddenDims);
  return Array.from({ length: batch }, (_, row) => {
    const offset = row * tokens * dimension;
    return normalizeVector(hiddenState.subarray(offset, offset + dimension));
  });
}

export function poolAndNormalize(
  strategy: PoolingStrategy,
  hiddenState: Float32Array,
  hiddenDims: readonly number[],
  attentionMask: ArrayLike<bigint>,
): readonly Float32Array[] {
  return strategy === "cls"
    ? clsPoolAndNormalize(hiddenState, hiddenDims)
    : meanPoolAndNormalize(hiddenState, hiddenDims, attentionMask);
}
