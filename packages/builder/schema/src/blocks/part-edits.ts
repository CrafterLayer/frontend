/**
 * Pure planners for every part edit (block-parts DESIGN §2.4).
 *
 * Each planner turns one person-sized request ("this item's title says X",
 * "remove the third card", "pad the heading") into ONE `setProp` of the
 * block's TOP-LEVEL key, with the nested value replaced, plus the history
 * label. Every consumer (canvas, quick bar, Layers, Inspector part panel,
 * agent) dispatches the result through the same door:
 *
 * ```ts
 * const plan = planPartValue(node, parts, ref, 'text', value, 'Hero');
 * if (plan.ok) kernel.dispatchGroup(plan.steps, { author, label: plan.label });
 * ```
 *
 * so every edit is one transaction and one Undo (law L1), and the setProp
 * door still validates the new value against the block's schema. A refusal
 * is `{ ok: false, message }`, the message reading "what is wrong · what to
 * send".
 */
import type { z } from 'zod';

import type { Node, NodeId } from '../document/types';
import type { JsonValue } from '../json/json-value';
import { richTextDocSchema } from '../rich-text/rich-text';
import { STYLE_PROPERTIES } from '../style/catalogue';
import { applyStyleIntents } from '../style/engine';
import type { StyleIntent } from '../style/types';
import {
  bindPathOf,
  partStyleKey,
  type BlockPartDecl,
  type BlockParts,
  type PartRef,
  type PartValueSlot,
} from './block-parts';
import { getAtPropPath, setAtPropPath, type PropPath } from './prop-path';
import { partStylesKeyOf } from './part-styles';

/** One step of a part plan: the existing setProp command. */
export interface PartStep {
  readonly command: 'setProp';
  readonly args: { readonly id: NodeId; readonly key: string; readonly value: JsonValue };
}

export type PartPlan =
  | { readonly ok: true; readonly steps: readonly PartStep[]; readonly label: string }
  | { readonly ok: false; readonly message: string };

/** A change to a list part (or to the list an item part belongs to). */
export type PartListOp =
  | { readonly kind: 'add'; readonly at: number; readonly item?: JsonValue }
  | { readonly kind: 'duplicate'; readonly at: number }
  | { readonly kind: 'remove'; readonly at: number }
  | { readonly kind: 'move'; readonly from: number; readonly to: number };

/** History labels are capped where the grouped door caps them. */
const LABEL_MAX = 160;

function label(action: string, elementName: string): string {
  return `${action} · ${elementName}`.slice(0, LABEL_MAX);
}

function refuse(message: string): PartPlan {
  return { ok: false, message };
}

/* "heading" → "heading", "item.title" → "item title". */
function humanizePartName(part: string): string {
  return part
    .split('.')
    .map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' ');
}

/** "Hero heading", "Features item title 3": the element a history entry names. */
function elementName(blockName: string, ref: PartRef, decl?: BlockPartDecl): string {
  const name = decl === undefined ? humanizePartName(ref.part) : decl.label.en.toLowerCase();
  const ordinal = ref.index.length > 0 ? ` ${ref.index.map((at) => String(at + 1)).join('.')}` : '';
  // ── block-parts (2026-10-06) ── "Rich Text" + "text" is "Rich Text", never "Rich Text text"
  if (blockName.toLowerCase().endsWith(` ${name}`) || blockName.toLowerCase() === name) {
    return `${blockName}${ordinal}`;
  }
  // ── /block-parts ──
  return `${blockName} ${name}${ordinal}`;
}

function declaredNames(parts: BlockParts): string {
  const names = Object.keys(parts);
  return names.length === 0 ? 'this block declares no parts' : names.join(', ');
}

function lookupPart(
  parts: BlockParts,
  ref: PartRef,
  blockName: string,
): { readonly ok: true; readonly decl: BlockPartDecl } | { readonly ok: false; readonly message: string } {
  const decl = Object.hasOwn(parts, ref.part) ? parts[ref.part] : undefined;
  if (decl === undefined) {
    return {
      ok: false,
      message: `${blockName} has no part "${ref.part}" · send one of: ${declaredNames(parts)}`,
    };
  }
  return { ok: true, decl };
}

/*
  Every index on the path must name an existing array entry: an edit may fill
  a missing optional leaf, but never invent an item.
*/
function checkIndices(props: Readonly<Record<string, unknown>>, path: PropPath): string | undefined {
  for (let depth = 0; depth < path.length; depth += 1) {
    const segment = path[depth];
    if (typeof segment !== 'number') continue;
    const container = getAtPropPath(props, path.slice(0, depth));
    if (!Array.isArray(container)) {
      return `"${path.slice(0, depth).join('.')}" is not a list here`;
    }
    if (segment >= container.length) {
      return `item ${String(segment + 1)} does not exist (the list has ${String(container.length)})`;
    }
  }
  return undefined;
}

/* One setProp of the top-level key of `path`, with the nested value replaced. */
function stepAt(node: Node, path: PropPath, value: unknown): PartStep | undefined {
  const [top, ...rest] = path;
  if (typeof top !== 'string') return undefined;
  const current = Object.hasOwn(node.props, top) ? node.props[top] : undefined;
  const next = rest.length === 0 ? value : setAtPropPath(current, rest, value);
  return { command: 'setProp', args: { id: node.id, key: top, value: next as JsonValue } };
}

const VALUE_SLOTS: Readonly<Record<BlockPartDecl['kind'], readonly PartValueSlot[]>> = {
  text: ['text'],
  rich: ['text'],
  link: ['text', 'href'],
  image: ['src', 'alt'],
  list: [],
  item: [],
  box: [],
};

const VALUE_ACTIONS: Readonly<Record<PartValueSlot, string>> = {
  text: 'Edit text',
  href: 'Edit link',
  src: 'Replace image',
  alt: 'Edit alt text',
};

/**
 * Set one bound value of a part instance: its text (text, rich, link), its
 * href (link), or its src or alt (image). Rich text must be a valid rich-text
 * document; every other value is a string.
 */
export function planPartValue(
  node: Node,
  parts: BlockParts,
  ref: PartRef,
  which: PartValueSlot,
  value: JsonValue,
  blockName: string,
): PartPlan {
  const found = lookupPart(parts, ref, blockName);
  if (!found.ok) return refuse(found.message);
  const { decl } = found;
  const slots = VALUE_SLOTS[decl.kind];
  if (!slots.includes(which)) {
    return refuse(
      slots.length === 0
        ? `"${ref.part}" is a ${decl.kind} part and holds no value of its own · edit one of its text, link or image parts`
        : `"${ref.part}" is a ${decl.kind} part and has no ${which} · send one of: ${slots.join(', ')}`,
    );
  }
  const path = bindPathOf(decl, ref.index, which);
  if (path === undefined) {
    return refuse(
      which === 'alt'
        ? `"${ref.part}" declares no alt text binding · send src only`
        : `"${ref.part}" needs ${String(countStars(decl, which))} index value(s), got ${String(ref.index.length)} · send the item index`,
    );
  }
  if (decl.kind === 'rich') {
    if (!richTextDocSchema.safeParse(value).success) {
      return refuse(`"${ref.part}" holds rich text, and this value is not a rich-text document · send { type: 'doc', content: [...] }`);
    }
  } else if (typeof value !== 'string') {
    return refuse(`"${ref.part}" ${which} must be text · send a string`);
  }
  const problem = checkIndices(node.props, path);
  if (problem !== undefined) return refuse(`${problem} · send an index inside the list`);
  const step = stepAt(node, path, value);
  if (step === undefined) return refuse(`"${ref.part}" has an unusable bind · fix the block's parts declaration`);
  return { ok: true, steps: [step], label: label(VALUE_ACTIONS[which], elementName(blockName, ref, decl)) };
}

function countStars(decl: BlockPartDecl, which: PartValueSlot): number {
  const bind = decl.bind;
  const pattern =
    bind === undefined
      ? ''
      : typeof bind === 'string'
        ? bind
        : 'href' in bind
          ? which === 'href'
            ? bind.href
            : bind.text
          : which === 'alt'
            ? (bind.alt ?? '')
            : bind.src;
  return pattern.split('.').filter((segment) => segment === '*').length;
}

/* A JSON value copied deep, so a duplicated item shares nothing with its source. */
function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) copy[key] = cloneJson(entry);
    return copy;
  }
  return value;
}

/* The item schema's own defaults, when it can produce a valid item from nothing. */
function defaultItem(itemSchema: z.ZodType | undefined): JsonValue | undefined {
  if (itemSchema === undefined) return undefined;
  for (const probe of [undefined, {}]) {
    const parsed = itemSchema.safeParse(probe);
    if (parsed.success && parsed.data !== undefined) return parsed.data as JsonValue;
  }
  return undefined;
}

const LIST_ACTIONS: Readonly<Record<PartListOp['kind'], string>> = {
  add: 'Add item',
  duplicate: 'Duplicate item',
  remove: 'Remove item',
  move: 'Move item',
};

/**
 * Add, duplicate, remove or move one entry of a list. `ref` names either the
 * list part itself or any item part of it (whose last index is then ignored:
 * the op's own `at`/`from` says which entry). `add` without an `item` uses
 * the item schema's defaults, falling back to a copy of the neighbouring item.
 */
export function planPartListOp(
  node: Node,
  parts: BlockParts,
  ref: PartRef,
  op: PartListOp,
  blockName: string,
  itemSchema?: z.ZodType,
): PartPlan {
  const found = lookupPart(parts, ref, blockName);
  if (!found.ok) return refuse(found.message);
  const { decl } = found;
  if (decl.kind !== 'list' && decl.kind !== 'item') {
    return refuse(`"${ref.part}" is a ${decl.kind} part, not a list · send a list or item part`);
  }
  const pattern = typeof decl.bind === 'string' ? decl.bind : undefined;
  if (pattern === undefined) return refuse(`"${ref.part}" has no list binding · fix the block's parts declaration`);
  const listPattern = decl.kind === 'item' ? pattern.slice(0, -2) : pattern;
  const outerStars = listPattern.split('.').filter((segment) => segment === '*').length;
  const listPath = bindPathOf({ ...decl, bind: listPattern }, ref.index.slice(0, outerStars));
  if (listPath === undefined) {
    return refuse(`"${ref.part}" needs ${String(outerStars)} outer index value(s) · send the enclosing item index`);
  }
  const problem = checkIndices(node.props, listPath);
  if (problem !== undefined) return refuse(`${problem} · send an index inside the list`);
  const stored = getAtPropPath(node.props, listPath);
  if (stored !== undefined && !Array.isArray(stored)) {
    return refuse(`"${listPath.join('.')}" is not a list · fix the stored value first`);
  }
  const items = (stored ?? []) as readonly JsonValue[];
  const count = items.length;
  const inRange = (at: number, max: number): boolean => Number.isInteger(at) && at >= 0 && at < max;
  let next: JsonValue[];

  switch (op.kind) {
    case 'add': {
      if (!Number.isInteger(op.at) || op.at < 0 || op.at > count) {
        return refuse(`position ${String(op.at)} is outside the list (0–${String(count)}) · send a position inside it`);
      }
      const neighbour = items[op.at - 1] ?? items[op.at];
      const defaults = defaultItem(itemSchema);
      /* An all-optional item schema "defaults" to `{}`: a copy of a real neighbour reads better. */
      const emptyDefaults =
        typeof defaults === 'object' && defaults !== null && Object.keys(defaults).length === 0;
      const item =
        op.item ??
        (neighbour !== undefined && (defaults === undefined || emptyDefaults)
          ? cloneJson(neighbour)
          : defaults);
      if (item === undefined) {
        return refuse('the list is empty and the item has no defaults · send the new item');
      }
      next = [...items.slice(0, op.at), item, ...items.slice(op.at)];
      break;
    }
    case 'duplicate': {
      const source = items[op.at];
      if (!inRange(op.at, count) || source === undefined) {
        return refuse(`item ${String(op.at + 1)} does not exist (the list has ${String(count)}) · send an index inside the list`);
      }
      next = [...items.slice(0, op.at + 1), cloneJson(source), ...items.slice(op.at + 1)];
      break;
    }
    case 'remove': {
      if (!inRange(op.at, count)) {
        return refuse(`item ${String(op.at + 1)} does not exist (the list has ${String(count)}) · send an index inside the list`);
      }
      next = items.filter((_, at) => at !== op.at);
      break;
    }
    case 'move': {
      if (!inRange(op.from, count) || !inRange(op.to, count)) {
        return refuse(`a move needs two positions inside the list (0–${String(count - 1)}) · send from and to inside it`);
      }
      next = [...items];
      const [moved] = next.splice(op.from, 1);
      if (moved !== undefined) next.splice(op.to, 0, moved);
      break;
    }
  }

  const step = stepAt(node, listPath, next);
  if (step === undefined) return refuse(`"${ref.part}" has an unusable bind · fix the block's parts declaration`);
  return { ok: true, steps: [step], label: label(LIST_ACTIONS[op.kind], blockName) };
}

type StoredPartStyles = Record<string, Record<string, JsonValue>>;

function storedPartStyles(node: Node, key: string): StoredPartStyles {
  const raw = Object.hasOwn(node.props, key) ? node.props[key] : undefined;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const styles: StoredPartStyles = {};
  for (const [styleKey, entry] of Object.entries(raw)) {
    if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
      styles[styleKey] = { ...entry };
    }
  }
  return styles;
}

/* The next partStyles record with one entry's field set (or removed when empty). */
function withEntryField(
  styles: StoredPartStyles,
  styleKey: string,
  field: 'className' | 'dir',
  value: string | undefined,
): StoredPartStyles {
  const entry = { ...(styles[styleKey] ?? {}) };
  if (value === undefined || value === '') delete entry[field];
  else entry[field] = value;
  const next = { ...styles };
  if (Object.keys(entry).length === 0) delete next[styleKey];
  else next[styleKey] = entry;
  return next;
}

/**
 * Apply style intents to one part through the style engine in `tokens` mode
 * (the same law as a block's `className`), writing `partStyles[key].className`.
 * `scope: 'this'` styles one instance of a repeated part; `all` styles every one.
 */
export function planPartStyle(
  node: Node,
  propsSchema: z.ZodType,
  ref: PartRef,
  scope: 'all' | 'this',
  intents: readonly StyleIntent[],
  blockName: string,
): PartPlan {
  if (intents.length === 0) return refuse('no style change was given · send at least one property and value');
  const key = partStylesKeyOf(propsSchema);
  if (key === undefined) {
    return refuse(`${blockName} has no partStyles prop · add partStyles: partStylesProp() to its schema`);
  }
  const styles = storedPartStyles(node, key);
  const styleKey = partStyleKey(ref, scope);
  const current = styles[styleKey]?.['className'];
  const applied = applyStyleIntents(typeof current === 'string' ? current : '', intents, { mode: 'tokens' });
  if (!applied.ok) {
    return refuse(
      applied.message.includes(' · ')
        ? applied.message
        : `${applied.message} · send a theme token or a scale step`,
    );
  }
  const properties = [...new Set(intents.map((intent) => intent.property))];
  const first = properties[0];
  const action = properties.length === 1 && first !== undefined ? STYLE_PROPERTIES[first].labels.en : 'Style';
  const next = withEntryField(styles, styleKey, 'className', applied.className);
  return {
    ok: true,
    steps: [{ command: 'setProp', args: { id: node.id, key, value: next } }],
    label: label(action, elementName(blockName, scope === 'this' ? ref : { part: ref.part, index: [] })),
  };
}

/**
 * Set or clear one part instance's direction override (`partStyles[key].dir`).
 * `null` returns the part to its default (`auto` for text, rich and link).
 */
export function planPartDir(
  node: Node,
  propsSchema: z.ZodType,
  ref: PartRef,
  dir: 'auto' | 'ltr' | 'rtl' | null,
  blockName: string,
): PartPlan {
  const key = partStylesKeyOf(propsSchema);
  if (key === undefined) {
    return refuse(`${blockName} has no partStyles prop · add partStyles: partStylesProp() to its schema`);
  }
  const styles = storedPartStyles(node, key);
  const next = withEntryField(styles, partStyleKey(ref, 'this'), 'dir', dir ?? undefined);
  return {
    ok: true,
    steps: [{ command: 'setProp', args: { id: node.id, key, value: next } }],
    label: label('Direction', elementName(blockName, ref)),
  };
}
