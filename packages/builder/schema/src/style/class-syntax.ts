/**
 * Reading and writing the variant prefixes and arbitrary values of one class
 * (style-manager DESIGN.md §A.2, D2).
 *
 * The engine owns exactly one shape of prefix: an optional bucket
 * (`max-lg:`, `max-md:`, `max-[Npx]:`), then an optional state (`hover:`,
 * `focus-visible:`, `active:`, `open:`, `group-hover:`), then — for the
 * gradient pair only — `rtl:`. Every other variant makes the class someone
 * else's: it is read for badges but never rewritten.
 */
import type { StyleBucket, StyleState } from './types';

/** Desktop-first bucket prefixes (D2). Thresholds equal `BUCKET_THRESHOLDS`. */
export const BUCKET_PREFIX = { base: '', tablet: 'max-lg:', mobile: 'max-md:' } as const;

/** The width below which each named bucket applies. */
export const BUCKET_LIMIT = { base: Number.POSITIVE_INFINITY, tablet: 1024, mobile: 768 } as const;

export const STATE_PREFIX: Readonly<Record<StyleState, string>> = {
  default: '',
  hover: 'hover:',
  focus: 'focus-visible:',
  active: 'active:',
  open: 'open:',
  'group-hover': 'group-hover:',
};

const STATE_BY_VARIANT: ReadonlyMap<string, StyleState> = new Map([
  ['hover', 'hover'],
  ['focus-visible', 'focus'],
  ['active', 'active'],
  ['open', 'open'],
  ['group-hover', 'group-hover'],
]);

export const STYLE_STATES: readonly StyleState[] = [
  'default',
  'hover',
  'focus',
  'active',
  'open',
  'group-hover',
];

const CUSTOM_BUCKET = /^max-\[(\d{1,5})px\]$/u;
/** Breakpoint variants the engine never writes and never rewrites. */
const CUSTOM_BREAKPOINT = /^(?:sm|xl|2xl|max-(?:sm|xl|2xl)|min-\[.*\]|max-\[.*\]|@.*)$/u;

/** Whether a custom bucket width is one the engine will write. */
export function isValidCustomWidth(maxWidth: number): boolean {
  return Number.isInteger(maxWidth) && maxWidth >= 1 && maxWidth <= 99_999;
}

export function bucketPrefix(bucket: StyleBucket): string {
  if (typeof bucket === 'object') return `max-[${String(bucket.maxWidth)}px]:`;
  return BUCKET_PREFIX[bucket];
}

/** The full engine prefix, bucket then state: `max-md:hover:`. */
export function slotPrefix(bucket: StyleBucket, state: StyleState): string {
  return bucketPrefix(bucket) + STATE_PREFIX[state];
}

export function bucketLimit(bucket: StyleBucket): number {
  return typeof bucket === 'object' ? bucket.maxWidth : BUCKET_LIMIT[bucket];
}

/** A stable key for comparing buckets (`{maxWidth: 600}` → `max-600`). */
export function bucketKey(bucket: StyleBucket): string {
  return typeof bucket === 'object' ? `max-${String(bucket.maxWidth)}` : bucket;
}

export function sameBucket(a: StyleBucket, b: StyleBucket): boolean {
  return bucketKey(a) === bucketKey(b);
}

/** Where a class sits, as far as the engine is concerned. */
export type ClassScope =
  | {
      readonly kind: 'engine';
      readonly bucket: StyleBucket;
      readonly state: StyleState;
      /** `rtl:` — admitted only for the gradient-direction pair. */
      readonly rtl: boolean;
    }
  /** Mobile-first `md:` / `lg:` (optionally with a state): normalisable. */
  | { readonly kind: 'mobile-first'; readonly breakpoint: 'md' | 'lg'; readonly state: StyleState }
  /** `sm:`, `xl:`, `2xl:`, `@md:`, `min-[…]:`: left untouched, flagged. */
  | { readonly kind: 'custom-breakpoint' }
  /** Any other variant (`dark:`, `first:`, `focus:`, `!`…): not the engine's. */
  | { readonly kind: 'foreign' };

export interface ParsedClass {
  /** The class exactly as written. */
  readonly raw: string;
  readonly scope: ClassScope;
  /** The utility after its variants, sign included: `-translate-x-4`, `bg-accent`. */
  readonly base: string;
}

/** Split on the `:` that separate variants, never one inside `[…]` or `(…)`. */
export function splitVariants(className: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < className.length; at += 1) {
    const char = className[at];
    if (char === '\\') {
      at += 1;
    } else if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth -= 1;
    } else if (char === ':' && depth === 0) {
      parts.push(className.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(className.slice(start));
  return parts;
}

export function parseClass(raw: string): ParsedClass {
  const parts = splitVariants(raw);
  const base = parts.pop() ?? '';
  return { raw, base, scope: scopeOf(parts, base) };
}

function scopeOf(variants: readonly string[], base: string): ClassScope {
  if (base.startsWith('!') || base.endsWith('!') || base === '') return { kind: 'foreign' };
  let bucket: StyleBucket | undefined;
  let state: StyleState | undefined;
  let rtl = false;
  let mobileFirst: 'md' | 'lg' | undefined;
  let custom = false;
  let foreign = false;
  for (const variant of variants) {
    const stateHere = STATE_BY_VARIANT.get(variant);
    const customWidth = CUSTOM_BUCKET.exec(variant);
    if (stateHere !== undefined && state === undefined) {
      state = stateHere;
    } else if (variant === 'max-lg' && bucket === undefined) {
      bucket = 'tablet';
    } else if (variant === 'max-md' && bucket === undefined) {
      bucket = 'mobile';
    } else if (customWidth !== null && bucket === undefined) {
      const width = Number(customWidth[1]);
      if (isValidCustomWidth(width)) bucket = { maxWidth: width };
      else custom = true;
    } else if (variant === 'rtl' && !rtl) {
      rtl = true;
    } else if ((variant === 'md' || variant === 'lg') && mobileFirst === undefined) {
      mobileFirst = variant;
    } else if (CUSTOM_BREAKPOINT.test(variant)) {
      custom = true;
    } else {
      foreign = true;
    }
  }
  if (foreign) return { kind: 'foreign' };
  if (custom || (mobileFirst !== undefined && (bucket !== undefined || rtl))) {
    return { kind: 'custom-breakpoint' };
  }
  if (mobileFirst !== undefined) {
    return { kind: 'mobile-first', breakpoint: mobileFirst, state: state ?? 'default' };
  }
  return { kind: 'engine', bucket: bucket ?? 'base', state: state ?? 'default', rtl };
}

/** Split a class attribute the way a browser does. */
export function splitClassList(className: string): string[] {
  return className.split(/\s+/u).filter((name) => name !== '');
}

/** Tailwind's data-type hints inside an arbitrary value: `text-[length:var(--x)]`. */
const TYPE_HINT =
  /^(?:color|length|number|integer|percentage|angle|url|image|position|bg-size|family-name|line-width|absolute-size|relative-size|shadow):/u;

/** Encode a CSS value for `[…]`: spaces become `_`, a literal `_` becomes `\_`. */
export function encodeArbitrary(css: string): string {
  return css.trim().replaceAll('_', '\\_').replace(/\s+/gu, '_');
}

/** The inverse of `encodeArbitrary`, with any type hint removed. */
export function decodeArbitrary(inner: string): string {
  const unhinted = inner.replace(TYPE_HINT, '');
  let out = '';
  for (let at = 0; at < unhinted.length; at += 1) {
    const char = unhinted[at];
    if (char === '\\' && unhinted[at + 1] === '_') {
      out += '_';
      at += 1;
    } else {
      out += char === '_' ? ' ' : (char ?? '');
    }
  }
  return out;
}

/** The type hint inside an arbitrary value, if any (`length`, `color`, …). */
export function arbitraryHint(inner: string): string | undefined {
  const match = TYPE_HINT.exec(inner);
  return match === null ? undefined : match[0].slice(0, -1);
}

/**
 * Why a raw CSS value cannot be written as an arbitrary value, or `undefined`.
 * The live compiler is the final judge; this refuses what could break the
 * class attribute or the stylesheet before it gets there.
 */
export function rawValueProblem(css: string): string | undefined {
  const value = css.trim();
  if (value === '') return 'is empty';
  if (value.length > 400) return 'is longer than 400 characters';
  if (/[\n\r\t{};<>]/u.test(value))
    return 'contains a character a class cannot carry ({ } ; < > or a line break)';
  let round = 0;
  let square = 0;
  for (const char of value) {
    if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    if (round < 0 || square < 0) return 'has an unbalanced bracket';
  }
  if (round !== 0 || square !== 0) return 'has an unbalanced bracket';
  if (/\burl\(/iu.test(value) && !/\burl\((?:['"]?)(?:https:\/\/|data:image\/)/iu.test(value)) {
    return 'uses a url() that is not https or a data:image';
  }
  return undefined;
}

/** A site-library palette id, as `library.ts` (P5) constrains it. */
export const PALETTE_ID = /^[a-z][a-z0-9-]{0,47}$/u;

/** Palette colours are CSS variables named `--ck-c-<id>`. */
export function paletteVariable(id: string): string {
  return `--ck-c-${id}`;
}

const PALETTE_SUFFIX = /^\((?:color:)?--ck-c-([a-z][a-z0-9-]{0,47})\)$/u;

/** `(--ck-c-brand)` → `brand`. */
export function paletteIdOf(suffix: string): string | undefined {
  return PALETTE_SUFFIX.exec(suffix)?.[1];
}

/** Whether a suffix is an arbitrary value `[…]`. */
export function isArbitrary(suffix: string): boolean {
  return suffix.startsWith('[') && suffix.endsWith(']');
}
