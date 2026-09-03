# DocSeek

<div align="center">
  <p><strong>Semantic Documentation Locator for AI Coding Agents</strong></p>
  <p><em>Know what you mean. Find where it lives.</em></p>
  <p>自然语言与概念短语进入，Markdown 文件、章节和行号返回。</p>
  <p>
    <img alt="Node.js >= 22" src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&amp;logoColor=white" />
    <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&amp;logoColor=white" />
    <img alt="SQLite" src="https://img.shields.io/badge/storage-SQLite-003B57?logo=sqlite&amp;logoColor=white" />
    <img alt="Local first" src="https://img.shields.io/badge/runtime-local-111827" />
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-2f855a" />
  </p>
</div>

> **Retrieval is navigation, not context generation.**

当 AI Coding Agent 知道自己要找什么，却不知道信息藏在哪份设计文档里，`grep` 往往要求它先猜中原文用词。DocSeek 同时使用语义向量与关键词检索，把概念、同义表达和项目术语映射到准确的 Markdown 位置。

默认结果只包含导航坐标。正文继续留在项目文档中，由 Agent 按需读取并自行判断。

```text
Agent 的概念或自然语言
          │
          ▼
       DocSeek
   ┌──────┴──────┐
语义向量       FTS5 关键词
   └──────┬──────┘
          ▼
     紧凑导航树
          ▼
  文件 + 章节 + 行号
          ▼
   Agent 读取 Markdown
```

## 为什么用 DocSeek

| 文档检索中的困难          | DocSeek 的处理方式                        |
| ------------------------- | ----------------------------------------- |
| 不知道原文究竟用了哪个词  | 多语言 Embedding 召回同义表达             |
| 项目黑话、缩写和标识符    | SQLite FTS5 保留精确词项命中              |
| 固定长度切块破坏章节语义  | 按 Markdown 标题层级和块级结构建立索引    |
| 搜索结果大量重复路径      | 将目录、文件、章节和行区间压缩成一棵树    |
| 大段正文挤占 Agent 上下文 | 默认只返回定位信息，正文由 Agent 自行读取 |
| 文档频繁变化              | 基于内容哈希进行增量更新                  |
| Agent 和编辑器各不相同    | 只依赖 CLI，任何能执行命令的 Agent 都能用 |

DocSeek 在本地运行，无后台进程、数据库服务、容器和常驻守护程序。

## 快速开始

当前版本为 `0.1.0`，npm 包尚未发布。现在可以从源码安装：

```bash
git clone https://github.com/evepupil/DocSeek.git
cd DocSeek
npm install
npm run build
npm link
```

发布到 npm 后可直接安装：

```bash
npm install --global docseek
```

进入需要检索的项目并建立索引：

Run the CLI from any project subdirectory. DocSeek walks upward to an existing `.docseek/config.toml` or the Git project root.

```bash
cd /path/to/your-project
docseek init
```

`init` 会识别 Git 项目根目录，扫描 Markdown，下载并缓存本地 Embedding 模型，然后创建：

```text
.docseek/
├─ config.toml
└─ index.db
```

`/.docseek/` 会自动加入项目的 `.gitignore`。默认 q8 模型约 118 MB，只在首次使用时下载。

随后可以直接搜索：

```bash
docseek search "容量判断" "Worker启动时间" "SLA可行性"
```

## 真实输出

下面来自 InferForge 的实际索引，语料包含 126 份 Markdown、1,598 个可检索章节：

```console
$ docseek search "容量判断" "Worker启动时间" "SLA可行性" --top 8
inferforge-docs/
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
└─ 需求规格.md › 13. 分期验收标准 › 13.3 M2 验收标准 L540-553 .794
```

输出中的符号很少：

| 表达            | 含义                                      |
| --------------- | ----------------------------------------- |
| `×7 .803`       | 该分支有 7 个命中，平均分为 `.803`        |
| `›`             | 只有一个孩子的连续层级已压缩到同一行      |
| `L105-117 .844` | 原文位于 105 至 117 行，该位置得分 `.844` |

分数范围为 0 到 1，表示检索强度，不代表命中概率。分支按照内部最高分优先排列，让最值得读取的位置尽早出现。

在一次返回 99 个位置的实际查询中，紧凑树占 4,374 个字符，同一批结果的 JSON 占 21,582 个字符。树形表达减少约 80% 的字符，同时保留了全部文件、章节、行号和分数。

## 查询怎么写

DocSeek 支持完整自然语言，也适合由多个概念短语组成的查询。Agent 上下文不足时，推荐把已知概念、缩写和可能的同义说法分别传入：

```bash
docseek search "worker扩容" "冷启动时间" "SLA调度"
docseek search "容量判断" "预计就绪时间" "排队SLA"
docseek search "scheduler" "scale out" "cold start"
```

多个查询参数会按空格合并成一次检索。这样可以在不掌握文档原词的情况下扩大召回，同时让项目术语继续参与关键词匹配。

限制搜索范围或结果数量：

```bash
docseek search "调度策略" --path docs/architecture/
docseek search "调度策略" --top 5
```

未传 `--top` 时，DocSeek 返回召回池内全部可信结果。低可信结果会被过滤，所以结果数量可能为零。

## 命令与选项

| 命令             | 作用                                     |
| ---------------- | ---------------------------------------- |
| `docseek init`   | 创建或完整重建当前项目索引               |
| `docseek update` | 只处理新增、修改和删除的 Markdown        |
| `docseek status` | 查看索引规模、更新时间和待处理变化       |
| `docseek search` | 返回相关文件、标题层级、行区间和检索分数 |

`search` 支持以下选项：

| 选项            | 作用                                   |
| --------------- | -------------------------------------- |
| `--top <数量>`  | 最多返回多少个位置，范围为 1 至 100    |
| `--path <路径>` | 只检索路径中包含指定内容的文档         |
| `--json`        | 输出稳定的机器可读 JSON                |
| `--snippet`     | 附带短正文片段，适合人工调试           |
| `--explain`     | 显示语义、关键词、排序信号和各阶段耗时 |

默认文本最节省上下文；自动化程序需要字段协议时使用 `--json`；排查检索质量时再启用 `--snippet` 或 `--explain`。

## 文档什么时候更新到索引

DocSeek 按命令更新，没有后台监听器。`search` 读取当前索引，Markdown 变化后需要执行：

Update reindexes added, changed, and deleted Markdown files; unchanged files keep their existing vectors.

```bash
docseek status
docseek update
```

更新过程使用文件内容哈希判断变化：

日常更新只处理发生变化的文件，无需每次重新处理全部文档。

- 新增文件：解析、切分并生成 Embedding。
- 修改文件：只重建该文件的章节和索引。
- 删除文件：移除对应正文、关键词和向量记录。
- 未变化文件：跳过解析与 Embedding。

`status` 不加载模型，适合 Agent 在检索前低成本检查。常用流程如下：

```text
文档可能发生变化
  -> docseek status
  -> 有待处理变化时 docseek update
  -> docseek search
  -> Read 返回的 Markdown 行区间
```

## 接入任意 Coding Agent

DocSeek 只要求 Agent 能执行 shell 命令。可以把下面这段加入项目的 `AGENTS.md`、`CLAUDE.md` 或其他 Agent 规则文件：

```md
## 项目文档检索

- 当设计决策、业务规则或历史背景的位置未知时，先执行 `docseek search`。
- 查询优先组合概念、缩写和同义表达，例如 `docseek search "容量判断" "冷启动" "SLA"`。
- 根据返回的文件、标题和行号读取原始 Markdown，只读取当前任务需要的范围。
- 文档发生变化后先执行 `docseek status`，存在待处理变化时执行 `docseek update`。
```

这个约定不绑定 Codex、Claude Code、Cursor、Cline 或其他 Agent，也不要求 MCP。

## 工作原理

```text
Markdown 来源
  -> 标题层级解析
  -> 章节与块级结构切分
  -> 本地 Embedding + FTS5 索引
  -> 向量召回 + 关键词召回
  -> 稳定融合 + 可信度过滤
  -> 紧凑导航树
```

核心实现保持简单：

- Markdown AST 提供准确的标题层级和源码行号。
- 超长章节继续按段落、列表和代码块切分。
- `sqlite-vec` 负责向量检索，SQLite FTS5 负责关键词检索。
- 中文索引增加连续双字等检索词，改善中文术语召回。
- 两路结果经过稳定融合，同一索引与查询保持确定顺序。
- 默认模型为 `Xenova/multilingual-e5-small` q8，适合中英文技术文档。

所有项目数据都保存在项目自己的 `.docseek/` 中。模型缓存位于用户缓存目录；模型下载完成后，索引和搜索可以在本地执行。

## 边界

DocSeek 专注“信息在哪里”这一件事。当前版本不承担：

- 自动总结或生成答案
- 向 Agent 注入大段检索正文
- 自动修改项目文档
- MCP、Web UI 或云端服务
- 对话记忆、权限系统和多用户协作
- Code RAG、知识图谱和复杂重排

清晰的边界让它保持低启动延迟、低运行成本和可调试性。

## 可扩展方向

MVP 的公开接口保持精简，内部已经按集合、来源、文档、章节、标签和检索条件拆开。后续可以沿现有边界增加：

- `add` / `remove`：把项目外的目录或单个文档加入索引
- 标签：添加来源时设置标签，并按标签筛选
- 多项目集合：统一检索多个项目的工程记忆
- 更多本地 Embedding 模型与可选重排器

这些方向会根据真实检索数据逐步验证。当前进度见 [Roadmap](docs/roadmap.md)。

## 开发与验证

要求 Node.js 22 或更高版本。

```bash
npm install
npm run gate
npm run eval:quality
```

`npm run gate` 会依次检查格式、ESLint、TypeScript 严格模式、单元与集成测试、生产构建和 npm 包内容。真实模型评测覆盖中文改写、精确术语、中英文混合、路径过滤、无答案识别和结果稳定性。

设计文档：

- [需求设计](docs/需求设计.md)
- [技术设计](docs/技术设计.md)
- [架构设计](docs/架构设计.md)
- [路线图](docs/roadmap.md)
- [紧凑树形输出](docs/模块设计/紧凑树形输出.md)

## License

[MIT](LICENSE)
