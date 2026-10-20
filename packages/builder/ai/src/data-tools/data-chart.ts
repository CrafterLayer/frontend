import { normalizeIntentText } from '../intent/normalize-arabic';
import { columnUnit, isNumericColumn, isTimeline, readNumber, type DataGrid } from './data-text';
import { chartContract, histogramData } from './chart-specialized';

/**
 * The chart reading of a grid (2026-10-12), shared by `data.show` and `report.build`: which
 * columns are series, which chart type fits the numbers when none is asked for, and the props a
 * chart (or a report's chart) needs for that type. Pure functions, no kernel.
 */

export const CHART_TYPES = [
  'bar',
  'hbar',
  'line',
  'area',
  'combo',
  'scatter',
  'radar',
  'funnel',
  'gauge',
  'sparkline',
  'pie',
  'donut',
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
export type ChartType = (typeof CHART_TYPES)[number];

export const LIMITS = {
  categories: 24,
  series: 6,
  label: 40,
  columns: 8,
  rows: 50,
  cell: 160,
  heading: 60,
  radarMin: 3,
  radarMax: 12,
  gauges: 6,
} as const;
/** How many rows a donut of shares may hold before it reads as a bar chart. */
const DONUT_MAX = 5;
/** A category label this long reads better beside a horizontal bar than under a column. */
const LONG_LABEL = 16;

export interface ChartData {
  readonly categories: readonly string[];
  readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
  readonly prefix?: string | undefined;
  readonly suffix?: string | undefined;
  /** A gauge's top of scale and goal, from a constant "Max" / "Target" column. */
  readonly maxValue?: number | undefined;
  readonly targetValue?: number | undefined;
  readonly notes: readonly string[];
}

/** One affix all values share, or undefined when they differ (or carry none). */
function shared(values: readonly string[]): string | undefined {
  const [first] = values;
  return first !== undefined && first.trim() !== '' && values.every((value) => value === first)
    ? first
    : undefined;
}

const MAX_HEADING =
  /^(?:max(?:imum)?|out of|capacity|limit|cap|full|الحد الاقصي|الاقصي|السعه|الحد)$/u;
const TARGET_HEADING = /^(?:target|goal|objective|quota|الهدف|المستهدف|هدف)$/u;
const FUNNEL_WORDS =
  /\b(?:funnel|pipeline|conversion|stages?|journey)\b|قمع|مراحل|مرحله|تحويل|رحله/u;

interface Dial {
  readonly max?: { readonly column: number; readonly value: number } | undefined;
  readonly target?: { readonly column: number; readonly value: number } | undefined;
}

/** A column the same number in every row, under a heading that names a maximum or a target. */
function dialColumns(grid: DataGrid): Dial {
  const find = (heading: RegExp) => {
    const column = grid.header.findIndex(
      (label, index) => index > 0 && heading.test(normalizeIntentText(label).trim()),
    );
    if (column < 0 || !isNumericColumn(grid, column)) return undefined;
    const values = new Set(grid.rows.map((row) => readNumber(row[column] ?? '')?.value));
    const [value] = [...values];
    return values.size === 1 && value !== undefined ? { column, value } : undefined;
  };
  return { max: find(MAX_HEADING), target: find(TARGET_HEADING) };
}

/**
 * The chart reading of a grid: the first column labels the categories and every numeric column
 * is a series — or, when the headings are the times ("Metric,2022,2023"), each row is a series.
 * `skip` leaves columns out (a gauge's Max and Target).
 */
function readSeries(
  grid: DataGrid,
  skip: ReadonlySet<number>,
  sizeAxis = false,
): ChartData | string {
  const numeric = grid.header.map(
    (_, column) => column > 0 && !skip.has(column) && isNumericColumn(grid, column),
  );
  const byRow =
    isTimeline(grid.header.slice(1)) && !isTimeline(grid.rows.map((row) => row[0] ?? ''));
  const notes: string[] = [];
  let categories: string[];
  let series: { name: string; cells: string[] }[];
  if (byRow) {
    if (
      !grid.rows.every((row) =>
        row.slice(1).every((cell) => cell.trim() === '' || readNumber(cell) !== undefined),
      )
    ) {
      return 'the rows hold text as well as numbers; send as "table".';
    }
    categories = grid.header.slice(1);
    series = grid.rows.map((row) => ({ name: row[0] ?? '', cells: row.slice(1) }));
  } else {
    const columns = numeric.flatMap((isNumber, column) => (isNumber ? [column] : []));
    if (columns.length === 0) return 'no column after the first holds numbers; send as "table".';
    const skipped = grid.header.filter(
      (_, column) => column > 0 && !skip.has(column) && !numeric[column],
    );
    if (skipped.length > 0) notes.push(`text columns left out of the chart: ${skipped.join(', ')}`);
    categories = grid.rows.map((row) => row[0] ?? '');
    series = columns.map((column) => ({
      name: grid.header[column] ?? '',
      cells: grid.rows.map((row) => row[column] ?? ''),
    }));
  }
  if (categories.length > LIMITS.categories)
    return `a chart plots at most ${String(LIMITS.categories)} categories (got ${String(categories.length)}); send as "table" or group the rows.`;
  if (series.length > LIMITS.series)
    return `a chart plots at most ${String(LIMITS.series)} series (got ${String(series.length)}); keep the ones that matter.`;
  const label = categories.findIndex((category) => category.trim() === '');
  if (label >= 0) return `category ${String(label + 1)} has no label; give every row a first cell.`;
  const unnamed = series.findIndex((entry) => entry.name.trim() === '');
  if (unnamed >= 0) return `series ${String(unnamed + 1)} has no name; give its column a heading.`;
  const long = [...categories, ...series.map((entry) => entry.name)].find(
    (name) => name.length > LIMITS.label,
  );
  if (long !== undefined)
    return `"${long.slice(0, 50)}…" is over ${String(LIMITS.label)} characters; shorten the label.`;
  const read = series.flatMap((entry) => entry.cells.map((cell) => readNumber(cell)));
  if (read.some((number) => number === undefined))
    return 'missing chart values cannot be plotted as zero; resolve missing cells or use a table.';
  const present = read.filter((number) => number !== undefined);
  const unitRead = sizeAxis
    ? (series[0]?.cells ?? []).flatMap((cell) => {
        const value = readNumber(cell);
        return value === undefined ? [] : [value];
      })
    : present;
  const units = new Set(
    unitRead.map((number) => `${number.prefix.trim()}|${number.suffix.trim()}`),
  );
  if (units.size > 1)
    return 'chart values use different units; split the measures into separate charts.';
  if (
    sizeAxis &&
    series.some(
      (entry) =>
        new Set(
          entry.cells.map((cell) => {
            const value = readNumber(cell);
            return `${value?.prefix.trim() ?? ''}|${value?.suffix.trim() ?? ''}`;
          }),
        ).size > 1,
    )
  )
    return 'each bubble axis must use a consistent unit.';
  return {
    categories,
    series: series.map((entry) => ({
      name: entry.name,
      values: entry.cells.map((cell) => readNumber(cell)?.value ?? 0),
    })),
    prefix: shared(unitRead.map((number) => number.prefix)),
    suffix: shared(unitRead.map((number) => number.suffix)),
    notes,
  };
}

/** Whether the first column holds numbers that are not times: a scatter's x values. */
function numericFirstColumn(grid: DataGrid): boolean {
  return (
    isNumericColumn(grid, 0) &&
    grid.rows.every((row) => (row[0] ?? '').trim() !== '') &&
    !isTimeline(grid.rows.map((row) => row[0] ?? ''))
  );
}

function decreasing(values: readonly number[]): boolean {
  return values.every(
    (value, index) => value >= 0 && (index === 0 || value <= (values[index - 1] ?? 0)),
  );
}

/**
 * The chart that answers the data's question when none is asked for: a gauge for one value
 * against a Max column, a line over time, a scatter for numbers against numbers, a funnel for
 * narrowing stages when the words say funnel, a donut for shares of 100%, horizontal bars for
 * long labels, bars otherwise. `words` are the title, caption and first heading.
 */
export function autoChart(grid: DataGrid, data: ChartData, words: string): ChartType {
  const count = data.categories.length;
  if (dialColumns(grid).max !== undefined && !isTimeline(data.categories)) {
    const dialed = chartDataFor(grid, 'gauge');
    if (
      typeof dialed !== 'string' &&
      dialed.series.length === 1 &&
      dialed.categories.length <= LIMITS.gauges
    )
      return 'gauge';
  }
  if (isTimeline(data.categories)) return 'line';
  if (numericFirstColumn(grid) && grid.rows.length >= 3) return 'scatter';
  const [only] = data.series;
  if (
    data.series.length === 1 &&
    only !== undefined &&
    count >= 3 &&
    decreasing(only.values) &&
    FUNNEL_WORDS.test(normalizeIntentText(words))
  ) {
    return 'funnel';
  }
  if (
    data.series.length === 1 &&
    only !== undefined &&
    count <= DONUT_MAX &&
    data.suffix?.trim() === '%'
  ) {
    const total = only.values.reduce((sum, value) => sum + value, 0);
    if (only.values.every((value) => value >= 0) && Math.abs(total - 100) <= 2) return 'donut';
  }
  if (data.categories.some((category) => category.length >= LONG_LABEL)) return 'hbar';
  return 'bar';
}

/** The plain reading of a grid as series, for choosing a type. */
export function chartData(grid: DataGrid): ChartData | string {
  return readSeries(grid, new Set());
}

/**
 * The reading for one chart type: a gauge takes its Max and Target columns out of the series,
 * a scatter needs a numeric first column (written back as plain numbers, its x values), a
 * radar three to twelve categories.
 */
export function chartDataFor(grid: DataGrid, type: ChartType): ChartData | string {
  if (type === 'histogram') return histogramData(grid);
  if (type === 'bubble') {
    if (grid.header.length !== 3)
      return 'bubble needs exactly three columns in role order: X, Y, Size.';
    for (const column of [0, 2]) {
      if (
        grid.rows.some((row) => {
          const value = readNumber(row[column] ?? '');
          return value !== undefined && (value.prefix.trim() !== '' || value.suffix.trim() !== '');
        })
      )
        return 'bubble X and Size must be unitless numbers; convert them explicitly before charting. Y may carry a unit.';
    }
  }
  if (type === 'gauge') {
    const dial = dialColumns(grid);
    const skip = new Set([dial.max?.column ?? -1, dial.target?.column ?? -1]);
    /* One value with no label column ("Score,Max\n82,100"): the heading labels it. */
    if (grid.rows.length === 1 && isNumericColumn(grid, 0)) {
      const value = readNumber(grid.rows[0]?.[0] ?? '');
      if (value !== undefined) {
        return {
          categories: [grid.header[0] ?? ''],
          series: [{ name: grid.header[0] ?? '', values: [value.value] }],
          prefix: value.prefix.trim() === '' ? undefined : value.prefix,
          suffix: value.suffix.trim() === '' ? undefined : value.suffix,
          maxValue: dial.max?.value,
          targetValue: dial.target?.value,
          notes: [],
        };
      }
    }
    const data = readSeries(grid, skip);
    if (typeof data === 'string') return data;
    const notes = [...data.notes];
    if (data.categories.length > LIMITS.gauges)
      notes.push(`a gauge draws the first ${String(LIMITS.gauges)} rows`);
    return { ...data, maxValue: dial.max?.value, targetValue: dial.target?.value, notes };
  }
  const data = readSeries(grid, new Set(), type === 'bubble');
  if (typeof data === 'string') return data;
  const invalid = chartContract(data, type);
  if (invalid !== undefined) return invalid;
  if (type === 'scatter' || type === 'bubble') {
    if (!numericFirstColumn(grid))
      return `${type} needs numbers in the first column (the x values); use line or bar for categories.`;
    return {
      ...data,
      categories: data.categories.map((cell) => String(readNumber(cell)?.value ?? cell)),
    };
  }
  if (type === 'radar') {
    const count = data.categories.length;
    if (count < LIMITS.radarMin || count > LIMITS.radarMax)
      return `a radar needs ${String(LIMITS.radarMin)} to ${String(LIMITS.radarMax)} categories (got ${String(count)}); send as "bar".`;
  }
  return data;
}

/** Whether the data reads as a chart: numbers after the first column, and nothing but numbers. */
export function plottable(grid: DataGrid): boolean {
  const numeric = grid.header.map((_, column) => column > 0 && isNumericColumn(grid, column));
  const textColumns = grid.header.filter((_, column) => column > 0 && !numeric[column]);
  // One value axis: minutes beside dollars, or a column of mixed units, is a table.
  const units = new Set(
    numeric.flatMap((isNumber, column) =>
      isNumber ? [columnUnit(grid, column) ?? `mixed-${String(column)}`] : [],
    ),
  );
  return (
    numeric.some(Boolean) &&
    textColumns.length === 0 &&
    units.size === 1 &&
    grid.rows.length <= LIMITS.categories
  );
}

/** The chart props for a reading, as a chart (or a report's chart) declares them. */
export function chartPropsOf(data: ChartData, chartType: string): Record<string, unknown> {
  return {
    categories: data.categories,
    series: data.series,
    chartType,
    ...(data.prefix === undefined ? {} : { valuePrefix: data.prefix.slice(0, 12) }),
    ...(data.suffix === undefined ? {} : { valueSuffix: data.suffix.slice(0, 12) }),
    ...(data.maxValue === undefined ? {} : { maxValue: data.maxValue }),
    ...(data.targetValue === undefined ? {} : { targetValue: data.targetValue }),
  };
}
