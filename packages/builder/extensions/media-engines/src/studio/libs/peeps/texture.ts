/*
  Peeps on the canvas (character art, 2026-10-13). The browser decodes the character's SVG once
  (a data: URL — no network), it is drawn into a canvas at size × resolution, and that canvas
  becomes a Pixi texture with the same resolution, so a 200 px character stays crisp on a 2×
  screen. Asynchronous because image decoding is; `await` it like `s.texture(url)`.

  Plain code: the Pixi namespace arrives with the call (the scene `s`, `s.PIXI`, or ck.stage()'s
  `{ PIXI, app }`), so pages that only need SVG or portraits never load Pixi for this library.
*/

import {
  PEEP_LIMITS,
  PEEP_MOODS,
  moodOf,
  peepSvg,
  sizeOf,
  svgDataUrl,
  type PeepMood,
  type PeepOptions,
} from './looks';

export interface PeepTextureOptions extends PeepOptions {
  /** Pixels per CSS pixel (1..3); defaults to the scene's resolution. */
  resolution?: number;
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

/** How a texture is rasterized; the browser's by default, injected by tests. */
export interface PeepRasterEnv {
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
const MAX_CACHED = 32;
/** The six moods `textures()` prepares when no list is given. */
export const CORE_MOODS: readonly PeepMood[] = Object.freeze(PEEP_MOODS.slice(0, 6));

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
  throw new TypeError('peeps.texture needs the scene (s) or s.PIXI as its first argument');
}

function browserEnv(): PeepRasterEnv {
  const doc = (globalThis as { document?: Document }).document;
  const ImageClass = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (doc === undefined || typeof ImageClass !== 'function') {
    throw new Error('peeps.texture runs in a browser; use peeps.svg or peeps.dataUrl elsewhere');
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

function decode(env: PeepRasterEnv, url: string): Promise<ImageLike> {
  const image = env.createImage();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('peeps.texture: the character image did not decode in time'));
    }, DECODE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('peeps.texture: the character image did not decode'));
    };
    image.decoding = 'async';
    image.src = url;
  });
}

async function rasterize(env: PeepRasterEnv, svg: string, pixels: number): Promise<CanvasLike> {
  const image = await decode(env, svgDataUrl(svg));
  const canvas = env.createCanvas(pixels, pixels);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('peeps.texture: no 2D canvas to draw into');
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

/** One character as a Pixi texture, `size` CSS pixels square at the target's resolution. */
export function peepTexture(
  target: unknown,
  options?: PeepTextureOptions | null,
  env?: PeepRasterEnv,
): Promise<unknown> {
  let host: Target;
  let raster: PeepRasterEnv;
  try {
    host = targetOf(target);
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
  const pixels = Math.min(PEEP_LIMITS.maxSize, Math.round(sizeOf(input.size) * resolution));
  const svg = peepSvg({ ...input, size: pixels });
  const key = `${String(resolution)}|${svg}`;
  const cache = cacheFor(host.PIXI);
  let entry = cache.get(key);
  if (entry !== undefined && entry.texture?.destroyed === true) {
    cache.delete(key);
    entry = undefined;
  }
  if (entry === undefined) {
    const created: CacheEntry = {
      promise: rasterize(raster, svg, pixels).then((canvas) => {
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

/** Several moods of one character at once: `{ calm, happy, … }` textures to swap per line. */
export async function peepTextures(
  target: unknown,
  options?: PeepTextureOptions | null,
  moods?: readonly string[],
  env?: PeepRasterEnv,
): Promise<Readonly<Record<string, unknown>>> {
  const wanted = Array.isArray(moods) ? [...new Set(moods.map(moodOf))].slice(0, 12) : CORE_MOODS;
  const input = typeof options === 'object' && options !== null ? options : {};
  const textures = await Promise.all(
    wanted.map((mood) => peepTexture(target, { ...input, mood }, env)),
  );
  const result: Record<string, unknown> = {};
  wanted.forEach((mood, index) => {
    result[mood] = textures[index];
  });
  return Object.freeze(result);
}
