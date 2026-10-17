/*
  The fx library's particle kit (split from effects.ts, 2026-10-12): limits, the public
  option and handle types, particle shapes and textures, and the weather table createFx reads.
*/

import type {
  PixiApp,
  PixiContainer,
  PixiDisplay,
  PixiGraphics,
  PixiTexture,
} from '../shared/pixi-types';
import {
  WEATHER,
  type BurstOptions,
  type ParticleShape,
  type WeatherKind,
  type WeatherRecipe,
} from './presets';

export const FX_LIMITS = Object.freeze({
  particles: 1500,
  emitters: 32,
  effects: 64,
  perBurst: 200,
});

export type Sprite = PixiDisplay & { texture: PixiTexture; width: number; height: number };

export interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size0: number;
  size1: number;
  spin: number;
  gravity: number;
  drag: number;
  fade: boolean;
  twinkle: boolean;
  sway: number;
  phase: number;
  alpha: number;
}

export interface Runner {
  step(dt: number): boolean;
  stop(): void;
}

export interface FxHandle {
  readonly active: boolean;
  stop(): void;
}

export interface FxOptions {
  /** The container effects draw into; defaults to a new top layer on app.stage. */
  layer?: PixiContainer;
  /** Live particle cap (default 600, at most 1500). */
  max?: number;
  reducedMotion?: boolean;
  /** A seeded random source, e.g. s.random. */
  rng?: () => number;
}

export interface WeatherOptions {
  /** Multiplies the recipe's particles per second (0..4). */
  density?: number;
  /** px/s sideways drift. */
  wind?: number;
  colors?: readonly number[];
  /** The area to fill; defaults to the live screen. */
  area?: () => { x: number; y: number; width: number; height: number };
}

export interface TrailOptions {
  colors?: readonly number[];
  shape?: ParticleShape;
  /** particles per second */
  rate?: number;
  size?: readonly [number, number];
  life?: readonly [number, number];
  additive?: boolean;
}

export interface FloatTextOptions {
  color?: number;
  size?: number;
  rise?: number;
  life?: number;
  fontFamily?: string;
  stroke?: number;
}

export interface Fx {
  readonly count: number;
  readonly layer: PixiContainer;
  readonly presets: readonly string[];
  update(dtSeconds: number): void;
  burst(x: number, y: number, options?: BurstOptions): number;
  emit(name: string, x: number, y: number, overrides?: BurstOptions): number;
  weather(kind: WeatherKind, options?: WeatherOptions): FxHandle;
  trail(target: { x: number; y: number }, options?: TrailOptions): FxHandle;
  ring(
    x: number,
    y: number,
    options?: { color?: number; radius?: number; width?: number; life?: number },
  ): FxHandle;
  flash(options?: { color?: number; alpha?: number; life?: number }): FxHandle;
  shake(
    target?: { x: number; y: number },
    options?: { intensity?: number; life?: number },
  ): FxHandle;
  floatText(x: number, y: number, text: string, options?: FloatTextOptions): FxHandle;
  pulse(
    target: PixiDisplay,
    options?: { scale?: number; speed?: number; alpha?: number },
  ): FxHandle;
  clear(): void;
  dispose(): void;
}

export const NOOP_HANDLE: FxHandle = Object.freeze({ active: false, stop: () => undefined });
export const TEXTURE_SIZE = 32;

export function drawShape(g: PixiGraphics, shape: ParticleShape): void {
  const c = TEXTURE_SIZE / 2;
  switch (shape) {
    case 'glow':
      for (let ring = 8; ring >= 1; ring -= 1) {
        g.circle(c, c, (c * ring) / 8).fill({ color: 0xffffff, alpha: 0.13 + (8 - ring) * 0.01 });
      }
      break;
    case 'square':
      g.rect(4, 4, TEXTURE_SIZE - 8, TEXTURE_SIZE - 8).fill(0xffffff);
      break;
    case 'star':
      g.star(c, c, 5, c - 1, c * 0.42).fill(0xffffff);
      break;
    case 'spark':
      g.poly([c, 0, c + 4, c, c, TEXTURE_SIZE, c - 4, c]).fill(0xffffff);
      break;
    case 'drop':
      g.roundRect(c - 1.5, 0, 3, TEXTURE_SIZE, 1.5).fill(0xffffff);
      break;
    case 'flake':
      g.star(c, c, 6, c - 2, c * 0.3).fill(0xffffff);
      g.circle(c, c, c * 0.32).fill(0xffffff);
      break;
    case 'heart': {
      const points: number[] = [];
      for (let i = 0; i < 32; i += 1) {
        const t = (i / 32) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        points.push(c + x * 0.9, c + y * 0.9);
      }
      g.poly(points).fill(0xffffff);
      break;
    }
    case 'leaf':
      g.ellipse(c, c, c * 0.45, c - 1).fill(0xffffff);
      break;
    default:
      g.circle(c, c, c - 1).fill(0xffffff);
  }
}

export function range(
  pair: readonly [number, number] | undefined,
  fallback: readonly [number, number],
  rng: () => number,
): number {
  const [a, b] = pair ?? fallback;
  return a + (b - a) * rng();
}

/** Weather recipes by any key authored code may pass; an unknown name reads as undefined. */
export const WEATHER_BY_NAME: Readonly<Partial<Record<string, WeatherRecipe>>> = WEATHER;

/** Authored scene code is plain JavaScript: only something with a stage and a renderer is an app. */
export function isApp(value: unknown): value is PixiApp {
  const app = value as Partial<Record<keyof PixiApp, unknown>> | null | undefined;
  return app?.stage !== undefined && app.renderer !== undefined;
}
