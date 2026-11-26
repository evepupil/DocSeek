import { DATA } from "./data.js";
import {
  TRAIL_COLORS,
  copyText,
  esc,
  layoutGlyphLines,
  makeRng,
  svgBitmapText,
  svgPixelIcon
} from "./graphics.js";
import { initEmblemCanvas } from "./home.js";
import {
  buildCompactTree,
  buildSearchCommand,
  computeCompressionStats,
  formatSearchJsonOutput,
  simulateHybridSearch
} from "./simulator.js";

const STAMP_PALETTE = [
  { idx: "0", name: "Paper", hex: "#FFFFFF" },
  { idx: "1", name: "Ink", hex: "#0A0A0A" },
  { idx: "2", name: "Sodium", hex: "#F3ACF0" },
  { idx: "3", name: "Blue", hex: "#2370E8" },
  { idx: "4", name: "Pink", hex: "#D873B3" },
  { idx: "5", name: "Green", hex: "#2BA676" },
  { idx: "6", name: "Lavender", hex: "#A98BF7" },
  { idx: "7", name: "Coral", hex: "#FF5A5A" },
  { idx: "8", name: "Amber", hex: "#F5B700" }
];

// Route 2: Agent Integration (#/agents)
export function renderAgents(main, runtime) {
  document.title = "Agent 接入" + DATA.copy.siteTitleSuffix;
  let filterMode = "all";
  let selectedId = DATA.agents[0].id;

  main.innerHTML = `
    <section class="sub-sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(Agent 接入矩阵)</p>
        <div class="col-5-12">
          <h1 class="t-h1" tabindex="-1">只依赖命令行，任意 Coding Agent 开箱即用。</h1>
          <p class="t-body" style="margin-top:16px;">全局安装自动维护 <code class="t-mono">~/.codex/AGENTS.md</code> 与 <code class="t-mono">~/.claude/CLAUDE.md</code> 内的闭合标签规则块；其余工具可直接复用 <code class="t-mono">docseek instructions</code> 输出或原生 Shell 调用，无需配置 MCP。</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;" id="agent-filters">
            <button type="button" class="chip-toggle t-small" data-af="all" aria-pressed="true">(全部 8 项)</button>
            <button type="button" class="chip-toggle t-small" data-af="auto" aria-pressed="false">(postinstall 自动注入)</button>
            <button type="button" class="chip-toggle t-small" data-af="cli" aria-pressed="false">(通用 Shell / Rules / JSON)</button>
          </div>
        </div>
        <div class="col-full" id="agents-grid-box" style="margin-top:32px;"></div>
        <div class="col-full" id="agent-detail-box" style="margin-top:40px;"></div>
      </div>
    </section>

    <section class="sec" data-surface="paper">
      <div class="grid">
        <p class="col-1-3 t-micro">(注入规则全文)</p>
        <div class="col-5-12">
          <h2 class="t-h2">闭合标签幂等维护，绝不破坏你的原有规则。</h2>
          <p class="t-body" style="margin-top:12px;">升级 DocSeek 版本时只原位替换 <code class="t-mono">DOCSEEK:INSTRUCTIONS:START/END</code> 之间内容；索引项目文档时还会自动屏蔽自身规则块（保留换行），防止搜索自匹配。</p>
          <div class="code-header" style="margin-top:24px;">
            <span class="t-micro fw-600">docseek instructions 标准输出</span>
            <button type="button" class="cmd-copy-btn" id="copy-inst-block">复制规则块</button>
          </div>
          <pre class="code-block" id="inst-block-pre">&lt;!-- DOCSEEK:INSTRUCTIONS:START --&gt;
## Documentation lookup with DocSeek

- Before the first search in a project, run \`docseek status\`; run \`docseek init\` first when uninitialized, or \`docseek update\` when changes are pending.
- Use DocSeek like semantic \`grep\` / \`rg\`: search with divergent candidate terms instead of a complete natural-language question.
- Start with 2-5 short candidates such as synonyms, abbreviations, translations, domain terms, and likely project jargon: \`docseek search "SLA" "违约" "退款" "赔付"\`.
- Multiple arguments form one query. Broaden the candidate terms when the first search misses; use \`--path\` or \`--top\` only after useful locations appear.
- Treat results as navigation and read the returned Markdown ranges before drawing conclusions.
- Keep compact output by default; use \`--json\`, \`--snippet\`, or \`--explain\` only when needed.
&lt;!-- DOCSEEK:INSTRUCTIONS:END --&gt;</pre>
        </div>
      </div>
    </section>
  `;

  const gridBox = document.getElementById("agents-grid-box");
  const detailBox = document.getElementById("agent-detail-box");
  const filterBtns = Array.from(document.querySelectorAll("#agent-filters [data-af]"));

  function renderDetail() {
    const ag = DATA.agents.find(x => x.id === selectedId) || DATA.agents[0];
    detailBox.innerHTML = `
      <div class="venue-details">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px;">
          <div>
            <p class="t-micro">(当前选中环境 · ${esc(ag.flag)})</p>
            <h2 class="t-h2" style="margin-top:4px;">${esc(ag.name)} — ${esc(ag.mode)}</h2>
          </div>
          <div class="cmd-inline">
            <span>$ ${esc(ag.entryCmd)}</span>
            <button type="button" class="cmd-copy-btn" id="ag-copy-btn">复制</button>
          </div>
        </div>
        <p class="t-body" style="margin-top:16px;">${esc(ag.highlight)}</p>
        <ul class="access-list t-small" style="margin-top:20px;">
          <li><strong>规则位置 / 协议：</strong><code class="t-mono">${esc(ag.rulePath)}</code></li>
          <li><strong>推荐指令：</strong><code class="t-mono">${esc(ag.entryCmd)}</code></li>
          <li><strong>典型检索链路：</strong><code class="t-mono">${esc(ag.cliFlow)}</code></li>
          <li><strong>结构化输出：</strong>支持 <code class="t-mono">--json</code> 与非零失败退出码</li>
        </ul>
      </div>
    `;
    document.getElementById("ag-copy-btn").addEventListener("click", e => copyText(ag.entryCmd, e.currentTarget));
  }

  function renderGrid() {
    const list = DATA.agents.filter(ag => {
      if (filterMode === "auto") return ag.autoInject;
      if (filterMode === "cli") return !ag.autoInject;
      return true;
    });
    if (!list.some(x => x.id === selectedId) && list[0]) selectedId = list[0].id;
    gridBox.innerHTML = `<div class="speakers-preview-grid">
      ${list.map(ag => `
        <figure class="speaker-card">
          <button type="button" class="speaker-card-link" style="width:100%;text-align:left;${ag.id === selectedId ? "outline:3px solid var(--ink);outline-offset:4px;" : ""}" data-select-ag="${esc(ag.id)}">
            <canvas class="portrait-canvas" data-agid="${esc(ag.id)}" role="img" aria-label="${esc(ag.name)}"></canvas>
            <figcaption class="speaker-card-figcap">
              <h3 class="t-lead speaker-card-name">${esc(ag.name)}</h3>
              <p class="t-micro speaker-card-role">${esc(ag.mode)}</p>
              <p class="t-micro t-mono speaker-card-talk">${ag.autoInject ? "自动维护规则" : "CLI / Rules"}</p>
            </figcaption>
          </button>
        </figure>
      `).join("")}
    </div>`;
    list.forEach(ag => {
      const cv = gridBox.querySelector(`canvas[data-agid="${ag.id}"]`);
      if (cv) initEmblemCanvas(cv, ag, runtime);
    });
    gridBox.querySelectorAll("[data-select-ag]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedId = btn.dataset.selectAg;
        renderGrid();
        renderDetail();
      });
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterMode = btn.dataset.af;
      filterBtns.forEach(b => b.setAttribute("aria-pressed", b.dataset.af === filterMode ? "true" : "false"));
      renderGrid();
      renderDetail();
    });
  });

  document.getElementById("copy-inst-block").addEventListener("click", e => {
    copyText(document.getElementById("inst-block-pre").textContent, e.currentTarget);
  });

  renderGrid();
  renderDetail();
}

// Route 3: Architecture & Hybrid Search (#/architecture)
export function renderArchitecture(main) {
  document.title = "架构与检索" + DATA.copy.siteTitleSuffix;
  let selectedId = DATA.archModules[0].id;

  main.innerHTML = `
    <section class="sub-sec" data-surface="paper">
      <div class="grid">
        <p class="col-1-3 t-micro">(系统分层蓝图)</p>
        <div class="col-5-12">
          <h1 class="t-h1" tabindex="-1">单进程本地 CLI，清晰分层零常驻。</h1>
          <p class="t-body" style="margin-top:16px;">点击架构图中的任意模块或右侧索引，查看 DocSeek 源码目录职责、跨文件批量分桶索引与 SQLite 统一存储边界。</p>
        </div>
      </div>

      <div class="grid venue-grid">
        <div class="col-1-8">
          <svg class="venue-svg" id="arch-svg" viewBox="0 0 40 24" shape-rendering="crispEdges" role="img" aria-label="DocSeek 模块架构图"></svg>
          <p class="t-micro" style="margin-top:8px;">(Fig. 2 — DocSeek 模块分层图：CLI 与规则注入 → 应用编排 / AST / Embedding → 混合融合与 SQLite 存储。)</p>
        </div>
        <div class="col-9-12">
          <div class="venue-room-list" id="arch-list">
            ${DATA.archModules.map(m => `
              <button type="button" class="venue-room-btn t-small" data-mod="${esc(m.id)}" aria-pressed="${m.id === selectedId ? "true" : "false"}">
                <span class="fw-600">${esc(m.label)}</span>
                <span class="t-micro t-mono">${esc(m.chip)}</span>
              </button>
            `).join("")}
          </div>
          <div class="venue-details" id="arch-details"></div>
        </div>
      </div>
    </section>

    <section class="sec" data-surface="ink">
      <div class="grid">
        <p class="col-1-3 t-micro">(混合检索评分与存储)</p>
        <div class="col-5-12">
          <h2 class="t-h2 t-paper">可解释的双路融合，绝不把弱噪声伪装成 1.00。</h2>
          <p class="t-body t-paper" style="margin-top:16px;opacity:0.86;">所有权重、RRF 常数与放行门槛均经过 InferForge 90 条发散词实测与 34 条质量门禁回归校验，离线评测复用完全一致的生产执行管线。</p>
        </div>
        <div class="col-full" style="margin-top:32px;">
          <table class="data-table responsive-table">
            <thead>
              <tr>
                <th class="t-micro">编号</th>
                <th class="t-micro">核心机制</th>
                <th class="t-micro">公式 / 参数</th>
                <th class="t-micro">工程约束</th>
              </tr>
            </thead>
            <tbody>
              ${DATA.hybridSpecs.map(s => `
                <tr>
                  <td data-label="编号" class="t-micro t-mono">${esc(s.id.toUpperCase())}</td>
                  <td data-label="核心机制" class="t-small fw-600 t-paper">${esc(s.item)}</td>
                  <td data-label="公式 / 参数" class="t-micro t-mono t-sodium">${esc(s.formula)}</td>
                  <td data-label="工程约束" class="t-small t-paper">${esc(s.detail)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(本地数据目录)</p>
        <div class="col-5-12">
          <h2 class="t-h2">项目级隔离存储，模型用户级缓存。</h2>
          <div class="code-header" style="margin-top:24px;">
            <span class="t-micro fw-600">项目根目录 .docseek/（自动写入 .gitignore）</span>
            <span class="t-micro t-mono">SQLite + TOML</span>
          </div>
          <pre class="code-block">.docseek/
├─ config.toml   # 版本化项目配置、文档来源与模型标识
└─ index.db      # SQLite 统一索引（11 张表：documents/chunks/sqlite-vec/FTS5/tags）

# 数据层次（已预留扩展边界，未来开放 add / --tag / 跨项目集合）
Collection → Source → Document → Chunk (标题路径 + L起-止) → Embedding (384D)</pre>
        </div>
      </div>
    </section>
  `;

  const svg = document.getElementById("arch-svg");
  const detailsEl = document.getElementById("arch-details");
  const listBtns = Array.from(document.querySelectorAll("#arch-list [data-mod]"));

  function paint() {
    let out = `<rect x="0" y="0" width="40" height="24" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="0.35"/>`;
    DATA.archModules.forEach(m => {
      const sel = m.id === selectedId;
      out += `<g class="venue-room-shape" data-mod="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.label)}">`;
      out += `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${m.fill}" stroke="#0A0A0A" stroke-width="${sel ? "0.65" : "0.22"}"/>`;
      out += `<text x="${m.x + 0.7}" y="${m.y + 2.2}" font-family="Inter Tight, Noto Sans SC, sans-serif" font-size="1.35" font-weight="700" fill="${m.text}">${esc(m.label)}</text>`;
      out += `<text x="${m.x + 0.7}" y="${m.y + 4.0}" font-family="JetBrains Mono, monospace" font-size="0.9" fill="${m.text}" opacity="0.88">${esc(m.pkg)}</text>`;
      out += `<text x="${m.x + 0.7}" y="${m.y + m.h - 1.0}" font-family="JetBrains Mono, monospace" font-size="0.85" font-weight="600" fill="${m.text}">[${esc(m.chip)}]</text>`;
      out += `</g>`;
    });
    svg.innerHTML = out;
    svg.querySelectorAll("[data-mod]").forEach(el => {
      el.addEventListener("click", () => { selectedId = el.dataset.mod; paint(); });
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectedId = el.dataset.mod; paint(); }
      });
    });
    listBtns.forEach(b => b.setAttribute("aria-pressed", b.dataset.mod === selectedId ? "true" : "false"));
    const m = DATA.archModules.find(x => x.id === selectedId) || DATA.archModules[0];
    detailsEl.innerHTML = `
      <p class="t-micro t-mono">${esc(m.pkg)} · ${esc(m.chip)}</p>
      <h2 class="t-lead" style="margin-top:6px;">${esc(m.label)}</h2>
      <p class="t-small" style="margin-top:10px;">${esc(m.summary)}</p>
      <ul class="access-list t-small">
        ${m.details.map(d => `<li>${esc(d)}</li>`).join("")}
      </ul>
    `;
  }

  listBtns.forEach(b => b.addEventListener("click", () => { selectedId = b.dataset.mod; paint(); }));
  paint();
}

// Route 4: CLI & Evaluation Reference (#/docs)
export function renderDocs(main) {
  document.title = "CLI 手册" + DATA.copy.siteTitleSuffix;
  let query = "";
  let kindFilter = "all";
  let openId = "cli-search";

  main.innerHTML = `
    <section class="sub-sec" data-surface="paper">
      <div class="grid">
        <p class="col-1-3 t-micro">(CLI & 评测手册)</p>
        <div class="col-5-12">
          <h1 class="t-h1" tabindex="-1">5 个精简子命令，全套可控选项。</h1>
          <p class="t-body" style="margin-top:16px;">默认紧凑树形输出最省上下文；需要机器协议时使用 <code class="t-mono">--json</code>；排查检索质量时启用 <code class="t-mono">--snippet</code> 或 <code class="t-mono">--explain</code>。点击任意一行展开调用示例。</p>
        </div>
        <div class="col-full" style="margin-top:32px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;">
          <div style="min-width:240px;flex:1;max-width:360px;">
            <label class="t-micro" for="docs-search">检索命令、参数或门禁</label>
            <input class="text-input" style="margin-top:6px;" type="search" id="docs-search" placeholder="如：explain、path、update、instructions">
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;" id="docs-kind-filters">
            <button type="button" class="chip-toggle t-small" data-kf="all" aria-pressed="true">(全部)</button>
            <button type="button" class="chip-toggle t-small" data-kf="核心命令" aria-pressed="false">(核心命令)</button>
            <button type="button" class="chip-toggle t-small" data-kf="搜索选项" aria-pressed="false">(搜索选项)</button>
            <button type="button" class="chip-toggle t-small" data-kf="规则与评测" aria-pressed="false">(规则与评测)</button>
          </div>
        </div>
        <p class="col-full t-micro" id="docs-count" style="margin-top:16px;"></p>
        <div class="col-full" id="docs-table-wrap"></div>
      </div>
    </section>
  `;

  const searchEl = document.getElementById("docs-search");
  const kindBtns = Array.from(document.querySelectorAll("#docs-kind-filters [data-kf]"));
  const countEl = document.getElementById("docs-count");
  const tableWrap = document.getElementById("docs-table-wrap");

  function drawTable() {
    const q = query.trim().toLowerCase();
    const list = DATA.docsItems.filter(it => {
      if (kindFilter !== "all" && it.kind !== kindFilter) return false;
      if (q && !(it.name + " " + it.params + " " + it.summary + " " + it.example).toLowerCase().includes(q)) return false;
      return true;
    });
    countEl.textContent = `显示 ${list.length} / ${DATA.docsItems.length} 项命令与选项`;
    if (list.length === 0) {
      tableWrap.innerHTML = `<p class="t-lead" style="margin-top:32px;">没有匹配的命令或参数。</p>`;
      return;
    }
    tableWrap.innerHTML = `
      <table class="data-table responsive-table">
        <thead>
          <tr>
            <th class="t-micro">分类</th>
            <th class="t-micro">命令 / 选项</th>
            <th class="t-micro">参数说明</th>
            <th class="t-micro">作用</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(it => {
            const isOpen = openId === it.id;
            return `
              <tr class="talk-row" data-cat="${esc(it.cat)}" data-doc-id="${esc(it.id)}">
                <td data-label="分类" class="t-micro t-mono">${esc(it.kind)}</td>
                <td data-label="命令 / 选项" class="t-small t-mono fw-600">${esc(it.name)}</td>
                <td data-label="参数说明" class="t-micro t-mono">${esc(it.params)}</td>
                <td data-label="作用" class="t-small">${esc(it.summary)}</td>
              </tr>
              ${isOpen ? `
                <tr class="talk-expand-row">
                  <td colspan="4">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                      <span class="t-micro fw-600">调用示例 · ${esc(it.name)}</span>
                      <button type="button" class="cmd-copy-btn" data-copy-example="${esc(it.id)}">复制代码</button>
                    </div>
                    <pre class="code-block">${esc(it.example)}</pre>
                  </td>
                </tr>
              ` : ""}
            `;
          }).join("")}
        </tbody>
      </table>
    `;
    tableWrap.querySelectorAll("[data-doc-id]").forEach(row => {
      row.addEventListener("click", () => {
        openId = openId === row.dataset.docId ? null : row.dataset.docId;
        drawTable();
      });
    });
    tableWrap.querySelectorAll("[data-copy-example]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const found = DATA.docsItems.find(x => x.id === btn.dataset.copyExample);
        if (found) copyText(found.example, btn);
      });
    });
  }

  searchEl.addEventListener("input", () => { query = searchEl.value; drawTable(); });
  kindBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      kindFilter = btn.dataset.kf;
      kindBtns.forEach(b => b.setAttribute("aria-pressed", b.dataset.kf === kindFilter ? "true" : "false"));
      drawTable();
    });
  });
  drawTable();
}

// Route 5: Quick Start & Interactive Search Command Builder (#/quickstart)
export function renderQuickstart(main) {
  document.title = "快速开始" + DATA.copy.siteTitleSuffix;
  const builder = {
    terms: ["容量判断", "Worker启动时间", "SLA可行性"],
    path: "",
    top: "8",
    json: false,
    snippet: false,
    explain: false
  };
  const termPool = [
    "容量判断", "Worker启动时间", "SLA可行性", "SLA", "违约", "退款", "赔付", "cold start", "warm pool"
  ];

  main.innerHTML = `
    <section class="sub-sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(快速开始)</p>
        <div class="col-5-12">
          <h1 class="t-h1" tabindex="-1">两条命令建库，立即开始语义定位。</h1>
          <p class="t-body" style="margin-top:16px;">需要 Node.js >= 22。默认本地模型约 118 MB，仅在首次初始化时下载并缓存在用户目录，随后完全离线本地运行。</p>
        </div>

        <div class="col-1-5" style="margin-top:40px;">
          <p class="t-micro">(步骤 01 · 安装)</p>
          <h2 class="t-lead" style="margin-top:8px;">全局安装或源码链接</h2>
          <p class="t-small" style="margin-top:12px;">全局安装会自动维护 <code class="t-mono">~/.codex/AGENTS.md</code> 与 <code class="t-mono">~/.claude/CLAUDE.md</code>；若禁用安装脚本可执行 <code class="t-mono">docseek instructions --install</code>。</p>
        </div>
        <div class="col-7-12" style="margin-top:40px;">
          <div class="code-header">
            <span class="t-micro fw-600">方式一：npm 全局安装（推荐）</span>
            <button type="button" class="cmd-copy-btn" id="qs-copy-npm">复制</button>
          </div>
          <pre class="code-block" id="qs-npm-code">npm install --global docseek
cd /path/to/your-project
docseek init</pre>
          <div class="code-header" style="margin-top:16px;">
            <span class="t-micro fw-600">方式二：从源码构建并链接</span>
            <button type="button" class="cmd-copy-btn" id="qs-copy-src">复制</button>
          </div>
          <pre class="code-block" id="qs-src-code">git clone https://github.com/evepupil/DocSeek.git
cd DocSeek
npm install && npm run build && npm link</pre>
        </div>
      </div>
    </section>

    <section class="sec" data-surface="paper">
      <div class="grid">
        <div class="col-1-5">
          <p class="t-micro">(步骤 02 · 查询生成器)</p>
          <h2 class="t-lead" style="margin-top:8px;">交互式拼装发散检索命令</h2>
          <p class="t-small" style="margin-top:12px;">像用 <code class="t-mono">grep / rg</code> 一样点选 2–5 个短词或同义表达，搭配 <code class="t-mono">--path</code> / <code class="t-mono">--top</code> 实时生成命令。</p>
        </div>
        <div class="col-7-12">
          <div style="border:2px solid var(--ink);padding:24px;">
            <p class="t-micro fw-600">1. 选择发散候选词（多选）</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;" id="qs-term-chips">
              ${termPool.map(t => `
                <button type="button" class="chip-toggle t-micro" data-term="${esc(t)}" aria-pressed="${builder.terms.includes(t) ? "true" : "false"}">${esc(t)}</button>
              `).join("")}
            </div>

            <div style="display:grid;grid-template-columns:1fr 160px;gap:16px;margin-top:20px;">
              <div>
                <label class="t-micro fw-600" for="qs-path-input">2. 可选 --path 路径收窄</label>
                <input class="text-input t-mono" style="margin-top:6px;" id="qs-path-input" type="text" placeholder="例如 docs/模块设计/">
              </div>
              <div>
                <label class="t-micro fw-600" for="qs-top-select">3. --top 数量</label>
                <select class="select-input t-mono" style="margin-top:6px;" id="qs-top-select">
                  <option value="all">全部可信结果</option>
                  <option value="5">5</option>
                  <option value="8" selected>8</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                </select>
              </div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;">
              <button type="button" class="chip-toggle t-micro" id="qs-flag-json" aria-pressed="false">--json (机器协议)</button>
              <button type="button" class="chip-toggle t-micro" id="qs-flag-snippet" aria-pressed="false">--snippet (短片段)</button>
              <button type="button" class="chip-toggle t-micro" id="qs-flag-explain" aria-pressed="false">--explain (检索诊断)</button>
            </div>

            <div class="code-header" style="margin-top:24px;">
              <span class="t-micro fw-600">生成的 CLI 命令</span>
              <button type="button" class="cmd-copy-btn" id="qs-copy-built">复制命令</button>
            </div>
            <pre class="code-block" id="qs-built-cmd"></pre>
          </div>
        </div>
      </div>
    </section>

    <section class="sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(常见问题 · FAQ)</p>
        <div class="col-5-12">
          <h2 class="t-h2">开始前最常被问到的 6 个问题</h2>
          <div class="faq-list">
            ${DATA.faq.map((item, idx) => `
              <details class="faq-item"${idx === 0 ? " open" : ""}>
                <summary class="faq-summary">
                  <span class="t-lead">${esc(item.q)}</span>
                  <span class="faq-icon-plus">${svgPixelIcon("plus", 14)}</span>
                  <span class="faq-icon-minus">${svgPixelIcon("minus", 14)}</span>
                </summary>
                <p class="t-body faq-answer">${esc(item.a)}</p>
              </details>
            `).join("")}
          </div>
        </div>
      </div>
    </section>
  `;

  const builtPre = document.getElementById("qs-built-cmd");
  function refreshCmd() {
    builtPre.textContent = buildSearchCommand(builder);
  }

  document.getElementById("qs-copy-npm").addEventListener("click", e => copyText(document.getElementById("qs-npm-code").textContent, e.currentTarget));
  document.getElementById("qs-copy-src").addEventListener("click", e => copyText(document.getElementById("qs-src-code").textContent, e.currentTarget));
  document.getElementById("qs-copy-built").addEventListener("click", e => copyText(builtPre.textContent, e.currentTarget));

  document.querySelectorAll("#qs-term-chips [data-term]").forEach(btn => {
    btn.addEventListener("click", () => {
      const term = btn.dataset.term;
      if (builder.terms.includes(term)) {
        builder.terms = builder.terms.filter(x => x !== term);
      } else {
        builder.terms.push(term);
      }
      btn.setAttribute("aria-pressed", builder.terms.includes(term) ? "true" : "false");
      refreshCmd();
    });
  });

  document.getElementById("qs-path-input").addEventListener("input", e => {
    builder.path = e.target.value;
    refreshCmd();
  });
  document.getElementById("qs-top-select").addEventListener("change", e => {
    builder.top = e.target.value;
    refreshCmd();
  });

  [
    ["qs-flag-json", "json"],
    ["qs-flag-snippet", "snippet"],
    ["qs-flag-explain", "explain"]
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    el.addEventListener("click", () => {
      builder[key] = !builder[key];
      el.setAttribute("aria-pressed", builder[key] ? "true" : "false");
      refreshCmd();
    });
  });

  refreshCmd();
}

// Route 6: Interactive Retrieval & Compact Tree Sandbox (#/sandbox)
export function renderSandbox(main, runtime) {
  document.title = "检索沙盒" + DATA.copy.siteTitleSuffix;
  let outputMode = "tree"; // tree | json | explain
  let currentColor = "3";
  let painting = false;
  let grid = runtime.state.stampGrid.split("");

  main.innerHTML = `
    <section class="sub-sec" data-surface="ink">
      <div class="grid">
        <p class="col-1-3 t-micro">(在线检索与压缩沙盒)</p>
        <div class="col-5-12">
          <h1 class="t-h1 t-paper" tabindex="-1">实测混合召回、低可信过滤与紧凑导航树。</h1>
          <p class="t-body t-paper" style="margin-top:16px;opacity:0.86;">内置 InferForge + DocSeek 真实章节样本，在浏览器本地模拟 <code class="t-mono">RRF k=8 (0.45 Vec + 0.55 FTS5)</code> 融合、单分支 <code class="t-mono">›</code> 折叠与无答案过滤，并实时对比树形与 JSON 的字符压缩率。</p>
        </div>
      </div>

      <div class="grid badge-layout">
        <div class="col-1-6">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;" id="sb-presets">
            ${DATA.sandboxPresets.map((p, idx) => `
              <button type="button" class="chip-toggle t-micro" data-preset="${esc(p.query)}" aria-pressed="${idx === 0 ? "true" : "false"}">${esc(p.label)}</button>
            `).join("")}
          </div>

          <label class="t-micro" for="sb-query">查询参数（空格分隔多个发散词，支持引号）</label>
          <input class="text-input t-mono" style="margin-top:6px;" id="sb-query" type="text" value='${esc(DATA.sandboxPresets[0].query)}'>

          <div style="display:grid;grid-template-columns:1fr 120px;gap:12px;margin-top:14px;">
            <div>
              <label class="t-micro" for="sb-path">--path 路径过滤（可选）</label>
              <input class="text-input t-mono" style="margin-top:6px;" id="sb-path" type="text" placeholder="如：模块设计/">
            </div>
            <div>
              <label class="t-micro" for="sb-top">--top 限制</label>
              <select class="select-input t-mono" style="margin-top:6px;" id="sb-top">
                <option value="100" selected>不限</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="8">8</option>
              </select>
            </div>
          </div>

          <div id="sb-status-banner"></div>

          <div style="margin-top:24px;border-top:1px solid var(--sodium);padding-top:20px;">
            <p class="t-micro">(16×16 像素定位印章 · 自定义导航卡片)</p>
            <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;margin-top:12px;">
              <canvas class="badge-editor-canvas" id="stamp-canvas" style="max-width:176px;" role="img" aria-label="16×16 像素印章画板"></canvas>
              <div style="flex:1;min-width:180px;">
                <div class="palette-group" id="stamp-palette" role="radiogroup" aria-label="像素印章调色板">
                  ${STAMP_PALETTE.map(c => `
                    <button type="button" class="palette-swatch" data-col="${c.idx}" aria-checked="${c.idx === currentColor ? "true" : "false"}" aria-label="${c.name}" style="background-color:${c.hex};"></button>
                  `).join("")}
                </div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                  <button type="button" class="chip-toggle t-micro" id="stamp-random">随机印章</button>
                  <button type="button" class="chip-toggle t-micro" id="stamp-clear">清空</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-7-12">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">
            <div class="seg-group" id="sb-mode-tabs" role="tablist" aria-label="输出格式切换">
              <button type="button" class="chip-toggle t-micro" role="tab" data-out="tree" aria-selected="true" aria-pressed="true">紧凑导航树 (默认)</button>
              <button type="button" class="chip-toggle t-micro" role="tab" data-out="json" aria-selected="false" aria-pressed="false">--json 协议</button>
              <button type="button" class="chip-toggle t-micro" role="tab" data-out="explain" aria-selected="false" aria-pressed="false">--explain 诊断</button>
            </div>
            <button type="button" class="cmd-copy-btn" id="sb-copy-out">复制输出</button>
          </div>

          <div class="code-header" style="margin-top:12px;">
            <span class="t-micro fw-600 t-mono" id="sb-mode-label">compact-tree</span>
            <span class="t-micro t-mono" id="sb-stats-label">0 hits</span>
          </div>
          <pre class="code-block" id="sb-output-pre" style="min-height:240px;"></pre>

          <div style="margin-top:24px;">
            <p class="t-micro">(DocSeek 检索定位卡片预览 · SVG)</p>
            <svg id="sb-card-svg" viewBox="0 0 420 220" width="100%" style="display:block;margin-top:8px;border:1px solid var(--sodium);" shape-rendering="crispEdges" role="img" aria-label="DocSeek 定位卡片预览"></svg>
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;">
              <button type="button" class="btn-primary t-small" id="sb-dl-tree"><span>导出树形 .txt</span></button>
              <button type="button" class="btn-outline t-small" id="sb-dl-svg">导出卡片 .svg</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const queryEl = document.getElementById("sb-query");
  const pathEl = document.getElementById("sb-path");
  const topEl = document.getElementById("sb-top");
  const statusEl = document.getElementById("sb-status-banner");
  const modeLabelEl = document.getElementById("sb-mode-label");
  const statsLabelEl = document.getElementById("sb-stats-label");
  const outPre = document.getElementById("sb-output-pre");
  const cardSvg = document.getElementById("sb-card-svg");
  const stampCanvas = document.getElementById("stamp-canvas");
  const presetBtns = Array.from(document.querySelectorAll("#sb-presets [data-preset]"));
  const modeTabs = Array.from(document.querySelectorAll("#sb-mode-tabs [data-out]"));

  function renderStampCanvas() {
    const size = 176;
    const cell = 11;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    stampCanvas.width = size * dpr;
    stampCanvas.height = size * dpr;
    const ctx = stampCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = DATA.tokens.ink;
    ctx.fillRect(0, 0, size, size);
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        const palObj = STAMP_PALETTE[Number(grid[r * 16 + c])] || STAMP_PALETTE[1];
        ctx.fillStyle = palObj.hex;
        ctx.fillRect(c * cell + 1, r * cell + 1, cell - 1, cell - 1);
      }
    }
  }

  function updateAll() {
    const rawQ = queryEl.value;
    const sim = simulateHybridSearch(DATA.sandboxCorpus, rawQ, {
      path: pathEl.value,
      top: Number(topEl.value)
    });
    const treeText = buildCompactTree(sim.results);
    const jsonText = formatSearchJsonOutput(sim.results);
    const comp = computeCompressionStats(treeText, jsonText);

    if (sim.results.length === 0) {
      statusEl.innerHTML = `<div class="guard-banner t-small">低可信过滤已拦截：当前语料无足够可信命中（返回空结果，避免误导 Agent）。请尝试更换发散候选词或放宽 --path。</div>`;
    } else {
      statusEl.innerHTML = `<div class="guard-banner is-ok t-small">命中 ${sim.results.length} 处坐标 · 模式: ${sim.mode === "candidate-terms" ? "发散候选词" : "完整问句严格"} · 紧凑树省 ${comp.charSavedPct}% 字符 (${comp.treeChars} vs ${comp.jsonChars}) · 省 ${comp.lineSavedPct}% 行数</div>`;
    }

    if (outputMode === "tree") {
      modeLabelEl.textContent = "compact-tree (默认输出)";
      outPre.textContent = sim.results.length > 0
        ? treeText
        : "(0 results — 低可信结果已过滤，建议更换 2–5 个发散短词重搜)";
    } else if (outputMode === "json") {
      modeLabelEl.textContent = "--json (机器可读逐片段协议)";
      outPre.textContent = jsonText;
    } else {
      modeLabelEl.textContent = "--explain (双路融合与放行信号)";
      if (sim.results.length === 0) {
        outPre.textContent = `mode=${sim.mode}\nresults=0 (below confidence threshold)`;
      } else {
        outPre.textContent = sim.results.map((r, idx) =>
          `${idx + 1}. ${r.path}\n   章节: ${r.headings.join(" › ")}   L${r.lineStart}-${r.lineEnd}   绝对分: ${r.score.toFixed(3)}\n   信号: mode=${r.explain.mode} | gate=${r.explain.gate} | vec=${r.explain.vecRank ? "#" + r.explain.vecRank : "-"} (${r.explain.vecSim}) | fts=${r.explain.ftsRank ? "#" + r.explain.ftsRank : "-"} (BM25 ${r.explain.bm25}) | cover=${r.explain.coverage}`
        ).join("\n\n");
      }
    }

    statsLabelEl.textContent = `${sim.results.length} hits · -${comp.charSavedPct}% chars`;

    // Update SVG locator card
    const logoLayout = layoutGlyphLines(["DOCSEEK"], 2);
    let logoRects = "";
    for (let i = 0; i < logoLayout.cells.length; i++) {
      const cell = logoLayout.cells[i];
      logoRects += `<rect x="${(14 + cell.x * 2.0).toFixed(1)}" y="${(10 + cell.y * 1.8).toFixed(1)}" width="2.0" height="1.8" fill="${DATA.tokens.sodium}"/>`;
    }
    let stampRects = "";
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        const palObj = STAMP_PALETTE[Number(grid[r * 16 + c])] || STAMP_PALETTE[1];
        stampRects += `<rect x="${20 + c * 7}" y="${58 + r * 7}" width="7" height="7" fill="${palObj.hex}"/>`;
      }
    }
    let strip = "";
    for (let i = 0; i < 21; i++) {
      strip += `<rect x="${i * 20}" y="204" width="20" height="16" fill="${TRAIL_COLORS[i % TRAIL_COLORS.length]}"/>`;
    }
    const topHit = sim.results[0];
    const titleLine = topHit ? topHit.path.split("/").pop() : "NO MATCH FILTERED";
    const locLine = topHit ? `L${topHit.lineStart}-${topHit.lineEnd} · score .${Math.round(topHit.score * 1000).toString().padStart(3, "0")}` : "0 hits · confidence gate";
    const metaLine = topHit ? `gate: ${topHit.explain.gate} · -${comp.charSavedPct}% chars` : "try divergent 2-5 terms";

    cardSvg.innerHTML = `
      <rect x="0" y="0" width="420" height="220" fill="${DATA.tokens.sodium}"/>
      <rect x="0" y="0" width="420" height="38" fill="${DATA.tokens.ink}"/>
      ${logoRects}
      <text x="404" y="24" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="11" fill="${DATA.tokens.sodium}">HYBRID RRF k=8 · ${sim.results.length} HITS</text>
      ${stampRects}
      <text x="150" y="84" font-family="Inter Tight, Noto Sans SC, sans-serif" font-size="18" font-weight="700" fill="${DATA.tokens.ink}">${esc(titleLine.slice(0, 22))}</text>
      <text x="150" y="110" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600" fill="${DATA.tokens.ink}">${esc(locLine)}</text>
      <text x="150" y="138" font-family="JetBrains Mono, monospace" font-size="11" fill="${DATA.tokens.ink}">${esc(metaLine)}</text>
      <text x="150" y="162" font-family="JetBrains Mono, monospace" font-size="11" fill="${DATA.tokens.ink}">.docseek/index.db · E5-small q8</text>
      ${strip}
    `;
  }

  [queryEl, pathEl, topEl].forEach(el => el.addEventListener("input", updateAll));
  topEl.addEventListener("change", updateAll);

  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      queryEl.value = btn.dataset.preset;
      pathEl.value = "";
      presetBtns.forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      updateAll();
    });
  });

  modeTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      outputMode = btn.dataset.out;
      modeTabs.forEach(b => {
        const active = b.dataset.out === outputMode;
        b.setAttribute("aria-selected", active ? "true" : "false");
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
      updateAll();
    });
  });

  document.getElementById("sb-copy-out").addEventListener("click", e => copyText(outPre.textContent, e.currentTarget));

  function paintAt(e) {
    const rect = stampCanvas.getBoundingClientRect();
    const c = Math.min(15, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 16)));
    const r = Math.min(15, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * 16)));
    grid[r * 16 + c] = currentColor;
    runtime.state.stampGrid = grid.join("");
    renderStampCanvas();
    updateAll();
  }
  stampCanvas.addEventListener("pointerdown", e => { e.preventDefault(); painting = true; paintAt(e); });
  stampCanvas.addEventListener("pointermove", e => { if (painting) paintAt(e); });
  const stopPaint = () => { painting = false; };
  window.addEventListener("pointerup", stopPaint);
  runtime.state.routeCleanup.push(() => window.removeEventListener("pointerup", stopPaint));

  document.querySelectorAll("#stamp-palette [data-col]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentColor = btn.dataset.col;
      document.querySelectorAll("#stamp-palette [data-col]").forEach(b => b.setAttribute("aria-checked", b.dataset.col === currentColor ? "true" : "false"));
    });
  });

  document.getElementById("stamp-random").addEventListener("click", () => {
    const rng = makeRng(Date.now());
    const accent = String(3 + Math.floor(rng() * 6));
    const g = new Array(256).fill("1");
    for (let r = 2; r <= 13; r++) {
      for (let c = 0; c < 8; c++) {
        if (rng() < 0.44) { g[r * 16 + c] = accent; g[r * 16 + (15 - c)] = accent; }
      }
    }
    grid = g;
    runtime.state.stampGrid = grid.join("");
    renderStampCanvas();
    updateAll();
  });

  document.getElementById("stamp-clear").addEventListener("click", () => {
    grid = new Array(256).fill("1");
    runtime.state.stampGrid = grid.join("");
    renderStampCanvas();
    updateAll();
  });

  document.getElementById("sb-dl-tree").addEventListener("click", () => {
    const blob = new Blob([outPre.textContent + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docseek-search-result.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById("sb-dl-svg").addEventListener("click", () => {
    const ser = new XMLSerializer();
    const clone = cardSvg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + ser.serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docseek-locator-card.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  renderStampCanvas();
  updateAll();
}

// 404 Route
export function renderNotFound(main) {
  document.title = "页面未找到" + DATA.copy.siteTitleSuffix;
  const ch = window.innerWidth >= 768 ? 14 : 8;
  main.innerHTML = `
    <section class="sub-sec" data-surface="sodium">
      <div class="grid">
        <div class="col-full">
          ${svgBitmapText("404", ch, DATA.tokens.ink, { className: "notfound-bitmap", ariaHidden: true, bold: true })}
          <h1 class="t-h1" tabindex="-1">未找到对应路由。</h1>
          <div style="margin-top:32px;">
            <a class="btn-text t-lead u-anim" href="#/">(返回 DocSeek 首页)</a>
          </div>
        </div>
      </div>
    </section>
  `;
}
