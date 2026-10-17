import { describe, expect, it } from 'vitest';

import {
  isNumericColumn,
  isTimeLabel,
  isTimeline,
  normalizeDigits,
  readDataRows,
  readDataText,
  readNumber,
} from './data-text';

describe('readNumber', () => {
  it.each([
    ['120', 120, '', ''],
    ['1,200', 1200, '', ''],
    ['1 200 000', 1_200_000, '', ''],
    ['1,5', 1.5, '', ''],
    ['3.25', 3.25, '', ''],
    ['.5', 0.5, '', ''],
    ['$1,200', 1200, '$', ''],
    ['-$5', -5, '$', ''],
    ['$-5', -5, '$', ''],
    ['(40)', -40, '', ''],
    ['−7', -7, '', ''],
    ['45%', 45, '', '%'],
    ['12 kg', 12, '', ' kg'],
    ['SAR 99', 99, 'SAR ', ''],
    ['€9.90', 9.9, '€', ''],
    ['1.2k', 1200, '', ''],
    ['3M', 3_000_000, '', ''],
    ['2bn', 2e9, '', ''],
    ['٤٥٪', 45, '', '%'],
    ['١٬٢٠٠', 1200, '', ''],
    ['۳٫۵', 3.5, '', ''],
    ['120 ر.س', 120, '', ' ر.س'],
  ])('reads %s', (cell, value, prefix, suffix) => {
    expect(readNumber(cell)).toEqual({ value, prefix, suffix });
  });

  it.each(['', '  ', 'Coffee', 'about 5', 'Q1', '12 to 14 years old', 'n/a', '5 5 5'])(
    'leaves %j as text',
    (cell) => {
      expect(readNumber(cell)).toBeUndefined();
    },
  );

  it('normalises Arabic-Indic and Persian digits and separators', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹ ٫ ٬ ٪')).toBe('0123456789 0123456789 . , %');
  });
});

describe('readDataText', () => {
  it('reads CSV with quoted cells', () => {
    const read = readDataText('Item,Note,Price\n"Tea, green","Says ""hi""",4\nCoffee,,3.5');
    expect(read).toEqual({
      ok: true,
      grid: {
        header: ['Item', 'Note', 'Price'],
        rows: [
          ['Tea, green', 'Says "hi"', '4'],
          ['Coffee', '', '3.5'],
        ],
      },
    });
  });

  it('reads TSV, and a semicolon list when no comma is present', () => {
    const tsv = readDataText('Month\tSales\nJan\t1,200\nFeb\t1,400');
    expect(tsv.ok && tsv.grid.rows).toEqual([
      ['Jan', '1,200'],
      ['Feb', '1,400'],
    ]);
    const semi = readDataText('Month;Sales\nJan;120');
    expect(semi.ok && semi.grid.header).toEqual(['Month', 'Sales']);
  });

  it('reads a markdown table with its alignment row', () => {
    const read = readDataText(
      '| Plan | Seats | Price |\n|:-----|:----:|------:|\n| Solo | 1 | $9 |\n| Team | 5 | $29 |',
    );
    expect(read).toEqual({
      ok: true,
      grid: {
        header: ['Plan', 'Seats', 'Price'],
        rows: [
          ['Solo', '1', '$9'],
          ['Team', '5', '$29'],
        ],
        aligns: ['start', 'center', 'end'],
      },
    });
  });

  it('joins an unquoted "$1,200" back into one cell', () => {
    const read = readDataText(
      'Branch,Revenue,Staff\nNorth,$1,200,4\nSouth,$12,500.50,9\nEast,900,3',
    );
    expect(read.ok && read.grid.rows).toEqual([
      ['North', '$1,200', '4'],
      ['South', '$12,500.50', '9'],
      ['East', '900', '3'],
    ]);
  });

  it('pads short rows and refuses long ones with the fix', () => {
    const short = readDataText('A,B,C\nx,1');
    expect(short.ok && short.grid.rows).toEqual([['x', '1', '']]);
    const long = readDataText('A,B\nx,1,2');
    expect(long).toEqual({
      ok: false,
      error: expect.stringContaining('row 2 has 3 cells but the header has 2') as unknown,
    });
  });

  it('refuses a header alone and a single column', () => {
    expect(readDataText('Month,Sales').ok).toBe(false);
    expect(readDataText('Names\nAda\nGrace').ok).toBe(false);
  });
});

describe('readDataRows', () => {
  it('keeps numbers as typed and blanks for null', () => {
    expect(
      readDataRows([
        ['Year', 'Visitors'],
        [2024, 1200.5],
        ['2025', null],
      ]),
    ).toEqual({
      ok: true,
      grid: {
        header: ['Year', 'Visitors'],
        rows: [
          ['2024', '1200.5'],
          ['2025', ''],
        ],
      },
    });
  });

  it('refuses a cell that is neither text nor a number', () => {
    expect(
      readDataRows([
        ['A', 'B'],
        ['x', { value: 1 }],
      ]).ok,
    ).toBe(false);
  });
});

describe('columns and time', () => {
  it('a numeric column ignores blanks but needs one number', () => {
    const read = readDataText('Item,Price,Note\nTea,$4,\nCake,,fresh\nPie,$5,');
    if (!read.ok) throw new Error(read.error);
    expect(isNumericColumn(read.grid, 1)).toBe(true);
    expect(isNumericColumn(read.grid, 2)).toBe(false);
  });

  it.each([
    'Jan',
    'January 2025',
    'sept',
    'Mon',
    'Q3',
    'Q1 2024',
    'H2',
    'Week 4',
    'W12',
    '2024',
    '2025-03',
    'FY24',
    "'23",
    'يناير',
    'كانون الثاني',
    'أيار',
    'الجمعة',
    'الربع الأول',
    '٢٠٢٤',
  ])('%s is a time', (label) => {
    expect(isTimeLabel(label)).toBe(true);
  });

  it.each(['Market', 'Maybe', 'Sunset', 'Coffee', 'North', 'أبها', 'Team', '12', ''])(
    '%s is not a time',
    (label) => {
      expect(isTimeLabel(label)).toBe(false);
    },
  );

  it('a timeline needs two labels, every one a time', () => {
    expect(isTimeline(['Jan', 'Feb'])).toBe(true);
    expect(isTimeline(['Jan'])).toBe(false);
    expect(isTimeline(['Jan', 'Coffee'])).toBe(false);
  });
});
