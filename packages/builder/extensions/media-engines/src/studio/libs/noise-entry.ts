import {
  createField,
  NOISE_CELLS,
  NOISE_FRACTALS,
  NOISE_LIMITS,
  NOISE_TYPES,
  type NoiseOptions,
} from './noise/field';

export const NOISE_VERSION = '1.0.0';

/**
 * `s.lib.noise` (mural libraries, 2026-10-13): seeded noise fields in design units for murals —
 * simplex or Worley cells, fbm / ridged / billow fractals, domain warp, a seamless 4-D loop and
 * sampled grids for `s.lib.geom` contours. Built on simplex-noise 4.0.3 (MIT), the kit's own
 * noise; plain JavaScript that never imports Pixi and holds nothing to dispose.
 */
export function createNoiseLibrary() {
  return Object.freeze({
    version: NOISE_VERSION,
    limits: NOISE_LIMITS,
    types: NOISE_TYPES,
    fractals: NOISE_FRACTALS,
    cells: NOISE_CELLS,
    create: (s: unknown, options?: NoiseOptions) => createField(s, options),
  });
}
