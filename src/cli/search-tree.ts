import type { SearchResult } from "../domain/types.js";

type AggregateKind = "directory" | "file" | "heading";

interface LineLeaf {
  readonly startLine: number;
  readonly endLine: number;
  readonly score: number;
}

interface AggregateNode {
  readonly kind: AggregateKind;
  readonly label: string;
  readonly children: Map<string, AggregateNode>;
  readonly leaves: Map<string, LineLeaf>;
}

interface NodeStats {
  readonly count: number;
  readonly scoreSum: number;
  readonly average: number;
  readonly maximum: number;
}

interface CollapsedNode {
  readonly label: string;
  readonly tail: AggregateNode;
}

type TreeEntry =
  | { readonly kind: "node"; readonly node: AggregateNode }
  | { readonly kind: "leaf"; readonly leaf: LineLeaf };

function createNode(kind: AggregateKind, label: string): AggregateNode {
  return { kind, label, children: new Map(), leaves: new Map() };
}

function pathSegments(value: string): readonly string[] {
  return value.replaceAll("\\", "/").split("/").filter(Boolean);
}

function commonDirectory(results: readonly SearchResult[]): readonly string[] {
  const directories = results.map((result) => pathSegments(result.path).slice(0, -1));
  const first = directories[0] ?? [];
  let length = first.length;

  for (const directory of directories.slice(1)) {
    length = Math.min(length, directory.length);
    for (let index = 0; index < length; index += 1) {
      if (first[index] !== directory[index]) {
        length = index;
        break;
      }
    }
  }
  return first.slice(0, length);
}

function child(node: AggregateNode, kind: AggregateKind, label: string): AggregateNode {
  const key = `${kind}:${label}`;
  const existing = node.children.get(key);
  if (existing) {
    return existing;
  }
  const created = createNode(kind, label);
  node.children.set(key, created);
  return created;
}

function normalizedTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function headingsForFile(fileName: string, headings: readonly string[]): readonly string[] {
  const fileTitle = normalizedTitle(fileName.replace(/\.[^.]+$/u, ""));
  const unique = headings.filter(
    (heading, index) =>
      index === 0 || normalizedTitle(heading) !== normalizedTitle(headings[index - 1] ?? ""),
  );
  const first = unique[0];
  if (!first) {
    return unique;
  }
  const firstTitle = normalizedTitle(first);
  return firstTitle === fileTitle || firstTitle.endsWith(fileTitle) ? unique.slice(1) : unique;
}

function addResult(root: AggregateNode, common: readonly string[], result: SearchResult): void {
  const segments = pathSegments(result.path);
  const fileName = segments.at(-1) ?? result.path;
  let current = root;

  for (const directory of segments.slice(common.length, -1)) {
    current = child(current, "directory", directory);
  }
  current = child(current, "file", fileName);

  for (const heading of headingsForFile(fileName, result.heading)) {
    current = child(current, "heading", heading);
  }

  const key = `${result.startLine}:${result.endLine}`;
  const existing = current.leaves.get(key);
  if (!existing || result.score > existing.score) {
    current.leaves.set(key, {
      startLine: result.startLine,
      endLine: result.endLine,
      score: result.score,
    });
  }
}

function collectStats(node: AggregateNode, cache: Map<AggregateNode, NodeStats>): NodeStats {
  const cached = cache.get(node);
  if (cached) {
    return cached;
  }

  let count = node.leaves.size;
  let scoreSum = [...node.leaves.values()].reduce((sum, leaf) => sum + leaf.score, 0);
  let maximum = [...node.leaves.values()].reduce(
    (highest, leaf) => Math.max(highest, leaf.score),
    0,
  );
  for (const nested of node.children.values()) {
    const stats = collectStats(nested, cache);
    count += stats.count;
    scoreSum += stats.scoreSum;
    maximum = Math.max(maximum, stats.maximum);
  }

  const stats = { count, scoreSum, average: count > 0 ? scoreSum / count : 0, maximum };
  cache.set(node, stats);
  return stats;
}

function formatScore(score: number): string {
  const fixed = score.toFixed(3);
  return score < 1 ? fixed.replace(/^0/u, "") : fixed;
}

function nodeLabel(label: string, stats: NodeStats): string {
  return `${label} ×${stats.count} ${formatScore(stats.average)}`;
}

function compareNodes(
  left: AggregateNode,
  right: AggregateNode,
  cache: Map<AggregateNode, NodeStats>,
): number {
  const leftStats = collectStats(left, cache);
  const rightStats = collectStats(right, cache);
  return (
    rightStats.maximum - leftStats.maximum ||
    rightStats.average - leftStats.average ||
    rightStats.count - leftStats.count ||
    left.label.localeCompare(right.label, "zh-CN", { numeric: true })
  );
}

function lineLabel(leaf: LineLeaf): string {
  const range =
    leaf.startLine === leaf.endLine ? `${leaf.startLine}` : `${leaf.startLine}-${leaf.endLine}`;
  return `L${range} ${formatScore(leaf.score)}`;
}

function canCollapse(node: AggregateNode): boolean {
  return node.leaves.size === 0 && node.children.size === 1;
}

function joinLabels(left: AggregateNode, right: AggregateNode): string {
  return left.kind === "directory" && right.kind !== "heading" ? "/" : " › ";
}

function collapseNode(node: AggregateNode): CollapsedNode {
  let label = node.label;
  let tail = node;

  while (canCollapse(tail)) {
    const nested = tail.children.values().next().value;
    if (!nested) {
      break;
    }
    label += `${joinLabels(tail, nested)}${nested.label}`;
    tail = nested;
  }

  if (tail.kind === "directory") {
    label += "/";
  }
  return { label, tail };
}

function entryMaximum(entry: TreeEntry, cache: Map<AggregateNode, NodeStats>): number {
  return entry.kind === "node" ? collectStats(entry.node, cache).maximum : entry.leaf.score;
}

function compareEntries(
  left: TreeEntry,
  right: TreeEntry,
  cache: Map<AggregateNode, NodeStats>,
): number {
  const maximumDifference = entryMaximum(right, cache) - entryMaximum(left, cache);
  if (maximumDifference !== 0) {
    return maximumDifference;
  }
  if (left.kind === "node" && right.kind === "node") {
    return compareNodes(left.node, right.node, cache);
  }
  if (left.kind === "leaf" && right.kind === "leaf") {
    return left.leaf.startLine - right.leaf.startLine || left.leaf.endLine - right.leaf.endLine;
  }
  return left.kind === "node" ? -1 : 1;
}

function renderNode(
  node: AggregateNode,
  prefix: string,
  last: boolean,
  cache: Map<AggregateNode, NodeStats>,
  output: string[],
): void {
  const collapsed = collapseNode(node);
  const onlyLeaf =
    collapsed.tail.children.size === 0 && collapsed.tail.leaves.size === 1
      ? collapsed.tail.leaves.values().next().value
      : undefined;
  const label = onlyLeaf
    ? `${collapsed.label} ${lineLabel(onlyLeaf)}`
    : nodeLabel(collapsed.label, collectStats(node, cache));
  output.push(`${prefix}${last ? "└─" : "├─"} ${label}`);

  if (onlyLeaf) {
    return;
  }

  const nestedPrefix = `${prefix}${last ? "   " : "│  "}`;
  const entries: TreeEntry[] = [
    ...[...collapsed.tail.children.values()].map((nested) => ({
      kind: "node" as const,
      node: nested,
    })),
    ...[...collapsed.tail.leaves.values()].map((leaf) => ({ kind: "leaf" as const, leaf })),
  ].sort((left, right) => compareEntries(left, right, cache));

  for (const [index, entry] of entries.entries()) {
    const entryIsLast = index === entries.length - 1;
    if (entry.kind === "node") {
      renderNode(entry.node, nestedPrefix, entryIsLast, cache, output);
    } else {
      output.push(`${nestedPrefix}${entryIsLast ? "└─" : "├─"} ${lineLabel(entry.leaf)}`);
    }
  }
}

export function formatSearchTree(results: readonly SearchResult[]): string {
  if (results.length === 0) {
    return "No matching documentation found.\n";
  }

  const common = commonDirectory(results);
  const root = createNode("directory", "");
  for (const result of results) {
    addResult(root, common, result);
  }

  const output = [common.length > 0 ? `${common.join("/")}/` : "./"];
  const cache = new Map<AggregateNode, NodeStats>();
  const children = [...root.children.values()].sort((left, right) =>
    compareNodes(left, right, cache),
  );
  for (const [index, node] of children.entries()) {
    renderNode(node, "", index === children.length - 1, cache, output);
  }
  return `${output.join("\n")}\n`;
}
