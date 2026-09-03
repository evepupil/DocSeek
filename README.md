# DocSeek

DocSeek is a local semantic documentation locator for AI coding agents. It turns a natural-language question into Markdown file paths, heading hierarchies, and line ranges, then leaves the agent to read the original source.

> Retrieval is navigation, not context generation.

## Status

The MVP is implemented and validated locally. The npm package has not been published yet.

## Usage

```bash
docseek init
docseek update
docseek status
docseek search "why does scheduler scale-out consider GPU cold starts"
docseek search "worker lifecycle" --top 5 --path architecture/ --json
docseek search "worker lifecycle" --explain
```

The default output groups repeated paths and headings into a compact navigation tree:

```text
docs/
└─ architecture/engine.md ×2 .775
   ├─ Scheduler › GPU Cold-start Capacity L142-176 .920
   └─ Worker › Startup L88-121 .630
```

Branches show `hit count + average score`; a single-result path is collapsed onto the line carrying its range and score. Use `--json` for machine-readable results, `--snippet` for a short preview, or `--explain` for retrieval signals and timing diagnostics.

Without `--top`, DocSeek prints every trusted result found in the configured candidate pool. `--top` adds an optional maximum. Confidence filtering can still return fewer results, including none, when the available locations have weak semantic and lexical support.

`init` creates `.docseek/config.toml` and `.docseek/index.db`, then adds `/.docseek/` to the project `.gitignore`. `update` only reindexes added and changed files and removes deleted files from the index.

## Requirements

- Node.js 22 or newer
- Git is recommended for automatic project-root detection

The first `init` downloads the default multilingual model. Its q8 model is about 118 MB and is cached in the user cache directory. Standard proxy environment variables are supported; Windows system proxy settings are detected when those variables are absent.

## Design

The MVP indexes Markdown in the current project with local SQLite, sqlite-vec, FTS5, and a local multilingual embedding model. The internal source model can later accept extra directories, individual files, tags, and cross-project memory without changing the indexing pipeline.

See [docs/需求设计.md](docs/需求设计.md) and [docs/roadmap.md](docs/roadmap.md).

## Development

```bash
npm install
npm run gate
npm run eval:quality
```

The gate checks formatting, strict TypeScript, ESLint, unit and integration tests, the production build, and the npm package contents. The quality evaluation is separate because it uses the real local model and the DocSeek repository's own index.

## License

MIT
