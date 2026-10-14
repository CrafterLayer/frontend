/**
 * The arithmetic of a report (2026-10-14): every figure report.page prints is one of these pure
 * functions over the numbers the person gave — never a model's sum. Missing cells are
 * `undefined` and are skipped (a mean of the cells present, a trend through the points present);
 * nothing here invents a value for them. Percentages are returned as percent numbers (12.5 for
 * 12.5%), so the page formats them without a second multiplication.
 */

export type Cells = readonly (number | undefined)[];

export function present(values: Cells): number[] {
  return values.filter((value): value is number => value !== undefined);
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function mean(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : sum(values) / values.length;
}

/** The value at quantile `q` (0..1) of the values, interpolated between ranks (Excel's QUARTILE.INC). */
export function quantile(values: readonly number[], q: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  const lower = sorted[low] ?? 0;
  return lower + ((sorted[high] ?? lower) - lower) * (at - low);
}

export function median(values: readonly number[]): number | undefined {
  return quantile(values, 0.5);
}

/** The sample standard deviation (n − 1); 0 for a single value. */
export function stdev(values: readonly number[]): number | undefined {
  const average = mean(values);
  if (average === undefined) return undefined;
  if (values.length === 1) return 0;
  let squares = 0;
  for (const value of values) squares += (value - average) ** 2;
  return Math.sqrt(squares / (values.length - 1));
}

/** The percent change from `from` to `to`, undefined from zero. */
export function percentChange(from: number, to: number): number | undefined {
  return from === 0 ? undefined : ((to - from) / Math.abs(from)) * 100;
}

/** Each row's change against the row before, in percent (undefined first, or across a gap or a zero). */
export function growthSeries(values: Cells): (number | undefined)[] {
  return values.map((value, index) => {
    const before = index === 0 ? undefined : values[index - 1];
    return value === undefined || before === undefined ? undefined : percentChange(before, value);
  });
}

/** The compound growth per period from the first value to the last, over `periods` steps, in percent. */
export function cagr(first: number, last: number, periods: number): number | undefined {
  if (periods < 1 || first <= 0 || last <= 0) return undefined;
  return ((last / first) ** (1 / periods) - 1) * 100;
}

/** Each value's share of the total, in percent — only when every value is ≥ 0 and the total > 0. */
export function shares(values: Cells): (number | undefined)[] | undefined {
  const known = present(values);
  const total = sum(known);
  if (total <= 0 || known.some((value) => value < 0)) return undefined;
  return values.map((value) => (value === undefined ? undefined : (value / total) * 100));
}

/** Each value's rank, the largest first; ties share a rank (1, 2, 2, 4). */
export function ranks(values: Cells): (number | undefined)[] {
  const known = present(values);
  return values.map((value) =>
    value === undefined ? undefined : 1 + known.filter((other) => other > value).length,
  );
}

/** The total so far, row by row (a gap carries the total before it). */
export function runningTotal(values: Cells): number[] {
  let total = 0;
  return values.map((value) => {
    total += value ?? 0;
    return total;
  });
}

/** The mean of each row and the `window − 1` before it; undefined until the window is full. */
export function movingAverage(values: Cells, window = 3): (number | undefined)[] {
  return values.map((_, index) => {
    if (index < window - 1) return undefined;
    const slice = values.slice(index - window + 1, index + 1);
    if (slice.some((value) => value === undefined)) return undefined;
    return mean(present(slice));
  });
}

export interface Trend {
  /** The change per row (per period on a time axis). */
  readonly slope: number;
  /** The fitted value at the first row. */
  readonly intercept: number;
  /** How much of the variation the line explains, 0..1 (1 for a flat series). */
  readonly r2: number;
}

/** The least-squares line through (row index, value), over the rows present; two points at least. */
export function linearTrend(values: Cells): Trend | undefined {
  const points = values.flatMap((value, index) => (value === undefined ? [] : [[index, value]]));
  if (points.length < 2) return undefined;
  const xs = points.map(([x]) => x ?? 0);
  const ys = points.map(([, y]) => y ?? 0);
  const mx = sum(xs) / xs.length;
  const my = sum(ys) / ys.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [index, x] of xs.entries()) {
    const y = ys[index] ?? 0;
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

/** The line's value at row `index` (a projection past the last row, never a result). */
export function projectTrend(trend: Trend, index: number): number {
  return trend.intercept + trend.slope * index;
}

/** Pearson's r over the rows where both are present: three rows at least, neither constant. */
export function pearson(xs: Cells, ys: Cells): number | undefined {
  const pairs = xs.flatMap((x, index) => {
    const y = ys[index];
    return x === undefined || y === undefined ? [] : [[x, y] as const];
  });
  if (pairs.length < 3) return undefined;
  const mx = sum(pairs.map(([x]) => x)) / pairs.length;
  const my = sum(pairs.map(([, y]) => y)) / pairs.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return undefined;
  return sxy / Math.sqrt(sxx * syy);
}

export interface Outliers {
  readonly low: number;
  readonly high: number;
  /** The rows outside [low, high]: Q1 − 1.5·IQR and Q3 + 1.5·IQR. */
  readonly rows: readonly number[];
}

/** The IQR fences and the rows outside them; four values at least. */
export function outliersIqr(values: Cells): Outliers | undefined {
  const known = present(values);
  if (known.length < 4) return undefined;
  const q1 = quantile(known, 0.25) ?? 0;
  const q3 = quantile(known, 0.75) ?? 0;
  const spread = q3 - q1;
  const low = q1 - 1.5 * spread;
  const high = q3 + 1.5 * spread;
  const rows = values.flatMap((value, index) =>
    value !== undefined && (value < low || value > high) ? [index] : [],
  );
  return { low, high, rows };
}
