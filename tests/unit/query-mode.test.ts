import { describe, expect, it } from "vitest";

import { classifyQueryMode, hasSufficientTermEvidence } from "../../src/search/query-mode.js";

describe("search query mode", () => {
  it("recognizes divergent terms and compact standalone terms", () => {
    expect(classifyQueryMode("SLA 违约 退款 赔付", ["SLA", "违约", "退款", "赔付"])).toBe("terms");
    expect(classifyQueryMode("断连", ["断连"])).toBe("terms");
    expect(classifyQueryMode("cold start", ["cold start"])).toBe("terms");
  });

  it("keeps questions and calls without argument boundaries strict", () => {
    expect(classifyQueryMode("为什么 SLA 违约不退款", ["为什么 SLA 违约不退款"])).toBe("natural");
    expect(classifyQueryMode("How does worker recovery work", ["How", "does", "worker"])).toBe(
      "natural",
    );
    expect(classifyQueryMode("SLA 违约 退款", undefined)).toBe("natural");
  });

  it("requires project vocabulary before relaxing term confidence", () => {
    const candidates = [{ indexedTerms: ["sla", "赔付", "scheduler"] }];

    expect(hasSufficientTermEvidence(["SLA", "退款", "赔付"], candidates)).toBe(true);
    expect(hasSufficientTermEvidence(["SLA", "退款", "违约"], candidates)).toBe(false);
    expect(hasSufficientTermEvidence(["scheduler"], candidates)).toBe(true);
    expect(hasSufficientTermEvidence(["红烧肉", "糖色", "炖煮"], candidates)).toBe(false);
  });
});
