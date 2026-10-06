import { amountOfValue, type ScaleModel } from '../ScaleNumberControl';

export { amountOfValue, type ScaleModel };

/** The exact step for a pixel amount, or the step within 2px of it (scrub snapping). */
export function nearestTokenFor(model: ScaleModel, px: number): string | undefined {
  const exact = model.tokenFor({ amount: px, unit: 'px' });
  if (exact !== undefined) return exact;
  for (const token of model.scale) {
    const amount = model.amountOf(token);
    if (amount?.unit === 'px' && Math.abs(amount.amount - px) <= 2) return token;
  }
  return undefined;
}
