import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { behaviorRuntimeScript, pageBehaviorPacks } from '../script';
import { mountTableTools } from './table-tools';

/*
  The markup the Table block (blocks-marketing components/Table) renders for a
  published page: every row in document order, sortable headers naming their
  sort, each number or date cell carrying the key the block read from it, the
  sort button as a template, and the search box, empty message and pager
  shipped hidden. Cell text is set with textContent, as the block's escaped
  markup would carry it. (Table.static.test.tsx runs this pack on the block's
  real markup.)
*/
interface Fixture {
  readonly columns?: readonly string[];
  /** How each column sorts: number, date or text. */
  readonly kinds?: readonly string[];
  readonly rows?: readonly (readonly string[])[];
  /** The block's key per cell of a number or date column; '' writes none. */
  readonly keys?: readonly (readonly (string | number)[])[];
  readonly pageSize?: number;
  readonly count?: string;
  readonly lang?: string;
}

const COLUMNS = ['Service', 'Price', 'Date'];
const KINDS = ['text', 'number', 'date'];
const ROWS = [
  ['Strategy session', '$120', '14/03/2026'],
  ['Brand review', '$1,240', '2026-01-02'],
  ['Website audit', '', '30/12/2025'],
  ['Team workshop', '$60', '1 Feb 2026'],
];
const KEYS = [
  ['', 120, Date.UTC(2026, 2, 14)],
  ['', 1240, Date.UTC(2026, 0, 2)],
  ['', '', Date.UTC(2025, 11, 30)],
  ['', 60, Date.UTC(2026, 1, 1)],
];

function host(fixture: Fixture = {}): HTMLElement {
  const rows = fixture.rows ?? ROWS;
  const keys = fixture.keys ?? (fixture.rows === undefined ? KEYS : []);
  const size =
    fixture.pageSize === undefined ? '' : ` data-ck-page-size="${String(fixture.pageSize)}"`;
  document.body.innerHTML = `<main${fixture.lang === undefined ? '' : ` lang="${fixture.lang}"`}>
    <section data-ck-behavior="table-tools"${size}>
      <div data-ck-table-search hidden>
        <label for="q">Search</label><input id="q" type="search" data-ck-table-query>
        <p role="status" data-ck-table-count></p>
      </div>
      <template data-ck-table-button><button type="button" class="sort"><svg aria-hidden="true"></svg></button></template>
      <div role="region" tabindex="0" aria-label="Scrollable table"><table>
        <thead><tr></tr></thead><tbody></tbody>
      </table></div>
      <p data-ck-table-empty hidden>No matching rows</p>
      <nav aria-label="Table pages" data-ck-table-pager hidden>
        <button type="button" data-ck-table-prev>Previous</button>
        <p aria-live="polite" data-ck-table-page>Page 1 of 1</p>
        <button type="button" data-ck-table-next>Next</button>
      </nav>
    </section></main>`;
  const section = document.querySelector('section')!;
  section
    .querySelector('[data-ck-table-count]')!
    .setAttribute('data-ck-table-count', fixture.count ?? '{shown} of {total} rows');
  section
    .querySelector('[data-ck-table-page]')!
    .setAttribute('data-ck-table-page', 'Page {page} of {pages}');
  const head = section.querySelector('thead tr')!;
  (fixture.columns ?? COLUMNS).forEach((label, index) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.setAttribute('data-ck-table-sort', (fixture.kinds ?? KINDS)[index] ?? 'text');
    const span = document.createElement('span');
    span.textContent = label;
    th.appendChild(span);
    head.appendChild(th);
  });
  const body = section.querySelector('tbody')!;
  rows.forEach((cells, rowIndex) => {
    const tr = document.createElement('tr');
    cells.forEach((text, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      const key = keys[rowIndex]?.[index] ?? '';
      if (key !== '') cell.setAttribute('data-ck-key', String(key));
      const bdi = document.createElement('bdi');
      bdi.textContent = text;
      cell.appendChild(bdi);
      tr.appendChild(cell);
    });
    body.appendChild(tr);
  });
  return section;
}

const firstCells = (el: Element, all = false) =>
  [...el.querySelectorAll('tbody tr')]
    .filter((row) => all || !row.hasAttribute('hidden'))
    .map((row) => row.firstElementChild?.textContent);
const sortButton = (el: Element, column: number) =>
  el.querySelectorAll('thead th')[column]!.querySelector('button')!;
const countOf = (el: Element) => el.querySelector('[data-ck-table-count]')?.textContent;
const statusOf = (el: Element) => el.querySelector('[data-ck-table-page]')?.textContent;

function type(el: Element, value: string): void {
  const input = el.querySelector('input')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountTableTools', () => {
  it('reveals the tools, wraps each sortable label in the block’s button, and writes the count', () => {
    const el = host();
    const dispose = mountTableTools(document);
    expect(el.querySelector('[data-ck-table-search]')).not.toHaveAttribute('hidden');
    expect(el.querySelector('[data-ck-table-pager]')).not.toHaveAttribute('hidden');
    expect(el.querySelector('[data-ck-table-prev]')).toHaveAttribute('aria-disabled', 'true');
    const button = sortButton(el, 1);
    expect(button).toHaveClass('sort');
    expect(button.textContent).toBe('Price');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(countOf(el)).toBe('4 of 4 rows');
    expect(el.querySelector('[data-ck-table-empty]')).toHaveAttribute('hidden');
    dispose();
  });

  it('sorts by the keys the block wrote, empty cells last, flips on a second press, and sets aria-sort', () => {
    const el = host();
    mountTableTools(document);
    sortButton(el, 1).click();
    expect(firstCells(el)).toEqual([
      'Team workshop',
      'Strategy session',
      'Brand review',
      'Website audit',
    ]);
    const headers = el.querySelectorAll('thead th');
    expect(headers[1]).toHaveAttribute('aria-sort', 'ascending');
    sortButton(el, 1).click();
    expect(headers[1]).toHaveAttribute('aria-sort', 'descending');
    /* The arrows read the flag beside aria-sort. */
    expect(headers[1]).toHaveAttribute('data-sort-down', '');
    expect(headers[1]).not.toHaveAttribute('data-sort-up');
    expect(firstCells(el)).toEqual([
      'Brand review',
      'Strategy session',
      'Team workshop',
      'Website audit',
    ]);
    sortButton(el, 2).click();
    expect(headers[1]).not.toHaveAttribute('aria-sort');
    expect(headers[1]).not.toHaveAttribute('data-sort-down');
    expect(headers[2]).toHaveAttribute('aria-sort', 'ascending');
    expect(firstCells(el)).toEqual([
      'Website audit',
      'Brand review',
      'Team workshop',
      'Strategy session',
    ]);
  });

  it('collates text in the page language, and sorts a cell without a key with the empty ones', () => {
    const el = host({
      lang: 'ar',
      columns: ['المنتج', 'السعر'],
      kinds: ['text', 'number'],
      rows: [
        ['يقطين', '١٢٠ ر.س'],
        ['أرز', '٩٫٥ ر.س'],
        ['بصل', '١٬٢٤٠ ر.س'],
        ['Apple', 'عند الطلب'],
      ],
      keys: [
        ['', 120],
        ['', 9.5],
        ['', 1240],
        ['', ''],
      ],
    });
    mountTableTools(document);
    sortButton(el, 1).click();
    expect(firstCells(el)).toEqual(['أرز', 'يقطين', 'بصل', 'Apple']);
    sortButton(el, 1).click();
    expect(firstCells(el)).toEqual(['بصل', 'يقطين', 'أرز', 'Apple']);
    sortButton(el, 0).click();
    /* Arabic first on an Arabic page, each alphabet in its own order. */
    expect(firstCells(el)).toEqual(['أرز', 'بصل', 'يقطين', 'Apple']);
  });

  it('sorts a text column by its words, digits by their value, whatever its cells look like', () => {
    const el = host({
      rows: [
        ['b', '10'],
        ['a', '9'],
        ['c', '100'],
      ],
      columns: ['Name', 'Code'],
      kinds: ['text', 'text'],
    });
    mountTableTools(document);
    sortButton(el, 1).click();
    expect(firstCells(el)).toEqual(['a', 'b', 'c']);
  });

  it('filters by every word, folding Arabic letters, marks and digits, and says when nothing matches', () => {
    const el = host({
      rows: [
        ['أحمد علي', '٣٠'],
        ['Café crème', '45'],
        ['مدرسة الرياض', '12'],
      ],
      columns: ['Name', 'Age'],
      count: '{shown} من {total}',
    });
    mountTableTools(document);
    expect(countOf(el)).toBe('٣ من ٣');
    type(el, 'احمد 30');
    expect(firstCells(el)).toEqual(['أحمد علي']);
    expect(countOf(el)).toBe('١ من ٣');
    type(el, 'CAFE');
    expect(firstCells(el)).toEqual(['Café crème']);
    type(el, 'مدرسه');
    expect(firstCells(el)).toEqual(['مدرسة الرياض']);
    type(el, 'nothing here');
    expect(firstCells(el)).toEqual([]);
    expect(el.querySelector('[data-ck-table-empty]')).not.toHaveAttribute('hidden');
    type(el, '');
    expect(firstCells(el)).toHaveLength(3);
    expect(el.querySelector('[data-ck-table-empty]')).toHaveAttribute('hidden');
  });

  it('pages the rows, keeps previous and next focusable at the ends, and returns to page one on a search', () => {
    const rows = Array.from({ length: 7 }, (_, index) => [
      `Row ${String(index + 1)}`,
      String(index),
    ]);
    const el = host({
      rows,
      columns: ['Name', 'N'],
      kinds: ['text', 'number'],
      keys: rows.map((cells) => ['', cells[1] ?? '']),
      pageSize: 3,
    });
    mountTableTools(document);
    const prev = el.querySelector<HTMLButtonElement>('[data-ck-table-prev]')!;
    const next = el.querySelector<HTMLButtonElement>('[data-ck-table-next]')!;
    expect(firstCells(el)).toEqual(['Row 1', 'Row 2', 'Row 3']);
    expect(statusOf(el)).toBe('Page 1 of 3');
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    prev.click();
    expect(statusOf(el)).toBe('Page 1 of 3');
    next.click();
    next.click();
    expect(firstCells(el)).toEqual(['Row 7']);
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(next.disabled).toBe(false);
    next.click();
    expect(statusOf(el)).toBe('Page 3 of 3');
    type(el, 'row');
    expect(statusOf(el)).toBe('Page 1 of 3');
    sortButton(el, 1).click();
    sortButton(el, 1).click();
    expect(firstCells(el)).toEqual(['Row 7', 'Row 6', 'Row 5']);
    /* Every row stays in the document; only the page is shown. */
    expect(firstCells(el, true)).toHaveLength(7);
  });

  it('writes text, never markup: a cell or a template that looks like HTML stays text', () => {
    const el = host({
      rows: [
        ['<img src=x onerror=alert(1)>', '2'],
        ['b', '1'],
      ],
      columns: ['A', 'B'],
      kinds: ['text', 'text'],
      count: '<b>{shown}</b>',
    });
    mountTableTools(document);
    sortButton(el, 1).click();
    expect(el.querySelector('img')).toBeNull();
    expect(firstCells(el)).toEqual(['b', '<img src=x onerror=alert(1)>']);
    expect(countOf(el)).toBe('<b>2</b>');
    expect(el.querySelector('[data-ck-table-count] b')).toBeNull();
  });

  it('draws the first view and listens to nothing on the editing canvas', () => {
    const el = host({ pageSize: 2 });
    mountTableTools(document, { interactive: false });
    expect(firstCells(el)).toEqual(['Strategy session', 'Brand review']);
    sortButton(el, 1).click();
    el.querySelector<HTMLButtonElement>('[data-ck-table-next]')!.click();
    type(el, 'team');
    expect(firstCells(el)).toEqual(['Strategy session', 'Brand review']);
  });

  it('is idempotent, and its disposer restores the order, the headers, the attributes and the texts', () => {
    const el = host({ pageSize: 2 });
    const before = el.innerHTML;
    const dispose = mountTableTools(document);
    const again = mountTableTools(document);
    expect(el.querySelectorAll('thead button')).toHaveLength(3);
    again();
    sortButton(el, 1).click();
    type(el, 'a');
    dispose();
    expect(el.innerHTML).toBe(before);
    dispose();
    mountTableTools(document);
    expect(el.querySelectorAll('thead button')).toHaveLength(3);
  });

  it('stops once its table is removed from the page', () => {
    const el = host();
    mountTableTools(document);
    const button = sortButton(el, 1);
    el.remove();
    button.click();
    expect(firstCells(el)).toEqual(ROWS.map((cells) => cells[0]));
    expect(button.isConnected).toBe(false);
    expect(el.querySelector('thead button')).toBeNull();
    expect(el.querySelector('[data-ck-table-search]')).toHaveAttribute('hidden');
  });

  it('leaves a table without a body alone', () => {
    document.body.innerHTML =
      '<section data-ck-behavior="table-tools"><div data-ck-table-search hidden></div></section>';
    mountTableTools(document)();
    expect(document.querySelector('[data-ck-table-search]')).toHaveAttribute('hidden');
    expect(() => {
      mountTableTools(document.createDocumentFragment())();
    }).not.toThrow();
  });

  it('ships only to a page that carries the marker, within 2.25 kB gzip', () => {
    expect(pageBehaviorPacks('<section data-ck-behavior="table-tools"></section>')).toContain(
      mountTableTools,
    );
    expect(pageBehaviorPacks('<table><tr><td>1</td></tr></table>')).not.toContain(mountTableTools);
    expect(behaviorRuntimeScript(['<section data-table-scroll></section>'])).not.toContain(
      'function mountTableTools',
    );
    /* Measured 2 225 B on 2026-10-12; it adds 1 810 B to the every-pack bundle. */
    expect(gzipSync(mountTableTools.toString()).length).toBeLessThanOrEqual(2304);
  });
});
