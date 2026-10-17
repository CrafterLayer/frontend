import type { Amount, ScaleModel } from './scale-math';

/**
 * Tailwind 4's numeric scales.
 *
 * Spacing steps multiply `--spacing` (0.25rem = 4px at the default root size),
 * so step `4` reads as 16px and 16px snaps back to `4`. Named steps
 * (`gutter`, `section-md`, `auto`) have no number and are walked by position.
 */
export function spacingModel(scale: readonly string[]): ScaleModel {
  const set = new Set(scale);
  return {
    scale,
    amountOf: (token) => {
      if (token === 'px') return { amount: 1, unit: 'px' };
      const steps = Number(token);
      return token !== '' && Number.isFinite(steps) ? { amount: steps * 4, unit: 'px' } : undefined;
    },
    tokenFor: ({ amount, unit }: Amount) => {
      if (unit !== 'px') return undefined;
      if (amount === 1 && set.has('px')) return 'px';
      const token = String(amount / 4);
      return set.has(token) ? token : undefined;
    },
  };
}

/**
 * A plain number scale whose token IS the number in `unit`: z-index, opacity
 * (percent), durations (`duration-300` = 300ms), rotations. With
 * `anyInteger`, every non-negative integer is a token (`opacity-37`), as
 * Tailwind 4 generates them; otherwise only the scale's own entries are.
 */
export function numberModel(scale: readonly string[], unit: string, anyInteger = false): ScaleModel {
  const set = new Set(scale);
  return {
    scale,
    amountOf: (token) => {
      const amount = Number(token);
      return token !== '' && Number.isFinite(amount) ? { amount, unit } : undefined;
    },
    tokenFor: ({ amount, unit: given }: Amount) => {
      if (given !== unit) return undefined;
      const token = String(amount);
      if (set.has(token)) return token;
      return anyInteger && Number.isInteger(amount) && amount >= 0 ? token : undefined;
    },
  };
}

/** A scale of names only (`sm`, `lg`, `xl`): no numbers, walked by position. */
export function namedModel(scale: readonly string[]): ScaleModel {
  return { scale, amountOf: () => undefined, tokenFor: () => undefined };
}
