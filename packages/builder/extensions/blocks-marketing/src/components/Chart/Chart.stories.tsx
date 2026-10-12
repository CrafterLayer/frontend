import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Chart } from './Chart';
import { chartExamples } from './examples';
import { chartSchema } from './schema';

const node: Node = { id: 'chart-story', type: 'chart', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  chartSchema.props.parse({
    ...(chartExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });

const meta = {
  title: 'Builder/Blocks/Chart',
  component: Chart,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MonthlyRevenueBars: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'Monthly revenue' })).toBeVisible();
    await expect(canvasElement.querySelectorAll('[data-chart-bar]')).toHaveLength(6);
    const table = canvas.getByRole('table', { name: 'Monthly revenue' });
    await expect(within(table).getByRole('rowheader', { name: 'Jun' })).toBeInTheDocument();
  },
};

export const VisitorsLine: Story = {
  args: {
    node: { ...node, id: 'chart-line' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-chart-line]')).toHaveLength(2);
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(2);
  },
};

export const StackedArea: Story = {
  args: {
    node: { ...node, id: 'chart-area' },
    props: exampleProps(2),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const StackedBarsWithTotals: Story = {
  args: {
    node: { ...node, id: 'chart-stacked' },
    props: exampleProps(2, { chartType: 'bar', showValues: true, height: 'md' }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

/* Gains and losses: bars grow both ways from a zero line, and their labels follow. */
export const NegativeValues: Story = {
  args: {
    node: { ...node, id: 'chart-negative' },
    props: chartSchema.props.parse({
      title: 'Net change by region',
      categories: ['North', 'South', 'East', 'West', 'Central'],
      series: [{ name: 'Net change', values: [12.5, -8, 4, -15.5, 9] }],
      valueSuffix: '%',
      showValues: true,
      palette: 'mono',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const ArabicBudgetDonut: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'chart-arabic' },
    props: exampleProps(3),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'توزيع الميزانية' })).toBeVisible();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(5);
  },
};

/* RTL bars: the plot mirrors so the first month sits at the inline start; the labels do not. */
export const ArabicBars: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'chart-arabic-bars' },
    props: chartSchema.props.parse({
      title: 'الإيرادات الشهرية',
      categories: ['يناير', 'فبراير', 'مارس', 'أبريل'],
      series: [
        { name: 'الإيرادات', values: [42, 58, 64, 81] },
        { name: 'التكاليف', values: [30, 34, 41, 45] },
      ],
      valueSuffix: ' ألف',
      palette: 'mixed',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const PieOnDarkSection: Story = {
  args: {
    node: { ...node, id: 'chart-pie-dark' },
    props: exampleProps(3, {
      chartType: 'pie',
      title: 'Budget split',
      description: 'Share of the annual budget by area.',
      categories: ['Marketing', 'Engineering', 'Operations', 'Support', 'Other'],
      series: [{ name: 'Share', values: [35, 30, 18, 12, 5] }],
      valueSuffix: '%',
      showValues: false,
      variant: 'plain',
      tone: 'dark',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

/* The library card: what a person sees the moment they insert a Chart. */
export const LibraryDefault: Story = {
  args: {
    node: { ...node, id: 'chart-default' },
    props: chartSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

export const EmptyOnCanvas: Story = {
  args: {
    node: { ...node, id: 'chart-empty' },
    props: chartSchema.props.parse({ title: 'Add data to draw this chart', series: [] }),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): the title, category labels and legend names are parts on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'chart-parts' },
    props: exampleProps(1, { partStyles: { category: { className: 'font-semibold' } } }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-ck-part="category"]');
    await expect(labels[1]).toHaveAttribute('data-ck-bind', 'categories.1');
    await expect(labels[1]).toHaveClass('font-semibold');
    const names = canvasElement.querySelectorAll('[data-ck-part="dataset.name"]');
    await expect(names[1]).toHaveAttribute('data-ck-bind', 'series.1.name');
  },
};

/* A 390px column: the plot scales down, crowded axis labels thin out, the legend wraps. */
export const Mobile: Story = {
  args: {
    node: { ...node, id: 'chart-mobile' },
    props: exampleProps(2, { chartType: 'line', stacked: false }),
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
    const plot = canvasElement.querySelector('svg');
    await expect(plot?.getBoundingClientRect().width).toBeLessThan(390);
  },
};
