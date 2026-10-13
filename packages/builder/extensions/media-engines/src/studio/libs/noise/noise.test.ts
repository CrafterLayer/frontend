import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRandom } from '../../kit/random';
import { createNoiseLibrary, NOISE_VERSION } from '../noise-entry';
import { createField, NOISE_LIMITS, type NoiseOptions } from './field';

/* A scene stand-in: only the seeded random the field draws its seed from. */
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

function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

describe('noise library', () => {
  it('is frozen, plain, and says what it bundles', () => {
    const lib = createNoiseLibrary();
    expect(Object.isFrozen(lib)).toBe(true);
    expect(lib.version).toBe(NOISE_VERSION);
    expect(lib.types).toEqual(['simplex', 'cellular']);
    expect(lib.fractals).toEqual(['none', 'fbm', 'ridged', 'billow']);
    expect(lib.cells).toEqual(['f1', 'f2', 'edge', 'id']);
    const manifest = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../../node_modules/simplex-noise/package.json'),
        'utf8',
      ),
    ) as { version: string; license: string };
    expect(manifest).toMatchObject({ version: '4.0.3', license: 'MIT' });
    expect(Object.isFrozen(lib.create(scene()))).toBe(true);
  });

  it.each([
    ['simplex fbm', { type: 'simplex', fractal: 'fbm' }],
    ['simplex ridged', { type: 'simplex', fractal: 'ridged' }],
    ['simplex billow', { type: 'simplex', fractal: 'billow' }],
    ['simplex warped', { type: 'simplex', warp: 120 }],
    ['cellular edge', { type: 'cellular' }],
    ['cellular f1', { type: 'cellular', cell: 'f1' }],
    ['cellular f2', { type: 'cellular', cell: 'f2' }],
    ['cellular id', { type: 'cellular', cell: 'id', scale: 90 }],
    ['cellular fbm', { type: 'cellular', fractal: 'fbm', octaves: 3 }],
  ] as const)(
    '%s stays in [-1, 1], varies, and repeats from the same scene seed',
    (_n, options) => {
      const a = samples(options);
      expect(a.every((v) => Number.isFinite(v) && v >= -1 && v <= 1)).toBe(true);
      expect(spread(a)).toBeGreaterThan(0.3);
      expect(samples(options)).toEqual(a);
      expect(samples(options, 8)).not.toEqual(a);
    },
  );

  it('takes an explicit seed over the scene, and draws only one number from the scene', () => {
    const s = scene(3);
    const field = createField(s, { seed: 42 });
    expect(field.seed).toBe(43);
    expect(createField(scene(99), { seed: 42 }).at(100, 200)).toBe(field.at(100, 200));
    const counted = { calls: 0, random: () => ((counted.calls += 1), 0.25) };
    createField(counted, {});
    expect(counted.calls).toBe(1);
  });

  it('drifts with time, loops back to its first frame, and holds still at t = 0', () => {
    for (const type of ['simplex', 'cellular'] as const) {
      const field = createField(scene(), { type, warp: 30 });
      expect(field.at(300, 200, 0)).toBe(field.at(300, 200));
      expect(field.at(300, 200, 4)).not.toBe(field.at(300, 200, 0));
      expect(field.loop(300, 200, 1)).toBeCloseTo(field.loop(300, 200, 0), 9);
      expect(field.loop(300, 200, 0.5)).not.toBeCloseTo(field.loop(300, 200, 0), 3);
    }
  });

  it('measures features in design units: a larger scale changes more slowly', () => {
    const fine = createField(scene(), { scale: 40, fractal: 'none' });
    const broad = createField(scene(), { scale: 900, fractal: 'none' });
    let fineStep = 0;
    let broadStep = 0;
    for (let x = 0; x < 1280; x += 8) {
      fineStep += Math.abs(fine.at(x + 8, 300) - fine.at(x, 300));
      broadStep += Math.abs(broad.at(x + 8, 300) - broad.at(x, 300));
    }
    expect(broadStep * 5).toBeLessThan(fineStep);
  });

  it('samples grids for contours, bounded, with their range', () => {
    const field = createField(scene(), {});
    const grid = field.grid({ width: 1280, height: 720, cell: 16, x: 10, y: 20, t: 2 });
    expect(grid.cols).toBe(81);
    expect(grid.rows).toBe(46);
    expect(grid.values).toHaveLength(81 * 46);
    expect(grid.values[0]).toBeCloseTo(field.at(10, 20, 2), 6);
    expect(grid.values[1 * 81 + 2]).toBeCloseTo(field.at(10 + 32, 20 + 16, 2), 6);
    expect(grid.min).toBe(Math.min(...grid.values));
    expect(grid.max).toBe(Math.max(...grid.values));
    const looped = field.grid({ width: 200, height: 100, cell: 20, phase: 0.25 });
    expect(looped.values[0]).toBeCloseTo(field.loop(0, 0, 0.25), 6);
    // A request finer than the budget widens the cell instead of allocating millions of samples.
    const huge = field.grid({ width: 20_000, height: 20_000, cell: 1 });
    expect(huge.cols * huge.rows).toBeLessThanOrEqual(NOISE_LIMITS.maxSamples);
    expect(huge.cell).toBeGreaterThan(1);
  });

  it('clamps nonsense from authored code instead of throwing', () => {
    const field = createField(null, {
      type: 'perlin' as never,
      fractal: 'turbulent' as never,
      octaves: 99,
      scale: -5,
      warp: Number.NaN,
      jitter: 7,
    });
    expect(field).toMatchObject({ type: 'simplex', fractal: 'fbm', octaves: 8, scale: 4, warp: 0 });
    expect(Number.isFinite(field.at(Number.NaN, Infinity, Number.NaN))).toBe(true);
    expect(field.grid(null as never).cols).toBe(81);
  });
});
