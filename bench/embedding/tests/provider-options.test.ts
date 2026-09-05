import { describe, expect, it } from "vitest";

import {
  benchmarkDtype,
  benchmarkPooling,
  modelUsesPlainText,
  validateProviderOptions,
} from "../src/provider-options.js";

describe("benchmark provider options", () => {
  it("selects and enforces the static model precision", () => {
    expect(benchmarkDtype("static-ort", undefined)).toBe("int8");
    expect(() => benchmarkDtype("static-ort", "q8")).toThrow("requires --dtype int8");
    expect(benchmarkDtype("transformers-core", undefined)).toBe("q8");
  });

  it("rejects options that static embeddings cannot apply", () => {
    expect(() => {
      validateProviderOptions({
        id: "static-ort",
        poolingSpecified: true,
        documentPrefix: "",
        queryPrefix: "",
      });
    }).toThrow("--pooling is only supported");
    expect(() => {
      validateProviderOptions({
        id: "static-ort",
        poolingSpecified: false,
        documentPrefix: "passage: ",
        queryPrefix: "",
      });
    }).toThrow("requires empty document and query prefixes");
  });

  it("recognizes complete BGE and Granite model identifiers", () => {
    expect(modelUsesPlainText("onnx-community/bge-small-zh-v1.5-ONNX")).toBe(true);
    expect(modelUsesPlainText("ibm-granite/granite-embedding-97m-multilingual-r2")).toBe(true);
    expect(modelUsesPlainText("Xenova/multilingual-e5-small")).toBe(false);
    expect(benchmarkPooling("onnx-community/bge-small-zh-v1.5-ONNX", undefined)).toBe("cls");
    expect(benchmarkPooling("Xenova/multilingual-e5-small", undefined)).toBe("mean");
  });
});
