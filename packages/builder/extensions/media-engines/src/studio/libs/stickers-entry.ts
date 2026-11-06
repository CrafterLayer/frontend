import {
  STICKER_GROUPS,
  STICKER_LIMITS,
  STICKER_NAMES,
  STICKERS_CREDIT,
  findSticker,
  searchStickers,
  stickerInfo,
} from './stickers/catalog';
import { FLUENT_EMOJI_FLAT_VERSION } from './stickers/stickers.generated';
import {
  stickerDataUrl,
  stickerLineArt,
  stickerSvg,
  type StickerLineArtOptions,
  type StickerSvgOptions,
} from './stickers/svg';
import {
  MAX_TEXTURES,
  stickerTexture,
  stickerTextures,
  type StickerTextureOptions,
} from './stickers/texture';

export const STICKERS_VERSION = FLUENT_EMOJI_FLAT_VERSION;

/**
 * `s.lib.stickers` (sticker art, 2026-11-05): a big, friendly picture vocabulary for children's
 * stories and drawings — 496 of Microsoft's Fluent Emoji Flat (MIT) in 17 groups (animals, food,
 * vehicles, fantasy, faces, the Arab and Muslim everyday set…), bundled whole, so nothing is
 * fetched at run time. Each answers to its English name and to Arabic and English aliases
 * (`find('قطة')` → 'cat'). `svg`, `dataUrl` and `lineArt` (a colouring-page outline) are pure;
 * `texture` and `textures` rasterise for the canvas. Plain JavaScript; it never imports Pixi.
 */
export function createStickersLibrary() {
  return Object.freeze({
    version: STICKERS_VERSION,
    credit: STICKERS_CREDIT,
    limits: Object.freeze({ ...STICKER_LIMITS, maxTextures: MAX_TEXTURES }),
    count: STICKER_NAMES.length,
    names: STICKER_NAMES,
    groups: STICKER_GROUPS,
    /** The best sticker name for a word (English or Arabic), or undefined. */
    find: (word: string) => findSticker(word),
    /** Sticker names that answer a word or a group ('animals', 'حيوانات'), best first. */
    search: (word: string, limit?: number) => searchStickers(word, limit),
    /** A sticker's name, group, aliases and viewBox, or undefined. */
    info: (name: string) => stickerInfo(name),
    svg: (name: string, options?: StickerSvgOptions) => stickerSvg(name, options),
    dataUrl: (name: string, options?: StickerSvgOptions) => stickerDataUrl(name, options),
    lineArt: (name: string, options?: StickerLineArtOptions) => stickerLineArt(name, options),
    texture: (target: unknown, name: string, options?: StickerTextureOptions) =>
      stickerTexture(target, name, options),
    textures: (target: unknown, names: readonly string[], options?: StickerTextureOptions) =>
      stickerTextures(target, names, options),
  });
}
