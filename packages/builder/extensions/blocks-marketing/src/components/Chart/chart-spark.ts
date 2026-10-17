/**
 * Sparklines: one compact trend per series, with no axis, grid or labels. Each
 * row is scaled to its own lowest and highest value, because a sparkline shows
 * a shape (rising, falling, a spike), not a magnitude — the last value printed
 * beside it says how much. Pure and React-free.
 */
import { fmt, linePath, type Point } from './chart-geometry';
import { valueGrid } from './chart-model';
import type { ChartProps } from './schema';

export const SPARK_VIEW = { width: 200, height: 40 } as const;
/* The end dot keeps clear of the edges. */
const INSET = 4;

export interface SparkRow {
  readonly series: number;
  readonly line: string;
  /** The wash under the line, down to the bottom edge. */
  readonly area: string;
  /** The last point, marked with a dot; undefined for a series with no values. */
  readonly end: Point | undefined;
  readonly last: number | undefined;
}

/** One sparkline per series across the categories. */
export function sparkRows(props: Pick<ChartProps, 'categories' | 'series'>): SparkRow[] {
  const count = props.categories.length;
  const { width, height } = SPARK_VIEW;
  return valueGrid(props).map((values, series) => {
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low;
    const points = values.map((value, index) => ({
      x: count <= 1 ? width / 2 : INSET + (index / (count - 1)) * (width - 2 * INSET),
      y: span === 0 ? height / 2 : INSET + (1 - (value - low) / span) * (height - 2 * INSET),
    }));
    const first = points[0];
    const end = points.at(-1);
    const line = linePath(points);
    return {
      series,
      line,
      area:
        first === undefined || end === undefined || points.length < 2
          ? ''
          : `${line}L${fmt(end.x)} ${fmt(height)}L${fmt(first.x)} ${fmt(height)}Z`,
      end,
      last: values.at(-1),
    };
  });
}
