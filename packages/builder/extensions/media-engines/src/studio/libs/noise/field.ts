/*
  `s.lib.noise` fields (mural libraries, 2026-10-13): what the kit's s.noise2/s.noise3/s.fbm do
  not give a mural — Worley (cellular) cells, ridged and billowed fractals, domain warp, and a
  4-D loop that comes back to its first frame — measured in design units and seeded by the scene.

    const n = s.lib.noise.create(s, { type: 'cellular', cell: 'edge', scale: 160, warp: 40 });
    n.at(x, y, t)          // [-1, 1]; t in seconds drifts the field (times `speed`)
    n.loop(x, y, phase)    // [-1, 1]; phase 0 and 1 are the same frame (seamless loops)
    n.grid({ width: 1280, height: 720, cell: 16, t }) // a sampled grid for s.lib.geom.bands/lines

  The simplex noise is simplex-noise 4.0.3 (MIT), the same package the kit bundles; the cellular
  noise, fractals and warp are our own. Every field is a pure function of its seed: the editor,
  the preview and the published page sample the same values.
*/

import { createNoise3D, createNoise4D } from 'simplex-noise';

import { mulberry32 } from '../../kit/random';

export const NOISE_TYPES = Object.freeze(['simplex', 'cellular'] as const);
export const NOISE_FRACTALS = Object.freeze(['none', 'fbm', 'ridged', 'billow'] as const);
export const NOISE_CELLS = Object.freeze(['f1', 'f2', 'edge', 'id'] as const);
export type NoiseType = (typeof NOISE_TYPES)[number];
export type NoiseFractal = (typeof NOISE_FRACTALS)[number];
export type NoiseCell = (typeof NOISE_CELLS)[number];

export const NOISE_LIMITS = Object.freeze({
  maxOctaves: 8,
  minScale: 4,
  maxScale: 8000,
  maxWarp: 2000,
  /** Samples per grid (a 400 × 400 grid); a finer request widens the cell instead. */
  maxSamples: 160_000,
  minCell: 2,
});

export interface NoiseOptions {
  type?: NoiseType;
  fractal?: NoiseFractal;
  /** 1..8 layers, each at twice the frequency and half the amplitude; default 4 (1 for cellular). */
  octaves?: number;
  /** The size of one feature in design units; default 240. */
  scale?: number;
  /** How far, in design units, a second field pushes each sample (marbling, liquid); default 0. */
  warp?: number;
  /** Cellular output: distance to the nearest point, the second, their gap (edges), or a cell id. */
  cell?: NoiseCell;
  /** Cellular: 0 is a square grid of points, 1 (default) fully scattered. */
  jitter?: number;
  /** How fast `t` (seconds) and `phase` move the field; default 1. */
  speed?: number;
  /** A whole number; default: one draw from the scene's seeded random. */
  seed?: number;
}

export interface GridOptions {
  width?: number;
  height?: number;
  /** Design units between samples; default 16. */
  cell?: number;
  x?: number;
  y?: number;
  /** Seconds, as for `at` (ignored when `phase` is given). */
  t?: number;
  /** A loop phase, as for `loop`. */
  phase?: number;
}

/** Samples on a lattice: `values[row * cols + col]` is the field at (x + col·cell, y + row·cell). */
export interface NoiseGrid {
  readonly values: Float32Array;
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly x: number;
  readonly y: number;
  readonly min: number;
  readonly max: number;
}

export interface NoiseField {
  readonly type: NoiseType;
  readonly fractal: NoiseFractal;
  readonly cell: NoiseCell;
  readonly octaves: number;
  readonly scale: number;
  readonly warp: number;
  readonly seed: number;
  at(x: number, y: number, t?: number): number;
  loop(x: number, y: number, phase: number): number;
  grid(options?: GridOptions): NoiseGrid;
}

interface SceneLike {
  random?(): number;
}

const TAU = Math.PI * 2;
/** Radius of the circle `loop` walks through the 3rd and 4th dimensions (per unit speed). */
const LOOP_RADIUS = 0.3;
/** Noise units per second at speed 1: slow enough to read as drift, not boil. */
const DRIFT = 0.08;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function seedOf(scene: SceneLike, options: NoiseOptions): number {
  if (typeof options.seed === 'number' && Number.isFinite(options.seed)) {
    return (Math.abs(Math.round(options.seed)) % 2_147_483_646) + 1;
  }
  const drawn = typeof scene.random === 'function' ? scene.random() : Number.NaN;
  return Number.isFinite(drawn) ? Math.floor(Math.abs(drawn) * 2_147_483_646) + 1 : 1;
}

/** A 32-bit hash of a lattice cell and the seed, as [0, 1). */
function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Worley {
  f1: number;
  f2: number;
  id: number;
}

/**
 * Worley noise at (u, v) in cell units: one point per lattice cell, scattered by `jitter` and
 * circling a little with `turn` (radians), so a cellular field animates and loops.
 */
function worley(u: number, v: number, seed: number, jitter: number, turn: number): Worley {
  const cx = Math.floor(u);
  const cy = Math.floor(v);
  let f1 = Infinity;
  let f2 = Infinity;
  let id = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const ix = cx + dx;
      const iy = cy + dy;
      const a = hash(ix, iy, seed);
      const b = hash(iy, ix, seed ^ 0x5bd1e995);
      const spin = a * TAU + turn;
      const px = ix + 0.5 + (a - 0.5) * 0.7 * jitter + Math.cos(spin) * 0.15 * jitter;
      const py = iy + 0.5 + (b - 0.5) * 0.7 * jitter + Math.sin(spin) * 0.15 * jitter;
      const d = Math.hypot(px - u, py - v);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash(ix, iy, seed ^ 0x1b873593);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, id };
}

function cellValue(sample: Worley, output: NoiseCell): number {
  if (output === 'f1') return clamp(sample.f1 * 2 - 1, -1, 1);
  if (output === 'f2') return clamp(sample.f2 * 1.6 - 1, -1, 1);
  if (output === 'id') return sample.id * 2 - 1;
  return clamp((sample.f2 - sample.f1) * 2.5 - 1, -1, 1);
}

/** A seeded field (see the file comment); `create` in the library entry validates the options. */
export function createField(scene: unknown, input?: unknown): NoiseField {
  // Authored code is plain JavaScript: anything that is not an object reads as no options.
  const options = (input !== null && typeof input === 'object' ? input : {}) as NoiseOptions;
  const target = (scene !== null && typeof scene === 'object' ? scene : {}) as SceneLike;
  const type = oneOf(options.type, NOISE_TYPES, 'simplex');
  const fractal = oneOf(options.fractal, NOISE_FRACTALS, type === 'cellular' ? 'none' : 'fbm');
  const output = oneOf(options.cell, NOISE_CELLS, 'edge');
  const octaves =
    fractal === 'none'
      ? 1
      : clamp(Math.round(finite(options.octaves, 4)), 1, NOISE_LIMITS.maxOctaves);
  const scale = clamp(finite(options.scale, 240), NOISE_LIMITS.minScale, NOISE_LIMITS.maxScale);
  const warp = clamp(finite(options.warp, 0), 0, NOISE_LIMITS.maxWarp);
  const jitter = clamp(finite(options.jitter, 1), 0, 1);
  const speed = clamp(finite(options.speed, 1), 0, 20);
  const seed = seedOf(target, options);
  const random = mulberry32(seed);
  const base3 = createNoise3D(random);
  const base4 = createNoise4D(random);
  const warp3x = createNoise3D(random);
  const warp3y = createNoise3D(random);
  const warp4x = createNoise4D(random);
  const warp4y = createNoise4D(random);

  /* One octave at (u, v) in feature units; (z, w) is time: w undefined means a plain drift. */
  function octave(u: number, v: number, z: number, w: number | undefined, layer: number): number {
    if (type === 'cellular') {
      // A drift turns each point once per 1/DRIFT seconds; a loop once per phase.
      const turn = w === undefined ? z * TAU : Math.atan2(w, z);
      return cellValue(worley(u, v, (seed + layer * 0x9e3779b1) | 0, jitter, turn), output);
    }
    return w === undefined ? base3(u, v, z + layer * 17.31) : base4(u, v, z + layer * 17.31, w);
  }

  function layered(u: number, v: number, z: number, w: number | undefined): number {
    let total = 0;
    let norm = 0;
    let amplitude = 1;
    let frequency = 1;
    for (let layer = 0; layer < octaves; layer += 1) {
      const n = octave(u * frequency, v * frequency, z, w, layer);
      const shaped =
        fractal === 'ridged'
          ? (1 - Math.abs(n)) ** 2 * 2 - 1
          : fractal === 'billow'
            ? Math.abs(n) * 2 - 1
            : n;
      total += shaped * amplitude;
      norm += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return clamp(total / norm, -1, 1);
  }

  function sample(x: number, y: number, z: number, w: number | undefined): number {
    let u = x / scale;
    let v = y / scale;
    if (warp > 0) {
      const k = warp / scale;
      const a = u * 0.5;
      const b = v * 0.5;
      const wx = w === undefined ? warp3x(a, b, z) : warp4x(a, b, z, w);
      const wy = w === undefined ? warp3y(a, b, z) : warp4y(a, b, z, w);
      u += wx * k;
      v += wy * k;
    }
    return layered(u, v, z, w);
  }

  function at(x: number, y: number, t?: number): number {
    return sample(finite(x, 0), finite(y, 0), finite(t, 0) * speed * DRIFT, undefined);
  }

  function loop(x: number, y: number, phase: number): number {
    const angle = finite(phase, 0) * TAU;
    const radius = LOOP_RADIUS * Math.max(0.05, speed);
    return sample(finite(x, 0), finite(y, 0), Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  function grid(gridOptions?: unknown): NoiseGrid {
    const g = (
      gridOptions !== null && typeof gridOptions === 'object' ? gridOptions : {}
    ) as GridOptions;
    const width = clamp(finite(g.width, 1280), 1, 20_000);
    const height = clamp(finite(g.height, 720), 1, 20_000);
    let cell = Math.max(NOISE_LIMITS.minCell, finite(g.cell, 16));
    // A finer grid than the sample budget allows widens the cell instead of failing.
    while (
      (Math.floor(width / cell) + 1) * (Math.floor(height / cell) + 1) >
      NOISE_LIMITS.maxSamples
    )
      cell *= 1.25;
    const cols = Math.floor(width / cell) + 1;
    const rows = Math.floor(height / cell) + 1;
    const x = finite(g.x, 0);
    const y = finite(g.y, 0);
    const values = new Float32Array(cols * rows);
    const looping = typeof g.phase === 'number' && Number.isFinite(g.phase);
    let min = Infinity;
    let max = -Infinity;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const px = x + col * cell;
        const py = y + row * cell;
        const index = row * cols + col;
        values[index] = looping ? loop(px, py, g.phase ?? 0) : at(px, py, g.t);
        // The range of what is stored (float32), so it matches the values exactly.
        const value = values[index] ?? 0;
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
    return Object.freeze({ values, cols, rows, cell, x, y, min, max });
  }

  return Object.freeze({
    type,
    fractal,
    cell: output,
    octaves,
    scale,
    warp,
    seed,
    at,
    loop,
    grid,
  });
}
