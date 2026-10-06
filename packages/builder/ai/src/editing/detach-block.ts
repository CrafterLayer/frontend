import { Parser } from 'htmlparser2';

import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  customCodeAttributeProblem,
  customCodeTreeProblems,
  customCodeTreeSchema,
  isCustomCodeTag,
  isCustomCodeTreeSchema,
  type BuilderDocument,
  type CustomCodeNode,
  type CustomCodeRoot,
  type JsonValue,
  type NodeId,
  type Transaction,
} from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';

/**
 * "Convert to editable" (style-manager DESIGN.md §A.9): turn a registered
 * block into a customCode region whose inner parts are elements — so every
 * heading, button and card of a marketing block becomes a widget the style
 * panel, the quick bar and the agent can address by path.
 *
 *   1. render the block's static markup (the publish renderer, injected:
 *      the ai package is layer 2 and may not import the renderer);
 *   2. read it with `parseTreeMarkup`, the reader the agent's markup uses;
 *   3. drop what the element door does not admit (documented below);
 *   4. judge the tree with the door (per-tag problems + tree schema);
 *   5. replace the node with a customCode region at the same parent, slot
 *      and index in ONE labelled transaction — one Undo restores the block.
 *
 * When the door refuses, nothing changes and the reasons come back.
 *
 * ## What does not survive, on purpose (the documented exceptions)
 *
 * - `data-*` hooks a block renders for its own CSS or tests (`data-mkt-part`,
 *   `data-hero-variant`…): the door admits `data-ck-*` only.
 * - Form `action` / `method`: a tree form submits through the whatsapp-form
 *   behaviour only (§D.1); the converted form is inert until one is attached.
 * - Any other attribute the door refuses for its tag (named in `dropped`).
 * - React behaviour (a carousel's arrows, a tab switch): the markup keeps
 *   its look; interactions come back through `data-ck-behavior`.
 * - Per-breakpoint PROP overrides and data bindings are rendered at their
 *   desktop / unbound value (reported in `warnings`); classes that carry
 *   their own breakpoints (`@lg:`, `max-md:`) keep working.
 *
 * Classes are never dropped and never checked here: they are the block's
 * own, so the live compiler that styled the block styles the region the same.
 */

/** Renders a document from its `rootId` down to static HTML (the host passes `renderStaticMarkup`). */
export type BlockMarkupRenderer = (document: BuilderDocument) => string;

let registeredRenderer: BlockMarkupRenderer | undefined;

/**
 * Register (or clear) the host's static renderer — process-wide, like the
 * utility-class oracle: the editor preset passes
 * `(doc) => renderStaticMarkup(doc, { blocks: (type) => registry.block(type) })`.
 */
export function setBlockMarkupRenderer(renderer: BlockMarkupRenderer | undefined): void {
  registeredRenderer = renderer;
}

export function getBlockMarkupRenderer(): BlockMarkupRenderer | undefined {
  return registeredRenderer;
}

export interface DroppedAttribute {
  readonly path: readonly number[];
  readonly name: string;
  readonly reason: string;
}

export interface DetachOptions {
  /** Defaults to the registered renderer. */
  readonly render?: BlockMarkupRenderer;
  /** The region block type (default `customCode`). */
  readonly regionType?: string;
  readonly author?: 'user' | 'ai';
}

export type DetachPlan =
  | {
      readonly ok: true;
      /** insertNode (the region) + removeNode (the block): dispatch as ONE group. */
      readonly steps: readonly GroupStep[];
      readonly label: string;
      readonly markup: string;
      readonly tree: CustomCodeRoot;
      readonly dropped: readonly DroppedAttribute[];
      readonly warnings: readonly string[];
    }
  | { readonly ok: false; readonly reasons: readonly string[] };

export type DetachResult =
  | {
      readonly ok: true;
      readonly transaction: Transaction;
      /** The history label: "Convert to editable · <block name>". */
      readonly label: string;
      /** The new region's id. */
      readonly regionId: NodeId | undefined;
      readonly dropped: readonly DroppedAttribute[];
      readonly warnings: readonly string[];
    }
  | { readonly ok: false; readonly reasons: readonly string[] };

const ATTRIBUTE_ALWAYS_DROPPED = new Set(['action', 'method', 'formaction', 'style']);

/** "bento-grid" / "logoCloud" → "Bento grid" / "Logo cloud". */
export function humanBlockName(type: string): string {
  const words = type
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? type : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function parentOf(document: BuilderDocument, id: NodeId): { parentId: NodeId; slot: string; index: number } | undefined {
  for (const node of Object.values(document.nodes)) {
    for (const [slot, children] of Object.entries(node.slots ?? {})) {
      const index = children.indexOf(id);
      if (index !== -1) return { parentId: node.id, slot, index };
    }
  }
  return undefined;
}

function subtreeIds(document: BuilderDocument, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || out.includes(next)) continue;
    out.push(next);
    for (const children of Object.values(document.nodes[next]?.slots ?? {})) stack.push(...children);
  }
  return out;
}

/** The prop a region block keeps its tree in, found by declaration. */
function treeKeyOf(kernel: BuilderKernel, type: string): string | undefined {
  const block = kernel.context.registry.block(type);
  const shape = (block?.schema.props as unknown as { shape?: Record<string, unknown> } | undefined)?.shape;
  if (shape === undefined) return undefined;
  return Object.entries(shape).find(([, prop]) => isCustomCodeTreeSchema(prop as never))?.[0];
}

/*
  Phrasing tags the vocabulary lacks become a span, as the plan normalizer
  respells them, plus the one utility that keeps the look the browser gave
  the tag by default (a sale price's struck-through `del`).
*/
const RESPELLED_PHRASING: Readonly<Record<string, string | undefined>> = {
  del: 'line-through',
  ins: 'underline',
  u: 'underline',
  bdi: undefined,
  bdo: undefined,
  big: undefined,
  data: undefined,
  dfn: undefined,
  kbd: undefined,
  samp: undefined,
  var: undefined,
  output: undefined,
};

/** Drop the attributes the door does not admit, respell phrasing tags, and record both. */
function cleanTree(tree: CustomCodeRoot): {
  tree: CustomCodeRoot;
  dropped: DroppedAttribute[];
  respelled: string[];
  unknownTags: string[];
} {
  const dropped: DroppedAttribute[] = [];
  const respelled: string[] = [];
  const unknownTags: string[] = [];
  const clean = (original: CustomCodeNode, path: number[]): CustomCodeNode => {
    if (original.kind !== 'element') return original;
    let node = original;
    if (!isCustomCodeTag(node.tag)) {
      const tag: string = node.tag;
      if (Object.hasOwn(RESPELLED_PHRASING, tag)) {
        const keep = RESPELLED_PHRASING[tag];
        const className = [node.className ?? '', keep ?? ''].join(' ').trim();
        respelled.push(`<${tag}> at [${path.join(',')}] → <span${keep === undefined ? '' : ` class='${keep}'`}>`);
        node = { ...node, tag: 'span', ...(className === '' ? {} : { className }) };
      } else if (!unknownTags.includes(tag)) {
        unknownTags.push(tag);
      }
    }
    let attributes = node.attributes;
    if (attributes !== undefined) {
      const kept: Record<string, string> = {};
      for (const [name, value] of Object.entries(attributes)) {
        if (typeof value !== 'string') continue;
        const reason = ATTRIBUTE_ALWAYS_DROPPED.has(name)
          ? `${name} is not admitted in a region (forms submit through whatsapp-form)`
          : name.startsWith('data-') && !name.startsWith('data-ck-')
            ? `${name} is the block's own hook; regions admit data-ck-* only`
            : customCodeAttributeProblem(node.tag, name, value);
        if (reason === undefined) kept[name] = value;
        else dropped.push({ path, name, reason });
      }
      attributes = Object.keys(kept).length === 0 ? undefined : kept;
    }
    const children = node.children?.map((child, index) => clean(child, [...path, index]));
    const next: Record<string, unknown> = { ...node };
    if (attributes === undefined) delete next['attributes'];
    else next['attributes'] = attributes;
    if (children !== undefined) next['children'] = children;
    return next as unknown as CustomCodeNode;
  };
  return {
    tree: { ...tree, children: tree.children.map((child, index) => clean(child, [index])) },
    dropped,
    respelled,
    unknownTags,
  };
}

function doorReasons(tree: CustomCodeRoot): string[] {
  const reasons = customCodeTreeProblems(tree).map(
    (problem) => `${problem.message}${problem.path.length === 0 ? '' : ` (at ${problem.path.map(String).join('.')})`}`,
  );
  if (reasons.length > 0) return reasons.slice(0, 12);
  const shape = customCodeTreeSchema.safeParse(tree);
  if (shape.success) return [];
  return shape.error.issues.slice(0, 12).map((issue) => `${issue.message} (at ${issue.path.map(String).join('.')})`);
}

/**
 * Steps 2–4 alone, pure: a block's static markup → the region tree the door
 * admits, with what was dropped, or the door's reasons.
 */
export function regionTreeFromMarkup(markup: string):
  | {
      readonly ok: true;
      readonly tree: CustomCodeRoot;
      readonly dropped: readonly DroppedAttribute[];
      /** Phrasing tags the vocabulary lacks, respelled as spans. */
      readonly respelled: readonly string[];
    }
  | { readonly ok: false; readonly reasons: readonly string[] } {
  const read = parseTreeMarkup(markup) as unknown as CustomCodeRoot;
  if (read.children.length === 0) return { ok: false, reasons: ['the block renders nothing to convert'] };
  const { tree, dropped, respelled, unknownTags } = cleanTree(read);
  if (unknownTags.length > 0) {
    return { ok: false, reasons: unknownTags.map((tag) => `<${tag}> is not an element a region admits`) };
  }
  const reasons = doorReasons(tree);
  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, tree, dropped, respelled };
}

/** Everything detach would do, without doing it. */
export function planBlockDetach(kernel: BuilderKernel, nodeId: NodeId, options: DetachOptions = {}): DetachPlan {
  const document = kernel.getDocument();
  const node = Object.hasOwn(document.nodes, nodeId) ? document.nodes[nodeId] : undefined;
  if (node === undefined) return { ok: false, reasons: [`node "${nodeId}" does not exist · send the id of a block on this page`] };
  if (nodeId === document.rootId) return { ok: false, reasons: ['the page root cannot be converted · send the id of a section block'] };
  const regionType = options.regionType ?? 'customCode';
  if (node.type === regionType || treeKeyOf(kernel, node.type) !== undefined) {
    return { ok: false, reasons: [`"${nodeId}" is already an editable region`] };
  }
  const treeKey = treeKeyOf(kernel, regionType);
  if (treeKey === undefined) return { ok: false, reasons: [`no "${regionType}" region block is registered on this editor`] };
  const place = parentOf(document, nodeId);
  if (place === undefined) return { ok: false, reasons: [`"${nodeId}" sits in no slot`] };
  // Before rendering anything: a slot that cannot hold a region makes the conversion impossible here.
  const parentType = document.nodes[place.parentId]?.type;
  const allow =
    parentType === undefined ? undefined : kernel.context.registry.block(parentType)?.schema.slots?.[place.slot]?.allow;
  if (allow !== undefined && !allow.includes(regionType)) {
    return {
      ok: false,
      reasons: [
        `"${nodeId}" sits in slot "${place.slot}" of "${parentType ?? ''}", which accepts [${allow.join(', ')}] and not an editable region · convert the block that holds it instead`,
      ],
    };
  }
  const render = options.render ?? registeredRenderer;
  if (render === undefined) return { ok: false, reasons: ['Convert to editable is not available here: no static renderer is registered'] };

  let markup: string;
  try {
    markup = render({ ...document, rootId: nodeId });
  } catch (cause) {
    return { ok: false, reasons: [`the block could not be rendered: ${cause instanceof Error ? cause.message : String(cause)}`] };
  }
  const converted = regionTreeFromMarkup(markup);
  if (!converted.ok) return converted;
  const { tree, dropped, respelled } = converted;

  const warnings: string[] = respelled.map((change) => `${change}: the vocabulary has no such tag`);
  for (const id of subtreeIds(document, nodeId)) {
    const inner = document.nodes[id];
    if (inner?.responsive !== undefined && Object.keys(inner.responsive).length > 0) {
      warnings.push(`"${id}" had tablet/mobile overrides; the region keeps its desktop look on every screen until restyled`);
    }
    if (inner?.bindings !== undefined && Object.keys(inner.bindings).length > 0) {
      warnings.push(`"${id}" was bound to data; the region keeps the text it showed`);
    }
  }
  const ownLabel = node.props['label'];
  const name = typeof ownLabel === 'string' && ownLabel.trim() !== '' ? ownLabel.trim() : humanBlockName(node.type);
  const props: Record<string, JsonValue> = { label: name.slice(0, 80), [treeKey]: tree as unknown as JsonValue };
  return {
    ok: true,
    label: `Convert to editable · ${name}`.slice(0, 160),
    markup,
    tree,
    dropped,
    warnings,
    steps: [
      { command: 'insertNode', args: { type: regionType, props, parentId: place.parentId, slot: place.slot, index: place.index } },
      { command: 'removeNode', args: { id: nodeId } },
    ],
  };
}

/**
 * Replace a registered block with an editable customCode region, in one
 * labelled transaction. Refused ⇒ `{ ok: false, reasons }` and the page is
 * unchanged (the group is atomic).
 */
export function detachBlockToCustomCode(kernel: BuilderKernel, nodeId: NodeId, options: DetachOptions = {}): DetachResult {
  const plan = planBlockDetach(kernel, nodeId, options);
  if (!plan.ok) return plan;
  const before = kernel.getDocument();
  const place = parentOf(before, nodeId);
  let transaction: Transaction;
  try {
    transaction = kernel.dispatchGroup(plan.steps, { author: options.author ?? 'user', label: plan.label });
  } catch (cause) {
    return { ok: false, reasons: [cause instanceof Error ? cause.message : String(cause)] };
  }
  const after = kernel.getDocument();
  const regionId =
    place === undefined ? undefined : after.nodes[place.parentId]?.slots?.[place.slot]?.[place.index];
  return { ok: true, transaction, label: plan.label, regionId, dropped: plan.dropped, warnings: plan.warnings };
}

// ── Fidelity ────────────────────────────────────────────────────────────────────

export interface DetachFidelity {
  /** Classes the markup had that the tree lost. */
  readonly missingClasses: readonly string[];
  /** Classes the tree has that the markup did not. */
  readonly extraClasses: readonly string[];
  readonly wordsBefore: readonly string[];
  readonly wordsAfter: readonly string[];
  readonly textEqual: boolean;
}

/*
  Inline elements continue a sentence; every other element is a word
  boundary on both sides. The tree reader trims a block's edge spaces (as a
  browser renders them), so both sides mark block edges the same way and
  only an inline boundary — where a lost space really joins two words — is
  compared character for character.
*/
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd',
  'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
]);

function markupClassesAndText(markup: string): { classes: Set<string>; text: string } {
  const classes = new Set<string>();
  let text = '';
  const boundary = (tag: string): void => {
    if (!INLINE.has(tag.toLowerCase())) text += ' ';
  };
  const parser = new Parser(
    {
      onattribute(name, value) {
        if (name === 'class') for (const cls of value.split(/\s+/u)) if (cls !== '') classes.add(cls);
      },
      onopentagname: boundary,
      onclosetag: boundary,
      ontext(chunk) {
        text += chunk;
      },
    },
    { decodeEntities: true },
  );
  parser.write(markup);
  parser.end();
  return { classes, text };
}

function treeClassesAndText(tree: CustomCodeRoot): { classes: Set<string>; text: string } {
  const classes = new Set<string>();
  let text = '';
  const walk = (node: CustomCodeNode): void => {
    if (node.kind !== 'component') for (const cls of (node.className ?? '').split(/\s+/u)) if (cls !== '') classes.add(cls);
    const block = node.kind !== 'element' || !INLINE.has(node.tag);
    if (block) text += ' ';
    if (node.kind === 'element') text += node.text ?? '';
    if (node.kind !== 'icon') for (const child of node.children ?? []) walk(child);
    if (block) text += ' ';
  };
  for (const child of tree.children) walk(child);
  return { classes, text };
}

const words = (text: string): string[] => text.split(/\s+/u).filter((word) => word !== '');

/**
 * The §A.9 fidelity check: the class set and the words of the text, before
 * (the block's markup) and after (the region tree). Text is compared as the
 * sequence of words, so a space eaten at a tag boundary ("onceand") fails it.
 */
export function detachFidelity(markup: string, tree: CustomCodeRoot): DetachFidelity {
  const before = markupClassesAndText(markup);
  const after = treeClassesAndText(tree);
  const wordsBefore = words(before.text);
  const wordsAfter = words(after.text);
  return {
    missingClasses: [...before.classes].filter((cls) => !after.classes.has(cls)),
    extraClasses: [...after.classes].filter((cls) => !before.classes.has(cls)),
    wordsBefore,
    wordsAfter,
    textEqual: wordsBefore.length === wordsAfter.length && wordsBefore.every((word, index) => word === wordsAfter[index]),
  };
}
