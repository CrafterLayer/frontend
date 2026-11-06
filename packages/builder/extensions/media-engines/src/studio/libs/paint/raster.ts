/*
  Raster plumbing for the `paint` Studio library (2026-11-05): the canvases a colouring page
  draws into, how line art becomes an ink layer, and the wall mask the bucket fill stops at.

  Line art arrives as an SVG string (`s.lib.stickers.lineArt(name)`), a data: image URL or a
  Pixi texture. It is drawn once, contained and centred, into an offscreen canvas at the page's
  pixel size, then turned into ink by "colour to alpha" against white: white paper inside the
  shapes becomes transparent, dark lines stay opaque with their own colour, and anti-aliased
  edges keep a matching partial alpha, so paint underneath shows through cleanly. Pixels whose
  ink alpha passes WALL_ALPHA are walls: a fill never crosses or paints them.

  Nothing is fetched: http(s) URLs are refused (they would also taint the canvas and break
  getImageData). The browser's canvas by default; tests inject a fake raster env.
*/

export interface PaintImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface PaintContext {
  fillStyle: unknown;
  globalCompositeOperation: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
  getImageData(x: number, y: number, w: number, h: number): PaintImageData;
  putImageData(
    image: unknown,
    dx: number,
    dy: number,
    dirtyX?: number,
    dirtyY?: number,
    dirtyW?: number,
    dirtyH?: number,
  ): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
}

export interface PaintCanvas {
  width: number;
  height: number;
  getContext(type: '2d', options?: { willReadFrequently?: boolean }): unknown;
  toDataURL(type?: string): string;
}

export interface PaintImage {
  src: string;
  decoding?: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  readonly naturalWidth?: number;
  readonly naturalHeight?: number;
  readonly width?: number;
  readonly height?: number;
}

/** How a page rasterizes; the browser's by default, injected by tests (like PeepRasterEnv). */
export interface PaintRasterEnv {
  createCanvas(width: number, height: number): PaintCanvas;
  createImage(): PaintImage;
  readonly devicePixelRatio?: number | undefined;
}

/** Ink alpha (0..1) at which a line-art pixel stops a fill. */
export const WALL_ALPHA = 0.35;
const DECODE_TIMEOUT_MS = 10_000;

export function browserPaintEnv(): PaintRasterEnv {
  const doc = (globalThis as { document?: Document }).document;
  const ImageClass = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (doc === undefined || typeof ImageClass !== 'function') {
    throw new Error('paint.page runs in a browser');
  }
  return {
    createImage: () => new ImageClass() as unknown as PaintImage,
    createCanvas(width, height) {
      const canvas = doc.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    devicePixelRatio: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
  };
}

/** A 2D context that is read often (fills read the whole page back). */
export function context2d(canvas: PaintCanvas): PaintContext {
  const context = canvas.getContext('2d', { willReadFrequently: true }) as PaintContext | null;
  if (context === null) throw new Error('paint.page: no 2D canvas to draw into');
  return context;
}

function decode(env: PaintRasterEnv, url: string): Promise<PaintImage> {
  const image = env.createImage();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('paint.page: the line art did not decode in time'));
    }, DECODE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('paint.page: the line art did not decode'));
    };
    image.decoding = 'async';
    image.src = url;
  });
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function contain(nw: number, nh: number, pw: number, ph: number) {
  if (!(nw > 0 && nh > 0)) return { x: 0, y: 0, w: pw, h: ph };
  const k = Math.min(pw / nw, ph / nh);
  const w = Math.round(nw * k);
  const h = Math.round(nh * k);
  return { x: Math.round((pw - w) / 2), y: Math.round((ph - h) / 2), w, h };
}

const OPEN_TAG = /<svg\b[^>]*>/i;

/** The SVG's aspect from its viewBox (or width/height), sized to the pixels it will fill. */
export function sizedSvg(svg: string, pw: number, ph: number) {
  const tag = OPEN_TAG.exec(svg)?.[0];
  if (tag === undefined) throw new TypeError('paint.page: art is not an SVG');
  const attr = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
  const box = attr('viewBox')
    ?.split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite);
  const nw = box?.length === 4 ? (box[2] ?? 0) : parseFloat(attr('width') ?? '');
  const nh = box?.length === 4 ? (box[3] ?? 0) : parseFloat(attr('height') ?? '');
  const fit = contain(nw, nh, pw, ph);
  const sized = tag
    .replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/^<svg\b/i, `<svg width="${String(fit.w)}" height="${String(fit.h)}"`);
  return { svg: svg.replace(tag, sized), fit };
}

interface TextureSource {
  source?: { resource?: unknown; pixelWidth?: number; pixelHeight?: number };
}

/** Draws the line art, contained and centred, into a fresh canvas of pw × ph pixels. */
export async function drawArt(
  env: PaintRasterEnv,
  art: unknown,
  pw: number,
  ph: number,
): Promise<PaintCanvas> {
  const canvas = env.createCanvas(pw, ph);
  const context = context2d(canvas);
  if (typeof art === 'string') {
    const text = art.trim();
    if (text.startsWith('<')) {
      const { svg, fit } = sizedSvg(text, pw, ph);
      const image = await decode(
        env,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      );
      context.drawImage(image, fit.x, fit.y, fit.w, fit.h);
      return canvas;
    }
    if (/^data:image\//i.test(text)) {
      const image = await decode(env, text);
      const fit = contain(
        positive(image.naturalWidth) ?? positive(image.width) ?? 0,
        positive(image.naturalHeight) ?? positive(image.height) ?? 0,
        pw,
        ph,
      );
      context.drawImage(image, fit.x, fit.y, fit.w, fit.h);
      return canvas;
    }
    throw new TypeError('paint.page: art must be an SVG string, a data: image URL or a texture');
  }
  const source = (art as TextureSource | null)?.source;
  const resource: unknown = source?.resource;
  if (typeof resource === 'object' && resource !== null) {
    const own = resource as { width?: unknown; height?: unknown };
    const fit = contain(
      positive(source?.pixelWidth) ?? positive(own.width) ?? 0,
      positive(source?.pixelHeight) ?? positive(own.height) ?? 0,
      pw,
      ph,
    );
    context.drawImage(resource, fit.x, fit.y, fit.w, fit.h);
    return canvas;
  }
  throw new TypeError('paint.page: art must be an SVG string, a data: image URL or a texture');
}

/**
 * Turns drawn line art into ink in place (colour to alpha against white) and returns the wall
 * mask: 1 where a fill must stop.
 */
export function inkify(context: PaintContext, pw: number, ph: number): Uint8Array {
  const image = context.getImageData(0, 0, pw, ph);
  const d = image.data;
  const mask = new Uint8Array(pw * ph);
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    const a = (d[i + 3] ?? 0) / 255;
    if (a === 0) continue;
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    const k = Math.max(255 - r, 255 - g, 255 - b) / 255;
    const alpha = a * k;
    if (k > 0) {
      d[i] = 255 - (255 - r) / k;
      d[i + 1] = 255 - (255 - g) / k;
      d[i + 2] = 255 - (255 - b) / k;
    }
    d[i + 3] = Math.round(alpha * 255);
    if (alpha >= WALL_ALPHA) mask[p] = 1;
  }
  context.putImageData(image, 0, 0);
  return mask;
}

/** '#rrggbb' from '#rgb', '#rrggbb' or 0xrrggbb; undefined for anything else. */
export function hexColor(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${text.slice(1).replace(/./g, (c) => c + c)}`;
  }
  return undefined;
}
