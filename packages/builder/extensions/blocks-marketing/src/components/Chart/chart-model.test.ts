import { describe, expect, it } from 'vitest';

import {
  cartesianModel,
  hasChartData,
  pieModel,
  valueGrid,
  VIEW_HEIGHTS,
  VIEW_WIDTH,
} from './chart-model';
import { CHART_TONES, MAX_PIE_SLICES, groundStroke, isTranslucent, toneOf } from './chart-palette';
import { chartSchema, type ChartProps } from './schema';

function props(overrides: Record<string, unknown> = {}): ChartProps {
  return chartSchema.props.parse(overrides);
}

describe('the cartesian model', () => {
  it('lays ticks out from the top in percent and sizes the axis to its longest label', () => {
    const model = cartesianModel(props({ valuePrefix: '$' }));
    expect(model.width).toBe(VIEW_WIDTH);
    expect(model.height).toBe(VIEW_HEIGHTS.md);
    expect(model.ticks.map((tick) => tick.label)).toEqual([
      '$0',
      '$20',
      '$40',
      '$60',
      '$80',
      '$100',
    ]);
    expect(model.ticks[0]?.top).toBeGreaterThan(model.ticks.at(-1)?.top ?? 100);
    expect(model.axisWidth).toBe('$100'.length + 1);
    expect(model.zeroY).toBeCloseTo(model.ticks[0]?.y ?? 0);
  });

  it('draws grouped bars by default and stacked totals when stacked', () => {
    const grouped = cartesianModel(props({ showValues: true }));
    expect(grouped.kind).toBe('bar');
    expect(grouped.bars).toHaveLength(8);
    expect(grouped.labels.map((label) => label.text).slice(0, 2)).toEqual(['42', '30']);
    const stacked = cartesianModel(props({ stacked: true, showValues: true }));
    expect(stacked.labels.map((label) => label.text)).toEqual(['72', '92', '105', '126']);
    expect(stacked.labels.every((label) => !label.below)).toBe(true);
  });

  it('hangs labels below negative bars and below an all-negative stack', () => {
    const grouped = cartesianModel(
      props({
        categories: ['A', 'B'],
        series: [{ name: 'Net', values: [12, -8] }],
        showValues: true,
      }),
    );
    expect(grouped.labels.map((label) => [label.text, label.below])).toEqual([
      ['12', false],
      ['⁦−8⁩', true],
    ]);
    const stacked = cartesianModel(
      props({
        categories: ['A'],
        series: [
          { name: 'One', values: [-4] },
          { name: 'Two', values: [-6] },
        ],
        stacked: true,
        showValues: true,
      }),
    );
    expect(stacked.labels).toHaveLength(1);
    expect(stacked.labels[0]).toMatchObject({ below: true });
  });

  it('starts a line axis near its data rather than at zero', () => {
    const model = cartesianModel(
      props({
        chartType: 'line',
        categories: ['A', 'B'],
        series: [{ name: 'Rate', values: [62, 78] }],
      }),
    );
    expect(model.scale.min).toBeGreaterThan(0);
    expect(model.zeroY).toBeUndefined();
    expect(model.lines).toHaveLength(1);
    expect(model.markers).toHaveLength(2);
    expect(model.bars).toEqual([]);
  });

  it('fills areas, drawing points only for a single category', () => {
    const area = cartesianModel(props({ chartType: 'area', stacked: true, showValues: true }));
    expect(area.areas).toHaveLength(2);
    expect(area.lines).toHaveLength(2);
    expect(area.markers).toEqual([]);
    /* Values are labelled with what each point shows, not the stacked total. */
    expect(area.labels.map((label) => label.text)).toContain('30');
    const single = cartesianModel(
      props({ chartType: 'area', categories: ['Only'], series: [{ name: 'A', values: [3] }] }),
    );
    expect(single.markers).toHaveLength(1);
  });

  it('keeps value labels to the last category once there are too many to read', () => {
    const categories = Array.from({ length: 12 }, (_, index) => `C${String(index)}`);
    const series = Array.from({ length: 4 }, (_, index) => ({
      name: `S${String(index)}`,
      values: categories.map((_, at) => at + index + 1),
    }));
    const model = cartesianModel(props({ categories, series, showValues: true }));
    expect(model.labels).toHaveLength(4);
    expect(model.labels.every((label) => label.key.endsWith('-11'))).toBe(true);
  });

  it('leaves room below the plot only for labels under negative bars', () => {
    const plain = cartesianModel(props());
    const negative = cartesianModel(
      props({ categories: ['A'], series: [{ name: 'N', values: [-5] }], showValues: true }),
    );
    /* The lowest tick of each sits at the bottom of its frame: 4 units up, or 24 with room for labels. */
    expect((plain.ticks[0]?.y ?? 0) - (negative.ticks[0]?.y ?? 0)).toBeCloseTo(20);
  });
});

describe('the pie model', () => {
  it('slices the first series and adds up its total', () => {
    const model = pieModel(props({ chartType: 'donut' }));
    expect(model.innerRadius).toBeGreaterThan(0);
    expect(model.slices.map((slice) => slice.index)).toEqual([0, 1, 2, 3]);
    expect(model.total).toBe(42 + 58 + 64 + 81);
    expect(pieModel(props({ chartType: 'pie' })).innerRadius).toBe(0);
  });

  it('folds more than eight positive values into a trailing "other" slice', () => {
    const categories = Array.from({ length: 10 }, (_, index) => `C${String(index)}`);
    const model = pieModel(
      props({
        chartType: 'pie',
        categories,
        series: [{ name: 'S', values: categories.map((_, at) => at + 1) }],
      }),
    );
    expect(model.slices).toHaveLength(MAX_PIE_SLICES);
    expect(model.slices.at(-1)?.index).toBe(-1);
  });

  it('has nothing to slice without a series', () => {
    expect(pieModel(props({ chartType: 'pie', series: [] })).slices).toEqual([]);
  });
});

describe('chart data', () => {
  it('cuts values to the categories', () => {
    expect(
      valueGrid(props({ categories: ['A'], series: [{ name: 'S', values: [1, 2] }] })),
    ).toEqual([[1]]);
  });

  it('knows when there is nothing to draw', () => {
    expect(hasChartData(props())).toBe(true);
    expect(hasChartData(props({ categories: [] }))).toBe(false);
    expect(hasChartData(props({ series: [] }))).toBe(false);
    expect(hasChartData(props({ series: [{ name: 'Empty', values: [] }] }))).toBe(false);
    expect(
      hasChartData(props({ chartType: 'pie', series: [{ name: 'S', values: [0, -2] }] })),
    ).toBe(false);
    expect(hasChartData(props({ chartType: 'donut' }))).toBe(true);
  });
});

describe('the palette', () => {
  it('gives every scheme eight token-bound tones, never a literal colour', () => {
    for (const tones of Object.values(CHART_TONES)) {
      expect(tones).toHaveLength(MAX_PIE_SLICES);
      for (const tone of tones) {
        expect(tone.fill).toMatch(/^fill-(accent|success|text-muted|current)(\/\d+)?$/u);
        expect(tone.stroke).toBe(tone.fill.replace('fill-', 'stroke-'));
        expect(tone.swatch).toBe(tone.fill.replace('fill-', 'bg-'));
      }
      /* Adjacent slots never repeat. */
      tones.slice(1).forEach((tone, index) => {
        expect(tone).not.toBe(tones[index]);
      });
    }
  });

  it('lays the surface under translucent theme hues but not under steps of the ink', () => {
    expect(isTranslucent(CHART_TONES.accent[2]!)).toBe(true);
    expect(isTranslucent(CHART_TONES.accent[0]!)).toBe(false);
    expect(isTranslucent(CHART_TONES.mono[2]!)).toBe(false);
    expect(CHART_TONES.mono[2]?.fill).toBe('fill-current/50');
  });

  it('clamps a slot past either end and rings marks with the ground', () => {
    expect(toneOf('mixed', 99)).toBe(CHART_TONES.mixed.at(-1));
    expect(toneOf('mixed', -1)).toBe(CHART_TONES.mixed[0]);
    expect(groundStroke('card', 'dark')).toBe('stroke-surface');
    expect(groundStroke('plain', 'dark')).toBe('stroke-surface-inverse');
    expect(groundStroke('plain', 'light')).toBe('stroke-surface');
  });
});
