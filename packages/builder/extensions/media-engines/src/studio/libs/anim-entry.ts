import {
  createRig,
  createSpriteAnimator,
  RIG_STATES,
  type RigOptions,
  type SpriteAnimatorOptions,
} from './anim/character';
import { EASINGS, lerp, mixColor, resolveEase } from './anim/easing';
import { createAnimator, MAX_TWEENS, type AnimatorOptions } from './anim/tween';

export const ANIM_VERSION = '1.0.0';

/**
 * `s.lib.anim` (creative engines, 2026-10-12): tweens, timelines, springs, shake, frame-based
 * sprite states and procedural character rigs. Plain JavaScript; it never imports Pixi, so it
 * animates any object with numeric properties.
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
    create(options?: AnimatorOptions) {
      const animator = createAnimator(options);
      return Object.assign(animator, {
        sprite: (view: unknown, spriteOptions: SpriteAnimatorOptions) =>
          createSpriteAnimator(animator, view, spriteOptions),
        rig: (parts: Readonly<Record<string, unknown>>, rigOptions?: RigOptions) =>
          createRig(animator, parts, rigOptions),
      });
    },
  });
}
