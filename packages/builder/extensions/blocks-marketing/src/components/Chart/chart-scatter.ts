/**
 * A scatter chart's model: each category is one observation, its label read
 * as the x value, and each series gives that observation's y. Labels that are
 * not all numbers place the points over the category bands instead — a line
 * chart without its lines — so a chart switched to scatter never goes blank.
 *
 * Pure and React-free, like chart-model.ts, whose shape it returns.
 */
import { formatValue } from './chart-format';
import { niceScale, scaleY, valueExtent, type PlotFrame } from './chart-geometry';
import {
  MAX_VALUE_LABELS,
  VIEW_HEIGHTS,
  VIEW_WIDTH,
  axisWidthOf,
  cartesianModel,
  percent,
  tickModels,
  valueFormatOf,
  valueGrid,
  zeroLine,
  type CartesianModel,
  type MarkerModel,
} from './chart-model';
import type { ChartProps } from './schema';

type ScatterData = Pick<
  ChartProps,
  | 'chartType'
  | 'categories'
  | 'series'
  | 'stacked'
  | 'showValues'
  | 'height'
  | 'valuePrefix'
  | 'valueSuffix'
>;

/* A currency sign, a number (grouped or not), then a short unit: "$40", "1,200", "12 kg", "٣٫٥". */
const AXIS_NUMBER = /^\p{Sc}?\s?(-?\d*\.?\d+)\s?(?:%|\p{L}{1,4})?$/u;

/** A category label as a number, Arabic-Indic digits and grouping allowed; undefined for words ("Q1"). */
export function categoryNumber(label: unknown): number | undefined {
  if (typeof label !== 'string') return undefined;
  let text = '';
  for (const char of label.trim()) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) text += String(code - 0x0660);
    else if (code >= 0x06f0 && code <= 0x06f9) text += String(code - 0x06f0);
    else text += char;
  }
  const plain = text.replace(/٫/gu, '.').replace(/[٬,]/gu, '').replace(/−/gu, '-');
  const match = AXIS_NUMBER.exec(plain);
  const value = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/* Dots at either end of the x scale stay inside the plot. */
const X_INSET = 12;

/** Everything a scatter chart draws: ringed points, a y axis, and a numeric x axis when it has one. */
export function scatterModel(props: ScatterData): CartesianModel {
  const xs = props.categories.map(categoryNumber);
  const numeric = xs.filter((x): x is number => x !== undefined);
  if (numeric.length === 0 || numeric.length < xs.length) {
    return { ...cartesianModel({ ...props, chartType: 'line' }), kind: 'scatter', lines: [] };
  }
  const grid = valueGrid(props);
  const count = props.categories.length;
  const extent = valueExtent(grid, count, { stacked: false });
  const scale = niceScale(extent.min, extent.max);
  const xScale = niceScale(Math.min(...numeric), Math.max(...numeric));
  const height = VIEW_HEIGHTS[props.height];
  const frame: PlotFrame = {
    width: VIEW_WIDTH,
    height,
    top: props.showValues ? 24 : 10,
    bottom: 4,
  };
  const span = xScale.max - xScale.min;
  const xOf = (x: number) =>
    X_INSET + (span === 0 ? 0.5 : (x - xScale.min) / span) * (VIEW_WIDTH - 2 * X_INSET);
  const markers: MarkerModel[] = grid.flatMap((values, series) =>
    values.flatMap((value, category) => {
      const x = xs[category];
      return x === undefined
        ? []
        : [{ series, category, value, x: xOf(x), y: scaleY(value, scale, frame) }];
    }),
  );
  const format = valueFormatOf(props);
  const ticks = tickModels(scale, frame, format);
  const labels = (props.showValues && markers.length <= MAX_VALUE_LABELS ? markers : []).map(
    (marker) => ({
      key: `${String(marker.series)}-${String(marker.category)}`,
      text: formatValue(marker.value, format),
      digits: formatValue(marker.value),
      start: percent(marker.x, VIEW_WIDTH),
      top: percent(marker.y, height),
      below: false,
    }),
  );
  return {
    kind: 'scatter',
    width: VIEW_WIDTH,
    height,
    categoryCount: count,
    scale,
    ticks,
    zeroY: zeroLine(scale, frame),
    bars: [],
    lines: [],
    areas: [],
    markers,
    labels,
    axisWidth: axisWidthOf(ticks),
    xTicks: xScale.ticks.map((value) => ({
      value,
      digits: formatValue(value, {}, 'compact'),
      x: xOf(value),
      start: percent(xOf(value), VIEW_WIDTH),
    })),
  };
}
