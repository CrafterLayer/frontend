import { fireEvent, render, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { mountSiteBehaviors } from '@craftkit/builder-renderer';
import type { Node } from '@craftkit/builder-schema';

import { Table } from './Table';
import { tableExamples } from './examples';
import { tableSchema, type TableProps } from './schema';

/*
  The published page never hydrates: the static render is the whole table,
  and the `table-tools` behaviour pack (renderer behaviors/packs/table-tools.ts)
  sorts, filters and pages it. These tests run the real pack on the block's
  real markup and hold its row order to the live React render's.
*/
const node: Node = { id: 'static', type: 'table', props: {} };

const exampleProps = (index: number): TableProps =>
  tableSchema.props.parse((tableExamples[index]?.node as { props: unknown }).props);

function staticHost(props: TableProps, lang = 'en'): HTMLElement {
  const host = document.createElement('main');
  host.lang = lang;
  host.innerHTML = renderToStaticMarkup(
    <Table node={node} props={props} slots={{}} data={{}} isCanvas={false} />,
  );
  document.body.appendChild(host);
  return host;
}

const visibleFirstCells = (root: ParentNode) =>
  [...root.querySelectorAll('tbody tr')]
    .filter((row) => !row.hasAttribute('hidden'))
    .map((row) => row.firstElementChild?.textContent);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Table — static markup', () => {
  it('ships no behaviour, template or key while every tool is off', () => {
    const host = staticHost(tableSchema.props.parse({}));
    expect(host.querySelector('[data-ck-behavior]')).toBeNull();
    expect(host.querySelector('template')).toBeNull();
    expect(
      host.querySelector('[data-ck-key],[data-ck-table-sort],[data-ck-table-search]'),
    ).toBeNull();
    expect(host.querySelector('table')).not.toHaveAttribute('id');
  });

  it('is the whole table with the tools hidden, so a page without script reads every row', () => {
    const props = exampleProps(3);
    const host = staticHost(props);
    const section = host.querySelector('section')!;
    expect(section).toHaveAttribute('data-ck-behavior', 'table-tools');
    expect(section).toHaveAttribute('data-ck-page-size', '5');
    expect(visibleFirstCells(host)).toEqual(props.rows.map((row) => row.cells[0]));
    for (const selector of [
      '[data-ck-table-search]',
      '[data-ck-table-pager]',
      '[data-ck-table-empty]',
    ]) {
      expect(host.querySelector(selector), selector).toHaveAttribute('hidden');
    }
    expect(host.querySelector('thead button')).toBeNull();
    expect(
      [...host.querySelectorAll('th[data-ck-table-sort]')].map((th) =>
        th.getAttribute('data-ck-table-sort'),
      ),
    ).toEqual(['text', 'number', 'number', 'date']);
    expect(host.querySelector('tbody tr td:nth-child(3)')).toHaveAttribute('data-ck-key', '38');
    expect(host.querySelector('tbody tr td:nth-child(4)')).toHaveAttribute(
      'data-ck-key',
      String(Date.UTC(2026, 8, 28)),
    );
    expect(host.querySelector('[data-ck-table-count]')).toHaveAttribute(
      'data-ck-table-count',
      '{shown} of {total} rows',
    );
    expect(host.querySelector('[data-ck-table-page]')).toHaveTextContent('Page 1 of 2');
    const button = host.querySelector<HTMLTemplateElement>('template[data-ck-table-button]')!;
    /* A template's content lives in its own inert document, so it is read, not matched. */
    expect(button.content.querySelector('button')?.getAttribute('type')).toBe('button');
    expect(button.content.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    /* The sticky header is CSS alone. */
    expect(host.querySelector('thead th')).toHaveClass('sticky');
  });
});

describe('Table — the published page’s pack on the block’s markup', () => {
  it('sorts every column in both directions exactly as the live render does', () => {
    for (const [index, lang] of [
      [3, 'en'],
      [4, 'ar'],
    ] as const) {
      const props = { ...exampleProps(index), pageSize: 0, searchable: false };
      const host = staticHost(props, lang);
      const dispose = mountSiteBehaviors(host);
      const live = render(
        <div lang={lang}>
          <Table node={node} props={props} slots={{}} data={{}} isCanvas={false} />
        </div>,
      );
      props.columns.forEach((column, columnIndex) => {
        for (const direction of ['ascending', 'descending']) {
          const published = host.querySelectorAll('thead th')[columnIndex]!;
          published.querySelector('button')!.click();
          fireEvent.click(
            within(
              live.container.querySelectorAll('thead th')[columnIndex] as HTMLElement,
            ).getByRole('button'),
          );
          expect(published, `${column.label} ${direction}`).toHaveAttribute('aria-sort', direction);
          expect(visibleFirstCells(host), `${column.label} ${direction}`).toEqual(
            visibleFirstCells(live.container),
          );
        }
      });
      live.unmount();
      dispose();
    }
  });

  it('filters, counts and pages in the page’s words, in Arabic too', () => {
    const host = staticHost(exampleProps(4), 'ar');
    mountSiteBehaviors(host);
    expect(host.querySelector('[data-ck-table-search]')).not.toHaveAttribute('hidden');
    const label = host.querySelector('label')!;
    expect(label).toHaveTextContent('ابحث في الخدمات');
    expect(host.querySelector(`#${label.htmlFor}`)).toHaveAttribute('type', 'search');
    expect(host.querySelector('[data-ck-table-count]')).toHaveTextContent('٦ من ٦ خدمة');
    expect(host.querySelector('[data-ck-table-page]')).toHaveTextContent('الصفحة ١ من ٢');
    expect(visibleFirstCells(host)).toHaveLength(4);
    host.querySelector<HTMLButtonElement>('[data-ck-table-next]')!.click();
    expect(visibleFirstCells(host)).toEqual(['علاج عصب', 'تقويم شفاف']);
    const input = host.querySelector('input')!;
    input.value = 'اسنان';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visibleFirstCells(host)).toEqual(['تنظيف أسنان', 'تبييض الأسنان']);
    expect(host.querySelector('[data-ck-table-count]')).toHaveTextContent('٢ من ٦ خدمة');
    expect(host.querySelector('[data-ck-table-page]')).toHaveTextContent('الصفحة ١ من ١');
    input.value = 'زراعة';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.querySelector('[data-ck-table-empty]')).not.toHaveAttribute('hidden');
    expect(host.querySelector('[data-ck-table-empty]')).toHaveTextContent('لا توجد خدمات مطابقة');
  });
});
