import { ANIMAL_ATLAS_SHA256 } from './animals/atlas.generated';
import { ANIMAL_NAMES, findAnimal } from './animals/names';
import {
  ANIMAL_LIMITS,
  animalSprite,
  animalTexture,
  animalTextures,
  type AnimalSpriteOptions,
} from './animals/texture';

export const ANIMALS_VERSION = '1.0.0';

/** Kenney asks for nothing; we credit anyway, as the pack's notice says it would be nice. */
export const ANIMALS_CREDIT = 'Animal Pack Remastered by Kenney (www.kenney.nl), CC0 1.0';

/**
 * `s.lib.animals` (animal art, 2026-11-05): 29 cute, consistent animal heads (the pack's pig is left out) for children's
 * stories and games — Kenney's Animal Pack Remastered (CC0 1.0), round style with details, drawn
 * from the pack's vector art at 2.25× and bundled as one WebP, so nothing is fetched. Names are
 * English ids (`panda`); `find` also reads Arabic («باندا», «الأرنب»). Plain JavaScript that never
 * imports Pixi: the namespace comes with the call (`s`, `s.PIXI` or `{ PIXI, app }`).
 *
 *   const panda = await s.lib.animals.sprite(s, 'panda', { size: 160, x: 300, y: 200 });
 *   s.world.addChild(panda);
 *
 *   // a head that peeks over an edge (s.lib.anim)
 *   const anim = s.lib.anim.create({ reducedMotion: s.reducedMotion });
 *   const p = anim.peek(s, { x: 400, y: 300, size: 120, texture: await s.lib.animals.texture(s, 'panda') });
 *   s.world.addChild(p.view);
 *
 *   // the head of a rigged character: idle nods, talk, celebrate…
 *   const root = new s.PIXI.Container();
 *   const head = root.addChild(await s.lib.animals.sprite(s, 'bear', { size: 120 }));
 *   s.world.addChild(root);
 *   anim.rig({ root, head }, { state: 'talk', size: 120 });
 */
export function createAnimalsLibrary() {
  return Object.freeze({
    version: ANIMALS_VERSION,
    credit: ANIMALS_CREDIT,
    limits: ANIMAL_LIMITS,
    names: ANIMAL_NAMES,
    /** The atlas hash (provenance). */
    atlasSha256: ANIMAL_ATLAS_SHA256,
    /** The animal an English or Arabic word names ('bunny' → 'rabbit', 'بومة' → 'owl'), or undefined. */
    find: (word: unknown) => findAnimal(word),
    texture: (target: unknown, name: unknown) => animalTexture(target, name),
    textures: (target: unknown, names: unknown) => animalTextures(target, names),
    sprite: (target: unknown, name: unknown, options?: AnimalSpriteOptions) =>
      animalSprite(target, name, options),
  });
}
