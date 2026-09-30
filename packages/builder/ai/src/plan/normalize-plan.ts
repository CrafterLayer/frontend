import {
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeTagSpelling,
  findRejectedUtilities,
  isCustomCodeSvgTag,
  isLucideIconName,
  unknownUtilityClasses,
} from '@craftkit/builder-schema';

import { COMPONENT_MARKUP_TAG, isTreeMarkup, parseTreeMarkup } from './tree-markup';

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
  /**
   * Icon names the Lucide set does not have, in the order found. Each was
   * replaced by the nearest name the set has (`tooth-sparkle` → `sparkle`),
   * else by `sparkles`, and the swap is also listed in `adjustments`.
   */
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
  /** Registered block types, lower-cased as markup tags arrive. */
  readonly blockTags: ReadonlySet<string>;
}

/*
  The tree vocabulary has no forms, sound or embeds — on purpose (see
  custom-code-tree.ts): a control no handler is wired to is a control that
  lies. A model writing a contact section reaches for a form anyway, and on
  2026-09-27 that refused the whole section as "Invalid input". So what the
  vocabulary cannot hold is mapped to the nearest thing it can: controls and
  embeds are dropped with their content, phrasing tags become a span, and any
  other container becomes a div, so its content survives in place.

  Video, picture/source, svg shapes, tables, details and the phrasing tags
  (b, i, s, mark, cite, q, abbr) joined the vocabulary on 2026-09-28 and are
  kept as written now — before, `b` became `strong` and a video vanished.

  One exception: a tag that NAMES a registered block (`<contact>`, and the
  `ck-component` spelling itself should it ever arrive as an element) is a
  model reaching for that block, not for a box. As a div it rendered as an
  empty box with no error anywhere; left as written, the door refuses it by
  name and the repair round learns to write `<ck-component type='contact'>`.
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
  'style',
  'template',
  'textarea',
  'track',
]);

const PHRASING_TAGS = new Set([
  'bdi',
  'bdo',
  'big',
  'data',
  'del',
  'dfn',
  'ins',
  'kbd',
  'label',
  'legend',
  'output',
  'samp',
  'u',
  'var',
]);

const ELEMENT_KEYS = new Set(['kind', 'tag', 'className', 'text', 'attributes', 'children']);
const ICON_KEYS = new Set(['kind', 'name', 'className', 'size', 'strokeWidth', 'label']);

/** Attributes whose presence is the value: `false` means absent, `true` means bare. */
const BOOLEAN_ATTRIBUTES = new Set([
  'open',
  'autoplay',
  'muted',
  'loop',
  'playsinline',
  'controls',
]);
/** Shapes that are complete in themselves: nothing drawn inside a path or a stop. */
const SVG_LEAF_SHAPES = new Set([
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'stop',
]);
const SOURCE_PARENTS = new Set(['picture', 'video']);

/*
  A phone number is a left-to-right run, and inside a right-to-left line an
  unisolated one reads backwards: final test 2026-09-29, a writer's delivery
  card on an Arabic page showed "+962 7 9000 0000" as "0000 9000 7 962+". The
  skeleton isolates the numbers it writes (skeleton-from-plan contactLine); a
  writer's text did not. So each phone-shaped run is wrapped in Unicode
  isolates (LRI … PDI): invisible, a no-op in a left-to-right line — which is
  why this needs no page direction — and in a right-to-left one the digits
  stay in the order they are dialled.

  Phone-shaped is the page checker's reading (check-section phoneRuns): it
  starts with +, ( or 0 and holds seven digits or more, so a price (commas) or
  a year never qualifies. A spaced dash is a range ("08.00 - 22.00"), which a
  right-to-left reader reads from the right, so it is left alone. A text that
  already carries a bidi isolate was isolated by whoever wrote it.
*/
const DIGIT = '0-9\\u0660-\\u0669\\u06F0-\\u06F9';
const PHONE_RUN = new RegExp(`\\(?\\+?[${DIGIT}][${DIGIT} ().-]{5,}[${DIGIT}]`, 'gu');
const PHONE_START = /^[+(0٠۰]/u;
const ANY_DIGIT = new RegExp(`[${DIGIT}]`, 'gu');
const BIDI_ISOLATE = /[⁦-⁩]/u;
const LTR_ISOLATE = '⁦';
const POP_ISOLATE = '⁩';

/** The text with each phone-shaped run isolated left-to-right; the same string when none is. */
function isolatePhoneRuns(text: string): string {
  if (BIDI_ISOLATE.test(text)) return text;
  return text.replace(PHONE_RUN, (run) =>
    PHONE_START.test(run) && !run.includes(' - ') && (run.match(ANY_DIGIT)?.length ?? 0) >= 7
      ? `${LTR_ISOLATE}${run}${POP_ISOLATE}`
      : run,
  );
}

/** An element's or text node's words, phone numbers isolated, the change noted. */
function isolatedText(text: string, changes: Changes): string {
  const isolated = isolatePhoneRuns(text);
  if (isolated !== text) changes.adjustments.push('isolated a phone number');
  return isolated;
}

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

/**
 * A tag the vocabulary admits, the tag it maps to, or null when the element
 * must go. A tag naming a registered block is returned as written, for the
 * door to refuse (see above).
 *
 * Inside a drawing only shapes render: an svg `use`, `image`, `text`,
 * `title` or `foreignObject` — or any html tag — can never draw there, and
 * a shape outside an svg draws nothing either, so both go whole.
 */
function vocabularyTag(
  tag: string,
  blockTags: ReadonlySet<string>,
  parentTag: string | undefined,
): string | null {
  const lower = tag.toLowerCase();
  const inSvg = parentTag !== undefined && isCustomCodeSvgTag(parentTag);
  const spelled = customCodeTagSpelling(lower);
  if (spelled !== undefined) {
    const svg = isCustomCodeSvgTag(spelled);
    if (inSvg ? !svg : svg && spelled !== 'svg') return null;
    return spelled;
  }
  if (inSvg) return null;
  if (lower === COMPONENT_MARKUP_TAG || blockTags.has(lower)) return tag;
  if (DROPPED_TAGS.has(lower)) return null;
  return PHRASING_TAGS.has(lower) ? 'span' : 'div';
}

function clamp(value: unknown, min: number, max: number, integer: boolean): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const bounded = Math.min(max, Math.max(min, value));
  return integer ? Math.round(bounded) : bounded;
}

/**
 * One attribute value as the door takes it, or undefined when it cannot
 * stand: a number as its string, a boolean attribute's `true` bare and its
 * `false` absent, an html `width='600px'` as `600`.
 */
function attributeValue(tag: string, name: string, value: unknown): string | undefined {
  if (typeof value === 'boolean') return BOOLEAN_ATTRIBUTES.has(name) && value ? '' : undefined;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const written = String(value);
  if (BOOLEAN_ATTRIBUTES.has(name) && written.toLowerCase() === 'false') return undefined;
  if ((name === 'width' || name === 'height') && !isCustomCodeSvgTag(tag)) {
    return written.trim().replace(/(?<=\d)px$/u, '');
  }
  return written;
}

/**
 * An element's attributes, keeping the ones the vocabulary admits on this
 * tag, spelled as it spells them. An attribute the door would refuse HERE —
 * a popover target on a link (HTML opens popovers from buttons only), a
 * width on a div, a srcset over http — can never do what it says, so it is
 * dropped rather than costing the section a repair round.
 */
function vocabularyAttributes(node: JsonRecord, tag: string, changes: Changes): unknown {
  const original = node['attributes'];
  const attributes: Record<string, string> = {};
  let changed = original !== undefined && !isRecord(original);
  /** Keep one attribute: `same` when it stands exactly as written, `kept` respelled, `dropped`. */
  const keep = (written: string, value: unknown): 'same' | 'kept' | 'dropped' => {
    const name = customCodeAttributeSpelling(written);
    const kept = name === undefined ? undefined : attributeValue(tag, name, value);
    if (name === undefined || kept === undefined) {
      changes.adjustments.push(`dropped attribute ${written}`);
      return 'dropped';
    }
    const problem = customCodeAttributeProblem(tag, name, kept);
    if (problem !== undefined) {
      changes.adjustments.push(`dropped attribute ${name}: ${problem}`);
      return 'dropped';
    }
    // `srcSet` beside `srcset`: the first spelling wins, as a browser keeps the first.
    if (Object.hasOwn(attributes, name)) {
      changes.adjustments.push(`dropped repeated attribute ${written}`);
      return 'dropped';
    }
    attributes[name] = kept;
    if (name !== written) changes.adjustments.push(`${written} → ${name}`);
    return name === written && kept === value ? 'same' : 'kept';
  };
  const source: JsonRecord = isRecord(original) ? original : {};
  for (const [name, value] of Object.entries(source)) {
    if (keep(name, value) !== 'same') changed = true;
  }
  // An attribute written beside `tag` instead of inside `attributes`, moved in.
  for (const [name, value] of Object.entries(node)) {
    if (ELEMENT_KEYS.has(name) || customCodeAttributeSpelling(name) === undefined) continue;
    if (keep(name, value) !== 'dropped') changes.adjustments.push(`moved ${name} into attributes`);
    changed = true;
  }
  /*
    A video that plays by itself plays muted — the door refuses it otherwise,
    and the renderer mutes it anyway. The model meant a silent backdrop.
  */
  if (
    tag === 'video' &&
    Object.hasOwn(attributes, 'autoplay') &&
    !Object.hasOwn(attributes, 'muted')
  ) {
    attributes['muted'] = '';
    changes.adjustments.push('muted the autoplaying video');
    changed = true;
  }
  if (!changed) return original;
  return Object.keys(attributes).length === 0 ? undefined : attributes;
}

/**
 * The icon drawn in place of one the Lucide set lacks.
 *
 * Final test 2026-09-30: a clinic's services row lost the icon on its last
 * item — the writer asked for `tooth`, which the set does not have, and this
 * pass removed it, so one card of four stood bare. Dropping loses the row's
 * rhythm; a near name keeps it. Longest run of the name's own words first
 * (`tooth-sparkle` → `sparkle`), then a neutral mark.
 */
const FALLBACK_ICON = 'sparkles';

function nearestIconName(name: string): string {
  const words = name.toLowerCase().split(/[^a-z0-9]+/u).filter((word) => word.length > 0);
  for (let length = words.length; length >= 1; length -= 1) {
    for (let start = 0; start + length <= words.length; start += 1) {
      const candidate = words.slice(start, start + length).join('-');
      if (isLucideIconName(candidate)) return candidate;
    }
  }
  return FALLBACK_ICON;
}

function cleanIcon(node: JsonRecord, colourPolicy: 'free' | 'tokens', changes: Changes): unknown {
  const written = node['name'];
  let name = written;
  if (typeof written === 'string' && !isLucideIconName(written)) {
    name = nearestIconName(written);
    changes.icons.push(written);
    changes.adjustments.push(`icon ${written} → ${String(name)}`);
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
  parentTag: string | undefined,
): unknown {
  const rawTag = node['tag'];
  if (typeof rawTag !== 'string') return node;
  const tag = vocabularyTag(rawTag, changes.blockTags, parentTag);
  if (tag === null) {
    changes.adjustments.push(`dropped ${rawTag}`);
    return undefined;
  }
  // A source only means something inside a picture or a video; anywhere else it is inert.
  if (tag === 'source' && (parentTag === undefined || !SOURCE_PARENTS.has(parentTag))) {
    changes.adjustments.push('dropped source outside picture or video');
    return undefined;
  }
  if (tag !== rawTag) changes.adjustments.push(`${rawTag} → ${tag}`);
  const svg = isCustomCodeSvgTag(tag);
  const next: JsonRecord = { kind: 'element', tag };
  if (typeof node['className'] === 'string') {
    const usable = usableClasses(node['className'], colourPolicy, changes);
    if (usable !== undefined) next['className'] = usable;
  }
  let attributes = vocabularyAttributes(node, tag, changes);
  /*
    A bdi isolates its words (dir=auto); the span it becomes does so only with
    a dir of its own — without one, the name a writer isolated in an Arabic
    line would reorder again.
  */
  if (
    rawTag.toLowerCase() === 'bdi' &&
    !(isRecord(attributes) && typeof attributes['dir'] === 'string')
  ) {
    attributes = { ...(isRecord(attributes) ? attributes : {}), dir: 'auto' };
    changes.adjustments.push("kept bdi's isolation as dir='auto'");
  }
  const text = node['text'];
  if (typeof text === 'string' || typeof text === 'number') {
    // A shape draws; it holds no words (an svg `text` is not in the vocabulary).
    if (svg && String(text).trim() !== '') changes.adjustments.push(`dropped text in ${tag}`);
    else if (!svg) {
      // An element already set left-to-right isolates its own words.
      const ownLtr = isRecord(attributes) && attributes['dir'] === 'ltr';
      next['text'] = ownLtr ? String(text) : isolatedText(String(text), changes);
    }
  }
  if (attributes !== undefined) next['attributes'] = attributes;
  const children = node['children'];
  if (Array.isArray(children)) {
    if (SVG_LEAF_SHAPES.has(tag)) {
      if (children.length > 0) changes.adjustments.push(`dropped what was drawn inside ${tag}`);
    } else {
      next['children'] = cleanChildren(children as unknown[], colourPolicy, changes, tag);
    }
  }
  for (const key of Object.keys(node)) {
    if (!ELEMENT_KEYS.has(key) && customCodeAttributeSpelling(key) === undefined) {
      changes.adjustments.push(`dropped element key ${key}`);
    }
  }
  return sameRecord(node, next) ? node : next;
}

/**
 * One node, brought into the vocabulary; undefined when it cannot render and
 * must go. `parentTag` is the tag of the element holding it (undefined at the
 * root and under a component): a drawing holds only shapes, so an icon, a
 * component or a text node inside an svg goes whole.
 */
function cleanNode(
  node: unknown,
  colourPolicy: 'free' | 'tokens',
  changes: Changes,
  parentTag: string | undefined,
): unknown {
  if (!isRecord(node)) return node;
  const kind = node['kind'];
  const inSvg = parentTag !== undefined && isCustomCodeSvgTag(parentTag);
  if (inSvg && kind !== 'element' && !(kind === undefined && typeof node['tag'] === 'string')) {
    changes.adjustments.push(
      `dropped ${typeof kind === 'string' ? kind : 'node'} inside ${parentTag}`,
    );
    return undefined;
  }
  if (kind === 'icon') return cleanIcon(node, colourPolicy, changes);
  if (kind === 'element') return cleanElement(node, colourPolicy, changes, parentTag);
  // A node with a tag and no kind is an element the model forgot to label.
  if (kind === undefined && typeof node['tag'] === 'string') {
    changes.adjustments.push('labelled a node element');
    return (
      cleanElement({ ...node, kind: 'element' }, colourPolicy, changes, parentTag) ?? undefined
    );
  }
  // A text node the vocabulary has no kind for is a span carrying the text.
  if (kind === 'text' && (typeof node['text'] === 'string' || typeof node['text'] === 'number')) {
    changes.adjustments.push('text node → span');
    return { kind: 'element', tag: 'span', text: isolatedText(String(node['text']), changes) };
  }
  // A root or a component reference: only its children are this function's business.
  const children = node['children'];
  if (!Array.isArray(children)) return node;
  const cleaned = cleanChildren(children as unknown[], colourPolicy, changes, undefined);
  return cleaned === children ? node : { ...node, children: cleaned };
}

function cleanChildren(
  children: unknown[],
  colourPolicy: 'free' | 'tokens',
  changes: Changes,
  parentTag: string | undefined,
): unknown[] {
  let changed = false;
  const cleaned: unknown[] = [];
  for (const child of children) {
    const next = cleanNode(child, colourPolicy, changes, parentTag);
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
    return cleanNode(value, colourPolicy, changes, undefined);
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

/** Any value in a command's args, with every `tree` prop written as markup read into a tree. */
function readArgsMarkup(value: unknown, changes: Changes): unknown {
  if (Array.isArray(value)) {
    const items = value as unknown[];
    const read = items.map((item) => readArgsMarkup(item, changes));
    return read.some((item, index) => item !== items[index]) ? read : value;
  }
  if (!isRecord(value) || value['kind'] === 'root') return value;
  let changed = false;
  const next: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    const read =
      key === 'tree' && isTreeMarkup(child)
        ? markupTree(child, changes)
        : readArgsMarkup(child, changes);
    if (read !== child) changed = true;
    next[key] = read;
  }
  return changed ? next : value;
}

/**
 * Only the markup reading of `normalizeAiPlanTrees`: every tree a plan writes
 * as markup, read into the tree, and nothing else cleaned.
 *
 * The context tells the model to write trees as markup on every run
 * (assemble-context sets `treeMarkup`), so reading it cannot depend on the
 * host's vocabulary policy: a host with `enforceUtilityVocabulary: false`
 * skipped normalization, and every tree reached the door as a string and was
 * refused — the repair round asked for markup again, and failed the same way.
 */
export function readAiPlanTreeMarkup(candidate: unknown): unknown {
  if (!isRecord(candidate) || !Array.isArray(candidate['commands'])) return candidate;
  const changes: Changes = { classes: [], icons: [], adjustments: [], blockTags: new Set() };
  const commands = candidate['commands'] as unknown[];
  const read = commands.map((original) => {
    const step = readSetPropMarkup(original, changes);
    if (!isRecord(step)) return step;
    const args = readArgsMarkup(step['args'], changes);
    return args === step['args'] ? step : { ...step, args };
  });
  return read.some((step, index) => step !== commands[index])
    ? { ...candidate, commands: read }
    : candidate;
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
  /** Registered block types: a tag naming one is left for the door, never made a div. */
  blockTypes: Iterable<string> = [],
): AiPlanNormalization {
  const changes: Changes = {
    classes: [],
    icons: [],
    adjustments: [],
    blockTags: new Set([...blockTypes].map((type) => type.toLowerCase())),
  };
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
