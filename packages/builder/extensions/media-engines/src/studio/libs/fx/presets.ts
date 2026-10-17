/*
  Named effect recipes for `fx.emit(name, x, y)` (creative engines, 2026-10-12). Each is a plain
  burst description; colours default to the recipe's own and can be replaced per call.
*/

export type ParticleShape =
  'dot' | 'glow' | 'square' | 'star' | 'spark' | 'drop' | 'flake' | 'heart' | 'leaf';

export const PARTICLE_SHAPES: readonly ParticleShape[] = [
  'dot',
  'glow',
  'square',
  'star',
  'spark',
  'drop',
  'flake',
  'heart',
  'leaf',
];

export interface BurstOptions {
  count?: number;
  colors?: readonly number[];
  shape?: ParticleShape;
  /** px/s range */
  speed?: readonly [number, number];
  /** seconds range */
  life?: readonly [number, number];
  /** px range of the particle's size */
  size?: readonly [number, number];
  /** px/s² downward (negative rises) */
  gravity?: number;
  /** 0..1 velocity kept per second */
  drag?: number;
  /** radians; the centre of the emission cone */
  angle?: number;
  /** radians; the cone width (2π = all around) */
  spread?: number;
  /** radians/s range of spin */
  spin?: readonly [number, number];
  /** px; random offset of each start position */
  jitter?: number;
  fade?: boolean;
  shrink?: boolean;
  /** Final size multiplier when shrink is false (grow > 1). */
  grow?: number;
  additive?: boolean;
}

const TAU = Math.PI * 2;
const UP = -Math.PI / 2;

export const FX_PRESETS: Readonly<Record<string, BurstOptions>> = Object.freeze({
  hit: {
    count: 14,
    colors: [0xffffff, 0xfde68a, 0xfb923c],
    shape: 'spark',
    speed: [160, 340],
    life: [0.18, 0.4],
    size: [3, 7],
    drag: 0.02,
    additive: true,
  },
  coin: {
    count: 12,
    colors: [0xfde047, 0xfacc15, 0xfffbeb],
    shape: 'star',
    speed: [80, 200],
    life: [0.4, 0.8],
    size: [4, 8],
    gravity: 260,
    angle: UP,
    spread: 2.2,
    spin: [-6, 6],
    additive: true,
  },
  magic: {
    count: 26,
    colors: [0xa78bfa, 0xc4b5fd, 0x67e8f9, 0xffffff],
    shape: 'glow',
    speed: [30, 120],
    life: [0.6, 1.3],
    size: [4, 10],
    gravity: -40,
    drag: 0.4,
    additive: true,
  },
  heal: {
    count: 18,
    colors: [0x86efac, 0x34d399, 0xf0fdf4],
    shape: 'heart',
    speed: [20, 70],
    life: [0.7, 1.4],
    size: [6, 11],
    gravity: -90,
    angle: UP,
    spread: 1.4,
    drag: 0.5,
  },
  smoke: {
    count: 10,
    colors: [0x94a3b8, 0x64748b, 0xcbd5e1],
    shape: 'glow',
    speed: [10, 50],
    life: [0.9, 1.8],
    size: [14, 26],
    gravity: -30,
    drag: 0.6,
    shrink: false,
    grow: 2.2,
  },
  dust: {
    count: 10,
    colors: [0xd6d3d1, 0xa8a29e],
    shape: 'dot',
    speed: [30, 110],
    life: [0.3, 0.7],
    size: [2, 5],
    gravity: 120,
    angle: UP,
    spread: 2.6,
    drag: 0.2,
  },
  explosion: {
    count: 40,
    colors: [0xfff7ed, 0xfde68a, 0xfb923c, 0xef4444, 0x7c2d12],
    shape: 'glow',
    speed: [120, 420],
    life: [0.35, 0.9],
    size: [6, 16],
    drag: 0.08,
    gravity: 60,
    additive: true,
  },
  confetti: {
    count: 48,
    colors: [0xf43f5e, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xfde047],
    shape: 'square',
    speed: [180, 420],
    life: [1.2, 2.2],
    size: [4, 8],
    gravity: 380,
    angle: UP,
    spread: 1.6,
    drag: 0.35,
    spin: [-12, 12],
    shrink: false,
  },
  sparkle: {
    count: 16,
    colors: [0xffffff, 0xfef9c3, 0xbae6fd],
    shape: 'star',
    speed: [20, 90],
    life: [0.4, 0.9],
    size: [3, 8],
    drag: 0.3,
    spin: [-4, 4],
    additive: true,
  },
  fire: {
    count: 22,
    colors: [0xfef08a, 0xfb923c, 0xef4444],
    shape: 'glow',
    speed: [30, 90],
    life: [0.4, 0.9],
    size: [8, 16],
    gravity: -160,
    angle: UP,
    spread: 0.9,
    jitter: 8,
    additive: true,
  },
  splash: {
    count: 22,
    colors: [0xbae6fd, 0x7dd3fc, 0x38bdf8, 0xffffff],
    shape: 'drop',
    speed: [120, 300],
    life: [0.4, 0.8],
    size: [3, 6],
    gravity: 700,
    angle: UP,
    spread: 1.8,
  },
  levelup: {
    count: 36,
    colors: [0xfde047, 0xffffff, 0x67e8f9],
    shape: 'star',
    speed: [90, 260],
    life: [0.7, 1.4],
    size: [4, 9],
    gravity: -60,
    spread: TAU,
    drag: 0.25,
    spin: [-8, 8],
    additive: true,
  },
});

export type WeatherKind = 'rain' | 'snow' | 'embers' | 'leaves' | 'stars' | 'fireflies' | 'bubbles';

export const WEATHER_KINDS: readonly WeatherKind[] = [
  'rain',
  'snow',
  'embers',
  'leaves',
  'stars',
  'fireflies',
  'bubbles',
];

export interface WeatherRecipe {
  readonly rate: number;
  readonly from: 'top' | 'bottom' | 'anywhere';
  readonly burst: BurstOptions;
  readonly sway?: number;
  /** Fade in and out over the lifetime instead of only out. */
  readonly twinkle?: boolean;
}

export const WEATHER: Readonly<Record<WeatherKind, WeatherRecipe>> = Object.freeze({
  rain: {
    rate: 90,
    from: 'top',
    burst: {
      shape: 'drop',
      colors: [0xbae6fd, 0x93c5fd],
      speed: [520, 720],
      angle: Math.PI / 2 + 0.12,
      spread: 0.05,
      life: [0.8, 1.4],
      size: [6, 12],
      fade: false,
      shrink: false,
    },
  },
  snow: {
    rate: 28,
    from: 'top',
    sway: 22,
    burst: {
      shape: 'flake',
      colors: [0xffffff, 0xe0f2fe],
      speed: [30, 70],
      angle: Math.PI / 2,
      spread: 0.6,
      life: [5, 9],
      size: [3, 7],
      spin: [-1, 1],
      fade: false,
      shrink: false,
    },
  },
  embers: {
    rate: 18,
    from: 'bottom',
    sway: 16,
    burst: {
      shape: 'glow',
      colors: [0xfb923c, 0xfde68a, 0xef4444],
      speed: [40, 110],
      angle: UP,
      spread: 0.7,
      life: [2, 4],
      size: [3, 6],
      additive: true,
    },
  },
  leaves: {
    rate: 6,
    from: 'top',
    sway: 40,
    burst: {
      shape: 'leaf',
      colors: [0xf59e0b, 0xea580c, 0x84cc16, 0xb45309],
      speed: [40, 80],
      angle: Math.PI / 2,
      spread: 0.8,
      life: [5, 8],
      size: [7, 12],
      spin: [-2.5, 2.5],
      fade: false,
      shrink: false,
    },
  },
  stars: {
    rate: 10,
    from: 'anywhere',
    twinkle: true,
    burst: {
      shape: 'star',
      colors: [0xffffff, 0xfef9c3, 0xe0e7ff],
      speed: [0, 4],
      life: [1.5, 3.5],
      size: [2, 5],
      additive: true,
      shrink: false,
    },
  },
  fireflies: {
    rate: 5,
    from: 'anywhere',
    sway: 26,
    twinkle: true,
    burst: {
      shape: 'glow',
      colors: [0xd9f99d, 0xfef08a],
      speed: [6, 24],
      life: [3, 6],
      size: [5, 9],
      additive: true,
      shrink: false,
    },
  },
  bubbles: {
    rate: 7,
    from: 'bottom',
    sway: 14,
    burst: {
      shape: 'glow',
      colors: [0xe0f2fe, 0xbae6fd],
      speed: [30, 70],
      angle: UP,
      spread: 0.3,
      life: [3, 6],
      size: [5, 12],
      shrink: false,
      grow: 1.3,
    },
  },
});
