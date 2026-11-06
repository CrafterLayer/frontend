/*
  Stickers on the canvas (sticker art, 2026-11-05), rasterised exactly as `s.lib.peeps` does it:
  the browser decodes the sticker's SVG once (a data: URL — no network), it is drawn into a canvas
  at size × resolution, and that canvas becomes a Pixi texture with the same resolution, so a
  200 px sticker stays crisp on a 2× screen. Asynchronous because image decoding is; `await` it
  like `s.texture(url)`.

  A copy in spirit of peeps/texture.ts rather than an import: that module pulls the 110 kB of
  Open Peeps art in with it. Plain code: the Pixi namespace arrives with the call (the scene `s`,
  `s.PIXI`, or ck.stage()'s `{ PIXI, app }`), so pages that only need SVG never load Pixi for this.
*/

import { STICKER_LIMITS, sizeOf, stickerEntry } from './catalog';
import { stickerLineArt, stickerSvg, svgDataUrl, type StickerLineArtOptions } from './svg';

export interface StickerTextureOptions extends StickerLineArtOptions {
  /** Pixels per CSS pixel (1..3); defaults to the scene's resolution. */
  resolution?: number;
  /** The colouring-page outline (with `stroke` and `width`) instead of the colour sticker. */
  lineArt?: boolean;
}

interface TextureLike {
  readonly destroyed?: boolean;
}

interface TextureNamespace {
  Texture: { from(source: unknown, skipCache?: boolean): TextureLike };
}

interface ImageLike {
  src: string;
  decoding?: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): {
    drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
  } | null;
}

/** How a texture is rasterised; the browser's by default, injected by tests. */
export interface StickerRasterEnv {
  createImage(): ImageLike;
  createCanvas(width: number, height: number): CanvasLike;
  readonly devicePixelRatio?: number | undefined;
}

interface Target {
  readonly PIXI: TextureNamespace;
  readonly resolution: number | undefined;
  /** A still (reduced-motion) scene renders only when asked: render once the texture is in use. */
  readonly render: (() => void) | undefined;
}

const DECODE_TIMEOUT_MS = 10_000;
const MAX_CACHED = 64;
/** At most this many stickers per `textures()` call. */
export const MAX_TEXTURES = 64;

function isNamespace(value: unknown): value is TextureNamespace {
  const texture = (value as { Texture?: { from?: unknown } } | null)?.Texture;
  return typeof texture?.from === 'function';
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function targetOf(value: unknown): Target {
  if (isNamespace(value)) return { PIXI: value, resolution: undefined, render: undefined };
  const host = value as {
    PIXI?: unknown;
    dpr?: unknown;
    reducedMotion?: unknown;
    app?: { render?: () => void; renderer?: { resolution?: unknown } };
  } | null;
  if (host !== null && typeof host === 'object' && isNamespace(host.PIXI)) {
    const app = host.app;
    return {
      PIXI: host.PIXI,
      resolution: finite(host.dpr) ?? finite(app?.renderer?.resolution),
      render:
        host.reducedMotion === true && typeof app?.render === 'function'
          ? () => {
              try {
                app.render?.();
              } catch {
                // The scene was disposed before the texture arrived: nothing to draw.
              }
            }
          : undefined,
    };
  }
  throw new TypeError('stickers.texture needs the scene (s) or s.PIXI as its first argument');
}

function browserEnv(): StickerRasterEnv {
  const doc = (globalThis as { document?: Document }).document;
  const ImageClass = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (doc === undefined || typeof ImageClass !== 'function') {
    throw new Error(
      'stickers.texture runs in a browser; use stickers.svg or stickers.dataUrl elsewhere',
    );
  }
  return {
    // The DOM's onload takes an event; ImageLike's handlers ignore it.
    createImage: () => new ImageClass() as unknown as ImageLike,
    createCanvas(width, height) {
      const canvas = doc.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    devicePixelRatio: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
  };
}

function decode(env: StickerRasterEnv, url: string): Promise<ImageLike> {
  const image = env.createImage();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('stickers.texture: the sticker image did not decode in time'));
    }, DECODE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('stickers.texture: the sticker image did not decode'));
    };
    image.decoding = 'async';
    image.src = url;
  });
}

async function rasterize(env: StickerRasterEnv, svg: string, pixels: number): Promise<CanvasLike> {
  const image = await decode(env, svgDataUrl(svg));
  const canvas = env.createCanvas(pixels, pixels);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('stickers.texture: no 2D canvas to draw into');
  context.drawImage(image, 0, 0, pixels, pixels);
  return canvas;
}

interface CacheEntry {
  readonly promise: Promise<TextureLike>;
  texture?: TextureLike;
}

/* Per Pixi namespace, so two pages' runtimes never share a texture; small and least-recent-first. */
const caches = new WeakMap<object, Map<string, CacheEntry>>();

function cacheFor(PIXI: TextureNamespace): Map<string, CacheEntry> {
  let cache = caches.get(PIXI);
  if (cache === undefined) {
    cache = new Map();
    caches.set(PIXI, cache);
  }
  return cache;
}

function unknownSticker(name: unknown): TypeError {
  const shown = typeof name === 'string' ? `"${name.slice(0, 40)}"` : typeof name;
  return new TypeError(
    `stickers.texture: no sticker answers to ${shown}; try stickers.search(word) or stickers.names`,
  );
}

/** One sticker as a Pixi texture, `size` CSS pixels square at the target's resolution. */
export function stickerTexture(
  target: unknown,
  name: unknown,
  options?: StickerTextureOptions | null,
  env?: StickerRasterEnv,
): Promise<unknown> {
  let host: Target;
  let raster: StickerRasterEnv;
  try {
    host = targetOf(target);
    if (stickerEntry(name) === undefined) throw unknownSticker(name);
    raster = env ?? browserEnv();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  const input = typeof options === 'object' && options !== null ? options : {};
  const resolution = Math.min(
    3,
    Math.max(
      1,
      finite(input.resolution) ?? host.resolution ?? finite(raster.devicePixelRatio) ?? 1,
    ),
  );
  const pixels = Math.min(STICKER_LIMITS.maxSize, Math.round(sizeOf(input.size) * resolution));
  const svg =
    input.lineArt === true
      ? stickerLineArt(name, { ...input, size: pixels })
      : stickerSvg(name, { size: pixels });
  // stickerEntry(name) was checked above, so both drawers return markup.
  const markup = svg ?? '';
  const key = `${String(resolution)}|${markup}`;
  const cache = cacheFor(host.PIXI);
  let entry = cache.get(key);
  if (entry !== undefined && entry.texture?.destroyed === true) {
    cache.delete(key);
    entry = undefined;
  }
  if (entry === undefined) {
    const created: CacheEntry = {
      promise: rasterize(raster, markup, pixels).then((canvas) => {
        const texture = host.PIXI.Texture.from({ resource: canvas, resolution }, true);
        created.texture = texture;
        return texture;
      }),
    };
    created.promise.catch(() => {
      if (cache.get(key) === created) cache.delete(key);
    });
    entry = created;
  } else {
    cache.delete(key);
  }
  cache.set(key, entry);
  for (const oldest of cache.keys()) {
    if (cache.size <= MAX_CACHED) break;
    cache.delete(oldest);
  }
  const render = host.render;
  return entry.promise.then((texture) => {
    // Timers run after the awaiting code has placed the sprite.
    if (render !== undefined) setTimeout(render, 0);
    return texture;
  });
}

/** Several stickers at once: `{ cat: texture, 'قطة': texture, … }`, keyed by the words given. */
export async function stickerTextures(
  target: unknown,
  names: unknown,
  options?: StickerTextureOptions | null,
  env?: StickerRasterEnv,
): Promise<Readonly<Record<string, unknown>>> {
  if (!Array.isArray(names)) {
    throw new TypeError('stickers.textures needs a list of sticker names, e.g. ["cat", "sun"]');
  }
  const wanted = [...new Set(names as unknown[])].slice(0, MAX_TEXTURES);
  const unknown = wanted.filter((name) => stickerEntry(name) === undefined);
  if (unknown.length > 0) throw unknownSticker(unknown[0]);
  const textures = await Promise.all(
    wanted.map((name) => stickerTexture(target, name, options, env)),
  );
  const result: Record<string, unknown> = {};
  wanted.forEach((name, index) => {
    result[String(name)] = textures[index];
  });
  return Object.freeze(result);
}
