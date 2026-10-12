/**
 * What a chart draws, computed from its props: the scale and its tick labels,
 * the marks, and where each HTML label sits over the SVG (as percentages of
 * the plot, so the overlay lines up at any width without measuring anything).
 *
 * Pure and React-free like the geometry it calls: the component only maps this
 * model to elements.
 */
import {
  areaLayers,
  barMarks,
  baselineOf,
  linePath,
  linePoints,
  niceScale,
  pieEntries,
  pieSlices,
  scaleY,
  valueExtent,
  type AreaLayer,
  type BarMark,
  type NiceScale,
  type PieSlice,
  type PlotFrame,
} from './chart-geometry';
import { formatValue, type ValueFormat } from './chart-format';
import { MAX_PIE_SLICES } from './chart-palette';
import type { ChartProps } from './schema';

/*
  The plot stretches to its box (`preserveAspectRatio="none"`): the box is as
  wide as the column and as tall as `height` says, whatever the column's width.
  A viewBox unit is therefore about one CSS pixel vertically (the heights
  match `h-48`, `h-64` and `h-80`) and whatever the column makes it across;
  everything that must stay round or thin is drawn with non-scaling strokes.
*/
export const VIEW_WIDTH = 640;
export const VIEW_HEIGHTS: Readonly<Record<ChartProps['height'], number>> = {
  sm: 192,
  md: 256,
  lg: 320,
};
export const PIE_VIEW = 200;

/* Past this many marks, value labels go on the last category only: a number on every point goes unread. */
const MAX_VALUE_LABELS = 40;

type ChartData = Pick<
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

export interface TickModel {
  readonly value: number;
  /** The tick as printed, affixes included (it sizes the axis column). */
  readonly label: string;
  /** The number alone; the prefix and suffix render around it as parts. */
  readonly digits: string;
  readonly y: number;
  /** Distance from the top of the plot, in percent. */
  readonly top: number;
}

export interface ValueLabel {
  readonly key: string;
  readonly text: string;
  /** The number alone; the prefix and suffix render around it as parts. */
  readonly digits: string;
  /** Distance from the inline start of the plot, in percent (mirrors under RTL). */
  readonly start: number;
  readonly top: number;
  /** A negative bar's label hangs below its end instead of sitting above it. */
  readonly below: boolean;
}

export interface MarkerModel {
  readonly series: number;
  readonly category: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
}

export interface CartesianModel {
  readonly kind: 'bar' | 'line' | 'area';
  readonly width: number;
  readonly height: number;
  readonly categoryCount: number;
  readonly scale: NiceScale;
  readonly ticks: readonly TickModel[];
  /** The zero line, when zero is inside the scale. */
  readonly zeroY: number | undefined;
  readonly bars: readonly BarMark[];
  readonly lines: readonly { readonly series: number; readonly path: string }[];
  readonly areas: readonly AreaLayer[];
  readonly markers: readonly MarkerModel[];
  readonly labels: readonly ValueLabel[];
  /** The y-axis column's width in `ch`, from its longest tick label. */
  readonly axisWidth: number;
}

export function valueFormatOf(props: Pick<ChartProps, 'valuePrefix' | 'valueSuffix'>): ValueFormat {
  return { prefix: props.valuePrefix, suffix: props.valueSuffix };
}

/** The series' values cut to the categories: a value with no category has nowhere to go. */
export function valueGrid(props: Pick<ChartProps, 'categories' | 'series'>): number[][] {
  return props.series.map((entry) => entry.values.slice(0, props.categories.length));
}

/** Whether there is anything to draw: a category, a series, and one value between them. */
export function hasChartData(
  props: Pick<ChartProps, 'chartType' | 'categories' | 'series'>,
): boolean {
  const grid = valueGrid(props);
  if (props.chartType === 'pie' || props.chartType === 'donut') {
    return (grid[0] ?? []).some((value) => value > 0);
  }
  return props.categories.length > 0 && grid.some((values) => values.length > 0);
}

function percent(value: number, whole: number): number {
  return Number(((value / whole) * 100).toFixed(3));
}

function scaleFor(props: ChartData, grid: number[][]): NiceScale {
  const count = props.categories.length;
  const stacked = props.stacked && props.chartType !== 'line';
  const extent = valueExtent(grid, count, {
    stacked,
    clampNegative: stacked && props.chartType === 'area',
  });
  /* Bars and areas are lengths from zero, so zero is always on their axis; a line need not start there. */
  return props.chartType === 'line'
    ? niceScale(extent.min, extent.max)
    : niceScale(Math.min(0, extent.min), Math.max(0, extent.max));
}

function stackTotals(grid: number[][], count: number): { positive: number; total: number }[] {
  return Array.from({ length: count }, (_, category) => {
    let positive = 0;
    let total = 0;
    for (const values of grid) {
      const value = values[category] ?? 0;
      if (value > 0) positive += value;
      total += value;
    }
    return { positive, total };
  });
}

interface LabelSource {
  readonly key: string;
  readonly category: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly below: boolean;
}

function labelSources(
  props: ChartData,
  grid: number[][],
  bars: readonly BarMark[],
  markers: readonly MarkerModel[],
): LabelSource[] {
  if (props.chartType === 'bar' && props.stacked) {
    return stackTotals(grid, props.categories.length).flatMap(({ positive, total }, category) => {
      const column = bars.filter((bar) => bar.category === category);
      if (column.length === 0) return [];
      const above = positive > 0;
      const edge = above
        ? Math.min(...column.map((bar) => bar.y))
        : Math.max(...column.map((bar) => bar.y + bar.height));
      const x = (column[0]?.x ?? 0) + (column[0]?.width ?? 0) / 2;
      return [
        { key: `total-${String(category)}`, category, value: total, x, y: edge, below: !above },
      ];
    });
  }
  if (props.chartType === 'bar') {
    return bars.map((bar) => ({
      key: `${String(bar.series)}-${String(bar.category)}`,
      category: bar.category,
      value: bar.value,
      x: bar.x + bar.width / 2,
      y: bar.value > 0 ? bar.y : bar.y + bar.height,
      below: bar.value < 0,
    }));
  }
  return markers.map((marker) => ({
    key: `${String(marker.series)}-${String(marker.category)}`,
    category: marker.category,
    value: marker.value,
    x: marker.x,
    y: marker.y,
    below: false,
  }));
}

/** Everything a bar, line or area chart draws. */
export function cartesianModel(props: ChartData): CartesianModel {
  const kind = props.chartType === 'line' || props.chartType === 'area' ? props.chartType : 'bar';
  const grid = valueGrid(props);
  const count = props.categories.length;
  const scale = scaleFor({ ...props, chartType: kind }, grid);
  const height = VIEW_HEIGHTS[props.height];
  const frame: PlotFrame = {
    width: VIEW_WIDTH,
    height,
    top: props.showValues ? 24 : 10,
    bottom: props.showValues && scale.min < 0 ? 24 : 4,
  };
  const format = valueFormatOf(props);
  const ticks = scale.ticks.map((value) => {
    const y = scaleY(value, scale, frame);
    return {
      value,
      label: formatValue(value, format, 'compact'),
      digits: formatValue(value, {}, 'compact'),
      y,
      top: percent(y, height),
    };
  });
  const zeroY =
    scale.min <= 0 && scale.max >= 0 ? scaleY(baselineOf(scale), scale, frame) : undefined;

  const bars =
    kind === 'bar'
      ? barMarks(grid, count, scale, frame, {
          stacked: props.stacked,
          maxWidth: 28,
          gap: 2,
          radius: 3,
        })
      : [];
  const areas = kind === 'area' ? areaLayers(grid, count, scale, frame, props.stacked) : [];
  const lines =
    kind === 'line'
      ? grid.map((values, series) => ({
          series,
          path: linePath(linePoints(values, count, scale, frame)),
        }))
      : areas.map((area) => ({ series: area.series, path: area.line }));
  const markers: MarkerModel[] =
    kind === 'line'
      ? grid.flatMap((values, series) =>
          linePoints(values, count, scale, frame).flatMap((point, category) =>
            point === undefined
              ? []
              : [{ series, category, value: values[category] ?? 0, ...point }],
          ),
        )
      : areas.flatMap((area) =>
          area.top.map((point, category) => ({
            series: area.series,
            category,
            value: area.values[category] ?? 0,
            ...point,
          })),
        );

  const sources = props.showValues ? labelSources(props, grid, bars, markers) : [];
  const shown =
    sources.length > MAX_VALUE_LABELS
      ? sources.filter((source) => source.category === count - 1)
      : sources;
  const labels = shown.map((source) => ({
    key: source.key,
    text: formatValue(source.value, format),
    digits: formatValue(source.value),
    start: percent(source.x, VIEW_WIDTH),
    top: percent(source.y, height),
    below: source.below,
  }));
  const longest = ticks.reduce((widest, tick) => Math.max(widest, tick.label.length), 1);

  return {
    kind,
    width: VIEW_WIDTH,
    height,
    categoryCount: count,
    scale,
    ticks,
    zeroY,
    bars,
    lines,
    areas,
    /* An area's points are drawn only when there is a single category and so no band to see. */
    markers: kind === 'area' && count > 1 ? [] : markers,
    labels,
    axisWidth: longest + 1,
  };
}

export interface PieModel {
  readonly slices: readonly PieSlice[];
  readonly total: number;
  readonly innerRadius: number;
}

/** The slices of a pie or donut from the first series; the smallest fold past eight. */
export function pieModel(props: Pick<ChartProps, 'chartType' | 'categories' | 'series'>): PieModel {
  const values = valueGrid(props)[0] ?? [];
  const innerRadius = props.chartType === 'donut' ? 58 : 0;
  const center = PIE_VIEW / 2;
  const slices = pieSlices(pieEntries(values, MAX_PIE_SLICES), {
    cx: center,
    cy: center,
    radius: center - 4,
    innerRadius,
  });
  return {
    slices,
    total: slices.reduce((sum, slice) => sum + slice.value, 0),
    innerRadius,
  };
}
