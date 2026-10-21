import { contrastRatio } from '@craftkit/builder-schema';

import { isVerifiedImageUrl } from '../../art-catalog/verified-image';
import { normalizeIntentText } from '../../intent/normalize-arabic';
import { isTreeMarkup, parseTreeMarkup } from '../../plan/tree-markup';
import { checkSectionFonts } from './additional-section-fonts';
import { PAGE_PLAN_PALETTE_HEX } from './palette';
import { sectionButtonActions } from './section-button-actions';
import { missingFactAdvice, plainMissingFact } from './section-missing-facts';
import { pageKitGrounds, type PageKitColours, type PageKitGrounds } from './skeleton-from-plan';
import type {
  LandedSection,
  PagePlan,
  PagePlanTokens,
  SectionCheckCode,
  SectionCheckIssue,
  SectionContract,
} from './types';

export interface CheckSectionOptions {
  /**
   * The person's request, verbatim. An image address it names is theirs to
   * use (photo-direction: the catalog, the request, or the region being
   * edited); every other address is one a model wrote from memory.
   */
  readonly request?: string;
}

// ── Reading a landed tree ─────────────────────────────────────────────────────

/** A node of a landed tree as the walk sees it: never trusted, always a record. */
export interface LandedNode {
  readonly node: Readonly<Record<string, unknown>>;
  /** Readable path from the region prop: `tree.children[0].children[2]`. */
  readonly path: string;
  readonly depth: number;
  readonly parent: LandedNode | undefined;
}

/*
  Bounds for a hostile tree: the door caps a stored tree at 2,000 nodes and
  depth 30 (CUSTOM_CODE_MAX_*), and a proposal checked before landing has
  passed no door at all — so the walk is iterative, visits each object once,
  and stops at a ceiling well above anything the door admits.
*/
const MAX_NODES = 4_000;
const MAX_DEPTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The tree as a root record: markup a writer proposed is read the way the door reads it. */
export function readLandedTree(tree: unknown): Readonly<Record<string, unknown>> | undefined {
  let value = tree;
  if (isTreeMarkup(value)) {
    try {
      value = parseTreeMarkup(value);
    } catch {
      return undefined;
    }
  }
  return isRecord(value) ? value : undefined;
}

/** Every node of a landed tree in document order, bounded. Never throws. */
export function walkLandedTree(tree: unknown): readonly LandedNode[] {
  const root = readLandedTree(tree);
  if (root === undefined) return [];
  const seen = new Set<object>([root]);
  const visited: LandedNode[] = [];
  const stack: { value: unknown; path: string; depth: number; parent: LandedNode | undefined }[] =
    [];
  const pushChildren = (children: unknown, path: string, depth: number, parent?: LandedNode) => {
    if (!Array.isArray(children) || depth > MAX_DEPTH) return;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        value: children[index] as unknown,
        path: `${path}.children[${String(index)}]`,
        depth,
        parent,
      });
    }
  };
  pushChildren(root['children'], 'tree', 1);
  while (stack.length > 0 && visited.length < MAX_NODES) {
    const entry = stack.pop();
    if (entry === undefined || !isRecord(entry.value) || seen.has(entry.value)) continue;
    seen.add(entry.value);
    const visit: LandedNode = {
      node: entry.value,
      path: entry.path,
      depth: entry.depth,
      parent: entry.parent,
    };
    visited.push(visit);
    pushChildren(entry.value['children'], entry.path, entry.depth + 1, visit);
  }
  return visited;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function attribute(node: Readonly<Record<string, unknown>>, name: string): string | undefined {
  const attributes = node['attributes'];
  return isRecord(attributes) ? text(attributes[name]) : undefined;
}

function classesOf(node: Readonly<Record<string, unknown>>): readonly string[] {
  const className = node['className'];
  return typeof className === 'string' ? className.split(/\s+/u).filter((name) => name !== '') : [];
}

/** The bidi controls the skeleton wraps a phone number in (LRI … PDI) and the marks LRM, RLM. */
const ISOLATES = /[\u2066-\u2069\u200E\u200F]/gu;

function collapse(value: string): string {
  return value.replace(ISOLATES, '').replace(/\s+/gu, ' ').trim();
}

/**
 * The text each of `targets` and everything under it shows, in reading order,
 * in ONE pass: each text is handed up its ancestor chain (depth ≤ MAX_DEPTH),
 * so the cost is nodes × depth, not targets × nodes × depth. Measured
 * 2026-09-28: reading every element's label with `landedText` took 874 ms on a
 * door-legal tree of 2,000 nodes at depth 30; this takes a few milliseconds.
 */
export function landedTexts(
  nodes: readonly LandedNode[],
  targets: Iterable<LandedNode>,
): ReadonlyMap<LandedNode, string> {
  const parts = new Map<LandedNode, string[]>();
  for (const target of targets) parts.set(target, []);
  if (parts.size > 0) {
    for (const entry of nodes) {
      const own = text(entry.node['text']);
      if (own === undefined) continue;
      for (
        let cursor: LandedNode | undefined = entry;
        cursor !== undefined;
        cursor = cursor.parent
      ) {
        parts.get(cursor)?.push(own);
      }
    }
  }
  return new Map([...parts].map(([target, texts]) => [target, collapse(texts.join(' '))]));
}

/** The text a node and everything under it shows, in reading order. */
export function landedText(nodes: readonly LandedNode[], under: LandedNode): string {
  const parts: string[] = [];
  for (const entry of nodes) {
    let cursor: LandedNode | undefined = entry;
    while (cursor !== undefined && cursor !== under) cursor = cursor.parent;
    if (cursor === undefined) continue;
    const own = text(entry.node['text']);
    if (own !== undefined) parts.push(own);
  }
  return collapse(parts.join(' '));
}

/** Every string a component reference carries in its props, a level or two deep. */
function componentStrings(node: Readonly<Record<string, unknown>>): readonly [string, string][] {
  const found: [string, string][] = [];
  const stack: { value: unknown; key: string; depth: number }[] = [
    { value: node['props'], key: 'props', depth: 0 },
  ];
  while (stack.length > 0 && found.length < 200) {
    const entry = stack.pop();
    if (entry === undefined || entry.depth > 4) continue;
    if (typeof entry.value === 'string') found.push([entry.key, entry.value]);
    else if (Array.isArray(entry.value)) {
      entry.value.forEach((item, index) =>
        stack.push({
          value: item as unknown,
          key: `${entry.key}[${String(index)}]`,
          depth: entry.depth + 1,
        }),
      );
    } else if (isRecord(entry.value)) {
      for (const [name, child] of Object.entries(entry.value)) {
        stack.push({ value: child, key: `${entry.key}.${name}`, depth: entry.depth + 1 });
      }
    }
  }
  return found;
}

// ── Colour classes ────────────────────────────────────────────────────────────

const PALETTE_FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PALETTE_VALUE = new RegExp(
  `^((?:${PALETTE_FAMILIES})-(?:50|[1-9]00|950))(?:/(\\d{1,3}))?$`,
  'u',
);
/** The site theme's roles (utility-vocabulary.ts): they follow the SITE, not this plan. */
const ROLE_VALUE =
  /^(?:accent|accent-text|success|success-text|surface|surface-inverse|text|text-inverse|text-muted)(?:\/\d{1,3})?$/u;
const NEUTRAL_VALUE = /^(white|black)(?:\/(\d{1,3}))?$/u;
const COLOUR_UTILITY =
  /^(bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|decoration|divide|from|via|to|fill|stroke|shadow|accent|caret|placeholder)-(.+)$/u;
/** An arbitrary property naming a colour: `[color:crimson]`, `[background-color:#123456]`. */
const COLOUR_PROPERTY_CLASS =
  /^\[(color|background(?:-color)?|border(?:-[a-z]+)*-color|outline-color|text-decoration-color|caret-color|accent-color|fill|stroke):(.+)\]$/u;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const CK_VAR = /^var\(--ck-([a-z-]+)\)$/u;

/*
  The CSS named colours (CSS Color 4), less the four that carry no hue of
  their own: white and black (the page's allowed tints), transparent and
  currentColor. The playground's live Tailwind oracle generates `text-[crimson]`
  (apps/playground use-live-utilities.ts), so the door admits it, and region
  css takes `color:crimson` as readily as a hex — both passed the checker
  silently (verifier, 2026-09-28).
*/
const CSS_NAMED_COLOURS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat whitesmoke yellow yellowgreen'.split(
    ' ',
  ),
);

/** The CSS properties whose value is (or carries) a colour, custom properties among them. */
const COLOUR_DECLARATION =
  /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|text-decoration(?:-color)?|caret-color|accent-color|column-rule(?:-color)?|stop-color|flood-color|--[\w-]+)$/u;

/** The named colours a declaration's value writes, read past its urls, vars and strings. */
function namedColoursIn(value: string): readonly string[] {
  const bare = value
    .replace(/url\([^)]*\)/giu, ' ')
    .replace(/var\([^)]*\)/giu, ' ')
    .replace(/(["'])(?:(?!\1).)*\1/gu, ' ')
    .toLowerCase();
  return (bare.match(/[a-z]+/gu) ?? []).filter((word) => CSS_NAMED_COLOURS.has(word));
}

type ColourRead =
  | { readonly kind: 'ok'; readonly hex?: string; readonly token?: keyof PageKitColours }
  | { readonly kind: 'raw' };

/** The utility after its variants (`md:hover:`) and any `!` / `-` prefix. */
function baseUtility(name: string): { readonly base: string; readonly variants: boolean } {
  let depth = 0;
  let cut = -1;
  for (let index = 0; index < name.length; index += 1) {
    const character = name[index];
    if (character === '[') depth += 1;
    else if (character === ']') depth -= 1;
    else if (character === ':' && depth === 0) cut = index;
  }
  const base = name
    .slice(cut + 1)
    .replace(/^!/u, '')
    .replace(/^-/u, '');
  return { base, variants: cut !== -1 };
}

function normalHex(value: string): string {
  const body = value.replace(/^#/u, '').toLowerCase();
  const six =
    body.length <= 4
      ? body
          .slice(0, 3)
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : body.slice(0, 6);
  return `#${six}`;
}

const TOKEN_NAMES: Readonly<Record<string, keyof PageKitColours>> = {
  bg: 'bg',
  surface: 'surface',
  ink: 'ink',
  muted: 'muted',
  accent: 'accent',
  'on-accent': 'onAccent',
  'accent-ink': 'accentInk',
  border: 'border',
};

interface ClassColour {
  readonly property: string;
  readonly read: ColourRead;
  /** The value carries an opacity modifier: a tint whose contrast needs the layer beneath. */
  readonly translucent: boolean;
}

/** What a class says about colour, if anything, against this plan's colours. */
function readColourClass(name: string, planHexes: ReadonlySet<string>): ClassColour | undefined {
  const { base } = baseUtility(name);
  const arbitrary = COLOUR_PROPERTY_CLASS.exec(base);
  if (arbitrary !== null) {
    const written = arbitrary[1] ?? '';
    const property =
      written === 'color'
        ? 'text'
        : written === 'background' || written === 'background-color'
          ? 'bg'
          : written;
    return readColourValue(property, `[${arbitrary[2] ?? ''}]`, planHexes);
  }
  const match = COLOUR_UTILITY.exec(base);
  if (match === null) return undefined;
  return readColourValue(match[1] ?? '', match[2] ?? '', planHexes);
}

function readColourValue(
  property: string,
  written: string,
  planHexes: ReadonlySet<string>,
): ClassColour | undefined {
  // `bg-[crimson]/50`: the opacity modifier sits outside the brackets.
  const value = written.replace(/(?<=\])\/\d{1,3}$/u, '');
  const tinted = value !== written;
  if (/^(?:transparent|current|inherit)$/u.test(value)) {
    return { property, read: { kind: 'ok' }, translucent: value === 'transparent' };
  }
  const neutral = NEUTRAL_VALUE.exec(value);
  if (neutral !== null) {
    return {
      property,
      read: { kind: 'ok', hex: neutral[1] === 'white' ? '#ffffff' : '#000000' },
      translucent: neutral[2] !== undefined,
    };
  }
  const palette = PALETTE_VALUE.exec(value);
  if (palette !== null) {
    const hex = PAGE_PLAN_PALETTE_HEX[palette[1] ?? ''];
    return {
      property,
      read: hex !== undefined && planHexes.has(hex) ? { kind: 'ok', hex } : { kind: 'raw' },
      translucent: palette[2] !== undefined,
    };
  }
  if (ROLE_VALUE.test(value)) return { property, read: { kind: 'raw' }, translucent: false };
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).replace(/^color:/u, '');
    if (HEX.test(inner)) {
      const hex = normalHex(inner);
      return {
        property,
        read: planHexes.has(hex) ? { kind: 'ok', hex } : { kind: 'raw' },
        translucent: tinted,
      };
    }
    const token = CK_VAR.exec(inner)?.[1];
    if (token !== undefined) {
      const role = TOKEN_NAMES[token];
      return {
        property,
        read: role === undefined ? { kind: 'ok' } : { kind: 'ok', token: role },
        translucent: tinted,
      };
    }
    if (
      /^(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/iu.test(inner) &&
      !inner.includes('var(')
    ) {
      return { property, read: { kind: 'raw' }, translucent: tinted };
    }
    if (CSS_NAMED_COLOURS.has(inner.toLowerCase())) {
      return { property, read: { kind: 'raw' }, translucent: tinted };
    }
  }
  return undefined;
}

// ── Grounds and ink, as the cascade resolves them ─────────────────────────────

type KitName = keyof PageKitGrounds;

interface ColourContext {
  readonly kit: KitName;
  readonly ground: string | undefined;
  readonly ink: string | undefined;
}

/*
  Kit classes live in the page's component layer and utilities in Tailwind's
  later utilities layer, so on one element a utility's colour beats a kit
  class's; among kit classes the later rule in the page CSS wins. Listed here
  in reverse rule order: the first one an element carries is its colour.
*/
const KIT_INK: readonly [string, (colours: PageKitColours) => string][] = [
  ['ck-btn--ghost', (colours) => colours.ink],
  ['ck-btn', (colours) => colours.onAccent],
  ['ck-eyebrow', (colours) => colours.accentInk],
  ['ck-accent-ink', (colours) => colours.accentInk],
  ['ck-muted', (colours) => colours.muted],
  ['ck-ink', (colours) => colours.ink],
  ['ck-accent-fill', (colours) => colours.ink],
  ['ck-inverse', (colours) => colours.ink],
  ['ck-card', (colours) => colours.ink],
  ['ck-surface', (colours) => colours.ink],
  ['ck-ground', (colours) => colours.ink],
];
const KIT_GROUND: readonly [string, (colours: PageKitColours) => string | undefined][] = [
  ['ck-btn--ghost', () => undefined],
  ['ck-btn', (colours) => colours.accent],
  ['ck-accent-fill', (colours) => colours.bg],
  ['ck-inverse', (colours) => colours.bg],
  ['ck-card', (colours) => colours.surface],
  ['ck-surface', (colours) => colours.surface],
  ['ck-ground', (colours) => colours.bg],
];

interface ElementColour {
  readonly context: ColourContext;
  /** The element's own text-colour utility, when it sets one without a variant. */
  readonly textClass?: { readonly name: string; readonly hex: string | undefined };
}

function resolveColours(
  node: Readonly<Record<string, unknown>>,
  parent: ColourContext,
  grounds: PageKitGrounds,
  planHexes: ReadonlySet<string>,
  overlaid: boolean,
): ElementColour {
  const classes = classesOf(node);
  const plain = new Set(classes.filter((name) => !name.includes(':')));
  const kit: KitName = plain.has('ck-accent-fill')
    ? 'accent'
    : plain.has('ck-inverse')
      ? 'inverse'
      : parent.kit;
  const colours = grounds[kit];
  const fromToken = (read: ColourRead): string | undefined =>
    read.kind !== 'ok'
      ? undefined
      : (read.hex ?? (read.token === undefined ? undefined : colours[read.token]));

  let ground = parent.ground;
  let ink = parent.ink;
  let groundSet = false;
  let inkSet = false;
  let textClass: ElementColour['textClass'];

  // Utilities first: they win on their own element.
  for (const name of classes) {
    if (name.includes(':')) continue;
    const colour = readColourClass(name, planHexes);
    if (colour === undefined) continue;
    const gradient = name.startsWith('bg-gradient');
    if (colour.property === 'bg' && !groundSet && !gradient) {
      const hex = fromToken(colour.read);
      if (colour.read.kind === 'ok' && hex === undefined && !colour.translucent) {
        // transparent/current/inherit: the ground shows through.
      } else {
        ground = colour.translucent ? undefined : hex;
        groundSet = true;
      }
    } else if (colour.property === 'text' && !inkSet) {
      const hex = colour.translucent ? undefined : fromToken(colour.read);
      if (
        colour.read.kind === 'ok' &&
        colour.read.hex === undefined &&
        colour.read.token === undefined
      ) {
        // text-current / text-inherit: the ink is inherited.
      } else {
        ink = hex;
        inkSet = true;
        textClass = { name, hex };
      }
    }
  }
  if (classes.some((name) => /^(?:bg-gradient|from-|via-|to-)/u.test(name))) {
    ground = undefined;
    groundSet = true;
  }
  if (!groundSet) {
    const kitGround = KIT_GROUND.find(([name]) => plain.has(name));
    if (kitGround !== undefined) {
      const value = kitGround[1](colours);
      if (value !== undefined) ground = value;
    }
  }
  if (!inkSet) {
    const kitInk = KIT_INK.find(([name]) => plain.has(name));
    if (kitInk !== undefined) ink = kitInk[1](colours);
  }
  // A photo or a decoration layered under this element's content: its ground is unknowable here.
  if (overlaid) ground = undefined;
  return { context: { kit, ground, ink }, ...(textClass === undefined ? {} : { textClass }) };
}

// ── The checks ────────────────────────────────────────────────────────────────

const AA = 4.5;
const AA_LARGE = 3;
const MAX_ISSUES = 12;
const MAX_PLACEHOLDERS = 3;
const MAX_LISTED = 8;
/** The plan's own CTA label is at most 40 characters (validatePagePlan). */
const BUTTON_LABEL_MAX = 40;
/** Children that make a link a card, not a button. */
const BLOCK_CONTENT = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'div',
  'ul',
  'ol',
  'li',
  'img',
  'picture',
  'figure',
  'section',
  'article',
  'blockquote',
  'table',
]);

/** Elements that hold one line of copy, inline tags and all: where a repeated claim is sought. */
const LINE_ELEMENTS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'figcaption',
  'caption',
  'dt',
  'dd',
  'td',
  'th',
  'label',
  'button',
  'q',
]);

const BRACKETED = /\[[^[\]\n]*\p{L}[^[\]\n]*\]/u;
const MUSTACHE = /\{\{[^}]*\}\}/u;
const LOREM = /\blorem\b(?:\s+ipsum)?|\bipsum\s+dolor\b/iu;
/** The Arabic "lorem ipsum" (هذا النص هو مثال لنص…), folded; and its transliteration. */
const ARABIC_FILLER = ['هذا النص هو مثال', 'لوريم ايبسوم'];
const SCAFFOLD_LEFTOVERS = ['THE SECTION TITLE'];

// Masked facts: XXX, phone-shaped repeated/counting digits, or a placeholder domain.
const MASK_LETTERS = /(?<!\p{L})[xX]{3,}(?!\p{L})/u;
const PHONE_RUN = /[+(]?[0-9][0-9 ().-]{5,}[0-9]/gu;
/**
 * Digits a writer types instead of a number: six of one digit in a row, or a
 * count. Read against a phone run's digits with the separators removed. Also
 * the trigger of validatePagePlan's R-masked repair, so the planner's own
 * samples never carry one to a writer.
 */
export const MASKED_DIGITS = /([0-9])\1{5,}|1234567|7654321/u;
const PLACEHOLDER_ADDRESS =
  /[\w.+-]*@(?:example|domain|yourdomain|yourcompany|yoursite|yourbusiness|yourbrand|yourname|mybusiness|company|email|website)\.(?:com|net|org)\b|(?:https?:\/\/)?(?:www\.)?(?:example|yourdomain|yourcompany|yoursite|yourwebsite|yourbusiness|yourbrand|mybusiness|mysite|mywebsite|website)\.(?:com|net|org)\b/iu;
/*
  The instruction a template leaves before a field's name — «ضع رقم هاتفك
  هنا», "Enter your phone number" — is the stand-in all the same. Folded forms
  (أدخل → ادخل, أضف → اضف), peeled before the name is looked up.
*/
const FIELD_INSTRUCTION = /^(?:ضع|اكتب|ادخل|اضف|enter|insert|add|put|type|write) /u;

/**
 * A field's NAME written where its value belongs — «رقم الهاتف» on the line a
 * phone number should fill. Folded forms, matched against a whole line of
 * text (a "Phone:" label before it and a trailing "here"/"هنا" peeled).
 * `phone` and `email` stand-ins pass when the section also shows a real value
 * of that kind: then the name is a label beside it, not a stand-in for it.
 */
const FIELD_NAMES: ReadonlyMap<string, 'phone' | 'email' | 'name' | 'address'> = new Map([
  ...[
    'رقم الهاتف',
    'رقم هاتفك',
    'رقم هاتفنا',
    'رقم الجوال',
    'رقم جوالك',
    'رقم الموبايل',
    'رقم التلفون',
    'رقم التليفون',
    'رقم الواتساب',
    'رقم الواتس',
    'رقم التواصل',
    'phone number',
    'your phone number',
    'telephone number',
    'mobile number',
    'whatsapp number',
  ].map((name) => [name, 'phone'] as const),
  ...[
    'البريد الالكتروني',
    'بريدك الالكتروني',
    'عنوان البريد الالكتروني',
    'الايميل',
    'ايميلك',
    'email address',
    'e mail address',
    'your email',
    'your email address',
  ].map((name) => [name, 'email'] as const),
  ...[
    'اسم الشركه',
    'اسم شركتك',
    'اسم المطعم',
    'اسم المحل',
    'اسم المتجر',
    'اسم العياده',
    'اسم العميل',
    'اسم النشاط',
    'اسم النشاط التجاري',
    'اسم المشروع',
    'اسم العلامه التجاريه',
    'company name',
    'your company name',
    'business name',
    'your business name',
    'brand name',
    'your brand name',
    'client name',
    'customer name',
    'your name',
  ].map((name) => [name, 'name'] as const),
  ...['عنوانك', 'اسم الشارع', 'your address', 'street name', 'address line 1'].map(
    (name) => [name, 'address'] as const,
  ),
]);
/** Tags whose text names a field on purpose: a form's label, a table's header. */
const LABEL_TAGS = new Set(['label', 'dt', 'th', 'legend', 'option', 'caption']);
const EMAIL_VALUE = /[^\s@]+@[^\s@]+\.[^\s@]+/u;

/*
  Words a paraphrase drops or swaps without changing the claim. Negations are
  NOT among them (no, not, لا, بدون, غير): "بدون رسوم إضافية" said as "رسوم
  إضافية" is the opposite claim. لا left this list on 2026-09-28 for that
  reason. Neither are the prepositions that carry meaning (since, across).
*/
const EN_STOP = new Set(
  'the a an and or of in on for to with at by from our your we you is are be it its this that all as into than every each per just only also very has have had was were will can within inside us my me they their them'.split(
    ' ',
  ),
);
/**
 * Folded forms (normalizeIntentText): إلى → الي, حتى → حتي, أن → ان. Read
 * under their clitics as well (`isStopWord`): وفي, بها, ولكل, منها, عليه.
 * «لمدة» and «خلال» only frame a figure — "ضمان لمدة سنة" is "ضمان سنة".
 */
const AR_STOP = new Set(
  'في من علي الي عن مع او هذا هذه ذلك تلك التي الذي الذين كل نحن انت انتم انا هو هي هم ها هنا هناك لكم لك لنا لدي لدينا عند بين حتي قد ما ان كان يكون تم يتم ثم بل لكن اي كما مثل ايضا فقط جدا خلال لمده مده ضمن حيث و'.split(
    ' ',
  ),
);

/**
 * Words that only say "at least" around a number: "أكثر من ١٢٠٠" and the stat
 * "+١٢٠٠" are one claim once the number itself is there. Folded forms.
 */
const QUANTIFIERS = new Set(
  'اكثر ازيد يزيد فوق نحو حوالي قرابه تقريبا more over plus nearly almost around about approximately'.split(
    ' ',
  ),
);

/*
  A digit-group separator is only a separator between a digit and exactly
  three more: 1,200 · ١٬٢٠٠ · 1 200 (thin or no-break space) · 1'200. A "."
  is never one here — Jordanian prices are written 1.500 د.أ, three decimals.
  Run BEFORE normalizeIntentText, whose NFKC turns thin spaces into plain ones.
*/
const DIGIT_GROUP = /(?<=\p{Nd})[,\u066C'\u2019\u2009\u202F\u00A0](?=\p{Nd}{3}(?!\p{Nd}))/gu;
/** A decimal point between digits, in any of the three spellings: 1.5 · 1٫5 · 1,5. */
const DECIMAL = /(?<=[0-9])[.,٫](?=[0-9])/gu;

/** Folded for matching only: Arabic variants, digits, case, punctuation as spaces. */
function foldForMatch(value: string): string {
  return (
    normalizeIntentText(value.replace(ISOLATES, '').replace(DIGIT_GROUP, '').replace(/٪/gu, '%'))
      .replace(DECIMAL, '.')
      .replace(/[^\p{L}\p{N}\s%+.]/gu, ' ')
      // A "." survives only as a decimal point; 1.500 and 1.5 are one price.
      .replace(/(?<![0-9])\.|\.(?![0-9])/gu, ' ')
      .replace(/[0-9]+\.[0-9]+/gu, (number) => number.replace(/\.?0+$/u, ''))
      // A figure glued to its unit is two words: "24h" · "٥دقائق" · "1.5jd".
      .replace(/(?<=[0-9])(?=\p{L})|(?<=\p{L})(?=[0-9])/gu, ' ')
      .replace(/\s+/gu, ' ')
      // "20 %" and "20%" are one figure.
      .replace(/(?<=[0-9]) (?=%)/gu, '')
      .trim()
  );
}

// ── Words, in every form a page writes them ──────────────────────────────────

/*
  A claim is matched WORD by word, each word read in the forms it takes on a
  page, and two words match when they share a form. Arabic glues the article,
  the conjunctions و/ف, the prepositions ب/ل/ك and the possessives to its
  words, and English inflects them — so the substring test this replaces never
  found "التوصيل المجاني" on a page that says "توصيل مجاني", nor "خصم على الطلب
  الأول" said as "على طلبك الأول", nor "Fixed-price quotes" as "a fixed-price
  quote": 8 of 12 light paraphrases were flagged, each a repair model call for
  a section that was right (verifier's mustsay-r2.mjs, 2026-09-28). The
  substring test also found "rent" inside "current". Whole forms fix both.

  The peeling is conservative, as the router's (intent-tokens.ts) is: a clitic
  comes off only when three letters remain (two after the article: الشاي →
  شاي), so "من" never becomes "ن". An odd extra form costs nothing — it only
  ever matches another word's form.
*/
const ARABIC_WORD = /[؀-ۿ]/u;
const MIN_STEM = 3;
const AR_CONJUNCTIONS = new Set(['و', 'ف']);
const AR_PREPOSITIONS = new Set(['ب', 'ل', 'ك']);
/** Possessive and object pronouns, longest first. ه is also ة folded (normalizeArabic). */
const AR_PRONOUNS = ['هما', 'كما', 'هم', 'هن', 'كم', 'كن', 'ها', 'نا', 'ه', 'ك', 'ي'] as const;

type FormsOf = (word: string) => readonly string[];

/** The stems a folded Arabic word may stand for, itself first. */
function arabicForms(word: string): readonly string[] {
  const peel = (stem: string, prefix: string, keep: number): string | undefined =>
    stem.startsWith(prefix) && stem.length - prefix.length >= keep
      ? stem.slice(prefix.length)
      : undefined;
  const starts = [word];
  const unjoined = AR_CONJUNCTIONS.has(word.charAt(0))
    ? peel(word, word.charAt(0), MIN_STEM)
    : undefined;
  if (unjoined !== undefined) starts.push(unjoined);
  const bases: string[] = [];
  for (const start of starts) {
    bases.push(start);
    // لل is ل + ال with the article's alif dropped: للمهندسين → مهندسين.
    const forThe = peel(start, 'لل', MIN_STEM - 1);
    if (forThe !== undefined) bases.push(forThe);
    const unprefixed = AR_PREPOSITIONS.has(start.charAt(0))
      ? peel(start, start.charAt(0), MIN_STEM)
      : undefined;
    if (unprefixed !== undefined) bases.push(unprefixed);
    for (const candidate of [start, unprefixed]) {
      const bare = candidate === undefined ? undefined : peel(candidate, 'ال', MIN_STEM - 1);
      if (bare !== undefined) bases.push(bare);
    }
    // The imperative's alif, the form a call to action takes: احجز → حجز, اطلب → طلب.
    if (!start.startsWith('ال')) {
      const verb = peel(start, 'ا', MIN_STEM);
      if (verb !== undefined) bases.push(verb);
    }
  }
  const forms = new Set<string>();
  const pending = [...bases];
  for (let stem = pending.pop(); stem !== undefined; stem = pending.pop()) {
    if (forms.has(stem)) continue;
    forms.add(stem);
    const cut = (length: number): string | undefined =>
      stem.length - length >= MIN_STEM ? stem.slice(0, -length) : undefined;
    for (const pronoun of AR_PRONOUNS) {
      const rest = stem.endsWith(pronoun) ? cut(pronoun.length) : undefined;
      if (rest !== undefined) pending.push(rest);
    }
    // ة is written ت before a suffix: طاولتك → طاولت → طاوله; سنتين → سنت → سنه.
    if (stem.endsWith('ت') && stem.length > MIN_STEM) pending.push(`${stem.slice(0, -1)}ه`);
    // Sound plurals: طاولات → طاوله, مهندسين · مهندسون → مهندس.
    const plural =
      stem.endsWith('ات') || stem.endsWith('ون') || stem.endsWith('ين') ? cut(2) : undefined;
    if (plural !== undefined) pending.push(plural, ...(stem.endsWith('ات') ? [`${plural}ه`] : []));
    // Tanween's alif: يومياً → يومي, مجاناً → مجان.
    const adverb = stem.endsWith('ا') ? cut(1) : undefined;
    if (adverb !== undefined) pending.push(adverb);
  }
  return [...forms];
}

/** The forms of a folded English word: plurals, possessive plurals, -ed and -ing. */
function englishForms(word: string): readonly string[] {
  const forms = new Set([word]);
  const keep = (stem: string): void => {
    if (stem.length >= MIN_STEM) forms.add(stem);
  };
  if (word.endsWith('ies')) keep(`${word.slice(0, -3)}y`);
  else if (/(?:ss|x|z|ch|sh)es$/u.test(word)) keep(word.slice(0, -2));
  // "quotes" → "quote"; never "glass" → "glas", "bus" → "bu".
  if (/[^su]s$/u.test(word)) keep(word.slice(0, -1));
  if (word.endsWith('ied')) keep(`${word.slice(0, -3)}y`);
  else if (word.endsWith('ed')) {
    keep(word.slice(0, -2));
    keep(word.slice(0, -1));
  }
  if (word.endsWith('ing')) {
    keep(word.slice(0, -3));
    keep(`${word.slice(0, -3)}e`);
  }
  return [...forms];
}

/** One section's reader: each distinct word's forms worked out once. */
function wordFormsReader(): FormsOf {
  const memo = new Map<string, readonly string[]>();
  return (word) => {
    let forms = memo.get(word);
    if (forms === undefined) {
      forms = /[0-9]/u.test(word)
        ? [word]
        : ARABIC_WORD.test(word)
          ? arabicForms(word)
          : englishForms(word);
      memo.set(word, forms);
    }
    return forms;
  };
}

/** A stop word, or one under its clitics: وفي · بها · ولكل · منها · عليه. */
function isStopWord(word: string): boolean {
  if (EN_STOP.has(word) || AR_STOP.has(word)) return true;
  if (!ARABIC_WORD.test(word)) return false;
  let rest = word;
  for (let peeled = 0; peeled < 2 && rest.length > 1; peeled += 1) {
    const first = rest.charAt(0);
    if (!AR_CONJUNCTIONS.has(first) && !AR_PREPOSITIONS.has(first)) break;
    rest = rest.slice(1);
    if (AR_STOP.has(rest)) return true;
  }
  const pronoun = AR_PRONOUNS.find(
    (ending) => word.endsWith(ending) && word.length > ending.length,
  );
  return pronoun !== undefined && AR_STOP.has(word.slice(0, -pronoun.length));
}

/** Folded text as words: the text itself, its words in order, and every form they take. */
interface Words {
  readonly text: string;
  readonly tokens: readonly string[];
  readonly forms: ReadonlySet<string>;
}

function wordsOf(folded: string, formsOf: FormsOf): Words {
  const tokens = folded === '' ? [] : folded.split(' ');
  const forms = new Set<string>();
  for (const token of tokens) for (const form of formsOf(token)) forms.add(form);
  return { text: folded, tokens, forms };
}

function wordSaid(word: string, words: Words, formsOf: FormsOf): boolean {
  return formsOf(word).some((form) => words.forms.has(form));
}

/** Two words are one: equal, or (neither a figure) sharing a form. A figure matches only itself. */
function sameWord(claimed: string, written: string, formsOf: FormsOf): boolean {
  if (claimed === written) return true;
  if (/[0-9]/u.test(claimed) || /[0-9]/u.test(written)) return false;
  const writtenForms = formsOf(written);
  return formsOf(claimed).some((form) => writtenForms.includes(form));
}

/** The claim's words, consecutive and in order, somewhere in the text: the claim verbatim, clitics aside. */
function phraseSaid(claimed: readonly string[], words: Words, formsOf: FormsOf): boolean {
  const { tokens } = words;
  for (let start = 0; start + claimed.length <= tokens.length; start += 1) {
    if (claimed.every((word, offset) => sameWord(word, tokens[start + offset] ?? '', formsOf))) {
      return true;
    }
  }
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * The folded phrase inside the folded text, with a number whole at either
 * edge: "open 7 days" is not in "open 17 days", nor "20%" in "2020".
 */
function containsPhrase(corpus: string, phrase: string): boolean {
  if (!/[0-9]/u.test(phrase)) return corpus.includes(phrase);
  const pattern = escapeRegExp(phrase);
  const before = /^[0-9]/u.test(phrase) ? '(?<![0-9.])' : '';
  const after = /[0-9]$/u.test(phrase) ? '(?![0-9.])' : '';
  return new RegExp(`${before}${pattern}${after}`, 'u').test(corpus);
}

interface ClaimTokens {
  readonly words: readonly string[];
  /** Each number as written, its "+" dropped either side: "+1200" and "1200+" say 1200. */
  readonly numbers: readonly string[];
}

function claimTokens(folded: string): ClaimTokens {
  const words: string[] = [];
  const numbers: string[] = [];
  for (const token of folded.split(' ')) {
    if (/[0-9]/u.test(token)) {
      numbers.push(token.replace(/^\++|\++$/gu, ''));
      continue;
    }
    if (token.length < 2) continue;
    if (isStopWord(token)) continue;
    words.push(token);
  }
  return { words, numbers };
}

/**
 * The claim is said: its words in order (clitics and inflections aside), or
 * every number and ¾ of its content words anywhere in the section, in any
 * order and any form — "خصم ٢٠٪ على الطلب الأول" is said by "خصم 20% على طلبك
 * الأول", "Fixed-price quotes" by "every job gets a fixed-price quote".
 */
function claimSaid(claim: string, page: Words, formsOf: FormsOf): boolean {
  const folded = foldForMatch(claim);
  if (folded === '' || phraseSaid(folded.split(' '), page, formsOf)) return true;
  const { words, numbers } = claimTokens(folded);
  if (words.length === 0 && numbers.length === 0) return false;
  if (!numbers.every((number) => containsPhrase(page.text, number))) return false;
  // Every number is there: "more than" is the stat's "+", not a word to find.
  const content = numbers.length > 0 ? words.filter((word) => !QUANTIFIERS.has(word)) : words;
  const needed = Math.ceil(content.length * 0.75);
  return content.filter((word) => wordSaid(word, page, formsOf)).length >= needed;
}

/**
 * The claim is repeated: its words in order (so "توصيل مجاني" repeats
 * "التوصيل المجاني"), or every token of a claim of three or more inside ONE
 * line of copy — a sentence that makes it again. Across the whole section,
 * three common words (توصيل · مجاني · عمّان) turn up in unrelated lines and
 * read as a repeat that is not one (verifier, 2026-09-28).
 */
function claimRepeated(
  claim: string,
  page: Words,
  lines: readonly Words[],
  formsOf: FormsOf,
): boolean {
  const folded = foldForMatch(claim);
  if (folded === '') return false;
  if (phraseSaid(folded.split(' '), page, formsOf)) return true;
  const { words, numbers } = claimTokens(folded);
  if (words.length + numbers.length < 3) return false;
  return lines.some(
    (line) =>
      words.every((word) => wordSaid(word, line, formsOf)) &&
      numbers.every((number) => containsPhrase(line.text, number)),
  );
}

/** Arabic-Indic (U+0660) and extended (U+06F0) digits as ASCII, everything else as written. */
function asciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/gu, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** The phone-shaped runs in a text: +, ( or 0, then seven digits or more. */
function phoneRuns(value: string): readonly string[] {
  const runs: string[] = [];
  for (const match of asciiDigits(value.replace(ISOLATES, '')).matchAll(PHONE_RUN)) {
    const run = match[0].trim();
    if (/^[+(0]/u.test(run) && run.replace(/[^0-9]/gu, '').length >= 7) runs.push(run);
  }
  return runs;
}

function phoneShaped(value: string): boolean {
  return phoneRuns(value).length > 0;
}

/** A fact written as its stand-in (see MASK_LETTERS), quoted as the page shows it; else undefined. */
function maskedValue(value: string): string | undefined {
  const plain = value.replace(ISOLATES, '').replace(/\s+/gu, ' ').trim();
  const shown = plain.length <= 60 ? plain : undefined;
  const mask = MASK_LETTERS.exec(plain)?.[0];
  if (mask !== undefined) return shown ?? mask;
  const masked = phoneRuns(plain).find((run) => MASKED_DIGITS.test(run.replace(/[^0-9]/gu, '')));
  if (masked !== undefined) return shown ?? masked;
  const address = PLACEHOLDER_ADDRESS.exec(plain)?.[0];
  return address === undefined ? undefined : (shown ?? address);
}

/** Each digit string of `value` worth matching: its whole digits, and each run's, seven or more. */
function numbersIn(value: string): readonly string[] {
  const plain = asciiDigits(value.replace(ISOLATES, ''));
  const whole = plain.replace(/[^0-9]/gu, '');
  const runs = [...plain.matchAll(PHONE_RUN)].map(([run]) => run.replace(/[^0-9]/gu, ''));
  return [whole, ...runs].filter((digits) => digits.length >= 7);
}

/** Whether two digit strings are one number: equal, or ending in the same seven digits or more. */
function sameNumber(one: string, two: string): boolean {
  if (one === two) return true;
  let shared = 0;
  while (
    shared < one.length &&
    shared < two.length &&
    one[one.length - 1 - shared] === two[two.length - 1 - shared]
  ) {
    shared += 1;
  }
  return shared >= 7;
}

/**
 * Whether a value's only stand-in is masked digits the PLAN itself gave — a
 * fact's sample or the action's number. The writer was told to copy those
 * exactly; flagging them is the checker contradicting the plan (fast-build
 * DESIGN §4, baseline bottleneck #4: wa.me/962791234567 in the CTA and
 * "+962 79 123 4567" in the FAQ cost a repair round and a 13 s hold).
 * A mask (XXX) or an example address is never the plan's to excuse.
 */
function planNumber(value: string, planNumbers: readonly string[]): boolean {
  if (planNumbers.length === 0) return false;
  const plain = value.replace(ISOLATES, '').replace(/\s+/gu, ' ').trim();
  if (MASK_LETTERS.test(plain) || PLACEHOLDER_ADDRESS.test(plain)) return false;
  const masked = phoneRuns(plain)
    .map((run) => run.replace(/[^0-9]/gu, ''))
    .filter((digits) => MASKED_DIGITS.test(digits));
  return (
    masked.length > 0 &&
    masked.every((digits) => planNumbers.some((known) => sameNumber(digits, known)))
  );
}

/** The field a line of text only names ("رقم الهاتف", "Company name"), if that is all it says. */
function fieldNamed(value: string): 'phone' | 'email' | 'name' | 'address' | undefined {
  const afterLabel = value.includes(':') ? (value.split(':').pop() ?? '') : value;
  const folded = foldForMatch(afterLabel)
    .replace(FIELD_INSTRUCTION, '')
    .replace(/ (?:هنا|here)$/u, '')
    .trim();
  return FIELD_NAMES.get(folded);
}

/*
  One address however it is typed: a trailing slash, the case of a scheme and
  host, and a phone number's spacing do not change where a link leads. The
  exact compare flagged "https://wa.me/962791234567/" as leading away from
  the action "https://wa.me/962791234567" — a repair model call for a button
  that worked.
*/
function targetKey(href: string): string {
  const trimmed = decodedHref(href.trim());
  // A WhatsApp chat is its number: the ?text= prefill is wording, not a destination.
  const whatsapp =
    /^(?:https?:\/\/)?(?:www\.)?wa\.me\/\+?([0-9٠-٩۰-۹]+)/iu.exec(trimmed)?.[1] ??
    /^(?:https?:\/\/)?(?:api|web)\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=\+?([0-9٠-٩۰-۹]+)/iu.exec(
      trimmed,
    )?.[1];
  if (whatsapp !== undefined) return `whatsapp:${asciiDigits(whatsapp)}`;
  if (/^tel:/iu.test(trimmed)) {
    return `tel:${asciiDigits(trimmed.slice(4)).replace(/[^0-9+]/gu, '')}`;
  }
  if (/^mailto:/iu.test(trimmed)) return trimmed.toLowerCase();
  const web = /^(https?:\/\/[^/?#]+)(.*)$/iu.exec(trimmed);
  const address = web === null ? trimmed : `${(web[1] ?? '').toLowerCase()}${web[2] ?? ''}`;
  return address.replace(/(?<=.)\/+(?=$|[?#])/u, '');
}

/** The href with its percent-escapes read; as written when they do not decode. */
function decodedHref(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function sameTarget(href: string | undefined, target: string): boolean {
  return href !== undefined && (href === target || targetKey(href) === targetKey(target));
}

function quoteList(values: readonly string[]): string {
  const shown = values.slice(0, MAX_LISTED).join(', ');
  return values.length > MAX_LISTED
    ? `${shown} and ${String(values.length - MAX_LISTED)} more`
    : shown;
}

function ratioText(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

/** Declarations inside the css's innermost blocks: property, value. */
function cssDeclarations(css: string): readonly [string, string][] {
  const found: [string, string][] = [];
  for (const block of css.matchAll(/\{([^{}]*)\}/gu)) {
    for (const declaration of (block[1] ?? '').split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      found.push([
        declaration.slice(0, colon).trim().toLowerCase(),
        declaration.slice(colon + 1).trim(),
      ]);
    }
  }
  return found;
}

function cssUrls(css: string): readonly string[] {
  const withoutImports = css.replace(/@import[^;]*;/giu, '');
  return [...withoutImports.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/giu)].map((match) =>
    (match[2] ?? '').trim(),
  );
}

const RAW_CSS_FUNCTION =
  /\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/giu;

function isBlackOrWhiteRgb(args: string): boolean {
  const channels = args
    .split(/[\s,/]+/u)
    .filter((part) => part !== '')
    .slice(0, 3)
    .map(Number);
  return (
    channels.length === 3 &&
    (channels.every((channel) => channel === 0) || channels.every((channel) => channel === 255))
  );
}

// ── R-colour-class: palette classes → the page's token classes, in code ────

/** The ground classes a `bg-` palette class may become, by the token each paints. */
const GROUND_TOKEN_CLASSES: readonly (readonly [keyof PagePlanTokens, string])[] = [
  ['bg', 'ck-ground'],
  ['surface', 'ck-surface'],
  ['accent', 'ck-accent-fill'],
  ['ink', 'ck-inverse'],
];
/** The text classes a `text-` palette class may become. */
const TEXT_TOKEN_CLASSES: readonly (readonly [keyof PagePlanTokens, string])[] = [
  ['ink', 'ck-ink'],
  ['muted', 'ck-muted'],
  ['accentInk', 'ck-accent-ink'],
];

function luminanceOf(hex: string): number {
  // contrastRatio against black is (L + 0.05) / 0.05: L recovered without a second helper.
  return ((contrastRatio(hex, '#000000') ?? 1) - 1) * 0.05;
}

/** The token class nearest in lightness (`target`, relative luminance) for this utility, or undefined (dropped). */
function tokenClassFor(
  property: string,
  target: number,
  tokens: PagePlanTokens,
): string | undefined {
  const table =
    property === 'bg' ? GROUND_TOKEN_CLASSES : property === 'text' ? TEXT_TOKEN_CLASSES : undefined;
  if (table === undefined)
    return /^border(?:-[trblxyse])?$/u.test(property) ? 'ck-border' : undefined;
  let best: { readonly name: string; readonly distance: number } | undefined;
  for (const [token, name] of table) {
    const value = tokens[token];
    if (typeof value !== 'string') continue;
    const distance = Math.abs(luminanceOf(value) - target);
    if (best === undefined || distance < best.distance) best = { name, distance };
  }
  return best?.name;
}

/**
 * Tailwind's shades by their rough relative luminance (v3, averaged over the
 * hues): enough to tell a ground from a card from an ink when the exact hex
 * is not in PAGE_PLAN_PALETTE_HEX, which holds the deck's shades only.
 */
const SHADE_LUMINANCE: Readonly<Record<string, number>> = {
  '50': 0.93,
  '100': 0.86,
  '200': 0.74,
  '300': 0.58,
  '400': 0.4,
  '500': 0.26,
  '600': 0.17,
  '700': 0.11,
  '800': 0.07,
  '900': 0.04,
  '950': 0.02,
};

/** The lightness a raw colour class paints with: its palette shade or its bracketed hex. */
function rawClassLuminance(base: string): number | undefined {
  const value = COLOUR_UTILITY.exec(base)?.[2] ?? '';
  const palette = PALETTE_VALUE.exec(value);
  if (palette !== null) {
    const name = palette[1] ?? '';
    const hex = PAGE_PLAN_PALETTE_HEX[name];
    return hex === undefined ? SHADE_LUMINANCE[name.split('-').at(-1) ?? ''] : luminanceOf(hex);
  }
  const inner = /^\[(?:color:)?(#[0-9a-f]{3,8})\]$/iu.exec(value)?.[1];
  return inner !== undefined && HEX.test(inner) ? luminanceOf(normalHex(inner)) : undefined;
}

/**
 * A class list with every colour class the checker would call `raw-colour`
 * moved onto the page's tokens (fix pass 2026-10-05): a bare `bg-blue-50`
 * becomes the token class nearest in lightness (`ck-surface`), a `text-`
 * one `ck-ink` / `ck-muted` / `ck-accent-ink`, a `border-` one `ck-border`;
 * one behind a variant (`hover:`, `md:`), with an opacity, or of another
 * utility (gradients, rings) is dropped. The same list comes back when
 * nothing changes. English run: the features writer's `bg-blue-50` cost a
 * repair round while five finished sections below it waited to land.
 */
export function tokenisePaletteClasses(className: string, tokens: PagePlanTokens): string {
  const planHexes = new Set<string>([
    tokens.bg,
    tokens.surface,
    tokens.ink,
    tokens.muted,
    tokens.accent,
    tokens.onAccent,
    tokens.accentInk,
    tokens.border,
  ]);
  const names = className.split(/\s+/u).filter((name) => name !== '');
  let changed = false;
  const out: string[] = [];
  for (const name of names) {
    const read = readColourClass(name, planHexes);
    if (read?.read.kind !== 'raw') {
      out.push(name);
      continue;
    }
    changed = true;
    const { base, variants } = baseUtility(name);
    const lightness = variants || read.translucent ? undefined : rawClassLuminance(base);
    const replacement =
      lightness === undefined ? undefined : tokenClassFor(read.property, lightness, tokens);
    if (replacement !== undefined && !out.includes(replacement) && !names.includes(replacement)) {
      out.push(replacement);
    }
  }
  return changed ? out.join(' ') : className;
}

const MARKUP_CLASS = /(\bclass\s*=\s*)(["'])([^"']*)\2/gu;

/**
 * `tokenisePaletteClasses` over a writer's step arguments: every `className`
 * in a tree, and every `class` in tree markup. The same value comes back when
 * nothing changed, so a caller can tell by identity.
 */
export function tokeniseColourClasses(value: unknown, tokens: PagePlanTokens): unknown {
  if (typeof value === 'string') {
    if (!isTreeMarkup(value)) return value;
    const next = value.replace(
      MARKUP_CLASS,
      (whole: string, open: string, quote: string, list: string) => {
        const tidied = tokenisePaletteClasses(list, tokens);
        return tidied === list ? whole : `${open}${quote}${tidied}${quote}`;
      },
    );
    return next;
  }
  if (Array.isArray(value)) {
    const items = (value as readonly unknown[]).map((item) => tokeniseColourClasses(item, tokens));
    return items.some((item, index) => item !== value[index]) ? items : value;
  }
  if (typeof value === 'object' && value !== null) {
    const before = Object.entries(value);
    const entries = before.map(([key, item]) => {
      const next =
        key === 'className' && typeof item === 'string'
          ? tokenisePaletteClasses(item, tokens)
          : tokeniseColourClasses(item, tokens);
      return [key, next] as const;
    });
    const changed = entries.some(([, next], index) => next !== before[index]?.[1]);
    // fromEntries defines own properties, so a "__proto__" key stays data.
    return changed ? Object.fromEntries(entries) : value;
  }
  return value;
}

/**
 * Step E of the page build: the deterministic lint every section passes as it
 * lands (agent-audit §3.1, evaluator-optimizer). No model call.
 *
 * Holds one landed section to its contract and the page's tokens, returning
 * one `SectionCheckIssue` per defect (see `SectionCheckCode` for the list):
 * the anchor id on the outer element and every `#link` naming a section that
 * exists or an id inside this section; one h1 on the page and only in the
 * hero; a link styled as a button to `primaryCta.href` (a trailing slash, the
 * host's case and a phone's spacing aside) labelled
 * `primaryCta.label` (folded: case, hamza, an arrow glyph aside), the action's
 * words on no link that leads elsewhere, and the hero and a `cta` section
 * carrying that action; no `[placeholder]`, lorem or scaffold text and no fact
 * left as its stand-in (a mask like "+971 4 XXX XXXX", masked digits like
 * "0000000", an example.com address, a field's name like «رقم الهاتف» where
 * its value belongs); image addresses from the photo catalog, the request, or
 * `data:` only — in `src`, component props, arbitrary classes
 * (`bg-[url(…)]`) and the region css alike; colour by token (the kit's `ck-`
 * classes, `var(--ck-*)`, or a palette class that IS one of the plan's
 * colours — never a hex, a colour function or a named colour, in a class or
 * the css), accent-coloured text through `accentInk` when the accent does not
 * read as text, and every text pair it can resolve at ≥ 4.5:1 (3:1 for display
 * sizes); every `mustSay` said and no `mustNotRepeat` repeated, matched word
 * by word in every form a word takes (Arabic clitics, possessives and plurals;
 * English plurals, possessives and -ed/-ing; digits in either script); only
 * the page's loaded font families, in css and arbitrary classes: bespoke
 * sections may declare additional verified fonts from the approved hosts.
 *
 * `missing-anchor` also carries a link to a section that does not exist and an
 * id that belongs to another section — the same broken jump, seen from the
 * other end. `placeholder-left` carries the stand-in facts; `cta-label` the
 * action's words on a link that leads elsewhere.
 *
 * Each message is the repair instruction the writer's one repair round
 * receives (`attempt.issues`); a defect repeated across the tree is reported
 * once, and the whole list is capped, so the round stays one short brief. An
 * empty array means the section passes.
 *
 * Pure and synchronous; never throws on any tree, however malformed — a
 * markup string is read as the door reads one.
 */
export function checkSection(
  plan: PagePlan,
  contract: SectionContract,
  landed: LandedSection,
  options: CheckSectionOptions = {},
): readonly SectionCheckIssue[] {
  const issues: SectionCheckIssue[] = [];
  const add = (code: SectionCheckCode, message: string, path?: string): void => {
    issues.push(path === undefined ? { code, message } : { code, message, path });
  };
  const { tokens } = plan;
  const grounds = pageKitGrounds(tokens);
  const planHexes = new Set<string>([
    tokens.bg,
    tokens.surface,
    tokens.ink,
    tokens.muted,
    tokens.accent,
    tokens.onAccent,
    tokens.accentInk,
    tokens.border,
  ]);
  const anchors = new Map(plan.sections.map((section) => [section.anchorId, section] as const));
  const css = typeof landed.css === 'string' ? landed.css : '';
  const nodes = walkLandedTree(landed.tree);
  const elements = nodes.filter(({ node }) => node['kind'] === 'element');
  const tagOf = (entry: LandedNode): string =>
    typeof entry.node['tag'] === 'string' ? entry.node['tag'] : '';

  // ── anchors ──
  const outer = elements.filter(({ depth }) => depth === 1);
  if (!outer.some(({ node }) => attribute(node, 'id') === contract.anchorId)) {
    add(
      'missing-anchor',
      `Put id="${contract.anchorId}" on this section's outer element — the nav and the page's links jump to it.`,
      `${outer[0]?.path ?? 'tree.children[0]'}.attributes.id`,
    );
  }
  for (const entry of elements) {
    const id = attribute(entry.node, 'id');
    const owner = id === undefined ? undefined : anchors.get(id);
    if (owner !== undefined && owner.key !== contract.key) {
      add(
        'missing-anchor',
        `Remove id="${id ?? ''}": it is the anchor of the section "${owner.title}", and a second one breaks its links.`,
        `${entry.path}.attributes.id`,
      );
    }
  }
  // In-section targets are valid alongside the page's section anchors.
  const ownIds = new Set<string>();
  for (const entry of elements) {
    const id = attribute(entry.node, 'id');
    if (id !== undefined) ownIds.add(id);
  }
  const brokenLinks = new Map<string, string>();
  for (const entry of elements) {
    const href = attribute(entry.node, 'href');
    if (!href?.startsWith('#')) continue;
    const target = href.slice(1);
    if (target === '' || (!anchors.has(target) && !ownIds.has(target))) {
      if (!brokenLinks.has(href)) brokenLinks.set(href, `${entry.path}.attributes.href`);
    }
  }
  for (const [href, path] of brokenLinks) {
    add(
      'missing-anchor',
      `The link "${href}" points at no section: link to one of ${quoteList(
        plan.sections.map(({ anchorId }) => `#${anchorId}`),
      )}, or remove it.`,
      path,
    );
  }

  // ── headings ──
  const headingsOne = elements.filter((entry) => tagOf(entry) === 'h1');
  if (contract.role === 'hero') {
    if (headingsOne.length === 0) {
      add(
        'heading-level',
        `This is the hero: write the page's one h1 here (its headline, "${contract.title}" or better).`,
      );
    } else if (headingsOne.length > 1) {
      add(
        'heading-level',
        `Keep one h1 in the hero; make the other ${String(headingsOne.length - 1)} an h2.`,
        headingsOne[1]?.path,
      );
    }
  } else if (headingsOne.length > 0) {
    add(
      'heading-level',
      "Make this h1 an h2: the page's one h1 is in the hero, and this section is not the hero.",
      headingsOne[0]?.path,
    );
  }

  // Authored pages need no sales CTA; links that carry it still keep the declared destination.
  const cta = plan.primaryCta;
  const ctaLabel = collapse(cta.label);
  /* The action's words, folded: "Get a quote →" (an arrow glyph after the
    words) and "اطلب الان" (no hamza) are the action's label; relabelling them
    cost a repair round for a button that was right.
  */
  const ctaWords = foldForMatch(ctaLabel);
  const saysAction = (label: string): boolean =>
    label === ctaLabel || (ctaWords !== '' && foldForMatch(label) === ctaWords);
  const actions = elements.filter((entry) => tagOf(entry) === 'a' || tagOf(entry) === 'button');
  const labels = landedTexts(nodes, actions);
  /*
    A link that LOOKS like a button: the kit's button, or a filled link with
    no block content of its own and a button-length label. A filled card that
    links to the order section (`<a class='block bg-white p-6'><h3>…<p>…</a>`)
    is a card; asking it to relabel itself "اطلب الآن" broke the menu
    (verifier, 2026-09-28).
  */
  const holdsBlocks = new Set<LandedNode>();
  for (const entry of elements) {
    if (entry.parent !== undefined && BLOCK_CONTENT.has(tagOf(entry).toLowerCase())) {
      holdsBlocks.add(entry.parent);
    }
  }
  const buttonLike = (entry: LandedNode, label: string): boolean => {
    const classes = classesOf(entry.node).filter((name) => !name.includes(':'));
    if (classes.includes('ck-btn')) return !classes.includes('ck-btn--ghost');
    const filled = classes.some((name) => {
      const colour = readColourClass(name, planHexes);
      return colour?.property === 'bg' && !name.endsWith('-transparent');
    });
    if (!filled || label.length > Math.max(BUTTON_LABEL_MAX, ctaLabel.length * 2)) return false;
    return !holdsBlocks.has(entry);
  };
  let carriesAction = false;
  let deadButton: LandedNode | undefined;
  const wrongLabels = new Map<string, string>();
  // Navigation with the action's label must keep its destination, even beside valid page JS.
  const misdirected = new Map<string, LandedNode>();
  const buttonActions = sectionButtonActions(elements, landed.js);
  for (const entry of actions) {
    const label = labels.get(entry) ?? '';
    const href = attribute(entry.node, 'href')?.trim();
    if (tagOf(entry) === 'button') {
      if (saysAction(label) || sameTarget(href, cta.href)) {
        if (buttonActions.has(entry)) carriesAction = true;
        else deadButton ??= entry;
      }
      continue;
    }
    if (!sameTarget(href, cta.href)) {
      if (saysAction(label) && !misdirected.has(href ?? '')) misdirected.set(href ?? '', entry);
      continue;
    }
    if (saysAction(label)) carriesAction = true;
    else if (buttonLike(entry, label) && !wrongLabels.has(label)) {
      wrongLabels.set(label, entry.path);
    }
  }
  for (const [label, path] of wrongLabels) {
    add(
      'cta-label',
      `This button leads to ${cta.href}, the page's action: label it exactly "${cta.label}" (it says "${label}"), the same words on every button that asks for it.`,
      path,
    );
  }
  for (const [href, entry] of misdirected) {
    add(
      'cta-label',
      `This link says the page's action "${cta.label}" but leads to ${href === '' ? 'nowhere' : href}: point it at the action — <a href='${cta.href}' class='ck-btn'>${cta.label}</a> — or give it words of its own.`,
      `${entry.path}.attributes.href`,
    );
  }
  if (deadButton !== undefined) {
    add(
      'cta-label',
      plan.design?.composition === 'bespoke'
        ? `Wire this action button to a supported native behavior or an explicit permitted click handler. For navigation, use a link: <a href='${cta.href}' class='ck-btn'>${cta.label}</a>; href on a button does not navigate.`
        : `Make the page's action a link: <a href='${cta.href}' class='ck-btn'>${cta.label}</a>. A button needs a supported native behavior or explicit permitted click handler; href on a button does not navigate.`,
      deadButton.path,
    );
  } else if (
    !carriesAction &&
    misdirected.size === 0 &&
    plan.design?.composition !== 'bespoke' &&
    (contract.role === 'hero' || contract.role === 'cta')
  ) {
    add(
      'cta-label',
      `Add the page's action to this section: <a href='${cta.href}' class='ck-btn'>${cta.label}</a>.`,
    );
  }

  // ── placeholders ──
  const personal = plan.design?.kind === 'resume' || plan.design?.kind === 'portfolio';
  const missingFacts = plan.design !== undefined;
  const shown: { value: string; path: string; line?: LandedNode }[] = [];
  for (const entry of nodes) {
    const own = text(entry.node['text']);
    if (own !== undefined) shown.push({ value: own, path: entry.path, line: entry });
    for (const name of ['alt', 'title', 'aria-label']) {
      const value = attribute(entry.node, name);
      if (value !== undefined)
        shown.push({ value, path: `${entry.path}.attributes.${name}`, line: entry });
    }
    const label = text(entry.node['label']);
    if (label !== undefined) shown.push({ value: label, path: `${entry.path}.label`, line: entry });
    if (entry.node['kind'] === 'component') {
      for (const [key, value] of componentStrings(entry.node)) {
        if (!/^(?:https?:|data:|\/)/u.test(value))
          shown.push({ value, path: `${entry.path}.${key}`, line: entry });
      }
    }
  }
  const placeholders = new Map<string, { path: string; fact: boolean }>();
  for (const { value, path, line } of shown) {
    const folded = foldForMatch(value);
    const found =
      [...value.matchAll(new RegExp(BRACKETED, 'gu'))].find(
        ([label]) => !missingFacts || !plainMissingFact(label, line),
      )?.[0] ??
      MUSTACHE.exec(value)?.[0] ??
      LOREM.exec(value)?.[0] ??
      ARABIC_FILLER.find((phrase) => folded.includes(foldForMatch(phrase))) ??
      SCAFFOLD_LEFTOVERS.find((phrase) => value.includes(phrase));
    if (found !== undefined && !placeholders.has(found)) {
      placeholders.set(found, { path, fact: false });
    }
  }
  // Facts written as their stand-ins: a mask, masked digits, an example address, a field's name.
  const hrefs = elements.flatMap((entry) => {
    const href = attribute(entry.node, 'href')?.trim();
    return href === undefined ? [] : [{ href, path: `${entry.path}.attributes.href` }];
  });
  const planNumbers = [...plan.facts.map(({ sample }) => sample), cta.href].flatMap(numbersIn);
  const realValue = (value: string): boolean =>
    maskedValue(value) === undefined || (!missingFacts && planNumber(value, planNumbers));
  const showsPhone =
    hrefs.some(({ href }) => href.startsWith('tel:') && realValue(href.slice(4))) ||
    shown.some(({ value }) => phoneShaped(value) && realValue(value));
  const showsEmail =
    hrefs.some(({ href }) => href.startsWith('mailto:') && realValue(href)) ||
    shown.some(({ value }) => EMAIL_VALUE.test(value) && realValue(value));
  for (const { value, path, line } of shown) {
    const masked = maskedValue(value);
    if (masked !== undefined) {
      if ((missingFacts || !planNumber(value, planNumbers)) && !placeholders.has(masked)) {
        placeholders.set(masked, { path, fact: true });
      }
      continue;
    }
    if (missingFacts && plainMissingFact(value.trim(), line)) continue;
    if (personal || line === undefined || LABEL_TAGS.has(tagOf(line).toLowerCase())) continue;
    const field = fieldNamed(value);
    if (field === undefined || (field === 'phone' && showsPhone)) continue;
    if (field === 'email' && showsEmail) continue;
    const quoted = collapse(value);
    if (!placeholders.has(quoted)) placeholders.set(quoted, { path, fact: true });
  }
  for (const { href, path } of hrefs) {
    // Only saved plans without a design contract retain the legacy sample-action exemption.
    if (
      (!missingFacts && sameTarget(href, cta.href)) ||
      !/^(?:tel:|mailto:|https?:|\/\/)/iu.test(href)
    )
      continue;
    const address = decodedHref(href.replace(/^(?:tel:|mailto:)/iu, ''));
    const masked =
      maskedValue(address) ??
      (missingFacts ? (BRACKETED.exec(address)?.[0] ?? MUSTACHE.exec(address)?.[0]) : undefined);
    if (
      masked !== undefined &&
      (missingFacts || !planNumber(address, planNumbers)) &&
      !placeholders.has(masked)
    ) {
      placeholders.set(masked, { path, fact: true });
    }
  }
  for (const [found, { path, fact }] of [...placeholders].slice(0, MAX_PLACEHOLDERS)) {
    add('placeholder-left', missingFactAdvice(found, missingFacts, fact), path);
  }

  // ── images ──
  const request = options.request ?? '';
  const imageAllowed = (url: string): boolean => {
    const address = url.replaceAll('&amp;', '&').trim();
    return (
      address.startsWith('data:') ||
      isVerifiedImageUrl(address) ||
      (request !== '' && request.includes(address))
    );
  };
  const subjects = (contract.images ?? []).map(({ subject }) => subject);
  const photoAdvice =
    subjects.length === 0
      ? 'use a photo from PHOTOS YOU MAY USE, or build the moment from type and colour'
      : `use a ${quoteList([...new Set(subjects)])} photo from PHOTOS YOU MAY USE`;
  const foreign = new Map<string, string>();
  for (const entry of nodes) {
    const src = attribute(entry.node, 'src');
    if (src !== undefined && !imageAllowed(src)) foreign.set(src, `${entry.path}.attributes.src`);
    /*
      A photo in an arbitrary value — `bg-[url('https://images.unsplash.com/…')]`,
      `[background-image:url(…)]` — is a photo all the same: the live oracle
      generates it, so the door admits it, and it passed here unread
      (verifier, 2026-09-28).
    */
    for (const name of classesOf(entry.node)) {
      if (!name.includes('url(')) continue;
      for (const match of name.matchAll(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/giu)) {
        const url = (match[2] ?? '').trim();
        if (url !== '' && !imageAllowed(url) && !foreign.has(url)) {
          foreign.set(url, `${entry.path}.className`);
        }
      }
    }
    if (entry.node['kind'] === 'component') {
      for (const [key, value] of componentStrings(entry.node)) {
        if (
          /^(?:https?:)?\/\//u.test(value) &&
          /(?:src|image|photo|avatar|logo|background|url)/iu.test(key) &&
          !imageAllowed(value)
        ) {
          foreign.set(value, `${entry.path}.${key}`);
        }
      }
    }
  }
  for (const url of cssUrls(css)) {
    if (!imageAllowed(url) && !foreign.has(url)) foreign.set(url, 'css');
  }
  for (const [url, path] of foreign) {
    add(
      'foreign-image',
      `Replace the image ${url}: ${photoAdvice}, or the request's own — an address written from memory is often a broken picture.`,
      path,
    );
  }

  // ── colour: classes ──
  const rawClasses = new Map<string, string>();
  for (const entry of nodes) {
    for (const name of classesOf(entry.node)) {
      if (readColourClass(name, planHexes)?.read.kind === 'raw' && !rawClasses.has(name)) {
        rawClasses.set(name, `${entry.path}.className`);
      }
    }
  }
  // ── colour: the region css ──
  const rawLiterals: string[] = [];
  let accentInCss = false;
  for (const [property, value] of cssDeclarations(css)) {
    for (const hex of value.match(/#[0-9a-f]{3,8}\b/giu) ?? []) {
      const normal = normalHex(hex);
      if (!planHexes.has(normal) && normal !== '#000000' && normal !== '#ffffff')
        rawLiterals.push(hex);
      else if (property === 'color' && normal === tokens.accent) accentInCss = true;
    }
    for (const match of value.matchAll(RAW_CSS_FUNCTION)) {
      const name = (match[1] ?? '').toLowerCase();
      const args = match[2] ?? '';
      if (args.includes('var(')) continue;
      if (name.startsWith('rgb') && isBlackOrWhiteRgb(args)) continue;
      rawLiterals.push(match[0]);
    }
    // `color:crimson;background:gold` is a colour literal too, named instead of numbered.
    if (COLOUR_DECLARATION.test(property)) rawLiterals.push(...namedColoursIn(value));
    if (property === 'color' && value.includes('var(--ck-accent)')) accentInCss = true;
  }
  const raw = [...rawClasses.keys(), ...new Set(rawLiterals)];
  if (raw.length > 0 && plan.design?.composition !== 'bespoke') {
    add(
      'raw-colour',
      `Colour with the page's tokens, not ${quoteList(raw)}: grounds ck-ground, ck-surface, ck-card, ck-inverse or ck-accent-fill; text ck-ink, ck-muted or ck-accent-ink; hairlines ck-border; buttons ck-btn; in the region css var(--ck-bg), var(--ck-ink), var(--ck-accent) and the rest. Black and white tints (bg-black/50) are fine.`,
      rawClasses.values().next().value ?? 'css',
    );
  }

  // ── contrast ──
  const accentIsText = tokens.accent === tokens.accentInk;
  const accentRatio = Math.min(
    contrastRatio(tokens.accent, tokens.bg) ?? 0,
    contrastRatio(tokens.accent, tokens.surface) ?? 0,
  );
  const accentAdvice = (what: string) =>
    `Colour accent text with ck-accent-ink (${tokens.accentInk}), not ${what}: the accent ${tokens.accent} is ${ratioText(accentRatio)}:1 on this page's ground — it is a fill, not a text colour.`;
  const contexts = new Map<LandedNode | undefined, ColourContext>([
    [undefined, { kit: 'page', ground: undefined, ink: grounds.page.ink }],
  ]);
  const pairs = new Set<string>();
  const accentTexts = new Map<string, string>();
  for (const entry of nodes) {
    const parentContext = contexts.get(entry.parent) ?? {
      kit: 'page' as const,
      ground: undefined,
      ink: grounds.page.ink,
    };
    const children = entry.node['children'];
    const overlaid =
      Array.isArray(children) &&
      children.some((child) => isRecord(child) && classesOf(child).includes('absolute'));
    const { context, textClass } = resolveColours(
      entry.node,
      parentContext,
      grounds,
      planHexes,
      overlaid,
    );
    contexts.set(entry, context);
    if (
      !accentIsText &&
      context.kit === 'page' &&
      textClass !== undefined &&
      (textClass.hex === tokens.accent || textClass.name.endsWith('[var(--ck-accent)]'))
    ) {
      if (!accentTexts.has(textClass.name)) accentTexts.set(textClass.name, entry.path);
      continue;
    }
    if (text(entry.node['text']) === undefined) continue;
    const { ground, ink } = context;
    if (ground === undefined || ink === undefined) continue;
    const ratio = contrastRatio(ink, ground);
    if (ratio === undefined) continue;
    const tag = typeof entry.node['tag'] === 'string' ? entry.node['tag'] : '';
    const large =
      tag === 'h1' ||
      tag === 'h2' ||
      classesOf(entry.node).some((name) => /text-[2-9]xl$/u.test(name));
    const required = large ? AA_LARGE : AA;
    const pair = `${ink}/${ground}`;
    if (ratio >= required || pairs.has(pair)) continue;
    pairs.add(pair);
    add(
      'contrast',
      `Text ${ink} on ${ground} is ${ratioText(ratio)}:1 — below the ${String(required)}:1 it needs. Use the ground's own text colour (ck-ink or ck-muted inside ck-ground, ck-surface, ck-inverse or ck-accent-fill).`,
      entry.path,
    );
  }
  for (const [name, path] of accentTexts) add('contrast', accentAdvice(name), path);
  if (!accentIsText && accentInCss) {
    add('contrast', accentAdvice('the accent as a css color (use var(--ck-accent-ink))'), 'css');
  }

  // ── faces ──
  issues.push(
    ...checkSectionFonts(plan, css, nodes, {
      classesOf,
      baseUtility: (name) => baseUtility(name).base,
      declarations: cssDeclarations,
    }),
  );

  // ── what it says ──
  const formsOf = wordFormsReader();
  const texts = shown.map(({ value }) => foldForMatch(value));
  const page = wordsOf(texts.join(' '), formsOf);
  /*
    A repeat is held to one LINE of copy: each text on its own, and each line
    element with the inline tags inside it — markup splits "على الطلب الأول:
    <strong>خصم ٢٠٪</strong>" into two text nodes (parseTreeMarkup). A div,
    li or link that holds a whole card is not one line.
  */
  const lines = elements.filter((entry) => LINE_ELEMENTS.has(tagOf(entry).toLowerCase()));
  const lineWords = [
    ...texts,
    ...[...landedTexts(nodes, lines).values()].map((line) => foldForMatch(line)),
  ].map((line) => wordsOf(line, formsOf));
  for (const claim of contract.mustSay) {
    if (!claimSaid(claim, page, formsOf)) {
      add(
        'must-say',
        `Say "${claim}" in this section, in these words or close to them — the plan gives it to "${contract.title}".`,
      );
    }
  }
  for (const claim of contract.mustNotRepeat) {
    if (claimRepeated(claim, page, lineWords, formsOf)) {
      add(
        'repeats',
        `Remove "${claim}": another section already says it. Say what only "${contract.title}" can.`,
      );
    }
  }

  return Object.freeze(issues.slice(0, MAX_ISSUES));
}
