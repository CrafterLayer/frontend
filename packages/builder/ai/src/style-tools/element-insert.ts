import { isCustomCodeTag, treeNodeAt, type CustomCodeNode } from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import {
  elementName,
  no,
  ok,
  parsePath,
  regionTree,
  resolveElement,
  strictRecord,
  type ElementAddress,
  type Parsed,
  type TreePath,
} from './address';
import { finish, step } from './finish';

/**
 * element.insert — add new elements written as markup (the same spelling a
 * section is written in: `<div class='…'>…</div>`, `<icon name='…'/>`,
 * `<ck-component type='…' props='{…}'/>`), read by `parseTreeMarkup` and
 * placed with one `insertTreeNode` per top-level node.
 *
 * Where: `parent` (a container path; [] is the region root — appended at its
 * end, or at `index`), or `after` / `before` an element given as a path or as
 * its exact text.
 */

type Anchor =
  | { readonly kind: 'parent'; readonly path: TreePath; readonly index?: number }
  | { readonly kind: 'after' | 'before'; readonly at: TreePath | string };

export interface ElementInsertInput {
  readonly id: string;
  readonly where: Anchor;
  readonly nodes: readonly CustomCodeNode[];
}

const KEYS = ['id', 'parent', 'index', 'after', 'before', 'markup'] as const;
const MAX_MARKUP = 20_000;

function parseAnchor(record: Readonly<Record<string, unknown>>): Parsed<Anchor> {
  const given = (['parent', 'after', 'before'] as const).filter((key) => record[key] !== undefined);
  if (given.length !== 1) {
    return no('say where with exactly one of "parent" (a container path, [] = region root), "after" or "before" (an element path or its exact text).');
  }
  const [key] = given;
  if (key === 'parent') {
    const path = parsePath(record['parent'], 'parent', true);
    if (!path.ok) return path;
    const index = record['index'];
    if (index === undefined) return ok({ kind: 'parent', path: path.value });
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return no('"index" must be a whole number ≥ 0.');
    return ok({ kind: 'parent', path: path.value, index });
  }
  if (record['index'] !== undefined) return no('"index" goes with "parent" only.');
  /* v8 ignore next -- given has exactly one entry. */
  const side = key ?? 'after';
  const at = record[side];
  if (typeof at === 'string') {
    if (at.trim() === '') return no(`"${side}" must be a path or the element's exact text.`);
    return ok({ kind: side, at });
  }
  const path = parsePath(at, side);
  return path.ok ? ok({ kind: side, at: path.value }) : path;
}

function parse(input: unknown): Parsed<ElementInsertInput> {
  const record = strictRecord(input, KEYS, '{"id","parent"|"after"|"before","index"?,"markup"}');
  if (!record.ok) return record;
  const id = record.value['id'];
  if (typeof id !== 'string' || id.trim() === '') return no('"id" must be the region id.');
  const where = parseAnchor(record.value);
  if (!where.ok) return where;
  const markup = record.value['markup'];
  if (typeof markup !== 'string' || markup.trim() === '') return no('"markup" must be the new elements as markup, e.g. "<p class=\'text-lg\'>Hello</p>".');
  if (markup.length > MAX_MARKUP) return no(`"markup" must be at most ${String(MAX_MARKUP)} characters; insert in parts.`);
  const nodes = parseTreeMarkup(markup).children as unknown as CustomCodeNode[];
  if (nodes.length === 0) return no('"markup" holds no element · write at least one tag.');
  const unknown = unknownTag(nodes);
  if (unknown !== undefined) {
    return no(`<${unknown}> is not an element a region admits · use a div, span, section, p, a, button, ul, figure… or a <ck-component>.`);
  }
  return ok({ id, where: where.value, nodes });
}

/** The first tag outside the element vocabulary, read before the door's long enum message. */
function unknownTag(nodes: readonly CustomCodeNode[]): string | undefined {
  for (const node of nodes) {
    if (node.kind === 'icon') continue;
    if (node.kind === 'element' && !isCustomCodeTag(node.tag)) return node.tag;
    const inner = unknownTag(node.children ?? []);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

function placement(input: ElementInsertInput, context: AgentToolContext): Parsed<{ parent: TreePath; index: number }> {
  const tree = regionTree(context, input.id);
  if (!tree.ok) return tree;
  const { where } = input;
  if (where.kind === 'parent') {
    const container = where.path.length === 0 ? tree.value : treeNodeAt(tree.value, where.path);
    if (container === undefined) return no(`no element at [${where.path.join(',')}] in "${input.id}" · send the path of a container ([] is the region root).`);
    if (container.kind === 'icon') return no(`[${where.path.join(',')}] is an icon, which holds nothing · send its parent's path.`);
    const count = container.children?.length ?? 0;
    const index = where.index ?? count;
    if (index > count) return no(`"index" ${String(index)} is past the end: [${where.path.join(',')}] has ${String(count)} children.`);
    return ok({ parent: where.path, index });
  }
  const address: ElementAddress = typeof where.at === 'string' ? { id: input.id, find: where.at } : { id: input.id, path: where.at };
  const anchor = resolveElement(context, address);
  if (!anchor.ok) return anchor;
  const at = anchor.value.path;
  const last = at[at.length - 1] ?? 0;
  return ok({ parent: at.slice(0, -1), index: where.kind === 'after' ? last + 1 : last });
}

function run(input: ElementInsertInput, context: AgentToolContext): AgentToolRun {
  const place = placement(input, context);
  if (!place.ok) return place;
  const { parent, index } = place.value;
  const steps = input.nodes.map((node, offset) =>
    step('insertTreeNode', { id: input.id, parent: [...parent], index: index + offset, node }),
  );
  const first = input.nodes[0];
  const name = first === undefined ? 'element' : elementName(first);
  return finish(
    context,
    steps,
    input.nodes.length === 1 ? `Insert · ${name}` : `Insert · ${String(input.nodes.length)} elements`,
  );
}

export const elementInsertTool = defineAgentTool<ElementInsertInput>({
  name: 'element.insert',
  lanes: ['edit', 'section'],
  summary: 'Insert new elements written as markup',
  signature: '{id,parent:path|after:path|text|before:path|text,index?,markup}',
  parse,
  run,
});
