/*
  Creatures as textures (character art, 2026-11-05), the way `s.lib.peeps` rasterises: the
  character's SVG is decoded once from a data: URL (no network), drawn into a canvas at
  size × resolution, and that canvas becomes a Pixi texture with the same resolution, so a 200 px
  character stays crisp on a 2× screen. Asynchronous because image decoding is.

  The raster environment is injectable (tests pass a fake image and canvas).
*/

import { asDef, CREATURE_LIMITS, moodOf, type CreatureMood } from './define';
import { buildCreature } from './build';
import { builtSvg, sizeOf, svgDataUrl } from './svg';

export interface CreatureTextureOptions {
  size?: number;
  /** Pixels per CSS pixel (1..3); the scene's resolution by default. */
  resolution?: number;
  mood?: CreatureMood | (string & {});
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
  getContext(
    type: '2d',
  ): { drawImage(image: unknown, x: number, y: number, w: number, h: number): void } | null;
}

/** How a texture is rasterised; the browser's by default, injected by tests. */
export interface CreatureRasterEnv {
  createImage(): ImageLike;
  createCanvas(width: number, height: number): CanvasLike;
  readonly devicePixelRatio?: number | undefined;
}

interface Target {
  readonly PIXI: TextureNamespace;
  readonly resolution: number | undefined;
  readonly render: (() => void) | undefined;
}

const DECODE_TIMEOUT_MS = 10_000;
const MAX_CACHED = 32;
const MAX_PIXELS = 2048;

function isNamespace(value: unknown): value is TextureNamespace {
  return typeof (value as { Texture?: { from?: unknown } } | null)?.Texture?.from === 'function';
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
  throw new TypeError('creatures.texture needs the scene (s) or s.PIXI as its first argument');
}

function browserEnv(): CreatureRasterEnv {
  const doc = (globalThis as { document?: Document }).document;
  const ImageClass = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (doc === undefined || typeof ImageClass !== 'function') {
    throw new Error(
      'creatures.texture runs in a browser; use creatures.svg or creatures.dataUrl elsewhere',
    );
  }
  return {
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

function decode(env: CreatureRasterEnv, url: string): Promise<ImageLike> {
  const image = env.createImage();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('creatures.texture: the character image did not decode in time'));
    }, DECODE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('creatures.texture: the character image did not decode'));
    };
    image.decoding = 'async';
    image.src = url;
  });
}

interface CacheEntry {
  readonly promise: Promise<TextureLike>;
  texture?: TextureLike;
}

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
export function creatureTexture(
  target: unknown,
  input?: unknown,
  options?: CreatureTextureOptions | null,
  env?: CreatureRasterEnv,
): Promise<unknown> {
  let host: Target;
  let raster: CreatureRasterEnv;
  try {
    host = targetOf(target);
    raster = env ?? browserEnv();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  const opts = typeof options === 'object' && options !== null ? options : {};
  const def = asDef(input);
  const mood = opts.mood === undefined ? def.mood : moodOf(opts.mood);
  const resolution = Math.min(
    3,
    Math.max(1, finite(opts.resolution) ?? host.resolution ?? finite(raster.devicePixelRatio) ?? 1),
  );
  const pixels = Math.min(
    MAX_PIXELS,
    Math.round(sizeOf(opts.size, CREATURE_LIMITS.defaultSize) * resolution),
  );
  const svg = builtSvg(buildCreature(def, mood), pixels);
  const key = `${String(resolution)}|${svg}`;
  const cache = cacheFor(host.PIXI);
  let entry = cache.get(key);
  if (entry?.texture?.destroyed === true) {
    cache.delete(key);
    entry = undefined;
  }
  if (entry === undefined) {
    const created: CacheEntry = {
      promise: decode(raster, svgDataUrl(svg)).then((image) => {
        const canvas = raster.createCanvas(pixels, pixels);
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('creatures.texture: no 2D canvas to draw into');
        context.drawImage(image, 0, 0, pixels, pixels);
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
    if (render !== undefined) setTimeout(render, 0);
    return texture;
  });
}
