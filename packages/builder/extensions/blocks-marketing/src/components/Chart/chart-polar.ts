/**
 * The round charts that are not pies: a radar (one spoke per category, one
 * closed shape per series, rings at nice values) and a gauge (a half dial
 * per category of the first series, filled to its value against a maximum,
 * with an optional target marked across it).
 *
 * Pure and React-free; angles are degrees clockwise from twelve o'clock, as
 * in chart-geometry.ts. Both keep their proportions (no stretched viewBox).
 */
import { fmt, niceScale, polar, type NiceScale, type Point } from './chart-geometry';
import { MAX_GAUGES } from './chart-kind';
import { percent, valueGrid } from './chart-model';
import type { ChartProps } from './schema';

export const RADAR_VIEW = 240;
const RADAR_RADIUS = 84;
/* Category labels sit just outside the outer ring. */
const LABEL_RADIUS = 98;

function closed(points: readonly Point[]): string {
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${fmt(point.x)} ${fmt(point.y)}`).join('')}Z`;
}

export interface RadarLabel {
  readonly index: number;
  /** From the inline start of the plot, in percent (mirrors under RTL with the SVG). */
  readonly start: number;
  readonly top: number;
  /** Which way the label grows from its point, so it never covers the web. */
  readonly anchor: 'start' | 'middle' | 'end';
  readonly side: 'top' | 'middle' | 'bottom';
}

export interface RadarModel {
  readonly view: number;
  readonly center: number;
  readonly scale: NiceScale;
  /** One web per nice value above zero, outermost last; `top` places its value on the first spoke. */
  readonly rings: readonly {
    readonly value: number;
    readonly path: string;
    readonly top: number;
  }[];
  readonly spokes: readonly Point[];
  readonly shapes: readonly {
    readonly series: number;
    readonly path: string;
    readonly points: readonly (Point & { readonly category: number; readonly value: number })[];
  }[];
  readonly labels: readonly RadarLabel[];
}

/** A radar of every series over the categories; a missing or negative value sits at the centre. */
export function radarModel(
  props: Pick<ChartProps, 'categories' | 'series' | 'maxValue'>,
): RadarModel {
  const grid = valueGrid(props);
  const count = props.categories.length;
  const center = RADAR_VIEW / 2;
  const largest = Math.max(0, props.maxValue ?? 0, ...grid.flat());
  const scale = niceScale(0, largest, 4);
  const span = scale.max - scale.min;
  const ratioOf = (value: number) =>
    span === 0 ? 0 : Math.min(Math.max((value - scale.min) / span, 0), 1);
  const angleOf = (index: number) => (index * 360) / Math.max(count, 1);
  const at = (ratio: number, index: number) =>
    polar(center, center, RADAR_RADIUS * ratio, angleOf(index));
  const spokes = props.categories.map((_, index) => at(1, index));
  return {
    view: RADAR_VIEW,
    center,
    scale,
    rings: scale.ticks
      .filter((value) => value > 0)
      .map((value) => ({
        value,
        path: closed(props.categories.map((_, index) => at(ratioOf(value), index))),
        top: percent(center - RADAR_RADIUS * ratioOf(value), RADAR_VIEW),
      })),
    spokes,
    shapes: grid.map((values, series) => {
      const points = props.categories.map((_, category) => {
        const value = values[category] ?? 0;
        return { ...at(ratioOf(value), category), category, value };
      });
      return { series, path: closed(points), points };
    }),
    labels: props.categories.map((_, index) => {
      const point = polar(center, center, LABEL_RADIUS, angleOf(index));
      const dx = point.x - center;
      const dy = point.y - center;
      return {
        index,
        start: percent(point.x, RADAR_VIEW),
        top: percent(point.y, RADAR_VIEW),
        anchor: Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end',
        side: Math.abs(dy) < 8 ? 'middle' : dy < 0 ? 'top' : 'bottom',
      };
    }),
  };
}

export const GAUGE_VIEW = { width: 200, height: 112 } as const;
const GAUGE_CENTER = { x: 100, y: 102 } as const;
export const GAUGE_RADIUS = 82;
export const GAUGE_STROKE = 16;

/** Where a gauge's dial ends and its target, from the first series (or `maxValue`). */
export function gaugeEnds(
  props: Pick<ChartProps, 'categories' | 'series' | 'maxValue' | 'targetValue'>,
): {
  readonly max: number;
  readonly target: number | undefined;
} {
  const values = (valueGrid(props)[0] ?? []).slice(0, MAX_GAUGES);
  const given = props.maxValue;
  const max =
    given !== undefined && given > 0
      ? given
      : niceScale(0, Math.max(0, props.targetValue ?? 0, ...values)).max;
  return { max, target: props.targetValue };
}

/** The half circle from the inline start (nine o'clock) through `ratio` of the way round. */
function dialArc(ratio: number): string {
  const from = polar(GAUGE_CENTER.x, GAUGE_CENTER.y, GAUGE_RADIUS, -90);
  const to = polar(GAUGE_CENTER.x, GAUGE_CENTER.y, GAUGE_RADIUS, -90 + 180 * ratio);
  const r = fmt(GAUGE_RADIUS);
  return `M${fmt(from.x)} ${fmt(from.y)}A${r} ${r} 0 0 1 ${fmt(to.x)} ${fmt(to.y)}`;
}

export interface GaugeDial {
  readonly index: number;
  /** Undefined when the category has no value: the dial is drawn empty. */
  readonly value: number | undefined;
  readonly ratio: number;
  /** The filled arc; empty when there is nothing to fill. */
  readonly arc: string;
}

export interface GaugeModel {
  readonly max: number;
  readonly track: string;
  readonly target: { readonly value: number; readonly path: string } | undefined;
  readonly dials: readonly GaugeDial[];
}

/** One dial per category of the first series (at most six), sharing a maximum and a target. */
export function gaugeModel(
  props: Pick<ChartProps, 'categories' | 'series' | 'maxValue' | 'targetValue'>,
): GaugeModel {
  const { max, target } = gaugeEnds(props);
  const values = valueGrid(props)[0] ?? [];
  const ratioOf = (value: number) => Math.min(Math.max(value / max, 0), 1);
  const targetAngle = target === undefined ? 0 : -90 + 180 * ratioOf(target);
  const inner = polar(GAUGE_CENTER.x, GAUGE_CENTER.y, GAUGE_RADIUS - GAUGE_STROKE, targetAngle);
  const outer = polar(GAUGE_CENTER.x, GAUGE_CENTER.y, GAUGE_RADIUS + GAUGE_STROKE, targetAngle);
  return {
    max,
    track: dialArc(1),
    target:
      target === undefined
        ? undefined
        : {
            value: target,
            path: `M${fmt(inner.x)} ${fmt(inner.y)}L${fmt(outer.x)} ${fmt(outer.y)}`,
          },
    dials: props.categories.slice(0, MAX_GAUGES).map((_, index) => {
      const value = values[index];
      const ratio = value === undefined ? 0 : ratioOf(value);
      return { index, value, ratio, arc: ratio > 0 ? dialArc(ratio) : '' };
    }),
  };
}
