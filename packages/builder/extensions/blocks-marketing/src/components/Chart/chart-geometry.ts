/**
 * Chart geometry: nice scales, bar rectangles, line and area paths, and pie or
 * donut arcs, all in viewBox units.
 *
 * Pure — no React, no DOM, no colours — so the canvas, the published page (which
 * ships no client JavaScript) and the tests all draw from the same numbers. It
 * sits outside `schema.ts`'s import chain on purpose: the schema-only entry
 * point stays a vocabulary, not a renderer.
 *
 * Angles are degrees clockwise from twelve o'clock. Values are finite numbers
 * (the schema's `z.number()` refuses NaN and infinities); a missing value is
 * `undefined`, never zero, until a function below says otherwise.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A value matrix: one row per series, one column per category. */
export type ValueGrid = readonly (readonly number[])[];

export interface NiceScale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly ticks: readonly number[];
}

/** The drawable area inside a viewBox: full width, with room above and below. */
export interface PlotFrame {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly bottom: number;
}

/** Path numbers to two places: short, deterministic strings. */
export function fmt(value: number): string {
  const rounded = Number(value.toFixed(2));
  return String(rounded === 0 ? 0 : rounded);
}

/** Decimal places a step needs, so `0.1 + 0.2` reads as `0.3`. */
function decimalsOf(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step)) + 1);
}

function clean(value: number, decimals: number): number {
  const rounded = Number(value.toFixed(decimals));
  return rounded === 0 ? 0 : rounded;
}

const NICE_FACTORS = [1, 2, 2.5, 5, 10] as const;

/** A 1, 2, 2.5 or 5 × 10ⁿ step that cuts `span` into about `count` intervals. */
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, Math.round(count));
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const factor = NICE_FACTORS.find((candidate) => residual <= candidate + 1e-9) ?? 10;
  return factor * magnitude;
}

/**
 * A scale whose ends are whole steps and whose ticks read as round numbers.
 * A flat range opens towards zero (`[5, 5]` → `[0, 5]`); an empty or all-zero
 * one becomes `[0, 1]`, so a chart of nothing still has an axis.
 */
export function niceScale(low: number, high: number, count = 5): NiceScale {
  let lo = Math.min(low, high);
  let hi = Math.max(low, high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 0;
  }
  if (lo === hi) {
    if (lo > 0) lo = 0;
    else if (hi < 0) hi = 0;
    else hi = 1;
  }
  const step = niceStep(hi - lo, count);
  const decimals = decimalsOf(step);
  const min = clean(Math.floor(lo / step + 1e-9) * step, decimals);
  const max = clean(Math.ceil(hi / step - 1e-9) * step, decimals);
  const intervals = Math.round((max - min) / step);
  const ticks = Array.from({ length: intervals + 1 }, (_, index) =>
    clean(min + index * step, decimals),
  );
  return { min, max, step, ticks };
}

export interface ExtentOptions {
  /** Sum the series per category (positives up, negatives down) instead of comparing them. */
  readonly stacked: boolean;
  /** Treat negatives as zero — a stacked area has no "below" to stack into. */
  readonly clampNegative?: boolean;
}

/** The lowest and highest value the chart must show; `{ 0, 0 }` when there is none. */
export function valueExtent(
  series: ValueGrid,
  categoryCount: number,
  options: ExtentOptions,
): { readonly min: number; readonly max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let category = 0; category < categoryCount; category += 1) {
    let positive = 0;
    let negative = 0;
    let seen = false;
    for (const values of series) {
      const value = values[category];
      if (value === undefined) continue;
      seen = true;
      if (!options.stacked) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      } else if (value > 0) positive += value;
      else if (options.clampNegative !== true) negative += value;
    }
    if (options.stacked && seen) {
      min = Math.min(min, negative);
      max = Math.max(max, positive);
    }
  }
  return min === Infinity ? { min: 0, max: 0 } : { min, max };
}

/** The y coordinate of `value` inside the frame; a flat scale draws at the bottom. */
export function scaleY(value: number, scale: NiceScale, frame: PlotFrame): number {
  const span = scale.max - scale.min;
  const inner = frame.height - frame.top - frame.bottom;
  const ratio = span === 0 ? 0 : (value - scale.min) / span;
  return frame.top + (1 - ratio) * inner;
}

/** The value the bars and areas grow from: zero, or the nearer scale end. */
export function baselineOf(scale: NiceScale): number {
  return Math.min(Math.max(0, scale.min), scale.max);
}

/** The middle of category `index` in `count` equal bands across `width`. */
export function bandCenter(index: number, count: number, width: number): number {
  return ((index + 0.5) * width) / Math.max(count, 1);
}

export type BarEnd = 'top' | 'bottom' | 'none';

/**
 * A bar as a path: square at its baseline, its data end rounded (`top` for a
 * positive bar, `bottom` for a negative one, `none` for a stacked segment that
 * another segment caps).
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  end: BarEnd,
): string {
  const r = end === 'none' ? 0 : Math.max(0, Math.min(radius, width / 2, height));
  if (r === 0) return `M${fmt(x)} ${fmt(y)}h${fmt(width)}v${fmt(height)}h${fmt(-width)}Z`;
  const arc = `A${fmt(r)} ${fmt(r)} 0 0 1`;
  const right = x + width;
  const bottom = y + height;
  if (end === 'top') {
    return `M${fmt(x)} ${fmt(bottom)}V${fmt(y + r)}${arc} ${fmt(x + r)} ${fmt(y)}H${fmt(right - r)}${arc} ${fmt(right)} ${fmt(y + r)}V${fmt(bottom)}Z`;
  }
  return `M${fmt(x)} ${fmt(y)}H${fmt(right)}V${fmt(bottom - r)}${arc} ${fmt(right - r)} ${fmt(bottom)}H${fmt(x + r)}${arc} ${fmt(x)} ${fmt(bottom - r)}Z`;
}

export interface BarMark {
  readonly series: number;
  readonly category: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly end: BarEnd;
  readonly path: string;
}

export interface BarOptions {
  readonly stacked: boolean;
  /** The widest a single (grouped) bar may grow; a stack may grow half again. */
  readonly maxWidth: number;
  /** The surface gap between touching bars and between stacked segments. */
  readonly gap: number;
  readonly radius: number;
}

function groupedBars(
  series: ValueGrid,
  categoryCount: number,
  scale: NiceScale,
  frame: PlotFrame,
  options: BarOptions,
): BarMark[] {
  const count = series.length;
  const band = frame.width / categoryCount;
  const room = band * 0.72 - options.gap * (count - 1);
  const width = Math.max(1, Math.min(options.maxWidth, room / count));
  const group = width * count + options.gap * (count - 1);
  const zero = scaleY(baselineOf(scale), scale, frame);
  const marks: BarMark[] = [];
  for (let category = 0; category < categoryCount; category += 1) {
    const start = bandCenter(category, categoryCount, frame.width) - group / 2;
    series.forEach((values, seriesIndex) => {
      const value = values[category];
      if (value === undefined || value === 0) return;
      const tip = scaleY(value, scale, frame);
      const x = start + seriesIndex * (width + options.gap);
      const y = Math.min(tip, zero);
      const height = Math.abs(zero - tip);
      const end: BarEnd = value > 0 ? 'top' : 'bottom';
      marks.push({
        series: seriesIndex,
        category,
        value,
        x,
        y,
        width,
        height,
        end,
        path: barPath(x, y, width, height, options.radius, end),
      });
    });
  }
  return marks;
}

function stackedBars(
  series: ValueGrid,
  categoryCount: number,
  scale: NiceScale,
  frame: PlotFrame,
  options: BarOptions,
): BarMark[] {
  const band = frame.width / categoryCount;
  const width = Math.max(1, Math.min(options.maxWidth * 1.5, band * 0.56));
  const marks: BarMark[] = [];
  for (let category = 0; category < categoryCount; category += 1) {
    const x = bandCenter(category, categoryCount, frame.width) - width / 2;
    let positive = 0;
    let negative = 0;
    const column: Omit<BarMark, 'end' | 'path'>[] = [];
    series.forEach((values, seriesIndex) => {
      const value = values[category];
      if (value === undefined || value === 0) return;
      const from = value > 0 ? positive : negative;
      const to = from + value;
      if (value > 0) positive = to;
      else negative = to;
      const base = scaleY(from, scale, frame);
      const tip = scaleY(to, scale, frame);
      let y = Math.min(base, tip);
      let height = Math.abs(base - tip);
      /* A segment that sits on another one leaves the surface gap at its base. */
      const stacksOnAnother = from !== 0;
      if (stacksOnAnother && height > options.gap) {
        height -= options.gap;
        if (value < 0) y += options.gap;
      }
      column.push({ series: seriesIndex, category, value, x, y, width, height });
    });
    /* Only the outermost segment on each side has a rounded data end. */
    const lastPositive = column.findLastIndex((mark) => mark.value > 0);
    const lastNegative = column.findLastIndex((mark) => mark.value < 0);
    column.forEach((mark, index) => {
      const end: BarEnd =
        index === lastPositive ? 'top' : index === lastNegative ? 'bottom' : 'none';
      marks.push({
        ...mark,
        end,
        path: barPath(mark.x, mark.y, mark.width, mark.height, options.radius, end),
      });
    });
  }
  return marks;
}

/** Every bar a bar chart draws; a missing or zero value draws nothing. */
export function barMarks(
  series: ValueGrid,
  categoryCount: number,
  scale: NiceScale,
  frame: PlotFrame,
  options: BarOptions,
): BarMark[] {
  if (series.length === 0 || categoryCount === 0) return [];
  return options.stacked
    ? stackedBars(series, categoryCount, scale, frame, options)
    : groupedBars(series, categoryCount, scale, frame, options);
}

/** One series' points at the band centres; `undefined` where its value is missing. */
export function linePoints(
  values: readonly number[],
  categoryCount: number,
  scale: NiceScale,
  frame: PlotFrame,
): (Point | undefined)[] {
  return Array.from({ length: categoryCount }, (_, category) => {
    const value = values[category];
    return value === undefined
      ? undefined
      : { x: bandCenter(category, categoryCount, frame.width), y: scaleY(value, scale, frame) };
  });
}

/** A polyline through the points; a missing point breaks it into separate runs. */
export function linePath(points: readonly (Point | undefined)[]): string {
  let path = '';
  let drawing = false;
  for (const point of points) {
    if (point === undefined) {
      drawing = false;
      continue;
    }
    path += `${drawing ? 'L' : 'M'}${fmt(point.x)} ${fmt(point.y)}`;
    drawing = true;
  }
  return path;
}

export interface AreaLayer {
  readonly series: number;
  /** The value each point shows (not the stacked total). */
  readonly values: readonly number[];
  readonly top: readonly Point[];
  readonly base: readonly Point[];
  /** The filled band between `top` and `base`. */
  readonly path: string;
  /** The line along `top`. */
  readonly line: string;
}

/**
 * The bands of an area chart. A missing value counts as zero so every band is
 * closed; stacked, each band sits on the one before and negatives count as
 * zero, unstacked each band grows from the baseline.
 */
export function areaLayers(
  series: ValueGrid,
  categoryCount: number,
  scale: NiceScale,
  frame: PlotFrame,
  stacked: boolean,
): AreaLayer[] {
  if (categoryCount === 0) return [];
  const baseline = baselineOf(scale);
  let floor: number[] = Array.from({ length: categoryCount }, () => baseline);
  return series.map((source, seriesIndex) => {
    const values = Array.from({ length: categoryCount }, (_, category) => source[category] ?? 0);
    const tops = values.map((value, category) =>
      stacked ? (floor[category] ?? baseline) + Math.max(value, 0) : value,
    );
    const bases = stacked ? floor : values.map(() => baseline);
    const at = (value: number, category: number): Point => ({
      x: bandCenter(category, categoryCount, frame.width),
      y: scaleY(value, scale, frame),
    });
    const top = tops.map(at);
    const base = bases.map(at);
    const outline = [...top, ...[...base].reverse()]
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${fmt(point.x)} ${fmt(point.y)}`)
      .join('');
    if (stacked) floor = tops;
    return { series: seriesIndex, values, top, base, path: `${outline}Z`, line: linePath(top) };
  });
}

export interface PieEntry {
  /** The category index, or -1 for the folded "other" slice. */
  readonly index: number;
  readonly value: number;
}

/**
 * The positive values a pie can show, at most `max` slices: past that the
 * smallest fold into one trailing "other" slice (index -1), because a ninth
 * hue is never distinguishable from the eighth. Zero and negative values are
 * not a share of anything and are left out.
 */
export function pieEntries(values: readonly number[], max: number): PieEntry[] {
  const positive = values
    .map((value, index) => ({ index, value }))
    .filter((entry) => entry.value > 0);
  if (positive.length <= max) return positive;
  const kept = new Set(
    [...positive]
      .sort((left, right) => right.value - left.value || left.index - right.index)
      .slice(0, max - 1)
      .map((entry) => entry.index),
  );
  const other = positive
    .filter((entry) => !kept.has(entry.index))
    .reduce((sum, entry) => sum + entry.value, 0);
  return [...positive.filter((entry) => kept.has(entry.index)), { index: -1, value: other }];
}

/** The point at `angle` on a circle: degrees clockwise from twelve o'clock. */
export function polar(cx: number, cy: number, radius: number, angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) };
}

function at(point: Point): string {
  return `${fmt(point.x)} ${fmt(point.y)}`;
}

export interface Circle {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  /** Zero for a pie; the hole's radius for a donut. */
  readonly innerRadius: number;
}

/** One slice (a wedge, or a ring segment when `innerRadius > 0`) from `start` to `end`. */
export function arcPath(circle: Circle, start: number, end: number): string {
  const { cx, cy, radius, innerRadius } = circle;
  const r = fmt(radius);
  const ir = fmt(innerRadius);
  if (end - start >= 360 - 1e-9) {
    /* A whole circle is two half arcs: one arc cannot start and end at the same point. */
    const outer = `M${at(polar(cx, cy, radius, 0))}A${r} ${r} 0 1 1 ${at(polar(cx, cy, radius, 180))}A${r} ${r} 0 1 1 ${at(polar(cx, cy, radius, 0))}Z`;
    if (innerRadius <= 0) return outer;
    /* The hole winds the other way, so the default fill rule leaves it empty. */
    return `${outer}M${at(polar(cx, cy, innerRadius, 0))}A${ir} ${ir} 0 1 0 ${at(polar(cx, cy, innerRadius, 180))}A${ir} ${ir} 0 1 0 ${at(polar(cx, cy, innerRadius, 0))}Z`;
  }
  const large = end - start > 180 ? 1 : 0;
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, end);
  if (innerRadius <= 0) {
    return `M${fmt(cx)} ${fmt(cy)}L${at(from)}A${r} ${r} 0 ${String(large)} 1 ${at(to)}Z`;
  }
  return `M${at(from)}A${r} ${r} 0 ${String(large)} 1 ${at(to)}L${at(polar(cx, cy, innerRadius, end))}A${ir} ${ir} 0 ${String(large)} 0 ${at(polar(cx, cy, innerRadius, start))}Z`;
}

export interface PieSlice extends PieEntry {
  readonly fraction: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly path: string;
}

/** The slices of a pie or donut, clockwise from twelve o'clock, closing exactly at 360°. */
export function pieSlices(entries: readonly PieEntry[], circle: Circle): PieSlice[] {
  const total = entries.reduce((sum, entry) => sum + Math.max(entry.value, 0), 0);
  if (total <= 0) return [];
  let angle = 0;
  const drawn = entries.filter((entry) => entry.value > 0);
  return drawn.map((entry, position) => {
    const fraction = entry.value / total;
    const startAngle = angle;
    const endAngle = position === drawn.length - 1 ? 360 : angle + fraction * 360;
    angle = endAngle;
    return {
      ...entry,
      fraction,
      startAngle,
      endAngle,
      path: arcPath(circle, startAngle, endAngle),
    };
  });
}
