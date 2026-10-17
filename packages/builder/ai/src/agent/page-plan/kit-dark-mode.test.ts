import { describe, expect, it } from 'vitest';

import { darkTheme, lightTheme, parseHex } from '@craftkit/builder-schema';

import { DIRECTION_DECK_ROWS } from '../../skills/direction-deck';
import {
  DEFAULT_COLOURS,
  TEXT_PAIRS,
  colourHex,
  failingPairs,
  ratio,
  readPageKit,
  writePageKit,
  type KitColourKey,
  type KitColours,
} from '../../tools/agent/page-kit';

/**
 * blocks-polish (2026-10-08): the page kit holds its seven text pairs to AA on
 * a light AND a dark page.
 *
 * The CSS is parsed here the way a browser resolves it, independently of the
 * generator: the light values are the token rule's hex; the dark values are
 * the `@supports` rule's `oklch(from var(--t-surface) …)` channels evaluated
 * with the page surface's own lightness, converted to hex with the CSS Color 4
 * OKLab matrices, and measured with page-kit's `ratio()`.
 */

const AA = 4.5;
const KEYS: Readonly<Record<string, KitColourKey>> = {
  bg: 'bg',
  surface: 'surface',
  ink: 'ink',
  muted: 'muted',
  accent: 'accent',
  'on-accent': 'onAccent',
  'accent-ink': 'accentInk',
  border: 'border',
};

// ── Colour maths, written out again on purpose (not imported from the generator) ──

function oklchLightness(hex: string): number {
  const rgb = parseHex(hex);
  if (rgb === undefined) throw new Error(`not a hex: ${hex}`);
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

function oklchToHex(l: number, c: number, h: number): string {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
  return `#${linear
    .map((v) => {
      const clamped = Math.min(1, Math.max(0, v));
      const gamma = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, gamma)) * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

// ── Reading the CSS ───────────────────────────────────────────────────────────

function lightColours(css: string): KitColours {
  const body = /(?:^|[\n}])\s*>\s*\*\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
  const colours: Record<KitColourKey, string> = { ...DEFAULT_COLOURS };
  for (const [, name = '', value = ''] of body.matchAll(/--ck-([a-z-]+)\s*:\s*([^;]*)/gu)) {
    const key = KEYS[name];
    const hex = colourHex(value);
    if (key !== undefined && hex !== undefined) colours[key] = hex;
  }
  return colours;
}

/** A channel: a number, or `calc(A + B * clamp(0, (0.5 - l) * 1000, 1))`. */
function channel(text: string, surfaceL: number): number {
  const plain = Number(text);
  if (!Number.isNaN(plain)) return plain;
  const match = /^calc\((-?[\d.]+) \+ (-?[\d.]+) \* clamp\(0, \(0\.5 - l\) \* 1000, 1\)\)$/u.exec(text);
  if (match === null) throw new Error(`unreadable channel: ${text}`);
  const scheme = Math.min(1, Math.max(0, (0.5 - surfaceL) * 1000));
  return Number(match[1]) + Number(match[2]) * scheme;
}

function splitChannels(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ' ' && depth === 0) {
      if (current !== '') parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  if (current !== '') parts.push(current);
  return parts;
}

/** The kit's colours on a page whose surface is `surface`. */
function coloursOn(css: string, surface: string): KitColours {
  const colours: Record<KitColourKey, string> = { ...lightColours(css) };
  const block = /@supports[^{]*\{>\s*\*\{([^}]*)\}\}/u.exec(css)?.[1];
  if (block === undefined) return colours;
  const surfaceL = oklchLightness(surface);
  for (const declaration of block.split(/;(?![^(]*\))/u)) {
    const match = /^--ck-([a-z-]+):oklch\(from var\(--t-surface,#ffffff\) (.*)\)$/u.exec(declaration.trim());
    if (match === null) throw new Error(`unexpected declaration: ${declaration}`);
    const key = KEYS[match[1] ?? ''];
    if (key === undefined) throw new Error(`unknown token: ${match[1] ?? ''}`);
    const [l = '', c = '', h = ''] = splitChannels(match[2] ?? '');
    colours[key] = oklchToHex(channel(l, surfaceL), channel(c, surfaceL), channel(h, surfaceL));
  }
  return colours;
}

function pairsBelow(colours: KitColours): string[] {
  return TEXT_PAIRS.flatMap(([fg, bg]) => {
    const value = ratio(colours[fg], colours[bg]);
    return value >= AA ? [] : [`${fg} on ${bg} ${value.toFixed(2)}`];
  });
}

function closeHex(a: string, b: string): boolean {
  const one = parseHex(a);
  const two = parseHex(b);
  if (one === undefined || two === undefined) return false;
  return Math.max(Math.abs(one.r - two.r), Math.abs(one.g - two.g), Math.abs(one.b - two.b)) <= 2 / 255;
}

const defaultKitCss = () => writePageKit('', readPageKit('', false).state, { lang: 'en', dir: 'ltr' });

function kitCss(colours: KitColours): string {
  const { state } = readPageKit('', false);
  return writePageKit('', { ...state, colours }, { lang: 'en', dir: 'ltr' });
}

describe('the default page kit in light and dark', () => {
  it('holds every TEXT_PAIRS pair to 4.5:1 on a light page', () => {
    const css = defaultKitCss();
    expect(pairsBelow(coloursOn(css, lightTheme.surface))).toEqual([]);
  });

  it('holds every TEXT_PAIRS pair to 4.5:1 on a dark page, ground and ink flipping together', () => {
    const css = defaultKitCss();
    const dark = coloursOn(css, darkTheme.surface);
    expect(pairsBelow(dark)).toEqual([]);
    expect(oklchLightness(dark.bg)).toBeLessThan(0.35);
    expect(oklchLightness(dark.ink)).toBeGreaterThan(0.8);
    /* The text also reads on the page's own dark surface, where a kit region paints no ground. */
    expect(ratio(dark.ink, darkTheme.surface)).toBeGreaterThanOrEqual(AA);
    expect(ratio(dark.muted, darkTheme.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('measured the defect it fixes: the light ink on the dark page surface', () => {
    const light = lightColours(defaultKitCss());
    expect(ratio(light.ink, darkTheme.surface)).toBeLessThan(1.5);
  });

  it('resolves to exactly the light hex on a light page', () => {
    const css = defaultKitCss();
    const light = lightColours(css);
    const onLight = coloursOn(css, lightTheme.surface);
    for (const key of Object.values(KEYS)) expect(closeHex(onLight[key], light[key]), key).toBe(true);
  });

  it('keeps the switch inside a relative-colour feature query, after the light token rule', () => {
    const css = defaultKitCss();
    const lightAt = css.search(/(?:^|[\n}])\s*>\s*\*\s*\{--ck-bg:#/u);
    const darkAt = css.indexOf('@supports (color:oklch(from');
    expect(lightAt).toBeGreaterThan(-1);
    expect(darkAt).toBeGreaterThan(lightAt);
    /* page-kit reads the first token rule: still the light hex. */
    expect(readPageKit(css, false).state.colours).toEqual(lightColours(css));
  });
});

describe('every deck palette in light and dark', () => {
  const palettes = DIRECTION_DECK_ROWS.map((row) => {
    const hex = (name: string) => colourHex(name) ?? '';
    const colours: KitColours = {
      ...DEFAULT_COLOURS,
      bg: hex(row.palette.ground),
      surface: hex(row.palette.card),
      ink: hex(row.palette.ink),
      muted: hex(row.palette.muted),
      accent: hex(row.palette.accent),
      onAccent: hex(row.palette.onAccent),
      accentInk: hex(row.palette.accentInk),
    };
    return [row.id, colours] as const;
  }).filter(([, colours]) => Object.values(colours).every((value) => value !== '') && failingPairs(colours).length === 0);

  it('finds palettes to check', () => {
    expect(palettes.length).toBeGreaterThan(3);
  });

  it.each(palettes)('%s: every pair reads on a light and on a dark page', (_id, colours) => {
    const css = kitCss(colours);
    expect(pairsBelow(coloursOn(css, lightTheme.surface))).toEqual([]);
    expect(pairsBelow(coloursOn(css, darkTheme.surface))).toEqual([]);
  });
});

describe('a kit that is dark already', () => {
  it('writes no second scheme', () => {
    const colours: KitColours = {
      bg: '#09090b',
      surface: '#18181b',
      ink: '#fafafa',
      muted: '#a1a1aa',
      accent: '#fbbf24',
      onAccent: '#09090b',
      accentInk: '#fbbf24',
      border: '#52525b',
    };
    const css = kitCss(colours);
    expect(css).not.toContain('@supports (color:oklch(from');
    /* The kit's own hex stays the only colour set: its ground is dark in both schemes. */
    expect(lightColours(css).bg).toBe('#09090b');
  });
});
