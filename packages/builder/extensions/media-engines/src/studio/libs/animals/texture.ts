/*
  Animal heads on the canvas (animal art, 2026-11-05). The bundled atlas is a data: URL decoded by
  an <img> once per Pixi namespace (nothing is fetched, so it works under the preview's
  connect-src 'none'; Pixi's Assets loader would fetch it); each head is a Texture framed out of
  that one source and cached, so a cast of twelve pandas costs one upload. Asynchronous because
  image decoding is; `await` it like `s.texture(url)`.

  Plain code: the Pixi namespace arrives with the call (the scene `s`, `s.PIXI`, or ck.stage()'s
  `{ PIXI, app }`), like `s.lib.peeps.texture`, so the library never imports Pixi.
*/

import { ANIMAL_ATLAS_URL, ANIMAL_FRAMES } from './atlas.generated';
import { animalName } from './names';

export const ANIMAL_LIMITS = Object.freeze({ minSize: 8, maxSize: 2000, defaultSize: 128 });

interface TextureLike {
  readonly destroyed?: boolean;
  readonly source?: { readonly destroyed?: boolean } | null;
  destroy(destroySource?: boolean): void;
}

interface SpriteLike {
  x: number;
  y: number;
  label?: string;
  anchor: { set(x: number, y?: number): void };
  scale: { set(x: number, y?: number): void };
}

interface AnimalPixi {
  Texture: {
    new (options: { source: unknown; frame: unknown }): TextureLike;
    from(resource: unknown, skipCache?: boolean): TextureLike;
  };
  Rectangle: new (x: number, y: number, width: number, height: number) => unknown;
  Sprite: new (texture?: unknown) => SpriteLike;
}

interface Target {
  readonly PIXI: AnimalPixi;
  /** A still (reduced-motion) scene renders only when asked: render once the texture is in use. */
  readonly render: (() => void) | undefined;
}

/** How the atlas image is decoded; an <img> by default, injected by tests. */
export type AtlasDecoder = (url: string) => Promise<unknown>;

const DECODE_TIMEOUT_MS = 10_000;

function isNamespace(value: unknown): value is AnimalPixi {
  const PIXI = value as Partial<AnimalPixi> | null;
  return (
    PIXI !== null &&
    typeof PIXI === 'object' &&
    typeof PIXI.Texture?.from === 'function' &&
    typeof PIXI.Rectangle === 'function' &&
    typeof PIXI.Sprite === 'function'
  );
}

function targetOf(value: unknown, caller: string): Target {
  if (isNamespace(value)) return { PIXI: value, render: undefined };
  const host = value as {
    PIXI?: unknown;
    reducedMotion?: unknown;
    app?: { render?: () => void };
  } | null;
  if (host !== null && typeof host === 'object' && isNamespace(host.PIXI)) {
    const app = host.app;
    return {
      PIXI: host.PIXI,
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
  throw new TypeError(`animals.${caller} needs the scene (s) or s.PIXI as its first argument`);
}

export function decodeAtlas(url: string): Promise<unknown> {
  const ImageClass = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (typeof ImageClass !== 'function') {
    return Promise.reject(new Error('animals: the atlas decodes in a browser'));
  }
  const image = new ImageClass();
  image.decoding = 'async';
  image.src = url;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('animals: the atlas did not decode in time'));
    }, DECODE_TIMEOUT_MS);
  });
  return Promise.race([image.decode().then(() => image), timeout]).finally(() => {
    clearTimeout(timer);
  });
}

interface Atlas {
  readonly texture: TextureLike;
  readonly frames: Map<string, TextureLike>;
}

/* One decoded atlas per Pixi namespace, so two pages' runtimes never share a texture. */
const atlases = new WeakMap<object, Promise<Atlas>>();

function alive(texture: TextureLike): boolean {
  return texture.destroyed !== true && texture.source?.destroyed !== true;
}

async function atlasFor(PIXI: AnimalPixi, decode: AtlasDecoder): Promise<Atlas> {
  const cached = atlases.get(PIXI);
  if (cached !== undefined) {
    const atlas = await cached.catch(() => undefined);
    if (atlas !== undefined && alive(atlas.texture)) return atlas;
    // A scene destroyed it with its textures (or the decode failed): decode it again.
    if (atlases.get(PIXI) === cached) atlases.delete(PIXI);
    return atlasFor(PIXI, decode);
  }
  const promise = decode(ANIMAL_ATLAS_URL).then((image) => ({
    texture: PIXI.Texture.from(image, true),
    frames: new Map<string, TextureLike>(),
  }));
  atlases.set(PIXI, promise);
  return promise;
}

function frameOf(PIXI: AnimalPixi, atlas: Atlas, name: string): TextureLike {
  const cached = atlas.frames.get(name);
  if (cached !== undefined && cached.destroyed !== true) return cached;
  const [x, y, width, height] = ANIMAL_FRAMES[name] ?? [0, 0, 1, 1];
  const texture = new PIXI.Texture({
    source: atlas.texture.source,
    frame: new PIXI.Rectangle(x, y, width, height),
  });
  atlas.frames.set(name, texture);
  return texture;
}

function settle<T>(target: Target, value: T): T {
  // Timers run after the awaiting code has placed the sprite.
  if (target.render !== undefined) setTimeout(target.render, 0);
  return value;
}

/** One head as a Pixi Texture (the frame's own pixels; `sprite` sizes it). */
export async function animalTexture(
  target: unknown,
  name: unknown,
  decode: AtlasDecoder = decodeAtlas,
): Promise<unknown> {
  const host = targetOf(target, 'texture');
  const animal = animalName(name, 'texture');
  const atlas = await atlasFor(host.PIXI, decode);
  return settle(host, frameOf(host.PIXI, atlas, animal));
}

/** Several heads at once: `{ panda, owl, … }` by canonical name. */
export async function animalTextures(
  target: unknown,
  names: unknown,
  decode: AtlasDecoder = decodeAtlas,
): Promise<Readonly<Record<string, unknown>>> {
  const host = targetOf(target, 'textures');
  if (!Array.isArray(names)) {
    throw new TypeError("animals.textures needs a list of names, e.g. ['panda', 'owl']");
  }
  const wanted = [...new Set(names.map((name: unknown) => animalName(name, 'textures')))];
  const atlas = await atlasFor(host.PIXI, decode);
  const result: Record<string, unknown> = {};
  for (const animal of wanted) result[animal] = frameOf(host.PIXI, atlas, animal);
  return settle(host, Object.freeze(result));
}

export interface AnimalSpriteOptions {
  /** Width in px (8..2000; default 128); the height follows the head's own proportions. */
  size?: number;
  x?: number;
  y?: number;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A PIXI.Sprite of one head, anchored at its centre, `size` px wide, not yet on the stage. */
export async function animalSprite(
  target: unknown,
  name: unknown,
  options?: AnimalSpriteOptions | null,
  decode: AtlasDecoder = decodeAtlas,
): Promise<unknown> {
  const host = targetOf(target, 'sprite');
  const animal = animalName(name, 'sprite');
  const input = typeof options === 'object' && options !== null ? options : {};
  const size = Math.min(
    ANIMAL_LIMITS.maxSize,
    Math.max(ANIMAL_LIMITS.minSize, finite(input.size, ANIMAL_LIMITS.defaultSize)),
  );
  const atlas = await atlasFor(host.PIXI, decode);
  const sprite = new host.PIXI.Sprite(frameOf(host.PIXI, atlas, animal));
  sprite.anchor.set(0.5);
  sprite.scale.set(size / (ANIMAL_FRAMES[animal]?.[2] ?? size));
  sprite.x = finite(input.x, 0);
  sprite.y = finite(input.y, 0);
  sprite.label = `animal:${animal}`;
  return settle(host, sprite);
}
