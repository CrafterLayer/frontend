import type { ChartData, ChartType } from './data-chart';
import { readNumber, type DataGrid } from './data-text';

/** The stored SVG contract is deliberately small; raw observations are binned here. */
export function histogramData(grid: DataGrid): ChartData | string {
  if (grid.header.length < 1 || grid.header.length > 2)
    return 'a histogram needs one numeric observation column, optionally preceded by labels.';
  if (grid.rows.length === 0 || grid.rows.length > 5000)
    return 'a histogram needs 1 to 5000 observations; filter the data first.';
  const column = grid.header.length - 1;
  const cells = grid.rows.map((row) => readNumber(row[column] ?? ''));
  if (cells.some((cell) => cell === undefined))
    return 'a histogram needs a number for every observation; remove or resolve missing values.';
  const present = cells.filter((cell) => cell !== undefined);
  const units = new Set(present.map((cell) => `${cell.prefix.trim()}|${cell.suffix.trim()}`));
  if (units.size > 1) return 'histogram observations must use the same unit; split mixed units.';
  const values = present.map((cell) => cell.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = min === max ? 1 : Math.min(12, Math.ceil(Math.sqrt(values.length)));
  const width = (max - min) / bins;
  if (!Number.isFinite(width) || (min !== max && width === 0))
    return 'histogram range cannot be represented accurately; rescale the observations.';
  const edges = Array.from({ length: bins + 1 }, (_, index) =>
    index === bins ? max : min + index * width,
  );
  if (min !== max && edges.some((edge, index) => index > 0 && edge <= (edges[index - 1] ?? edge)))
    return 'histogram bin boundaries cannot be distinguished; rescale the observations.';
  const counts = Array.from({ length: bins }, () => 0);
  for (const value of values) {
    const next = edges.findIndex((edge) => edge > value);
    const bin = width === 0 ? 0 : next < 0 ? bins - 1 : next - 1;
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  const categories = counts.map((_, index) =>
    width === 0 ? String(min) : `${String(edges[index])}–${String(edges[index + 1])}`,
  );
  if (categories.some((label) => label.length > 40))
    return 'histogram bin labels exceed 40 characters; rescale the observations.';
  const first = present[0];
  const unit = `${first?.prefix ?? ''}${first?.suffix ?? ''}`.trim();
  return {
    categories,
    series: [{ name: 'Count', values: counts }],
    notes: [
      `Equal-width bins of ${grid.header[column] ?? 'observations'}${unit === '' ? '' : ` (${unit})`}; upper bounds excluded except the final bin; ${String(values.length)} observations`,
    ],
  };
}

/** Specialized families never silently discard a role or invent a missing observation. */
export function chartContract(data: ChartData, type: ChartType): string | undefined {
  const one = ['waterfall', 'treemap', 'histogram', 'lollipop'].includes(type);
  const expected = one
    ? 1
    : type === 'bubble' || type === 'bullet'
      ? 2
      : type === 'boxplot'
        ? 5
        : type === 'candlestick'
          ? 4
          : undefined;
  if (expected !== undefined && data.series.length !== expected)
    return `${type} needs exactly ${String(expected)} numeric series; use its documented column roles.`;
  const values = data.series.flatMap((series) => series.values);
  if (values.some((value) => !Number.isFinite(value)))
    return 'chart values must be finite numbers.';
  if (
    ['pie', 'donut', 'funnel', 'treemap', 'histogram', 'bullet'].includes(type) &&
    values.some((value) => value < 0)
  )
    return `${type} requires nonnegative values; use bars or waterfall for signed data.`;
  if (type === 'treemap' && !values.some((value) => value > 0))
    return 'a treemap needs at least one positive weight.';
  if (type === 'bubble' && data.series[1]?.values.some((value) => value < 0))
    return 'bubble Size values must be nonnegative; X and Y may be signed.';
  if (type === 'waterfall') {
    let total = 0;
    for (const value of values) {
      total += value;
      if (!Number.isFinite(total)) return 'waterfall total is too large; rescale the values.';
    }
  }
  for (const [index] of data.categories.entries()) {
    const row = data.series.map((series) => series.values[index]);
    if (row.some((value) => value === undefined))
      return 'every series needs one value per category.';
    if (type === 'boxplot') {
      if (row.some((value, at) => at > 0 && (value ?? 0) < (row[at - 1] ?? 0)))
        return 'boxplot columns must be ordered Min ≤ Q1 ≤ Median ≤ Q3 ≤ Max for every row.';
    }
    if (type === 'candlestick') {
      const [open = 0, high = 0, low = 0, close = 0] = row;
      if (low > Math.min(open, close) || high < Math.max(open, close) || low > high)
        return 'candlestick columns are Open, High, Low, Close; High/Low must enclose Open and Close.';
    }
  }
  return undefined;
}
