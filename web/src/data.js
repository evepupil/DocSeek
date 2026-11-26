export const DATA = {
  meta: {
    name: "DOCSEEK",
    fullName: "DocSeek — 面向 AI Coding Agent 的本地语义文档定位工具",
    version: "v0.2.0",
    tagline: "自然语言与发散候选词进入，Markdown 文件、章节和行号返回。",
    repoUrl: "https://github.com/evepupil/DocSeek",
    npmCmd: "npm install --global docseek"
  },
  tokens: {
    sodium: "#F3ACF0",
    ink: "#0A0A0A",
    paper: "#FFFFFF",
    blue: "#2370E8",
    pink: "#D873B3",
    green: "#2BA676",
    lavender: "#A98BF7",
    coral: "#FF5A5A",
    mint: "#22C98A",
    amber: "#F5B700"
  },
  nav: [
    { label: "Agent 接入", href: "#/agents" },
    { label: "架构与检索", href: "#/architecture" },
    { label: "CLI 手册", href: "#/docs" },
    { label: "检索沙盒", href: "#/sandbox" },
    { label: "快速开始", href: "#/quickstart" }
  ],
  glyphs: {
    " ": [".....", ".....", ".....", ".....", ".....", ".....", ".....", ".....", "....."],
    "-": [".....", ".....", ".....", ".....", "#####", ".....", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", ".....", ".....", "##...", "##..."],
    "/": ["....#", "...##", "...#.", "..##.", "..#..", ".##..", ".#...", "##...", "#...."],
    "%": ["##..#", "##.#.", "...#.", "..#..", "..#..", ".#...", ".#...", "#..##", "#..##"],
    "0": [".###.", "##.##", "#...#", "#..##", "#.#.#", "##..#", "#...#", "##.##", ".###."],
    "1": ["..#..", ".##..", "###..", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "2": [".###.", "#...#", "....#", "...##", "..##.", ".##..", "#....", "#....", "#####"],
    "3": [".###.", "#...#", "....#", "..##.", "....#", "....#", "....#", "#...#", ".###."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#.", "...#.", "...#."],
    "5": ["#####", "#....", "#....", "####.", "....#", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", "....#", "#...#", ".###."],
    "A": ["..#..", ".#.#.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "#...#", "#...#", "####."],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#....", "#....", "#...#", ".###."],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#....", "#....", "#...."],
    "G": [".###.", "#...#", "#....", "#....", "#.###", "#...#", "#...#", "#...#", ".###."],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#", "#...#", "#...#"],
    "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "K": ["#...#", "#..#.", "#.#..", "##...", "##...", "#.#..", "#..#.", "#...#", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "##..#", "#.#.#", "#.#.#", "#..##", "#..##", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#", "....#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#", "#...#", "#...#"],
    "S": [".###.", "#...#", "#....", ".###.", "....#", "....#", "....#", "#...#", ".###."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."]
  },
  boldGlyphs: {
    " ": [".....", ".....", ".....", ".....", ".....", ".....", ".....", ".....", "....."],
    "-": [".......", ".......", ".......", "#######", "#######", ".......", ".......", ".......", "......."],
    "%": ["##...##", "##..##.", "...##..", "..##...", "..##...", ".##....", "##..##.", "##..##.", "......."],
    "0": [".#####.", "#######", "##...##", "##..###", "##.#.##", "###..##", "##...##", "#######", ".#####."],
    "1": ["..###..", ".####..", "#####..", "..###..", "..###..", "..###..", "..###..", "#######", "#######"],
    "2": [".#####.", "#######", ".....##", "....###", "..####.", ".###...", "##.....", "#######", "#######"],
    "3": [".#####.", "#######", ".....##", "..####.", "..####.", ".....##", "##...##", "#######", ".#####."],
    "4": ["....##.", "...###.", "..####.", ".##.##.", "#######", "#######", "....##.", "....##.", "....##."],
    "5": ["#######", "#######", "##.....", "######.", ".######", ".....##", "##...##", "#######", ".#####."],
    "8": [".#####.", "#######", "##...##", ".#####.", ".#####.", "##...##", "##...##", "#######", ".#####."],
    "B": ["######.", "#######", "##...##", "######.", "######.", "##...##", "##...##", "#######", "######."],
    "C": [".#####.", "#######", "##.....", "##.....", "##.....", "##.....", "##.....", "#######", ".#####."],
    "D": ["#####..", "######.", "##...##", "##...##", "##...##", "##...##", "##...##", "######.", "#####.."],
    "E": ["#######", "#######", "##.....", "######.", "######.", "##.....", "##.....", "#######", "#######"],
    "H": ["##...##", "##...##", "##...##", "#######", "#######", "##...##", "##...##", "##...##", "##...##"],
    "I": ["#######", "#######", "..###..", "..###..", "..###..", "..###..", "..###..", "#######", "#######"],
    "K": ["##...##", "##..##.", "##.##..", "####...", "####...", "##.##..", "##..##.", "##...##", "##...##"],
    "M": ["##...##", "###.###", "#######", "##.#.##", "##...##", "##...##", "##...##", "##...##", "##...##"],
    "O": [".#####.", "#######", "##...##", "##...##", "##...##", "##...##", "##...##", "#######", ".#####."],
    "P": ["######.", "#######", "##...##", "#######", "######.", "##.....", "##.....", "##.....", "##....."],
    "R": ["######.", "#######", "##...##", "#######", "######.", "##..##.", "##...##", "##...##", "##...##"],
    "S": [".#####.", "#######", "##.....", ".#####.", "..#####", ".....##", "##...##", "#######", ".#####."],
    "Y": ["##...##", "##...##", ".##.##.", "..###..", "..###..", "..###..", "..###..", "..###..", "..###.."]
  },
  copy: {
    siteTitleSuffix: " — DocSeek",
    homeTitle: "DocSeek — 面向 AI Coding Agent 的本地语义文档定位工具",
    heroH1: "DocSeek，面向 AI Coding Agent 的本地语义文档定位工具。自然语言与发散候选词进入，Markdown 文件、章节和行号返回。",
    heroMeta: [
      "Semantic Documentation Locator for Coding Agents",
      "Node.js >= 22 · SQLite + sqlite-vec + FTS5",
      "Retrieval Is Navigation · Not Context Generation"
    ],
    heroBadge: "v0.2.0 · MIT · github.com/evepupil/DocSeek",
    heroCycle: [
      { desktop: "DOCSEEK", mobile: ["DOC", "SEEK"], caption: "(点击画布切换指标 · 本地语义文档定位引擎)" },
      { desktop: "-80%", mobile: ["-80", "%"], caption: "(紧凑导航树较 JSON 减少约 80% 字符与 88% 行数)" },
      { desktop: "HYBRID", mobile: ["HYB", "RID"], caption: "(sqlite-vec 0.45 + FTS5 0.55 双路加权融合)" },
      { desktop: "0-MCP", mobile: ["0-", "MCP"], caption: "(纯本地单进程 CLI · 零常驻进程 · 任意 Agent 可用)" }
    ],
    heroSplit: [
      { left: "", right: "当 Agent 知道要找什么概念，" },
      { left: "却猜不中原词时，", right: "grep 只能反复盲猜试错。" },
      { left: "DOCSEEK", right: "" },
      { left: "本地 Embedding + FTS5，", right: "用紧凑树直接定位章节行号，" },
      { left: "正文留给 Agent 按需读取，", right: "较 JSON 节省约 80% 上下文。" }
    ],
    aboutLead: "“Retrieval is navigation, not context generation.” —— 当项目积累了上百份设计文档与模块说明，AI 编程助手真正缺少的不是另一套大段灌入正文的 RAG，而是一张能直达行号的语义地图。",
    aboutP1: "DocSeek 不起后台服务，不依赖云端 API，也不要求配置 MCP。它通过 Markdown AST 提取精确的标题层级与源码行号，使用本地 multilingual-e5-small q8 模型生成 384 维向量，并与 SQLite FTS5 中英文双字索引一起存放在项目本地的 .docseek/index.db 中。",
    aboutP2: "默认输出将共同目录、文件名、标题层级与行区间压缩成一棵紧凑导航树：在 InferForge 99 个命中的实测查询中，紧凑树仅占 4,374 字符，相比同批 JSON 的 21,582 字符减少约 80% 上下文消耗，同时完整保留每一处文件、章节、行号与绝对检索分。",
    pillarsLead: "四条核心工程支柱。每一项指标都经过真实语料评测与自动化质量门禁验证。",
    workflowLead: "像使用 grep / rg 一样发散候选词，四步闭环完成“检查 → 增量同步 → 定位 → 精准读原文”。",
    agentsLead: "只依赖命令行执行能力。全局安装自动维护 Codex 与 Claude 规则，其余 Agent 直接复用同一套指令与 CLI。",
    posterLeftHead: ["DOCSEEK", "V0.2", "检索即导航", "混合召回", "「紧凑树形坐标」"],
    posterRightHead: [
      "sqlite-vec (0.45) + SQLite FTS5 (0.55) · RRF k=8",
      "mdast 标题层级 + 块级结构切分 · 保留精准源码行号",
      "内容哈希增量更新 · 未变化文档跳过解析与向量化",
      "单分支 › 折叠 · 较 JSON 减少约 80% 字符与 88% 行数",
      "单进程本地 CLI · 零后台守护 · 零 MCP 配置负担"
    ]
  },
  pains: [
    {
      label: "01. 猜不中原词",
      problem: "面对几十上百份架构与模块设计文档，Agent 知道概念（如“违约赔付”“弹性扩容”）却不知道原文究竟用了哪个词，grep / rg 容易漏检。",
      solution: "多语言本地 Embedding (multilingual-e5-small q8) 召回同义改写与跨语言表达，SQLite FTS5（含中文连续双字）保底项目黑话、缩写与代码标识符。"
    },
    {
      label: "02. 切块破坏语义",
      problem: "传统固定字符窗口切块容易拦腰斩断章节标题、列表和代码块，返回碎片上下文却丢失它在文档中的完整结构与精确行号。",
      solution: "基于 mdast Markdown AST 按标题层级建立章节上下文，超长章节沿段落、列表和代码块边界二次切分，每条结果精确记录起始与结束行号。"
    },
    {
      label: "03. 正文挤爆上下文",
      problem: "普通 RAG 把大段检索正文和冗长 JSON 路径一股脑灌进提示词，迅速消耗上下文预算，反而稀释 Agent 的推理注意力。",
      solution: "默认只输出导航坐标，并把共同目录与单分支路径用 / 和 › 折叠成紧凑树。99 个命中从 21,582 字符 JSON 压到 4,374 字符，正文由 Agent 按需 Read。"
    }
  ],
  stats: [
    { val: "80%", num: 80, label: "字符压缩率", sub: "紧凑树 vs JSON (99 命中)" },
    { val: "384", num: 384, label: "本地向量维度", sub: "multilingual-e5-small q8" },
    { val: "100%", num: 100, label: "质量门禁达标", sub: "Top-5 / 术语第1 / 无答案" },
    { val: "00", num: 0, label: "后台常驻进程", sub: "单进程 CLI · 本地 SQLite" },
    { val: "118", num: 118, label: "模型缓存 (MB)", sub: "首次下载 · 离线本地执行" }
  ],
  searchScenarios: [
    {
      id: "divergent",
      step: "01",
      mode: "发散候选词模式 (2–5 短词)",
      channel: "InferForge 实测 · 126 份文档 / 1,598 章节",
      cmd: `docseek search "容量判断" "Worker启动时间" "SLA可行性" --top 8`,
      action: "保留 CLI 候选词边界 → 项目内词汇证据校验 → sqlite-vec (0.45) + FTS5 (0.55) RRF k=8 融合 → 按分支最高分排序并执行单分支 › 折叠",
      file: ".docseek/index.db · 紧凑导航树输出 (默认)",
      output: `inferforge-docs/
├─ 模块设计/ ×7 .803
│  ├─ M2-弹性容量调配.md ×5 .805
│  │  ├─ 3. 本期容量判断 › 3.1 触发条件 L105-117 .844
│  │  ├─ 2. 容量动作 ×3 .797
│  │  │  ├─ 2.3 启动新 Worker L92-101 .831
│  │  │  ├─ 2.1 统一就绪时间 L64-74 .789
│  │  │  └─ 2.2 调配现有 Worker L76-90 .772
│  │  └─ 7. 当前实现 L258-291 .788
│  ├─ M2-SLA队列与派活.md › 7. 当前实现 L256-273 .830
│  └─ M2-调度策略层.md › 8. 当前实现 L209-220 .765
└─ 需求规格.md › 13. 分期验收标准 › 13.3 M2 验收标准 L540-553 .794`
    },
    {
      id: "hybrid",
      step: "02",
      mode: "中英文混合 + 诊断模式 (--explain)",
      channel: "双路放行原因 · 绝对检索分 (0–1)",
      cmd: `docseek search "SLA" "违约" "退款" "赔付" --top 3 --explain`,
      action: "同时触发精确英文缩写 (FTS5) 与中文近义概念 (Vector)，输出排名融合 0.60 + 词项覆盖 0.20 + 语义强度 0.20 的可解释拆解",
      file: "stdout (结果) + stderr (阶段耗时与放行诊断)",
      output: `1. inferforge-docs/模块设计/M2-SLA队列与派活.md
   章节: 4. 违约判定与赔付策略 › 4.2 自动退款触发
   行号: L142-168   绝对分: 0.861
   信号: mode=candidate | gate=dual-route | vec=#1 (0.84) | fts=#1 (BM25 14.2) | cover=0.75

2. inferforge-docs/需求规格.md
   章节: 9. 服务等级协议 (SLA) › 9.3 补偿规则
   行号: L312-338   绝对分: 0.794
   信号: mode=candidate | gate=term-vector | vec=#2 (0.81) | fts=#4 (BM25 8.6) | cover=0.50

[timing] embed=34ms  vector=3ms  fts=2ms  fusion=1ms  total=40ms`
    },
    {
      id: "incremental",
      step: "03",
      mode: "状态巡检 → 增量更新 → 路径收窄",
      channel: "内容哈希比对 · 零模型加载巡检",
      cmd: `docseek status && docseek update && docseek search "调度策略" --path docs/模块设计/ --top 5`,
      action: "status 不加载 Embedding 模型即可发现新增/修改/删除文件；update 仅对变化文档做 AST 切分与跨文件分桶批量向量化；最后按目录前缀收窄检索",
      file: "标准 Agent 工作流 · 低延迟闭环",
      output: `$ docseek status
Project root: /workspace/inferforge
Indexed: 126 documents, 1,598 chunks (model: Xenova/multilingual-e5-small q8)
Pending changes: 1 added, 2 modified, 0 deleted

$ docseek update
Updated 1 added, 2 modified, 0 deleted; 123 unchanged.

$ docseek search "调度策略" --path docs/模块设计/ --top 5
docs/模块设计/
├─ M2-调度策略层.md ×3 .822
│  ├─ 2. 优先级队列与抢占策略 L48-89 .851
│  ├─ 4. 冷启动成本评估 L132-164 .819
│  └─ 8. 当前实现 L209-220 .796
└─ M2-弹性容量调配.md › 3. 本期容量判断 L105-117 .784`
    }
  ],
  pillars: [
    {
      id: "hybrid",
      label: "双路加权混合检索",
      en: "sqlite-vec + FTS5",
      color: "#F3ACF0",
      fg: "#FF5A36",
      desc: "向量 (0.45) 与 FTS5 关键词 (0.55) 按 RRF k=8 融合，叠加上下文词项覆盖与语义强度形成 0–1 绝对分，无答案自动过滤为空。",
      metric: "VEC 0.45 + FTS 0.55",
      route: "#/architecture"
    },
    {
      id: "tree",
      label: "紧凑导航树输出",
      en: "Compact Tree (-80%)",
      color: "#18B47E",
      fg: "#2370E8",
      desc: "提取共同目录，折叠单分支层级为 / 与 ›，自底向上汇总 ×命中数 .平均分，按分支最高分排序。99 命中较 JSON 省 80% 字符。",
      metric: "-80% 字符 · -88% 行数",
      route: "#/sandbox"
    },
    {
      id: "index",
      label: "AST 标题分块与增量",
      en: "mdast + Hash Delta",
      color: "#F5B700",
      fg: "#FF5A36",
      desc: "按 Markdown AST 标题层级与段落/列表/代码块切分，精确记录 L起-止 行号；基于内容哈希增量更新，跨文件长度分桶批量生成向量。",
      metric: "精确行号 · 哈希增量",
      route: "#/docs"
    },
    {
      id: "agent",
      label: "零侵入纯 CLI 接入",
      en: "Zero-MCP · Any Agent",
      color: "#A98BF7",
      fg: "#2370E8",
      desc: "无需 MCP、后台进程或数据库服务。全局安装自动维护 Codex AGENTS.md 与 Claude CLAUDE.md 闭合标签区块，其余 Agent 直接调用 CLI。",
      metric: "0 常驻进程 · 自动规则注入",
      route: "#/agents"
    }
  ],
  workflowSteps: [
    {
      num: "01",
      title: "全局安装与项目初始化",
      sub: "npm i -g docseek && docseek init",
      items: [
        { time: "STEP 1.1", title: "自动写入 Agent 全局规则", desc: "npm 全局安装时通过 postinstall 自动维护 ~/.codex/AGENTS.md 与 ~/.claude/CLAUDE.md 的闭合规则块，不改写原有规则。", cat: "agent", tag: "自动注入" },
        { time: "STEP 1.2", title: "识别 Git 根并建立 .docseek/", desc: "从任意子目录运行都会向上定位 Git 根目录，自动把 /.docseek/ 加入 .gitignore，首次缓存 118MB 本地 q8 模型。", cat: "index", tag: "零污染仓库" },
        { time: "STEP 1.3", title: "AST 解析 + 分桶批量向量化", desc: "按标题与块结构切分全部 Markdown，屏蔽 DocSeek 自身规则区块防自匹配，事务写入 SQLite 向量表与 FTS5 索引。", cat: "hybrid", tag: "一次建库" }
      ]
    },
    {
      num: "02",
      title: "低成本巡检与增量同步",
      sub: "docseek status → docseek update",
      items: [
        { time: "STEP 2.1", title: "零模型加载检查待更新变化", desc: "docseek status 只比对文件系统与数据库内容哈希，不加载 ONNX 模型，毫秒级告诉 Agent 索引是否过期。", cat: "index", tag: "极速巡检" },
        { time: "STEP 2.2", title: "仅重算新增、修改与删除文档", desc: "docseek update 自动跳过未变化文档并保留原有向量；纯删除更新全程不加载 Embedding 模型。", cat: "index", tag: "内容哈希" },
        { time: "STEP 2.3", title: "原子事务保证索引一致", desc: "单文件更新包裹在 SQLite 事务中，外键级联同步清理旧片段、向量与 FTS5 记录，杜绝脏索引。", cat: "hybrid", tag: "事务安全" }
      ]
    },
    {
      num: "03",
      title: "发散词定位与按需读原文",
      sub: "docseek search → Read L起-止",
      items: [
        { time: "STEP 3.1", title: "像 grep 一样传入 2–5 个短词", desc: "把同义词、缩写、中英文翻译和项目黑话作为多个参数传入，合并为一次向量查询并保留词项边界证据。", cat: "hybrid", tag: "发散检索" },
        { time: "STEP 3.2", title: "浏览紧凑导航树锁定目标区间", desc: "默认输出折叠共同路径与单支层级，按内部最高分优先呈现最值得读取的文件、章节与 L起-止 行号。", cat: "tree", tag: "-80% 上下文" },
        { time: "STEP 3.3", title: "由 Agent 精准 Read 原文行区间", desc: "找到相关目录后可用 --path / --top 收窄，再按行号读取 Markdown 原文并自主推理，避免 RAG 摘要失真。", cat: "agent", tag: "检索即导航" }
      ]
    }
  ],
  agents: [
    {
      id: "claude",
      name: "Claude Code",
      flag: "auto-install",
      mode: "自动维护 ~/.claude/CLAUDE.md",
      pal: ["#D873B3", "#2370E8", "#0A0A0A", "#FFFFFF"],
      rulePath: "~/.claude/CLAUDE.md (<!-- DOCSEEK:INSTRUCTIONS:START/END -->)",
      entryCmd: "docseek instructions --install",
      cliFlow: "docseek status → docseek search \"词1\" \"词2\" → Read 工具按行号读原文",
      autoInject: true,
      supportsJson: true,
      highlight: "npm 全局安装时自动将精简工作流写入 ~/.claude/CLAUDE.md 的闭合标签内；升级版本原位替换，标签外的个人规则原封不动。索引项目内 CLAUDE.md 时会自动屏蔽该区块避免自匹配。"
    },
    {
      id: "codex",
      name: "Codex CLI",
      flag: "auto-install",
      mode: "自动维护 ~/.codex/AGENTS.md",
      pal: ["#2370E8", "#2BA676", "#0A0A0A", "#FFFFFF"],
      rulePath: "~/.codex/AGENTS.md (<!-- DOCSEEK:INSTRUCTIONS:START/END -->)",
      entryCmd: "docseek instructions --install",
      cliFlow: "docseek status → docseek update → docseek search ... → sed/read 精确行段",
      autoInject: true,
      supportsJson: true,
      highlight: "postinstall 同步识别 CODEX_HOME 或 ~/.codex/AGENTS.md，自动注入发散候选词检索规范，新开 Codex 会话无需额外配置即可自主调用 DocSeek 定位设计文档。"
    },
    {
      id: "cursor",
      name: "Cursor",
      flag: "rules-copy",
      mode: "Shell 终端 + .cursorrules / Rules",
      pal: ["#A98BF7", "#2370E8", "#0A0A0A", "#FFFFFF"],
      rulePath: "执行 docseek instructions 输出粘贴至 Cursor User/Project Rules",
      entryCmd: "docseek instructions",
      cliFlow: "Agent Terminal 执行 docseek search → 编辑器跳转对应文件与行号",
      autoInject: false,
      supportsJson: true,
      highlight: "零 MCP 进程负担。只需将 `docseek instructions` 输出的 6 条精简规则放入 Cursor Rules，Agent 即可直接在内置终端完成文档定位并精准打开指定行区间。"
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      flag: "rules-copy",
      mode: "Shell 工具 + ~/.gemini/GEMINI.md",
      pal: ["#2BA676", "#2370E8", "#0A0A0A", "#FFFFFF"],
      rulePath: "将 docseek instructions 区块追加至 ~/.gemini/GEMINI.md",
      entryCmd: "docseek instructions >> ~/.gemini/GEMINI.md",
      cliFlow: "Shell 执行 docseek status / search → 按返回 L起-止 行号读取设计文档",
      autoInject: false,
      supportsJson: true,
      highlight: "天然契合 CLI 优先的终端 Agent 工作流：默认紧凑导航树极大节省多轮检索 token，需要结构化处理时随时切换 `--json`。"
    },
    {
      id: "opencode",
      name: "OpenCode",
      flag: "rules-copy",
      mode: "共享 AGENTS.md + Shell CLI",
      pal: ["#F5B700", "#0A0A0A", "#2370E8", "#FFFFFF"],
      rulePath: "项目或全局 AGENTS.md（与 Codex 共享同一份指令规范）",
      entryCmd: "docseek instructions",
      cliFlow: "先发散 2–5 个短词 → 发现目录后加 --path 收窄 → 精准读正文",
      autoInject: false,
      supportsJson: true,
      highlight: "通过标准 AGENTS.md 与 bash 工具即可无缝接入，无需配置本地向量库端口或管理后台常驻守护进程。"
    },
    {
      id: "windsurf",
      name: "Windsurf",
      flag: "rules-copy",
      mode: "Cascade Terminal + Rules",
      pal: ["#22C98A", "#2370E8", "#0A0A0A", "#FFFFFF"],
      rulePath: ".windsurfrules 或全局规则目录",
      entryCmd: "docseek instructions",
      cliFlow: "Cascade 调用 docseek search 获取树形坐标 → 精准读取目标章节",
      autoInject: false,
      supportsJson: true,
      highlight: "在大型多模块文档仓库中替代盲目 grep，帮助 Cascade 在一轮命令内锁定设计规范、验收标准与当前实现所在的具体行区间。"
    },
    {
      id: "aider",
      name: "Aider / 任意 Shell Agent",
      flag: "shell-cli",
      mode: "纯标准输入输出 · 零协议门槛",
      pal: ["#FF5A5A", "#0A0A0A", "#F3ACF0", "#FFFFFF"],
      rulePath: "任意系统提示词 / 自定义 Agent Prompt",
      entryCmd: "docseek search \"概念\" \"术语\" --top 8",
      cliFlow: "任何能执行命令行并读取 stdout 的 Agent 均可直接使用",
      autoInject: false,
      supportsJson: true,
      highlight: "DocSeek 的核心边界是“只依赖 CLI”：无论内部自研 Agent、Aider 还是脚本工具，只要能执行一条 shell 命令就能立即获得本地语义定位能力。"
    },
    {
      id: "ci",
      name: "自动化脚本 / 质量评测",
      flag: "json-api",
      mode: "稳定 --json 协议 + 严格退出码",
      pal: ["#2370E8", "#A98BF7", "#0A0A0A", "#FFFFFF"],
      rulePath: "stdout 纯 JSON · stderr 诊断日志 · 失败返回非零退出码",
      entryCmd: "docseek search \"SLA\" \"违约\" --json --explain",
      cliFlow: "支持 docseek status --json 与 search --json，无缝接入 jq / CI 管线",
      autoInject: false,
      supportsJson: true,
      highlight: "严格分离标准输出（纯结果/JSON）与标准错误（诊断日志），内置 `npm run eval:quality` 离线评测入口复用完全一致的生产排序管线。"
    }
  ],
  archModules: [
    {
      id: "cli",
      label: "命令行与紧凑树",
      pkg: "src/cli/",
      chip: "CLI & TREE",
      x: 1, y: 1, w: 12, h: 6,
      fill: "#F3ACF0", text: "#0A0A0A",
      summary: "基于 Commander 封装 init / update / status / search / instructions，默认将定位结果聚合为紧凑导航树。",
      details: [
        "create-cli.ts 严格校验 --top (1..100)、--path、--json、--snippet、--explain 参数",
        "search-tree.ts 实现共同目录提取、单分支 / 与 › 折叠及最高分优先排序",
        "JSON 与诊断输出严格写 stdout，错误信息写 stderr，失败返回非零退出码"
      ]
    },
    {
      id: "instructions",
      label: "Agent 规则注入",
      pkg: "src/instructions/",
      chip: "POSTINSTALL",
      x: 1, y: 8, w: 12, h: 6,
      fill: "#2BA676", text: "#FFFFFF",
      summary: "npm 全局安装或执行 docseek instructions --install 时，幂等维护 Codex 与 Claude 用户级规则文件。",
      details: [
        "使用 <!-- DOCSEEK:INSTRUCTIONS:START/END --> 闭合标签原位替换，不触碰用户原有规则",
        "支持 docseek instructions 纯文本输出，方便接入 Cursor / Gemini / 任意 Agent",
        "Markdown 来源进入解析器前自动屏蔽该规则区块（保留换行），避免搜索自匹配"
      ]
    },
    {
      id: "application",
      label: "应用编排层",
      pkg: "src/application/",
      chip: "USE CASES",
      x: 14, y: 1, w: 12, h: 6,
      fill: "#2370E8", text: "#FFFFFF",
      summary: "编排初始化、增量更新、状态检查、跨文件批量索引与搜索执行，隔离 CLI 与基础设施。",
      details: [
        "init-project.ts 先构建临时数据库再原子替换，避免中断损坏索引",
        "update-project.ts 按内容哈希增量比对，纯删除或无变化时不加载模型",
        "index-batch.ts 跨文件汇总变化片段，交由 EmbeddingProvider 按长度分桶批处理"
      ]
    },
    {
      id: "markdown",
      label: "AST 解析与分块",
      pkg: "src/markdown/",
      chip: "MDAST",
      x: 14, y: 8, w: 12, h: 6,
      fill: "#A98BF7", text: "#0A0A0A",
      summary: "通过 fast-glob 发现项目 Markdown，基于 mdast 提取精确标题层级、块级边界与源码起止行号。",
      details: [
        "保留完整标题路径栈（如 3. 本期容量判断 › 3.1 触发条件）与 L起-止 行号",
        "超长章节沿段落、列表与代码块边界二次切分，不破坏语义完整性",
        "通过 DiscoveredDocument 统一交接，为后续 add / 标签 / 多项目集合预留边界"
      ]
    },
    {
      id: "embedding",
      label: "本地向量引擎",
      pkg: "src/embedding/",
      chip: "E5-SMALL Q8",
      x: 14, y: 15, w: 12, h: 8,
      fill: "#F5B700", text: "#0A0A0A",
      summary: "基于 @huggingface/transformers 本地运行 Xenova/multilingual-e5-small q8（约 118MB，384 维），离线可用。",
      details: [
        "自动按文本长度分桶批处理，超长输入保留头尾 token 避免尾部信息丢失",
        "模型指纹与向量维度写入 metadata 表，更换模型时安全要求完整重建",
        "通过 EmbeddingProvider 抽象隔离底层运行时，bench/embedding/ 独立评测候选模型"
      ]
    },
    {
      id: "search",
      label: "双路融合与过滤",
      pkg: "src/search/",
      chip: "HYBRID RRF",
      x: 27, y: 1, w: 12, h: 11,
      fill: "#FF5A5A", text: "#FFFFFF",
      summary: "融合 sqlite-vec 语义候选与 FTS5 关键词候选，计算 0–1 绝对检索强度并过滤低可信噪声。",
      details: [
        "默认权重：向量 0.45 + 关键词 0.55，RRF 常数 k = 8 拉开前列差距",
        "绝对分 = 排名融合 0.60 + 词项覆盖 0.20 + 语义强度 0.20，可跨查询比较",
        "区分发散候选词与完整问句模式，结合项目内词汇证据控制放宽边界（4 种放行原因）",
        "中文切词 + 连续双字组合 + 标题更高 BM25 权重，无答案自动返回空"
      ]
    },
    {
      id: "storage",
      label: "SQLite 统一存储",
      pkg: "src/storage/",
      chip: "11 TABLES",
      x: 27, y: 13, w: 12, h: 10,
      fill: "#0A0A0A", text: "#F3ACF0",
      summary: "单文件 .docseek/index.db 集成 better-sqlite3 + sqlite-vec 向量表 + FTS5 全文表，支持版本迁移。",
      details: [
        "包含 collections / sources / documents / chunks / chunk_embeddings / chunks_fts 与 tags 体系",
        "开启外键级联约束与忙等待重试，单文档更新严格包裹在事务中",
        "文件路径存储前统一规范化为 /，已预留多集合、外部来源与标签筛选查询能力"
      ]
    },
    {
      id: "eval",
      label: "离线质量评测",
      pkg: "src/evaluation/",
      chip: "QUALITY GATE",
      x: 1, y: 15, w: 12, h: 8,
      fill: "#FFFFFF", text: "#0A0A0A",
      summary: "复用完全一致的生产搜索入口与模型会话，自动验证 Recall@5、术语第一名、无答案识别与排序稳定性。",
      details: [
        "34 条自身质量门禁：正向 Top-5、精确术语第 1、无答案识别、重复稳定性均达 100%",
        "InferForge 冻结索引 90 条发散词实测：Recall@5 提升至 0.356，意图覆盖 0.767",
        "npm run gate 串联格式、ESLint、TS 严格类型、Vitest 单元/集成测试、构建与 npm pack"
      ]
    }
  ],
  hybridSpecs: [
    { id: "r1", item: "双路加权 RRF 融合", formula: "0.45 × Vector + 0.55 × FTS5 (k = 8)", detail: "RRF 常数由 60 降至 8，拉开前列与后排差距；精确关键词命中可稳居首位" },
    { id: "r2", item: "绝对检索强度分数", formula: "0.60 × RRF + 0.20 × 词项覆盖 + 0.20 × 语义强度", detail: "范围 0–1，不依赖本轮最高结果归一化，可跨查询横向比较" },
    { id: "r3", item: "查询模式自适应", formula: "发散候选词 (2–5 短词) vs 完整问句 (严格模式)", detail: "保留 CLI 参数边界；发散模式需项目内词汇证据（单术语 ≥1 / 多词包 ≥2）才允许放宽" },
    { id: "r4", item: "四种可解释放行原因", formula: "signal · dual-route · term-vector · term-keyword", detail: "放宽范围严格限制在向量前 3 与关键词前 3，防止候选池整体泄漏；--explain 完整可见" },
    { id: "r5", item: "中英文与代码标识符分词", formula: "中文分词 + 连续双字 (bigrams) + 标题加权 BM25", detail: "查询侧自动过滤单汉字、常见中英文问句停用词与过短词项，消除偶然噪声命中" },
    { id: "r6", item: "确定性稳定排序", formula: "Score ↓ → Source → Document → Line → ChunkID", detail: "并列分数通过稳定定位键打破，同一索引与同一查询多次运行结果 100% 一致" },
    { id: "r7", item: "11 张 SQLite 表结构", formula: "collections · sources · documents · chunks · vec · fts · tags", detail: "标签与来源关联表独立于正文与向量，后续扩展 --tag 与外部目录无需重算 Embedding" }
  ],
  docsItems: [
    {
      id: "cli-init", kind: "核心命令", cat: "index", name: "docseek init",
      params: "(自动向上定位 .docseek/config.toml 或 Git 根目录)",
      summary: "创建或完整重建当前项目本地索引；自动将 /.docseek/ 加入 .gitignore，首次运行自动缓存本地 q8 模型。",
      example: `# 在项目根目录或任意子目录运行\ncd /path/to/your-project\ndocseek init\n# 输出示例:\n# Indexed 126 documents and 1598 chunks in /path/to/your-project.`
    },
    {
      id: "cli-status", kind: "核心命令", cat: "index", name: "docseek status",
      params: "[--json]",
      summary: "低成本查看索引规模、模型指纹、最近更新时间与待处理变更（新增/修改/删除）。不加载 Embedding 模型。",
      example: `docseek status\ndocseek status --json`
    },
    {
      id: "cli-update", kind: "核心命令", cat: "index", name: "docseek update",
      params: "(按文件内容哈希增量比对)",
      summary: "仅对新增、修改的 Markdown 重新解析并生成向量，清理已删除文档记录；未变化文件完全跳过。",
      example: `docseek update\n# 输出示例:\n# Updated 1 added, 2 modified, 0 deleted; 123 unchanged.`
    },
    {
      id: "cli-search", kind: "核心命令", cat: "hybrid", name: "docseek search <query...>",
      params: "<query...> [--top 1..100] [--path <路径>] [--json] [--snippet] [--explain]",
      summary: "执行语义向量 + FTS5 混合检索，默认以紧凑导航树返回相关文件、章节路径、行区间与绝对分数。",
      example: `# 推荐：像 grep 一样传入 2–5 个发散短词\ndocseek search "容量判断" "Worker启动时间" "SLA可行性" --top 8\ndocseek search "SLA" "违约" "退款" "赔付"\ndocseek search "scheduler" "GPU" "cold start" "scale out"`
    },
    {
      id: "opt-top", kind: "搜索选项", cat: "tree", name: "--top <1..100>",
      params: "整数，范围 1 至 100（默认返回召回池内全部可信结果）",
      summary: "限制最终最多返回的位置数量。未传时返回全部通过可信度门槛的结果，明确无答案时可能返回 0 条。",
      example: `docseek search "调度策略" --top 5`
    },
    {
      id: "opt-path", kind: "搜索选项", cat: "tree", name: "--path <路径>",
      params: "目录或文件路径子串（统一使用 / 分隔）",
      summary: "只检索路径中包含指定内容的文档。推荐先宽范围发散搜索锁定目录，再用 --path 精准收窄。",
      example: `docseek search "调度策略" --path docs/模块设计/\ndocseek search "迁移" --path docs/架构设计.md`
    },
    {
      id: "opt-json", kind: "搜索选项", cat: "agent", name: "--json",
      params: "用于 search 与 status 命令",
      summary: "输出稳定的逐片段机器可读 JSON 协议至 stdout，适合自动化脚本、CI 管线或结构化后处理。",
      example: `docseek search "弹性扩容" "冷启动" --top 5 --json`
    },
    {
      id: "opt-snippet", kind: "搜索选项", cat: "hybrid", name: "--snippet",
      params: "调试与人工核对选项",
      summary: "在逐条结果中附带短正文片段预览；面向 Agent 日常检索时建议保持默认紧凑树以节省上下文。",
      example: `docseek search "容量判断" --top 5 --snippet`
    },
    {
      id: "opt-explain", kind: "搜索选项", cat: "hybrid", name: "--explain",
      params: "可与文本或 --json 组合使用",
      summary: "展示查询模式、向量/关键词排名、词项覆盖、放行原因（signal/dual-route/term-vector/term-keyword）及各阶段耗时。",
      example: `docseek search "SLA" "违约" "退款" --top 5 --explain`
    },
    {
      id: "cli-instructions", kind: "规则与评测", cat: "agent", name: "docseek instructions",
      params: "[--install]",
      summary: "默认打印精简 Agent 使用规范提示词；加 --install 幂等写入 ~/.codex/AGENTS.md 与 ~/.claude/CLAUDE.md 闭合标签区块。",
      example: `# 查看标准规则块（可复制到 Cursor / Gemini 等规则文件）\ndocseek instructions\n\n# 手工安装或修复 Codex / Claude 用户级规则\ndocseek instructions --install`
    },
    {
      id: "dev-gate", kind: "规则与评测", cat: "index", name: "npm run gate",
      params: "源码开发与发版前门禁",
      summary: "依次执行 Prettier 格式检查、ESLint、TypeScript 严格类型检查、Vitest 单元/集成测试、生产构建与 npm pack --dry-run。",
      example: `npm install\nnpm run gate`
    },
    {
      id: "dev-eval", kind: "规则与评测", cat: "hybrid", name: "npm run eval:quality",
      params: "真实本地 Embedding 模型离线质量评测",
      summary: "构建后使用真实模型运行 eval/search-quality.json 问题集，校验中文改写、精确术语、中英文混合、路径过滤、无答案识别与稳定性。",
      example: `npm run eval:quality`
    }
  ],
  compressionBreakdown: [
    { key: "tree", label: "紧凑导航树保留字符 (4,374 chars · 20%)", color: "#2BA676", units: 20, desc: "保留全部 99 处文件、章节、行号与分数；单分支用 / 与 › 折叠至同行，省去重复路径与 JSON 键名。" },
    { key: "unfolded", label: "单分支折叠额外省下 (2,404 chars · 11%)", color: "#2370E8", units: 11, desc: "相比未折叠的普通树形（6,778 chars / 242 行），将只有一个子节点的连续目录与标题链合并到单行。" },
    { key: "json-saved", label: "相较 JSON 直接省下的冗余 (14,804 chars · 69%)", color: "#F3ACF0", units: 69, desc: "同一批 99 条结果若输出为 JSON 需 21,582 字符 / 1,048 行。紧凑树总计节省约 80% 字符与 88% 行数。" }
  ],
  sandboxCorpus: [
    {
      id: "if-cap-31",
      path: "inferforge-docs/模块设计/M2-弹性容量调配.md",
      headings: ["3. 本期容量判断", "3.1 触发条件"],
      lineStart: 105,
      lineEnd: 117,
      snippet: "当排队任务预估等待时间超过 SLA 阈值且现有常驻 Worker 利用率高于 85% 时，触发弹性扩容容量判断，优先评估可用 GPU 池与冷启动窗口。",
      terms: ["容量判断", "容量", "触发条件", "弹性", "扩容", "gpu", "sla", "worker", "阈值", "排队", "利用率", "冷启动"]
    },
    {
      id: "if-cap-23",
      path: "inferforge-docs/模块设计/M2-弹性容量调配.md",
      headings: ["2. 容量动作", "2.3 启动新 Worker"],
      lineStart: 92,
      lineEnd: 101,
      snippet: "启动新 Worker 需要计算镜像拉取、模型权重加载与健康检查耗时（Worker启动时间），结合 warm pool 预热节点缩短冷启动延迟。",
      terms: ["容量动作", "worker", "启动", "worker启动时间", "冷启动", "cold start", "warm pool", "镜像", "模型", "gpu", "scale out", "扩容"]
    },
    {
      id: "if-cap-21",
      path: "inferforge-docs/模块设计/M2-弹性容量调配.md",
      headings: ["2. 容量动作", "2.1 统一就绪时间"],
      lineStart: 64,
      lineEnd: 74,
      snippet: "统一就绪时间将冷启动、权重预热与现有节点迁移耗时归一化为同一时间轴，供调度器比较不同容量动作的 SLA 可行性。",
      terms: ["容量动作", "就绪时间", "worker启动时间", "sla可行性", "sla", "冷启动", "调度", "scheduler", "worker"]
    },
    {
      id: "if-cap-22",
      path: "inferforge-docs/模块设计/M2-弹性容量调配.md",
      headings: ["2. 容量动作", "2.2 调配现有 Worker"],
      lineStart: 76,
      lineEnd: 90,
      snippet: "当同规格空闲节点或低优先级可抢占任务存在时，优先调配现有 Worker 执行抢占迁移（preemption / retry），避免不必要的扩容开销。",
      terms: ["容量动作", "worker", "调配", "抢占", "preemption", "retry", "掉线", "迁移", "扩容"]
    },
    {
      id: "if-cap-7",
      path: "inferforge-docs/模块设计/M2-弹性容量调配.md",
      headings: ["7. 当前实现"],
      lineStart: 258,
      lineEnd: 291,
      snippet: "当前实现已完成容量判断状态机、Worker 启动耗时滑动窗口统计以及冷启动超时回退策略，单元测试覆盖全部边界分支。",
      terms: ["容量判断", "worker启动时间", "当前实现", "冷启动", "worker", "状态机"]
    },
    {
      id: "if-sla-42",
      path: "inferforge-docs/模块设计/M2-SLA队列与派活.md",
      headings: ["4. 违约判定与赔付策略", "4.2 自动退款触发"],
      lineStart: 142,
      lineEnd: 168,
      snippet: "若推理请求端到端延迟超出承诺 SLA 上限且未在宽限期内恢复，系统标记 SLA 违约并自动生成退款与信用赔付单据。",
      terms: ["sla", "违约", "退款", "赔付", "补偿", "超时", "延迟", "队列", "派活", "sla可行性"]
    },
    {
      id: "if-sla-7",
      path: "inferforge-docs/模块设计/M2-SLA队列与派活.md",
      headings: ["7. 当前实现"],
      lineStart: 256,
      lineEnd: 273,
      snippet: "SLA 队列基于截止时间紧迫度动态计算可行性，Worker 掉线时自动触发任务重派（retry）并记录违约风险预警。",
      terms: ["sla", "sla可行性", "队列", "派活", "worker", "掉线", "retry", "违约", "当前实现"]
    },
    {
      id: "if-sched-8",
      path: "inferforge-docs/模块设计/M2-调度策略层.md",
      headings: ["8. 当前实现"],
      lineStart: 209,
      lineEnd: 220,
      snippet: "调度策略层（scheduler）整合 GPU 显存碎片评估、冷启动成本与抢占代价，在多租户队列间输出确定性派活决策。",
      terms: ["调度策略", "调度", "scheduler", "gpu", "冷启动", "cold start", "preemption", "容量判断", "worker", "当前实现"]
    },
    {
      id: "if-req-133",
      path: "inferforge-docs/需求规格.md",
      headings: ["13. 分期验收标准", "13.3 M2 验收标准"],
      lineStart: 540,
      lineEnd: 553,
      snippet: "M2 验收要求在突发流量下准确完成容量判断与 SLA 可行性校验，新 Worker 启动后 95% 请求在约定延迟内完成且零重复扣费。",
      terms: ["验收标准", "容量判断", "sla可行性", "sla", "worker启动时间", "worker", "退款", "违约", "需求"]
    },
    {
      id: "ds-index-hash",
      path: "docs/模块设计/文档索引.md",
      headings: ["3. 增量更新与哈希比对"],
      lineStart: 38,
      lineEnd: 64,
      snippet: "DocSeek 基于文件内容 SHA-256 哈希识别新增、修改与删除文档；未变化文件跳过 AST 解析与本地 Embedding，保持原有向量记录不变。",
      terms: ["索引", "哈希", "增量", "update", "hash", "ast", "mdast", "markdown", "embedding", "文档索引"]
    },
    {
      id: "ds-tree-fold",
      path: "docs/模块设计/紧凑树形输出.md",
      headings: ["2. 单分支折叠与统计规则"],
      lineStart: 29,
      lineEnd: 46,
      snippet: "只有一个子节点的连续目录、文件和章节使用 / 或 › 合并至同一行；有分叉的节点汇总 ×命中数 .平均分，按内部最高分优先排列，较 JSON 减少约 80% 字符。",
      terms: ["紧凑树", "树形输出", "折叠", "压缩", "字符", "json", "导航", "行号", "上下文", "token"]
    },
    {
      id: "ds-hybrid-rrf",
      path: "docs/模块设计/混合检索.md",
      headings: ["3. 关键决策与融合评分"],
      lineStart: 34,
      lineEnd: 59,
      snippet: "默认向量权重 0.45、FTS5 关键词权重 0.55，RRF 常数 k=8；最终绝对分由排名融合 0.60、词项覆盖 0.20、语义强度 0.20 组成，无答案自动过滤为空。",
      terms: ["混合检索", "rrf", "sqlite-vec", "fts5", "向量", "关键词", "融合", "评分", "绝对分", "过滤", "explain"]
    }
  ],
  sandboxPresets: [
    { label: "容量与 SLA", query: `"容量判断" "Worker启动时间" "SLA可行性"` },
    { label: "违约与赔付", query: `"SLA" "违约" "退款" "赔付"` },
    { label: "GPU 扩容", query: `"scheduler" "GPU" "cold start" "warm pool"` },
    { label: "哈希增量与压缩", query: `"哈希" "增量" "紧凑树" "RRF"` },
    { label: "无答案过滤测试", query: `"火星天气预报" "火箭菜谱"` }
  ],
  faq: [
    {
      q: "首次运行 docseek init 需要联网吗？模型会存放在项目仓库里吗？",
      a: "首次初始化会自动下载默认本地模型 Xenova/multilingual-e5-small q8（约 118 MB）到用户级缓存目录，不会放进项目仓库。模型缓存完成后，所有索引更新与搜索均可完全离线本地运行。"
    },
    {
      q: "DocSeek 会污染项目的 Git 状态吗？",
      a: "不会。docseek init 会在项目根目录创建 .docseek/（仅包含 config.toml 与 index.db），并自动把 /.docseek/ 追加到项目的 .gitignore 中。"
    },
    {
      q: "为什么不提供 MCP Server、后台守护进程或 Web 服务？",
      a: "DocSeek 专注“把自然语言定位到 Markdown 行号”这一件事。保持单进程 CLI 意味着零后台常驻内存、零端口/MCP 协议配置成本、极低启动与调试复杂度，任何能跑 shell 命令的 Coding Agent 都能开箱使用。"
    },
    {
      q: "文档修改后会自动实时同步到索引吗？",
      a: "不会有后台文件监听器。Agent 或开发者只需先执行不加载模型的 docseek status 检查待处理变化，发现变更后执行 docseek update 即可按内容哈希增量更新，未变化文件跳过解析与向量计算。"
    },
    {
      q: "为什么有时搜索结果为空，或者少于 --top 指定的数量？",
      a: "这是刻意的低可信过滤设计。DocSeek 计算 0–1 绝对检索强度并结合项目内词汇证据做分级放行，明确无答案或噪声过高的候选会被过滤，宁可返回空提示换词重搜，也不会强行凑数把弱结果标成 1.00 误导 Agent。"
    },
    {
      q: "后续如果要索引项目外文档、按标签过滤或跨项目检索，需要推倒重来吗？",
      a: "不需要。内部数据模型与 SQLite 表已经按 Collection → Source → Document → Chunk → Embedding 以及独立的 tags / source_tags / document_tags 拆好边界，未来开放 add / --tag / 全局集合时索引主流程与向量无需推翻重建。"
    }
  ]
};
