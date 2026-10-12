import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Table } from './Table';
import { tableExamples } from './examples';
import { tableSchema } from './schema';

const node: Node = { id: 'table-story', type: 'table', props: {} };
const exampleProps = (index: number) =>
  tableSchema.props.parse((tableExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Table',
  component: Table,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServicesAndPrices: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', { name: 'Services and prices' });
    await expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    await expect(within(table).getByRole('rowheader', { name: 'Brand review' })).toBeVisible();
    await expect(canvas.getByRole('region', { name: /Scrollable table/u })).toHaveAttribute(
      'tabindex',
      '0',
    );
  },
};

export const CompactStriped: Story = {
  args: {
    node: { ...node, id: 'table-compact' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const ArabicClinicHours: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'table-arabic' },
    props: exampleProps(2),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', { name: 'مواعيد العيادة' });
    await expect(within(table).getByRole('rowheader', { name: 'الجمعة' })).toBeVisible();
  },
};

/* The library card: what a person sees the moment they insert a Table. */
export const LibraryDefault: Story = {
  args: {
    node: { ...node, id: 'table-default' },
    props: tableSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): column headers, rows and every cell are parts on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'table-parts' },
    props: tableSchema.props.parse({
      ...(tableExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'column.label': { className: 'text-accent' },
        'row.cell@1.2': { className: 'underline' },
      },
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-ck-part="column.label"]');
    await expect(labels[2]).toHaveAttribute('data-ck-bind', 'columns.2.label');
    await expect(labels[2]).toHaveClass('text-accent');
    const cells = canvasElement.querySelectorAll('[data-ck-part="row.cell"]');
    await expect(cells[5]).toHaveAttribute('data-ck-bind', 'rows.1.cells.2');
    await expect(cells[5]).toHaveClass('underline');
  },
};

/* A 390px column: the table keeps its shape and scrolls inside its labelled region. */
export const Mobile: Story = {
  args: {
    node: { ...node, id: 'table-mobile' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: /Scrollable table/u });
    await expect(region.scrollWidth).toBeGreaterThanOrEqual(region.clientWidth);
    await expect(within(region).getByRole('table')).toBeVisible();
  },
};
