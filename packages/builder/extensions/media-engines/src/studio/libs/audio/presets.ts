/*
  Procedural sound effects for `s.lib.audio` (game libraries, 2026-10-12): named ZzFX parameter
  lists, so a game has jump/coin/hit sounds with NO audio files. ZzFX (MIT, Frank Force) renders
  them at play time; see device.ts.

  Parameter order (ZzFX 1.3): volume, randomness, frequency, attack, sustain, release, shape,
  shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
  bitCrush, delay, sustainVolume, decay, tremolo, filter. Empty slots take ZzFX's defaults.
*/

type Slot = number | undefined;

/* Sparse literals keep ZzFX's own defaults for the slots a preset leaves empty. */
export const SFX_PRESETS: Readonly<Record<string, readonly Slot[]>> = Object.freeze({
  jump: [0.8, , 300, 0.01, 0.03, 0.12, 1, 1.4, 9],
  coin: [0.8, , 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06],
  hit: [0.9, , 528, 0.01, , 0.48, , 0.6, -11.6, , , , 0.32, 4.2],
  explode: [1, , 333, 0.01, 0, 0.9, 4, 1.9, , , , , , 0.5, , 0.6],
  powerup: [0.8, , 20, 0.04, , 0.6, , 1.31, , , -990, 0.06, 0.17, , , 0.04, 0.07],
  click: [0.6, 0, 1800, , 0.005, 0.02, , 3],
  laser: [0.7, , 539, 0, 0.04, 0.29, 1, 1.92, , , 567, 0.02, 0.02, , , , 0.04],
  blip: [0.7, , 880, , 0.02, 0.06, 1, 1.5],
  step: [0.4, 0.3, 70, , 0.01, 0.05, 4, 2],
  win: [0.9, , 523, 0.02, 0.35, 0.4, 1, 1.2, , , 262, 0.15],
  lose: [0.9, , 392, 0.02, 0.3, 0.5, 2, 1, -3, , -98, 0.18],
});

export const SFX_PRESET_NAMES: readonly string[] = Object.freeze(Object.keys(SFX_PRESETS));

/** A preset's own parameters; inherited keys ('toString', '__proto__') are not presets. */
export function presetOf(name: string): readonly Slot[] | undefined {
  return Object.hasOwn(SFX_PRESETS, name) ? SFX_PRESETS[name] : undefined;
}

/** ZzFX takes 21 parameters; the time slots are clamped so one effect lasts seconds, not minutes. */
const PARAM_COUNT = 21;
const TIME_SLOTS: Readonly<Record<number, number>> = { 3: 1, 4: 1, 5: 1, 16: 1, 18: 1 };
const RANGES: Readonly<Record<number, readonly [number, number]>> = {
  0: [0, 2],
  1: [0, 1],
  2: [0, 20_000],
};

/**
 * A preset name or a ZzFX list as a bounded, finite parameter list (holes stay undefined so ZzFX
 * applies its defaults), or undefined when the input is neither.
 */
export function sfxParams(input: unknown): Slot[] | undefined {
  const source: readonly unknown[] | undefined =
    typeof input === 'string'
      ? presetOf(input)
      : Array.isArray(input)
        ? (input as readonly unknown[])
        : undefined;
  if (source === undefined || source.length > PARAM_COUNT) return undefined;
  const params: Slot[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    if (value === undefined || value === null) {
      params.push(undefined);
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    const time = TIME_SLOTS[index];
    const range = time === undefined ? RANGES[index] : ([0, time] as const);
    params.push(range === undefined ? value : Math.min(range[1], Math.max(range[0], value)));
  }
  return params;
}
