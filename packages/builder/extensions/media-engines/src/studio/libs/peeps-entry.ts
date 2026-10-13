import { createPeepCast, MAX_PEEP_CAST } from './peeps/cast';
import {
  HAIR_COLORS,
  MOOD_FACES,
  PEEP_ACCESSORIES,
  PEEP_FACES,
  PEEP_FACIAL_HAIR,
  PEEP_HAIR,
  PEEP_LIMITS,
  PEEP_MOODS,
  PEEPS_CREDIT,
  SKIN_TONES,
  moodOf,
  peepDataUrl,
  peepSvg,
  type PeepOptions,
} from './peeps/looks';
import { CORE_MOODS, peepTexture, peepTextures, type PeepTextureOptions } from './peeps/texture';

export const PEEPS_VERSION = '9.4.3';

/**
 * `s.lib.peeps` (character art, 2026-10-13): people for stories and games — Open Peeps, Pablo
 * Stanley's hand-drawn characters (CC0 1.0), drawn by DiceBear's open-peeps style (MIT), bundled
 * whole, so nothing is fetched at run time. A seed (a character's name) fixes the look; a mood
 * picks the face; art direction pins hair, skin, outfit and accessories. `svg` and `dataUrl` are
 * pure; `texture` and `textures` rasterize for the canvas. Plain JavaScript; it never imports Pixi.
 */
export function createPeepsLibrary() {
  return Object.freeze({
    version: PEEPS_VERSION,
    credit: PEEPS_CREDIT,
    limits: Object.freeze({ ...PEEP_LIMITS, maxCast: MAX_PEEP_CAST }),
    moods: PEEP_MOODS,
    coreMoods: CORE_MOODS,
    faces: PEEP_FACES,
    hair: PEEP_HAIR,
    accessories: PEEP_ACCESSORIES,
    facialHair: PEEP_FACIAL_HAIR,
    skins: Object.freeze(Object.keys(SKIN_TONES)),
    hairColors: Object.freeze(Object.keys(HAIR_COLORS)),
    /** The canonical mood a word names ('excited' → 'happy', 'حزين' → 'sad'); 'calm' otherwise. */
    mood: (name: string) => moodOf(name),
    /** The Open Peeps face a mood shows. */
    face: (mood: string) => MOOD_FACES[moodOf(mood)],
    svg: (options?: PeepOptions) => peepSvg(options),
    dataUrl: (options?: PeepOptions) => peepDataUrl(options),
    texture: (target: unknown, options?: PeepTextureOptions) => peepTexture(target, options),
    textures: (target: unknown, options?: PeepTextureOptions, moods?: readonly string[]) =>
      peepTextures(target, options, moods),
    cast: (entries: unknown) => createPeepCast(entries),
  });
}
