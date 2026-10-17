/*
  Scene colours come from the page's own theme, read at mount.

  Token names (confirmed 2026-10-06):
  - a PUBLISHED page and the canvas page carry the site theme as `--t-*`
    (`tokenCssName` in packages/builder/schema/src/theme/tokens.ts:
    `--t-accent`, `--t-text`, `--t-text-muted`, `--t-surface`);
  - `--bldr-*` is the builder CHROME contract
    (packages/builder/theme/src/contract.ts: `--bldr-accent`,
    `--bldr-accent-strong`, `--bldr-panel-text`, `--bldr-panel-muted`,
    `--bldr-surface`). The chrome has no "primary" or bare "text" token, so
    a scene never asks it for one.

  So each role reads the site token first and the chrome token second, then a
  safe default. `data-ck-palette`:
  - `theme`  — accent, text and muted text of the page;
  - `accent` — three shades of the accent;
  - `mono`   — the text colour faded towards the surface.
*/

export type ScenePaletteMode = 'theme' | 'accent' | 'mono';

export interface ScenePalette {
  mode: ScenePaletteMode;
  /** 0xRRGGBB colours, most prominent first; always three. */
  colors: [number, number, number];
  /** The surface the scene sits on, 0xRRGGBB. */
  background: number;
  /** Whether the surface is dark (scenes lighten their glows on dark grounds). */
  dark: boolean;
}

/** Role → custom properties, read in order. */
export const PALETTE_TOKENS = Object.freeze({
  accent: ['--t-accent', '--bldr-accent'],
  text: ['--t-text', '--bldr-panel-text'],
  muted: ['--t-text-muted', '--bldr-panel-muted'],
  surface: ['--t-surface', '--bldr-surface'],
} as const);

/** The default light theme's values (schema `lightTheme`). */
export const PALETTE_DEFAULTS = Object.freeze({
  accent: 0x4f46e5,
  text: 0x111827,
  muted: 0x6b7280,
  surface: 0xffffff,
});

export function readPaletteMode(el: Element): ScenePaletteMode {
  const value = el.getAttribute('data-ck-palette');
  return value === 'accent' || value === 'mono' ? value : 'theme';
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+[\d.]+%?)?\s*\)$/i;

function channel(token: string): number {
  const value = token.endsWith('%')
    ? (Number.parseFloat(token) / 100) * 255
    : Number.parseFloat(token);
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Parse a CSS colour to 0xRRGGBB. Accepts #rgb, #rgba, #rrggbb, #rrggbbaa and
 * rgb()/rgba() in comma or space syntax; anything else returns `undefined` so
 * the caller can try a browser normalisation or fall back.
 */
export function parseColor(input: string | null | undefined): number | undefined {
  const value = (input ?? '').trim();
  if (value === '') {
    return undefined;
  }
  const hex = HEX.exec(value);
  if (hex !== null) {
    const digits = hex[1] ?? '';
    if (digits.length === 3 || digits.length === 4) {
      const [r = '0', g = '0', b = '0'] = digits.split('');
      return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    }
    if (digits.length === 6 || digits.length === 8) {
      return Number.parseInt(digits.slice(0, 6), 16);
    }
    return undefined;
  }
  const rgb = RGB.exec(value);
  if (rgb !== null) {
    return (channel(rgb[1] ?? '0') << 16) | (channel(rgb[2] ?? '0') << 8) | channel(rgb[3] ?? '0');
  }
  return undefined;
}

/**
 * Let the browser normalise colours this parser does not read (oklch, named
 * colours, `var()` chains): a 2D context's `fillStyle` reads back as #rrggbb or
 * rgba(). Returns `undefined` where no 2D context exists (tests, old engines).
 */
function normaliseWithCanvas(doc: Document, value: string): number | undefined {
  try {
    const context = doc.createElement('canvas').getContext('2d');
    if (context === null) {
      return undefined;
    }
    context.fillStyle = '#000001';
    context.fillStyle = value;
    const normalised = typeof context.fillStyle === 'string' ? context.fillStyle : '';
    return normalised === '#000001' ? undefined : parseColor(normalised);
  } catch {
    return undefined;
  }
}

function readRole(
  style: CSSStyleDeclaration,
  doc: Document,
  names: readonly string[],
): number | undefined {
  for (const name of names) {
    const raw = style.getPropertyValue(name).trim();
    if (raw === '') {
      continue;
    }
    const parsed = parseColor(raw) ?? normaliseWithCanvas(doc, raw);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

/** Linear mix of two 0xRRGGBB colours; `t = 0` is `a`, `t = 1` is `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const amount = Math.max(0, Math.min(1, t));
  const mix = (shift: number) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * amount) << shift;
  };
  return mix(16) | mix(8) | mix(0);
}

/** Relative luminance (sRGB, WCAG), 0 (black) to 1 (white). */
export function luminance(color: number): number {
  const linear = (shift: number) => {
    const c = ((color >> shift) & 0xff) / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(16) + 0.7152 * linear(8) + 0.0722 * linear(0);
}

/** Build the palette from resolved role colours (pure; the DOM read is {@link readPalette}). */
export function buildPalette(
  mode: ScenePaletteMode,
  roles: Partial<Record<keyof typeof PALETTE_DEFAULTS, number>>,
): ScenePalette {
  const accent = roles.accent ?? PALETTE_DEFAULTS.accent;
  const text = roles.text ?? PALETTE_DEFAULTS.text;
  const surface = roles.surface ?? PALETTE_DEFAULTS.surface;
  const muted = roles.muted ?? mixColor(text, surface, 0.45);
  const dark = luminance(surface) < 0.4;
  const toward = dark ? 0xffffff : 0x000000;

  let colors: [number, number, number];
  switch (mode) {
    case 'accent':
      colors = [accent, mixColor(accent, 0xffffff, 0.35), mixColor(accent, toward, 0.3)];
      break;
    case 'mono':
      colors = [text, mixColor(text, surface, 0.4), mixColor(text, surface, 0.7)];
      break;
    default:
      colors = [accent, text, muted];
  }
  return { mode, colors, background: surface, dark };
}

/** Read the element's computed theme tokens into a scene palette. */
export function readPalette(el: Element): ScenePalette {
  const mode = readPaletteMode(el);
  const doc = el.ownerDocument;
  const view = doc.defaultView;
  if (view === null) {
    return buildPalette(mode, {});
  }
  let style: CSSStyleDeclaration;
  try {
    style = view.getComputedStyle(el);
  } catch {
    return buildPalette(mode, {});
  }
  const roles: Partial<Record<keyof typeof PALETTE_DEFAULTS, number>> = {};
  for (const role of Object.keys(PALETTE_TOKENS) as (keyof typeof PALETTE_TOKENS)[]) {
    const value = readRole(style, doc, PALETTE_TOKENS[role]);
    if (value !== undefined) {
      roles[role] = value;
    }
  }
  return buildPalette(mode, roles);
}
