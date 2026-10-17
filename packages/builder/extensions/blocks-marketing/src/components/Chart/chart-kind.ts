/**
 * Which picture a chart draws and what goes around it, from its props alone.
 * Pure and React-free: `Chart.tsx`, the keys and the models all ask here, so
 * the type a chart falls back to is decided once.
 */
import type { ChartProps } from './schema';

export type ChartKind = ChartProps['chartType'];

/** A radar needs at least three spokes to enclose anything, and past twelve they crowd. */
export const RADAR_MIN = 3;
export const RADAR_MAX = 12;
/** The most dials a gauge chart draws side by side: one per category of the first series. */
export const MAX_GAUGES = 6;

/** Drawn from the first series only: its values are the slices, stages or dials. */
const FIRST_SERIES_ONLY: ReadonlySet<ChartKind> = new Set(['pie', 'donut', 'funnel', 'gauge']);

/**
 * The type actually drawn. A radar outside three to twelve categories draws as
 * bars, so a chart switched to radar in the Inspector never goes blank.
 */
export function drawnType(props: Pick<ChartProps, 'chartType' | 'categories'>): ChartKind {
  if (props.chartType !== 'radar') return props.chartType;
  const count = props.categories.length;
  return count >= RADAR_MIN && count <= RADAR_MAX ? 'radar' : 'bar';
}

/** Whether only the first series is drawn (and listed in the screen-reader table). */
export function firstSeriesOnly(kind: ChartKind): boolean {
  return FIRST_SERIES_ONLY.has(kind);
}

/** Whether a legend of series names goes under the plot. A sparkline names each row itself. */
export function hasSeriesLegend(
  kind: ChartKind,
  props: Pick<ChartProps, 'showLegend' | 'series'>,
): boolean {
  return (
    props.showLegend && props.series.length > 1 && !firstSeriesOnly(kind) && kind !== 'sparkline'
  );
}

/** The legend key's shape: a stroke for a line, a dot for a point, a square for a filled mark. */
export function swatchShape(kind: ChartKind, series: number): string {
  if (kind === 'line' || kind === 'sparkline' || (kind === 'combo' && series > 0)) {
    return 'h-0.5 w-4 rounded-full';
  }
  return kind === 'scatter' ? 'size-3 rounded-full' : 'size-3 rounded-sm';
}
