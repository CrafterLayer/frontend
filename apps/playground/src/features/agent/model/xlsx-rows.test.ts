/**
 * readXlsx (2026-10-14): workbooks are built here, in memory, with fflate's zip — the parts a
 * spreadsheet program writes, cut to what each case needs.
 */
import { strToU8 as encode, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { XlsxReadError, readXlsx, rowsToCsv } from './xlsx-rows';

/** jsdom's encoder hands back another realm's Uint8Array, which fflate's zip takes for a folder. */
function strToU8(text: string): Uint8Array {
  return new Uint8Array(encode(text));
}

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

interface Book {
  readonly sheetData: string;
  readonly shared?: readonly string[];
  readonly styles?: string;
  readonly date1904?: boolean;
  readonly sheetName?: string;
  readonly target?: string;
}

function workbook(book: Book): Uint8Array {
  const target = book.target ?? 'worksheets/sheet1.xml';
  const parts: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook xmlns="${MAIN}" xmlns:r="${REL}">` +
        (book.date1904 === true ? '<workbookPr date1904="1"/>' : '') +
        `<sheets><sheet name="${book.sheetName ?? 'Sales'}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${REL}/worksheet" Target="${target}"/></Relationships>`,
    ),
    [`xl/${target}`]: strToU8(
      `<?xml version="1.0"?><worksheet xmlns="${MAIN}"><sheetData>${book.sheetData}</sheetData></worksheet>`,
    ),
  };
  if (book.shared !== undefined)
    parts['xl/sharedStrings.xml'] = strToU8(
      `<?xml version="1.0"?><sst xmlns="${MAIN}">${book.shared.map((text) => `<si>${text}</si>`).join('')}</sst>`,
    );
  if (book.styles !== undefined)
    parts['xl/styles.xml'] = strToU8(
      `<?xml version="1.0"?><styleSheet xmlns="${MAIN}">${book.styles}</styleSheet>`,
    );
  return zipSync(parts);
}

/** Styles 0 general, 1 date (14), 2 month (17), 3 percent (10), 4 custom "yyyy-mm", 5 custom "0.0%". */
const STYLES =
  '<numFmts><numFmt numFmtId="164" formatCode="yyyy\\-mm"/><numFmt numFmtId="165" formatCode="0.0&quot;%&quot;%"/></numFmts>' +
  '<cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="17"/><xf numFmtId="10"/>' +
  '<xf numFmtId="164"/><xf numFmtId="165"/></cellXfs>';

describe('readXlsx', () => {
  it('reads the first sheet: shared and inline strings, numbers without float noise', () => {
    const read = readXlsx(
      workbook({
        shared: ['<t>Month</t>', '<r><t>Sa</t></r><r><t>les</t></r>', '<t>Jan</t>'],
        sheetData:
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>0.30000000000000004</v></c></row>' +
          '<row r="3"><c r="A3" t="inlineStr"><is><t>Feb</t></is></c><c r="B3"><f>B2*2</f><v>1200.5</v></c></row>',
      }),
    );
    expect(read).toEqual({
      sheet: 'Sales',
      rows: [
        ['Month', 'Sales'],
        ['Jan', '0.3'],
        ['Feb', '1200.5'],
      ],
      truncated: false,
    });
  });

  it('writes dates as ISO days or months and percentages with a % sign', () => {
    const read = readXlsx(
      workbook({
        styles: STYLES,
        sheetData:
          '<row r="1"><c r="A1" s="1"><v>46037</v></c><c r="B1" s="2"><v>46037</v></c>' +
          '<c r="C1" s="3"><v>0.125</v></c><c r="D1" s="4"><v>46037</v></c><c r="E1" s="5"><v>0.5</v></c></row>',
      }),
    );
    expect(read.rows).toEqual([['2026-01-15', '2026-01', '12.5%', '2026-01', '50%']]);
  });

  it('counts dates from 1904 when the workbook says so', () => {
    const read = readXlsx(
      workbook({
        date1904: true,
        styles: STYLES,
        sheetData: '<row r="1"><c r="A1" s="1"><v>0</v></c></row>',
      }),
    );
    expect(read.rows).toEqual([['1904-01-01']]);
  });

  it('places sparse cells in their columns and trims empty trailing rows and columns', () => {
    const read = readXlsx(
      workbook({
        sheetData:
          '<row r="1"><c r="A1" t="str"><v>Name</v></c><c r="C1" t="str"><v>Score</v></c><c r="F1" t="str"><v> </v></c></row>' +
          '<row r="2"><c r="C2" t="b"><v>1</v></c><c r="D2" t="e"><v>#DIV/0!</v></c></row>' +
          '<row r="3"/><row r="4"><c r="A4" t="str"><v></v></c></row>',
      }),
    );
    expect(read.rows).toEqual([
      ['Name', '', 'Score'],
      ['', '', 'TRUE'],
    ]);
  });

  it('skips phonetic hints in shared strings', () => {
    const read = readXlsx(
      workbook({
        shared: ['<t>東京</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh>'],
        sheetData: '<row r="1"><c r="A1" t="s"><v>0</v></c></row>',
      }),
    );
    expect(read.rows).toEqual([['東京']]);
  });

  it('follows the workbook’s relationship to the sheet and its name', () => {
    const read = readXlsx(
      workbook({
        sheetName: 'المبيعات',
        target: 'worksheets/data.xml',
        sheetData: '<row r="1"><c r="A1"><v>7</v></c></row>',
      }),
    );
    expect(read).toMatchObject({ sheet: 'المبيعات', rows: [['7']] });
  });

  it('cuts the sheet at its limits and says so', () => {
    const rows = Array.from(
      { length: 6 },
      (_, index) =>
        `<row r="${String(index + 1)}"><c r="A${String(index + 1)}"><v>${String(index)}</v></c>` +
        `<c r="B${String(index + 1)}"><v>1</v></c><c r="C${String(index + 1)}"><v>2</v></c></row>`,
    ).join('');
    const read = readXlsx(workbook({ sheetData: rows }), { maxRows: 3, maxColumns: 2 });
    expect(read.truncated).toBe(true);
    expect(read.rows).toEqual([
      ['0', '1'],
      ['1', '1'],
      ['2', '1'],
    ]);
  });

  it('refuses what is not a workbook, has no sheet, or is too large', () => {
    expect(() => readXlsx(strToU8('Month,Sales\nJan,1'))).toThrow(XlsxReadError);
    expect(() => readXlsx(zipSync({ 'word/document.xml': strToU8('<w/>') }))).toThrow(
      'not an Excel workbook',
    );
    const noSheets = zipSync({
      'xl/workbook.xml': strToU8(`<workbook xmlns="${MAIN}"><sheets/></workbook>`),
    });
    expect(() => readXlsx(noSheets)).toThrow('no sheets');
    expect(() =>
      readXlsx(workbook({ sheetData: '<row r="1"><c r="A1"><v>1</v></c></row>' }), {
        maxPartBytes: 64,
      }),
    ).toThrow('too large');
    const broken = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets>'),
    });
    expect(() => readXlsx(broken)).toThrow('not valid XML');
  });
});

describe('rowsToCsv', () => {
  it('quotes a cell with a comma, quote or line break', () => {
    expect(
      rowsToCsv([
        ['City', 'Note'],
        ['Amman, JO', 'say "hi"'],
        ['Irbid', 'two\nlines'],
      ]),
    ).toBe('City,Note\n"Amman, JO","say ""hi"""\nIrbid,"two\nlines"');
  });
});
