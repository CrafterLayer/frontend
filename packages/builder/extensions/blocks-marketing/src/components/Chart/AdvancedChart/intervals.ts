import type { ChartProps } from '../schema';
import {
  baseModel,
  categoryBands,
  details,
  horizontalAxis,
  rectangle,
  scale,
  segment,
  verticalAxis,
  type AdvancedModel,
} from './model';

export function intervalModel(props: ChartProps): AdvancedModel {
  const model = baseModel(props);
  const values = props.series.map((entry) => entry.values);
  const first = values[0] ?? [];
  const count = props.categories.length;
  const centers = categoryBands(model, count);
  const width = Math.min(48, (544 / count) * 0.6);
  const cumulative = [0];
  if (props.chartType === 'waterfall') {
    for (const value of first) cumulative.push((cumulative.at(-1) ?? 0) + value);
  }
  const axis = scale(
    props.chartType === 'waterfall' ? cumulative : values.flat(),
    model.height - 48,
    20,
    ['waterfall', 'histogram', 'lollipop'].includes(props.chartType),
  );
  verticalAxis(model, axis);
  centers.forEach((x, category) => {
    const column = values.map((entry) => entry[category] ?? 0);
    const value = first[category] ?? 0;
    if (props.chartType === 'boxplot') {
      const [min = 0, q1 = 0, median = 0, q3 = 0, max = 0] = column;
      const detail = details(props, column, ['Min', 'Q1', 'Median', 'Q3', 'Max']);
      model.marks.push(
        {
          category,
          series: 0,
          tone: 0,
          detail,
          stroke: 1.5,
          kind: 'whisker',
          path: `${segment(x, axis.at(min), x, axis.at(max))}${segment(x - width / 3, axis.at(min), x + width / 3, axis.at(min))}${segment(x - width / 3, axis.at(max), x + width / 3, axis.at(max))}`,
        },
        {
          category,
          series: 0,
          tone: 0,
          detail,
          fill: true,
          opacity: 0.3,
          stroke: 1.5,
          kind: 'box',
          path: rectangle(x - width / 2, axis.at(q3), width, axis.at(q1) - axis.at(q3)),
        },
        {
          category,
          series: 2,
          tone: 3,
          detail,
          stroke: 3,
          kind: 'median',
          path: segment(x - width / 2, axis.at(median), x + width / 2, axis.at(median)),
        },
      );
      model.values.push({ x, y: axis.at(max) - 10, value: median });
    } else if (props.chartType === 'candlestick') {
      const [open = 0, high = 0, low = 0, close = 0] = column;
      const detail = details(props, column, ['Open', 'High', 'Low', 'Close']);
      const tone = close >= open ? 0 : 1;
      model.marks.push(
        {
          category,
          series: 0,
          tone,
          detail,
          stroke: 1.5,
          kind: 'wick',
          path: segment(x, axis.at(low), x, axis.at(high)),
        },
        {
          category,
          series: 0,
          tone,
          detail,
          fill: close < open,
          stroke: 2,
          kind: 'candle',
          path:
            close === open
              ? segment(x - width / 2, axis.at(open), x + width / 2, axis.at(open))
              : rectangle(
                  x - width / 2,
                  Math.min(axis.at(open), axis.at(close)),
                  width,
                  Math.abs(axis.at(open) - axis.at(close)),
                ),
        },
      );
      model.values.push({ x, y: axis.at(high) - 10, value: close });
    } else if (props.chartType === 'lollipop') {
      column.forEach((number, series) => {
        const offset = (series - (values.length - 1) / 2) * Math.min(10, width / values.length);
        const detail = details(props, [number]);
        model.marks.push(
          {
            category,
            series,
            tone: series,
            detail,
            stroke: 2,
            kind: 'stem',
            path: segment(x + offset, axis.at(0), x + offset, axis.at(number)),
          },
          {
            category,
            series,
            tone: series,
            detail,
            stroke: 9,
            kind: 'dot',
            path: segment(x + offset, axis.at(number), x + offset + 0.01, axis.at(number)),
          },
        );
      });
      model.values.push({ x, y: axis.at(value) - 10, value });
    } else {
      const from = props.chartType === 'waterfall' ? (cumulative[category] ?? 0) : 0;
      const to = props.chartType === 'waterfall' ? (cumulative[category + 1] ?? 0) : value;
      const barWidth = props.chartType === 'histogram' ? 544 / count - 1 : width;
      model.marks.push({
        category,
        series: 0,
        tone: props.chartType === 'waterfall' && value < 0 ? 1 : 0,
        detail:
          props.chartType === 'waterfall'
            ? details(props, [value, to], ['Change', 'Running total'])
            : details(
                { ...props, valuePrefix: undefined, valueSuffix: undefined },
                [value],
                ['Count'],
              ),
        fill: true,
        ...(value === 0 ? { stroke: 1 } : {}),
        kind: props.chartType,
        path: rectangle(
          x - barWidth / 2,
          Math.min(axis.at(from), axis.at(to)),
          barWidth,
          Math.abs(axis.at(from) - axis.at(to)),
        ),
      });
      if (props.chartType === 'waterfall' && category < count - 1) {
        model.marks.push({
          category,
          series: 0,
          tone: 3,
          detail: '',
          stroke: 1,
          dash: true,
          kind: 'connector',
          path: segment(
            x + width / 2,
            axis.at(to),
            (centers[category + 1] ?? x) - width / 2,
            axis.at(to),
          ),
        });
      }
      model.values.push({ x, y: Math.min(axis.at(from), axis.at(to)) - 10, value });
    }
  });
  return model;
}

export function bulletModel(props: ChartProps): AdvancedModel {
  const count = props.categories.length;
  const model = baseModel(props, Math.max(192, count * 38 + 40));
  const values = props.series.map((entry) => entry.values);
  const actual = values[0] ?? [];
  const target = values[1] ?? [];
  const axis = scale([0, props.maxValue ?? Math.max(...values.flat(), 1)], 160, 616, true);
  const band = (model.height - 40) / count;
  horizontalAxis(model, axis, model.height - 32, 8);
  actual.forEach((value, category) => {
    const y = (category + 0.5) * band;
    const goal = target[category] ?? 0;
    const detail = details(props, [value, goal], ['Actual', 'Target']);
    model.categories.push({ index: category, x: 70, y, width: 132 });
    model.marks.push(
      {
        category,
        series: 0,
        tone: 3,
        detail: '',
        fill: true,
        opacity: 0.08,
        kind: 'track',
        path: rectangle(160, y - 12, 456, 24),
      },
      {
        category,
        series: 0,
        tone: 0,
        detail,
        fill: true,
        kind: 'actual',
        path: rectangle(160, y - 7, axis.at(value) - 160, 14),
      },
      {
        category,
        series: 1,
        tone: 3,
        detail,
        stroke: 3,
        kind: 'target',
        path: segment(axis.at(goal), y - 15, axis.at(goal), y + 15),
      },
    );
    model.values.push({ x: Math.max(174, axis.at(value) - 16), y: y - 20, value });
  });
  return model;
}
