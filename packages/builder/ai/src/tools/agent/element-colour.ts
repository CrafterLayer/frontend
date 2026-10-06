import type { BuilderKernel } from '@craftkit/builder-core';
// ── block-parts (2026-10-06) ──
import {
  lightTheme,
  partInstances,
  type BlockPartDecl,
  type ColorToken,
} from '@craftkit/builder-schema';

import {
  namedSection,
  namingWords,
  outlinePageSections,
  roleSections,
  sectionMentions,
  subtreeIds,
  type PageSectionOutline,
} from '../../context/document-tree-mode';
import { blockSectionWordsAr } from '../../style-tools/block-section-words';
import { parseColour } from '../../style-tools/oklch';
import { matchPartNames, partBlocks, type PartBlock } from '../../style-tools/part-address';
import { partStyleTool } from '../../style-tools/part-tools';
import { liveToolContext } from '../../style-tools/run-direct';
// ── /block-parts ──
import { normalizeIntentText } from '../../intent/normalize-arabic';
import { isTreeMarkup, parseTreeMarkup } from '../../plan/tree-markup';
import { COLOUR_WORDS, colourOf, SHADE_NAMES, WHITE_WORDS } from './colour-words';
// ── block-parts (2026-10-06) ──
import { colourHex, mix } from './page-kit';
// ── /block-parts ──
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
 *
 * block-parts (2026-10-06): a registered block's part comes first when the
 * request names its section («غيّر لون العنوان في الهيرو للأزرق»), and
 * otherwise when no composed element answers. A colour no theme role is near
 * returns undefined here; `askElementColour` holds the question.
 */
export function readElementColour(
  text: string,
  kernel: BuilderKernel,
  // ── block-parts (2026-10-06) ──
  options: ElementColourOptions = {},
): ElementColourReading | undefined {
  const part = readPartColour(text, kernel, options);
  if (part?.named === true) return part.kind === 'reading' ? part.reading : undefined;
  const tree = readTreeColour(text, kernel);
  if (tree !== undefined) return tree;
  return part?.kind === 'reading' ? part.reading : undefined;
}

/**
 * What to ask before anything runs, when a request names a part of a
 * registered block but no theme role can carry its colour (or it names no
 * colour at all): a needs-input with the two ways forward, in both
 * languages. Undefined when the request reads (or does not concern a part).
 */
export function askElementColour(
  text: string,
  kernel: BuilderKernel,
  options: ElementColourOptions = {},
): ElementColourQuestion | undefined {
  const part = readPartColour(text, kernel, options);
  if (part?.kind !== 'question') return undefined;
  if (!part.named && readTreeColour(text, kernel) !== undefined) return undefined;
  return part.question;
}

/* The composed-region reading (colour-target fix, 2026-10-05), unchanged. */
function readTreeColour(text: string, kernel: BuilderKernel): ElementColourReading | undefined {
  // ── /block-parts ──
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

// ── block-parts (2026-10-06) ──
/*
  The parts of REGISTERED blocks (block-parts DESIGN §2.12). A hero is not a
  composed tree: its heading is a part (`heading`, aliases «العنوان»,
  "title"), styled through `partStyles` in tokens mode — the theming law of a
  block's className (DESIGN §6.1). So a colour named in words maps to the
  NEAREST THEME ROLE (accent, text, text-muted, success, surface,
  surface-inverse, text-inverse, with an /opacity step) by OKLab distance
  against the current theme, and lands as ONE `part.style`. When no role is
  near, nothing is written: the person chooses (the accent colour, or
  "Convert to editable" for free colours).
*/

/** The theme roles a part colour may take. */
export const THEME_COLOUR_ROLES = [
  'accent',
  'text',
  'text-muted',
  'success',
  'surface',
  'surface-inverse',
  'text-inverse',
] as const;
export type ThemeColourRole = (typeof THEME_COLOUR_ROLES)[number];

const ROLE_TOKEN: Readonly<Record<ThemeColourRole, ColorToken>> = {
  accent: 'accent',
  text: 'text',
  'text-muted': 'textMuted',
  success: 'success',
  surface: 'surface',
  'surface-inverse': 'surfaceInverse',
  'text-inverse': 'textInverse',
};

/** The label colour that reads ON a role used as a background. */
const ON_ROLE: Readonly<Record<ThemeColourRole, string>> = {
  accent: 'accent-text',
  success: 'success-text',
  'surface-inverse': 'text-inverse',
  text: 'text-inverse',
  'text-muted': 'text-inverse',
  surface: 'text',
  'text-inverse': 'text',
};

const ROLE_NAMES: Readonly<Record<ThemeColourRole, { readonly ar: string; readonly en: string }>> = {
  accent: { ar: 'لون التمييز', en: 'the accent colour' },
  text: { ar: 'لون النص', en: 'the text colour' },
  'text-muted': { ar: 'لون النص الخافت', en: 'the muted text colour' },
  success: { ar: 'لون النجاح', en: 'the success colour' },
  surface: { ar: 'لون السطح', en: 'the surface colour' },
  'surface-inverse': { ar: 'لون السطح الداكن', en: 'the inverse surface colour' },
  'text-inverse': { ar: 'لون النص المعكوس', en: 'the inverse text colour' },
};

/** Words that name a theme role directly: the follow-up «استخدم لون التمييز». */
const THEME_ROLE_WORDS: ReadonlyMap<string, ThemeColourRole> = new Map([
  ['accent', 'accent'],
  ['تمييز', 'accent'],
  ['التمييز', 'accent'],
  ['مميز', 'accent'],
  ['المميز', 'accent'],
  ['muted', 'text-muted'],
  ['خافت', 'text-muted'],
  ['الخافت', 'text-muted'],
]);

/** OKLab distance under which a named colour IS a role (≈ "the same colour, a shade off"). */
export const THEME_ROLE_TOLERANCE = 0.1;
const OPACITY_STEPS = [90, 80, 70, 60, 50, 40, 30, 20] as const;
/** A blended role is a second choice: it must beat a pure role by this much. */
const OPACITY_PENALTY = 0.012;

export interface ElementColourOptions {
  /** The theme the page is painted with; defaults to the site's tokens when the kernel exposes them, else the starter light theme. */
  readonly theme?: Readonly<Partial<Record<ColorToken, string>>>;
}

export interface ThemeRoleMatch {
  readonly role: ThemeColourRole;
  /** The token as a utility writes it: `accent`, `text/70`. */
  readonly token: string;
  readonly opacity?: number;
  readonly distance: number;
}

export interface ElementColourQuestion {
  readonly ar: string;
  readonly en: string;
  /** The ways forward, in order; a host may render them as buttons. */
  readonly choices: readonly { readonly id: 'accent' | 'convert' | ThemeColourRole; readonly ar: string; readonly en: string }[];
}

function themeOf(kernel: BuilderKernel, options: ElementColourOptions): Readonly<Partial<Record<ColorToken, string>>> {
  if (options.theme !== undefined) return { ...lightTheme, ...options.theme };
  // A site kernel exposes its design system; a page lens does not, and the starter theme stands in.
  const site = (kernel as { getSite?: () => unknown }).getSite?.();
  const tokens = (site as { designSystem?: { tokens?: unknown } } | undefined)?.designSystem?.tokens;
  if (typeof tokens === 'object' && tokens !== null) return { ...lightTheme, ...(tokens as Record<string, string>) };
  return lightTheme;
}

function labOf(hex: string): readonly [number, number, number] | undefined {
  const colour = parseColour(hex);
  if (colour === undefined) return undefined;
  const radians = (colour.h * Math.PI) / 180;
  return [colour.l, colour.c * Math.cos(radians), colour.c * Math.sin(radians)];
}

function distance(left: readonly [number, number, number], right: readonly [number, number, number]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

/**
 * The theme role (optionally at an /opacity over the surface) nearest a
 * colour, or undefined when none is within `THEME_ROLE_TOLERANCE`. `prefer`
 * breaks near-ties toward the roles that suit the property (a text colour
 * prefers text roles over surfaces).
 */
export function nearestThemeRole(
  colour: string,
  theme: Readonly<Partial<Record<ColorToken, string>>>,
  prefer: readonly ThemeColourRole[] = THEME_COLOUR_ROLES,
): ThemeRoleMatch | undefined {
  const target = labOf(colourHex(colour) ?? colour);
  if (target === undefined) return undefined;
  const surface = theme.surface ?? lightTheme.surface;
  let best: ThemeRoleMatch | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const role of THEME_COLOUR_ROLES) {
    const hex = theme[ROLE_TOKEN[role]];
    if (hex === undefined) continue;
    const order = prefer.indexOf(role);
    const bias = (order < 0 ? THEME_COLOUR_ROLES.length : order) * 0.001;
    const options: { readonly opacity?: number; readonly hex: string }[] = [
      { hex },
      ...OPACITY_STEPS.map((opacity) => ({ opacity, hex: mix(hex, surface, opacity / 100) })),
    ];
    for (const option of options) {
      const lab = labOf(option.hex);
      if (lab === undefined) continue;
      const gap = distance(target, lab);
      const score = gap + bias + (option.opacity === undefined ? 0 : OPACITY_PENALTY);
      if (score < bestScore) {
        bestScore = score;
        best = {
          role,
          token: option.opacity === undefined ? role : `${role}/${String(option.opacity)}`,
          ...(option.opacity === undefined ? {} : { opacity: option.opacity }),
          distance: gap,
        };
      }
    }
  }
  return best !== undefined && best.distance <= THEME_ROLE_TOLERANCE ? best : undefined;
}

/** The request read as «colour <part> [in <section>]». */
interface PartColourWords {
  readonly shade?: string;
  readonly role?: ThemeColourRole;
  /** «لون», "colour": the request is about a colour even when it names none. */
  readonly colourNoun: boolean;
  readonly content: readonly string[];
}

function partColourWords(text: string): PartColourWords | undefined {
  const words = normalizeIntentText(text).match(WORD) ?? [];
  if (words.length < 2 || words.length > 14) return undefined;
  const shades: string[] = [];
  const roles: ThemeColourRole[] = [];
  const content: string[] = [];
  let signal = false;
  let colourNoun = false;
  for (const word of words) {
    const role = THEME_ROLE_WORDS.get(word) ?? THEME_ROLE_WORDS.get(bare(word));
    if (role !== undefined) {
      roles.push(role);
      continue;
    }
    const shade = colourWord(word);
    if (shade !== undefined) {
      shades.push(shade);
      continue;
    }
    if (COLOUR_NOUN.test(word) || COLOUR_NOUN_EN.has(word)) {
      signal = true;
      colourNoun = true;
      continue;
    }
    if (VERBS.has(word)) {
      signal = true;
      continue;
    }
    if (PAGE_WORDS.has(word) || PAGE_WORDS.has(bare(word))) return undefined;
    if (MAIN_WORDS.has(word) || FILLERS.has(word)) continue;
    content.push(word);
  }
  if (!signal || shades.length + roles.length > 1) return undefined;
  if (content.length === 0 || content.length > 6) return undefined;
  const [shade] = shades;
  const [role] = roles;
  // «غيّر العنوان في الهيرو» with no colour word is a text edit, not a colour request.
  if (shade === undefined && role === undefined && !colourNoun) return undefined;
  return {
    ...(shade === undefined ? {} : { shade }),
    ...(role === undefined ? {} : { role }),
    colourNoun,
    content,
  };
}

/** Generic role words a block may not alias itself: «العنوان» → its heading. */
const GENERIC_PART_WORDS: Readonly<Record<Role, readonly string[]>> = {
  title: ['heading', 'title', 'headline', 'name'],
  button: ['button', 'cta', 'action', 'label', 'link'],
};

/** The parts of one block a word (or phrase) names: aliases and labels first, generic role words after. */
function partNamesFor(block: PartBlock, word: string): readonly string[] {
  const direct = matchPartNames(block.parts, word);
  if (direct.length > 0) return direct;
  const role = word.includes(' ') ? undefined : roleOf(word);
  if (role === undefined) return [];
  for (const generic of GENERIC_PART_WORDS[role]) {
    if (Object.hasOwn(block.parts, generic)) return [generic];
  }
  return [];
}

interface PartColourTarget {
  readonly block: PartBlock;
  readonly part: string;
  readonly decl: BlockPartDecl;
  readonly index: readonly number[];
  readonly scope: 'all' | 'this';
  /** True when the request named the section the part is in. */
  readonly named: boolean;
}

function repeated(decl: BlockPartDecl): boolean {
  const bind = decl.bind;
  const pattern = bind === undefined ? '' : typeof bind === 'string' ? bind : 'href' in bind ? bind.text : bind.src;
  return pattern.split('.').includes('*');
}

/**
 * The ONE registered block a request's section words name: by its type
 * ("hero", "logo cloud"), its Arabic display name and everyday words
 * («الهيرو», «الواجهة الرئيسية»), its heading, or the role it plays
 * («الأسعار»). A tie names nothing.
 */
function namedPartBlock(
  naming: ReturnType<typeof namingWords>,
  blocks: readonly PartBlock[],
  document: ReturnType<BuilderKernel['getDocument']>,
): string | undefined {
  const outlines = blocks.flatMap((block, index): PageSectionOutline[] => {
    const heading = block.node.props['heading'] ?? block.node.props['title'];
    const base = {
      id: block.id,
      type: block.node.type,
      index,
      ...(typeof heading === 'string' && heading.trim() !== '' ? { heading: heading.slice(0, 80) } : {}),
    };
    return [base, ...blockSectionWordsAr(block.node.type).map((label) => ({ ...base, label }))];
  });
  const mentions = sectionMentions(naming, outlines).filter(
    (mention, at, all) => all.findIndex((other) => other.section.id === mention.section.id) === at,
  );
  const [best, second] = mentions;
  if (best !== undefined) {
    if (second?.score === best.score) return undefined;
    if (best.score < 1 && second !== undefined) return undefined;
    return best.section.id;
  }
  const byRole = [...new Set(roleSections(naming, outlines, document).map(({ id }) => id))];
  return byRole.length === 1 ? byRole[0] : undefined;
}

/** The ONE part a request's words mean, or undefined. */
function resolvePartTarget(words: PartColourWords, kernel: BuilderKernel): PartColourTarget | undefined {
  const blocks = partBlocks(kernel);
  if (blocks.length === 0) return undefined;
  const isPartWord = (word: string) => blocks.some((block) => partNamesFor(block, word).length > 0);
  const partWords = words.content.filter(isPartWord);
  const sectionWords = words.content.filter((word) => !isPartWord(word));
  if (partWords.length === 0) return undefined;
  const document = kernel.getDocument();
  let inside: ReadonlySet<string> | undefined;
  let sectionId: string | undefined;
  if (sectionWords.length > 0) {
    const sections = outlinePageSections(document);
    const naming = namingWords(sectionWords.join(' '));
    const byRole = roleSections(naming, sections, document);
    const section = namedSection(naming, sections) ?? (byRole.length === 1 ? byRole[0] : undefined);
    // A registered block the words name, at any depth (the landing hero sits inside an aurora).
    const sectionBlockId = section === undefined ? namedPartBlock(naming, blocks, document) : undefined;
    // Words that name no section are a name the composed reading may know («سارة»).
    const id = section?.id ?? sectionBlockId;
    if (id === undefined) return undefined;
    sectionId = id;
    inside = new Set(subtreeIds(id, document));
  }
  const phrase = partWords.join(' ');
  const scoped = blocks.filter((block) => inside === undefined || inside.has(block.id));
  // The whole phrase names the part («عنوان البطاقة»); words that name two different parts name none.
  const found = scoped.flatMap((block) => partNamesFor(block, phrase).map((part) => ({ block, part })));
  // The section block's own part beats one of its children's (the hero's heading, not a button's label).
  const own = found.filter(({ block }) => block.id === sectionId);
  const pool = own.length > 0 ? own : found;
  const unique = pool.filter(
    (entry, at) => pool.findIndex((other) => other.block.id === entry.block.id && other.part === entry.part) === at,
  );
  if (unique.length !== 1) return undefined;
  const [hit] = unique;
  const decl = hit === undefined ? undefined : hit.block.parts[hit.part];
  if (hit === undefined || decl === undefined) return undefined;
  if (!repeated(decl)) return { block: hit.block, part: hit.part, decl, index: [], scope: 'this', named: sectionId !== undefined };
  const instances = partInstances(hit.block.parts, hit.block.node.props).filter(({ part }) => part === hit.part);
  const [only] = instances;
  return instances.length === 1 && only !== undefined
    ? { block: hit.block, part: hit.part, decl, index: only.index, scope: 'this', named: sectionId !== undefined }
    : { block: hit.block, part: hit.part, decl, index: [], scope: 'all', named: sectionId !== undefined };
}

const BUTTON_WORDS: ReadonlySet<string> = new Set(['button', 'btn', 'cta', 'زر', 'زرار', 'بتن', 'buttons']);

/** A part a person calls a button: its colour is its background, its label reads on it. */
function buttonLike(target: PartColourTarget): boolean {
  if (target.decl.kind !== 'link' && target.decl.kind !== 'box') {
    return /button|cta/iu.test(target.block.node.type) && target.decl.kind === 'text';
  }
  if (/button|cta/iu.test(target.block.node.type)) return true;
  const words = [target.part, target.decl.label.en, target.decl.label.ar, ...(target.decl.aliases ?? [])];
  return words.some((word) =>
    (normalizeIntentText(word).match(WORD) ?? []).some((part) => BUTTON_WORDS.has(part) || BUTTON_WORDS.has(bare(part))),
  );
}

type PartColourResult =
  | { readonly kind: 'reading'; readonly reading: ElementColourReading; readonly named: boolean }
  | { readonly kind: 'question'; readonly question: ElementColourQuestion; readonly named: boolean };

function partTitle(target: PartColourTarget): { readonly ar: string; readonly en: string } {
  return { ar: `«${target.decl.label.ar}»`, en: `the ${target.block.blockName} ${target.decl.label.en.toLowerCase()}` };
}

function noRoleQuestion(target: PartColourTarget, shade: string | undefined): ElementColourQuestion {
  const what = partTitle(target);
  const name = shade === undefined ? undefined : (SHADE_NAMES[shade] ?? { ar: shade, en: shade });
  const choices = [
    { id: 'accent' as const, ar: 'استخدم لون التمييز', en: 'Use the accent colour' },
    { id: 'convert' as const, ar: 'حوّل إلى قابل للتعديل (ألوان حرة)', en: 'Convert to editable (free colours)' },
  ];
  if (name === undefined) {
    return {
      ar: `أي لون تريد لـ${what.ar}؟ ألوان هذا القسم من ألوان الموقع: ${choices[0]?.ar ?? ''}، أو «${choices[1]?.ar ?? ''}» لأي لون آخر.`,
      en: `Which colour should ${what.en} take? This section uses the site's colours: ${choices[0]?.en.toLowerCase() ?? ''}, or “${choices[1]?.en ?? ''}” for any other colour.`,
      choices,
    };
  }
  return {
    ar: `لا يوجد ${name.ar.replace(/^ال/u, '')} بين ألوان الموقع لـ${what.ar}. اختر: ${choices[0]?.ar ?? ''}، أو «${choices[1]?.ar ?? ''}» لتلوينه ب${name.ar}.`,
    en: `The site's colours have no ${name.en} for ${what.en}. Choose: ${choices[0]?.en.toLowerCase() ?? ''}, or “${choices[1]?.en ?? ''}” to make it ${name.en}.`,
    choices,
  };
}

const TEXT_PREFERENCE: readonly ThemeColourRole[] = ['text', 'text-muted', 'accent', 'success', 'text-inverse', 'surface-inverse', 'surface'];
const BACKGROUND_PREFERENCE: readonly ThemeColourRole[] = ['accent', 'success', 'surface-inverse', 'surface', 'text', 'text-muted', 'text-inverse'];

/** The part reading: a part.style for the nearest role, a question, or undefined when no part is meant. */
function readPartColour(text: string, kernel: BuilderKernel, options: ElementColourOptions): PartColourResult | undefined {
  const words = partColourWords(text);
  if (words === undefined) return undefined;
  const target = resolvePartTarget(words, kernel);
  if (target === undefined) return undefined;
  const button = buttonLike(target);
  const background = button || target.decl.kind === 'box' || target.decl.kind === 'item' || target.decl.kind === 'list';
  let match: ThemeRoleMatch | undefined;
  if (words.role !== undefined) {
    match = { role: words.role, token: words.role, distance: 0 };
  } else if (words.shade !== undefined) {
    const hex = words.shade === 'white' ? '#ffffff' : colourHex(words.shade);
    match = hex === undefined ? undefined : nearestThemeRole(hex, themeOf(kernel, options), background ? BACKGROUND_PREFERENCE : TEXT_PREFERENCE);
  }
  if (match === undefined) {
    return { kind: 'question', question: noRoleQuestion(target, words.shade), named: target.named };
  }
  const style: Record<string, string> = background
    ? { backgroundColor: match.token, ...(button ? { textColor: ON_ROLE[match.role] } : {}) }
    : { textColor: match.token };
  const input = {
    id: target.block.id,
    part: target.part,
    ...(target.index.length === 0 ? {} : { index: [...target.index] }),
    scope: target.scope,
    style,
  };
  const parsed = partStyleTool.parse(input);
  if (!parsed.ok) return undefined;
  const run = partStyleTool.run(parsed.value, liveToolContext(kernel));
  if (!run.ok) return undefined;
  const what = partTitle(target);
  const role = ROLE_NAMES[match.role];
  const faded = match.opacity === undefined ? '' : ` (${String(match.opacity)}%)`;
  return {
    kind: 'reading',
    named: target.named,
    reading: {
      steps: run.steps,
      label: { ar: `تلوين ${what.ar} ب${role.ar}${faded}`, en: `Colour ${what.en} with ${role.en}${faded}` },
    },
  };
}
// ── /block-parts ──
