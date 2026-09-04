export interface OrderedEmbeddingText {
  readonly originalIndex: number;
  readonly text: string;
}

export function orderEmbeddingTexts(texts: readonly string[]): readonly OrderedEmbeddingText[] {
  return texts
    .map((text, originalIndex) => ({ originalIndex, text }))
    .sort(
      (left, right) =>
        left.text.length - right.text.length || left.originalIndex - right.originalIndex,
    );
}

export function restoreEmbeddingOrder(
  ordered: readonly OrderedEmbeddingText[],
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
