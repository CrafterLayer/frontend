import { describe, expect, it } from 'vitest';

import { tryDirectTool } from '../tools/agent/direct-tool';
import { dataKernel } from './data-show.fixtures';
import { readDataRequest } from './direct-data';

const ROWS = 'Month,Bookings\nJan,120\nFeb,135\nMar,160';

describe('readDataRequest', () => {
  it.each([
    ['Chart this:', 'auto'],
    ['Make a chart from this table', 'auto'],
    ['Show these as a bar chart', 'bar'],
    ['Draw a line graph of our bookings', 'line'],
    ['Add a pie chart', 'pie'],
    ['Put this in a table', 'table'],
    ['اعمل مخطط من هذي البيانات:', 'auto'],
    ['ارسم مخطط دائري', 'pie'],
    ['حط هذول في جدول', 'table'],
    ['اعرض البيانات كرسم بياني خطي', 'line'],
    ['Show this as a horizontal bar chart', 'hbar'],
    ['Make a funnel chart', 'funnel'],
    ['Draw a gauge of this', 'gauge'],
    ['Plot a scatter of spend against revenue', 'scatter'],
    ['Make a radar chart', 'radar'],
    ['Add sparklines for these', 'sparkline'],
    ['Make a combo chart', 'combo'],
    ['ارسم قمع المبيعات', 'funnel'],
    ['اعمل مخطط راداري', 'radar'],
    ['اعرضها كأعمدة أفقية', 'hbar'],
  ] as const)('reads %j as %s', (instruction, as) => {
    expect(readDataRequest(`${instruction}\n${ROWS}`)).toMatchObject({
      tool: 'data.show',
      input: { data: ROWS, as },
    });
  });

  it.each([
    'Make a report from this:',
    'Build a dashboard from these rows',
    'اعمل تقرير من هذه البيانات:',
    'اعمل لوحة من هذه البيانات:',
    'اعمل تقرير/لوحة من هذه البيانات:',
  ])('reads %j as a report', (instruction) => {
    expect(readDataRequest(`${instruction}\n${ROWS}`)).toEqual({
      tool: 'report.build',
      input: { data: ROWS },
      label: { ar: 'إضافة تقرير من البيانات', en: 'Add a report from the data' },
    });
  });

  it.each([
    ['a question about the data', `Which month had the most bookings?\n${ROWS}`],
    ['no chart or table asked for', `Make the hero warmer\n${ROWS}`],
    ['one line only', 'Make a chart of our bookings'],
    ['rows that are not a grid', 'Chart this:\nJust some words'],
    [
      'an instruction that is a paragraph',
      `${'Please read this carefully and then '.repeat(6)}chart it\n${ROWS}`,
    ],
  ])('leaves %s to the model', (_, request) => {
    expect(readDataRequest(request)).toBeUndefined();
  });

  it('says what it does in the request’s language', () => {
    expect(readDataRequest(`Put this in a table\n${ROWS}`)?.label.en).toBe(
      'Add a table from the data',
    );
    expect(readDataRequest(`اعمل مخطط\n${ROWS}`)?.label.ar).toBe('إضافة مخطط من البيانات');
  });
});

describe('tryDirectTool with pasted rows', () => {
  it('inserts the chart with no model, validated by the door', () => {
    const result = tryDirectTool(`Chart this:\n${ROWS}`, dataKernel());
    expect(result?.label).toBe('Add a chart from the data');
    expect(result?.plan.commands).toEqual([
      expect.objectContaining({
        command: 'insertNode',
        args: expect.objectContaining({
          type: 'chart',
          parentId: 'root',
          props: expect.objectContaining({
            chartType: 'line',
            categories: ['Jan', 'Feb', 'Mar'],
          }) as unknown,
        }) as unknown,
      }),
    ]);
  });

  it('answers in Arabic for an Arabic request and draws a table', () => {
    const result = tryDirectTool(
      'حط هذول في جدول\n| الخدمة | السعر |\n|---|---:|\n| استشارة | ٤٠ ر.س |',
      dataKernel(),
    );
    expect(result?.label).toBe('إضافة جدول من البيانات');
    expect(result?.plan.commands[0]?.args).toMatchObject({
      type: 'table',
      props: {
        columns: [
          { label: 'الخدمة', align: 'start' },
          { label: 'السعر', align: 'end' },
        ],
      },
    });
  });

  it('builds a report from pasted rows with no model, in English and Arabic', () => {
    const english = tryDirectTool(`Make a dashboard from this:\n${ROWS}`, dataKernel());
    expect(english?.label).toBe('Add a report from the data');
    expect(english?.plan.commands[0]?.args).toMatchObject({
      type: 'report',
      props: { chartType: 'line', kpis: [{ label: 'Bookings', series: 0 }] },
    });
    const arabic = tryDirectTool(
      'اعمل تقرير من هذه البيانات:\nالفرع,الإيرادات\nالشمال,١٢٠٠\nالجنوب,٩٠٠',
      dataKernel(),
    );
    expect(arabic?.label).toBe('إضافة تقرير من البيانات');
    expect(arabic?.plan.commands[0]?.args).toMatchObject({
      type: 'report',
      props: { chartType: 'bar', series: [{ name: 'الإيرادات', values: [1200, 900] }] },
    });
  });

  it('still refuses other multi-line requests', () => {
    expect(tryDirectTool('Change the colour\nto green', dataKernel())).toBeUndefined();
  });
});
