import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Table } from './Table';
import { tableExamples } from './examples';
import { tableSchema } from './schema';

const node: Node = { id: 'table', type: 'table', props: {} };

function renderTable(overrides: Record<string, unknown> = {}) {
  return render(
    <Table
      node={node}
      props={tableSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Table', () => {
  it('renders the sample as a semantic table with column and row headers', () => {
    renderTable({ title: 'Services', caption: 'Prices include tax.' });
    expect(screen.getByRole('region', { name: 'Services' })).toHaveClass('@container');
    expect(screen.getByRole('heading', { level: 2, name: 'Services' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Services' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Service', 'Duration', 'Price']);
    for (const header of within(table).getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
    const rowHeader = within(table).getByRole('rowheader', { name: 'Consultation' });
    expect(rowHeader).toHaveAttribute('scope', 'row');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(4);
    expect(within(table).getByRole('cell', { name: '$90' })).toHaveClass(
      'text-end',
      'tabular-nums',
    );
    expect(table.querySelector('caption')).toHaveTextContent('Prices include tax.');
    expect(table.querySelector('caption')).toHaveClass('caption-bottom', 'text-text-muted');
  });

  it('scrolls inside a focusable, labelled region on a narrow screen', () => {
    renderTable({ scrollLabel: 'جدول قابل للتمرير' });
    const region = screen.getByRole('region', { name: 'جدول قابل للتمرير' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('overflow-x-auto', 'rounded-xl', 'bg-surface');
    /* An untitled table is named by nothing but its caption, and its section is no landmark. */
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-labelledby');
    expect(region.closest('section')).not.toHaveAttribute('aria-labelledby');
  });

  it('keeps cells aligned by column while isolating each value’s own direction', () => {
    const { container } = renderTable({
      columns: [
        { label: 'المنتج', align: 'start' },
        { label: 'السعر', align: 'center' },
      ],
      rows: [{ cells: ['iPhone 15', '٣٩٩٩ ر.س'] }],
    });
    const cell = screen.getByRole('cell', { name: '٣٩٩٩ ر.س' });
    expect(cell).toHaveClass('text-center');
    expect(cell).not.toHaveAttribute('dir');
    expect(cell.firstElementChild?.tagName).toBe('BDI');
    expect(container.querySelector('thead th span')).toHaveAttribute('dir', 'auto');
  });

  it('draws missing cells empty, drops cells past the last column, and can drop both header kinds', () => {
    renderTable({
      columns: [{ label: 'A' }, { label: 'B' }],
      rows: [{ cells: ['only'] }, { cells: ['one', 'two', 'three'] }],
      headerRow: false,
      firstColumnIsHeader: false,
    });
    const table = screen.getByRole('table');
    expect(within(table).queryAllByRole('columnheader')).toHaveLength(0);
    expect(within(table).queryAllByRole('rowheader')).toHaveLength(0);
    const rows = within(table).getAllByRole('row');
    expect(rows.map((row) => within(row).getAllByRole('cell').length)).toEqual([2, 2]);
    expect(within(rows[0]!).getAllByRole('cell')[1]).toBeEmptyDOMElement();
    expect(table).not.toHaveTextContent('three');
  });

  it('falls back to its widest row when no columns are declared', () => {
    renderTable({ columns: [], rows: [{ cells: ['a', 'b', 'c'] }, { cells: ['d'] }] });
    const table = screen.getByRole('table');
    expect(within(table).queryByRole('columnheader')).toBeNull();
    /* The first column still reads as row headers; a missing one is an empty cell. */
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['a', 'd']);
    expect(within(table).getAllByRole('row')[1]?.children).toHaveLength(3);
  });

  it('stripes, compacts and strips the frame on request', () => {
    const { container } = renderTable({
      striped: true,
      density: 'compact',
      variant: 'minimal',
      tone: 'dark',
      caption: 'Note',
    });
    const firstRow = container.querySelector('tbody tr');
    expect(firstRow).toHaveClass('even:bg-current/5', 'border-current/10');
    expect(firstRow).not.toHaveClass('last:border-b-0');
    expect(container.querySelector('tbody td')).toHaveClass('px-3', 'py-1.5');
    expect(container.querySelector('[data-table-scroll]')).not.toHaveClass('bg-surface');
    expect(container.querySelector('table')).not.toHaveClass('text-text');
    expect(container.querySelector('thead')).toHaveClass('border-b-2');
    expect(container.querySelector('caption')).toHaveClass('opacity-80');
  });

  it('closes a boxed table without a rule under its last row', () => {
    const { container } = renderTable();
    expect(container.querySelector('tbody tr')).toHaveClass('last:border-b-0');
    expect(container.querySelector('thead')).toHaveClass('bg-current/5');
    expect(container.querySelector('tbody td')).toHaveClass('px-4', 'py-3');
    /* The box's ink sits on the table, a descendant of the surface, so a dark slab leaves it dark. */
    expect(container.querySelector('table')).toHaveClass('text-text');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    const { container } = renderTable({
      background: 'accent',
      fontFamily: 'serif',
      marginInlineEnd: 4,
    });
    const section = container.querySelector('section')!;
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('Table schema', () => {
  it('defaults to a three-by-four sample and maps every inspector prop', () => {
    const defaults = tableSchema.props.parse({});
    expect(defaults.columns).toHaveLength(3);
    expect(defaults.rows).toHaveLength(4);
    expect(defaults).toMatchObject({
      headerRow: true,
      firstColumnIsHeader: true,
      striped: false,
      density: 'comfortable',
      variant: 'boxed',
      scrollLabel: 'Scrollable table',
      spacing: 'md',
      width: 'wide',
    });
    expect(Object.keys(tableSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(tableSchema.props.shape).sort(),
    );
  });

  it('bounds columns, rows and cells', () => {
    const parse = (props: unknown) => tableSchema.props.safeParse(props).success;
    expect(
      parse({ columns: Array.from({ length: 9 }, (_, index) => ({ label: `C${String(index)}` })) }),
    ).toBe(false);
    expect(parse({ rows: Array.from({ length: 51 }, () => ({ cells: [] })) })).toBe(false);
    expect(parse({ rows: [{ cells: Array.from({ length: 9 }, () => 'x') }] })).toBe(false);
    expect(parse({ columns: [{ label: '' }] })).toBe(false);
    expect(parse({ columns: [{ label: 'A', align: 'left' }] })).toBe(false);
    expect(parse({ rows: [{}] })).toBe(true);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of tableExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('table');
      expect(tableSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(tableExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
