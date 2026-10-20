import { describe, expect, it } from 'vitest';

import { readDataText } from '../data-text';
import { pageCharts } from '../report-page-charts';
import { dataTable, findingsDoc } from '../report-page-sections';
import { pageWords } from '../report-page-words';
import { analyzeGrid, type Analysis } from './analyze';

function analyze(text: string): Analysis {
  const read = readDataText(text);
  if (!read.ok) throw new Error(read.error);
  const result = analyzeGrid(read.grid);
  if (typeof result === 'string') throw new Error(result);
  return result;
}

describe('report data integrity', () => {
  it('sorts periods before growth, projection and pivot without rewriting source row order', () => {
    const result = analyze('Month,Sales\nMar,300\nJan,100\nFeb,200');
    expect(result.labels).toEqual(['Jan', 'Feb', 'Mar']);
    expect(result.measures[0]).toMatchObject({
      values: [100, 200, 300],
      change: { percent: 200 },
      forecast: 400,
    });
    expect(result.grid.rows[0]?.[0]).toBe('Mar');
    const grouped = analyze('Region,Month,Sales\nA,Mar,3\nB,Jan,2\nA,Feb,1\nB,Mar,5');
    expect(grouped.pivot?.periods).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it.each([
    ['الشهر,المبيعات\nمارس,٣٠٠\nيناير,١٠٠\nفبراير,٢٠٠', ['يناير', 'فبراير', 'مارس']],
    ['Month,Sales\nFeb 2025,30\nDec 2024,10\nJan 2025,20', ['Dec 2024', 'Jan 2025', 'Feb 2025']],
    [
      'Date,Sales\n2025-03-01,30\n2025-01-01,10\n2025-02-01,20',
      ['2025-01-01', '2025-02-01', '2025-03-01'],
    ],
  ])('sorts supported calendar labels: %s', (text, labels) => {
    expect(analyze(text).labels).toEqual(labels);
  });

  it('does not project unequal or skipped intervals as consecutive periods', () => {
    const result = analyze('Year,Sales\n2020,100\n2021,200\n2025,300');
    expect(result.measures[0]?.forecast).toBeUndefined();
    expect(result.measures[0]?.cagr).toBeUndefined();
    expect(result.measures[0]?.trend).toBeUndefined();
    expect(result.insights.some(({ kind }) => kind === 'forecast')).toBe(false);
  });

  it('does not draw a time pivot when yearless periods could cross a year boundary', () => {
    const result = analyze('Month,Region,Sales\nDec,A,100\nJan,A,200\nDec,B,300\nJan,B,400');
    expect(result.timeSeries).toBe(false);
    expect(result.pivot).toBeUndefined();
    expect(pageCharts(result, pageWords('en'), 'en').some(({ key }) => key === 'pivot')).toBe(
      false,
    );
  });

  it('does not treat different labels for the same period as extra consecutive periods', () => {
    const result = analyze('Month,Sales\nJan,100\nJanuary,200\nFeb,300');
    expect(result.timeSeries).toBe(false);
    expect(result.measures[0]?.forecast).toBeUndefined();
    expect(result.measures[0]?.cagr).toBeUndefined();
    expect(result.quality.some(({ en }) => en.includes('Period order'))).toBe(true);
  });

  it.each([
    'Day,Sales\nSat,100\nSun,200\nMon,300',
    'اليوم,المبيعات\nالسبت,١٠٠\nالأحد,٢٠٠\nالاثنين,٣٠٠',
  ])('does not invent a week boundary from undated weekday names: %s', (data) => {
    const result = analyze(data);
    expect(result.timeSeries).toBe(false);
    expect(result.measures[0]?.forecast).toBeUndefined();
    expect(result.insights.some(({ kind }) => kind === 'change')).toBe(false);
  });

  it('refuses mixed cell units instead of silently dropping currency or percentage', () => {
    for (const cells of [
      ['$100', '€200'],
      ['10%', '20'],
      ['1 kg', '2 lb'],
    ]) {
      expect(
        analyzeGrid({
          header: ['Item', 'Value'],
          rows: [
            ['A', cells[0]!],
            ['B', cells[1]!],
          ],
        }),
      ).toMatch(/mixed units/iu);
    }
  });

  it('does not subtract or divide incompatible units', () => {
    expect(analyze('Month,Revenue,Costs\nJan,$100,€80\nFeb,$200,€90').derived).toEqual([]);
    expect(analyze('Rep,Actual,Target\nA,10 kg,20 lb').derived).toEqual([]);
  });

  it('preserves compatible units with whitespace and the given currency on derived values', () => {
    const units = analyze('Item,Weight\nA,10 kg\nB,20kg');
    expect(units.measures[0]?.unit.suffix.trim()).toBe('kg');
    const dollars = analyze('Item,Revenue,Costs\nA,$100,$40\nB,$200,$80');
    expect(dollars.derived[0]).toMatchObject({ overall: 60, totals: [300, 120] });
    expect(dollars.derived[0]?.measures[0]?.unit.prefix).toBe('$');
  });

  it('pairs source rows before aggregation, retaining only genuinely comparable rows', () => {
    const missing = analyze(
      'Month,Region,Revenue,Costs\nJan,A,100,\nJan,B,,80\nFeb,A,200,\nFeb,B,,90',
    );
    expect(missing.derived).toEqual([]);
    const partial = analyze(
      'Month,Region,Revenue,Costs\nJan,A,100,40\nJan,B,900,\nFeb,A,200,80\nFeb,B,,800',
    );
    expect(partial.derived[0]).toMatchObject({ totals: [300, 120], overall: 60 });
    expect(partial.derived[0]?.measures[0]?.values).toEqual([60, 120]);
  });

  it('states analyzed and displayed limits separately, with visible bilingual quality notes', () => {
    const result = analyze(
      `Item,Value\n${Array.from({ length: 5001 }, (_, n) => `${String(n)},1`).join('\n')}`,
    );
    for (const lang of ['en', 'ar'] as const) {
      const words = pageWords(lang);
      const table = dataTable(result, words, lang);
      expect(table.caption).toContain(lang === 'en' ? '5,000' : '٥٬٠٠٠');
      expect(table.caption).toContain(lang === 'en' ? '5,001' : '٥٬٠٠١');
      expect(JSON.stringify(findingsDoc(result, words, lang, undefined))).toContain(
        lang === 'en' ? '5,000' : '٥٬٠٠٠',
      );
    }
  });

  it('enforces the column bound after transposing period headings', () => {
    const result = analyzeGrid({
      header: ['Metric', '2024', '2025'],
      rows: Array.from({ length: 25 }, (_, n) => [`Measure ${String(n)}`, '1', '2']),
    });
    expect(result).toMatch(/Transposed.*at most 24/u);
  });

  it('does not infer a calendar from invalid dates or mixed period kinds', () => {
    for (const text of [
      'Date,Sales\n2025-01-01,10\n2025-02-31,20\n2025-03-01,30',
      'Period,Sales\nJan,10\nQ2,20\n2025,30',
      'Month,Sales\nDec,10\nJan,20\nFeb,30',
      'Month,Sales\nJan,10\n,20\nMar,30',
    ]) {
      const result = analyze(text);
      expect(result.timeSeries).toBe(false);
      expect(result.measures[0]?.forecast).toBeUndefined();
      expect(result.quality.some(({ en }) => en.includes('Period order'))).toBe(true);
    }
  });

  it('keeps observed zeroes and omits missing chart observations rather than drawing a zero', () => {
    const complete = analyze('Month,Sales\nJan,10\nFeb,0\nMar,30');
    const plotted = pageCharts(complete, pageWords('en'), 'en');
    expect(plotted[0]?.props['series']).toEqual([{ name: 'Sales', values: [10, 0, 30] }]);
    const gaps = analyze('Month,Sales\nJan,10\nFeb,\nMar,30');
    expect(pageCharts(gaps, pageWords('en'), 'en')).toEqual([]);
    const partial = analyze('Month,Sales,Visits\nJan,10,1\nFeb,,2\nMar,30,3');
    expect(pageCharts(partial, pageWords('en'), 'en')[0]?.props['series']).toEqual([
      { name: 'Visits', values: [1, 2, 3] },
    ]);
  });

  it('omits incomplete pivots but retains a real zero in a complete pivot', () => {
    const absent = analyze('Region,Month,Sales\nA,Jan,10\nB,Jan,20\nA,Feb,30');
    expect(absent.pivot?.incomplete).toBe(true);
    expect(pageCharts(absent, pageWords('en'), 'en').some(({ key }) => key === 'pivot')).toBe(
      false,
    );
    const zero = analyze('Region,Month,Sales\nA,Jan,10\nB,Jan,20\nA,Feb,30\nB,Feb,0');
    expect(zero.pivot?.incomplete).toBeUndefined();
    expect(pageCharts(zero, pageWords('en'), 'en').some(({ key }) => key === 'pivot')).toBe(true);
  });

  it('discloses unweighted percentage averages in both report languages', () => {
    const result = analyze('Region,Rate\nA,10%\nB,20%');
    expect(result.quality.some(({ en }) => en.includes('unweighted'))).toBe(true);
    expect(result.quality.some(({ ar }) => ar.includes('غير موزونة'))).toBe(true);
  });
});
