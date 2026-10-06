import type { StyleBoxSide, StyleValue } from '@craftkit/builder-schema';

import { growthOf } from '../../box-sides';
import type { ScrubDelta } from '../../use-scrub';
import { amountOfValue, nearestTokenFor, type ScaleModel } from './scale-bridge';

/**
 * The value a scrub lands on. Pixels move 1 per 2px of travel and snap to the
 * nearest scale step when one is within reach; other units move a quarter per
 * 8px. Never below `min` (0 for padding; margins may go negative).
 */
export function scrubValue(
  model: ScaleModel,
  value: StyleValue | undefined,
  side: StyleBoxSide,
  delta: ScrubDelta,
  dir: 'ltr' | 'rtl',
  min: number,
): StyleValue {
  const current = amountOfValue(model, value) ?? { amount: 0, unit: 'px' };
  const growth = growthOf(side, delta, dir);
  if (current.unit !== 'px') {
    const next = Math.max(min, Math.round((current.amount + growth / 32) * 4) / 4);
    return { kind: 'raw', css: `${String(next)}${current.unit}` };
  }
  const next = Math.max(min, Math.round(current.amount + growth / 2));
  const token = nearestTokenFor(model, next);
  return token === undefined ? { kind: 'raw', css: `${String(next)}px` } : { kind: 'token', token };
}
