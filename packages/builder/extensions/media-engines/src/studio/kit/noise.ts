/*
  Seeded simplex noise for the scene kit (pixi-studio §B.2: s.noise2 / s.noise3 / s.fbm).

  The noise itself is `simplex-noise` 4.0.3 (MIT (c) 2018 Jonas Wagner), installed from the
  catalog and bundled into ck-lib-kit.js; its notice travels in the asset banner and its LICENSE
  is kept in vendor/simplex-noise/. It takes a random function, so the field is seeded from the
  scene's seed and is identical on every load.
*/

import { createNoise2D, createNoise3D } from 'simplex-noise';

import { mulberry32, seedToInt } from './random';

export interface SceneNoise {
  /** Simplex noise in [-1, 1]. */
  noise2(x: number, y: number): number;
  /** Simplex noise in [-1, 1]. */
  noise3(x: number, y: number, z: number): number;
  /**
   * Fractal Brownian motion of noise2: `octaves` (1..8, default 4) layers, each at twice the
   * frequency and half the amplitude, normalised back into [-1, 1].
   */
  fbm(x: number, y: number, octaves?: number): number;
}

export function createNoise(seed: number | string): SceneNoise {
  // Separate streams so noise2 and noise3 are independent fields of the same seed.
  const base = seedToInt(seed);
  const noise2 = createNoise2D(mulberry32(base ^ 0x2d2d));
  const noise3 = createNoise3D(mulberry32(base ^ 0x3d3d));
  return {
    noise2,
    noise3,
    fbm(x: number, y: number, octaves = 4): number {
      const layers = Math.max(1, Math.min(8, Math.round(octaves)));
      let total = 0;
      let amplitude = 1;
      let frequency = 1;
      let norm = 0;
      for (let layer = 0; layer < layers; layer += 1) {
        total += noise2(x * frequency, y * frequency) * amplitude;
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      return total / norm;
    },
  };
}
