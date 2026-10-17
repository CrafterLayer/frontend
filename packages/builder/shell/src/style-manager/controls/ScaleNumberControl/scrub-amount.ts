import type { StyleMode, StyleValue } from '@craftkit/builder-schema';

import { amountOfValue, stepScale, tidy, valueForAmount, type ScaleModel } from './scale-math';

/** Pointer travel per increment of an exact amount. */
const PX_PER_INCREMENT = 2;
/** Pointer travel per scale step when the value walks the scale (names, tokens mode). */
const PX_PER_STEP = 12;

/** How much one increment adds, by unit: whole pixels, tenths of a rem, 10ms… */
const INCREMENT: Readonly<Record<string, number>> = {
  px: 1,
  '%': 1,
  deg: 1,
  vw: 1,
  vh: 1,
  dvh: 1,
  cqi: 1,
  ch: 0.5,
  rem: 0.05,
  em: 0.05,
  s: 0.05,
  ms: 10,
  turn: 0.01,
};

/** A unitless scale with fractions (line height 1.375) moves by 0.05; whole numbers by 1. */
function unitlessIncrement(model: ScaleModel, amount: number): number {
  const fractional =
    !Number.isInteger(amount) ||
    model.scale.some((token) => {
      const step = model.amountOf(token);
      return step?.unit === '' && !Number.isInteger(step.amount);
    });
  return fractional ? 0.05 : 1;
}

export interface ScrubBounds {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

/**
 * The value a number field's scrub lands on (style-manager panel design).
 *
 * Travel is rightwards plus upwards (`dx - dy`): rightwards and upwards grow,
 * whatever the page direction, as in every design tool. An exact amount moves
 * one increment per 2px of travel (1px, 0.05rem, 10ms…) and lands on a token
 * when one matches exactly; a named value (`lg`), an unset field or a
 * registered block (tokens mode) walks the scale one step per 12px instead.
 * Undefined when the travel has not moved the value.
 */
export function scrubAmount(
  model: ScaleModel,
  value: StyleValue | undefined,
  mode: StyleMode,
  travel: number,
  bounds: ScrubBounds = {},
): StyleValue | undefined {
  const current = amountOfValue(model, value);
  if (mode === 'tokens' || current === undefined) {
    const steps = Math.trunc(travel / PX_PER_STEP);
    if (steps === 0) return undefined;
    let next = value;
    for (let index = 0; index < Math.abs(steps); index += 1) {
      const stepped = stepScale(model, next, steps > 0 ? 1 : -1);
      if (stepped === undefined) break;
      next = stepped;
    }
    return next === value ? undefined : next;
  }
  const increments = Math.trunc(travel / PX_PER_INCREMENT);
  if (increments === 0) return undefined;
  const size = INCREMENT[current.unit] ?? unitlessIncrement(model, current.amount);
  const raw = current.amount + increments * size;
  const amount = tidy(
    Math.min(bounds.max ?? Number.POSITIVE_INFINITY, Math.max(bounds.min ?? Number.NEGATIVE_INFINITY, raw)),
  );
  if (amount === current.amount) return undefined;
  return valueForAmount(model, { amount, unit: current.unit });
}
