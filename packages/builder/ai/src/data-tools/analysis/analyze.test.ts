import { describe, expect, it } from 'vitest';

import { readDataText, type DataGrid } from '../data-text';
import { ANALYSIS_LIMITS, analyzeGrid, type Analysis } from './analyze';
import { profileGrid, upright } from './profile';

function grid(text: string): DataGrid {
  const read = readDataText(text);
  if (!read.ok) throw new Error(read.error);
  return read.grid;
}

function analysis(text: string, options: Parameters<typeof analyzeGrid>[1] = {}): Analysis {
  const result = analyzeGrid(grid(text), options);
  if (typeof result === 'string') throw new Error(result);
  return result;
}

const MONTHS = 'Month,Revenue,Costs\nJan,120,80\nFeb,135,90\nMar,160,85\nApr,150,95';
const LONG =
  'Region,Month,Sales\nNorth,Jan,100\nSouth,Jan,80\nNorth,Feb,120\nSouth,Feb,70\nNorth,Mar,130\nSouth,Mar,90';

describe('the column profile', () => {
  it('reads periods, measures, units and kinds, in English and Arabic', () => {
    const english = profileGrid(
      grid('Year,Revenue,Margin,ID\n2023,"$1,200",12%,1\n2024,"$1,500",15%,2'),
    );
    if (typeof english === 'string') throw new Error(english);
    expect(english.columns.map(({ kind }) => kind)).toEqual([
      'period',
      'currency',
      'percent',
      'number',
    ]);
    expect(english.columns[1]?.unit).toEqual({ prefix: '$', suffix: '' });
    /* An ID numbers the rows: never a measure. */
    expect(english).toMatchObject({
      label: 0,
      period: 0,
      measures: [1, 2],
      timeSeries: true,
      long: false,
    });

    const arabic = profileGrid(
      grid('الشهر,المبيعات,ملاحظات\nيناير,"١٬٢٠٠ ر.س",جيد\nفبراير,"١٬٥٠٠ ر.س",ممتاز'),
    );
    if (typeof arabic === 'string') throw new Error(arabic);
    expect(arabic.columns.map(({ kind }) => kind)).toEqual(['period', 'currency', 'category']);
    expect(arabic).toMatchObject({ period: 0, measures: [1], timeSeries: true });
  });

  it('finds a long table and the categories that repeat', () => {
    const long = profileGrid(grid(LONG));
    if (typeof long === 'string') throw new Error(long);
    expect(long).toMatchObject({
      label: 1,
      period: 1,
      groups: [0],
      measures: [2],
      long: true,
      timeSeries: true,
    });
    const categories = profileGrid(grid('City,Sales\nRiyadh,10\nJeddah,8'));
    if (typeof categories === 'string') throw new Error(categories);
    expect(categories).toMatchObject({
      label: 0,
      period: undefined,
      groups: [],
      long: false,
      timeSeries: false,
    });
  });

  it('honours "period" and "measures", and refuses a column that is not there', () => {
    const picked = profileGrid(grid(MONTHS), { measures: ['costs'], period: 'month' });
    expect(picked).toMatchObject({ label: 0, measures: [2] });
    expect(profileGrid(grid(MONTHS), { measures: ['Profit'] })).toContain(
      'no numeric column "Profit"',
    );
    expect(profileGrid(grid(MONTHS), { period: 'Week' })).toContain('"period": no column "Week"');
  });

  it('turns a table whose headings are the years so the years run down the rows', () => {
    expect(upright(grid('Metric,2022,2023\nRevenue,100,120\nCosts,60,70'))).toEqual({
      header: ['Metric', 'Revenue', 'Costs'],
      rows: [
        ['2022', '100', '60'],
        ['2023', '120', '70'],
      ],
    });
  });
});

describe('analyzeGrid', () => {
  it('computes every statistic of a time series', () => {
    const a = analysis(MONTHS);
    const [revenue] = a.measures;
    expect(a.timeSeries).toBe(true);
    expect(revenue).toMatchObject({
      name: 'Revenue',
      count: 4,
      missing: 0,
      sum: 565,
      mean: 141.25,
      median: 142.5,
      stdev: 17.5,
      min: { value: 120, label: 'Jan' },
      max: { value: 160, label: 'Mar' },
      first: { value: 120, label: 'Jan' },
      last: { value: 150, label: 'Apr' },
      change: { absolute: 30, percent: 25 },
      ranks: [4, 3, 1, 2],
      running: [120, 255, 415, 565],
      movingAverage: [undefined, undefined, 415 / 3, 445 / 3],
      forecast: 170,
    });
    expect(revenue?.cagr).toBeCloseTo(7.7217, 3);
    expect(revenue?.growth[1]).toBeCloseTo(12.5, 10);
    expect(a.nextLabel).toBe('May');
    /* Revenue and costs: r = 0.43 — below 0.7, not reported as moving together. */
    expect(a.correlations).toEqual([]);
  });

  it('derives profit and margin, attainment, and what remains of a budget', () => {
    const profit = analysis(MONTHS).derived[0];
    expect(profit).toMatchObject({ kind: 'profit', totals: [565, 350] });
    expect(profit?.overall).toBeCloseTo((215 / 565) * 100, 10);
    expect(profit?.measures.map(({ name, sum }) => [name, sum])).toEqual([
      ['Profit', 215],
      ['Margin', expect.any(Number) as unknown],
    ]);
    expect(analysis('Rep,Actual,Target\nA,90,100\nB,120,100').derived[0]).toMatchObject({
      kind: 'attainment',
      overall: 105,
    });
    expect(analysis('Dept,Budget,Spent\nOps,1000,850\nIT,500,500').derived[0]).toMatchObject({
      kind: 'remaining',
      overall: 150,
      totals: [1500, 1350],
    });
    expect(
      analysis('القسم,الميزانية,المصروف\nالتشغيل,١٠٠٠,٨٥٠', { lang: 'ar' }).derived[0]?.measures[0]
        ?.name,
    ).toBe('المتبقي');
  });

  it('sums a long table per period and breaks it down by region, with a pivot', () => {
    const a = analysis(LONG);
    expect(a.labels).toEqual(['Jan', 'Feb', 'Mar']);
    expect(a.measures[0]?.values).toEqual([180, 190, 220]);
    expect(a.breakdowns[0]).toMatchObject({
      by: 0,
      measure: 2,
      total: 590,
      groups: [
        { key: 'North', sum: 350, count: 3 },
        { key: 'South', sum: 240, count: 3 },
      ],
    });
    expect(a.breakdowns[0]?.groups[0]?.share).toBeCloseTo((350 / 590) * 100, 10);
    expect(a.pivot).toEqual({
      by: 0,
      measure: 2,
      periods: ['Jan', 'Feb', 'Mar'],
      series: [
        { name: 'North', values: [100, 120, 130] },
        { name: 'South', values: [80, 70, 90] },
      ],
      folded: 0,
    });
  });

  it('folds a pivot past five groups into one "other" series', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].flatMap((group, index) => [
      `${group},Jan,${String(70 - index * 10)}`,
      `${group},Feb,${String(70 - index * 10)}`,
    ]);
    const pivot = analysis(`Shop,Month,Sales\n${rows.join('\n')}`).pivot;
    expect(pivot?.series.map(({ name }) => name)).toEqual(['A', 'B', 'C', 'D', 'E', '']);
    /* F 20 + G 10 in each month. */
    expect(pivot?.series.at(-1)?.values).toEqual([30, 30]);
    expect(pivot?.folded).toBe(2);
  });

  it('reports a correlation between measures that move together', () => {
    const a = analysis('Month,Ads,Sales\nJan,10,100\nFeb,20,210\nMar,30,290\nApr,40,410');
    expect(a.correlations).toHaveLength(1);
    expect(a.correlations[0]?.r).toBeGreaterThan(0.99);
    expect(a.insights.some(({ kind }) => kind === 'correlation')).toBe(true);
  });

  it('handles one row, empty cells, negatives and percents', () => {
    const one = analysis('Month,Sales\nJan,120');
    expect(one.measures[0]).toMatchObject({
      count: 1,
      sum: 120,
      stdev: 0,
      trend: undefined,
      forecast: undefined,
    });
    const gaps = analysis('Month,Sales\nJan,100\nFeb,\nMar,130');
    expect(gaps.measures[0]).toMatchObject({
      count: 2,
      missing: 1,
      mean: 115,
      change: { absolute: 30 },
    });
    const negative = analysis('Q,Profit\nQ1,-50\nQ2,20\nQ3,(30)');
    expect(negative.measures[0]).toMatchObject({
      sum: -60,
      shares: undefined,
      cagr: undefined,
      min: { value: -50 },
    });
    const rate = analysis('Month,Rate\nJan,40%\nFeb,44%\nMar,47%');
    expect(rate.measures[0]).toMatchObject({
      kind: 'percent',
      additive: false,
      cagr: undefined,
      change: { absolute: 7 },
    });
    expect(rate.insights[0]?.text.en).toBe('Rate rose 7.0 points from Jan to Mar (40.0% → 47.0%).');
  });

  it('writes its findings in English and Arabic, numbers in each language', () => {
    const english = analysis(MONTHS).insights;
    expect(english[0]?.text).toEqual({
      en: 'Revenue rose 25.0% from Jan to Apr (120 → 150).',
      ar: 'Revenue: ارتفاع بمقدار ٢٥٫٠٪ من Jan إلى Apr (١٢٠ ← ١٥٠).',
    });
    expect(english.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['change', 'profit', 'extremes', 'trend', 'cagr', 'forecast']),
    );
    expect(english.find(({ kind }) => kind === 'forecast')?.text.en).toBe(
      'Projection, not a result: if the linear trend holds, Revenue would be about 170 in May.',
    );
    const arabic = analysis(
      'المنطقة,المبيعات\nالرياض,"١٬٢٠٠ ر.س"\nجدة,"٩٠٠ ر.س"\nالدمام,"٤٠٠ ر.س"\nمكة,"٣٥٠ ر.س"',
    );
    expect(arabic.insights[0]?.text.ar).toBe(
      'الأكبر في المبيعات: الرياض بحصة ٤٢٫١٪ من الإجمالي (١٬٢٠٠ ر.س من ٢٬٨٥٠ ر.س).',
    );
    const outliers = analysis('Day,Visits\nMon,10\nTue,11\nWed,12\nThu,13\nFri,100');
    expect(outliers.insights.find(({ kind }) => kind === 'outliers')?.text.en).toBe(
      'Unusual Visits: Fri (100) — outside the usual range 10–16.',
    );
  });

  it('stays within its limits and refuses what it cannot read', () => {
    const many = `Day,Visits\n${Array.from({ length: ANALYSIS_LIMITS.rows + 1 }, (_, day) => `d${String(day)},${String(day)}`).join('\n')}`;
    const big = analysis(many);
    expect([big.rows, big.totalRows]).toEqual([ANALYSIS_LIMITS.rows, ANALYSIS_LIMITS.rows + 1]);
    const wide = `${Array.from({ length: 25 }, (_, at) => `c${String(at)}`).join(',')}\n${Array.from({ length: 25 }, () => '1').join(',')}`;
    expect(analyzeGrid(grid(wide))).toContain('send at most 24');
    expect(analyzeGrid(grid('Name,Role\nAda,Engineer'))).toContain('no column holds numbers');
  });
});
