import type { BatchingStrategy, EmbeddingBatchResult } from "../types.js";

export interface OrderedText {
  readonly originalIndex: number;
  readonly text: string;
}

export function orderTexts(
  texts: readonly string[],
  strategy: BatchingStrategy,
): readonly OrderedText[] {
  const ordered = texts.map((text, originalIndex) => ({ originalIndex, text }));
  if (strategy === "length-bucketed") {
    ordered.sort(
      (left, right) =>
        left.text.length - right.text.length || left.originalIndex - right.originalIndex,
    );
  }
  return ordered;
}

export function restoreVectorOrder(
  ordered: readonly OrderedText[],
  orderedVectors: readonly Float32Array[],
): readonly Float32Array[] {
  if (ordered.length !== orderedVectors.length) {
    throw new Error("Ordered text and vector counts do not match.");
  }
  const restored: Array<Float32Array | undefined> = [];
  for (let index = 0; index < ordered.length; index += 1) {
    restored.push(undefined);
  }
  ordered.forEach((item, index) => {
    restored[item.originalIndex] = orderedVectors[index];
  });
  return restored.map((vector, index) => {
    if (!vector) {
      throw new Error(`Vector ${index} was not restored to its original position.`);
    }
    return vector;
  });
}

export async function embedInBatches(
  texts: readonly string[],
  batchSize: number,
  embedBatch: (batch: readonly string[]) => Promise<readonly Float32Array[]>,
  onBatch: () => void,
  strategy: BatchingStrategy,
): Promise<EmbeddingBatchResult> {
  if (batchSize <= 0) {
    throw new RangeError("Batch size must be greater than zero.");
  }
  const ordered = orderTexts(texts, strategy);
  const orderedVectors: Float32Array[] = [];
  let batchCalls = 0;
  for (let offset = 0; offset < ordered.length; offset += batchSize) {
    const batch = ordered.slice(offset, offset + batchSize).map((item) => item.text);
    const embedded = await embedBatch(batch);
    if (embedded.length !== batch.length) {
      throw new Error(`Batch returned ${embedded.length} vectors for ${batch.length} texts.`);
    }
    orderedVectors.push(...embedded);
    batchCalls += 1;
    onBatch();
  }
  return { vectors: restoreVectorOrder(ordered, orderedVectors), batchCalls };
}
