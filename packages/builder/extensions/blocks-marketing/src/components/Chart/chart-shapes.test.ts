import { describe, expect, it } from 'vitest';

import { drawnType, hasSeriesLegend, swatchShape } from './chart-kind';
import { cartesianModel, hasChartData } from './chart-model';
import { gaugeEnds, gaugeModel, radarModel } from './chart-polar';
import { ROW_BAND, funnelModel, hbarModel, rowBarPath } from './chart-rows';
import { categoryNumber, scatterModel } from './chart-scatter';
import { sparkRows } from './chart-spark';
import { chartSchema } from './schema';

const props = (overrides: Record<string, unknown>) => chartSchema.props.parse(overrides);

describe('chart kinds', () => {
  it('draws a radar outside three to twelve categories as bars', () => {
    expect(drawnType({ chartType: 'radar', categories: ['a', 'b'] })).toBe('bar');
    expect(drawnType({ chartType: 'radar', categories: ['a', 'b', 'c'] })).toBe('radar');
    expect(drawnType({ chartType: 'radar', categories: Array.from({ length: 13 }, String) })).toBe(
      'bar',
    );
    expect(drawnType({ chartType: 'gauge', categories: [] })).toBe('gauge');
  });

  it('keeps the series legend for the multi-series kinds only', () => {
    const two = props({});
    expect(hasSeriesLegend('combo', two)).toBe(true);
    for (const kind of ['funnel', 'gauge', 'pie', 'sparkline'] as const) {
      expect(hasSeriesLegend(kind, two)).toBe(false);
    }
    expect(swatchShape('combo', 0)).toBe('size-3 rounded-sm');
    expect(swatchShape('combo', 1)).toBe('h-0.5 w-4 rounded-full');
    expect(swatchShape('scatter', 0)).toBe('size-3 rounded-full');
  });

  it('knows when there is nothing to draw', () => {
    expect(
      hasChartData(props({ chartType: 'funnel', series: [{ name: 'S', values: [0, 0] }] })),
    ).toBe(false);
    expect(hasChartData(props({ chartType: 'gauge', series: [{ name: 'S', values: [0] }] }))).toBe(
      true,
    );
    expect(hasChartData(props({ chartType: 'gauge', series: [] }))).toBe(false);
  });
});

describe('row charts', () => {
  it('rounds a horizontal bar at its data end only', () => {
    expect(rowBarPath(0, 0, 50, 20, 3, 'end')).toBe('M0 0H47A3 3 0 0 1 50 3V17A3 3 0 0 1 47 20H0Z');
    expect(rowBarPath(10, 0, 50, 20, 3, 'start')).toBe(
      'M60 0V20H13A3 3 0 0 1 10 17V3A3 3 0 0 1 13 0Z',
    );
    expect(rowBarPath(0, 0, 50, 20, 3, 'none')).toBe('M0 0h50v20h-50Z');
  });

  it('turns a vertical bar chart on its side: bands down, values across', () => {
    const model = hbarModel(
      props({ categories: ['A', 'B'], series: [{ name: 'S', values: [50, -25] }] }),
    );
    expect(model.height).toBe(2 * ROW_BAND);
    const [positive, negative] = model.bars;
    expect(positive?.end).toBe('end');
    expect(negative?.end).toBe('start');
    /* Both grow from the zero line. */
    expect(positive?.x).toBeCloseTo(model.zeroX ?? Number.NaN);
    expect((negative?.x ?? 0) + (negative?.width ?? 0)).toBeCloseTo(model.zeroX ?? Number.NaN);
    expect((positive?.y ?? 0) + (positive?.height ?? 0) / 2).toBeCloseTo(ROW_BAND / 2);
    expect(model.ticks.map((tick) => tick.value)).toEqual([-40, -20, 0, 20, 40, 60]);
    expect(model.ticks[0]?.start).toBeLessThan(model.ticks[1]?.start ?? 0);
  });

  it('labels a negative bar before its end and leaves room for the labels', () => {
    const model = hbarModel(
      props({
        categories: ['A', 'B'],
        series: [{ name: 'S', values: [50, -25] }],
        showValues: true,
      }),
    );
    expect(model.labels.map((label) => [label.digits, label.negative])).toEqual([
      ['50', false],
      ['⁦−25⁩', true],
    ]);
    expect(model.ticks.at(-1)?.start).toBeLessThan(90);
  });

  it('centres funnel stages, widest first, each a share of the first', () => {
    const model = funnelModel(
      props({ categories: ['A', 'B', 'C'], series: [{ name: 'S', values: [200, 100, 0] }] }),
    );
    expect(model.stages.map((stage) => stage.share)).toEqual([1, 0.5, 0]);
    expect(model.stages[2]?.path).toBe('');
    expect(model.necks).toHaveLength(1);
    expect(model.stages[0]?.path.startsWith('M7 ')).toBe(true);
  });
});

describe('polar charts', () => {
  it('rings a radar at nice values up to the maximum it is given', () => {
    const model = radarModel(
      props({
        categories: ['A', 'B', 'C', 'D'],
        series: [{ name: 'S', values: [4, 8, -2] }],
        maxValue: 10,
      }),
    );
    expect(model.scale.max).toBe(10);
    expect(model.rings.map((ring) => ring.value)).toEqual([2.5, 5, 7.5, 10]);
    const points = model.shapes[0]?.points ?? [];
    /* A negative or missing value sits at the centre. */
    expect(points[2]).toMatchObject({ x: model.center, y: model.center, value: -2 });
    expect(points[3]).toMatchObject({ x: model.center, y: model.center, value: 0 });
    expect(model.labels.map((label) => label.anchor)).toEqual(['middle', 'start', 'middle', 'end']);
    expect(model.labels.map((label) => label.side)).toEqual(['top', 'middle', 'bottom', 'middle']);
  });

  it('fills a gauge to its share of the maximum and clamps beyond it', () => {
    const model = gaugeModel(
      props({
        chartType: 'gauge',
        categories: ['Low', 'Over', 'Empty'],
        series: [{ name: 'S', values: [25, 150] }],
        maxValue: 100,
        targetValue: 50,
      }),
    );
    expect(model.dials.map((dial) => dial.ratio)).toEqual([0.25, 1, 0]);
    expect(model.dials[2]?.arc).toBe('');
    expect(model.track).toBe('M18 102A82 82 0 0 1 182 102');
    /* The target at half way crosses the top of the dial. */
    expect(model.target?.path).toBe('M100 36L100 4');
    expect(gaugeEnds(props({ series: [{ name: 'S', values: [37] }] })).max).toBe(40);
  });
});

describe('scatter and sparklines', () => {
  it('reads a category as a number only when it is one', () => {
    expect(categoryNumber('1,200')).toBe(1200);
    expect(categoryNumber('$40')).toBe(40);
    expect(categoryNumber('١٢٫٥')).toBe(12.5);
    expect(categoryNumber('12 kg')).toBe(12);
    expect(categoryNumber('Q1')).toBeUndefined();
    expect(categoryNumber(undefined)).toBeUndefined();
  });

  it('spaces scatter points by their x value', () => {
    const model = scatterModel(
      props({
        chartType: 'scatter',
        categories: ['0', '10', '100'],
        series: [{ name: 'S', values: [1, 2, 3] }],
      }),
    );
    const xs = model.markers.map((marker) => marker.x);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeLessThan(((xs[2] ?? 0) - (xs[1] ?? 0)) / 5);
    expect(model.xTicks?.map((tick) => tick.digits)).toEqual(['0', '20', '40', '60', '80', '100']);
  });

  it('scales each sparkline to its own range and ends it with a dot', () => {
    const [row, flat] = sparkRows(
      props({
        categories: ['a', 'b', 'c'],
        series: [
          { name: 'Up', values: [1, 2, 3] },
          { name: 'Flat', values: [5, 5, 5] },
        ],
      }),
    );
    expect(row?.line).toBe('M4 36L100 20L196 4');
    expect(row?.end).toEqual({ x: 196, y: 4 });
    expect(row?.last).toBe(3);
    expect(flat?.line).toBe('M4 20L100 20L196 20');
  });

  it('draws a combo’s lines from its second series with their own slots', () => {
    const model = cartesianModel(props({ chartType: 'combo', showValues: true }));
    expect(model.kind).toBe('combo');
    expect(new Set(model.bars.map((bar) => bar.series))).toEqual(new Set([0]));
    expect(model.lines.map((line) => line.series)).toEqual([1]);
    expect(model.labels).toHaveLength(8);
  });
});
