/*
  FastNoiseLite's noises in `s.lib.noise` (2026-10-13, on the owner's word): Perlin's softer grain,
  value noise's blocky clouds and its smooth cubic form, and OpenSimplex2 / 2S — looks simplex-noise
  does not give. FastNoiseLite 1.1.1 (MIT, © Jordan Peck and contributors), vendored verbatim under
  vendor/fastnoise-lite with its licence (the npm tarball has none). Each type is ONE octave in
  feature units at frequency 1, with no fractal of its own: the field layers the octaves (fbm,
  ridged, billow), warps and drifts it exactly as it does simplex, so every option means the same
  on every type.
*/
import FastNoiseLite from '../../../../vendor/fastnoise-lite/FastNoiseLite.js';

export const FAST_NOISE_TYPES = Object.freeze([
  'perlin',
  'value',
  'value-cubic',
  'opensimplex2',
  'opensimplex2s',
] as const);
export type FastNoiseType = (typeof FAST_NOISE_TYPES)[number];

const ENGINE_TYPE: Readonly<Record<FastNoiseType, string>> = {
  perlin: FastNoiseLite.NoiseType.Perlin,
  value: FastNoiseLite.NoiseType.Value,
  'value-cubic': FastNoiseLite.NoiseType.ValueCubic,
  opensimplex2: FastNoiseLite.NoiseType.OpenSimplex2,
  opensimplex2s: FastNoiseLite.NoiseType.OpenSimplex2S,
};

export function isFastNoiseType(type: string): type is FastNoiseType {
  return (FAST_NOISE_TYPES as readonly string[]).includes(type);
}

/** One seeded octave of `type`: (u, v, z) in feature units → [-1, 1]. */
export function fastOctave(
  type: FastNoiseType,
  seed: number,
): (u: number, v: number, z: number) => number {
  const noise = new FastNoiseLite(seed | 0);
  noise.SetNoiseType(ENGINE_TYPE[type]);
  noise.SetFrequency(1);
  noise.SetFractalType(FastNoiseLite.FractalType.None);
  return (u, v, z) => Math.min(1, Math.max(-1, noise.GetNoise(u, v, z)));
}
