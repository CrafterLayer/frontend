import {
  GROUPED_DISPATCH_LABEL_MAX_LENGTH,
  type BuilderKernel,
  type GroupStep,
} from '@craftkit/builder-core';
import type {
  Author,
  CustomCodeNode,
  CustomCodePath,
  CustomCodeRoot,
  Node,
  NodeId,
  Transaction,
} from '@craftkit/builder-schema';

import { customCodeElementAt } from './element-at';

/*
  ── What a style/element edit is aimed at (style-manager DESIGN.md §A.1) ─────

  One union for every consumer — the style panel, the quick bar, the canvas
  handles, the layers tree, the clipboard and multi-select — so "the thing the
  person picked" has one spelling everywhere:

  - `tree`: an element, icon or component INSIDE a custom-code region,
    addressed by the region's node id plus child indices from the tree root
    (the same address the canvas stamps as `data-ck-path`);
  - `block`: a registered block instance, addressed by its node id.
*/
export type ElementTarget =
  | { readonly kind: 'tree'; readonly nodeId: NodeId; readonly path: CustomCodePath }
  | { readonly kind: 'block'; readonly nodeId: NodeId };

export interface ResolvedTreeTarget {
  readonly kind: 'tree';
  readonly target: Extract<ElementTarget, { kind: 'tree' }>;
  /** The region hosting the tree. */
  readonly host: Node;
  /** The prop the tree lives in, found by its declaration. */
  readonly treeKey: string;
  readonly tree: CustomCodeRoot;
  readonly node: CustomCodeNode;
  /** A short human name for labels: 'Heading “Our story”'. */
  readonly displayName: string;
}

export interface ResolvedBlockTarget {
  readonly kind: 'block';
  readonly target: Extract<ElementTarget, { kind: 'block' }>;
  readonly node: Node;
  readonly displayName: string;
}

export type ResolvedElementTarget = ResolvedTreeTarget | ResolvedBlockTarget;

/** The words a display name is built from; override per locale. */
export interface ElementNameWords {
  readonly tags: Readonly<Record<string, string>>;
  readonly element: string;
  readonly icon: string;
  readonly component: string;
}

export const ELEMENT_NAME_WORDS_EN: ElementNameWords = {
  tags: {
    h1: 'Heading',
    h2: 'Heading',
    h3: 'Heading',
    h4: 'Heading',
    h5: 'Heading',
    h6: 'Heading',
    p: 'Text',
    span: 'Text',
    strong: 'Bold text',
    em: 'Italic text',
    small: 'Small text',
    blockquote: 'Quote',
    q: 'Quote',
    a: 'Link',
    button: 'Button',
    img: 'Image',
    picture: 'Picture',
    video: 'Video',
    figure: 'Figure',
    figcaption: 'Caption',
    ul: 'List',
    ol: 'List',
    li: 'List item',
    section: 'Section',
    header: 'Header',
    footer: 'Footer',
    nav: 'Navigation',
    main: 'Main',
    article: 'Article',
    aside: 'Aside',
    div: 'Container',
    hr: 'Divider',
    table: 'Table',
    form: 'Form',
    input: 'Input',
    textarea: 'Text area',
    label: 'Label',
    svg: 'Drawing',
  },
  element: 'Element',
  icon: 'Icon',
  component: 'Component',
};

export const ELEMENT_NAME_WORDS_AR: ElementNameWords = {
  tags: {
    h1: 'عنوان',
    h2: 'عنوان',
    h3: 'عنوان',
    h4: 'عنوان',
    h5: 'عنوان',
    h6: 'عنوان',
    p: 'نص',
    span: 'نص',
    strong: 'نص عريض',
    em: 'نص مائل',
    small: 'نص صغير',
    blockquote: 'اقتباس',
    q: 'اقتباس',
    a: 'رابط',
    button: 'زر',
    img: 'صورة',
    picture: 'صورة',
    video: 'فيديو',
    figure: 'شكل',
    figcaption: 'تعليق',
    ul: 'قائمة',
    ol: 'قائمة',
    li: 'عنصر قائمة',
    section: 'قسم',
    header: 'ترويسة',
    footer: 'تذييل',
    nav: 'تنقل',
    main: 'المحتوى الرئيسي',
    article: 'مقالة',
    aside: 'جانبي',
    div: 'حاوية',
    hr: 'فاصل',
    table: 'جدول',
    form: 'نموذج',
    input: 'حقل إدخال',
    textarea: 'منطقة نص',
    label: 'تسمية',
    svg: 'رسم',
  },
  element: 'عنصر',
  icon: 'أيقونة',
  component: 'مكوّن',
};

const PREVIEW_MAX = 24;

/** The first words of an element's own text, or of its first text-bearing descendant. */
function textPreview(node: CustomCodeNode): string | undefined {
  const stack: CustomCodeNode[] = [node];
  let guard = 0;
  while (stack.length > 0 && guard < 200) {
    guard += 1;
    const current = stack.shift();
    /* v8 ignore next -- shift() on a non-empty array always yields. */
    if (current === undefined) break;
    if (current.kind === 'element') {
      const text = current.text?.replace(/\s+/gu, ' ').trim();
      if (text !== undefined && text !== '') {
        return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : text;
      }
    }
    if (current.kind !== 'icon') stack.push(...(current.children ?? []));
  }
  return undefined;
}

/**
 * A short human name for a tree node, for history labels and Layers:
 * the editor `label` first (P3's Layers name), then the kind word plus a
 * quoted text preview — 'Heading “Our story”', 'Image', 'Icon mail'.
 */
export function treeNodeDisplayName(
  node: CustomCodeNode,
  words: ElementNameWords = ELEMENT_NAME_WORDS_EN,
): string {
  const own = (node as { label?: unknown }).label;
  if (node.kind !== 'icon' && typeof own === 'string' && own.trim() !== '') return own.trim();
  if (node.kind === 'icon') return `${words.icon} ${node.name}`;
  if (node.kind === 'component') return `${words.component} ${node.component}`;
  const word = words.tags[node.tag] ?? words.element;
  const preview = textPreview(node);
  return preview === undefined ? word : `${word} “${preview}”`;
}

/**
 * Resolve a target against document truth. `undefined` whenever it has gone
 * stale — the node was removed, its block declares no tree, or the path no
 * longer lands on a node (an undo or an AI rewrite moved things).
 */
export function resolveElementTarget(
  kernel: BuilderKernel,
  target: ElementTarget,
  words: ElementNameWords = ELEMENT_NAME_WORDS_EN,
): ResolvedElementTarget | undefined {
  const host = kernel.getDocument().nodes[target.nodeId];
  if (host === undefined) return undefined;
  if (target.kind === 'block') {
    const label = host.props['label'];
    const displayName =
      typeof label === 'string' && label.trim() !== '' ? label.trim() : humanizeType(host.type);
    return { kind: 'block', target, node: host, displayName };
  }
  const found = customCodeElementAt(kernel, target.nodeId, target.path);
  if (found === undefined) return undefined;
  return {
    kind: 'tree',
    target,
    host,
    treeKey: found.treeKey,
    tree: found.tree,
    node: found.element,
    displayName: treeNodeDisplayName(found.element, words),
  };
}

/** 'heroSplit' → 'Hero split'; 'marketing.cta-band' → 'Cta band'. */
function humanizeType(type: string): string {
  const last = type.split(/[./:]/u).pop() ?? type;
  const words = last
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? type : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** Two targets name the same thing. */
export function sameElementTarget(a: ElementTarget, b: ElementTarget): boolean {
  if (a.kind !== b.kind || a.nodeId !== b.nodeId) return false;
  if (a.kind === 'block' || b.kind === 'block') return true;
  return a.path.length === b.path.length && a.path.every((value, at) => b.path[at] === value);
}

/** A stable string key for a target (`tree:a:0.1`, `block:a`), for sets and React keys. */
export function elementTargetKey(target: ElementTarget): string {
  return target.kind === 'block' ? `block:${target.nodeId}` : `tree:${target.nodeId}:${target.path.join('.')}`;
}

/** Trim and clip a history label to the kernel's grouped-label ceiling. */
export function clipHistoryLabel(label: string): string {
  const trimmed = label.replace(/\s+/gu, ' ').trim();
  if (trimmed.length <= GROUPED_DISPATCH_LABEL_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * Commit element edits as ONE labelled transaction — one history entry, one
 * Undo, atomic (a refused step leaves nothing behind). The label is what the
 * History panel shows ("Padding · Hero heading"), clipped to 160 characters.
 * Throws the door's refusal; see `tryDispatchTreeEdits` for a result.
 */
export function dispatchTreeEdits(
  kernel: BuilderKernel,
  steps: readonly GroupStep[],
  label: string,
  author: Author = 'user',
): Transaction {
  const clipped = clipHistoryLabel(label);
  return kernel.dispatchGroup(steps, clipped === '' ? { author } : { author, label: clipped });
}

export type TreeEditResult =
  | { readonly ok: true; readonly tx: Transaction }
  | { readonly ok: false; readonly message: string };

/** `dispatchTreeEdits` for UI callers that show a refusal instead of throwing. */
export function tryDispatchTreeEdits(
  kernel: BuilderKernel,
  steps: readonly GroupStep[],
  label: string,
  author: Author = 'user',
): TreeEditResult {
  try {
    return { ok: true, tx: dispatchTreeEdits(kernel, steps, label, author) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
