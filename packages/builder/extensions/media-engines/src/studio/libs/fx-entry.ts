import { createFx, FX_LIMITS, type FxOptions } from './fx/effects';
import { FX_PRESETS, PARTICLE_SHAPES, WEATHER_KINDS } from './fx/presets';
import type { PixiApp, PixiNamespace } from './shared/pixi-types';

export const FX_VERSION = '1.0.0';

/**
 * `s.lib.fx` (creative engines, 2026-10-12): game-feel and atmosphere effects — named bursts
 * (hit, coin, magic, heal, smoke, dust, explosion, confetti, sparkle, fire, splash, levelup),
 * weather (rain, snow, embers, leaves, stars, fireflies, bubbles), trails, shockwave rings,
 * screen flash, shake, floating text and glow pulses. Binds to the page's ONE Pixi namespace.
 */
export function createFxLibrary(PIXI: unknown) {
  return Object.freeze({
    version: FX_VERSION,
    limits: FX_LIMITS,
    presets: Object.freeze(Object.keys(FX_PRESETS)),
    shapes: PARTICLE_SHAPES,
    weatherKinds: WEATHER_KINDS,
    create: (app: unknown, options?: FxOptions) =>
      createFx(PIXI as PixiNamespace, app as PixiApp, options),
  });
}
