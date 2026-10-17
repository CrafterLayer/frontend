/*
  The tuned particle recipes behind `s.lib.emitter.presets` (particles and physics, 2026-10-13).
  A recipe is a compact description in px, degrees and seconds; presets.ts turns it into an
  upstream EmitterConfigV3 for one scene (its palette, direction, view and particle budget).
  Omitted fields take the defaults presets.ts documents (w/h 400, alpha 1, dir 0, spread 180).

  Colours are theme-aware: a recipe reads the scene palette and whether its surface is dark, so
  snow stays visible on a white page and glows on a night one (`glow`: additive blending, only on
  a dark surface — on a light one it would wash out to white).
*/

import type { ParticleShape } from './atlas';

/** The palette slice recipes read (s.palette). */
export interface RecipePalette {
  readonly colors: readonly number[];
  readonly accent: number;
  readonly text: number;
  readonly muted: number;
  readonly dark: boolean;
  mix(a: number, b: number, t: number): number;
}

export interface BurstRecipe {
  /** Particles in one burst. */
  n: number;
  /** Start speed range, px/s. */
  v: readonly [number, number];
  /** Gravity, px/s² (negative rises). */
  g?: number;
  drag?: number;
  /** Default: the recipe's life. */
  life?: readonly [number, number];
  /** Centre and half-width of the cone, degrees (default all around). */
  dir?: number;
  spread?: number;
}

export interface Recipe {
  shape: readonly ParticleShape[];
  /**
   * point: from x,y across `w` (fire); area: anywhere in the area; fall: enters above the area
   * and falls through it; rise: enters below and rises. A fall/rise without `life` crosses the
   * whole area (life from the travel, recycled past the far edge).
   */
  place: 'point' | 'area' | 'fall' | 'rise';
  /** Default width/height when anchored at x,y (400). */
  w?: number;
  h?: number;
  life?: readonly [number, number];
  /** Particles per second: per default width (point), per 1000 px (fall/rise), per view (area). */
  rate: number;
  /** Diameter range, px. */
  size: readonly [number, number];
  /** Size multipliers over the particle's life. */
  grow?: readonly number[];
  /** Alpha over the particle's life (default [1]: constant). */
  alpha?: readonly number[];
  colors(palette: RecipePalette): number[];
  /** The colours are a gradient over life (fire) rather than one picked per particle. */
  gradient?: boolean;
  /** One colour per wave (a fireworks burst). */
  wave?: boolean;
  /** Direction of travel (0 = right, 90 = down) and its half-spread, degrees. */
  dir?: number;
  spread?: number;
  v: readonly [number, number];
  g?: number;
  /** Lean toward the inline end, -1..1 (mirrors with s.dir). */
  wind?: number;
  /** Turn each particle along its velocity (rain, sparks). */
  align?: boolean;
  spin?: number;
  sway?: number;
  freq?: number;
  flip?: number;
  glow?: boolean;
  burst: BurstRecipe;
  /** A show: one burst every [a, b] seconds somewhere in the area (fireworks). */
  show?: readonly [number, number];
}

const FIRE = [0xfff3c4, 0xffc247, 0xff7a1a, 0xd9361a];
const EMBER = [0xfff1a8, 0xffb347, 0xff5a1f, 0x8f1d0a];
const EMBER_LIGHT = [0xff9a1f, 0xff5a1f, 0xc2260f, 0x7a1d0a];
const FESTIVE = [0xf43f5e, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];
const AUTUMN = [0xd97706, 0xb45309, 0xdc2626, 0x65a30d, 0xca8a04];

/** Palette colour i (0 accent, 1 lighter, 4 darker), the accent where an override is short. */
function tone(p: RecipePalette, index: number): number {
  return p.colors[index] ?? p.accent;
}

export const RECIPES = {
  fire: {
    shape: ['soft'],
    place: 'point',
    w: 60,
    h: 10,
    life: [0.5, 1.1],
    rate: 90,
    size: [30, 56],
    grow: [0.75, 1, 0.45],
    alpha: [0, 0.85, 0.55, 0],
    colors: () => FIRE,
    gradient: true,
    dir: 270,
    spread: 10,
    v: [80, 160],
    g: -120,
    sway: 6,
    freq: 9,
    glow: true,
    burst: { n: 36, v: [90, 260], g: -120, drag: 2, life: [0.35, 0.8] },
  },
  smoke: {
    shape: ['soft'],
    place: 'point',
    w: 50,
    h: 10,
    life: [2.2, 3.6],
    rate: 12,
    size: [44, 76],
    grow: [0.45, 1.7],
    alpha: [0, 0.32, 0],
    colors: (p) => [p.mix(p.muted, p.text, p.dark ? 0.35 : 0.15), p.muted],
    dir: 270,
    spread: 8,
    v: [28, 55],
    g: -6,
    wind: 0.35,
    sway: 12,
    freq: 1.4,
    burst: { n: 18, v: [30, 90], drag: 1.5, life: [1.2, 2.4] },
  },
  sparkles: {
    shape: ['spark'],
    place: 'area',
    w: 260,
    h: 140,
    life: [0.6, 1.4],
    rate: 70,
    size: [14, 34],
    grow: [0, 1, 0],
    colors: (p) => (p.dark ? [0xffffff, tone(p, 1), 0xfde68a] : [p.accent, tone(p, 4), 0xf59e0b]),
    v: [0, 10],
    spin: 90,
    glow: true,
    burst: { n: 26, v: [60, 220], drag: 2.5, life: [0.5, 1] },
  },
  snow: {
    shape: ['soft', 'flake'],
    place: 'fall',
    rate: 30,
    size: [5, 15],
    alpha: [0.9],
    colors: (p) => (p.dark ? [0xffffff, 0xe0f2fe] : [p.mix(p.muted, 0x60a5fa, 0.35), 0x93c5fd]),
    dir: 90,
    spread: 8,
    v: [35, 80],
    wind: 0.12,
    sway: 16,
    freq: 1.3,
    spin: 50,
    burst: { n: 30, v: [40, 150], g: 60, drag: 1.8, life: [1.6, 3] },
  },
  rain: {
    shape: ['streak'],
    place: 'fall',
    rate: 160,
    size: [26, 42],
    alpha: [0.5],
    colors: (p) => [p.dark ? p.mix(p.text, 0x93c5fd, 0.5) : p.mix(p.muted, 0x2563eb, 0.45)],
    dir: 90,
    spread: 1.5,
    v: [760, 980],
    wind: 0.22,
    align: true,
    burst: { n: 16, v: [90, 240], g: 1100, life: [0.25, 0.55], dir: 270, spread: 65 },
  },
  confetti: {
    shape: ['rect'],
    place: 'fall',
    rate: 28,
    size: [12, 19],
    colors: (p) => [p.accent, tone(p, 1), tone(p, 4), ...FESTIVE],
    dir: 90,
    spread: 18,
    v: [60, 130],
    wind: 0.1,
    sway: 22,
    freq: 2.2,
    flip: 7,
    spin: 200,
    burst: { n: 90, v: [650, 1250], g: 520, drag: 3.2, life: [2.4, 3.6], dir: 270, spread: 32 },
  },
  magic: {
    shape: ['soft', 'spark'],
    place: 'area',
    w: 260,
    h: 160,
    life: [1.2, 2.6],
    rate: 90,
    size: [6, 20],
    grow: [0.3, 1, 0],
    alpha: [0, 1, 0],
    colors: (p) =>
      p.dark ? [tone(p, 1), p.accent, 0xffffff, 0xc4b5fd] : [p.accent, tone(p, 4), 0xa855f7],
    dir: 270,
    spread: 35,
    v: [10, 40],
    sway: 10,
    freq: 2,
    spin: 120,
    glow: true,
    burst: { n: 44, v: [50, 200], drag: 2, life: [0.8, 1.8] },
  },
  bubbles: {
    shape: ['ring'],
    place: 'rise',
    w: 300,
    rate: 7,
    size: [12, 34],
    alpha: [0.8],
    colors: (p) =>
      p.dark
        ? [p.mix(tone(p, 1), 0xbae6fd, 0.5), 0xe0f2fe]
        : [p.mix(p.accent, 0x0284c7, 0.5), 0x38bdf8],
    dir: 270,
    spread: 5,
    v: [32, 80],
    sway: 12,
    freq: 1.8,
    burst: { n: 18, v: [40, 140], g: -80, drag: 1.4, life: [1.6, 3] },
  },
  leaves: {
    shape: ['leaf'],
    place: 'fall',
    rate: 5,
    size: [24, 38],
    colors: (p) => [...AUTUMN, p.mix(0xd97706, p.accent, 0.2)],
    dir: 90,
    spread: 22,
    v: [50, 95],
    wind: 0.3,
    sway: 38,
    freq: 1.1,
    flip: 3,
    spin: 140,
    burst: { n: 16, v: [140, 340], g: 160, drag: 1.6, life: [2.4, 4] },
  },
  petals: {
    shape: ['petal'],
    place: 'fall',
    rate: 8,
    size: [11, 19],
    colors: (p) => [
      ...(p.dark ? [0xfbcfe8, 0xfce7f3] : [0xf472b6, 0xf9a8d4]),
      0xfbcfe8,
      p.mix(0xf472b6, p.accent, 0.25),
    ],
    dir: 90,
    spread: 20,
    v: [35, 70],
    wind: 0.35,
    sway: 30,
    freq: 1.4,
    flip: 4,
    spin: 150,
    burst: { n: 22, v: [120, 300], g: 120, drag: 1.8, life: [2.4, 4] },
  },
  fireworks: {
    shape: ['streak'],
    place: 'area',
    h: 300,
    life: [1, 1.7],
    rate: 0,
    size: [28, 52],
    grow: [1, 0.4],
    alpha: [1, 1, 0],
    colors: (p) =>
      p.dark
        ? [p.accent, tone(p, 1), 0xfacc15, 0xf43f5e, 0x22d3ee, 0xa3e635]
        : [p.accent, tone(p, 4), 0xe11d48, 0xd97706, 0x0891b2, 0x65a30d],
    wave: true,
    v: [140, 360],
    g: 140,
    align: true,
    glow: true,
    show: [0.45, 1.2],
    burst: { n: 90, v: [160, 420], g: 140, drag: 1.1 },
  },
  dust: {
    shape: ['soft'],
    place: 'area',
    h: 300,
    life: [3, 6],
    rate: 30,
    size: [4, 10],
    alpha: [0, 0.7, 0],
    colors: (p) =>
      p.dark
        ? [p.mix(0xfde68a, p.text, 0.5), p.text]
        : [p.mix(p.muted, p.text, 0.3), p.mix(p.muted, 0x92400e, 0.35)],
    v: [3, 14],
    sway: 8,
    freq: 0.8,
    glow: true,
    burst: { n: 26, v: [40, 130], g: 40, drag: 2.2, life: [0.9, 1.8], dir: 270, spread: 75 },
  },
  embers: {
    shape: ['soft'],
    place: 'rise',
    w: 300,
    life: [2.2, 4.5],
    rate: 34,
    size: [5, 12],
    grow: [1, 0.25],
    alpha: [1, 1, 0],
    colors: (p) => (p.dark ? EMBER : EMBER_LIGHT),
    gradient: true,
    dir: 270,
    spread: 14,
    v: [45, 120],
    wind: 0.2,
    sway: 18,
    freq: 2.4,
    glow: true,
    burst: { n: 30, v: [100, 320], g: 260, drag: 1, life: [0.6, 1.4] },
  },
} satisfies Record<string, Recipe>;

export type ParticlePreset = keyof typeof RECIPES;
export const PARTICLE_PRESETS = Object.keys(RECIPES) as readonly ParticlePreset[];
