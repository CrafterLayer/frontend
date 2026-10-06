import type { BuilderKernel } from '@craftkit/builder-core';

import { normalizeIntentText } from '../../intent/normalize-arabic';
import { isTreeMarkup, parseTreeMarkup } from '../../plan/tree-markup';
import { COLOUR_WORDS, colourOf, SHADE_NAMES, WHITE_WORDS } from './colour-words';
import {
  isElement,
  isRecord,
  mapTree,
  setProp,
  type TreeElementNode,
  type TreeNode,
  type TreeRoot,
} from './shared';
import type { AgentToolStep } from './types';

/**
 * ONE element's colour, with no model (colour-target fix, 2026-10-05).
 *
 * The owner typed «سارة خليها احمر لونها» ("make Sara red") on an Arabic CV.
 * No zero-token reading took it, so the model answered with `theme.apply` —
 * a page-token rewrite — and the panel said «عُدِّلت الصفحة» while the name
 * stayed ink-coloured. A colour request that names an ELEMENT, by its words
 * («سارة») or its role («العنوان», «الزر», "the heading", "the button"),
 * means that element: its className gets the colour utility, in one setProp
 * of its region's tree, through the same door as every plan.
 *
 * Only a request about the whole page («ألوان الصفحة», «اللون الأساسي»,
 * "the theme") may change page tokens; those words make this reading step
 * aside (the page-colour reading in direct-tool.ts takes them). Anything
 * short of exactly ONE confident element returns undefined, and the model
 * path runs.
 */

export interface ElementColourReading {
  readonly steps: readonly AgentToolStep[];
  readonly label: { readonly ar: string; readonly en: string };
}

// ── Words ─────────────────────────────────────────────────────────────────────

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/** Change verbs, MSA and Levantine with their object suffixes, and English. */
const VERBS: ReadonlySet<string> = new Set(
  [
    'خلي خل خلو خليه خليها خليهم خليلي خليه',
    'حط حطي حطه حطها حطلي',
    'اعمل اعملي اعمله اعملها اعمللي سوي سويه سويها سويلي',
    'صير صيري صيره صيرها صيرلي',
    'غير غيري غيره غيرها غيرلي',
    'بدل بدلي بدله بدلها بدللي',
    'اجعل اجعلي اجعله اجعلها',
    'حول حولي حوله حولها',
    'لوني لون لونلي',
    'make turn change set paint switch recolour recolor',
  ]
    .join(' ')
    .split(' '),
);

/** «لون» and its forms, with the article or a preposition: the request is about a colour. */
const COLOUR_NOUN = /^(?:و)?(?:بال|لل|ال|ب|ل)?(?:لون|لونه|لونها|لونو|لونهم|الوان)$/u;
const COLOUR_NOUN_EN: ReadonlySet<string> = new Set([
  'color',
  'colour',
  'colored',
  'coloured',
  'colors',
  'colours',
]);

/** Words that carry no target: prepositions, pronouns, "the word", "should be". */
const FILLERS: ReadonlySet<string> = new Set(
  [
    'الي الى ل لل ب على عليه عليها في فيه فيها اللي الذي التي يكون تكون يصير تصير يصبح تصبح ان من مع',
    'هو هي هاد هذا هذه هاي ده دي كلمه الكلمه نص النص اسم الاسم',
    'the a an to into in it its me my as be with of for that this text word name s should is',
  ]
    .join(' ')
    .split(' '),
);

/** The whole page or its theme: never one element. */
const PAGE_WORDS: ReadonlySet<string> = new Set(
  [
    'صفحه الصفحه للصفحه موقع الموقع للموقع ثيم الثيم براند البراند هويه الهويه خلفيه الخلفيه كل الكل كامل جميع',
    'page site website theme brand accent primary background everything all whole',
  ]
    .join(' ')
    .split(' '),
);

/** "Main"/«الأساسي»: a page colour on its own («اللون الأساسي»), a modifier beside a role («العنوان الرئيسي»). */
const MAIN_WORDS: ReadonlySet<string> = new Set([
  'رئيسي',
  'الرئيسي',
  'اساسي',
  'الاساسي',
  'main',
  'big',
  'top',
  'كبير',
  'الكبير',
]);

type Role = 'title' | 'button';

const ROLE_WORDS: ReadonlyMap<string, Role> = new Map([
  ['عنوان', 'title'],
  ['هيدنج', 'title'],
  ['هيدينج', 'title'],
  ['heading', 'title'],
  ['headline', 'title'],
  ['title', 'title'],
  ['h1', 'title'],
  ['زر', 'button'],
  ['زرار', 'button'],
  ['بتن', 'button'],
  ['بوتون', 'button'],
  ['button', 'button'],
  ['btn', 'button'],
  ['cta', 'button'],
]);

/** A word without a leading «و», a preposition, or the article: «للعنوان» → «عنوان». */
function bare(word: string): string {
  const stripped = word.replace(/^و(?=\S{3,})/u, '').replace(/^(?:بال|لل|ال|ب|ل)(?=\S{2,})/u, '');
  return stripped;
}

function roleOf(word: string): Role | undefined {
  return ROLE_WORDS.get(word) ?? ROLE_WORDS.get(bare(word));
}

function colourWord(word: string): string | undefined {
  return colourOf(word, COLOUR_WORDS) ?? colourOf(word, WHITE_WORDS);
}

interface Parsed {
  readonly shade: string;
  readonly role?: Role;
  /** The words that name the element by what it says, folded. */
  readonly name: readonly string[];
}

const MAX_NAME_WORDS = 4;

/** The request read as «colour X», or undefined when it is not exactly that. */
function parse(text: string): Parsed | undefined {
  const words = text.match(WORD) ?? [];
  if (words.length < 2 || words.length > 12) return undefined;
  const shades: string[] = [];
  const roles: Role[] = [];
  const name: string[] = [];
  let signal = false;
  let main = false;
  for (const word of words) {
    const shade = colourWord(word);
    if (shade !== undefined) {
      shades.push(shade);
      continue;
    }
    if (VERBS.has(word) || COLOUR_NOUN.test(word) || COLOUR_NOUN_EN.has(word)) {
      signal = true;
      continue;
    }
    if (PAGE_WORDS.has(word) || PAGE_WORDS.has(bare(word))) return undefined;
    if (MAIN_WORDS.has(word)) {
      main = true;
      continue;
    }
    const role = roleOf(word);
    if (role !== undefined) {
      roles.push(role);
      continue;
    }
    if (FILLERS.has(word)) continue;
    name.push(word);
  }
  // One colour, said as a change: «سارة احمر» alone is a statement, not a request.
  if (shades.length !== 1 || !signal) return undefined;
  const shade = shades[0] ?? '';
  if (roles.length > 1 || new Set(roles).size > 1) return undefined;
  const role = roles[0];
  if (role === undefined) {
    // «اللون الأساسي», "the main colour": the theme's, not an element's.
    if (main || name.length === 0 || name.length > MAX_NAME_WORDS) return undefined;
    return { shade, name };
  }
  // «زر تواصل معي», «عنوان سارة»: the role narrows, the words pick. «قسم» and friends are never said by an element.
  if (name.length > MAX_NAME_WORDS) return undefined;
  return { shade, role, name };
}

// ── The page ──────────────────────────────────────────────────────────────────

interface Spot {
  readonly regionId: string;
  readonly tree: TreeRoot;
  readonly element: TreeElementNode;
  /** Everything the element says, its descendants included. */
  readonly text: string;
  readonly depth: number;
}

function treeOf(value: unknown): TreeRoot | undefined {
  const tree = isTreeMarkup(value) ? parseTreeMarkup(value) : value;
  if (!isRecord(tree) || tree['kind'] !== 'root' || !Array.isArray(tree['children']))
    return undefined;
  return tree as unknown as TreeRoot;
}

function textOf(node: TreeNode): string {
  const own = isElement(node) && typeof node.text === 'string' ? node.text : '';
  const children = (node as { children?: readonly TreeNode[] }).children;
  const inner = Array.isArray(children) ? children.map(textOf).join(' ') : '';
  return [own, inner].filter((part) => part.trim() !== '').join(' ');
}

/** Every element of every composed region, in page order. */
function spotsOf(kernel: BuilderKernel): readonly Spot[] {
  const document = kernel.getDocument();
  const spots: Spot[] = [];
  const visit = (regionId: string, tree: TreeRoot, node: TreeNode, depth: number): void => {
    if (isElement(node)) spots.push({ regionId, tree, element: node, text: textOf(node), depth });
    const children = (node as { children?: readonly TreeNode[] }).children;
    for (const child of children ?? []) visit(regionId, tree, child, depth + 1);
  };
  const order: string[] = [];
  const walk = (id: string): void => {
    const node = document.nodes[id];
    if (node === undefined || order.includes(id)) return;
    order.push(id);
    const slots = (node as { slots?: Readonly<Record<string, readonly string[] | undefined>> }).slots ?? {};
    for (const ids of Object.values(slots)) for (const child of ids ?? []) walk(child);
  };
  walk(document.rootId);
  for (const id of order) {
    const tree = treeOf(document.nodes[id]?.props['tree']);
    if (tree === undefined) continue;
    for (const child of tree.children) visit(id, tree, child, 0);
  }
  return spots;
}

/** Folded words of a text, each also without its article. */
function wordKeys(text: string): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const word of normalizeIntentText(text).match(WORD) ?? []) {
    keys.add(word);
    keys.add(bare(word));
  }
  return keys;
}

/** Whether every named word is a word of the text (article and a leading «ل»/«ب»/«و» aside). */
function says(text: string, name: readonly string[]): boolean {
  const keys = wordKeys(text);
  return name.every((word) => keys.has(word) || keys.has(bare(word)));
}

function headingLevel(tag: string): number {
  const match = /^h([1-6])$/u.exec(tag.toLowerCase());
  return match === null ? 7 : Number(match[1]);
}

/**
 * The ONE element a set of candidates means: the only one, else the only
 * heading of the highest rank («سارة» is the h1, not the header's brand or
 * the footer's ©). Undefined when two stay equal.
 */
function onlyOne(candidates: readonly Spot[]): Spot | undefined {
  if (candidates.length === 1) return candidates[0];
  const best = Math.min(...candidates.map(({ element }) => headingLevel(element.tag)));
  if (best === 7) return undefined;
  const top = candidates.filter(({ element }) => headingLevel(element.tag) === best);
  return top.length === 1 ? top[0] : undefined;
}

/** Elements that say every named word, innermost only (the h1, not the section holding it). */
function namedSpots(spots: readonly Spot[], name: readonly string[]): readonly Spot[] {
  const saying = spots.filter((spot) => says(spot.text, name));
  return saying.filter(
    (spot) =>
      !saying.some(
        (other) =>
          other !== spot &&
          other.regionId === spot.regionId &&
          other.depth > spot.depth &&
          contains(spot.element, other.element),
      ),
  );
}

function contains(outer: TreeNode, inner: TreeNode): boolean {
  const children = (outer as { children?: readonly TreeNode[] }).children;
  return (children ?? []).some((child) => child === inner || contains(child, inner));
}

function classesOf(element: TreeElementNode): readonly string[] {
  return (element.className ?? '').split(/\s+/u).filter((name) => name !== '');
}

function isButton(element: TreeElementNode): boolean {
  if (element.tag === 'button') return true;
  const classes = classesOf(element);
  return classes.includes('ck-btn') || classes.includes('ck-btn--ghost');
}

function resolve(parsed: Parsed, kernel: BuilderKernel): Spot | undefined {
  const spots = spotsOf(kernel);
  const saysSomething = ({ element }: Spot) => textOf(element).trim() !== '';
  if (parsed.role === 'title') {
    if (parsed.name.length === 0) {
      const top = spots.filter((spot) => spot.element.tag === 'h1' && saysSomething(spot));
      return top.length === 1 ? top[0] : undefined;
    }
    const headings = spots.filter(
      (spot) => headingLevel(spot.element.tag) < 7 && says(spot.text, parsed.name),
    );
    return headings.length === 0 ? undefined : onlyOne(headings);
  }
  if (parsed.role === 'button') {
    const buttons = spots.filter(
      (spot) =>
        isButton(spot.element) && (parsed.name.length === 0 || says(spot.text, parsed.name)),
    );
    return buttons.length === 1 ? buttons[0] : undefined;
  }
  const named = namedSpots(spots, parsed.name);
  return named.length === 0 ? undefined : onlyOne(named);
}

// ── The change ────────────────────────────────────────────────────────────────

const HUES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
/** A Tailwind colour utility with no variant: `text-red-700`, `bg-white/80`, `text-[#b91c1c]`. */
const colourUtility = (prefix: 'text' | 'bg'): RegExp =>
  new RegExp(
    `^${prefix}-(?:white|black|transparent|current|inherit|(?:${HUES})-(?:50|[1-9]00|950)|\\[(?:#|rgb|hsl|oklch|var\\(|color:)[^\\]]*\\])(?:\\/\\d{1,3})?$`,
    'u',
  );
const TEXT_COLOUR = colourUtility('text');
const BG_COLOUR = colourUtility('bg');

/** Shades a dark label cannot sit on: their button text is near-black. */
const LIGHT_SHADES: ReadonlySet<string> = new Set(['amber-400', 'white']);

function recoloured(element: TreeElementNode, shade: string): string {
  const button = isButton(element);
  const kept = classesOf(element).filter(
    (name) => !TEXT_COLOUR.test(name) && !(button && BG_COLOUR.test(name)),
  );
  const added = button
    ? [`bg-${shade}`, LIGHT_SHADES.has(shade) ? 'text-neutral-900' : 'text-white']
    : [`text-${shade}`];
  return [...kept, ...added].join(' ');
}

const MAX_LABEL_TEXT = 40;

function quoted(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > MAX_LABEL_TEXT ? `${flat.slice(0, MAX_LABEL_TEXT - 1).trimEnd()}…` : flat;
}

/**
 * «سارة خليها احمر لونها» as one tree setProp that recolours the h1, or
 * undefined. Reads the document; never writes.
 */
export function readElementColour(
  text: string,
  kernel: BuilderKernel,
): ElementColourReading | undefined {
  const parsed = parse(text);
  if (parsed === undefined) return undefined;
  const spot = resolve(parsed, kernel);
  if (spot === undefined) return undefined;
  const className = recoloured(spot.element, parsed.shade);
  if (className === (spot.element.className ?? '')) return undefined;
  const tree = mapTree(spot.tree, (node) =>
    node === spot.element ? { ...spot.element, className } : node,
  );
  if (tree === spot.tree) return undefined;
  const says = quoted(textOf(spot.element));
  const name = SHADE_NAMES[parsed.shade] ?? { ar: parsed.shade, en: parsed.shade };
  return {
    steps: [setProp(spot.regionId, 'tree', tree)],
    label: { ar: `تلوين «${says}» ب${name.ar}`, en: `Colour “${says}” ${name.en}` },
  };
}
