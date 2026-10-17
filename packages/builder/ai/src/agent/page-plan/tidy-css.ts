import { contrastRatio } from '@craftkit/builder-schema';

import type { PagePlanTokens } from './types';

/*
  Colour literals in a region's css, moved onto the page (tidy-section.ts,
  2026-10-13). The class tidy (`tokeniseColourClasses`) has covered palette
  classes since 2026-10-05; a hex or an rgb() in the css still cost a whole
  repair round. Only what is exact moves:

  - a hairline (border, outline, column-rule) is the page's hairline,
    `var(--ck-border)` — as the class tidy makes every `border-` class
    `ck-border`;
  - a colour within a few steps of a plan colour on every channel (an rgb()
    of the ink, a hex one step off the surface) is that colour's own hex, which
    the check admits — the hex, not its `var()`, so nothing re-points inside
    an inverted band;
  - a near-white or near-black is white or black (#ffffff, #000000), which
    the check admits as tints;
  - a translucent dark or light (a shadow's rgba(15,23,42,.08)) is the same
    alpha of black or white.

  Anything else — a mid-tone glow, a gradient of hues, a named colour — is
  left for the writer: picking its token would be a design decision.
*/

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/giu;
const FUNCTION_LITERAL = /\b(rgba?|hsla?)\(([^()]*)\)/giu;
/** Within this many steps (0-255) on every channel, a colour is the token's. */
const NEAR = 12;
/** All channels at or past these: white, black. */
const NEAR_WHITE = 240;
const NEAR_BLACK = 16;
/** Relative luminance below / above which a translucent colour is a tint of black / white. */
const DARK_TINT = 0.05;
const LIGHT_TINT = 0.85;

const TOKENS: readonly (keyof PagePlanTokens)[] = [
  'ink',
  'muted',
  'accentInk',
  'bg',
  'surface',
  'accent',
  'onAccent',
  'border',
];
const HAIRLINE =
  /^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|column-rule(?:-color)?)$/u;

function hexRgba(hex: string): Rgba | undefined {
  const body = hex.replace(/^#/u, '').toLowerCase();
  const full =
    body.length <= 4
      ? body
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : body;
  if (!/^[0-9a-f]{6}(?:[0-9a-f]{2})?$/u.test(full)) return undefined;
  const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16);
  return {
    r: channel(0),
    g: channel(2),
    b: channel(4),
    a: full.length === 8 ? channel(6) / 255 : 1,
  };
}

function number(part: string, scale: number): number | undefined {
  const value = Number.parseFloat(part);
  if (!Number.isFinite(value)) return undefined;
  return part.trim().endsWith('%') ? (value / 100) * scale : value;
}

function hslRgb(h: number, s: number, l: number): readonly [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** rgb()/rgba()/hsl()/hsla() in either syntax; undefined for a var() or anything unreadable. */
function functionRgba(name: string, args: string): Rgba | undefined {
  if (args.includes('var(') || /\bfrom\b/u.test(args)) return undefined;
  const parts = args
    .replace('/', ' ')
    .split(/[\s,]+/u)
    .filter((part) => part !== '');
  if (parts.length !== 3 && parts.length !== 4) return undefined;
  const alpha = parts[3] === undefined ? 1 : number(parts[3], 1);
  if (alpha === undefined) return undefined;
  if (name.startsWith('rgb')) {
    const [r, g, b] = parts.slice(0, 3).map((part) => number(part, 255));
    if (r === undefined || g === undefined || b === undefined) return undefined;
    return { r, g, b, a: alpha };
  }
  const h = Number.parseFloat(parts[0] ?? '');
  const s = number(parts[1] ?? '', 1);
  const l = number(parts[2] ?? '', 1);
  if (!Number.isFinite(h) || s === undefined || l === undefined) return undefined;
  const [r, g, b] = hslRgb(((h % 360) + 360) % 360, s, l);
  return { r, g, b, a: alpha };
}

function luminance({ r, g, b }: Rgba): number {
  const hex = `#${[r, g, b]
    .map((value) =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
  return ((contrastRatio(hex, '#000000') ?? 1) - 1) * 0.05;
}

/** The largest step between two colours on any one channel. */
function distanceOf(one: Rgba, two: Rgba): number {
  return Math.max(Math.abs(one.r - two.r), Math.abs(one.g - two.g), Math.abs(one.b - two.b));
}

function alphaText(alpha: number): string {
  return String(Math.round(alpha * 1000) / 1000);
}

/** What an opaque or translucent literal becomes under this property, or undefined to leave it. */
function replacement(colour: Rgba, property: string, tokens: PagePlanTokens): string | undefined {
  if (colour.a < 1) {
    const light = luminance(colour);
    if (light <= DARK_TINT) return `rgb(0 0 0 / ${alphaText(colour.a)})`;
    if (light >= LIGHT_TINT) return `rgb(255 255 255 / ${alphaText(colour.a)})`;
    return undefined;
  }
  if (HAIRLINE.test(property)) return 'var(--ck-border)';
  let nearest: { readonly hex: string; readonly distance: number } | undefined;
  for (const token of TOKENS) {
    const hex = (tokens[token] as string).toLowerCase();
    const value = hexRgba(hex);
    const distance = value === undefined ? Infinity : distanceOf(colour, value);
    if (distance <= NEAR && (nearest === undefined || distance < nearest.distance))
      nearest = { hex, distance };
  }
  if (nearest !== undefined) return nearest.hex;
  const { r, g, b } = colour;
  if (r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE) return '#ffffff';
  if (r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK) return '#000000';
  return undefined;
}

function planHexes(tokens: PagePlanTokens): ReadonlySet<string> {
  return new Set(
    (['bg', 'surface', 'ink', 'muted', 'accent', 'onAccent', 'accentInk', 'border'] as const).map(
      (token) => tokens[token].toLowerCase(),
    ),
  );
}

function tidyValue(
  property: string,
  value: string,
  tokens: PagePlanTokens,
  plan: ReadonlySet<string>,
): string {
  const hexes = value.replace(HEX_LITERAL, (hex: string) => {
    const colour = hexRgba(hex);
    const six = colour === undefined || colour.a < 1 ? undefined : hex.toLowerCase();
    // A plan colour, white and black are already the page's: the check admits them.
    if (six !== undefined && (plan.has(six) || /^#(?:fff(?:fff)?|000(?:000)?)$/u.test(six)))
      return hex;
    return colour === undefined ? hex : (replacement(colour, property, tokens) ?? hex);
  });
  return hexes.replace(FUNCTION_LITERAL, (whole: string, name: string, args: string) => {
    const colour = functionRgba(name.toLowerCase(), args);
    if (colour === undefined) return whole;
    const { r, g, b } = colour;
    const blackOrWhite =
      [r, g, b].every((channel) => channel === 0) || [r, g, b].every((channel) => channel === 255);
    return blackOrWhite ? whole : (replacement(colour, property, tokens) ?? whole);
  });
}

/**
 * The region css with every colour literal the rules above can place moved
 * onto the page's tokens; the same string when nothing moved. Only the values
 * of declarations inside blocks change; selectors, at-rules and urls never do.
 */
export function tidyCssColours(css: string, tokens: PagePlanTokens): string {
  const plan = planHexes(tokens);
  return css.replace(/\{([^{}]*)\}/gu, (block: string, body: string) => {
    const declarations = body.split(';').map((declaration) => {
      const colon = declaration.indexOf(':');
      if (colon === -1 || /url\(/iu.test(declaration)) return declaration;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1);
      const next = tidyValue(property, value, tokens, plan);
      return next === value ? declaration : `${declaration.slice(0, colon + 1)}${next}`;
    });
    const next = declarations.join(';');
    return next === body ? block : `{${next}}`;
  });
}

/**
 * The region css with accent-coloured TEXT moved to the accent's text token:
 * a `color` of `var(--ck-accent)` or of the accent's own hex becomes
 * `var(--ck-accent-ink)`. Grounds and borders keep the accent.
 */
export function accentTextInCss(css: string, tokens: PagePlanTokens): string {
  const accent = tokens.accent.toLowerCase();
  return css.replace(
    /(^|[{;\s])(color\s*:\s*)([^;{}]*)/giu,
    (whole: string, lead: string, property: string, value: string) => {
      const next = value
        .replace(/var\(\s*--ck-accent\s*\)/gu, 'var(--ck-accent-ink)')
        .replace(HEX_LITERAL, (hex: string) =>
          hex.toLowerCase() === accent ? 'var(--ck-accent-ink)' : hex,
        );
      return next === value ? whole : `${lead}${property}${next}`;
    },
  );
}
