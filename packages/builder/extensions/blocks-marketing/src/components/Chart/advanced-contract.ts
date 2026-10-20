import type { ChartProps } from './schema';

export const advancedChartTypes = [
  'waterfall',
  'heatmap',
  'treemap',
  'histogram',
  'bubble',
  'boxplot',
  'candlestick',
  'lollipop',
  'bullet',
] as const;

export type AdvancedChartType = (typeof advancedChartTypes)[number];

const TYPES: ReadonlySet<string> = new Set(advancedChartTypes);
const ROLES: Readonly<Partial<Record<AdvancedChartType, readonly string[]>>> = {
  bubble: ['Y', 'Size'],
  boxplot: ['Min', 'Q1', 'Median', 'Q3', 'Max'],
  candlestick: ['Open', 'High', 'Low', 'Close'],
  bullet: ['Actual', 'Target'],
  lollipop: ['Value'],
};

export function isAdvancedChart(kind: string): kind is AdvancedChartType {
  return TYPES.has(kind);
}

/** Positional meaning remains explicit even when a user renames a series. */
export function advancedRole(kind: string, index: number): string | undefined {
  return isAdvancedChart(kind) ? ROLES[kind]?.[index] : undefined;
}

export function numericCategory(value: unknown): number | undefined {
  if (
    typeof value !== 'string' ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim())
  ) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/** Invalid specialized shapes never silently turn into a different chart or invent missing values. */
export function advancedIssue(
  props: Pick<ChartProps, 'chartType' | 'categories' | 'series' | 'maxValue'>,
): string | undefined {
  const kind = props.chartType;
  if (!isAdvancedChart(kind)) return undefined;
  const count = props.categories.length;
  if (count < 1 || count > 24 || props.series.length < 1 || props.series.length > 6) {
    return 'Provide 1–24 categories and 1–6 data series.';
  }
  const roles = ROLES[kind];
  if (roles !== undefined && props.series.length !== roles.length) {
    return `Provide exactly ${String(roles.length)} series in this order: ${roles.join(', ')}.`;
  }
  const used = ['waterfall', 'treemap', 'histogram'].includes(kind)
    ? props.series.slice(0, 1)
    : props.series;
  if (
    used.some(
      (series) =>
        series.values.length !== count || series.values.some((value) => !Number.isFinite(value)),
    )
  ) {
    return 'Each plotted series needs one finite number per category; missing values are not zero.';
  }
  const values = used.map((series) => series.values);
  const first = values[0] ?? [];
  if (kind === 'bubble') {
    if (props.categories.some((category) => numericCategory(category) === undefined)) {
      return 'Bubble categories must be numeric X coordinates; provide Y then Size series.';
    }
    if (values[1]?.some((value) => value < 0)) return 'Bubble sizes must be nonnegative.';
  }
  if ((kind === 'treemap' || kind === 'histogram') && first.some((value) => value < 0)) {
    return kind === 'treemap'
      ? 'Treemap weights must be nonnegative.'
      : 'Histogram bin counts must be nonnegative.';
  }
  if (kind === 'histogram' && first.some((value) => !Number.isInteger(value))) {
    return 'Histogram values must be whole observation counts for precomputed bins.';
  }
  if (kind === 'treemap' && !first.some((value) => value > 0))
    return 'A treemap needs at least one positive weight.';
  if (kind === 'bullet' && values.some((row) => row.some((value) => value < 0))) {
    return 'Bullet Actual and Target values must be nonnegative.';
  }
  if (
    kind === 'bullet' &&
    props.maxValue !== undefined &&
    (!Number.isFinite(props.maxValue) ||
      props.maxValue <= 0 ||
      values.some((row) => row.some((value) => value > (props.maxValue ?? 0))))
  ) {
    return 'Bullet maxValue must be positive and include every Actual and Target value.';
  }
  if (
    kind === 'boxplot' &&
    first.some((_, index) =>
      values.some(
        (row, series) => series > 0 && (row[index] ?? 0) < (values[series - 1]?.[index] ?? 0),
      ),
    )
  ) {
    return 'Boxplot values must follow Min ≤ Q1 ≤ Median ≤ Q3 ≤ Max in every category.';
  }
  if (
    kind === 'candlestick' &&
    first.some((open, index) => {
      const high = values[1]?.[index] ?? 0;
      const low = values[2]?.[index] ?? 0;
      const close = values[3]?.[index] ?? 0;
      return low > Math.min(open, close) || high < Math.max(open, close);
    })
  )
    return 'Candlestick Low must be below Open/Close and High must be above them.';
  if (kind === 'waterfall') {
    let total = 0;
    for (const value of first) {
      total += value;
      if (!Number.isFinite(total))
        return 'Waterfall cumulative totals exceed the supported numeric range.';
    }
  }
  return undefined;
}
