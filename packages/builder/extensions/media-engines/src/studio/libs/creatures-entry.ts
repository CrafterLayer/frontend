import { buildCreature } from './creatures/build';
import {
  ACCESSORIES,
  BODY_SHAPES,
  CREATURE_KINDS,
  CREATURE_LIMITS,
  CREATURE_MOODS,
  EAR_STYLES,
  EYE_STYLES,
  HEAD_SHAPES,
  HORN_STYLES,
  MOUTH_STYLES,
  PATTERNS,
  SPIKE_STYLES,
  TAIL_STYLES,
  WING_STYLES,
  defineCreature,
  moodOf,
  randomCreature,
  type CreatureInput,
} from './creatures/define';
import { createCreature, type CreateOptions } from './creatures/pixi';
import { creatureDataUrl, creatureSvg, type CreatureSvgOptions } from './creatures/svg';
import { creatureTexture, type CreatureTextureOptions } from './creatures/texture';

export const CREATURES_VERSION = '1.0.0';

/**
 * `s.lib.creatures` (character art, 2026-11-05): original, cute fantasy characters for children's
 * stories and games — dragons, unicorns, friendly monsters, dinos, robots, aliens, ghosts, slimes,
 * griffins, fox spirits, bunny sprites, bear cubs, star sprites, mushroom sprites and sea
 * creatures. A character is data (a kind, a name that fixes its look, optional parts, palette
 * and mood); it draws as shaded vector art with Pixi (`create`, rigged for `s.lib.anim`) or as an
 * SVG string (`svg`, `dataUrl`, `texture`). Plain JavaScript; it never imports Pixi.
 *
 *   const a = s.lib.anim.create({ reducedMotion: s.reducedMotion });
 *   s.tick((time) => a.update(time.dt));
 *   const zahra = s.lib.creatures.create(s, { kind: 'dragon', name: 'Zahra', mood: 'shy' },
 *     { size: 220, x: 300, y: 420, animator: a });   // added to s.world, feet at (x, y)
 *   zahra.rig(a, { state: 'walk' });                  // anim.rig drives its joints
 *   zahra.face.set('excited');                         // eyes, brows and mouth change
 *
 *   img.src = s.lib.creatures.dataUrl({ kind: 'unicorn', name: 'Noor' }, { size: 128 });
 */
export function createCreaturesLibrary() {
  return Object.freeze({
    version: CREATURES_VERSION,
    kinds: CREATURE_KINDS,
    moods: CREATURE_MOODS,
    limits: CREATURE_LIMITS,
    parts: Object.freeze({
      body: BODY_SHAPES,
      head: HEAD_SHAPES,
      ears: EAR_STYLES,
      horns: HORN_STYLES,
      wings: WING_STYLES,
      tail: TAIL_STYLES,
      spikes: SPIKE_STYLES,
      eyes: EYE_STYLES,
      mouth: MOUTH_STYLES,
      pattern: PATTERNS,
      accessory: ACCESSORIES,
    }),
    /** The complete, normalised definition (unknown fields dropped, bad values replaced). */
    define: (input?: CreatureInput | string | null) => defineCreature(input),
    /** A random character for a seed (a number or any text); the same seed, the same character. */
    random: (seed?: unknown) => randomCreature(seed),
    /** The canonical mood a word names ('cross' → 'grumpy'); 'happy' otherwise. */
    mood: (word: unknown) => moodOf(word),
    create: (
      target: unknown,
      input?: CreatureInput | string | null,
      options?: CreateOptions | null,
    ) => createCreature(target, input, options),
    svg: (input?: CreatureInput | string | null, options?: CreatureSvgOptions | null) =>
      creatureSvg(input, options),
    dataUrl: (input?: CreatureInput | string | null, options?: CreatureSvgOptions | null) =>
      creatureDataUrl(input, options),
    texture: (
      target: unknown,
      input?: CreatureInput | string | null,
      options?: CreatureTextureOptions | null,
    ) => creatureTexture(target, input, options),
    /** The renderer-independent part tree (for custom renderers and tests). */
    geometry: (input?: CreatureInput | string | null, mood?: string) => {
      const def = defineCreature(input);
      return buildCreature(def, mood === undefined ? def.mood : moodOf(mood));
    },
  });
}
