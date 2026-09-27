import {
  CUSTOM_CODE_ATTRIBUTES,
  findRejectedUtilities,
  isCustomCodeTag,
  isLucideIconName,
  unknownUtilityClasses,
} from '@craftkit/builder-schema';

import { isTreeMarkup, parseTreeMarkup } from './tree-markup';

/**
 * What a normalization changed in the trees a plan writes.
 *
 * Nothing is invented: a normalized plan is the model's plan with what could
 * never render removed, and with what the tree vocabulary spells differently
 * respelled — so the door judges what the model meant, and a person is never
 * shown less than the model actually produced.
 */
export interface AiPlanNormalization {
  /** The plan with cleaned trees, or the very same value when nothing changed. */
  readonly plan: unknown;
  /** Class names removed because no CSS exists for them, in the order found. */
  readonly removedClasses: readonly string[];
  /** Icon names removed because the Lucide set has no such icon. */
  readonly removedIcons: readonly string[];
  /** Every other change, one short phrase each ("form → div", "dropped input"). */
  readonly adjustments: readonly string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface Changes {
  readonly classes: string[];
  readonly icons: string[];
  readonly adjustments: string[];
}

/*
  The tree vocabulary has no forms, media or embeds — on purpose (see
  custom-code-tree.ts): a control no handler is wired to is a control that
  lies. A model writing a contact section reaches for a form anyway, and on
  2026-09-27 that refused the whole section as "Invalid input". So what the
  vocabulary cannot hold is mapped to the nearest thing it can: controls and
  embeds are dropped with their content, phrasing tags become their
  vocabulary spelling or a span, and any other container becomes a div, so
  its content survives in place.
*/
const DROPPED_TAGS = new Set([
  'area',
  'audio',
  'canvas',
  'datalist',
  'dialog',
  'embed',
  'iframe',
  'input',
  'link',
  'map',
  'meta',
  'meter',
  'noscript',
  'object',
  'optgroup',
  'option',
  'progress',
  'script',
  'select',
  'source',
  'style',
  'svg',
  'template',
  'textarea',
  'track',
  'video',
]);

const RESPELLED_TAGS: Readonly<Record<string, string>> = { b: 'strong', i: 'em' };

const PHRASING_TAGS = new Set([
  'abbr',
  'bdi',
  'bdo',
  'big',
  'cite',
  'data',
  'del',
  'dfn',
  'ins',
  'kbd',
  'label',
  'legend',
  'mark',
  'output',
  'q',
  's',
  'samp',
  'u',
  'var',
]);

const ELEMENT_KEYS = new Set(['kind', 'tag', 'className', 'text', 'attributes', 'children']);
const ICON_KEYS = new Set(['kind', 'name', 'className', 'size', 'strokeWidth', 'label']);
const ATTRIBUTES = new Set<string>(CUSTOM_CODE_ATTRIBUTES);

/** The className with every unusable class removed; undefined when none is left. */
function usableClasses(
  className: string,
  colourPolicy: 'free' | 'tokens',
  changes: Changes,
): string | undefined {
  const unknown = new Set(unknownUtilityClasses(className));
  const kept: string[] = [];
  for (const name of className.split(/\s+/u)) {
    if (name === '') continue;
    const unusable =
      unknown.has(name) || (colourPolicy === 'tokens' && findRejectedUtilities(name).length > 0);
    if (unusable) changes.classes.push(name);
    else kept.push(name);
  }
  return kept.length === 0 ? undefined : kept.join(' ');
}

/** A tag the vocabulary admits, the tag it maps to, or null when the element must go. */
function vocabularyTag(tag: string): string | null {
  const lower = tag.toLowerCase();
  if (isCustomCodeTag(lower)) return lower;
  if (DROPPED_TAGS.has(lower)) return null;
  return RESPELLED_TAGS[lower] ?? (PHRASING_TAGS.has(lower) ? 'span' : 'div');
}

function clamp(value: unknown, min: number, max: number, integer: boolean): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const bounded = Math.min(max, Math.max(min, value));
  return integer ? Math.round(bounded) : bounded;
}

/** An element's attributes, keeping the ones the vocabulary admits, as strings. */
function vocabularyAttributes(node: JsonRecord, changes: Changes): unknown {
  const original = node['attributes'];
  const attributes: Record<string, string> = {};
  let changed = original !== undefined && !isRecord(original);
  const source: JsonRecord = isRecord(original) ? original : {};
  for (const [name, value] of Object.entries(source)) {
    if (!ATTRIBUTES.has(name) || (typeof value !== 'string' && typeof value !== 'number')) {
      changes.adjustments.push(`dropped attribute ${name}`);
      changed = true;
      continue;
    }
    if (typeof value === 'number') changed = true;
    attributes[name] = String(value);
  }
  // An attribute written beside `tag` instead of inside `attributes`, moved in.
  for (const [name, value] of Object.entries(node)) {
    if (ELEMENT_KEYS.has(name) || !ATTRIBUTES.has(name)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    attributes[name] ??= String(value);
    changes.adjustments.push(`moved ${name} into attributes`);
    changed = true;
  }
  if (!changed) return original;
  return Object.keys(attributes).length === 0 ? undefined : attributes;
}

function cleanIcon(node: JsonRecord, colourPolicy: 'free' | 'tokens', changes: Changes): unknown {
  const name = node['name'];
  if (typeof name === 'string' && !isLucideIconName(name)) {
    changes.icons.push(name);
    return undefined;
  }
  const next: JsonRecord = { kind: 'icon', name };
  if (typeof node['className'] === 'string') {
    const usable = usableClasses(node['className'], colourPolicy, changes);
    if (usable !== undefined) next['className'] = usable;
  }
  const size = clamp(node['size'], 8, 256, true);
  if (size !== undefined) next['size'] = size;
  const strokeWidth = clamp(node['strokeWidth'], 0.5, 4, false);
  if (strokeWidth !== undefined) next['strokeWidth'] = strokeWidth;
  if (typeof node['label'] === 'string') next['label'] = node['label'].slice(0, 120);
  for (const key of Object.keys(node)) {
    if (!ICON_KEYS.has(key)) changes.adjustments.push(`dropped icon key ${key}`);
  }
  return sameRecord(node, next) ? node : next;
}

function cleanElement(
  node: JsonRecord,
  colourPolicy: 'free' | 'tokens',
  changes: Changes,
): unknown {
  const rawTag = node['tag'];
  if (typeof rawTag !== 'string') return node;
  const tag = vocabularyTag(rawTag);
  if (tag === null) {
    changes.adjustments.push(`dropped ${rawTag}`);
    return undefined;
  }
  if (tag !== rawTag) changes.adjustments.push(`${rawTag} → ${tag}`);
  const next: JsonRecord = { kind: 'element', tag };
  if (typeof node['className'] === 'string') {
    const usable = usableClasses(node['className'], colourPolicy, changes);
    if (usable !== undefined) next['className'] = usable;
  }
  const text = node['text'];
  if (typeof text === 'string' || typeof text === 'number') next['text'] = String(text);
  const attributes = vocabularyAttributes(node, changes);
  if (attributes !== undefined) next['attributes'] = attributes;
  const children = node['children'];
  if (Array.isArray(children)) {
    next['children'] = cleanChildren(children as unknown[], colourPolicy, changes);
  }
  for (const key of Object.keys(node)) {
    if (!ELEMENT_KEYS.has(key) && !ATTRIBUTES.has(key)) {
      changes.adjustments.push(`dropped element key ${key}`);
    }
  }
  return sameRecord(node, next) ? node : next;
}

/** One node, brought into the vocabulary; undefined when it cannot render and must go. */
function cleanNode(node: unknown, colourPolicy: 'free' | 'tokens', changes: Changes): unknown {
  if (!isRecord(node)) return node;
  const kind = node['kind'];
  if (kind === 'icon') return cleanIcon(node, colourPolicy, changes);
  if (kind === 'element') return cleanElement(node, colourPolicy, changes);
  // A node with a tag and no kind is an element the model forgot to label.
  if (kind === undefined && typeof node['tag'] === 'string') {
    changes.adjustments.push('labelled a node element');
    return cleanElement({ ...node, kind: 'element' }, colourPolicy, changes) ?? undefined;
  }
  // A text node the vocabulary has no kind for is a span carrying the text.
  if (kind === 'text' && (typeof node['text'] === 'string' || typeof node['text'] === 'number')) {
    changes.adjustments.push('text node → span');
    return { kind: 'element', tag: 'span', text: String(node['text']) };
  }
  // A root or a component reference: only its children are this function's business.
  const children = node['children'];
  if (!Array.isArray(children)) return node;
  const cleaned = cleanChildren(children as unknown[], colourPolicy, changes);
  return cleaned === children ? node : { ...node, children: cleaned };
}

function cleanChildren(
  children: unknown[],
  colourPolicy: 'free' | 'tokens',
  changes: Changes,
): unknown[] {
  let changed = false;
  const cleaned: unknown[] = [];
  for (const child of children) {
    const next = cleanNode(child, colourPolicy, changes);
    if (next !== child) changed = true;
    if (next !== undefined) cleaned.push(next);
  }
  return changed ? cleaned : children;
}

/** Whether a rebuilt node says exactly what the original said, so the original is kept. */
function sameRecord(original: JsonRecord, rebuilt: JsonRecord): boolean {
  const keys = Object.keys(original);
  if (keys.length !== Object.keys(rebuilt).length) return false;
  return keys.every((key) => rebuilt[key] === original[key]);
}

/** Any value in a command's args, with every custom-code tree inside it cleaned. */
function cleanArgs(value: unknown, colourPolicy: 'free' | 'tokens', changes: Changes): unknown {
  if (Array.isArray(value)) {
    const items = value as unknown[];
    const cleaned = items.map((item) => cleanArgs(item, colourPolicy, changes));
    return cleaned.some((item, index) => item !== items[index]) ? cleaned : value;
  }
  if (!isRecord(value)) return value;
  // A tree is recognised by its shape, wherever the args put it (see validate-plan).
  if (value['kind'] === 'root' && Array.isArray(value['children'])) {
    return cleanNode(value, colourPolicy, changes);
  }
  let changed = false;
  const next: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    // A tree prop written as markup (insertNode props.tree) is read into a tree first.
    const source = key === 'tree' && isTreeMarkup(child) ? markupTree(child, changes) : child;
    const cleaned = cleanArgs(source, colourPolicy, changes);
    if (cleaned !== child) changed = true;
    next[key] = cleaned;
  }
  return changed ? next : value;
}

function markupTree(markup: string, changes: Changes): unknown {
  changes.adjustments.push('read tree markup');
  return parseTreeMarkup(markup);
}

/** A setProp of a tree written as markup, with the markup read into the tree. */
function readSetPropMarkup(step: unknown, changes: Changes): unknown {
  if (!isRecord(step) || step['command'] !== 'setProp' || !isRecord(step['args'])) return step;
  const args = step['args'];
  if (args['key'] !== 'tree' || !isTreeMarkup(args['value'])) return step;
  return { ...step, args: { ...args, value: markupTree(args['value'], changes) } };
}

const SET_PROP_ARGS = new Set(['id', 'key', 'value']);

/**
 * One `setProp` per prop. A section writer that styles `ck-` classes writes
 * the region's `css` in the same breath as its tree, and measured 2026-09-27
 * it did so as a `css` key INSIDE the tree's setProp in 3 of 20 broken
 * answers — refused whole, because setProp takes exactly id, key and value.
 * The intent is unambiguous, so each extra key becomes its own setProp on
 * the same node, in place.
 */
function splitSetProp(changes: Changes): (step: unknown) => unknown[] {
  return (step) => {
    if (!isRecord(step) || step['command'] !== 'setProp' || !isRecord(step['args'])) return [step];
    const args = step['args'];
    const id = args['id'];
    const extras = Object.keys(args).filter((key) => !SET_PROP_ARGS.has(key));
    if (typeof id !== 'string' || typeof args['key'] !== 'string' || extras.length === 0) {
      return [step];
    }
    changes.adjustments.push(...extras.map((key) => `split ${key} into its own setProp`));
    return [
      { ...step, args: { id, key: args['key'], value: args['value'] } },
      ...extras.map((key) => ({ command: 'setProp', args: { id, key, value: args[key] } })),
    ];
  };
}

/**
 * Bring the trees a plan writes into the tree vocabulary, before the door.
 *
 * Measured 2026-09-27: one ordinary Tailwind class the site vocabulary did
 * not generate (`border-emerald-900/20`) sent a finished section back to the
 * model for a repair round of 25-40 seconds, and a contact section refused
 * whole as "Invalid input" for carrying a form. A class with no CSS renders as
 * nothing, an unknown icon as a placeholder and a form control as a lie, so
 * removing or respelling them loses nothing the page could have shown, while
 * refusing the plan lost the whole section. The door still refuses what this
 * cannot fix: a component that does not exist, a node a plan cannot reach.
 */
export function normalizeAiPlanTrees(
  candidate: unknown,
  colourPolicy: 'free' | 'tokens' = 'free',
): AiPlanNormalization {
  const changes: Changes = { classes: [], icons: [], adjustments: [] };
  if (!isRecord(candidate) || !Array.isArray(candidate['commands'])) {
    return { plan: candidate, removedClasses: [], removedIcons: [], adjustments: [] };
  }
  const commands = candidate['commands'] as unknown[];
  const cleaned = commands.flatMap(splitSetProp(changes)).map((original) => {
    const step = readSetPropMarkup(original, changes);
    if (!isRecord(step)) return step;
    const args = cleanArgs(step['args'], colourPolicy, changes);
    return args === step['args'] ? step : { ...step, args };
  });
  const changed =
    cleaned.length !== commands.length || cleaned.some((step, index) => step !== commands[index]);
  return {
    plan: changed ? { ...candidate, commands: cleaned } : candidate,
    removedClasses: changes.classes,
    removedIcons: changes.icons,
    adjustments: changes.adjustments,
  };
}
