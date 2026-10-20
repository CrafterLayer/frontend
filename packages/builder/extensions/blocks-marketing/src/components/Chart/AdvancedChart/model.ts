import { formatValue } from '../chart-format';
import { fmt } from '../chart-geometry';
import { VIEW_HEIGHTS } from '../chart-model';
import type { ChartProps } from '../schema';

export interface Mark {
  readonly path: string;
  readonly category: number;
  readonly series: number;
  readonly detail: string;
  readonly tone: number;
  readonly fill?: boolean;
  readonly stroke?: number;
  readonly opacity?: number;
  readonly dash?: boolean;
  readonly kind: string;
}

export interface Label {
  readonly x: number;
  readonly y: number;
  readonly index: number;
  readonly width: number;
}

export interface Tick {
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly axis: 'x' | 'y';
}

export interface AdvancedModel {
  readonly width: number;
  readonly height: number;
  readonly marks: Mark[];
  readonly categories: Label[];
  readonly rows: Label[];
  readonly ticks: Tick[];
  readonly grid: string[];
  readonly values: { readonly x: number; readonly y: number; readonly value: number }[];
}

export interface Scale {
  readonly at: (value: number) => number;
  readonly values: readonly number[];
}

/** Axis/value labels stay short even when the finite source magnitude is far outside business units. */
export function compactNumber(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1e15 || (magnitude > 0 && magnitude < 0.01)) {
    const digits = magnitude.toExponential(2);
    return value < 0 ? `⁦−${digits}⁩` : digits;
  }
  return formatValue(value, {}, 'compact');
}

/** Normalize first so finite very large or very small input never overflows a plotting interval. */
export function scale(values: readonly number[], from: number, to: number, zero = false): Scale {
  const factor = Math.max(...values.map(Math.abs)) || 1;
  const normalized = values.map((value) => value / factor);
  let low = Math.min(...normalized, ...(zero ? [0] : []));
  let high = Math.max(...normalized, ...(zero ? [0] : []));
  if (low === high) {
    if (low > 0) low = 0;
    else if (high < 0) high = 0;
    else high = 1;
  }
  const span = high - low;
  return {
    at: (value) => from + ((value / factor - low) / span) * (to - from),
    values: Array.from({ length: 5 }, (_, index) => (low + (span * index) / 4) * factor),
  };
}

export function rectangle(x: number, y: number, width: number, height: number): string {
  return `M${fmt(x)} ${fmt(y)}h${fmt(width)}v${fmt(height)}h${fmt(-width)}Z`;
}

export function segment(x1: number, y1: number, x2: number, y2: number): string {
  return `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;
}

export function baseModel(props: ChartProps, height = VIEW_HEIGHTS[props.height]): AdvancedModel {
  return {
    width: 640,
    height,
    marks: [],
    categories: [],
    rows: [],
    ticks: [],
    grid: [],
    values: [],
  };
}

export function details(
  props: ChartProps,
  values: readonly number[],
  roles?: readonly string[],
): string {
  return values
    .map(
      (value, index) =>
        `${roles?.[index] === undefined ? '' : `${roles[index]}: `}${formatValue(value, {
          prefix: props.valuePrefix,
          suffix: props.valueSuffix,
        })}`,
    )
    .join(' · ');
}

export function verticalAxis(model: AdvancedModel, axis: Scale): void {
  for (const value of axis.values) {
    const y = axis.at(value);
    model.ticks.push({ x: 58, y, value, axis: 'y' });
    model.grid.push(segment(72, y, 616, y));
  }
}

export function horizontalAxis(model: AdvancedModel, axis: Scale, bottom: number, top = 20): void {
  for (const value of axis.values) {
    const x = axis.at(value);
    model.ticks.push({ x, y: bottom + 12, value, axis: 'x' });
    model.grid.push(segment(x, top, x, bottom));
  }
}

export function categoryBands(model: AdvancedModel, count: number): number[] {
  const band = 544 / count;
  return Array.from({ length: count }, (_, index) => {
    const x = 72 + (index + 0.5) * band;
    model.categories.push({ x, y: model.height - 26, index, width: band - 4 });
    return x;
  });
}
