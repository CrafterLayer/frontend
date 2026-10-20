import { numericCategory } from '../advanced-contract';
import { formatValue } from '../chart-format';
import type { ChartProps } from '../schema';
import {
  baseModel,
  details,
  horizontalAxis,
  rectangle,
  scale,
  segment,
  verticalAxis,
  type AdvancedModel,
} from './model';

export function heatmapModel(props: ChartProps): AdvancedModel {
  const model = baseModel(props, Math.max(192, props.series.length * 42 + 48));
  const count = props.categories.length;
  const band = 496 / count;
  const rowHeight = (model.height - 48) / props.series.length;
  const values = props.series.flatMap((entry) => entry.values);
  const intensity = scale(values, 0.15, 1);
  props.categories.forEach((_, index) =>
    model.categories.push({
      index,
      x: 120 + (index + 0.5) * band,
      y: model.height - 24,
      width: band - 4,
    }),
  );
  props.series.forEach((entry, series) => {
    const y = series * rowHeight + 8;
    model.rows.push({ index: series, x: 54, y: y + rowHeight / 2, width: 104 });
    entry.values.forEach((value, category) => {
      const x = 120 + category * band;
      model.marks.push({
        category,
        series,
        tone: 0,
        detail: details(props, [value]),
        fill: true,
        opacity: intensity.at(value),
        kind: 'cell',
        path: rectangle(x + 1, y + 1, band - 2, rowHeight - 2),
      });
      model.values.push({ x: x + band / 2, y: y + rowHeight / 2, value });
    });
  });
  return model;
}

interface Tile {
  readonly index: number;
  readonly weight: number;
}

/** Stable binary area partition: flat weights only; no implicit hierarchy or data reordering. */
function tiles(
  model: AdvancedModel,
  props: ChartProps,
  entries: readonly Tile[],
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const first = entries[0];
  if (first === undefined) return;
  if (entries.length === 1) {
    model.marks.push({
      category: first.index,
      series: 0,
      tone: first.index % 6,
      detail: details(props, [props.series[0]?.values[first.index] ?? 0]),
      fill: true,
      kind: 'tile',
      path: rectangle(x, y, width, height),
      stroke: 2,
    });
    return;
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let weight = 0;
  let split = 0;
  while (split < entries.length - 1 && weight < total / 2) {
    weight += entries[split]?.weight ?? 0;
    split += 1;
  }
  const fraction = weight / total;
  if (width >= height) {
    tiles(model, props, entries.slice(0, split), x, y, width * fraction, height);
    tiles(
      model,
      props,
      entries.slice(split),
      x + width * fraction,
      y,
      width * (1 - fraction),
      height,
    );
  } else {
    tiles(model, props, entries.slice(0, split), x, y, width, height * fraction);
    tiles(
      model,
      props,
      entries.slice(split),
      x,
      y + height * fraction,
      width,
      height * (1 - fraction),
    );
  }
}

export function treemapModel(props: ChartProps): AdvancedModel {
  const model = baseModel(props);
  const values = props.series[0]?.values ?? [];
  const maximum = Math.max(...values);
  const entries = values
    .map((value, index) => ({ index, weight: value / maximum }))
    .filter((entry) => entry.weight > 0);
  tiles(model, props, entries, 8, 8, 624, model.height - 16);
  return model;
}

export function bubbleModel(props: ChartProps): AdvancedModel {
  const model = baseModel(props);
  const xs = props.categories.map((category) => numericCategory(category) ?? 0);
  const ys = props.series[0]?.values ?? [];
  const sizes = props.series[1]?.values ?? [];
  const xAxis = scale(xs, 96, 592);
  const yAxis = scale(ys, model.height - 68, 36);
  verticalAxis(model, yAxis);
  horizontalAxis(model, xAxis, model.height - 48);
  const maximum = Math.max(...sizes, 0);
  xs.forEach((value, category) => {
    const y = ys[category] ?? 0;
    const size = sizes[category] ?? 0;
    const radius = maximum === 0 ? 0 : Math.sqrt(size / maximum) * 20;
    const x = xAxis.at(value);
    const cy = yAxis.at(y);
    model.categories.push({ index: category, x, y: cy + 24, width: 64 });
    model.marks.push({
      category,
      series: 0,
      tone: 0,
      kind: 'bubble',
      stroke: radius * 2,
      opacity: 0.55,
      path: segment(x, cy, x + 0.01, cy),
      detail: `X: ${formatValue(value)} · ${details(props, [y], ['Y'])} · Size: ${formatValue(size)}`,
    });
    model.values.push({ x, y: cy - 28, value: y });
  });
  return model;
}
