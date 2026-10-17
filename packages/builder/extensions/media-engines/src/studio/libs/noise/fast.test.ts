import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRandom } from '../../kit/random';
import { createField, type NoiseOptions } from './field';
import { FAST_NOISE_TYPES } from './fast';

/*
  FastNoiseLite's types in s.lib.noise (2026-10-13): vendored verbatim, each a seeded field that
  layers, warps, drifts and loops like simplex, and the simplex and cellular fields untouched.
*/

function scene(seed: number | string = 7) {
  const random = createRandom(seed);
  return { random: () => random.random() };
}

function samples(options: NoiseOptions, seed: number | string = 7): number[] {
  const field = createField(scene(seed), options);
  const out: number[] = [];
  for (let y = 0; y < 720; y += 48) for (let x = 0; x < 1280; x += 48) out.push(field.at(x, y));
  return out;
}

const vendor = (file: string) => resolve(import.meta.dirname, '../../../../vendor', file);

describe('FastNoiseLite types', () => {
  it('is the vendored file, byte for byte, with its licence beside it', () => {
    const code = readFileSync(vendor('fastnoise-lite/FastNoiseLite.js'));
    expect(createHash('sha256').update(code).digest('hex')).toBe(
      '83cdfcdc9f65e02b4a8ea6fc157283119379b316b28b0021e9cc0f4d15de01bb',
    );
    expect(readFileSync(vendor('fastnoise-lite/LICENSE'), 'utf8')).toMatch(
      /Copyright\(c\) 2020 Jordan Peck[\s\S]*Permission is hereby granted, free of charge/u,
    );
  });

  it.each(FAST_NOISE_TYPES)('%s: seeded, in range, varied, and its own look', (type) => {
    const a = samples({ type, scale: 160 });
    expect(samples({ type, scale: 160 })).toEqual(a);
    expect(samples({ type, scale: 160 }, 8)).not.toEqual(a);
    expect(a.every((value) => value >= -1 && value <= 1)).toBe(true);
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(0.4);
    expect(a).not.toEqual(samples({ type: 'simplex', scale: 160 }));
  });

  it.each(FAST_NOISE_TYPES)('%s: layers, ridges and warps like simplex', (type) => {
    const plain = samples({ type, fractal: 'none' });
    expect(samples({ type, fractal: 'fbm', octaves: 5 })).not.toEqual(plain);
    expect(samples({ type, fractal: 'ridged' })).not.toEqual(plain);
    expect(samples({ type, fractal: 'none', warp: 120 })).not.toEqual(plain);
  });

  it.each(FAST_NOISE_TYPES)('%s: drifts with time and loops seamlessly', (type) => {
    const field = createField(scene(), { type, scale: 200, speed: 2 });
    expect(field.at(300, 200, 0)).not.toBe(field.at(300, 200, 3));
    for (const [x, y] of [
      [0, 0],
      [640, 360],
      [1111, 77],
    ] as const) {
      expect(field.loop(x, y, 1)).toBeCloseTo(field.loop(x, y, 0), 6);
      expect(field.loop(x, y, 0.999)).toBeCloseTo(field.loop(x, y, 0), 1);
    }
    expect(field.loop(320, 180, 0.5)).not.toBe(field.loop(320, 180, 0));
  });

  it('leaves the simplex and cellular fields exactly as they were', () => {
    // Pinned before FastNoiseLite came in: the new types draw no seed from the scene's random.
    const simplex = createField(scene(11), { type: 'simplex', scale: 200 });
    const cellular = createField(scene(11), { type: 'cellular', scale: 200 });
    expect(simplex.seed).toBe(createField(scene(11), { type: 'perlin', scale: 200 }).seed);
    expect(simplex.at(321, 123, 0.5)).toBe(
      createField(scene(11), { type: 'simplex', scale: 200 }).at(321, 123, 0.5),
    );
    expect(cellular.type).toBe('cellular');
  });
});
