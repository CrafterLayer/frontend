import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Table } from './Table';
import { tableExamples } from './examples';
import { tableSchema } from './schema';

/*
  The interactive tools as a client render draws them (the canvas, Preview,
  Storybook): React sorts, filters and pages. The published page's pack is
  proven on the block's own static markup in Table.static.test.tsx.
*/
const node: Node = { id: 'tools', type: 'table', props: {} };

const PARTS = {
  title: 'Spare parts',
  columns: [
    { label: 'Part', align: 'start' },
    { label: 'Stock', align: 'end' },
    { label: 'Price', align: 'end' },
    { label: 'Restocked', align: 'end' },
  ],
  rows: [
    { cells: ['Brake pads', '42', '$38.00', '28/09/2026'] },
    { cells: ['Oil filter', '120', '$9.50', '2026-10-02'] },
    { cells: ['Air filter', '64', '', '15/09/2026'] },
    { cells: ['Timing belt', '12', '$64.00', '2026-07-21'] },
  ],
};

function renderTable(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Table
      node={node}
      props={tableSchema.props.parse({ ...PARTS, ...overrides })}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

const firstCells = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.firstElementChild?.textContent);

describe('Table tools — off by default', () => {
  it('draws no control and keeps every row when no tool is on', () => {
    const { container } = renderTable();
    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(firstCells()).toEqual(['Brake pads', 'Oil filter', 'Air filter', 'Timing belt']);
    expect(container.querySelector('table')).not.toHaveAttribute('id');
    expect(container.querySelector('[data-table-scroll]')).not.toHaveClass('max-h-[70vh]');
  });
});

describe('Table tools — sort', () => {
  it('turns each header into a button and sorts numbers, prices and dates by value', () => {
    renderTable({ sortable: true });
    const headers = screen.getAllByRole('columnheader');
    const stock = within(headers[1]!).getByRole('button', { name: 'Stock' });
    fireEvent.click(stock);
    expect(headers[1]).toHaveAttribute('aria-sort', 'ascending');
    expect(headers[1]).toHaveAttribute('data-sort-up', '');
    expect(firstCells()).toEqual(['Timing belt', 'Brake pads', 'Air filter', 'Oil filter']);
    fireEvent.click(stock);
    expect(headers[1]).toHaveAttribute('aria-sort', 'descending');
    expect(firstCells()).toEqual(['Oil filter', 'Air filter', 'Brake pads', 'Timing belt']);

    fireEvent.click(within(headers[2]!).getByRole('button', { name: 'Price' }));
    expect(headers[1]).not.toHaveAttribute('aria-sort');
    /* The empty price sorts last. */
    expect(firstCells()).toEqual(['Oil filter', 'Brake pads', 'Timing belt', 'Air filter']);
    fireEvent.click(within(headers[2]!).getByRole('button', { name: 'Price' }));
    expect(firstCells()).toEqual(['Timing belt', 'Brake pads', 'Oil filter', 'Air filter']);

    fireEvent.click(within(headers[3]!).getByRole('button', { name: 'Restocked' }));
    expect(firstCells()).toEqual(['Timing belt', 'Air filter', 'Brake pads', 'Oil filter']);
  });

  it('reads Arabic-Indic digits and collates Arabic names in an Arabic page', () => {
    const arabic = tableSchema.props.parse(
      (tableExamples[4]?.node as { props: Record<string, unknown> }).props,
    );
    render(
      <div lang="ar" dir="rtl">
        <Table
          node={node}
          props={{ ...arabic, pageSize: 0 }}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>,
    );
    const headers = screen.getAllByRole('columnheader');
    fireEvent.click(within(headers[2]!).getByRole('button', { name: 'السعر' }));
    expect(firstCells()).toEqual([
      'تنظيف أسنان',
      'خلع ضرس',
      'حشوة تجميلية',
      'تقويم شفاف',
      'تبييض الأسنان',
      'علاج عصب',
    ]);
    fireEvent.click(within(headers[0]!).getByRole('button', { name: 'الخدمة' }));
    expect(firstCells()).toEqual([
      'تبييض الأسنان',
      'تقويم شفاف',
      'تنظيف أسنان',
      'حشوة تجميلية',
      'خلع ضرس',
      'علاج عصب',
    ]);
  });

  it('leaves a table without a header row unsortable', () => {
    renderTable({ sortable: true, headerRow: false });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('Table tools — search', () => {
  it('filters through a labelled box and announces the count politely', () => {
    renderTable({ searchable: true });
    const box = screen.getByRole('searchbox', { name: 'Search the table' });
    expect(box).toHaveAttribute('placeholder', 'Type to filter rows');
    expect(box).toHaveAttribute('aria-controls', 'tools-table');
    expect(screen.getByRole('table')).toHaveAttribute('id', 'tools-table');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('4 of 4 rows');
    fireEvent.change(box, { target: { value: 'FILTER' } });
    expect(firstCells()).toEqual(['Oil filter', 'Air filter']);
    expect(status).toHaveTextContent('2 of 4 rows');
    expect(screen.getByText('No matching rows')).not.toBeVisible();
    fireEvent.change(box, { target: { value: 'gearbox' } });
    expect(firstCells()).toEqual([]);
    expect(status).toHaveTextContent('0 of 4 rows');
    expect(screen.getByText('No matching rows')).toBeVisible();
  });

  it('folds Arabic forms and digits, and counts in Arabic-Indic digits for an Arabic template', () => {
    renderTable({
      searchable: true,
      searchLabel: 'ابحث في الجدول',
      countLabel: '{shown} من {total}',
      rows: [{ cells: ['أحمد', '٣٠'] }, { cells: ['مدرسة', '12'] }],
    });
    fireEvent.change(screen.getByRole('searchbox', { name: 'ابحث في الجدول' }), {
      target: { value: 'احمد 30' },
    });
    expect(firstCells()).toEqual(['أحمد']);
    expect(screen.getByRole('status')).toHaveTextContent('١ من ٢');
  });
});

describe('Table tools — pages', () => {
  it('pages with real buttons that stay focusable at either end', () => {
    renderTable({ pageSize: 3 });
    const pager = screen.getByRole('navigation', { name: 'Table pages' });
    const previous = within(pager).getByRole('button', { name: 'Previous' });
    const next = within(pager).getByRole('button', { name: 'Next' });
    expect(within(pager).getByText('Page 1 of 2')).toBeVisible();
    expect(firstCells()).toEqual(['Brake pads', 'Oil filter', 'Air filter']);
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(previous).not.toBeDisabled();
    fireEvent.click(previous);
    expect(within(pager).getByText('Page 1 of 2')).toBeVisible();
    fireEvent.click(next);
    expect(firstCells()).toEqual(['Timing belt']);
    expect(within(pager).getByText('Page 2 of 2')).toHaveAttribute('aria-live', 'polite');
    expect(next).toHaveAttribute('aria-disabled', 'true');
    next.focus();
    expect(next).toHaveFocus();
  });

  it('returns to the first page on a new search or sort', () => {
    renderTable({ pageSize: 2, searchable: true, sortable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(screen.getByText('Page 1 of 2')).toBeVisible();
    expect(firstCells()).toEqual(['Timing belt', 'Brake pads']);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'filter' } });
    expect(screen.getByText('Page 1 of 1')).toBeVisible();
  });

  it('draws no pager when every row fits on one page', () => {
    renderTable({ pageSize: 10 });
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('Table tools — sticky header', () => {
  it('scrolls inside the region under a header with a ground of its own', () => {
    const { container } = renderTable({ stickyHeader: true });
    expect(container.querySelector('[data-table-scroll]')).toHaveClass(
      'max-h-[70vh]',
      'overflow-y-auto',
    );
    expect(screen.getAllByRole('columnheader')[0]).toHaveClass(
      'sticky',
      'top-0',
      'bg-surface',
      'text-text',
    );
    const { container: dark } = renderTable({
      stickyHeader: true,
      variant: 'minimal',
      tone: 'dark',
    });
    expect(dark.querySelector('thead th')).toHaveClass('bg-surface-inverse', 'text-text-inverse');
  });
});

describe('Table tools — on the canvas', () => {
  it('works while every tool word is a part the person can edit in place', () => {
    const { container } = renderTable({ sortable: true, searchable: true, pageSize: 3 }, true);
    for (const name of [
      'searchLabel',
      'countLabel',
      'noResultsLabel',
      'previousLabel',
      'nextLabel',
      'pageLabel',
    ]) {
      expect(container.querySelector(`[data-ck-part="${name}"]`), name).toHaveAttribute(
        'data-ck-bind',
        name,
      );
    }
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    /* Sorted rows keep their document index: an edit lands on the right row. */
    expect(container.querySelector('tbody tr')).toHaveAttribute('data-ck-bind', 'rows.3');
  });
});
