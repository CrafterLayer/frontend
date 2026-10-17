/**
 * One utility ⇄ one (property, value, sides): the codec behind the engine.
 *
 * `matchUtility` answers "which catalogue property does this class set, to
 * what, on which logical sides?"; `writeUtility` is its inverse. Both read the
 * catalogue, so a property is readable exactly when it is writable — the
 * property test in this folder holds the two equal.
 */
import { DEFAULT_PALETTE_FAMILIES } from './palette-families';
import {
  STYLE_PROPERTIES,
  STYLE_PROPERTY_IDS,
  type StylePropertyDef,
  type StylePropertyId,
  type StyleRawKind,
} from './catalogue';
import {
  arbitraryHint,
  decodeArbitrary,
  encodeArbitrary,
  isArbitrary,
  PALETTE_ID,
  paletteIdOf,
  rawValueProblem,
} from './class-syntax';
import { COLOR_TOKENS, CONTAINER_TOKENS, SPACING_TOKENS } from './token-utilities';
import type { StyleBoxSide, StyleCorner, StyleSide, StyleValue } from './types';

export type LogicalSlot = StyleBoxSide | StyleCorner;

export interface UtilityMatch {
  readonly property: StylePropertyId;
  readonly value: StyleValue;
  /** Sided properties: the logical sides this class sets. */
  readonly sides?: readonly LogicalSlot[];
  /** Sided precedence, as Tailwind orders the CSS: 0 all, 1 pair, 2 one side. */
  readonly level?: number;
  /** A physical class that is replaced when any of these sides is written, never read. */
  readonly overlaps?: readonly LogicalSlot[];
  /** Read through a two-axis shorthand (`size-8`, `overflow-hidden`). */
  readonly shorthand?: {
    readonly prefix: string;
    readonly counterpart: string;
    readonly suffix: string;
  };
  /** The `rtl:` half of the gradient-direction pair. */
  readonly rtlPartner?: true;
}

// ── Token and raw-value recognition ────────────────────────────────────────

const BASE_COLORS = new Set(['white', 'black', 'transparent', 'current', 'inherit']);
const COLOR_TOKEN_SET = new Set(COLOR_TOKENS);
const SPACING_TOKEN_SET = new Set(SPACING_TOKENS);
const PALETTE_SHADE = new RegExp(
  `^(?:${DEFAULT_PALETTE_FAMILIES.join('|')})-(?:50|[1-9]00|950)$`,
  'u',
);
const CONTAINER_SCALE = new Set([
  ...CONTAINER_TOKENS,
  '3xs',
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
]);
const INLINE_KEYWORDS = new Set([
  'auto',
  'full',
  'screen',
  'fit',
  'min',
  'max',
  'px',
  'none',
  'dvw',
  'svw',
  'lvw',
]);
const BLOCK_KEYWORDS = new Set([
  'auto',
  'full',
  'screen',
  'fit',
  'min',
  'max',
  'px',
  'none',
  'dvh',
  'svh',
  'lvh',
  'lh',
]);
const STEP = /^(?:\d+|\d*\.(?:25|5|75))$/u;
const NUMBER = /^\d+(?:\.\d+)?$/u;
const FRACTION = /^\d+\/\d+$/u;

function isColorToken(token: string): boolean {
  const [name = '', alpha, extra] = token.split('/');
  if (extra !== undefined) return false;
  if (alpha !== undefined && !/^\d{1,3}$/u.test(alpha)) return false;
  return COLOR_TOKEN_SET.has(name) || BASE_COLORS.has(name) || PALETTE_SHADE.test(name);
}

function isSpacing(token: string): boolean {
  return STEP.test(token) || token === 'px' || SPACING_TOKEN_SET.has(token);
}

/** Whether `token` (unsigned) is one of this property's tokens. */
export function tokenAccepts(def: StylePropertyDef, token: string): boolean {
  if (token === '' || token === def.bare) return false;
  if (def.scale?.includes(token) === true) return true;
  const kind = def.tokens ?? 'list';
  switch (kind) {
    case 'color':
      return isColorToken(token);
    case 'spacing':
      return isSpacing(token);
    case 'inline-size':
      return (
        isSpacing(token) ||
        FRACTION.test(token) ||
        INLINE_KEYWORDS.has(token) ||
        CONTAINER_SCALE.has(token)
      );
    case 'block-size':
      return isSpacing(token) || FRACTION.test(token) || BLOCK_KEYWORDS.has(token);
    case 'number':
      return NUMBER.test(token);
    case 'list':
      return false;
  }
}

const COLOR_FUNCTION =
  /^(?:#[0-9a-f]{3,8}$|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\()/iu;
const LENGTH_LIKE = /^-?(?:\d|\.\d)|^(?:calc|min|max|clamp)\(/u;
const IMAGE_LIKE =
  /^(?:url|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|image-set)\(/iu;
const PLAIN_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/u;

function looksColor(css: string): boolean {
  return COLOR_FUNCTION.test(css) || /^(?:transparent|currentcolor)$/iu.test(css);
}

const HINT_FOR: Readonly<Record<StyleRawKind, string | undefined>> = {
  color: 'color',
  length: 'length',
  number: 'number',
  image: 'image',
  family: 'family-name',
  shadow: 'shadow',
  any: undefined,
};

function rawAccepts(
  kind: StyleRawKind | undefined,
  css: string,
  hint: string | undefined,
): boolean {
  switch (kind) {
    case undefined:
      return false;
    case 'any':
      return true;
    case 'color':
      return hint === 'color' || (hint === undefined && looksColor(css));
    case 'length':
      return (
        hint === 'length' ||
        hint === 'percentage' ||
        (hint === undefined && LENGTH_LIKE.test(css) && !looksColor(css))
      );
    case 'number':
      return (
        hint === 'number' || hint === 'integer' || (hint === undefined && PLAIN_NUMBER.test(css))
      );
    case 'image':
      return hint === 'image' || hint === 'url' || (hint === undefined && IMAGE_LIKE.test(css));
    case 'family':
      return (
        hint === 'family-name' ||
        (hint === undefined && !PLAIN_NUMBER.test(css) && !looksColor(css))
      );
    case 'shadow':
      return (
        hint === 'shadow' || (hint === undefined && !looksColor(css) && !PLAIN_NUMBER.test(css))
      );
  }
}

const VARIABLE_SUFFIX = /^\((?:([a-z-]+):)?(--[A-Za-z0-9_-]+)\)$/u;

/** The value a suffix (the part after the prefix) carries for this property. */
export function classifySuffix(
  def: StylePropertyDef,
  suffix: string,
  negative: boolean,
): StyleValue | undefined {
  if (negative && def.negative !== true) return undefined;
  if (suffix.startsWith('(')) {
    if (negative) return undefined;
    const palette = paletteIdOf(suffix);
    if (palette !== undefined && def.palette === true) return { kind: 'palette', id: palette };
    const variable = VARIABLE_SUFFIX.exec(suffix);
    if (variable === null) return undefined;
    const css = `var(${variable[2] ?? ''})`;
    return rawAccepts(def.raw, css, variable[1]) ? { kind: 'raw', css } : undefined;
  }
  if (isArbitrary(suffix)) {
    if (negative) return undefined;
    const inner = suffix.slice(1, -1);
    const css = decodeArbitrary(inner);
    return rawAccepts(def.raw, css, arbitraryHint(inner)) ? { kind: 'raw', css } : undefined;
  }
  if (!tokenAccepts(def, suffix)) return undefined;
  return { kind: 'token', token: negative ? `-${suffix}` : suffix };
}

// ── Indexes over the catalogue ─────────────────────────────────────────────

interface OptionHit {
  readonly property: StylePropertyId;
  readonly value: string;
}

const OPTION_INDEX = new Map<string, OptionHit>();
const RTL_INDEX = new Map<string, OptionHit>();

interface SidedPrefix {
  readonly property: StylePropertyId;
  readonly prefix: string;
  readonly sides: readonly LogicalSlot[];
  readonly level: number;
  readonly overlaps?: readonly LogicalSlot[];
}

interface PlainPrefix {
  readonly property: StylePropertyId;
  readonly prefix: string;
  readonly shorthand?: { readonly prefix: string; readonly counterpart: string };
  readonly allowBare: boolean;
}

const SIDED: SidedPrefix[] = [];
const PLAIN: PlainPrefix[] = [];

const BOX_GROUP: Readonly<Record<string, readonly LogicalSlot[]>> = {
  all: ['block-start', 'block-end', 'inline-start', 'inline-end'],
  block: ['block-start', 'block-end'],
  inline: ['inline-start', 'inline-end'],
  'block-start': ['block-start'],
  'block-end': ['block-end'],
  'inline-start': ['inline-start'],
  'inline-end': ['inline-end'],
};

const CORNER_GROUP: Readonly<Record<string, readonly LogicalSlot[]>> = {
  all: ['start-start', 'start-end', 'end-start', 'end-end'],
  'inline-start': ['start-start', 'end-start'],
  'inline-end': ['start-end', 'end-end'],
  'block-start': ['start-start', 'start-end'],
  'block-end': ['end-start', 'end-end'],
  'start-start': ['start-start'],
  'start-end': ['start-end'],
  'end-start': ['end-start'],
  'end-end': ['end-end'],
};

/** The logical slots a side request covers for this property, or undefined if it has none. */
export function slotsForSide(
  def: StylePropertyDef,
  side: StyleSide,
): readonly LogicalSlot[] | undefined {
  if (def.sides === 'box') return BOX_GROUP[side];
  if (def.sides === 'corners') {
    if (side === 'block' || side === 'inline') return CORNER_GROUP['all'];
    return CORNER_GROUP[side];
  }
  return undefined;
}

for (const id of STYLE_PROPERTY_IDS) {
  const def = STYLE_PROPERTIES[id];
  if (def.storage !== 'class') continue;
  for (const option of def.options ?? []) {
    const [main, partner] = option.className.split(' ');
    if (main !== undefined && main !== '')
      OPTION_INDEX.set(main, { property: id, value: option.value });
    if (partner?.startsWith('rtl:') === true) {
      RTL_INDEX.set(partner.slice(4), { property: id, value: option.value });
    }
  }
  if (def.sidePrefixes !== undefined) {
    const groups = def.sides === 'corners' ? CORNER_GROUP : BOX_GROUP;
    for (const [side, prefix] of Object.entries(def.sidePrefixes.logical)) {
      const sides = groups[side];
      if (sides === undefined) continue;
      SIDED.push({
        property: id,
        prefix,
        sides,
        level: side === 'all' ? 0 : sides.length === 2 ? 1 : 2,
      });
    }
    for (const [prefix, physical] of Object.entries(def.sidePrefixes.physical)) {
      SIDED.push(
        physical.reads === undefined
          ? { property: id, prefix, sides: [], level: 2, overlaps: physical.overlaps }
          : {
              property: id,
              prefix,
              sides: [physical.reads],
              level: 2,
              overlaps: physical.overlaps,
            },
      );
    }
  } else if (def.prefix !== undefined) {
    PLAIN.push({ property: id, prefix: def.prefix, allowBare: def.bare !== undefined });
  }
  for (const alias of def.aliases ?? [])
    PLAIN.push({ property: id, prefix: alias, allowBare: false });
  if (def.shorthand !== undefined) {
    PLAIN.push({
      property: id,
      prefix: def.shorthand.prefix,
      shorthand: def.shorthand,
      allowBare: false,
    });
  }
}
SIDED.sort((a, b) => b.prefix.length - a.prefix.length);
PLAIN.sort((a, b) => b.prefix.length - a.prefix.length);

function shorthandValue(def: StylePropertyDef, suffix: string): StyleValue | undefined {
  /* Option-only properties (overflow): the shorthand suffix must name an option. */
  if (def.options !== undefined && def.prefix === undefined) {
    const hit = def.options.find((option) => option.className.endsWith(`-${suffix}`));
    return hit === undefined ? undefined : { kind: 'keyword', keyword: hit.value };
  }
  return classifySuffix(def, suffix, false);
}

/**
 * Every catalogue reading of one utility (variants already removed).
 * Usually one; two for a shorthand such as `size-8` (inline size and block size).
 */
export function matchUtility(base: string, rtl = false): readonly UtilityMatch[] {
  if (rtl) {
    const hit = RTL_INDEX.get(base);
    return hit === undefined
      ? []
      : [
          {
            property: hit.property,
            value: { kind: 'keyword', keyword: hit.value },
            rtlPartner: true,
          },
        ];
  }
  const option = OPTION_INDEX.get(base);
  if (option !== undefined) {
    return [{ property: option.property, value: { kind: 'keyword', keyword: option.value } }];
  }
  const negative = base.startsWith('-');
  const unsigned = negative ? base.slice(1) : base;

  for (const sided of SIDED) {
    const def = STYLE_PROPERTIES[sided.property];
    let value: StyleValue | undefined;
    if (unsigned === sided.prefix) {
      value =
        !negative && def.bare !== undefined ? { kind: 'keyword', keyword: def.bare } : undefined;
    } else if (unsigned.startsWith(`${sided.prefix}-`)) {
      value = classifySuffix(def, unsigned.slice(sided.prefix.length + 1), negative);
    }
    if (value === undefined) continue;
    return [
      {
        property: sided.property,
        value,
        sides: sided.sides,
        level: sided.level,
        ...(sided.overlaps === undefined ? {} : { overlaps: sided.overlaps }),
      },
    ];
  }

  const found: UtilityMatch[] = [];
  let foundPrefix: string | undefined;
  for (const plain of PLAIN) {
    if (foundPrefix !== undefined && plain.prefix !== foundPrefix) break;
    const def = STYLE_PROPERTIES[plain.property];
    let value: StyleValue | undefined;
    let suffix = '';
    if (unsigned === plain.prefix) {
      value =
        !negative && plain.allowBare && def.bare !== undefined
          ? { kind: 'keyword', keyword: def.bare }
          : undefined;
    } else if (unsigned.startsWith(`${plain.prefix}-`)) {
      suffix = unsigned.slice(plain.prefix.length + 1);
      value =
        plain.shorthand === undefined
          ? classifySuffix(def, suffix, negative)
          : negative
            ? undefined
            : shorthandValue(def, suffix);
    }
    if (value === undefined) continue;
    if (plain.shorthand === undefined) {
      return [{ property: plain.property, value }];
    }
    found.push({ property: plain.property, value, shorthand: { ...plain.shorthand, suffix } });
    foundPrefix = plain.prefix;
  }
  return found;
}

// ── Writing ────────────────────────────────────────────────────────────────

export type WriteResult =
  | { readonly ok: true; readonly classes: readonly string[] }
  | { readonly ok: false; readonly message: string };

function refuse(def: StylePropertyDef, why: string): WriteResult {
  return { ok: false, message: `${def.labels.en} (${def.id}): ${why}` };
}

/** True when `base` reads back as exactly this property and value. */
function readsBack(
  def: StylePropertyDef,
  base: string,
  value: StyleValue,
  prefix: string,
): boolean {
  const [match] = matchUtility(base);
  if (match?.property !== def.id || !sameValue(match.value, value)) return false;
  /* A sided write must come back through the same side prefix. */
  return def.sidePrefixes === undefined || base.replace(/^-/u, '').startsWith(prefix);
}

export function sameValue(a: StyleValue, b: StyleValue): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'token':
      return a.token === (b as typeof a).token;
    case 'palette':
      return a.id === (b as typeof a).id;
    case 'raw':
      return a.css.trim() === (b as typeof a).css.trim();
    case 'keyword':
      return a.keyword === (b as typeof a).keyword;
  }
}

/** A stable text for comparing values (side collapse, provenance). */
export function valueKey(value: StyleValue): string {
  switch (value.kind) {
    case 'token':
      return `t:${value.token}`;
    case 'palette':
      return `p:${value.id}`;
    case 'raw':
      return `r:${value.css.trim()}`;
    case 'keyword':
      return `k:${value.keyword}`;
  }
}

/**
 * The utilities (variants not included) that write `value` for this property.
 * `prefix` overrides the property's own prefix — a sided property passes the
 * side's prefix (`ps`, `rounded-ee`).
 */
export function writeUtility(
  def: StylePropertyDef,
  value: StyleValue,
  prefix = def.prefix,
): WriteResult {
  if (def.storage !== 'class') {
    return refuse(def, `is stored in the ${def.attribute ?? ''} attribute, not as a class.`);
  }
  switch (value.kind) {
    case 'keyword':
      return writeKeyword(def, value.keyword, prefix);
    case 'token':
      return writeToken(def, value.token, prefix);
    case 'palette': {
      if (def.palette !== true || prefix === undefined)
        return refuse(def, 'takes no palette colour.');
      if (!PALETTE_ID.test(value.id)) {
        return refuse(
          def,
          `"${value.id}" is not a palette id (lowercase letters, digits and dashes).`,
        );
      }
      return { ok: true, classes: [`${prefix}-(--ck-c-${value.id})`] };
    }
    case 'raw':
      return writeRaw(def, value, prefix);
  }
}

function writeKeyword(
  def: StylePropertyDef,
  keyword: string,
  prefix: string | undefined,
): WriteResult {
  if (keyword === def.bare && prefix !== undefined) return { ok: true, classes: [prefix] };
  const words =
    def.multi === true ? keyword.split(/\s+/u).filter((word) => word !== '') : [keyword];
  const classes: string[] = [];
  for (const word of words) {
    const option = def.options?.find((candidate) => candidate.value === word);
    if (option !== undefined && option.className !== '') {
      classes.push(...option.className.split(' '));
      continue;
    }
    /* A keyword that is one of the property's tokens (`auto`, `full`) is written as one. */
    if (prefix !== undefined && tokenAccepts(def, word.replace(/^-/u, ''))) {
      const asToken = writeToken(def, word, prefix);
      if (!asToken.ok) return asToken;
      classes.push(...asToken.classes);
      continue;
    }
    const known = (def.options ?? [])
      .filter((candidate) => candidate.legacy !== true)
      .map((candidate) => candidate.value);
    return refuse(
      def,
      `"${word}" is not one of its options${known.length === 0 ? '' : ` (${known.join(', ')})`}.`,
    );
  }
  if (classes.length === 0) return refuse(def, 'needs at least one option.');
  return { ok: true, classes };
}

function writeToken(def: StylePropertyDef, token: string, prefix: string | undefined): WriteResult {
  if (prefix === undefined) return writeKeyword(def, token, prefix);
  if (token === def.bare) return { ok: true, classes: [prefix] };
  const negative = token.startsWith('-');
  const unsigned = negative ? token.slice(1) : token;
  if (negative && def.negative !== true)
    return refuse(def, `takes no negative value ("${token}").`);
  if (!tokenAccepts(def, unsigned)) {
    const scale =
      def.scale === undefined
        ? ''
        : ` Try one of: ${def.scale.filter((step) => step !== def.bare).join(', ')}.`;
    return refuse(def, `"${token}" is not one of its tokens or scale steps.${scale}`);
  }
  return { ok: true, classes: [`${negative ? '-' : ''}${prefix}-${unsigned}`] };
}

function writeRaw(
  def: StylePropertyDef,
  value: Extract<StyleValue, { kind: 'raw' }>,
  prefix: string | undefined,
): WriteResult {
  if (def.raw === undefined || prefix === undefined)
    return refuse(def, 'takes no exact CSS value.');
  const problem = rawValueProblem(value.css);
  if (problem !== undefined) return refuse(def, `the value "${value.css}" ${problem}.`);
  const encoded = encodeArbitrary(value.css);
  const plain = `${prefix}-[${encoded}]`;
  if (readsBack(def, plain, value, prefix)) return { ok: true, classes: [plain] };
  const hint = HINT_FOR[def.raw];
  if (hint !== undefined) {
    const hinted = `${prefix}-[${hint}:${encoded}]`;
    if (readsBack(def, hinted, value, prefix)) return { ok: true, classes: [hinted] };
  }
  return refuse(def, `"${value.css}" is not a value it can carry.`);
}
