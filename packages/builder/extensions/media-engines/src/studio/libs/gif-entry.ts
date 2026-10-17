import { decodeGif } from './gif/decode';
import { GIF_LIMITS } from './gif/inspect';
import { readGifBytes } from './gif/load';
import { createGifSprite, type GifControls, type GifOptions } from './gif/sprite';

export const GIF_VERSION = '2.1.2';

function bytesOf(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError('gif.from needs the GIF as an ArrayBuffer or Uint8Array');
}

/**
 * `s.lib.gif` (animated GIFs, 2026-10-13): a GIF the person supplied, animated on the canvas as a
 * PIXI.Sprite with AnimatedSprite-style controls. gifuct-js 2.1.2 (MIT) decodes; frames are
 * composited here, bounded by GIF_LIMITS (long GIFs are thinned, never refused for length),
 * advanced by the scene's ticker, still under reduced motion and destroyed with the scene. URLs
 * follow s.texture's rule (https:, data:image/gif, blob:); a data: URL needs no network. Plain
 * JavaScript; the Sprite class comes from the scene's own Pixi namespace.
 */
export function createGifLibrary() {
  return Object.freeze({
    version: GIF_VERSION,
    limits: GIF_LIMITS,
    /** Fetch (or read a data: URL), decode and wrap: `await s.lib.gif.load(s, url)`. */
    load: async (s: unknown, url: unknown, options?: GifOptions): Promise<GifControls> => {
      const bytes = await readGifBytes(url);
      return createGifSprite(s, decodeGif(bytes), options);
    },
    /** The same from bytes the page already holds (a dropped or picked file). */
    from: (s: unknown, data: unknown, options?: GifOptions): GifControls =>
      createGifSprite(s, decodeGif(bytesOf(data)), options),
  });
}
