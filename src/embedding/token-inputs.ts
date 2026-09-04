import { DocSeekError } from "../domain/errors.js";

export interface EncodedTokenBatch {
  readonly inputIds: readonly (readonly number[])[];
  readonly tokenTypeIds?: readonly (readonly number[])[];
}

export interface PreparedTokenBatch {
  readonly dimensions: readonly [number, number];
  readonly inputIds: BigInt64Array;
  readonly attentionMask: BigInt64Array;
  readonly tokenTypeIds?: BigInt64Array;
}

interface SelectedTokens {
  readonly inputIds: readonly number[];
  readonly tokenTypeIds?: readonly number[];
}

function selectHeadAndTail(
  inputIds: readonly number[],
  tokenTypeIds: readonly number[] | undefined,
  maximumTokens: number,
  separatorTokenId: number,
): SelectedTokens {
  if (inputIds.length <= maximumTokens) {
    return {
      inputIds,
      ...(tokenTypeIds ? { tokenTypeIds } : {}),
    };
  }
  const contentTokens = maximumTokens - 1;
  const headLength = Math.ceil(contentTokens / 2);
  const tailLength = contentTokens - headLength;
  return {
    inputIds: [
      ...inputIds.slice(0, headLength),
      separatorTokenId,
      ...inputIds.slice(inputIds.length - tailLength),
    ],
    ...(tokenTypeIds
      ? {
          tokenTypeIds: [
            ...tokenTypeIds.slice(0, headLength),
            0,
            ...tokenTypeIds.slice(tokenTypeIds.length - tailLength),
          ],
        }
      : {}),
  };
}

export function prepareTokenBatch(
  encoded: EncodedTokenBatch,
  maximumTokens: number,
  paddingTokenId: number,
  separatorTokenId: number,
): PreparedTokenBatch {
  if (
    maximumTokens < 3 ||
    encoded.inputIds.length === 0 ||
    !Number.isSafeInteger(paddingTokenId) ||
    !Number.isSafeInteger(separatorTokenId)
  ) {
    throw new DocSeekError(
      "EMBEDDING_INPUT_INVALID",
      "Embedding token batches require text, valid padding and separator tokens, and a maximum length of at least three.",
    );
  }
  if (encoded.tokenTypeIds && encoded.tokenTypeIds.length !== encoded.inputIds.length) {
    throw new DocSeekError("EMBEDDING_INPUT_INVALID", "Token type rows do not match input rows.");
  }

  const selected = encoded.inputIds.map((inputIds, row) => {
    if (inputIds.length === 0) {
      throw new DocSeekError("EMBEDDING_INPUT_INVALID", `Embedding input row ${row} is empty.`);
    }
    const tokenTypeIds = encoded.tokenTypeIds?.[row];
    if (tokenTypeIds && tokenTypeIds.length !== inputIds.length) {
      throw new DocSeekError(
        "EMBEDDING_INPUT_INVALID",
        `Token type row ${row} does not match its input row.`,
      );
    }
    return selectHeadAndTail(inputIds, tokenTypeIds, maximumTokens, separatorTokenId);
  });
  const sequenceLength = Math.max(...selected.map((row) => row.inputIds.length));
  const elementCount = selected.length * sequenceLength;
  const inputIds = new BigInt64Array(elementCount).fill(BigInt(paddingTokenId));
  const attentionMask = new BigInt64Array(elementCount);
  const tokenTypeIds = encoded.tokenTypeIds ? new BigInt64Array(elementCount) : undefined;

  selected.forEach((row, rowIndex) => {
    const offset = rowIndex * sequenceLength;
    row.inputIds.forEach((token, tokenIndex) => {
      inputIds[offset + tokenIndex] = BigInt(token);
      attentionMask[offset + tokenIndex] = 1n;
    });
    row.tokenTypeIds?.forEach((token, tokenIndex) => {
      if (tokenTypeIds) {
        tokenTypeIds[offset + tokenIndex] = BigInt(token);
      }
    });
  });

  return {
    dimensions: [selected.length, sequenceLength],
    inputIds,
    attentionMask,
    ...(tokenTypeIds ? { tokenTypeIds } : {}),
  };
}
