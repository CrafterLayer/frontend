import { bindPathOf, getAtPropPath, partInstances, setAtPropPath } from '@craftkit/builder-schema';

import { partBlocks, type PartBlock } from '../style-tools/part-address';
import { isSwitcher } from './language-pages';
import {
  declaresProp,
  isElement,
  isIcon,
  isRecord,
  mapTree,
  readTree,
  regionIds,
  rootIdOf,
  setProp,
  type TreeNode,
  type TreeRoot,
} from '../tools/agent/shared';
import type { AgentToolContext, AgentToolStep } from '../tools/agent/types';

/**
 * Every text a page shows a visitor (2026-10-12), read and replaced for a translation: element
 * text and its alt, title, aria-label and placeholder; icon labels; the text, link, rich-text
 * and image-alt parts of registered blocks (the block-parts gate makes every visible word a
 * part); and the page's title, description and social texts. A text without letters (a price,
 * a phone, a year) is the same in every language and never counts.
 */

/** Attributes whose words a visitor reads or hears. */
const TEXT_ATTRIBUTES = ['alt', 'title', 'aria-label', 'placeholder'] as const;
/** Root props a search result or a share card shows. */
const ROOT_TEXTS = ['title', 'description', 'socialTitle', 'socialDescription'] as const;

const LETTER = /\p{L}/u;

/** A text compared the way a person means it: NFC, whitespace runs as one space, trimmed. */
export function textKey(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export interface Translation {
  /** The text's translation (the text itself when it has none), noting what was used or missed. */
  readonly swap: (text: string, counted?: boolean) => string;
  /** Whether the map holds a translation for the text. */
  readonly has: (text: string) => boolean;
  /** Notes a text the page shows that has no translation. */
  readonly miss: (text: string) => void;
  /** The map's keys a page text matched. */
  readonly used: () => ReadonlySet<string>;
  /** Texts with letters that had no translation, each once, in page order. */
  readonly missed: () => readonly string[];
}

export function createTranslation(texts: Readonly<Record<string, string>>): Translation {
  const map = new Map(Object.entries(texts).map(([from, to]) => [textKey(from), to]));
  const used = new Set<string>();
  const missed = new Set<string>();
  const miss = (text: string) => {
    const key = textKey(text);
    if (LETTER.test(key) && !map.has(key)) missed.add(key);
  };
  return {
    has: (text) => map.has(textKey(text)),
    miss,
    swap: (text, counted = true) => {
      const key = textKey(text);
      const next = map.get(key);
      if (next === undefined) {
        if (counted) miss(text);
        return text;
      }
      used.add(key);
      return textKey(next) === key ? text : next;
    },
    used: () => used,
    missed: () => [...missed],
  };
}

// ── Region trees ─────────────────────────────────────────────────────────────

function translateNode(node: TreeNode, translation: Translation): TreeNode {
  if (isIcon(node)) {
    if (node.label === undefined) return node;
    const label = translation.swap(node.label);
    return label === node.label ? node : { ...node, label };
  }
  if (isElement(node)) {
    // Words marked as another language (a switcher's «العربية») stay as written.
    if (typeof node.attributes?.['lang'] === 'string') return node;
    const counted = !isSwitcher(node);
    let next = node;
    if (typeof node.text === 'string') {
      const text = translation.swap(node.text);
      if (text !== node.text) next = { ...next, text };
    }
    const attributes = node.attributes;
    if (attributes !== undefined) {
      let changed: Record<string, string> | undefined;
      for (const name of TEXT_ATTRIBUTES) {
        const value = attributes[name];
        if (typeof value !== 'string') continue;
        const swapped = translation.swap(value, counted);
        if (swapped !== value) (changed ??= { ...attributes })[name] = swapped;
      }
      if (changed !== undefined) next = { ...next, attributes: changed };
    }
    return next;
  }
  // A component's string props may be words or settings: replaced when named, never counted.
  const props = (node as { props?: unknown }).props;
  if (node.kind !== 'component' || !isRecord(props)) return node;
  let changed: Record<string, unknown> | undefined;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== 'string') continue;
    const swapped = translation.swap(value, false);
    if (swapped !== value) (changed ??= { ...props })[key] = swapped;
  }
  return changed === undefined ? node : { ...node, props: changed };
}

/** A region tree with its texts translated (the same reference when nothing changed). */
export function translateTree(tree: TreeRoot, translation: Translation): TreeRoot {
  return mapTree(tree, (node) => translateNode(node, translation));
}

// ── Rich text ─────────────────────────────────────────────────────────────────

function inlineText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (!isRecord(node)) return '';
      if (node['type'] === 'text' && typeof node['text'] === 'string') return node['text'];
      if (node['type'] === 'hardBreak') return '\n';
      return inlineText(node['content']);
    })
    .join('');
}

function inlineFrom(text: string): unknown[] {
  return text
    .split('\n')
    .flatMap((line, at) => [
      ...(at === 0 ? [] : [{ type: 'hardBreak' }]),
      ...(line === '' ? [] : [{ type: 'text', text: line }]),
    ]);
}

/** A rich-text document translated paragraph by paragraph, or run by run when a run is named. */
export function translateRich(value: unknown, translation: Translation): unknown {
  if (!isRecord(value)) return value;
  const type = value['type'];
  const content = value['content'];
  if (type === 'paragraph' || type === 'heading') {
    const plain = inlineText(content);
    if (translation.has(plain)) {
      const next = translation.swap(plain);
      return next === plain ? value : { ...value, content: inlineFrom(next) };
    }
    if (!Array.isArray(content)) return value;
    const runs = content.map((run: unknown) => {
      if (!isRecord(run) || run['type'] !== 'text' || typeof run['text'] !== 'string') return run;
      const text = run['text'];
      if (!translation.has(text)) return run;
      const next = translation.swap(text, false);
      return next === text ? run : { ...run, text: next };
    });
    // A paragraph counts as left over while any run with letters has no translation.
    const left = content.some(
      (run: unknown) =>
        isRecord(run) &&
        typeof run['text'] === 'string' &&
        LETTER.test(run['text']) &&
        !translation.has(run['text']),
    );
    if (left) translation.miss(plain);
    return runs.some((run, at) => run !== content[at]) ? { ...value, content: runs } : value;
  }
  if (!Array.isArray(content)) return value;
  const children = content.map((child: unknown) => translateRich(child, translation));
  return children.some((child, at) => child !== content[at])
    ? { ...value, content: children }
    : value;
}

// ── Registered blocks ─────────────────────────────────────────────────────────

/** One setProp per top-level prop a block's translated parts change. */
export function translateBlock(
  block: PartBlock,
  translation: Translation,
): readonly AgentToolStep[] {
  const before = block.node.props as Readonly<Record<string, unknown>>;
  let props = before;
  for (const instance of partInstances(block.parts, before)) {
    const { decl, index } = instance;
    const slot = decl.kind === 'image' ? 'alt' : 'text';
    if (
      decl.kind !== 'text' &&
      decl.kind !== 'link' &&
      decl.kind !== 'rich' &&
      decl.kind !== 'image'
    )
      continue;
    const path = bindPathOf(decl, index, slot);
    if (path === undefined) continue;
    const value = getAtPropPath(props, path);
    const next =
      decl.kind === 'rich'
        ? translateRich(value, translation)
        : typeof value === 'string'
          ? translation.swap(value)
          : value;
    if (next !== value) props = setAtPropPath(props, path, next);
  }
  return Object.keys(props)
    .filter((key) => props[key] !== before[key])
    .map((key) => setProp(block.id, key, props[key]));
}

// ── The page ──────────────────────────────────────────────────────────────────

export interface TranslatedPage {
  /** Region trees as translated, by region id (only the changed ones). */
  readonly trees: ReadonlyMap<string, TreeRoot>;
  /** setProps for blocks and the page's own texts. */
  readonly steps: readonly AgentToolStep[];
}

/** The whole page translated through `translation`: what changes, as the plan would write it. */
export function translatePage(context: AgentToolContext, translation: Translation): TranslatedPage {
  const trees = new Map<string, TreeRoot>();
  for (const id of regionIds(context)) {
    const tree = readTree(context, id);
    if (tree === undefined) continue;
    const next = translateTree(tree, translation);
    if (next !== tree) trees.set(id, next);
  }
  const steps: AgentToolStep[] = partBlocks(context.kernel, context.readProp).flatMap((block) =>
    translateBlock(block, translation),
  );
  const rootId = rootIdOf(context.kernel);
  for (const key of ROOT_TEXTS) {
    const value = context.readProp(rootId, key);
    if (typeof value !== 'string' || value.trim() === '') continue;
    const next = translation.swap(value);
    if (next !== value && declaresProp(context.kernel, rootId, key))
      steps.push(setProp(rootId, key, next));
  }
  return { trees, steps };
}

/** The texts a page shows, each once, in page order: what a translation must cover. */
export function pageTexts(context: AgentToolContext): readonly string[] {
  const translation = createTranslation({});
  translatePage(context, translation);
  return translation.missed();
}
