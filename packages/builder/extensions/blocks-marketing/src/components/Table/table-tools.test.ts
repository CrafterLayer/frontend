import { describe, expect, it } from 'vitest';

import {
  fillTableTemplate,
  filterTableRows,
  foldTableText,
  sortTableRows,
  tableColumnKind,
  tableDate,
  tableNumber,
  tableSortKeys,
  westernDigits,
} from './table-tools';

const firsts = (texts: readonly (readonly string[])[], order: readonly number[]) =>
  order.map((index) => texts[index]?.[0]);

describe('reading a cell', () => {
  it('reads Arabic-Indic and Extended Arabic-Indic digits as ASCII', () => {
    expect(westernDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789 0123456789');
  });

  it('reads the first number, with grouping and the Arabic decimal mark', () => {
    expect(tableNumber('$1,240.50')).toBe(1240.5);
    expect(tableNumber('١٬٢٤٠ ر.س')).toBe(1240);
    expect(tableNumber('٩٫٥')).toBe(9.5);
    expect(tableNumber('30 min')).toBe(30);
    expect(tableNumber('−4 °C')).toBe(-4);
    expect(tableNumber('on request')).toBeUndefined();
  });

  it('reads ISO, day-first and month-name dates, Arabic digits included', () => {
    expect(tableDate('2026-03-14')).toBe(Date.UTC(2026, 2, 14));
    expect(tableDate('2026-03-14 09:30')).toBe(Date.UTC(2026, 2, 14, 9, 30));
    expect(tableDate('14/03/2026')).toBe(Date.UTC(2026, 2, 14));
    expect(tableDate('١٤/٠٣/٢٠٢٦')).toBe(Date.UTC(2026, 2, 14));
    expect(tableDate('1 March 2026')).toBe(Date.parse('1 March 2026'));
    expect(tableDate('$120')).toBeUndefined();
    expect(tableDate('Room 2026')).toBeUndefined();
  });

  it('decides a column’s kind from its filled cells: dates, then numbers, else text', () => {
    expect(tableColumnKind(['2026-01-02', '', '14/03/2026'])).toBe('date');
    expect(tableColumnKind(['$120', '٣٠ ر.س', ''])).toBe('number');
    expect(tableColumnKind(['$120', 'Free'])).toBe('text');
    expect(tableColumnKind(['', ' '])).toBe('text');
  });

  it('keys a number or date column by value, and leaves a text column unkeyed', () => {
    expect(tableSortKeys(['$9', '', 'n/a'], 'auto')).toEqual({
      kind: 'text',
      keys: [undefined, undefined, undefined],
    });
    expect(tableSortKeys(['$9', '', 'n/a'], 'number')).toEqual({
      kind: 'number',
      keys: [9, undefined, undefined],
    });
    expect(tableSortKeys(['١٤/٠٣/٢٠٢٦'], 'auto').keys).toEqual([Date.UTC(2026, 2, 14)]);
  });
});

describe('sortTableRows', () => {
  const texts = [
    ['Strategy session', '$120', '14/03/2026'],
    ['Brand review', '$1,240', '2026-01-02'],
    ['Website audit', '', '30/12/2025'],
    ['Team workshop', '$60', '1 Feb 2026'],
  ];

  it('sorts numbers and dates by value, empty cells last in either direction', () => {
    expect(firsts(texts, sortTableRows(texts, 1, 'ascending', 'auto'))).toEqual([
      'Team workshop',
      'Strategy session',
      'Brand review',
      'Website audit',
    ]);
    expect(firsts(texts, sortTableRows(texts, 1, 'descending', 'auto'))).toEqual([
      'Brand review',
      'Strategy session',
      'Team workshop',
      'Website audit',
    ]);
    expect(firsts(texts, sortTableRows(texts, 2, 'ascending', 'auto'))).toEqual([
      'Website audit',
      'Brand review',
      'Team workshop',
      'Strategy session',
    ]);
  });

  it('collates text in the page language, digits by value, ties in document order', () => {
    const arabic = [['يقطين'], ['Apple'], ['أرز'], ['بصل'], ['أرز']];
    expect(firsts(arabic, sortTableRows(arabic, 0, 'ascending', 'auto', 'ar'))).toEqual([
      'أرز',
      'أرز',
      'بصل',
      'يقطين',
      'Apple',
    ]);
    expect(sortTableRows(arabic, 0, 'ascending', 'auto', 'ar').slice(0, 2)).toEqual([2, 4]);
    const codes = [['10'], ['9'], ['100']];
    expect(firsts(codes, sortTableRows(codes, 0, 'ascending', 'text'))).toEqual(['9', '10', '100']);
    /* A tag the runtime cannot read falls back to its own collation rather than throwing. */
    expect(sortTableRows(codes, 0, 'ascending', 'text', 'not a tag!')).toEqual([1, 0, 2]);
  });
});

describe('searching', () => {
  it('folds case, accents, Arabic marks, letter forms and digits', () => {
    expect(foldTableText('Café')).toBe('cafe');
    expect(foldTableText('أحمد إبراهيم آمنة')).toBe('احمد ابراهيم امنه');
    expect(foldTableText('مُحَمَّد')).toBe('محمد');
    expect(foldTableText('مستشفى ١٢')).toBe('مستشفي 12');
  });

  it('keeps the rows holding every word of the query', () => {
    const folded = ['احمد علي 30', 'cafe creme 45', 'مدرسه الرياض 12'];
    expect(filterTableRows(folded, '')).toEqual([0, 1, 2]);
    expect(filterTableRows(folded, 'أحمد ٣٠')).toEqual([0]);
    expect(filterTableRows(folded, 'CAFÉ 45')).toEqual([1]);
    expect(filterTableRows(folded, 'مدرسة')).toEqual([2]);
    expect(filterTableRows(folded, 'cafe 12')).toEqual([]);
  });
});

describe('fillTableTemplate', () => {
  it('fills the numbers, in Arabic-Indic digits when the template is Arabic', () => {
    expect(fillTableTemplate('{shown} of {total} rows', { shown: 4, total: 12 })).toBe(
      '4 of 12 rows',
    );
    expect(fillTableTemplate('الصفحة {page} من {pages}', { page: 1, pages: 3 })).toBe(
      'الصفحة ١ من ٣',
    );
    expect(fillTableTemplate('{shown} / {unknown}', { shown: 2 })).toBe('2 / {unknown}');
  });
});
