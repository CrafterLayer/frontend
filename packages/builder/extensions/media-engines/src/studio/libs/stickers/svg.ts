/*
  Stickers as SVG (sticker art, 2026-11-05): the colour sticker, and its outline — a colouring-page
  version where every shape is white with a dark line round it, so each boundary of the drawing is
  a line a child can fill (the source `s.lib.paint` colours in). Both are plain strings: an
  <img src>, a CSS background, a dialogue portrait or `texture()` takes them as data: URLs, which
  the unreviewed-scene CSP (`img-src data: blob:`) allows.
*/

import { sizeOf, stickerEntry } from './catalog';

export interface StickerSvgOptions {
  /** Width and height in CSS pixels (16..1024, default 128). */
  size?: number;
}

export interface StickerLineArtOptions extends StickerSvgOptions {
  /** The line colour: '#rgb' or '#rrggbb' (default '#1f2937'). */
  stroke?: string;
  /** Line width in grid units of the 32-unit drawing (0.1..3, default 0.6). */
  width?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;
export const LINE_DEFAULTS = Object.freeze({ stroke: '#1f2937', width: 0.6 });

function wrap(viewBox: string, size: number, body: string): string {
  const side = String(size);
  return `<svg xmlns="${SVG_NS}" width="${side}" height="${side}" viewBox="${viewBox}">${body}</svg>`;
}

/** One sticker's SVG markup, or undefined for a name or word no sticker answers to. */
export function stickerSvg(name: unknown, options?: StickerSvgOptions | null): string | undefined {
  const entry = stickerEntry(name);
  if (entry === undefined) return undefined;
  return wrap(entry.viewBox, sizeOf(options?.size), entry.body);
}

/* Paint servers and effects the outline drops: a gradient fill becomes white like any other. */
const PAINT_ELEMENTS =
  /<(linearGradient|radialGradient|filter|clipPath|mask|pattern)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gu;
/* Attributes that would colour, fade, clip or blur an outline shape. */
const PAINT_ATTRIBUTES =
  / (?:stroke|stroke-width|stroke-opacity|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|fill-opacity|opacity|clip-path|mask|filter|style)="[^"]*"/gu;

/**
 * The sticker's outline: every filled shape white, a `stroke` line `width` units wide round it,
 * gradients, clips, filters and transparency dropped; the viewBox (and any <use> of a shared shape)
 * kept, so the outline lies exactly over the colour sticker.
 */
export function stickerLineArt(
  name: unknown,
  options?: StickerLineArtOptions | null,
): string | undefined {
  const entry = stickerEntry(name);
  if (entry === undefined) return undefined;
  const input = typeof options === 'object' && options !== null ? options : {};
  const stroke =
    typeof input.stroke === 'string' && HEX.test(input.stroke.trim())
      ? input.stroke.trim()
      : LINE_DEFAULTS.stroke;
  const width =
    typeof input.width === 'number' && Number.isFinite(input.width)
      ? Math.min(3, Math.max(0.1, input.width))
      : LINE_DEFAULTS.width;
  const body = entry.body
    .replace(PAINT_ELEMENTS, '')
    .replace(PAINT_ATTRIBUTES, '')
    // Every fill that paints (a colour or a url(#gradient)) is white; fill="none" stays a line.
    .replace(/ fill="(?!none")[^"]*"/gu, ' fill="#fff"');
  const lines = `<g fill="#fff" stroke="${stroke}" stroke-width="${String(width)}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`;
  return wrap(entry.viewBox, sizeOf(input.size), lines);
}

/* Percent-encode only what a data: URL must not carry raw; SVG path data stays readable. */
const URL_UNSAFE = /[^\w .,:;=+\-/'()!*~@$&]/gu;

/** `data:image/svg+xml,…` for an <img>, a CSS background or a dialogue portrait. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${svg.replaceAll('"', "'").replace(URL_UNSAFE, encodeURIComponent)}`;
}

export function stickerDataUrl(
  name: unknown,
  options?: StickerSvgOptions | null,
): string | undefined {
  const svg = stickerSvg(name, options);
  return svg === undefined ? undefined : svgDataUrl(svg);
}
