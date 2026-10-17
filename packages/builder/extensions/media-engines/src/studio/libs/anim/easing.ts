/*
  Easing curves for the `anim` Studio library (creative engines, 2026-10-12).

  Robert Penner's equations, re-derived as pure `(t: 0..1) => number` functions. Every curve maps
  0 to 0 and 1 to 1 exactly, so a finished tween always lands on its target value.
*/

export type EaseFn = (t: number) => number;

const PI = Math.PI;
const C1 = 1.70158;
const C2 = C1 * 1.525;
const C3 = C1 + 1;
const C4 = (2 * PI) / 3;
const C5 = (2 * PI) / 4.5;

function outBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

const linear: EaseFn = (t) => t;

export const EASINGS: Readonly<Record<string, EaseFn>> = Object.freeze({
  linear,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: (t) => t ** 4,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  inExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  inSine: (t) => 1 - Math.cos((t * PI) / 2),
  outSine: (t) => Math.sin((t * PI) / 2),
  inOutSine: (t) => -(Math.cos(PI * t) - 1) / 2,
  inCirc: (t) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t) => Math.sqrt(1 - (t - 1) ** 2),
  inOutCirc: (t) =>
    t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
  inBack: (t) => C3 * t * t * t - C1 * t * t,
  outBack: (t) => 1 + C3 * (t - 1) ** 3 + C1 * (t - 1) ** 2,
  inOutBack: (t) =>
    t < 0.5
      ? ((2 * t) ** 2 * ((C2 + 1) * 2 * t - C2)) / 2
      : ((2 * t - 2) ** 2 * ((C2 + 1) * (t * 2 - 2) + C2) + 2) / 2,
  inElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * C4),
  outElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * C4) + 1,
  inOutElastic: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * C5)) / 2
          : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * C5)) / 2 + 1,
  inBounce: (t) => 1 - outBounce(1 - t),
  outBounce,
  inOutBounce: (t) => (t < 0.5 ? (1 - outBounce(1 - 2 * t)) / 2 : (1 + outBounce(2 * t - 1)) / 2),
});

export type EaseName = keyof typeof EASINGS;

/** A named curve, a custom function, or linear for anything unknown. */
export function resolveEase(ease: unknown): EaseFn {
  if (typeof ease === 'function') return ease as EaseFn;
  if (typeof ease === 'string') {
    const found = EASINGS[ease];
    if (found !== undefined) return found;
  }
  return linear;
}

/** Linear interpolation of two numbers. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate two 0xRRGGBB colours channel by channel. */
export function mixColor(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp((from >> 16) & 255, (to >> 16) & 255, k));
  const g = Math.round(lerp((from >> 8) & 255, (to >> 8) & 255, k));
  const b = Math.round(lerp(from & 255, to & 255, k));
  return (r << 16) | (g << 8) | b;
}
