import type { BuilderKernel } from '@craftkit/builder-core';
import {
  bindPathOf,
  getAtPropPath,
  partInstances,
  type BlockPartDecl,
  type BlockParts,
  type CustomCodeNode,
  type CustomCodeRoot,
  type PartInstance,
} from '@craftkit/builder-schema';

import { normalizeArabic } from '../intent/normalize-arabic';
import { nodesWithPaths, type TreePath } from '../style-tools/address';
import { blockDisplayName, partBlocks, partInstanceText, type PartBlock, type PropReader } from '../style-tools/part-address';
import { labelOf, readTree, rootChildren } from '../tools/agent/shared';
import type { AgentToolContext } from '../tools/agent/types';
import { partHandleId, sectionHandleId, treeHandleId, type Handle } from './handles';
import type { ScriptElement, ScriptElementKind, ScriptPage } from './types';

/**
 * The read-only element index a script's `ck.find()` searches (agent-script
 * DESIGN §A.5). Pure over the kernel: no model, no writes. It reuses the
 * readers the style and part tools address elements with, so an element a
 * script finds is one `element.*` / `part.*` can write:
 *
 * - sections: the root's children, labelled by their `label` prop;
 * - customCode trees: `nodesWithPaths`, kinds read from tag and classes;
 * - registered blocks: `partBlocks` + `partInstanceText`.
 *
 * Every element's text is Arabic-folded into `norm` for `find({text})`.
 * 2,000 elements per page and 4,000 in all; past a cap the deepest go first.
 */

/** A site as code mode reads it: its pages, a lens per page, and the open page. */
export interface ScriptSite {
  pages(): readonly ScriptPage[];
  /** A page lens. */
  page(pageId: string): BuilderKernel;
  currentPage(): string;
}

export interface ElementIndexOptions {
  /** The open page's id (the page `kernel` is). */
  readonly pageId: string;
  /** The open page's language and direction; read from the root `lang` and document dir when absent. */
  readonly locale?: { readonly lang: string; readonly dir: 'rtl' | 'ltr' };
  /** The page list when there is no site (default: the open page alone). */
  readonly pages?: readonly ScriptPage[];
  /** With a site, every page is indexed through `site.page(id)`. */
  readonly site?: ScriptSite;
  readonly maxPerPage?: number;
  readonly maxTotal?: number;
}

export interface ElementIndex {
  readonly elements: readonly ScriptElement[];
  readonly pages: readonly ScriptPage[];
  readonly handles: ReadonlyMap<string, Handle>;
}

export const SCRIPT_INDEX_MAX_PER_PAGE = 2_000;
export const SCRIPT_INDEX_MAX_TOTAL = 4_000;
export const SCRIPT_TEXT_MAX = 500;
const SECTION_LABEL_MAX = 60;

interface Entry {
  element: Mutable<ScriptElement>;
  handle: Handle;
  depth: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// ── Text ──────────────────────────────────────────────────────────────────────

function flat(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function capText(text: string): string {
  const words = flat(text);
  return words.length > SCRIPT_TEXT_MAX ? `${words.slice(0, SCRIPT_TEXT_MAX - 1)}…` : words;
}

/** `normalizeArabic` + lower case: what `find({text})` compares. */
export function scriptNorm(text: string): string {
  return normalizeArabic(text).toLowerCase();
}

// ── customCode trees ──────────────────────────────────────────────────────────

const TEXT_TAGS: ReadonlySet<string> = new Set([
  'p', 'span', 'blockquote', 'figcaption', 'small', 'strong', 'em', 'b', 'i', 'q', 'cite', 'label',
  'time', 'dt', 'dd', 'td', 'th', 'address', 'mark',
]);
const HEADING = /^h[1-6]$/u;
const INPUT_TAGS: ReadonlySet<string> = new Set(['input', 'textarea', 'select']);

function classes(node: CustomCodeNode): readonly string[] {
  return node.kind === 'component' ? [] : (node.className ?? '').split(/\s+/u).filter((name) => name !== '');
}

function isButtonClass(name: string): boolean {
  return name === 'btn' || name === 'ck-btn' || name.startsWith('ck-btn-') || name.startsWith('btn-');
}

function isCardClass(name: string): boolean {
  return name === 'card' || name === 'ck-card' || name === 'ck-surface' || name.startsWith('ck-card-');
}

function ownText(node: CustomCodeNode): string {
  return node.kind === 'element' ? flat(node.text ?? '') : '';
}

/** Every element's own text in a subtree, in document order. */
function visibleText(node: CustomCodeNode): string {
  if (node.kind === 'icon') return '';
  const parts: string[] = [];
  const own = ownText(node);
  if (own !== '') parts.push(own);
  for (const child of node.children ?? []) {
    const text = visibleText(child);
    if (text !== '') parts.push(text);
  }
  return parts.join(' ');
}

/** Paths of the text-bearing elements in a subtree (the node itself included). */
function textBearing(node: CustomCodeNode, path: TreePath, out: TreePath[]): void {
  if (node.kind !== 'element') return;
  if (ownText(node) !== '') out.push(path);
  (node.children ?? []).forEach((child, index) => {
    textBearing(child, [...path, index], out);
  });
}

/** The deepest single text-bearing element `set({text})` writes, or undefined for mixed content. */
function textPathOf(node: CustomCodeNode, path: TreePath): TreePath | undefined {
  if (node.kind !== 'element') return undefined;
  const bearing: TreePath[] = [];
  textBearing(node, path, bearing);
  if (bearing.length === 1) return bearing[0];
  if (bearing.length > 1) return undefined;
  // No text yet: the element itself, when it has no element children to mix with.
  return (node.children ?? []).some((child) => child.kind !== 'icon') ? undefined : path;
}

function hasImageDescendant(node: CustomCodeNode): boolean {
  if (node.kind === 'icon') return false;
  return (node.children ?? []).some(
    (child: CustomCodeNode) => (child.kind === 'element' && child.tag === 'img') || hasImageDescendant(child),
  );
}

/** The script kind of a tree node, or undefined for layout it does not index. */
function treeKind(node: CustomCodeNode, parent: CustomCodeNode | undefined): ScriptElementKind | undefined {
  if (node.kind === 'icon') return 'icon';
  if (node.kind !== 'element') return undefined;
  const tag = node.tag;
  const names = classes(node);
  if (HEADING.test(tag)) return 'heading';
  if (tag === 'button' || (tag === 'a' && names.some(isButtonClass))) return 'button';
  if (tag === 'article' || names.some(isCardClass)) return 'card';
  if (tag === 'a') return 'link';
  if (tag === 'img') return 'image';
  if (tag === 'picture') return hasImageDescendant(node) ? undefined : 'image';
  if (tag === 'video') return 'video';
  if (INPUT_TAGS.has(tag)) return 'input';
  if (tag === 'li') return 'item';
  if (parent?.kind === 'element' && parent.attributes?.role === 'list') return 'item';
  if (TEXT_TAGS.has(tag) && ownText(node) !== '') return 'text';
  return undefined;
}

function attribute(node: CustomCodeNode, name: 'src' | 'href' | 'alt' | 'placeholder' | 'poster'): string | undefined {
  if (node.kind !== 'element') return undefined;
  const value = (node.attributes as Readonly<Record<string, string | undefined>> | undefined)?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function topElementIndex(tree: CustomCodeRoot): number | undefined {
  const index = tree.children.findIndex((child) => child.kind === 'element');
  return index < 0 ? undefined : index;
}

// ── Registered-block parts ────────────────────────────────────────────────────

function lastSegment(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}

function words(name: string, decl: BlockPartDecl): string {
  return [name, ...(decl.aliases ?? []), decl.label.en, decl.label.ar].join(' ').toLowerCase();
}

/** The script kind of a part, or undefined for lists and boxes. */
function partKind(name: string, decl: BlockPartDecl): ScriptElementKind | undefined {
  switch (decl.kind) {
    case 'text':
    case 'rich': {
      const last = lastSegment(name);
      if (last === 'heading' || last === 'title' || last === 'headline') return 'heading';
      const aliases = (decl.aliases ?? []).map((alias) => alias.toLowerCase());
      return aliases.includes('heading') || aliases.includes('title') || aliases.includes('headline') ? 'heading' : 'text';
    }
    case 'link':
      return /\b(?:button|cta)\b|زر/u.test(words(name, decl)) ? 'button' : 'link';
    case 'image':
      return 'image';
    case 'item':
      return /\bcard\b|بطاق/u.test(words(name, decl)) ? 'card' : 'item';
    default:
      return undefined;
  }
}

function readBound(
  decl: BlockPartDecl,
  index: readonly number[],
  props: Readonly<Record<string, unknown>>,
  which: 'text' | 'href' | 'src' | 'alt',
): string | undefined {
  const path = bindPathOf(decl, index, which);
  if (path === undefined) return undefined;
  const value = getAtPropPath(props, path);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function sameIndex(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((at, position) => at === right[position]);
}

/** The text sub-parts of one item instance (`item.title`, `item.body` at the same index). */
function itemTextParts(
  instance: PartInstance,
  all: readonly PartInstance[],
): readonly PartInstance[] {
  const prefix = `${instance.part}.`;
  return all.filter(
    (other) =>
      other.part.startsWith(prefix) &&
      (other.decl.kind === 'text' || other.decl.kind === 'rich' || other.decl.kind === 'link') &&
      other.index.length >= instance.index.length &&
      sameIndex(other.index.slice(0, instance.index.length), instance.index),
  );
}

/** A registered block's root box part, for a section-level style. */
function rootBoxPart(parts: BlockParts): string | undefined {
  for (const name of ['root', 'section', 'frame', 'container']) {
    if (parts[name]?.kind === 'box') return name;
  }
  return undefined;
}

// ── The page ──────────────────────────────────────────────────────────────────

function liveReader(kernel: BuilderKernel): PropReader {
  return (id, key) => {
    const nodes = kernel.getDocument().nodes;
    if (!Object.hasOwn(nodes, id)) return undefined;
    const props = nodes[id]?.props;
    return props !== undefined && Object.hasOwn(props, key) ? props[key] : undefined;
  };
}

/** The open page's language and direction, read the way expand.ts reads them. */
export function pageLocale(kernel: BuilderKernel, readProp: PropReader): { lang: string; dir: 'rtl' | 'ltr' } {
  const document = kernel.getDocument();
  const dir = document.dir === 'rtl' ? 'rtl' : 'ltr';
  const lang = readProp(document.rootId, 'lang');
  return {
    lang: typeof lang === 'string' && lang.trim() !== '' ? lang.trim().toLowerCase() : dir === 'rtl' ? 'ar' : 'en',
    dir,
  };
}

function stringProp(readProp: PropReader, id: string, key: string): string {
  const value = readProp(id, key);
  return typeof value === 'string' ? value : '';
}

function indexPage(kernel: BuilderKernel, readProp: PropReader, page: ScriptPage): Entry[] {
  const document = kernel.getDocument();
  const context: AgentToolContext = {
    kernel,
    readProp,
    locale: { lang: page.lang, dir: page.dir },
    sampleValues: [],
  };
  const blocks = new Map<string, PartBlock>(partBlocks(kernel, readProp).map((block) => [block.id, block]));
  const entries: Entry[] = [];

  const push = (
    sectionId: string,
    depth: number,
    element: Omit<ScriptElement, 'norm' | 'section' | 'sectionId' | 'page'>,
    handle: Omit<Handle, 'pageId' | 'sectionId'>,
  ): void => {
    const text = capText(element.text);
    entries.push({
      element: { ...element, text, norm: scriptNorm(text), section: '', sectionId, page: page.id },
      handle: { ...handle, pageId: page.id, sectionId },
      depth,
    });
  };

  const indexTree = (sectionId: string, nodeId: string, tree: CustomCodeRoot, depth: number): void => {
    const byPath = new Map<string, CustomCodeNode>();
    for (const { path, node } of nodesWithPaths(tree)) {
      byPath.set(path.join(','), node);
      const parent = path.length > 1 ? byPath.get(path.slice(0, -1).join(',')) : undefined;
      const kind = treeKind(node, parent);
      if (kind === undefined) continue;
      const media = kind === 'image' || kind === 'video' || kind === 'icon';
      const text = media ? '' : kind === 'input' ? (attribute(node, 'placeholder') ?? '') : visibleText(node);
      const src = attribute(node, 'src') ?? (kind === 'video' ? attribute(node, 'poster') : undefined);
      const href = attribute(node, 'href');
      const alt = attribute(node, 'alt');
      const textPath = media || kind === 'input' ? undefined : textPathOf(node, path);
      push(
        sectionId,
        depth + path.length,
        {
          id: treeHandleId(page.id, nodeId, path),
          kind,
          text,
          tag: node.kind === 'element' ? node.tag : node.kind,
          node: nodeId,
          path: `[${path.join(',')}]`,
          ...(src === undefined ? {} : { src }),
          ...(href === undefined ? {} : { href }),
          ...(alt === undefined ? {} : { alt }),
        },
        { type: 'tree', nodeId, path, kind, ...(textPath === undefined ? {} : { textPath }) },
      );
    }
  };

  const indexParts = (sectionId: string, block: PartBlock, depth: number): void => {
    const props = block.node.props as Readonly<Record<string, unknown>>;
    const all = partInstances(block.parts, props);
    for (const instance of all) {
      const kind = partKind(instance.part, instance.decl);
      if (kind === undefined) continue;
      let text = '';
      let textPart: string | undefined;
      if (kind === 'item' || kind === 'card') {
        const subs = itemTextParts(instance, all);
        text = subs.map((sub) => partInstanceText(sub.decl, sub.index, props) ?? '').filter((entry) => entry !== '').join(' · ');
        if (subs.length === 1) textPart = subs[0]?.part;
      } else if (kind !== 'image') {
        text = partInstanceText(instance.decl, instance.index, props) ?? '';
      }
      const src = kind === 'image' ? readBound(instance.decl, instance.index, props, 'src') : undefined;
      const alt = kind === 'image' ? readBound(instance.decl, instance.index, props, 'alt') : undefined;
      const href = instance.decl.kind === 'link' ? readBound(instance.decl, instance.index, props, 'href') : undefined;
      const last = instance.index[instance.index.length - 1];
      push(
        sectionId,
        depth + 1 + instance.index.length,
        {
          id: partHandleId(page.id, block.id, instance.part, instance.index),
          kind,
          text,
          tag: instance.decl.kind,
          node: block.id,
          part: instance.part,
          ...(last === undefined ? {} : { index: last }),
          ...(src === undefined ? {} : { src }),
          ...(href === undefined ? {} : { href }),
          ...(alt === undefined ? {} : { alt }),
        },
        {
          type: 'part',
          nodeId: block.id,
          part: instance.part,
          index: instance.index,
          kind,
          ...(textPart === undefined ? {} : { textPart }),
        },
      );
    }
  };

  const walk = (sectionId: string, nodeId: string, depth: number, seen: Set<string>): void => {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = document.nodes[nodeId];
    if (node === undefined) return;
    const tree = readTree(context, nodeId);
    if (tree !== undefined) indexTree(sectionId, nodeId, tree as unknown as CustomCodeRoot, depth);
    const block = blocks.get(nodeId);
    if (block !== undefined) indexParts(sectionId, block, depth);
    for (const ids of Object.values(node.slots ?? {})) for (const child of ids) walk(sectionId, child, depth + 1, seen);
  };

  const seen = new Set<string>([document.rootId]);
  for (const sectionId of rootChildren(kernel)) {
    const node = document.nodes[sectionId];
    if (node === undefined || seen.has(sectionId)) continue;
    const at = entries.length;
    const tree = readTree(context, sectionId);
    const top = tree === undefined ? undefined : topElementIndex(tree as unknown as CustomCodeRoot);
    const block = blocks.get(sectionId);
    const box = block === undefined ? undefined : rootBoxPart(block.parts);
    push(
      sectionId,
      0,
      { id: sectionHandleId(page.id, sectionId), kind: 'section', text: '', tag: node.type, node: sectionId },
      {
        type: 'section',
        nodeId: sectionId,
        kind: 'section',
        ...(top === undefined ? {} : { path: [top] }),
        ...(box === undefined ? {} : { part: box }),
      },
    );
    walk(sectionId, sectionId, 0, seen);
    // The section's label: its `label` prop, else its first heading, else the block's name.
    const own = labelOf(context, sectionId);
    const heading = entries.slice(at + 1).find((entry) => entry.element.kind === 'heading')?.element.text;
    const label = flat(own ?? (heading !== undefined && heading !== '' ? heading : blockDisplayName(node.type))).slice(
      0,
      SECTION_LABEL_MAX,
    );
    for (const entry of entries.slice(at)) entry.element.section = label;
    const section = entries[at];
    if (section !== undefined) {
      section.element.text = label;
      section.element.norm = scriptNorm(label);
    }
  }
  return entries;
}

/** Keep `cap` entries, dropping the deepest first; page order is kept. */
function capEntries(entries: readonly Entry[], cap: number): readonly Entry[] {
  if (entries.length <= cap) return entries;
  const order = entries
    .map((entry, position) => ({ depth: entry.depth, position }))
    .sort((left, right) => right.depth - left.depth || right.position - left.position);
  const dropped = new Set(order.slice(0, entries.length - Math.max(cap, 0)).map(({ position }) => position));
  return entries.filter((_, position) => !dropped.has(position));
}

/**
 * Index the open page (as the plan's earlier steps leave it, through
 * `readProp`) and, with a site, every other page through its lens.
 */
export function buildElementIndex(
  kernel: BuilderKernel,
  readProp: PropReader,
  options: ElementIndexOptions,
): ElementIndex {
  const perPage = options.maxPerPage ?? SCRIPT_INDEX_MAX_PER_PAGE;
  let budget = options.maxTotal ?? SCRIPT_INDEX_MAX_TOTAL;
  const locale = options.locale ?? pageLocale(kernel, readProp);
  const rootId = kernel.getDocument().rootId;
  const current: ScriptPage = {
    id: options.pageId,
    title: stringProp(readProp, rootId, 'title'),
    slug: stringProp(readProp, rootId, 'slug'),
    lang: locale.lang,
    dir: locale.dir,
    current: true,
  };
  const site = options.site;
  const pages: ScriptPage[] =
    site === undefined
      ? options.pages === undefined
        ? [current]
        : options.pages.map((page) => ({ ...page, current: page.id === options.pageId }))
      : site.pages().map((page) => ({ ...page, current: page.id === options.pageId }));
  if (!pages.some((page) => page.id === options.pageId)) pages.unshift(current);

  const elements: ScriptElement[] = [];
  const handles = new Map<string, Handle>();
  // The open page first, so the total cap never starves it.
  const ordered = [...pages].sort((left, right) => Number(right.current) - Number(left.current));
  const byPage = new Map<string, readonly Entry[]>();
  for (const page of ordered) {
    if (budget <= 0) break;
    const lens = page.current ? kernel : site?.page(page.id);
    if (lens === undefined) continue;
    const entries = capEntries(indexPage(lens, page.current ? readProp : liveReader(lens), page), Math.min(perPage, budget));
    budget -= entries.length;
    byPage.set(page.id, entries);
  }
  // Elements in site page order.
  for (const page of pages) {
    for (const entry of byPage.get(page.id) ?? []) {
      elements.push(Object.freeze(entry.element));
      handles.set(entry.element.id, Object.freeze(entry.handle));
    }
  }
  return { elements, pages, handles };
}
