import { normalizeIntentText } from '../../intent/normalize-arabic';
import { readNumber, type DataGrid } from '../data-text';
import type { Unit } from './format';
import type { ColumnKind, GridProfile } from './profile';
import {
  cagr,
  growthSeries,
  linearTrend,
  mean,
  median,
  movingAverage,
  outliersIqr,
  percentChange,
  present,
  projectTrend,
  ranks,
  runningTotal,
  shares,
  stdev,
  sum,
  type Cells,
  type Outliers,
  type Trend,
} from './stats';

/**
 * One measure read through (2026-10-14): the rows in label order (a long table's rows summed per
 * label first — averaged for a percent, which does not add up), then every statistic report.page
 * prints for it. Each figure is a function of the person's cells (stats.ts); the forecast is the
 * linear trend one row past the last and is flagged as a projection wherever it is shown.
 */

export interface SeriesView {
  /** The row labels: the periods or categories, in first-seen order. */
  readonly labels: readonly string[];
  /** Each measure column's values per label. */
  readonly values: ReadonlyMap<number, Cells>;
  /** Rows dropped for having no label (long tables only). */
  readonly unlabelled: number;
}

export interface Extreme {
  readonly value: number;
  readonly label: string;
}

export interface MeasureAnalysis {
  readonly column: number;
  readonly name: string;
  readonly kind: ColumnKind;
  readonly unit: Unit;
  /** False for a percent (a share, a rate): its total is meaningless, its mean is the summary. */
  readonly additive: boolean;
  /** False for a figure the tool derived (profit, margin) rather than read. */
  readonly given: boolean;
  readonly values: Cells;
  readonly count: number;
  readonly missing: number;
  readonly sum: number;
  readonly mean: number;
  readonly median: number;
  readonly stdev: number;
  readonly min: Extreme;
  readonly max: Extreme;
  readonly first: Extreme;
  readonly last: Extreme;
  /** last − first, and that change in percent of the first (undefined from zero). */
  readonly change: { readonly absolute: number; readonly percent: number | undefined };
  readonly growth: readonly (number | undefined)[];
  /** Compound growth per period, in percent: a time axis with positive ends only. */
  readonly cagr: number | undefined;
  readonly shares: readonly (number | undefined)[] | undefined;
  readonly ranks: readonly (number | undefined)[];
  readonly running: readonly number[];
  readonly movingAverage: readonly (number | undefined)[];
  readonly trend: Trend | undefined;
  /** The trend one row past the last: a projection, never a result. Three rows at least. */
  readonly forecast: number | undefined;
  readonly outliers: Outliers | undefined;
}

/** A percent column averages; everything else adds up. */
export function isAdditive(kind: ColumnKind): boolean {
  return kind !== 'percent';
}

function fold(text: string): string {
  return normalizeIntentText(text).trim();
}

/** The rows in label order: as given, or — for a long table — one per label, summed or averaged. */
export function seriesView(grid: DataGrid, profile: GridProfile): SeriesView {
  const read = (row: readonly string[], column: number) => readNumber(row[column] ?? '')?.value;
  const label = profile.label;
  if (!profile.long || label === undefined) {
    const labels = grid.rows.map((row, index) =>
      label === undefined ? String(index + 1) : (row[label] ?? '').trim() || String(index + 1),
    );
    const values = new Map(
      profile.measures.map((column) => [column, grid.rows.map((row) => read(row, column))]),
    );
    return { labels, values, unlabelled: 0 };
  }
  const order: string[] = [];
  const shown = new Map<string, string>();
  const buckets = new Map<string, Map<number, number[]>>();
  let unlabelled = 0;
  for (const row of grid.rows) {
    const text = (row[label] ?? '').trim();
    if (text === '') {
      unlabelled += 1;
      continue;
    }
    const key = fold(text);
    if (!shown.has(key)) {
      shown.set(key, text);
      order.push(key);
      buckets.set(key, new Map());
    }
    const bucket = buckets.get(key);
    for (const column of profile.measures) {
      const value = read(row, column);
      if (value === undefined || bucket === undefined) continue;
      bucket.set(column, [...(bucket.get(column) ?? []), value]);
    }
  }
  const values = new Map(
    profile.measures.map((column) => {
      const additive = isAdditive(profile.columns[column]?.kind ?? 'number');
      return [
        column,
        order.map((key) => {
          const cells = buckets.get(key)?.get(column);
          if (cells === undefined || cells.length === 0) return undefined;
          return additive ? sum(cells) : mean(cells);
        }),
      ];
    }),
  );
  return { labels: order.map((key) => shown.get(key) ?? key), values, unlabelled };
}

function extreme(values: Cells, labels: readonly string[], pick: 'min' | 'max'): Extreme {
  let at = -1;
  for (const [index, value] of values.entries()) {
    if (value === undefined) continue;
    const best = at < 0 ? undefined : values[at];
    if (best === undefined || (pick === 'max' ? value > best : value < best)) at = index;
  }
  return { value: values[at] ?? 0, label: labels[at] ?? '' };
}

function edge(values: Cells, labels: readonly string[], end: 'first' | 'last'): Extreme {
  const indices = values.flatMap((value, index) => (value === undefined ? [] : [index]));
  const at = (end === 'first' ? indices[0] : indices.at(-1)) ?? 0;
  return { value: values[at] ?? 0, label: labels[at] ?? '' };
}

export interface MeasureInput {
  readonly column: number;
  readonly name: string;
  readonly kind: ColumnKind;
  readonly unit: Unit;
  readonly values: Cells;
  readonly given?: boolean | undefined;
}

/** Every statistic of one measure, or undefined when it holds no number. */
export function analyseMeasure(
  input: MeasureInput,
  labels: readonly string[],
  timeSeries: boolean,
  regularPeriods = true,
): MeasureAnalysis | undefined {
  const { values } = input;
  const known = present(values);
  if (known.length === 0) return undefined;
  const first = edge(values, labels, 'first');
  const last = edge(values, labels, 'last');
  const firstIndex = values.findIndex((value) => value !== undefined);
  const lastIndex =
    values.length - 1 - [...values].reverse().findIndex((value) => value !== undefined);
  const trend =
    known.length >= 2 && (!timeSeries || regularPeriods) ? linearTrend(values) : undefined;
  const additive = isAdditive(input.kind);
  return {
    column: input.column,
    name: input.name,
    kind: input.kind,
    unit: input.unit,
    additive,
    given: input.given ?? true,
    values,
    count: known.length,
    missing: values.length - known.length,
    sum: sum(known),
    mean: mean(known) ?? 0,
    median: median(known) ?? 0,
    stdev: stdev(known) ?? 0,
    min: extreme(values, labels, 'min'),
    max: extreme(values, labels, 'max'),
    first,
    last,
    change: { absolute: last.value - first.value, percent: percentChange(first.value, last.value) },
    growth: growthSeries(values),
    /* A rate compounds as points, not as growth: no CAGR for a percent column. */
    cagr:
      timeSeries && regularPeriods && input.kind !== 'percent'
        ? cagr(first.value, last.value, lastIndex - firstIndex)
        : undefined,
    shares: additive ? shares(values) : undefined,
    ranks: ranks(values),
    running: runningTotal(values),
    movingAverage: movingAverage(values, 3),
    trend,
    forecast:
      trend !== undefined && timeSeries && known.length >= 3
        ? projectTrend(trend, values.length)
        : undefined,
    outliers: outliersIqr(values),
  };
}
