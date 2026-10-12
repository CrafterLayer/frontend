import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { darkTheme, tokenCssName, type Node, type TokenName } from '@craftkit/builder-schema';

import { Table } from './Table';
import { tableExamples } from './examples';
import { tableSchema } from './schema';

const node: Node = { id: 'table-story', type: 'table', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  tableSchema.props.parse({
    ...(tableExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });

/* The dark theme's own tokens on the story root: what a dark site paints the table with. */
const DARK_TOKENS = Object.fromEntries(
  (Object.entries(darkTheme) as [TokenName, string][]).map(([name, value]) => [
    tokenCssName(name),
    value,
  ]),
) as CSSProperties;

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

/* Interactive (all opt-in): the column headers sort numbers, prices and dates by value. */
export const Sortable: Story = {
  args: {
    node: { ...node, id: 'table-sortable' },
    props: exampleProps(3, { searchable: false, pageSize: 0, stickyHeader: false }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stock = canvas.getByRole('button', { name: 'Stock' });
    await userEvent.click(stock);
    await expect(stock.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    await expect(canvas.getAllByRole('rowheader')[0]).toHaveTextContent('Battery 60Ah');
    await userEvent.click(stock);
    await expect(stock.closest('th')).toHaveAttribute('aria-sort', 'descending');
    await expect(canvas.getAllByRole('rowheader')[0]).toHaveTextContent('Oil filter');
  },
};

/* A labelled filter box and a polite "N of M rows". */
export const Searchable: Story = {
  args: {
    node: { ...node, id: 'table-searchable' },
    props: exampleProps(3, { sortable: false, pageSize: 0, stickyHeader: false }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('7 of 7 rows');
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search parts' }), 'filter');
    await expect(canvas.getByRole('status')).toHaveTextContent('2 of 7 rows');
    await expect(canvas.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'Oil filter',
      'Air filter',
    ]);
    await userEvent.clear(canvas.getByRole('searchbox'));
    await userEvent.type(canvas.getByRole('searchbox'), 'gearbox');
    await expect(canvas.getByText('No matching rows')).toBeVisible();
  },
};

/* Five rows a page, with Previous and Next that stay focusable at either end. */
export const Paged: Story = {
  args: {
    node: { ...node, id: 'table-paged' },
    props: exampleProps(3, { sortable: false, searchable: false }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pager = canvas.getByRole('navigation', { name: 'Table pages' });
    await expect(within(pager).getByText('Page 1 of 2')).toBeVisible();
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(5);
    const next = within(pager).getByRole('button', { name: 'Next' });
    next.focus();
    await userEvent.keyboard('{Enter}');
    await expect(within(pager).getByText('Page 2 of 2')).toBeVisible();
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(2);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toHaveFocus();
  },
};

/* Arabic, right to left: Arabic-Indic prices sort by value, the words are the page's own. */
export const ArabicInteractive: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'table-arabic-tools' },
    props: exampleProps(4),
    slots: {},
    data: {},
    isCanvas: false,
  },
  decorators: [
    (Story) => (
      <div lang="ar">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('٦ من ٦ خدمة');
    await userEvent.click(canvas.getByRole('button', { name: 'السعر' }));
    await expect(canvas.getAllByRole('rowheader')[0]).toHaveTextContent('تنظيف أسنان');
    await userEvent.type(canvas.getByRole('searchbox', { name: 'ابحث في الخدمات' }), 'اسنان');
    await expect(canvas.getByRole('status')).toHaveTextContent('٢ من ٦ خدمة');
    await expect(canvas.getByText('الصفحة ١ من ١')).toBeVisible();
  },
};

/* The dark theme's tokens: the field, the buttons and the sticky header take the dark surface. */
export const DarkTheme: Story = {
  args: {
    node: { ...node, id: 'table-dark' },
    props: exampleProps(3),
    slots: {},
    data: {},
    isCanvas: false,
  },
  decorators: [
    (Story) => (
      <div style={{ ...DARK_TOKENS, background: 'var(--t-surface)', color: 'var(--t-text)' }}>
        <Story />
      </div>
    ),
  ],
};

/* A minimal sticky table on a dark section: the header keeps the section's dark ground. */
export const DarkSectionSticky: Story = {
  args: {
    node: { ...node, id: 'table-dark-section' },
    props: exampleProps(3, { variant: 'minimal', tone: 'dark', pageSize: 0 }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
