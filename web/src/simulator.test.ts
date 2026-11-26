import test from "node:test";
import assert from "node:assert/strict";
import { DATA } from "./data.js";
import {
  buildCompactTree,
  buildSearchCommand,
  computeCompressionStats,
  detectQueryMode,
  extractTokens,
  formatSearchJsonOutput,
  parseQueryParts,
  simulateHybridSearch
} from "./simulator.js";

test("parseQueryParts preserves quoted divergent candidates", () => {
  assert.deepEqual(
    parseQueryParts(`"容量判断" "Worker启动时间" "SLA可行性"`),
    ["容量判断", "Worker启动时间", "SLA可行性"]
  );
  assert.equal(detectQueryMode(["容量判断", "SLA"]), "candidate-terms");
  assert.equal(detectQueryMode(["为什么系统在高峰期会触发违约退款？"]), "strict-question");
});

test("extractTokens generates Chinese bigrams and English identifiers", () => {
  const tokens = extractTokens("容量判断 cold-start");
  assert.ok(tokens.includes("容量"));
  assert.ok(tokens.includes("判断"));
  assert.ok(tokens.includes("cold-start"));
});

test("simulateHybridSearch ranks relevant hits and filters unrelated queries", () => {
  const hit = simulateHybridSearch(DATA.sandboxCorpus, `"容量判断" "Worker启动时间" "SLA可行性"`);
  assert.ok(hit.results.length >= 4);
  assert.ok(hit.results[0].score > 0.5 && hit.results[0].score <= 1);

  const empty = simulateHybridSearch(DATA.sandboxCorpus, `"火星天气预报" "火箭菜谱"`);
  assert.equal(empty.results.length, 0);
});

test("buildCompactTree folds single branches and significantly compresses JSON", () => {
  const sim = simulateHybridSearch(DATA.sandboxCorpus, `"容量判断" "Worker启动时间" "SLA可行性"`);
  const tree = buildCompactTree(sim.results);
  const json = formatSearchJsonOutput(sim.results);
  const stats = computeCompressionStats(tree, json);

  assert.ok(tree.includes("inferforge-docs/"));
  assert.ok(tree.includes("›") || tree.includes("×"));
  assert.ok(stats.charSavedPct >= 50, `expected >= 50% char savings, got ${stats.charSavedPct}%`);
});

test("buildSearchCommand composes valid docseek search CLI strings", () => {
  const cmd = buildSearchCommand({
    terms: ["SLA", "违约"],
    path: "docs/模块设计/",
    top: "5",
    json: true,
    explain: true
  });
  assert.equal(cmd, `docseek search "SLA" "违约" --path docs/模块设计/ --top 5 --json --explain`);
});
