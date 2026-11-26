// Pure, DOM-free DocSeek retrieval, compact tree folding, and CLI command helpers.
// Mirrors DocSeek's real RRF k=8 (0.45 vec + 0.55 fts) fusion and single-branch › tree folding.

const QUESTION_STOPWORDS = new Set([
  "什么", "怎么", "如何", "为什么", "是否", "可以", "请问", "哪里", "哪些", "这个", "那个",
  "what", "how", "why", "where", "when", "does", "the", "and", "for", "with", "about"
]);

export function parseQueryParts(raw) {
  const input = String(raw || "").trim();
  if (!input) return [];
  const parts = [];
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    const token = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (token) parts.push(token);
  }
  return parts;
}

export function detectQueryMode(parts) {
  if (parts.length === 0) return "empty";
  const joined = parts.join(" ");
  const hasQuestionMark = /[?？]/.test(joined);
  const looksLikeSentence = parts.length === 1 && joined.length > 16;
  if (hasQuestionMark || looksLikeSentence) return "strict-question";
  return "candidate-terms";
}

export function extractTokens(text) {
  const clean = String(text || "").toLowerCase();
  const tokens = new Set();

  // Latin / numeric / code identifiers (min length 2)
  const latin = clean.match(/[a-z0-9][a-z0-9_-]{1,}/g) || [];
  for (const w of latin) {
    if (!QUESTION_STOPWORDS.has(w)) tokens.add(w);
  }

  // Chinese runs -> full run + continuous bigrams (mirrors DocSeek FTS5 bigram strategy)
  const cjkRuns = clean.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const run of cjkRuns) {
    if (!QUESTION_STOPWORDS.has(run)) tokens.add(run);
    for (let i = 0; i < run.length - 1; i++) {
      const bi = run.slice(i, i + 2);
      if (!QUESTION_STOPWORDS.has(bi)) tokens.add(bi);
    }
  }

  return Array.from(tokens);
}

// Lightweight semantic synonym clusters to simulate local multilingual-e5-small semantic recall
const SEMANTIC_CLUSTERS = [
  ["容量", "容量判断", "扩容", "scale out", "弹性", "gpu", "触发条件"],
  ["worker", "worker启动时间", "冷启动", "cold start", "warm pool", "预热", "启动", "就绪时间"],
  ["sla", "sla可行性", "违约", "退款", "赔付", "补偿", "超时", "延迟"],
  ["调度", "调度策略", "scheduler", "派活", "队列", "抢占", "preemption", "retry", "掉线"],
  ["索引", "哈希", "hash", "增量", "update", "ast", "mdast", "文档索引"],
  ["紧凑树", "树形输出", "折叠", "压缩", "字符", "token", "导航", "行号", "json"],
  ["混合检索", "rrf", "sqlite-vec", "fts5", "向量", "关键词", "融合", "评分", "explain"]
];

function semanticVectorScore(queryTokens, doc) {
  if (queryTokens.length === 0) return 0;
  const docTokens = new Set([
    ...extractTokens(doc.path),
    ...extractTokens(doc.headings.join(" ")),
    ...extractTokens(doc.snippet),
    ...(doc.terms || []).map(t => t.toLowerCase())
  ]);

  let matchedClusters = 0;
  let totalQueryClusters = 0;

  for (const cluster of SEMANTIC_CLUSTERS) {
    const qInCluster = queryTokens.some(qt =>
      cluster.some(c => c.includes(qt) || qt.includes(c))
    );
    if (!qInCluster) continue;
    totalQueryClusters++;
    const dInCluster = cluster.some(c =>
      docTokens.has(c) || Array.from(docTokens).some(dt => dt.includes(c) || c.includes(dt))
    );
    if (dInCluster) matchedClusters++;
  }

  // Direct overlap bonus for semantic similarity
  let directHits = 0;
  for (const qt of queryTokens) {
    if (docTokens.has(qt) || Array.from(docTokens).some(dt => dt.includes(qt) || qt.includes(dt))) {
      directHits++;
    }
  }
  const directRatio = directHits / Math.max(1, queryTokens.length);
  const clusterRatio = totalQueryClusters > 0 ? matchedClusters / totalQueryClusters : 0;

  return Math.min(0.96, clusterRatio * 0.62 + directRatio * 0.34);
}

function ftsKeywordScore(queryTokens, doc) {
  if (queryTokens.length === 0) return { bm25: 0, coverage: 0 };
  const headingText = doc.headings.join(" ").toLowerCase();
  const bodyText = (doc.path + " " + doc.snippet + " " + (doc.terms || []).join(" ")).toLowerCase();

  let score = 0;
  let covered = 0;
  for (const qt of queryTokens) {
    const inHeading = headingText.includes(qt);
    const inBody = bodyText.includes(qt);
    if (inHeading || inBody) {
      covered++;
      score += inHeading ? 4.8 : 2.2;
    }
  }
  return { bm25: score, coverage: covered / queryTokens.length };
}

export function simulateHybridSearch(corpus, rawQuery, options = {}) {
  const parts = parseQueryParts(rawQuery);
  const mode = detectQueryMode(parts);
  const pathFilter = String(options.path || "").trim().toLowerCase();
  const top = options.top ? Math.max(1, Math.min(100, Number(options.top))) : 100;

  if (parts.length === 0) {
    return { mode, parts, results: [] };
  }

  const queryTokens = Array.from(new Set(parts.flatMap(p => extractTokens(p))));
  if (queryTokens.length === 0) {
    return { mode, parts, results: [] };
  }

  const filtered = pathFilter
    ? corpus.filter(doc => doc.path.toLowerCase().includes(pathFilter))
    : corpus;

  const scored = filtered.map(doc => {
    const vecSim = semanticVectorScore(queryTokens, doc);
    const fts = ftsKeywordScore(queryTokens, doc);
    return { doc, vecSim, bm25: fts.bm25, coverage: fts.coverage };
  });

  // Compute rank in each route
  const vecRanked = [...scored]
    .filter(x => x.vecSim >= 0.25)
    .sort((a, b) => b.vecSim - a.vecSim || a.doc.id.localeCompare(b.doc.id));
  const ftsRanked = [...scored]
    .filter(x => x.bm25 > 0)
    .sort((a, b) => b.bm25 - a.bm25 || a.doc.id.localeCompare(b.doc.id));

  const vecRankMap = new Map(vecRanked.map((x, idx) => [x.doc.id, idx + 1]));
  const ftsRankMap = new Map(ftsRanked.map((x, idx) => [x.doc.id, idx + 1]));

  const RRF_K = 8;
  const maxRrf = 1 / (RRF_K + 1);

  const merged = [];
  for (const item of scored) {
    const vRank = vecRankMap.get(item.doc.id) || null;
    const fRank = ftsRankMap.get(item.doc.id) || null;
    if (!vRank && !fRank) continue;

    const rrfRaw =
      (vRank ? 0.45 / (RRF_K + vRank) : 0) +
      (fRank ? 0.55 / (RRF_K + fRank) : 0);
    const rrfNorm = Math.min(1, rrfRaw / maxRrf);

    // DocSeek absolute score formula: 0.60 * RRF + 0.20 * coverage + 0.20 * semantic
    const score = Number((0.60 * rrfNorm + 0.20 * item.coverage + 0.20 * item.vecSim).toFixed(3));

    let gate = null;
    if (vRank && fRank && vRank <= 5 && fRank <= 5 && score >= 0.48) {
      gate = "dual-route";
    } else if (score >= 0.54) {
      gate = "signal";
    } else if (mode === "candidate-terms" && vRank && vRank <= 3 && item.vecSim >= 0.48) {
      gate = "term-vector";
    } else if (mode === "candidate-terms" && fRank && fRank <= 3 && item.bm25 >= 2.2) {
      gate = "term-keyword";
    }

    if (!gate) continue;

    merged.push({
      id: item.doc.id,
      path: item.doc.path,
      headings: item.doc.headings,
      lineStart: item.doc.lineStart,
      lineEnd: item.doc.lineEnd,
      snippet: item.doc.snippet,
      score,
      explain: {
        mode,
        gate,
        vecRank: vRank,
        vecSim: Number(item.vecSim.toFixed(2)),
        ftsRank: fRank,
        bm25: Number(item.bm25.toFixed(1)),
        coverage: Number(item.coverage.toFixed(2))
      }
    });
  }

  merged.sort((a, b) =>
    b.score - a.score ||
    a.path.localeCompare(b.path) ||
    a.lineStart - b.lineStart ||
    a.id.localeCompare(b.id)
  );

  return { mode, parts, results: merged.slice(0, top) };
}

function fmtScore(score) {
  if (score >= 1) return "1.00";
  return `.${Math.round(score * 1000).toString().padStart(3, "0")}`;
}

function fmtLineRange(start, end) {
  return start === end ? `L${start}` : `L${start}-${end}`;
}

// Build DocSeek-style compact navigation tree with common prefix extraction & single-child folding
export function buildCompactTree(results) {
  if (!results || results.length === 0) return "";

  const splitPaths = results.map(r => r.path.split("/"));
  const minSegs = Math.min(...splitPaths.map(p => p.length));
  const commonPrefix = [];
  for (let i = 0; i < minSegs - 1; i++) {
    const seg = splitPaths[0][i];
    if (splitPaths.every(p => p[i] === seg)) commonPrefix.push(seg);
    else break;
  }

  const root = {
    name: commonPrefix.length > 0 ? commonPrefix.join("/") + "/" : ".",
    kind: "dir",
    children: new Map(),
    leaves: []
  };

  for (const r of results) {
    const relSegs = r.path.split("/").slice(commonPrefix.length);
    let node = root;
    for (let i = 0; i < relSegs.length; i++) {
      const seg = relSegs[i];
      const isFile = i === relSegs.length - 1;
      const key = `${isFile ? "file" : "dir"}:${seg}`;
      if (!node.children.has(key)) {
        node.children.set(key, {
          name: isFile ? seg : `${seg}/`,
          kind: isFile ? "file" : "dir",
          children: new Map(),
          leaves: []
        });
      }
      node = node.children.get(key);
    }
    for (const h of r.headings) {
      const key = `heading:${h}`;
      if (!node.children.has(key)) {
        node.children.set(key, {
          name: h,
          kind: "heading",
          children: new Map(),
          leaves: []
        });
      }
      node = node.children.get(key);
    }
    node.leaves.push({
      lineStart: r.lineStart,
      lineEnd: r.lineEnd,
      score: r.score
    });
  }

  function computeStats(node) {
    let count = 0;
    let sum = 0;
    let maxScore = 0;
    for (const leaf of node.leaves) {
      count++;
      sum += leaf.score;
      if (leaf.score > maxScore) maxScore = leaf.score;
    }
    for (const child of node.children.values()) {
      const st = computeStats(child);
      count += st.count;
      sum += st.sum;
      if (st.maxScore > maxScore) maxScore = st.maxScore;
    }
    node.stats = { count, sum, avg: count ? sum / count : 0, maxScore };
    return node.stats;
  }

  computeStats(root);

  function sortChildren(node) {
    return Array.from(node.children.values()).sort((a, b) =>
      b.stats.maxScore - a.stats.maxScore ||
      b.stats.avg - a.stats.avg ||
      b.stats.count - a.stats.count ||
      a.name.localeCompare(b.name)
    );
  }

  function renderNode(node, prefix, isLast) {
    // Fold single-child chains
    const labels = [node.name];
    let cur = node;
    while (cur.leaves.length === 0 && cur.children.size === 1) {
      const onlyChild = Array.from(cur.children.values())[0];
      const sep = cur.kind === "dir" && !onlyChild.name.startsWith("›") ? "" : " › ";
      if (cur.kind === "dir") {
        labels[labels.length - 1] += onlyChild.name;
      } else {
        labels.push(`${sep.trim()} ${onlyChild.name}`);
      }
      cur = onlyChild;
    }

    const branch = isLast ? "└─ " : "├─ ";
    const nextPrefix = prefix + (isLast ? "   " : "│  ");
    const joinedLabel = labels.join(" ").replace(/\s+›\s+/g, " › ");

    // Single leaf at end of chain -> inline on same line
    if (cur.children.size === 0 && cur.leaves.length === 1) {
      const lf = cur.leaves[0];
      return [`${prefix}${branch}${joinedLabel} ${fmtLineRange(lf.lineStart, lf.lineEnd)} ${fmtScore(lf.score)}`];
    }

    const lines = [`${prefix}${branch}${joinedLabel} ×${cur.stats.count} ${fmtScore(cur.stats.avg)}`];
    const items = [
      ...sortChildren(cur).map(ch => ({ type: "node", val: ch })),
      ...cur.leaves
        .slice()
        .sort((a, b) => b.score - a.score || a.lineStart - b.lineStart)
        .map(lf => ({ type: "leaf", val: lf }))
    ];

    items.forEach((it, idx) => {
      const last = idx === items.length - 1;
      if (it.type === "node") {
        lines.push(...renderNode(it.val, nextPrefix, last));
      } else {
        const lf = it.val;
        lines.push(`${nextPrefix}${last ? "└─ " : "├─ "}${fmtLineRange(lf.lineStart, lf.lineEnd)} ${fmtScore(lf.score)}`);
      }
    });
    return lines;
  }

  const out = [root.name];
  const topChildren = sortChildren(root);
  topChildren.forEach((ch, idx) => {
    out.push(...renderNode(ch, "", idx === topChildren.length - 1));
  });
  return out.join("\n");
}

export function formatSearchJsonOutput(results) {
  return JSON.stringify(
    results.map(r => ({
      path: r.path,
      headings: r.headings,
      lineStart: r.lineStart,
      lineEnd: r.lineEnd,
      score: r.score
    })),
    null,
    2
  );
}

export function computeCompressionStats(treeText, jsonText) {
  const treeChars = treeText.length;
  const jsonChars = jsonText.length;
  const treeLines = treeText ? treeText.split("\n").length : 0;
  const jsonLines = jsonText ? jsonText.split("\n").length : 0;
  const charSavedPct = jsonChars > 0 ? Math.max(0, Math.round((1 - treeChars / jsonChars) * 100)) : 0;
  const lineSavedPct = jsonLines > 0 ? Math.max(0, Math.round((1 - treeLines / jsonLines) * 100)) : 0;
  return { treeChars, jsonChars, treeLines, jsonLines, charSavedPct, lineSavedPct };
}

export function buildSearchCommand(opts) {
  const terms = (opts.terms || []).map(t => t.trim()).filter(Boolean);
  const quoted = terms.length > 0
    ? terms.map(t => `"${t.replace(/"/g, '\\"')}"`).join(" ")
    : `"容量判断" "Worker启动时间" "SLA可行性"`;
  const flags = [];
  if (opts.path && opts.path.trim()) flags.push(`--path ${opts.path.trim()}`);
  if (opts.top && opts.top !== "all") flags.push(`--top ${opts.top}`);
  if (opts.json) flags.push("--json");
  if (opts.snippet) flags.push("--snippet");
  if (opts.explain) flags.push("--explain");
  return `docseek search ${quoted}${flags.length ? " " + flags.join(" ") : ""}`;
}
