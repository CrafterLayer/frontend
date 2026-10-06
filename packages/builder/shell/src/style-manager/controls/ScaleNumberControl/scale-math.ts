import type { StyleValue } from '@craftkit/builder-schema';

/** A number with its unit (`''` for unitless: z-index, opacity steps, columns). */
export interface Amount {
  readonly amount: number;
  readonly unit: string;
}

/**
 * How one property's scale maps to numbers. `amountOf` turns a token into the
 * number a person reads (`4` → 16px for spacing); `tokenFor` turns a number
 * back into a token when one exists exactly ("snapping to the scale").
 */
export interface ScaleModel {
  readonly scale: readonly string[];
  readonly amountOf: (token: string) => Amount | undefined;
  readonly tokenFor: (amount: Amount) => string | undefined;
}

const NUMBER_WITH_UNIT = /^(-?\d*\.?\d+)\s*([a-z%]*)$/iu;

/** `17px` → { 17, 'px' }; `1.5` (no unit) takes `fallbackUnit`. */
export function parseAmount(text: string, fallbackUnit: string): Amount | undefined {
  const match = NUMBER_WITH_UNIT.exec(text.trim());
  if (match === null) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = (match[2] ?? '').toLowerCase();
  return { amount, unit: unit === '' ? fallbackUnit : unit };
}

/** Rounds away float noise from repeated ±0.1 steps. */
export function tidy(amount: number): number {
  return Math.round(amount * 1000) / 1000;
}

export function formatAmount({ amount, unit }: Amount): string {
  return `${String(tidy(amount))}${unit}`;
}

/** The value to write for a number: the exact token when one exists, else an arbitrary value. */
export function valueForAmount(model: ScaleModel, amount: Amount): StyleValue {
  const token = model.tokenFor(amount);
  return token === undefined ? { kind: 'raw', css: formatAmount(amount) } : { kind: 'token', token };
}

/** The number a value shows, when it has one. */
export function amountOfValue(model: ScaleModel, value: StyleValue | undefined): Amount | undefined {
  if (value === undefined) return undefined;
  if (value.kind === 'token') return model.amountOf(value.token);
  if (value.kind === 'raw') return parseAmount(value.css, '');
  return undefined;
}

/** Scale steps that have a number, in ascending order, in the given unit. */
function numericSteps(model: ScaleModel, unit: string): { token: string; amount: number }[] {
  const steps: { token: string; amount: number }[] = [];
  for (const token of model.scale) {
    const amount = model.amountOf(token);
    if (amount?.unit === unit) steps.push({ token, amount: amount.amount });
  }
  return steps.sort((a, b) => a.amount - b.amount);
}

/**
 * The next scale step above (direction 1) or below (-1) the current value.
 * Numeric scales move by amount; a scale of names (`sm`, `lg`) moves by
 * position. Undefined at either end.
 */
export function stepScale(
  model: ScaleModel,
  value: StyleValue | undefined,
  direction: 1 | -1,
): StyleValue | undefined {
  const current = amountOfValue(model, value);
  if (current !== undefined) {
    const steps = numericSteps(model, current.unit);
    const next =
      direction === 1
        ? steps.find((step) => step.amount > current.amount)
        : [...steps].reverse().find((step) => step.amount < current.amount);
    return next === undefined ? undefined : { kind: 'token', token: next.token };
  }
  const position = value?.kind === 'token' ? model.scale.indexOf(value.token) : -1;
  const index = position === -1 ? (direction === 1 ? 0 : model.scale.length - 1) : position + direction;
  const token = model.scale[index];
  return token === undefined ? undefined : { kind: 'token', token };
}

/** The scale token nearest a number (tokens mode refuses anything off the scale). */
export function nearestToken(model: ScaleModel, amount: Amount): string | undefined {
  let best: { token: string; distance: number } | undefined;
  for (const step of numericSteps(model, amount.unit)) {
    const distance = Math.abs(step.amount - amount.amount);
    if (best === undefined || distance < best.distance) best = { token: step.token, distance };
  }
  return best?.token;
}

/** The text a value shows in the input. */
export function displayText(model: ScaleModel, value: StyleValue | undefined): string {
  if (value === undefined) return '';
  const amount = amountOfValue(model, value);
  if (amount !== undefined) return String(tidy(amount.amount));
  switch (value.kind) {
    case 'token':
      return value.token;
    case 'keyword':
      return value.keyword;
    case 'raw':
      return value.css;
    case 'palette':
      return value.id;
  }
}
