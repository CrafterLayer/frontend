/**
 * The charts drawn as rows, one per category: horizontal bars (best when the
 * labels are long, since each label gets the whole row) and a funnel (the
 * stages of one series, centred, each a share of the first).
 *
 * The horizontal bars are a vertical bar chart turned on its side: the same
 * nice scale, grouping and stacking (chart-geometry.ts), computed with the
 * value axis as the frame's height and then transposed, so both charts round
 * the same numbers the same way. Pure and React-free; coordinates are viewBox
 * units before any RTL mirror.
 */
import { formatValue } from './chart-format';
import {
  barMarks,
  baselineOf,
  fmt,
  niceScale,
  scaleY,
  valueExtent,
  type BarMark,
  type NiceScale,
  type PlotFrame,
} from './chart-geometry';
import { MAX_VALUE_LABELS, VIEW_WIDTH, percent, valueGrid, type AxisTick } from './chart-model';
import type { ChartProps } from './schema';

/** One row's height in viewBox units; the rows stretch to the labels beside them. */
export const ROW_BAND = 32;

export type RowEnd = 'end' | 'start' | 'none';

export interface RowBar {
  readonly series: number;
  readonly category: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly end: RowEnd;
  readonly path: string;
}

/**
 * A horizontal bar as a path: square at its baseline, its data end rounded
 * (`end` for a positive bar, `start` for a negative one, `none` for a stacked
 * segment another one caps).
 */
export function rowBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  end: RowEnd,
): string {
  const r = end === 'none' ? 0 : Math.max(0, Math.min(radius, height / 2, width));
  if (r === 0) return `M${fmt(x)} ${fmt(y)}h${fmt(width)}v${fmt(height)}h${fmt(-width)}Z`;
  const arc = `A${fmt(r)} ${fmt(r)} 0 0 1`;
  const right = x + width;
  const bottom = y + height;
  if (end === 'end') {
    return `M${fmt(x)} ${fmt(y)}H${fmt(right - r)}${arc} ${fmt(right)} ${fmt(y + r)}V${fmt(bottom - r)}${arc} ${fmt(right - r)} ${fmt(bottom)}H${fmt(x)}Z`;
  }
  return `M${fmt(right)} ${fmt(y)}V${fmt(bottom)}H${fmt(x + r)}${arc} ${fmt(x)} ${fmt(bottom - r)}V${fmt(y + r)}${arc} ${fmt(x + r)} ${fmt(y)}Z`;
}

/** A bar rounded at every corner (a funnel stage). */
export function roundedRowPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, height / 2, width / 2));
  const arc = `A${fmt(r)} ${fmt(r)} 0 0 1`;
  return `M${fmt(x + r)} ${fmt(y)}H${fmt(x + width - r)}${arc} ${fmt(x + width)} ${fmt(y + r)}V${fmt(y + height - r)}${arc} ${fmt(x + width - r)} ${fmt(y + height)}H${fmt(x + r)}${arc} ${fmt(x)} ${fmt(y + height - r)}V${fmt(y + r)}${arc} ${fmt(x + r)} ${fmt(y)}Z`;
}

export interface RowLabel {
  readonly key: string;
  readonly digits: string;
  /** Where the bar ends, from the inline start of the plot in percent. */
  readonly start: number;
  /** The row's middle, from the top in percent. */
  readonly top: number;
  /** A negative bar's label sits before its end instead of after it. */
  readonly negative: boolean;
}

export interface HBarModel {
  readonly width: number;
  readonly height: number;
  readonly scale: NiceScale;
  readonly ticks: readonly AxisTick[];
  readonly zeroX: number | undefined;
  readonly bars: readonly RowBar[];
  readonly labels: readonly RowLabel[];
}

type RowData = Pick<ChartProps, 'categories' | 'series' | 'stacked' | 'showValues'>;

function turn(mark: BarMark): RowBar {
  const x = VIEW_WIDTH - (mark.y + mark.height);
  const end: RowEnd = mark.end === 'top' ? 'end' : mark.end === 'bottom' ? 'start' : 'none';
  return {
    series: mark.series,
    category: mark.category,
    value: mark.value,
    x,
    y: mark.x,
    width: mark.height,
    height: mark.width,
    end,
    path: rowBarPath(x, mark.x, mark.height, mark.width, 3, end),
  };
}

function rowLabels(props: RowData, bars: readonly RowBar[], height: number): RowLabel[] {
  const count = props.categories.length;
  const at = (category: number) => percent((category + 0.5) * ROW_BAND, height);
  let labels: RowLabel[];
  if (props.stacked) {
    labels = props.categories.flatMap((_, category) => {
      const row = bars.filter((bar) => bar.category === category);
      if (row.length === 0) return [];
      const total = row.reduce((sum, bar) => sum + bar.value, 0);
      const positive = row.some((bar) => bar.value > 0);
      const edge = positive
        ? Math.max(...row.map((bar) => bar.x + bar.width))
        : Math.min(...row.map((bar) => bar.x));
      return [
        {
          key: `total-${String(category)}`,
          digits: formatValue(total),
          start: percent(edge, VIEW_WIDTH),
          top: at(category),
          negative: !positive,
        },
      ];
    });
  } else {
    labels = bars.map((bar) => ({
      key: `${String(bar.series)}-${String(bar.category)}`,
      digits: formatValue(bar.value),
      start: percent(bar.value < 0 ? bar.x : bar.x + bar.width, VIEW_WIDTH),
      top: percent(bar.y + bar.height / 2, height),
      negative: bar.value < 0,
    }));
  }
  return labels.length > MAX_VALUE_LABELS
    ? labels.filter((label) => label.key.endsWith(`-${String(count - 1)}`))
    : labels;
}

/** Everything a horizontal bar chart draws: bars across, the value axis along the bottom. */
export function hbarModel(props: RowData): HBarModel {
  const grid = valueGrid(props);
  const count = props.categories.length;
  const extent = valueExtent(grid, count, { stacked: props.stacked });
  const scale = niceScale(Math.min(0, extent.min), Math.max(0, extent.max));
  const height = Math.max(count, 1) * ROW_BAND;
  /* Value labels need room past the longest bar (and past the shortest negative one). */
  const frame: PlotFrame = {
    width: height,
    height: VIEW_WIDTH,
    top: props.showValues ? 72 : 8,
    bottom: props.showValues && scale.min < 0 ? 72 : 4,
  };
  const xOf = (value: number) => VIEW_WIDTH - scaleY(value, scale, frame);
  const bars = barMarks(grid, count, scale, frame, {
    stacked: props.stacked,
    maxWidth: 20,
    gap: 2,
    radius: 3,
  }).map(turn);
  return {
    width: VIEW_WIDTH,
    height,
    scale,
    ticks: scale.ticks.map((value) => ({
      value,
      digits: formatValue(value, {}, 'compact'),
      x: xOf(value),
      start: percent(xOf(value), VIEW_WIDTH),
    })),
    zeroX: scale.min <= 0 && scale.max >= 0 ? xOf(baselineOf(scale)) : undefined,
    bars,
    labels: props.showValues ? rowLabels(props, bars, height) : [],
  };
}

export interface FunnelStage {
  readonly index: number;
  readonly value: number;
  /** The stage as a share of the first (the conversion so far); undefined when the first is not positive. */
  readonly share: number | undefined;
  /** Empty for a stage with nothing in it. */
  readonly path: string;
}

export interface FunnelModel {
  readonly width: number;
  readonly height: number;
  readonly stages: readonly FunnelStage[];
  /** The wash between one stage and the next, narrowing as the funnel does. */
  readonly necks: readonly string[];
}

/** A funnel of the first series: centred stages as wide as their value, the widest filling the row. */
export function funnelModel(props: Pick<ChartProps, 'categories' | 'series'>): FunnelModel {
  const values = valueGrid(props)[0] ?? [];
  const count = props.categories.length;
  const largest = Math.max(0, ...values);
  const first = values[0];
  const thickness = ROW_BAND * 0.66;
  const shapes = props.categories.map((_, index) => {
    const value = values[index] ?? 0;
    const width = largest > 0 ? (Math.max(value, 0) / largest) * (VIEW_WIDTH - 8) : 0;
    const x = (VIEW_WIDTH - width) / 2;
    const y = index * ROW_BAND + (ROW_BAND - thickness) / 2;
    return { index, value, x, y, width };
  });
  const necks = shapes.slice(1).flatMap((next, index) => {
    const above = shapes[index];
    if (above === undefined || above.width <= 0 || next.width <= 0) return [];
    const top = above.y + thickness;
    return [
      `M${fmt(above.x)} ${fmt(top)}H${fmt(above.x + above.width)}L${fmt(next.x + next.width)} ${fmt(next.y)}H${fmt(next.x)}Z`,
    ];
  });
  return {
    width: VIEW_WIDTH,
    height: Math.max(count, 1) * ROW_BAND,
    stages: shapes.map(({ index, value, x, y, width }) => ({
      index,
      value,
      share: first !== undefined && first > 0 ? value / first : undefined,
      path: width > 0 ? roundedRowPath(x, y, width, thickness, 3) : '',
    })),
    necks,
  };
}
