import { describe, expect, it } from 'vitest';

import {
  formatCompact,
  formatCount,
  formatNumber,
  formatPercent,
  formatRatio,
  formatValue,
} from './format';
import { nextPeriodLabel } from './periods';
import {
  cagr,
  growthSeries,
  linearTrend,
  mean,
  median,
  movingAverage,
  outliersIqr,
  pearson,
  percentChange,
  projectTrend,
  quantile,
  ranks,
  runningTotal,
  shares,
  stdev,
  sum,
} from './stats';

/* Hand-checked (2026-10-14): Jan..Apr revenue 120, 135, 160, 150. */
const REVENUE = [120, 135, 160, 150];

describe('report statistics', () => {
  it('sums, averages and spreads the values present', () => {
    expect(sum(REVENUE)).toBe(565);
    expect(mean(REVENUE)).toBe(141.25);
    expect(median(REVENUE)).toBe(142.5);
    /* Deviations −21.25, −6.25, 18.75, 8.75 → squares 918.75 / (4 − 1) = 306.25 → 17.5. */
    expect(stdev(REVENUE)).toBe(17.5);
    expect(stdev([7])).toBe(0);
    expect(mean([])).toBeUndefined();
    expect(median([])).toBeUndefined();
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
  });

  it('measures change, growth and compound growth', () => {
    expect(percentChange(120, 150)).toBe(25);
    expect(percentChange(-10, -5)).toBe(50);
    expect(percentChange(0, 5)).toBeUndefined();
    expect(growthSeries([100, 110, undefined, 121])).toEqual([undefined, 10, undefined, undefined]);
    /* (150 / 120)^(1/3) − 1 = 7.72%. */
    expect(cagr(120, 150, 3)).toBeCloseTo(7.7217, 3);
    expect(cagr(-5, 10, 2)).toBeUndefined();
    expect(cagr(5, 10, 0)).toBeUndefined();
  });

  it('ranks, shares, running totals and the 3-period moving average', () => {
    expect(ranks([5, 7, 7, 1, undefined])).toEqual([3, 1, 1, 4, undefined]);
    expect(shares([1, 3])).toEqual([25, 75]);
    expect(shares([5, -1])).toBeUndefined();
    expect(shares([0, 0])).toBeUndefined();
    expect(runningTotal([1, undefined, 2])).toEqual([1, 1, 3]);
    expect(movingAverage([1, 2, 3, 4])).toEqual([undefined, undefined, 2, 3]);
    expect(movingAverage([1, undefined, 3, 4])).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('fits the linear trend and projects it one period on', () => {
    const trend = linearTrend(REVENUE);
    /* sxx 5, sxy 57.5, syy 918.75: slope 11.5, intercept 124, R² 3306.25 / 4593.75. */
    expect(trend?.slope).toBe(11.5);
    expect(trend?.intercept).toBe(124);
    expect(trend?.r2).toBeCloseTo(0.71973, 4);
    expect(projectTrend(trend ?? { slope: 0, intercept: 0, r2: 0 }, 4)).toBe(170);
    expect(linearTrend([5, 5, 5])).toEqual({ slope: 0, intercept: 5, r2: 1 });
    expect(linearTrend([undefined, 4])).toBeUndefined();
    /* A gap is skipped, not read as zero: (0,10), (2,30) → slope 10. */
    expect(linearTrend([10, undefined, 30])?.slope).toBe(10);
  });

  it('correlates two measures and finds outliers by the IQR', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10);
    expect(pearson([1, 2, 3], [4, 4, 4])).toBeUndefined();
    expect(pearson([1, 2], [1, 2])).toBeUndefined();
    /* Q1 11, Q3 13, IQR 2: fences 8 and 16. */
    expect(outliersIqr([10, 11, 12, 13, 100])).toEqual({ low: 8, high: 16, rows: [4] });
    expect(outliersIqr([1, 2, 3])).toBeUndefined();
  });
});

describe('report number formatting', () => {
  it('keeps the unit and rounds by size, in English', () => {
    expect(formatValue(1200, { prefix: '$', suffix: '' }, 'en')).toBe('$1,200');
    expect(formatValue(-1200, { prefix: '$', suffix: '' }, 'en', true)).toBe('-$1,200');
    expect(formatValue(30, { prefix: '', suffix: '' }, 'en', true)).toBe('+30');
    expect(formatNumber(13.83, 'en')).toBe('13.8');
    expect(formatNumber(2.256, 'en')).toBe('2.26');
    expect(formatPercent(12.5, 'en', true)).toBe('+12.5%');
    expect(formatValue(45, { prefix: '', suffix: '%' }, 'en')).toBe('45.0%');
    expect(formatRatio(0.7197, 'en')).toBe('0.72');
    expect(formatCompact(1_234_567, { prefix: '$', suffix: '' }, 'en')).toBe('$1.2M');
  });

  it('prints Arabic-Indic digits and separators on an Arabic page', () => {
    expect(formatValue(1200, { prefix: '', suffix: ' ر.س' }, 'ar')).toBe('١٬٢٠٠ ر.س');
    expect(formatPercent(12.5, 'ar')).toBe('١٢٫٥٪');
    expect(formatRatio(0.97, 'ar')).toBe('٠٫٩٧');
    expect(formatCount(12, 'ar')).toBe('١٢');
  });
});

describe('the next period', () => {
  it.each([
    [['2023', '2024'], '2025'],
    [['٢٠٢٣', '٢٠٢٤'], '2025'],
    [['Q3 2024', 'Q4 2024'], 'Q1 2025'],
    [['Q1', 'Q2'], 'Q3'],
    [['Nov', 'Dec'], 'Jan'],
    [['January', 'February'], 'March'],
    [['Dec 2024'], 'Jan 2025'],
    [['يناير', 'فبراير'], 'مارس'],
    [['كانون الثاني', 'شباط'], 'آذار'],
    [['W1', 'W2'], 'W3'],
  ])('follows %j with %s', (labels, next) => {
    expect(nextPeriodLabel(labels)).toBe(next);
  });

  it('names no period after labels it does not know', () => {
    expect(nextPeriodLabel(['Alpha', 'Beta'])).toBeUndefined();
    expect(nextPeriodLabel([])).toBeUndefined();
  });
});
