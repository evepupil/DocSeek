# Agent 使用入口模块

- **模块定位**：在 DocSeek 全局安装时，把精简使用规则安全写入 Codex 与 Claude 的用户级全局指令文件。
- **对应代码**：`src/instructions/`、`scripts/postinstall.mjs`、`src/cli/create-cli.ts`、`src/markdown/`。
- **所属 M 里程碑**：[M6 Agent 使用入口](../roadmap.md#m6-agent使用入口)。
- **当前状态**：实现完成，待发布验证。
- **最近更新时间**：2026-09-04。

## 职责与边界

- 维护一份短小、可版本化、与 Agent 品牌无关的 DocSeek 使用规则。
- 解析 Codex 和 Claude 的用户级全局指令路径。
- 在完整闭合标签内替换旧规则，或在没有标签时追加新规则。
- 保留用户原有内容，不解析或输出标签外正文。
- 为安装脚本受限、规则缺失或版本升级提供手工修复命令。
- 阻止生成的使用规则进入 DocSeek 文档索引。
- 不修改项目级 Agent 文件，不安装 MCP，不改变搜索和索引配置。

## 目标路径

| Agent       | 默认路径              | 环境变量覆盖        |
| ----------- | --------------------- | ------------------- |
| Codex       | `~/.codex/AGENTS.md`  | `CODEX_HOME`        |
| Claude Code | `~/.claude/CLAUDE.md` | `CLAUDE_CONFIG_DIR` |

Codex 路径依据 [OpenAI Docs 的全局 AGENTS.md 说明](https://learn.chatgpt.com/docs/agent-configuration/agents-md#create-global-guidance)。两个目标使用相同提示词，目录适配与内容渲染分开。

## 提示词区块

```md
<!-- DOCSEEK:INSTRUCTIONS:START -->

## Documentation lookup with DocSeek

- Before the first search in a project, run `docseek status`; run `docseek init` first when uninitialized, or `docseek update` when changes are pending.
- When project documentation location or wording is unknown, run `docseek search "<concept>" "<synonym>"`.
- Prefer short concepts, aliases, abbreviations, and domain terms. Multiple arguments form one query.
- Treat results as navigation and read the returned Markdown ranges before drawing conclusions.
- Keep compact output by default. Add `--path` or `--top` to narrow; use `--json`, `--snippet`, or `--explain` only when needed.

<!-- DOCSEEK:INSTRUCTIONS:END -->
```

提示词只描述使用时机和可靠工作流，不介绍产品、不重复完整帮助、不注入当前用户或项目路径。

初始化检查必须排在搜索说明之前。Agent 在每个项目首次搜索前先运行 `status`；未初始化时先执行 `init`，存在待处理变化时先执行 `update`。

## 写入规则

```text
目标不存在
  -> 创建父目录和文件

目标存在且无 DocSeek 标签
  -> 保留原文
  -> 空一行追加完整区块

目标存在且恰好一对闭合标签
  -> 原位置替换整个区块

单边、倒序、嵌套或重复标签
  -> 不写文件
  -> 返回 skipped 和简短原因
```

- 相同内容再次安装返回 `unchanged`，不改文件时间。
- 每个目标单独执行，部分失败不会回滚已经完成的另一个目标。
- 符号链接目标返回 `skipped`，避免写到无法从显示路径判断的文件。
- 新文件使用当前平台换行；已有文件沿用检测到的 CRLF 或 LF。
- 生命周期脚本捕获所有错误并保持安装成功，同时把修复命令写到警告中。

## 索引防污染

全局规则文件也可能位于某个项目的 Markdown 扫描范围内。进入 Markdown AST 前，将开始标签到结束标签之间的每一行替换为空行。这样同时满足：

- 使用提示不会成为项目知识候选。
- 标签外的 Agent 规则仍可进入索引。
- 区块之后的标题与正文行号不发生位移。
- 缺少闭合标签时不屏蔽内容，避免误删大段文档。

## 命令与安装行为

```bash
docseek instructions
docseek instructions --install
```

- 无参数时只把规范提示词写到 stdout。
- `--install` 与 npm 全局安装调用相同逻辑，打印两个目标的处理状态。
- 根帮助列出该命令；`init` 完成后不重复写全局文件。
- npm 本地安装时生命周期脚本跳过，不产生用户目录副作用。

## 当前实现

`0.2.0` 发布候选已经实现规范提示词、标签合并、全局目标解析、安全文件写入、生命周期包装脚本、手工修复命令和 Markdown 等行屏蔽。CLI 版本与 npm 包版本由同一受测常量约束，发布清单显式包含顶层版本模块、`dist/instructions` 和 `scripts/postinstall.mjs`。

隔离 npm 全局安装实测完成以下闭环：本地安装标志不创建文件；全局安装自动创建 Codex 与 Claude 两个目标；安装后的命令返回 `0.2.0`；重复执行生命周期脚本时两个目标均返回 `unchanged`，每个文件只有一对 DocSeek 标签。

## 验证方式

- 空目录中创建两个正确目标文件。
- 无标签文件只追加区块，原文逐字保留。
- 完整旧区块原位替换，重复执行无文件变化。
- 单边、倒序和重复标签拒绝写入。
- CRLF、LF 和 UTF-8 BOM 保持。
- 符号链接目标拒绝写入。
- 一个目标失败时另一个继续完成。
- npm 本地安装不注入，全局安装触发注入。
- 手工命令输出与安装区块内容一致。
- Markdown 屏蔽后不检索提示词，区块后章节行号保持不变。
- npm 发布包包含生命周期脚本、编译模块和有效命令入口。

## 待扩展项

- 增加其他 Agent 的目标路径适配器。
- 提供规则状态检查和显式移除命令。
- 根据实际上下文成本评估更短的提示词版本。
- 在更多平台和 npm 安全策略下验证生命周期脚本行为。

## 改动历史

- 2026-09-04：确认全局安装自动注入 Codex 与 Claude，闭合标签内替换，无标签时追加整段。
- 2026-09-04：完成全局目标安全写入、`instructions` 命令、npm 生命周期入口、索引屏蔽和隔离包安装验证。
