import {
  createRig,
  createSpriteAnimator,
  RIG_STATES,
  type RigOptions,
  type SpriteAnimatorOptions,
} from './anim/character';
import { EASINGS, lerp, mixColor, resolveEase } from './anim/easing';
import {
  createPeeker,
  PEEK_EARS,
  PEEK_MODES,
  PEEK_MOUTHS,
  PEEK_SHAPES,
  type PeekOptions,
} from './anim/peek';
import { createAnimator, MAX_TWEENS, type AnimatorOptions } from './anim/tween';

export const ANIM_VERSION = '1.0.0';

/**
 * `s.lib.anim` (creative engines, 2026-10-12): tweens, timelines, springs, shake, frame-based
 * sprite states and procedural character rigs. Plain JavaScript; it never imports Pixi, so it
 * animates any object with numeric properties. `peek(s, options)` (2026-11-05) draws a character
 * that peeks over an edge with the Pixi namespace the call hands it.
 */
export function createAnimLibrary() {
  return Object.freeze({
    version: ANIM_VERSION,
    MAX_TWEENS,
    easings: EASINGS,
    ease: resolveEase,
    lerp,
    mixColor,
    rigStates: RIG_STATES,
    peekEars: PEEK_EARS,
    peekShapes: PEEK_SHAPES,
    peekMouths: PEEK_MOUTHS,
    peekModes: PEEK_MODES,
    create(options?: AnimatorOptions) {
      const animator = createAnimator(options);
      return Object.assign(animator, {
        sprite: (view: unknown, spriteOptions: SpriteAnimatorOptions) =>
          createSpriteAnimator(animator, view, spriteOptions),
        rig: (parts: Readonly<Record<string, unknown>>, rigOptions?: RigOptions) =>
          createRig(animator, parts, rigOptions),
        peek: (target: unknown, peekOptions?: PeekOptions) =>
          createPeeker(animator, target, peekOptions),
      });
    },
  });
}
