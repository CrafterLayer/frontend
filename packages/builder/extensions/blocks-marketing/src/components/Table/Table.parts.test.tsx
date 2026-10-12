import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Table } from './Table';
import { tableSchema, type TableProps } from './schema';

/*
  Block parts (DESIGN §4.3): the heading, the caption, every column header and
  its label, every row and every cell are addressable on the canvas, carry
  nothing extra when published, take classes and direction from `partStyles`,
  and render an inline editor swapped in at its bind exactly once.
*/
const node: Node = { id: 'table-parts', type: 'table', props: {} };

const FULL = {
  title: 'Opening hours',
  caption: 'Closed on public holidays.',
  columns: [
    { label: 'Day', align: 'start' },
    { label: 'Hours', align: 'end' },
  ],
  rows: [{ cells: ['Monday', '9–17'] }, { cells: ['Tuesday'] }],
};

type Swap = (props: TableProps) => TableProps;

function renderTable(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = tableSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Table node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Table parts', () => {
  it('stamps the heading, caption, column headers, rows and every present cell on the canvas', () => {
    const { container } = renderTable({}, true);
    expect(partsNamed(container, 'title')[0]).toHaveAttribute('data-ck-bind', 'title');
    expect(partsNamed(container, 'caption')[0]?.tagName).toBe('CAPTION');
    expect(partsNamed(container, 'columns')[0]?.tagName).toBe('TR');
    expect(partsNamed(container, 'column')[1]).toHaveAttribute('data-ck-bind', 'columns.1');
    expect(partsNamed(container, 'column.label').map((label) => label.dataset['ckBind'])).toEqual([
      'columns.0.label',
      'columns.1.label',
    ]);
    expect(partsNamed(container, 'rows')[0]?.tagName).toBe('TBODY');
    expect(partsNamed(container, 'row')[1]).toHaveAttribute('data-ck-bind', 'rows.1');
    const cells = partsNamed(container, 'row.cell');
    /* The second row's missing cell is drawn, but there is no value there to edit. */
    expect(cells.map((cell) => cell.dataset['ckPartIndex'])).toEqual(['0.0', '0.1', '1.0']);
    expect(cells[0]?.tagName).toBe('TH');
    expect(cells[1]).toHaveAttribute('data-ck-bind', 'rows.0.cells.1');
  });

  it('publishes no part markers', () => {
    const { container } = renderTable({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('table', { name: 'Opening hours' })).toBeInTheDocument();
  });

  it('applies an all-items style to every cell and a this-item style to one, this winning', () => {
    const { container } = renderTable(
      {
        partStyles: {
          'row.cell': { className: 'font-bold' },
          'row.cell@0.1': { className: 'font-regular', dir: 'ltr' },
        },
      },
      true,
    );
    const cells = partsNamed(container, 'row.cell');
    expect(cells[0]).toHaveClass('font-bold');
    /* The automatic direction moves to the value; a direction a person chose stays on the cell. */
    expect(cells[0]).not.toHaveAttribute('dir');
    expect(cells[1]).toHaveClass('font-regular', 'text-end');
    expect(cells[1]).not.toHaveClass('font-bold');
    expect(cells[1]).toHaveAttribute('dir', 'ltr');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderTable({}, true, (props) => ({
      ...props,
      title: swapped('title'),
      caption: swapped('caption'),
      columns: props.columns.map((column, index) => ({
        ...column,
        label: swapped(`columns.${String(index)}.label`),
      })),
      rows: props.rows.map((row, index) => ({
        cells: row.cells.map((_, at) => swapped(`rows.${String(index)}.cells.${String(at)}`)),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'title',
      'caption',
      'columns.1.label',
      'rows.0.cells.0',
      'rows.0.cells.1',
      'rows.1.cells.0',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
