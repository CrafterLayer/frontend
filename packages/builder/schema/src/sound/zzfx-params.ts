/*
  ZzFX parameter arrays as DATA (pixi-studio DESIGN §C.1, §C.2).

  A ZzFX sound is up to 21 numbers (ZzFX 1.4.0 by Frank Force, MIT; the
  synth itself is vendored in media-engines). This module only names, reads
  and bounds those numbers so a bank entry, a `data-ck-sound` token, a saved
  project sound or an agent's `sound.compose` call is checked by the same rule:
  at most 21 numbers, volume at most 1, total length at most 4 seconds.

  Pure and dependency-free on purpose: the `ck-sound.js` engine bundles it.
*/

/** The 21 ZzFX parameters, in order (ZzFX 1.4.0 `buildSamples`). */
export const ZZFX_PARAM_NAMES = [
  'volume',
  'randomness',
  'frequency',
  'attack',
  'sustain',
  'release',
  'shape',
  'shapeCurve',
  'slide',
  'deltaSlide',
  'pitchJump',
  'pitchJumpTime',
  'repeatTime',
  'noise',
  'modulation',
  'bitCrush',
  'delay',
  'sustainVolume',
  'decay',
  'tremolo',
  'filter',
] as const;

export type ZzfxParamName = (typeof ZZFX_PARAM_NAMES)[number];

/** ZzFX's own defaults, used where an array is shorter or has an empty slot. */
export const ZZFX_DEFAULTS: readonly number[] = [
  1, 0.05, 220, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
];

export const ZZFX_MAX_PARAMS = 21;
export const ZZFX_MAX_VOLUME = 1;
export const ZZFX_MAX_DURATION_SECONDS = 4;

/** A ZzFX array as written: numbers, with `undefined`/`null` meaning "the default". */
export type ZzfxParams = readonly (number | null | undefined)[];

/** The value at `index`, or ZzFX's default when the slot is empty. */
export function zzfxParam(params: ZzfxParams, index: number): number {
  const value = params[index];
  return typeof value === 'number' ? value : (ZZFX_DEFAULTS[index] ?? 0);
}

/** The sound's length in seconds: attack + decay + sustain + release + delay. */
export function zzfxDurationSeconds(params: ZzfxParams): number {
  // attack 3, sustain 4, release 5, delay 16, decay 18
  return (
    zzfxParam(params, 3) +
    zzfxParam(params, 4) +
    zzfxParam(params, 5) +
    zzfxParam(params, 16) +
    zzfxParam(params, 18)
  );
}

/**
 * What is wrong with a ZzFX array, or undefined when it may play. The
 * sentence is a repair instruction (the door and the agent read it).
 */
export function validateZzfxParams(params: unknown): string | undefined {
  if (!Array.isArray(params)) return 'a zzfx sound is an array of numbers';
  if (params.length === 0) return 'a zzfx sound needs at least one number (the volume)';
  if (params.length > ZZFX_MAX_PARAMS) {
    return `a zzfx sound has at most ${String(ZZFX_MAX_PARAMS)} numbers, not ${String(params.length)}`;
  }
  for (let index = 0; index < params.length; index += 1) {
    const value: unknown = params[index];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `zzfx number ${String(index + 1)} (${ZZFX_PARAM_NAMES[index] ?? 'extra'}) is not a finite number`;
    }
  }
  const list = params as ZzfxParams;
  const volume = zzfxParam(list, 0);
  if (volume < 0 || volume > ZZFX_MAX_VOLUME) {
    return `zzfx volume is between 0 and ${String(ZZFX_MAX_VOLUME)}, not ${String(volume)}`;
  }
  for (const index of [3, 4, 5, 16, 18]) {
    if (zzfxParam(list, index) < 0) {
      return `zzfx ${ZZFX_PARAM_NAMES[index] ?? ''} cannot be negative`;
    }
  }
  const seconds = zzfxDurationSeconds(list);
  if (seconds > ZZFX_MAX_DURATION_SECONDS) {
    return `a zzfx sound lasts at most ${String(ZZFX_MAX_DURATION_SECONDS)} s (attack+decay+sustain+release+delay), this one ${seconds.toFixed(2)} s`;
  }
  const frequency = zzfxParam(list, 2);
  if (frequency < 0 || frequency > 20_000) {
    return `zzfx frequency is between 0 and 20000 Hz, not ${String(frequency)}`;
  }
  return undefined;
}

const ZZFX_NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/iu;

/**
 * Read `zzfx(1,.05,537,,.02)` (empty slots allowed, no spaces) into its
 * numbers; a string is the reason it cannot be read.
 */
export function parseZzfxCall(text: string): (number | undefined)[] | string {
  const match = /^zzfx\((.*)\)$/u.exec(text);
  if (match === null) return 'a zzfx ref is written zzfx(n,n,…) with no spaces';
  const body = match[1] ?? '';
  const items = body === '' ? [] : body.split(',');
  if (items.length > ZZFX_MAX_PARAMS) {
    return `a zzfx sound has at most ${String(ZZFX_MAX_PARAMS)} numbers, not ${String(items.length)}`;
  }
  const values: (number | undefined)[] = [];
  for (const item of items) {
    if (item === '') {
      values.push(undefined);
      continue;
    }
    if (!ZZFX_NUMBER.test(item)) return `zzfx(…) holds numbers only, not '${item}'`;
    values.push(Number(item));
  }
  const problem = validateZzfxParams(values);
  return problem ?? values;
}
