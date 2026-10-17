import {
  CUSTOM_CODE_MAX_DEPTH,
  treeNodeAt,
  type CustomCodeNode,
  type CustomCodeRoot,
} from '@craftkit/builder-schema';

import { isRecord, labelOf, readTree, regionIds, sameText, type JsonRecord } from '../tools/agent/shared';
import type { AgentToolContext } from '../tools/agent/types';

/*
  How the style tools name an element (style-manager DESIGN.md §D.3): a
  region id plus EITHER a path of child indices from the region's tree root
  (`[0,1]`) OR `find`, the element's exact text or src. A `find` that matches
  more than one element is refused with the paths it matched, so the repair
  round can answer with a path instead of guessing a longer quote.

  Every error sentence here is "what is wrong · what to send", because it is
  the only instruction the repair round reads.
*/

export type TreePath = readonly number[];

/** An element address as parsed: the region plus a path or a find text. */
export type ElementAddress =
  | { readonly id: string; readonly path: TreePath }
  | { readonly id: string; readonly find: string };

export interface ResolvedElement {
  readonly id: string;
  readonly path: TreePath;
  readonly node: CustomCodeNode;
  readonly tree: CustomCodeRoot;
}

export interface Refusal {
  readonly ok: false;
  readonly error: string;
}

export type Parsed<T> = { readonly ok: true; readonly value: T } | Refusal;

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/** A refusal: assignable both to a parse result and to a tool run. */
export function no(error: string): Refusal {
  return { ok: false, error };
}

/** A tree path: a non-empty array of whole numbers ≥ 0 (or empty when `allowRoot`). */
export function parsePath(value: unknown, key: string, allowRoot = false): Parsed<TreePath> {
  if (!Array.isArray(value)) return no(`"${key}" must be an array of child indices, e.g. [0,2].`);
  if (!allowRoot && value.length === 0) return no(`"${key}" must name an element, e.g. [0]; [] is the region root.`);
  if (value.length > CUSTOM_CODE_MAX_DEPTH) return no(`"${key}" is deeper than ${String(CUSTOM_CODE_MAX_DEPTH)} levels.`);
  const path: number[] = [];
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0) {
      return no(`"${key}" must hold whole numbers ≥ 0, e.g. [0,2].`);
    }
    path.push(entry);
  }
  return ok(path);
}

/** `{id, path}` or `{id, find}` out of a tool input; exactly one of path and find. */
export function parseAddress(record: JsonRecord): Parsed<ElementAddress> {
  const id = record['id'];
  if (typeof id !== 'string' || id.trim() === '') return no('"id" must be the region id.');
  const hasPath = record['path'] !== undefined;
  const hasFind = record['find'] !== undefined;
  if (hasPath === hasFind) {
    return no('name the element with "path" (child indices, e.g. [0,1]) or "find" (its exact text or src) — one of them.');
  }
  if (hasPath) {
    const path = parsePath(record['path'], 'path');
    return path.ok ? ok({ id, path: path.value }) : path;
  }
  const find = record['find'];
  if (typeof find !== 'string' || find.trim() === '') return no('"find" must be the element\'s exact text or src.');
  return ok({ id, find });
}

/** The region's tree, or a refusal that lists the regions the page has. */
export function regionTree(context: AgentToolContext, id: string): Parsed<CustomCodeRoot> {
  const tree = readTree(context, id);
  if (tree !== undefined) return ok(tree as unknown as CustomCodeRoot);
  const regions = regionIds(context)
    .slice(0, 12)
    .map((region) => {
      const label = labelOf(context, region);
      return label === undefined ? region : `${region} (${label})`;
    });
  return no(
    `"${id}" is not a composed region on this page · send one of: ${regions.length === 0 ? '(none)' : regions.join(', ')}.`,
  );
}

/** Every node of a tree with its path, depth first, in document order. */
export function nodesWithPaths(tree: CustomCodeRoot): readonly { readonly path: TreePath; readonly node: CustomCodeNode }[] {
  const out: { path: TreePath; node: CustomCodeNode }[] = [];
  const walk = (nodes: readonly CustomCodeNode[] | undefined, prefix: TreePath): void => {
    (nodes ?? []).forEach((node, index) => {
      const path = [...prefix, index];
      out.push({ path, node });
      if (node.kind !== 'icon') walk(node.children, path);
    });
  };
  walk(tree.children, []);
  return out;
}

function matchesFind(node: CustomCodeNode, find: string): boolean {
  if (node.kind !== 'element') return false;
  if (typeof node.text === 'string' && sameText(node.text, find)) return true;
  return node.attributes?.src === find.trim();
}

export function formatPath(path: TreePath): string {
  return `[${path.join(',')}]`;
}

/** Resolve an address to one node in the tree as the plan's earlier steps leave it. */
export function resolveElement(context: AgentToolContext, address: ElementAddress): Parsed<ResolvedElement> {
  const tree = regionTree(context, address.id);
  if (!tree.ok) return tree;
  if ('path' in address) {
    const node = treeNodeAt(tree.value, address.path);
    if (node === undefined) {
      const top = tree.value.children.length;
      return no(
        `no element at ${formatPath(address.path)} in "${address.id}" (its root has ${String(top)} children) · send a path that exists, or "find" with the element's text.`,
      );
    }
    return ok({ id: address.id, path: address.path, node, tree: tree.value });
  }
  const hits = nodesWithPaths(tree.value).filter(({ node }) => matchesFind(node, address.find));
  if (hits.length === 0) {
    return no(`no element in "${address.id}" has text or src "${address.find}" · quote the exact text, or send "path".`);
  }
  if (hits.length > 1) {
    return no(
      `"${address.find}" matches ${String(hits.length)} elements in "${address.id}" (paths ${hits
        .slice(0, 6)
        .map(({ path }) => formatPath(path))
        .join(', ')}) · send "path" with one of them.`,
    );
  }
  const [hit] = hits;
  /* v8 ignore next -- length checked above. */
  if (hit === undefined) return no('no match.');
  return ok({ id: address.id, path: hit.path, node: hit.node, tree: tree.value });
}

// ── Names for history labels ───────────────────────────────────────────────────

const TAG_NAMES: Readonly<Record<string, string>> = {
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  h6: 'Heading',
  p: 'Text',
  span: 'Text',
  a: 'Link',
  button: 'Button',
  img: 'Image',
  video: 'Video',
  section: 'Section',
  header: 'Header',
  footer: 'Footer',
  nav: 'Navigation',
  ul: 'List',
  ol: 'List',
  li: 'List item',
  form: 'Form',
  input: 'Field',
  div: 'Container',
};

/** A person-sized name for an element: its Layers label, else "Heading 'Our story'". */
export function elementName(node: CustomCodeNode): string {
  if (node.label !== undefined && node.label.trim() !== '') return node.label.trim();
  if (node.kind === 'icon') return `Icon '${node.name}'`;
  if (node.kind === 'component') return `Component '${node.component}'`;
  const kind = TAG_NAMES[node.tag] ?? node.tag;
  const text = (node.text ?? node.attributes?.alt ?? '').replace(/\s+/gu, ' ').trim();
  if (text === '') return kind;
  return `${kind} '${text.length > 24 ? `${text.slice(0, 23)}…` : text}'`;
}

/** "Padding · Heading 'Our story'": the history label form (§0.1). */
export function stepTitle(what: string, node: CustomCodeNode): string {
  return `${what} · ${elementName(node)}`;
}

/** The input as a record with only `known` keys, or a refusal naming the extras. */
export function strictRecord(input: unknown, known: readonly string[], shape: string): Parsed<JsonRecord> {
  if (!isRecord(input)) return no(`input must be ${shape}.`);
  const extra = Object.keys(input).filter((key) => !known.includes(key));
  if (extra.length > 0) return no(`unknown keys ${extra.join(', ')}; use ${known.join(', ')}.`);
  return ok(input);
}
