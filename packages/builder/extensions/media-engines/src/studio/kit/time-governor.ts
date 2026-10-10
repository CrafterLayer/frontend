/*
  Time and the quality governor for the scene kit (pixi-studio §B.2: s.time, s.quality,
  s.onQuality, s.count).

  - Clock: t in seconds since the scene started, dt clamped to 0.1 s (a tab switch never makes a
    simulation jump), frame counter.
  - Governor ('auto'): when the frame rate stays below 45 fps for 2 s of running time, quality
    steps 1 -> 0.75 -> 0.5 (never back up in a session: oscillation looks worse than either
    level). The first second after a start or resume is ignored (shader compiles, texture
    uploads), as is any frame longer than 0.5 s (the tab was hidden). 'low' pins 0.5, 'high'
    pins 1.
*/

export interface SceneTime {
  t: number;
  dt: number;
  frame: number;
}

export const QUALITY_LEVELS = [1, 0.75, 0.5] as const;

export type QualityMode = 'auto' | 'low' | 'high';

export interface Clock {
  time: SceneTime;
  /** Advance by a raw delta (seconds). */
  advance(rawDt: number): SceneTime;
}

export function createClock(): Clock {
  const time: SceneTime = { t: 0, dt: 0, frame: 0 };
  return {
    time,
    advance(rawDt: number): SceneTime {
      const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(0.1, rawDt) : 0;
      time.dt = dt;
      time.t += dt;
      time.frame += 1;
      return time;
    },
  };
}

export interface Governor {
  readonly quality: number;
  readonly mode: QualityMode;
  /** Feed one frame's raw delta (seconds). Returns true when the quality changed. */
  sample(rawDt: number): boolean;
  /** Forget the slow streak and start a new warm-up (after a pause or resume). */
  reset(): void;
}

export interface GovernorOptions {
  mode?: QualityMode;
  minFps?: number;
  /** Seconds below minFps before a step down. */
  window?: number;
  /** Seconds ignored after start/reset. */
  warmup?: number;
}

export function createGovernor(options: GovernorOptions = {}): Governor {
  const mode: QualityMode =
    options.mode === 'low' || options.mode === 'high' ? options.mode : 'auto';
  const minFps = options.minFps ?? 45;
  const window = options.window ?? 2;
  const warmup = options.warmup ?? 1;
  let level = mode === 'low' ? 2 : 0;
  let slow = 0;
  let warm = 0;
  return {
    get quality(): number {
      return QUALITY_LEVELS[level] ?? 1;
    },
    mode,
    sample(rawDt: number): boolean {
      if (mode !== 'auto' || level >= QUALITY_LEVELS.length - 1) return false;
      if (!Number.isFinite(rawDt) || rawDt <= 0 || rawDt > 0.5) return false;
      if (warm < warmup) {
        warm += rawDt;
        return false;
      }
      if (1 / rawDt < minFps) {
        slow += rawDt;
      } else {
        // A fast frame halves the streak instead of clearing it, so jitter around the line still counts.
        slow = Math.max(0, slow - rawDt * 2);
      }
      if (slow >= window) {
        level += 1;
        slow = 0;
        warm = 0;
        return true;
      }
      return false;
    },
    reset(): void {
      slow = 0;
      warm = 0;
    },
  };
}

/** n x density x quality, rounded, at least 1 (s.count). */
export function scaledCount(n: number, density: number, quality: number): number {
  const base = Number.isFinite(n) ? n : 1;
  const d = Number.isFinite(density) && density > 0 ? density : 1;
  const q = Number.isFinite(quality) && quality > 0 ? quality : 1;
  return Math.max(1, Math.round(base * d * q));
}
