import type { JsonValue } from '@craftkit/builder-schema';

import { readLandedTree } from './check-section';
import type {
  LandedSection,
  PagePlan,
  SectionCheckCode,
  SectionCheckIssue,
  SectionContract,
} from './types';

/*
  What the code repairs before the check share (tidy-section.ts, 2026-10-13):
  the context a repair reads, the shape of one repair, and a small immutable
  tree editor addressed by the paths the checker reports
  (`tree.children[0].children[3].attributes.href`).
*/

export type JsonRecord = Record<string, unknown>;

/** What one repair reads: the section as written so far, and what the checks found in it. */
export interface TidyContext {
  readonly plan: PagePlan;
  readonly contract: SectionContract;
  readonly section: LandedSection;
  readonly issues: readonly SectionCheckIssue[];
}

/**
 * One code repair. `fix` returns the section with ONLY the defects it can
 * repair exactly repaired, or undefined when it cannot be sure; the caller
 * keeps the result only when the checks then find strictly less.
 */
export interface TidyFixer {
  /** A short id for the report and the measurement (`heading-level`, `scene-libs`). */
  readonly name: string;
  readonly codes: readonly SectionCheckCode[];
  readonly fix: (context: TidyContext) => LandedSection | undefined;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The issues of these codes whose message starts with `prefix` (all of them when it is empty). */
export function issuesOf(
  issues: readonly SectionCheckIssue[],
  code: SectionCheckCode,
  prefix = '',
): readonly SectionCheckIssue[] {
  return issues.filter((issue) => issue.code === code && issue.message.startsWith(prefix));
}

/** The section's tree as a root record (markup read the way the door reads it), or undefined. */
export function rootOf(section: LandedSection): JsonRecord | undefined {
  return readLandedTree(section.tree);
}

/** The section with this root as its tree. */
export function withRoot(section: LandedSection, root: JsonRecord): LandedSection {
  return { ...section, tree: root as unknown as JsonValue };
}

const CHILD = /^\.children\[(\d+)\]/u;

/** `tree.children[0].children[3].attributes.id` → [0, 3]; undefined for a path outside the tree. */
export function treeIndices(path: string | undefined): readonly number[] | undefined {
  if (path?.startsWith('tree.children[') !== true) return undefined;
  const indices: number[] = [];
  let rest = path.slice('tree'.length);
  for (let step = CHILD.exec(rest); step !== null; step = CHILD.exec(rest)) {
    indices.push(Number(step[1]));
    rest = rest.slice(step[0].length);
  }
  return indices;
}

function childrenOf(node: JsonRecord): readonly unknown[] {
  const children = node['children'];
  return Array.isArray(children) ? (children as unknown[]) : [];
}

/** The node at `indices` under the root, or undefined. */
export function nodeAt(root: JsonRecord, indices: readonly number[]): JsonRecord | undefined {
  let node: JsonRecord | undefined = root;
  for (const index of indices) {
    const child: unknown = node === undefined ? undefined : childrenOf(node)[index];
    node = isRecord(child) ? child : undefined;
  }
  return node;
}

/** A copy of the root with the node at `indices` replaced by `edit(node)`; the same root when it cannot. */
export function updateAt(
  root: JsonRecord,
  indices: readonly number[],
  edit: (node: JsonRecord) => JsonRecord,
): JsonRecord {
  const [first, ...rest] = indices;
  if (first === undefined) return edit(root);
  const children = childrenOf(root);
  const child = children[first];
  if (!isRecord(child)) return root;
  const next = updateAt(child, rest, edit);
  if (next === child) return root;
  return { ...root, children: children.map((item, index) => (index === first ? next : item)) };
}

/** Every node, parents first, with its indices from the root. */
export function nodesOf(
  root: JsonRecord,
): readonly { readonly node: JsonRecord; readonly at: readonly number[] }[] {
  const found: { node: JsonRecord; at: readonly number[] }[] = [];
  const stack: { node: JsonRecord; at: readonly number[] }[] = [];
  const push = (node: JsonRecord, at: readonly number[]) => {
    const children = childrenOf(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (isRecord(child)) stack.push({ node: child, at: [...at, index] });
    }
  };
  push(root, []);
  while (stack.length > 0 && found.length < 4_000) {
    const entry = stack.pop();
    if (entry === undefined) break;
    found.push(entry);
    if (entry.at.length < 64) push(entry.node, entry.at);
  }
  return found;
}

/** A copy of the root with `edit` applied to every element; the same root when nothing changed. */
export function mapElements(
  root: JsonRecord,
  edit: (node: JsonRecord, at: readonly number[]) => JsonRecord,
): JsonRecord {
  let next = root;
  for (const { node, at } of nodesOf(root)) {
    if (node['kind'] !== 'element') continue;
    const changed = edit(node, at);
    if (changed !== node) next = updateAt(next, at, () => changed);
  }
  return next;
}

export function classesOf(node: JsonRecord): readonly string[] {
  const className = node['className'];
  return typeof className === 'string' ? className.split(/\s+/u).filter((name) => name !== '') : [];
}

/** A copy of the record without one key. */
function without(record: Readonly<Record<string, unknown>>, key: string): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

/** The node with this class list (no className at all when it is empty). */
export function withClasses(node: JsonRecord, classes: readonly string[]): JsonRecord {
  const rest = without(node, 'className');
  return classes.length === 0 ? rest : { ...rest, className: classes.join(' ') };
}

export function attributesOf(node: JsonRecord): Readonly<Record<string, unknown>> {
  const attributes = node['attributes'];
  return isRecord(attributes) ? attributes : {};
}

/** The node with one attribute set, or removed when `value` is undefined. */
export function withAttribute(
  node: JsonRecord,
  name: string,
  value: string | undefined,
): JsonRecord {
  const others = without(attributesOf(node), name);
  const attributes = value === undefined ? others : { ...others, [name]: value };
  const rest = without(node, 'attributes');
  return Object.keys(attributes).length === 0 ? rest : { ...rest, attributes };
}

export function tagOf(node: JsonRecord): string {
  return typeof node['tag'] === 'string' ? node['tag'].toLowerCase() : '';
}

/** A utility without its variants (`md:hover:`) or its `!` prefix. */
export function baseOf(name: string): { readonly base: string; readonly variants: boolean } {
  let depth = 0;
  let cut = -1;
  for (let index = 0; index < name.length; index += 1) {
    const character = name[index];
    if (character === '[') depth += 1;
    else if (character === ']') depth -= 1;
    else if (character === ':' && depth === 0) cut = index;
  }
  return { base: name.slice(cut + 1).replace(/^!/u, ''), variants: cut !== -1 };
}
