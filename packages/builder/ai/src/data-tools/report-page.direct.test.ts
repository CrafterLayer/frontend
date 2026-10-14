import { describe, expect, it } from 'vitest';

import { tryDirectTool } from '../tools/agent/direct-tool';
import { readDataText } from './data-text';
import { readDataRequest } from './direct-data';
import { reportKernel } from './report-page.fixtures';

/*
  The zero-token report page (2026-10-14): "make a detailed report / dashboard page from this:"
  over pasted rows is one report.page call with no model; the plain "report" wording stays
  report.build. Also JSON rows, and the measurement of what the page saves.
*/

const ROWS = 'Month,Revenue,Costs\nJan,120,80\nFeb,135,90\nMar,160,85\nApr,150,95';

describe('readDataRequest for a report page', () => {
  it.each([
    'Make a detailed report from this:',
    'Build a full report of these numbers',
    'Create a dashboard page from this',
    'Make a report page from these rows',
    'Analyse this:',
    'analyze these sales',
    'اعمل تقرير مفصل من هذه البيانات:',
    'اعمل تقرير مفصّل',
    'سوي تقرير كامل',
    'اعمل صفحة تقرير',
    'اعمل لوحة تحكم من هذه الأرقام',
    'حلل هذه البيانات',
  ])('reads %j as report.page', (instruction) => {
    expect(readDataRequest(`${instruction}\n${ROWS}`)).toEqual({
      tool: 'report.page',
      input: { data: ROWS },
      label: {
        ar: 'إضافة صفحة تقرير محسوبة من البيانات',
        en: 'Add a computed report page from the data',
      },
    });
  });

  it.each([
    'Make a report from this:',
    'Build a dashboard from these rows',
    'اعمل تقرير/لوحة من هذه البيانات:',
  ])('keeps %j on report.build', (instruction) => {
    expect(readDataRequest(`${instruction}\n${ROWS}`)?.tool).toBe('report.build');
  });

  it('leaves a question about the data to the model', () => {
    expect(readDataRequest(`Can you analyse this?\n${ROWS}`)).toBeUndefined();
  });
});

describe('tryDirectTool with a report page', () => {
  it('inserts the whole page with no model, in English and Arabic', () => {
    const english = tryDirectTool(`Make a detailed report from this:\n${ROWS}`, reportKernel());
    expect(english?.label).toBe('Add a computed report page from the data');
    expect(
      (english?.plan.commands ?? []).map((step) => (step.args as { type?: unknown }).type),
    ).toEqual(['stats', 'chart', 'chart', 'richText', 'table', 'table']);
    const arabic = tryDirectTool(
      'اعمل تقرير مفصل من هذه البيانات:\nالشهر,المبيعات\nيناير,١٢٠\nفبراير,١٣٥\nمارس,١٦٠',
      reportKernel('ar'),
    );
    expect(arabic?.label).toBe('إضافة صفحة تقرير محسوبة من البيانات');
    const header = arabic?.plan.commands[0]?.args as {
      type: string;
      props: { heading: string; items: unknown[] };
    };
    expect(header.type).toBe('stats');
    expect(header.props.heading).toBe('تقرير المبيعات');
    expect(header.props.items[0]).toEqual({
      value: '٤١٥',
      label: 'المبيعات · الإجمالي',
      detail: 'الصفوف: ٣',
    });
    expect(header.props.items[2]).toEqual({
      value: '١٦٠',
      label: 'المبيعات · الأحدث',
      detail: 'مارس · +١٨٫٥٪ عن السابق · النمو المركب +١٥٫٥٪',
    });
  });

  it('reads pasted JSON rows', () => {
    const json =
      '[{"Month":"Jan","Sales":10},{"Month":"Feb","Sales":14},{"Month":"Mar","Sales":18}]';
    const result = tryDirectTool(`Make a dashboard page from this:\n${json}`, reportKernel());
    expect(result?.plan.commands[1]?.args).toMatchObject({
      type: 'chart',
      props: {
        chartType: 'area',
        categories: ['Jan', 'Feb', 'Mar'],
        series: [{ name: 'Sales', values: [10, 14, 18] }],
      },
    });
  });
});

describe('readDataText with JSON', () => {
  it('reads an array of objects, of arrays, or rows under one key', () => {
    expect(
      readDataText('[{"Month":"Jan","Sales":10,"Ok":true},{"Month":"Feb","Note":null}]'),
    ).toEqual({
      ok: true,
      grid: {
        header: ['Month', 'Sales', 'Ok', 'Note'],
        rows: [
          ['Jan', '10', 'true', ''],
          ['Feb', '', '', ''],
        ],
      },
    });
    expect(readDataText('[["Month","Sales"],["Jan",10]]')).toEqual({
      ok: true,
      grid: { header: ['Month', 'Sales'], rows: [['Jan', '10']] },
    });
    expect(readDataText('{"rows":[{"a":"x","b":1}]}')).toMatchObject({
      ok: true,
      grid: { header: ['a', 'b'] },
    });
  });

  it('refuses nested cells and mixed rows, and reads text that only looks like JSON as a table', () => {
    expect(readDataText('[{"a":[1,2]}]')).toMatchObject({
      ok: false,
      error: expect.stringContaining('row 1 "a"') as unknown,
    });
    expect(readDataText('[{"a":1},[1]]')).toMatchObject({ ok: false });
    expect(readDataText('[Month],Sales\nJan,1')).toMatchObject({
      ok: true,
      grid: { header: ['[Month]', 'Sales'] },
    });
  });
});

describe('the measurement', () => {
  it('one report.page call costs a fraction of writing the page by hand (4 characters a token)', () => {
    const result = tryDirectTool(`Make a detailed report from this:\n${ROWS}`, reportKernel());
    const handWritten = JSON.stringify(result?.plan.commands ?? []);
    const call = JSON.stringify({
      command: 'tool',
      args: {
        name: 'report.page',
        input: { data: ROWS, title: 'First four months', summary: 'Costs held.' },
      },
    });
    const tokens = (text: string) => Math.ceil(text.length / 4);
    /* Measured 2026-10-14: 1,261 tokens of hand-written sections against 47 for the call (~27×). */
    expect(tokens(call)).toBeLessThan(60);
    expect(tokens(handWritten)).toBeGreaterThan(1_200);
    expect(tokens(handWritten)).toBeGreaterThan(tokens(call) * 20);
  });
});
