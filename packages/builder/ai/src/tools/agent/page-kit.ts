import { contrastRatio, parseHex } from '@craftkit/builder-schema';

import { PAGE_PLAN_PALETTE_HEX } from '../../agent/page-plan/palette';
import { pagePlanCss } from '../../agent/page-plan/skeleton-from-plan';
import type {
  PagePlan,
  PagePlanFont,
  PagePlanRadius,
  PagePlanTokens,
} from '../../agent/page-plan/types';
import { directionDeckImportUrl, type DeckFace } from '../../skills/direction-deck';
import { VERIFIED_FONT_FAMILIES } from '../../skills/verified-fonts';

/**
 * The page kit as data: read the `--ck-*` tokens, faces and radius out of a
 * root `pageCss`, change them, and write the block back with the SAME
 * function the skeleton writes it with (`pagePlanCss`), so the inverse and
 * accent grounds are re-derived and re-measured, never hand-patched.
 */

export const AA = 4.5;

export type KitColourKey =
  | 'bg'
  | 'surface'
  | 'ink'
  | 'muted'
  | 'accent'
  | 'onAccent'
  | 'accentInk'
  | 'border';

export type KitColours = Readonly<Record<KitColourKey, string>>;

export interface PageKitState {
  readonly colours: KitColours;
  readonly radius: PagePlanRadius;
  readonly display: DeckFace;
  readonly body: DeckFace;
  readonly hasHeader: boolean;
}

/** The plan block's fences (skeleton-from-plan.ts); replaced whole, never stacked. */
const PLAN_BLOCK = /\.ck-page-plan\{[^}]*\}[\s\S]*?\.ck-page-plan-end\{[^}]*\}/gu;
const HEADER_KIT = /header\.sticky|\.ck-bar\{|scroll-margin-top/u;
const TOKEN_RULE = /(?:^|[\n}])\s*>\s*\*\s*\{([^}]*)\}/u;
const IMPORT = /@import url\('([^']+)'\);/gu;

/**
 * Colour names the kit tools accept besides `#rrggbb` and the deck's palette
 * shades: Tailwind v3 hex for the hues the deck table does not carry.
 */
export const EXTRA_PALETTE_HEX: Readonly<Record<string, string>> = Object.freeze({
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  'indigo-700': '#4338ca',
  'violet-700': '#6d28d9',
  'purple-700': '#7e22ce',
  'pink-700': '#be185d',
  'amber-700': '#b45309',
  'amber-800': '#92400e',
  'teal-800': '#115e59',
  'emerald-600': '#059669',
  'orange-600': '#ea580c',
  'rose-600': '#e11d48',
  'sky-600': '#0284c7',
  'neutral-800': '#262626',
  'slate-700': '#334155',
});

export const ALL_PALETTE_HEX: Readonly<Record<string, string>> = Object.freeze({
  ...PAGE_PLAN_PALETTE_HEX,
  ...EXTRA_PALETTE_HEX,
});

/** `#rrggbb` (lower-case) for a hex or a palette name, or undefined. */
export function colourHex(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  const named = ALL_PALETTE_HEX[text];
  if (named !== undefined) return named;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/u.exec(text);
  if (short !== null) return `#${short[1] ?? ''}${short[1] ?? ''}${short[2] ?? ''}${short[2] ?? ''}${short[3] ?? ''}${short[3] ?? ''}`;
  return /^#[0-9a-f]{6}$/u.test(text) ? text : undefined;
}

function hexOf(channels: { r: number; g: number; b: number }): string {
  const part = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(channels.r)}${part(channels.g)}${part(channels.b)}`;
}

/** `weight` of `a` over `1 - weight` of `b`. */
export function mix(a: string, b: string, weight: number): string {
  const one = parseHex(a);
  const two = parseHex(b);
  if (one === undefined || two === undefined) return a;
  return hexOf({
    r: one.r * weight + two.r * (1 - weight),
    g: one.g * weight + two.g * (1 - weight),
    b: one.b * weight + two.b * (1 - weight),
  });
}

export function ratio(a: string, b: string): number {
  return contrastRatio(a, b) ?? 0;
}

/** The first candidate that clears AA on every ground; else the one that reads best on the worst. */
export function readable(candidates: readonly string[], grounds: readonly string[]): string {
  const worst = (colour: string) => Math.min(...grounds.map((ground) => ratio(colour, ground)));
  const passing = candidates.find((colour) => worst(colour) >= AA);
  if (passing !== undefined) return passing;
  return [...candidates].sort((left, right) => worst(right) - worst(left))[0] ?? '#000000';
}

// ── Reading ──────────────────────────────────────────────────────────────────

const RADIUS_BY_CARD: Readonly<Record<string, PagePlanRadius>> = {
  '0': 'none',
  '0.375rem': 'md',
  '0.75rem': 'xl',
  '1.5rem': 'full',
};

const TOKEN_KEYS: Readonly<Record<string, KitColourKey>> = {
  bg: 'bg',
  surface: 'surface',
  ink: 'ink',
  muted: 'muted',
  accent: 'accent',
  'on-accent': 'onAccent',
  'accent-ink': 'accentInk',
  border: 'border',
};

/** The weights an import URL names for `family`, or [] for a bare (one-weight) import. */
function importedWeights(urls: readonly string[], family: string): readonly number[] {
  const name = family.replaceAll(' ', '+');
  for (const url of urls) {
    const decoded = url.replaceAll('%3B', ';').replaceAll('%3b', ';');
    const match = new RegExp(`family=${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?::wght@([\\d;]+))?(?:&|$)`, 'u').exec(decoded);
    if (match !== null) {
      return (match[1] ?? '')
        .split(';')
        .filter((weight) => weight !== '')
        .map(Number);
    }
  }
  return [];
}

function familyOf(stack: string | undefined): string | undefined {
  if (stack === undefined) return undefined;
  const match = /^\s*'([^']+)'/u.exec(stack) ?? /^\s*"([^"]+)"/u.exec(stack);
  return match?.[1];
}

/** Default faces when a page has no kit yet: verified, Arabic-capable on an Arabic page. */
export function defaultFaces(arabic: boolean): { readonly display: DeckFace; readonly body: DeckFace } {
  return arabic
    ? { display: { family: 'Readex Pro', weights: [600, 700] }, body: { family: 'IBM Plex Sans Arabic', weights: [400, 700] } }
    : { display: { family: 'Bricolage Grotesque', weights: [600, 700] }, body: { family: 'Instrument Sans', weights: [400, 500] } };
}

export const DEFAULT_COLOURS: KitColours = Object.freeze({
  bg: '#ffffff',
  surface: '#fafaf9',
  ink: '#1c1917',
  muted: '#57534e',
  accent: '#1d4ed8',
  onAccent: '#ffffff',
  accentInk: '#1d4ed8',
  border: '#e7e5e4',
});

/** Whether the page css holds the plan's kit block. */
export function hasKitBlock(pageCss: string): boolean {
  PLAN_BLOCK.lastIndex = 0;
  return PLAN_BLOCK.test(pageCss);
}

/** The page css split into its kit block (undefined when it has none) and everything else, trimmed. */
export function splitKitBlock(pageCss: string): { readonly block: string | undefined; readonly rest: string } {
  PLAN_BLOCK.lastIndex = 0;
  const block = pageCss.match(PLAN_BLOCK)?.[0];
  PLAN_BLOCK.lastIndex = 0;
  return { block, rest: pageCss.replace(PLAN_BLOCK, '').trim() };
}

/**
 * The kit as the page holds it. A page with no kit block reads as the
 * defaults (and `hasKit: false`), so a tool can write a fresh block.
 */
export function readPageKit(
  pageCss: string,
  arabic: boolean,
): { readonly state: PageKitState; readonly hasKit: boolean } {
  PLAN_BLOCK.lastIndex = 0;
  const block = pageCss.match(PLAN_BLOCK)?.[0];
  const faces = defaultFaces(arabic);
  if (block === undefined) {
    return {
      hasKit: false,
      state: { colours: DEFAULT_COLOURS, radius: 'xl', display: faces.display, body: faces.body, hasHeader: false },
    };
  }
  const body = TOKEN_RULE.exec(block)?.[1] ?? '';
  const values = new Map<string, string>();
  for (const match of body.matchAll(/--ck-([a-z-]+)\s*:\s*([^;]*)/gu)) {
    values.set(match[1] ?? '', (match[2] ?? '').trim());
  }
  const colours: Record<KitColourKey, string> = { ...DEFAULT_COLOURS };
  for (const [name, key] of Object.entries(TOKEN_KEYS)) {
    const hex = colourHex(values.get(name) ?? '');
    if (hex !== undefined) colours[key] = hex;
  }
  const urls = [...block.matchAll(IMPORT)].map((match) => match[1] ?? '');
  const face = (stack: string | undefined, fallback: DeckFace): DeckFace => {
    const family = familyOf(stack);
    if (family === undefined || VERIFIED_FONT_FAMILIES[family] === undefined) return fallback;
    return { family, weights: importedWeights(urls, family) };
  };
  return {
    hasKit: true,
    state: {
      colours,
      radius: RADIUS_BY_CARD[values.get('radius') ?? ''] ?? 'xl',
      display: face(values.get('font-display'), faces.display),
      body: face(values.get('font-body'), faces.body),
      hasHeader: HEADER_KIT.test(block),
    },
  };
}

// ── Writing ──────────────────────────────────────────────────────────────────

function planFont(face: DeckFace, url: string): PagePlanFont {
  return { family: face.family, weights: face.weights.length === 0 ? [400] : face.weights, url };
}

/** A PagePlan carrying only what `pagePlanCss` reads: tokens, direction and whether a header exists. */
function syntheticPlan(state: PageKitState, locale: { lang: string; dir: 'rtl' | 'ltr' }): PagePlan {
  const url = directionDeckImportUrl([state.display, state.body]);
  const tokens: PagePlanTokens = {
    ...state.colours,
    fontDisplay: planFont(state.display, url),
    fontBody: planFont(state.body, url),
    radius: state.radius,
    signature: '',
  };
  const section = (role: 'header' | 'hero', key: string) => ({
    key,
    role,
    title: key,
    anchorId: key,
    purpose: '',
    mustSay: [],
    mustNotRepeat: [],
  });
  return {
    intent: 'replace',
    locale: { lang: locale.lang === '' ? (locale.dir === 'rtl' ? 'ar' : 'en') : locale.lang, dir: locale.dir },
    title: '',
    description: '',
    tokens,
    primaryCta: { label: '', href: '#top' },
    nav: [],
    sections: state.hasHeader ? [section('header', 'header'), section('hero', 'hero')] : [section('hero', 'hero')],
    facts: [],
  };
}

/** The page css with the kit block replaced (or appended when the page had none). */
export function writePageKit(
  pageCss: string,
  state: PageKitState,
  locale: { lang: string; dir: 'rtl' | 'ltr' },
): string {
  const block = pagePlanCss(syntheticPlan(state, locale));
  PLAN_BLOCK.lastIndex = 0;
  const kept = pageCss.replace(PLAN_BLOCK, '').trim();
  return kept === '' ? block : `${kept}\n${block}`;
}

// ── Contrast ─────────────────────────────────────────────────────────────────

/** The seven text pairs a page plan holds to AA (PagePlanTokens). */
export const TEXT_PAIRS: readonly (readonly [KitColourKey, KitColourKey])[] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['onAccent', 'accent'],
  ['accentInk', 'bg'],
  ['accentInk', 'surface'],
];

export function failingPairs(
  colours: KitColours,
): readonly { readonly fg: KitColourKey; readonly bg: KitColourKey; readonly ratio: number }[] {
  return TEXT_PAIRS.flatMap(([fg, bg]) => {
    const value = ratio(colours[fg], colours[bg]);
    return value >= AA ? [] : [{ fg, bg, ratio: value }];
  });
}

/** Palette shades nearest `hex` (same family first when `name` is a palette name). */
export function nearestShades(hex: string, name?: string): readonly [string, string][] {
  const family = name !== undefined && /^[a-z]+-\d+$/u.test(name) ? name.replace(/-\d+$/u, '') : undefined;
  const target = parseHex(hex);
  const distance = (other: string) => {
    const rgb = parseHex(other);
    if (rgb === undefined || target === undefined) return Number.POSITIVE_INFINITY;
    return (rgb.r - target.r) ** 2 + (rgb.g - target.g) ** 2 + (rgb.b - target.b) ** 2;
  };
  return Object.entries(ALL_PALETTE_HEX).sort(([leftName, left], [rightName, right]) => {
    const leftFamily = family !== undefined && leftName.startsWith(`${family}-`) ? 0 : 1;
    const rightFamily = family !== undefined && rightName.startsWith(`${family}-`) ? 0 : 1;
    return leftFamily - rightFamily || distance(left) - distance(right);
  });
}
