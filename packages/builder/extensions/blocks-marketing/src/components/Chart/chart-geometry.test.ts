import { describe, expect, it } from 'vitest';

import {
  arcPath,
  areaLayers,
  bandCenter,
  barMarks,
  barPath,
  baselineOf,
  fmt,
  linePath,
  linePoints,
  niceScale,
  niceStep,
  pieEntries,
  pieSlices,
  polar,
  scaleY,
  valueExtent,
  type PlotFrame,
} from './chart-geometry';
import { formatShare, formatValue } from './chart-format';

const FRAME: PlotFrame = { width: 400, height: 220, top: 10, bottom: 10 };
const BARS = { stacked: false, maxWidth: 28, gap: 2, radius: 4 } as const;

describe('nice ticks', () => {
  it.each([
    [0, 81, [0, 20, 40, 60, 80, 100]],
    [0, 100, [0, 20, 40, 60, 80, 100]],
    [-30, 45, [-40, -20, 0, 20, 40, 60]],
    [0.1, 0.9, [0, 0.2, 0.4, 0.6, 0.8, 1]],
    [0, 7, [0, 2, 4, 6, 8]],
    [1200, 31600, [0, 10000, 20000, 30000, 40000]],
  ])('cuts [%d, %d] into round steps', (low, high, ticks) => {
    const scale = niceScale(low, high);
    expect(scale.ticks).toEqual(ticks);
    expect(scale.min).toBe(ticks[0]);
    expect(scale.max).toBe(ticks.at(-1));
    expect(scale.min).toBeLessThanOrEqual(Math.min(low, high));
    expect(scale.max).toBeGreaterThanOrEqual(Math.max(low, high));
  });

  it('prints decimal steps without floating-point noise', () => {
    expect(niceScale(0, 0.6).ticks).toEqual([0, 0.2, 0.4, 0.6]);
    expect(niceScale(0, 0.6, 6).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(niceScale(0.6, 1.4).ticks.every((tick) => String(tick).length <= 4)).toBe(true);
  });

  it('opens a flat range towards zero and gives an empty one a unit axis', () => {
    expect(niceScale(5, 5)).toMatchObject({ min: 0, max: 5 });
    expect(niceScale(-4, -4)).toMatchObject({ min: -4, max: 0 });
    expect(niceScale(0, 0)).toMatchObject({ min: 0, max: 1 });
    expect(niceScale(Number.NaN, 3)).toMatchObject({ min: 0, max: 1 });
  });

  it('accepts its ends in either order and never prints negative zero', () => {
    expect(niceScale(81, 0).ticks).toEqual(niceScale(0, 81).ticks);
    expect(Object.is(niceScale(-0.5, 0).max, -0)).toBe(false);
  });

  it('picks 1, 2, 2.5 or 5 × 10ⁿ steps', () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(12, 5)).toBe(2.5);
    expect(niceStep(45, 5)).toBe(10);
    expect(niceStep(0.8, 4)).toBeCloseTo(0.2);
    expect(niceStep(950, 1)).toBe(1000);
  });
});

describe('value extent', () => {
  const grid = [
    [10, -5, 20],
    [5, 15, -10],
  ];

  it('compares values side by side, ignoring values past the categories', () => {
    expect(valueExtent(grid, 3, { stacked: false })).toEqual({ min: -10, max: 20 });
    expect(valueExtent([[1, 2, 99]], 2, { stacked: false })).toEqual({ min: 1, max: 2 });
  });

  it('sums positives up and negatives down when stacked', () => {
    expect(valueExtent(grid, 3, { stacked: true })).toEqual({ min: -10, max: 20 });
    expect(
      valueExtent(
        [
          [10, 10],
          [5, -20],
        ],
        2,
        { stacked: true },
      ),
    ).toEqual({ min: -20, max: 15 });
  });

  it('drops negatives from a stacked area and reports nothing as zero', () => {
    expect(
      valueExtent(
        [
          [10, -10],
          [5, 5],
        ],
        2,
        { stacked: true, clampNegative: true },
      ),
    ).toEqual({
      min: 0,
      max: 15,
    });
    expect(valueExtent([], 4, { stacked: false })).toEqual({ min: 0, max: 0 });
    expect(valueExtent([[]], 4, { stacked: true })).toEqual({ min: 0, max: 0 });
  });
});

describe('positions', () => {
  const scale = niceScale(0, 100);

  it('maps the scale onto the frame, top to bottom', () => {
    expect(scaleY(100, scale, FRAME)).toBe(10);
    expect(scaleY(0, scale, FRAME)).toBe(210);
    expect(scaleY(50, scale, FRAME)).toBe(110);
    expect(scaleY(3, { min: 0, max: 0, step: 1, ticks: [0] }, FRAME)).toBe(210);
  });

  it('grows bars from zero, or from the nearer end when zero is off the scale', () => {
    expect(baselineOf(scale)).toBe(0);
    expect(baselineOf({ min: 20, max: 60, step: 20, ticks: [20, 40, 60] })).toBe(20);
    expect(baselineOf({ min: -60, max: -20, step: 20, ticks: [-60, -40, -20] })).toBe(-20);
  });

  it('centres categories in equal bands', () => {
    expect(bandCenter(0, 4, 400)).toBe(50);
    expect(bandCenter(3, 4, 400)).toBe(350);
    expect(bandCenter(0, 0, 400)).toBe(200);
  });

  it('prints path numbers to two places', () => {
    expect(fmt(1 / 3)).toBe('0.33');
    expect(fmt(-0.001)).toBe('0');
    expect(fmt(12)).toBe('12');
  });
});

describe('bars', () => {
  const scale = niceScale(-50, 100);

  it('rounds the data end and keeps the baseline square', () => {
    expect(barPath(0, 0, 20, 50, 4, 'top')).toBe('M0 50V4A4 4 0 0 1 4 0H16A4 4 0 0 1 20 4V50Z');
    expect(barPath(0, 0, 20, 50, 4, 'bottom')).toBe('M0 0H20V46A4 4 0 0 1 16 50H4A4 4 0 0 1 0 46Z');
    expect(barPath(0, 0, 20, 50, 4, 'none')).toBe('M0 0h20v50h-20Z');
  });

  it('never rounds past half the width or the full height', () => {
    expect(barPath(0, 0, 4, 50, 8, 'top')).toContain('A2 2');
    expect(barPath(0, 0, 20, 1, 4, 'top')).toContain('A1 1');
    expect(barPath(0, 0, 20, 0, 4, 'top')).toBe('M0 0h20v0h-20Z');
  });

  it('groups one bar per series in each band, capped in width and separated by the gap', () => {
    const marks = barMarks(
      [
        [10, 20],
        [30, 40],
      ],
      2,
      niceScale(0, 40),
      FRAME,
      BARS,
    );
    expect(marks).toHaveLength(4);
    const [first, second] = marks;
    expect(first?.width).toBe(28);
    expect((second?.x ?? 0) - ((first?.x ?? 0) + (first?.width ?? 0))).toBe(2);
    /* The pair is centred on the band. */
    expect(((first?.x ?? 0) + (second?.x ?? 0) + 28) / 2).toBeCloseTo(bandCenter(0, 2, 400));
    expect(marks.every((mark) => mark.end === 'top')).toBe(true);
  });

  it('hangs a negative bar below zero with its rounded end at the bottom', () => {
    const [negative] = barMarks([[-50]], 1, scale, FRAME, BARS);
    const zero = scaleY(0, scale, FRAME);
    expect(negative?.y).toBe(zero);
    expect(negative?.height).toBeCloseTo(scaleY(-50, scale, FRAME) - zero);
    expect(negative?.end).toBe('bottom');
  });

  it('draws nothing for a missing or zero value, an empty grid or no categories', () => {
    expect(
      barMarks([[0, 5], [3]], 2, scale, FRAME, BARS).map((mark) => [mark.series, mark.category]),
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(barMarks([], 3, scale, FRAME, BARS)).toEqual([]);
    expect(barMarks([[1]], 0, scale, FRAME, BARS)).toEqual([]);
  });

  it('narrows bars to fit a crowded band', () => {
    const grid = Array.from({ length: 6 }, () => Array.from({ length: 24 }, () => 5));
    const marks = barMarks(grid, 24, niceScale(0, 5), FRAME, BARS);
    const band = 400 / 24;
    const group = (marks[0]?.width ?? 0) * 6 + 2 * 5;
    expect(group).toBeLessThanOrEqual(band);
  });

  it('stacks segments with a surface gap and rounds only the outermost end on each side', () => {
    const stack = barMarks([[10], [20], [-10], [-5]], 1, scale, FRAME, { ...BARS, stacked: true });
    expect(stack.map((mark) => mark.end)).toEqual(['none', 'top', 'none', 'bottom']);
    const [lower, upper, nearNegative, farNegative] = stack;
    /* The upper segment ends exactly at 30 and leaves the gap above the lower one. */
    expect(upper?.y).toBeCloseTo(scaleY(30, scale, FRAME));
    expect((lower?.y ?? 0) - ((upper?.y ?? 0) + (upper?.height ?? 0))).toBeCloseTo(2);
    expect(lower?.y).toBeCloseTo(scaleY(10, scale, FRAME));
    /* Below zero the gap opens at the top of the outer segment. */
    expect(
      (farNegative?.y ?? 0) - ((nearNegative?.y ?? 0) + (nearNegative?.height ?? 0)),
    ).toBeCloseTo(2);
    expect(stack.every((mark) => mark.width === stack[0]?.width)).toBe(true);
  });

  it('leaves a segment thinner than the gap at its full size', () => {
    const [, thin] = barMarks([[50], [0.5]], 1, niceScale(0, 100), FRAME, {
      ...BARS,
      stacked: true,
    });
    expect(thin?.height).toBeCloseTo(
      scaleY(50, niceScale(0, 100), FRAME) - scaleY(50.5, niceScale(0, 100), FRAME),
    );
  });
});

describe('lines and areas', () => {
  const scale = niceScale(0, 100);

  it('places points at band centres and breaks the line at a missing value', () => {
    const points = linePoints([10, 20, 30], 4, scale, FRAME);
    expect(points[3]).toBeUndefined();
    expect(points[0]).toEqual({ x: 50, y: scaleY(10, scale, FRAME) });
    expect(linePath([{ x: 0, y: 0 }, undefined, { x: 2, y: 2 }, { x: 3, y: 3 }])).toBe(
      'M0 0M2 2L3 3',
    );
    expect(linePath([])).toBe('');
  });

  it('closes an unstacked area on the baseline, counting a missing value as zero', () => {
    const [layer] = areaLayers([[40, 60]], 3, scale, FRAME, false);
    expect(layer?.values).toEqual([40, 60, 0]);
    expect(layer?.base.every((point) => point.y === scaleY(0, scale, FRAME))).toBe(true);
    expect(layer?.path.startsWith('M')).toBe(true);
    expect(layer?.path.endsWith('Z')).toBe(true);
    expect(layer?.line).toBe(linePath(layer?.top ?? []));
  });

  it('stacks each area on the one before and treats negatives as zero', () => {
    const [first, second] = areaLayers(
      [
        [10, 20],
        [5, -5],
      ],
      2,
      scale,
      FRAME,
      true,
    );
    expect(second?.base).toEqual(first?.top);
    expect(second?.top[0]?.y).toBeCloseTo(scaleY(15, scale, FRAME));
    expect(second?.top[1]?.y).toBeCloseTo(scaleY(20, scale, FRAME));
    expect(second?.values).toEqual([5, -5]);
  });

  it('draws no area without categories', () => {
    expect(areaLayers([[1, 2]], 0, scale, FRAME, false)).toEqual([]);
  });
});

describe('pie and donut', () => {
  const circle = { cx: 100, cy: 100, radius: 96, innerRadius: 0 };

  it('leaves out zero and negative values and keeps category indexes', () => {
    expect(pieEntries([5, 0, -3, 2], 8)).toEqual([
      { index: 0, value: 5 },
      { index: 3, value: 2 },
    ]);
  });

  it('folds the smallest slices into one "other" slice past the maximum', () => {
    const entries = pieEntries([9, 1, 8, 2, 7, 3, 6, 4, 5, 0.5], 8);
    expect(entries).toHaveLength(8);
    expect(entries.at(-1)).toEqual({ index: -1, value: 1 + 2 + 0.5 });
    /* The kept slices stay in category order. */
    expect(entries.slice(0, -1).map((entry) => entry.index)).toEqual([0, 2, 4, 5, 6, 7, 8]);
  });

  it("sweeps slices clockwise from twelve o'clock and closes at exactly 360°", () => {
    const slices = pieSlices(pieEntries([35, 30, 18, 12, 5], 8), circle);
    expect(slices[0]?.startAngle).toBe(0);
    expect(slices.at(-1)?.endAngle).toBe(360);
    const swept = slices.reduce((sum, slice) => sum + (slice.endAngle - slice.startAngle), 0);
    expect(swept).toBeCloseTo(360);
    expect(slices.reduce((sum, slice) => sum + slice.fraction, 0)).toBeCloseTo(1);
    for (let index = 1; index < slices.length; index += 1) {
      expect(slices[index]?.startAngle).toBe(slices[index - 1]?.endAngle);
    }
    expect(slices[0]?.fraction).toBeCloseTo(0.35);
  });

  it('draws nothing when nothing is positive', () => {
    expect(pieSlices([], circle)).toEqual([]);
    expect(pieSlices(pieEntries([0, -1], 8), circle)).toEqual([]);
  });

  it('measures angles clockwise from the top', () => {
    const top = polar(100, 100, 50, 0);
    const right = polar(100, 100, 50, 90);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    expect(right.x).toBeCloseTo(150);
    expect(right.y).toBeCloseTo(100);
  });

  it('draws a wedge from the centre, a ring segment with a hole, and flags arcs past 180°', () => {
    expect(arcPath(circle, 0, 90)).toBe('M100 100L100 4A96 96 0 0 1 196 100Z');
    expect(arcPath(circle, 0, 270)).toContain('A96 96 0 1 1');
    const ring = arcPath({ ...circle, innerRadius: 58 }, 0, 90);
    expect(ring).toBe('M100 4A96 96 0 0 1 196 100L158 100A58 58 0 0 0 100 42Z');
  });

  it('draws a single 100% slice as a whole circle, and a whole ring with its hole', () => {
    const [whole] = pieSlices([{ index: 2, value: 7 }], circle);
    expect(whole?.fraction).toBe(1);
    expect(whole?.path).toBe('M100 4A96 96 0 1 1 100 196A96 96 0 1 1 100 4Z');
    const ring = arcPath({ ...circle, innerRadius: 58 }, 0, 360);
    expect(ring).toContain('M100 42A58 58 0 1 0 100 158');
  });
});

describe('value labels', () => {
  it('formats with a prefix or suffix and groups thousands', () => {
    expect(formatValue(1250, { prefix: '$' })).toBe('$1,250');
    expect(formatValue(42, { suffix: '%' })).toBe('42%');
    expect(formatValue(3.14159)).toBe('3.14');
    expect(formatValue(0)).toBe('0');
  });

  it('compacts thousands only for axis ticks', () => {
    expect(formatValue(12000, {}, 'compact')).toBe('12K');
    expect(formatValue(1500000, { prefix: '$' }, 'compact')).toBe('$1.5M');
    expect(formatValue(950, {}, 'compact')).toBe('950');
  });

  it('isolates a negative number so its minus sign stays in front on an RTL page', () => {
    expect(formatValue(-3.5)).toBe('⁦−3.5⁩');
    expect(formatValue(-2000, { suffix: ' ر.س' }, 'compact')).toBe('⁦−2K⁩ ر.س');
    expect(formatValue(-0.001)).toBe('0');
  });

  it('prints a share with at most one decimal', () => {
    expect(formatShare(0.4251)).toBe('42.5%');
    expect(formatShare(1)).toBe('100%');
  });
});
