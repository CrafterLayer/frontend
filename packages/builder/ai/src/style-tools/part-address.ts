import type { BuilderKernel } from '@craftkit/builder-core';
import {
  blockPartsOf,
  bindPathOf,
  getAtPropPath,
  partInstances,
  type BlockPartDecl,
  type BlockParts,
  type BlockSchema,
  type Node,
  type PartInstance,
  type PartRef,
} from '@craftkit/builder-schema';

import { normalizeIntentText } from '../intent/normalize-arabic';
import { isRecord, sameText, type JsonRecord } from '../tools/agent/shared';
import { no, ok, type Parsed } from './address';

/*
  How the agent names a PART of a registered block (block-parts DESIGN §2.12):
  the block's node id plus EITHER the part — its declared name (`heading`,
  `item.title`), one of its aliases (`title`, «العنوان») or its localized
  label (en or ar, Arabic letter variants folded) — with an `index` for a
  repeated part, OR `find`, the exact visible text of one instance.

  A repeated part with no index, or a request that matches more than one
  instance, is refused with the candidates listed as `part@index "text"`, so
  the repair round answers with an index instead of guessing.

  Every error sentence is "what is wrong · what to send", the convention of
  address.ts: it is the only instruction the repair round reads.
*/

/** A part address as a tool receives it. */
export interface PartAddressInput {
  readonly id: string;
  readonly part?: string | undefined;
  /** One array index per `*` in the part's bind; a single number for one level. */
  readonly index?: readonly number[] | undefined;
  readonly find?: string | undefined;
}

/** A registered block on the page that declares parts, with its props as the plan leaves them. */
export interface PartBlock {
  readonly id: string;
  /** The node with its props as the plan's earlier steps leave them. */
  readonly node: Node;
  readonly schema: BlockSchema;
  readonly parts: BlockParts;
  /** "Hero", "Logo cloud": the block's name in history labels. */
  readonly blockName: string;
}

/** One resolved part instance. */
export interface ResolvedPart extends PartBlock {
  readonly ref: PartRef;
  readonly decl: BlockPartDecl;
  /** The instance as it exists in the props (absent for a declared-but-empty optional part). */
  readonly instance?: PartInstance | undefined;
}

/** Reads a prop as the plan's earlier steps leave it (AgentToolContext.readProp). */
export type PropReader = (nodeId: string, key: string) => unknown;

const MAX_CANDIDATES = 8;
const MAX_QUOTE = 32;
const MAX_LISTED_BLOCKS = 10;

// ── Words ─────────────────────────────────────────────────────────────────────

/**
 * A part word folded for matching: Arabic variants folded, lower case, a
 * leading «و», preposition or article dropped from each word («للعنوان» →
 * «عنوان»), an English "the" dropped, camelCase and dots read as spaces.
 */
export function partWordKey(text: string): string {
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[._\-–—]+/gu, ' ');
  return normalizeIntentText(spaced)
    .split(' ')
    .filter((word) => word !== '' && word !== 'the')
    .map((word) =>
      word.replace(/^و(?=\S{3,})/u, '').replace(/^(?:بال|لل|ال|ب|ل)(?=\S{2,})/u, ''),
    )
    .join(' ');
}

/** Every key a part answers to: its name, aliases and both labels. */
function keysOf(name: string, decl: BlockPartDecl): ReadonlySet<string> {
  const keys = new Set<string>([partWordKey(name), name.toLowerCase()]);
  for (const alias of decl.aliases ?? []) keys.add(partWordKey(alias));
  keys.add(partWordKey(decl.label.en));
  keys.add(partWordKey(decl.label.ar));
  keys.delete('');
  return keys;
}

/** The declared names a word means: exact name first, else every part whose keys hold it. */
export function matchPartNames(parts: BlockParts, word: string): readonly string[] {
  const trimmed = word.trim();
  if (trimmed === '') return [];
  if (Object.hasOwn(parts, trimmed)) return [trimmed];
  const key = partWordKey(trimmed);
  if (key === '') return [];
  return Object.entries(parts)
    .filter(([name, decl]) => keysOf(name, decl).has(key))
    .map(([name]) => name);
}

/** "heading, item.title (title of an item)": the names a refusal offers. */
function partMenu(parts: BlockParts): string {
  const names = Object.keys(parts);
  return names.length === 0 ? '(none)' : names.join(', ');
}

/** The ONE declared part a word names, or a refusal listing the parts. */
export function resolvePartName(block: PartBlock, word: string): Parsed<string> {
  const names = matchPartNames(block.parts, word);
  if (names.length === 1 && names[0] !== undefined) return ok(names[0]);
  if (names.length === 0) {
    return no(`${block.blockName} "${block.id}" has no part "${word}" · send one of: ${partMenu(block.parts)}.`);
  }
  return no(`"${word}" names ${String(names.length)} parts of ${block.blockName} "${block.id}" (${names.join(', ')}) · send one of those names.`);
}

// ── The block ─────────────────────────────────────────────────────────────────

/** "hero" → "Hero", "logoCloud" → "Logo cloud", "bento-grid" → "Bento grid". */
export function blockDisplayName(type: string): string {
  const bare = type.slice(type.lastIndexOf('.') + 1);
  const words = bare
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? type : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function liveReader(kernel: BuilderKernel): PropReader {
  return (id, key) => {
    const nodes = kernel.getDocument().nodes;
    if (!Object.hasOwn(nodes, id)) return undefined;
    const props = nodes[id]?.props;
    return props !== undefined && Object.hasOwn(props, key) ? props[key] : undefined;
  };
}

function shapeKeys(schema: BlockSchema): readonly string[] {
  const shape = (schema.props as unknown as { shape?: unknown }).shape;
  return isRecord(shape) ? Object.keys(shape) : [];
}

/** The node's props as the plan leaves them: every stored or declared key read through `readProp`. */
function currentProps(node: Node, schema: BlockSchema, readProp: PropReader): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(node.props), ...shapeKeys(schema)])) {
    const value = readProp(node.id, key);
    if (value !== undefined) props[key] = value;
  }
  return props;
}

/** Every registered block on the page that declares parts, in page order. */
export function partBlocks(kernel: BuilderKernel, readProp: PropReader = liveReader(kernel)): readonly PartBlock[] {
  const document = kernel.getDocument();
  const order: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = document.nodes[id];
    if (node === undefined) return;
    order.push(id);
    for (const ids of Object.values(node.slots ?? {})) for (const child of ids) walk(child);
  };
  walk(document.rootId);
  return order.flatMap((id) => {
    const block = partBlockOf(kernel, id, readProp);
    return block.ok ? [block.value] : [];
  });
}

function blockList(kernel: BuilderKernel, readProp: PropReader): string {
  const blocks = partBlocks(kernel, readProp);
  if (blocks.length === 0) return '(no block on this page declares parts)';
  const listed = blocks.slice(0, MAX_LISTED_BLOCKS).map(({ id, node }) => `${id} (${node.type})`);
  return `${listed.join(', ')}${blocks.length > MAX_LISTED_BLOCKS ? ', …' : ''}`;
}

/** The registered block `id` names, when it declares parts. */
export function partBlockOf(
  kernel: BuilderKernel,
  id: string,
  readProp: PropReader = liveReader(kernel),
): Parsed<PartBlock> {
  const nodes = kernel.getDocument().nodes;
  const node = Object.hasOwn(nodes, id) ? nodes[id] : undefined;
  if (node === undefined) {
    return no(`"${id}" is not a block on this page · send the id of one of: ${blockList(kernel, readProp)}.`);
  }
  const schema = kernel.context.registry.block(node.type)?.schema;
  const parts = blockPartsOf(schema);
  if (schema === undefined || Object.keys(parts).length === 0) {
    return no(
      node.type === 'customCode'
        ? `"${id}" is a composed region, which has elements, not parts · use element.style / copy.set with "path" or "find".`
        : `"${id}" (${node.type}) declares no parts · edit it through its props with setProp, or send a block that has parts.`,
    );
  }
  const props = currentProps(node, schema, readProp);
  return ok({
    id,
    node: { ...node, props: props as Node['props'] },
    schema,
    parts,
    blockName: blockDisplayName(node.type),
  });
}

// ── Instances ─────────────────────────────────────────────────────────────────

/** A rich-text document's words, paragraphs joined by a newline. */
export function richTextPlain(value: unknown): string {
  const lines: string[] = [];
  const inline = (nodes: unknown): string => {
    if (!Array.isArray(nodes)) return '';
    return nodes
      .map((node) => {
        if (!isRecord(node)) return '';
        if (node['type'] === 'text' && typeof node['text'] === 'string') return node['text'];
        if (node['type'] === 'hardBreak') return '\n';
        return inline(node['content']);
      })
      .join('');
  };
  const block = (node: unknown): void => {
    if (!isRecord(node)) return;
    const type = node['type'];
    if (type === 'paragraph' || type === 'heading') {
      lines.push(inline(node['content']));
      return;
    }
    const content = node['content'];
    if (Array.isArray(content)) for (const child of content) block(child);
  };
  block(value);
  return lines.join('\n').trim();
}

/** What a part instance visibly says: its text, its link label, its rich text, or its image's alt. */
export function partInstanceText(
  decl: BlockPartDecl,
  index: readonly number[],
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  const read = (which: 'text' | 'alt' | 'src'): unknown => {
    const path = bindPathOf(decl, index, which);
    return path === undefined ? undefined : getAtPropPath(props, path);
  };
  switch (decl.kind) {
    case 'text':
    case 'link': {
      const value = read('text');
      return typeof value === 'string' ? value : undefined;
    }
    case 'rich': {
      const plain = richTextPlain(read('text'));
      return plain === '' ? undefined : plain;
    }
    case 'image': {
      const alt = read('alt');
      if (typeof alt === 'string' && alt.trim() !== '') return alt;
      const src = read('src');
      return typeof src === 'string' ? src : undefined;
    }
    default:
      return undefined;
  }
}

function quote(text: string | undefined): string {
  if (text === undefined) return '';
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > MAX_QUOTE ? `${flat.slice(0, MAX_QUOTE - 1).trimEnd()}…` : flat;
}

/** `item.title@1 "Fast setup"`: one candidate as a refusal lists it. */
export function formatPartCandidate(instance: PartInstance, props: Readonly<Record<string, unknown>>): string {
  const at = instance.index.length > 0 ? `@${instance.index.join('.')}` : '';
  const text = quote(partInstanceText(instance.decl, instance.index, props));
  return text === '' ? `${instance.part}${at}` : `${instance.part}${at} "${text}"`;
}

function candidates(instances: readonly PartInstance[], props: Readonly<Record<string, unknown>>): string {
  const listed = instances.slice(0, MAX_CANDIDATES).map((instance) => formatPartCandidate(instance, props));
  return `${listed.join(', ')}${instances.length > MAX_CANDIDATES ? ', …' : ''}`;
}

function starsOf(decl: BlockPartDecl): number {
  const bind = decl.bind;
  const pattern = bind === undefined ? '' : typeof bind === 'string' ? bind : 'href' in bind ? bind.text : bind.src;
  return pattern.split('.').filter((segment) => segment === '*').length;
}

function sameIndex(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((at, position) => at === right[position]);
}

/**
 * Resolve an address to ONE part instance of one registered block, reading
 * the props as the plan's earlier steps leave them (`readProp`, defaulting to
 * the live page).
 */
export function resolvePartAddress(
  kernel: BuilderKernel,
  address: PartAddressInput,
  readProp: PropReader = liveReader(kernel),
): Parsed<ResolvedPart> {
  const block = partBlockOf(kernel, address.id, readProp);
  if (!block.ok) return block;
  const { parts, node } = block.value;
  const props = node.props as Readonly<Record<string, unknown>>;
  const all = partInstances(parts, props);

  let name: string | undefined;
  if (address.part !== undefined) {
    const resolved = resolvePartName(block.value, address.part);
    if (!resolved.ok) return resolved;
    name = resolved.value;
  }

  if (address.find !== undefined) {
    const find = address.find;
    const hits = all.filter(
      (instance) =>
        (name === undefined || instance.part === name) &&
        (address.index === undefined || sameIndex(instance.index, address.index)) &&
        sameText(partInstanceText(instance.decl, instance.index, props) ?? '', find),
    );
    if (hits.length === 0) {
      const scope = name === undefined ? `${block.value.blockName} "${address.id}"` : `"${name}" of "${address.id}"`;
      const sample = all.filter((instance) => partInstanceText(instance.decl, instance.index, props) !== undefined);
      return no(
        `no part of ${scope} says "${quote(find)}" · quote the exact text, or send "part" with one of: ${candidates(sample, props) || partMenu(parts)}.`,
      );
    }
    if (hits.length > 1) {
      return no(`"${quote(find)}" matches ${String(hits.length)} parts of "${address.id}" (${candidates(hits, props)}) · send "part" and "index" for one of them.`);
    }
    const [hit] = hits;
    /* v8 ignore next -- length checked above. */
    if (hit === undefined) return no('no match.');
    return ok({ ...block.value, ref: { part: hit.part, index: hit.index }, decl: hit.decl, instance: hit });
  }

  if (name === undefined) {
    return no(`name the part with "part" (e.g. ${Object.keys(parts)[0] ?? 'heading'}) or "find" (its exact text) · one of them.`);
  }
  const decl = parts[name];
  /* v8 ignore next -- resolvePartName only returns declared names. */
  if (decl === undefined) return no(`no part "${name}".`);
  const stars = starsOf(decl);
  const ofPart = all.filter((instance) => instance.part === name);
  if (stars === 0) {
    if (address.index !== undefined && address.index.length > 0) {
      return no(`"${name}" is not repeated, so it takes no index · drop "index".`);
    }
    return ok({ ...block.value, ref: { part: name, index: [] }, decl, instance: ofPart[0] });
  }
  if (address.index === undefined) {
    if (ofPart.length === 1 && ofPart[0] !== undefined) {
      const only = ofPart[0];
      return ok({ ...block.value, ref: { part: name, index: only.index }, decl, instance: only });
    }
    return no(
      ofPart.length === 0
        ? `"${name}" of "${address.id}" has no instances (its list is empty) · add one with part.list op "add" first.`
        : `"${name}" repeats ${String(ofPart.length)} times in "${address.id}" (${candidates(ofPart, props)}) · send "index" for one of them.`,
    );
  }
  if (address.index.length !== stars) {
    return no(`"${name}" needs ${String(stars)} index value(s), got ${String(address.index.length)} · send "index": [${Array.from({ length: stars }, () => '0').join(',')}].`);
  }
  const instance = ofPart.find((entry) => sameIndex(entry.index, address.index ?? []));
  if (instance === undefined) {
    return no(
      `"${name}" has no instance at index ${address.index.join('.')} in "${address.id}" · send one of: ${ofPart.length === 0 ? '(none — the list is empty)' : candidates(ofPart, props)}.`,
    );
  }
  return ok({ ...block.value, ref: { part: name, index: instance.index }, decl, instance });
}

// ── Parsing tool input ────────────────────────────────────────────────────────

/** `index` as a tool sends it: a whole number ≥ 0, or an array of them. */
export function parsePartIndex(value: unknown, key = 'index'): Parsed<readonly number[] | undefined> {
  if (value === undefined) return ok(undefined);
  const list = typeof value === 'number' ? [value] : value;
  if (!Array.isArray(list) || list.length > 6) return no(`"${key}" is a whole number ≥ 0 (e.g. 2), or an array of them for nested lists (e.g. [1,0]).`);
  const out: number[] = [];
  for (const entry of list as unknown[]) {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0) {
      return no(`"${key}" holds whole numbers ≥ 0 (0 is the first item).`);
    }
    out.push(entry);
  }
  return ok(out);
}

/** `{id, part?, index?, find?}` out of a tool input record; `part` or `find` is required. */
export function parsePartAddress(record: JsonRecord, requirePart = false): Parsed<PartAddressInput> {
  const id = record['id'];
  if (typeof id !== 'string' || id.trim() === '') return no('"id" must be the block\'s node id.');
  const part = record['part'];
  if (part !== undefined && (typeof part !== 'string' || part.trim() === '')) {
    return no('"part" is the part\'s name, alias or label, e.g. "heading".');
  }
  const find = record['find'];
  if (find !== undefined && (typeof find !== 'string' || find.trim() === '')) {
    return no('"find" must be the part\'s exact visible text.');
  }
  if (part === undefined && (requirePart || find === undefined)) {
    return no(requirePart ? '"part" is required, e.g. "heading".' : 'name the part with "part" (e.g. "heading") or "find" (its exact text).');
  }
  const index = parsePartIndex(record['index']);
  if (!index.ok) return index;
  return ok({
    id: id.trim(),
    ...(part === undefined ? {} : { part: part.trim() }),
    ...(index.value === undefined ? {} : { index: index.value }),
    ...(find === undefined ? {} : { find }),
  });
}
