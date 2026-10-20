import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Report } from './Report';
import { reportExamples } from './examples';
import { reportSchema } from './schema';

const node: Node = { id: 'report-story', type: 'report', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  reportSchema.props.parse({
    ...(reportExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });

const meta = {
  title: 'Builder/Blocks/Report',
  component: Report,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Report>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MonthlySales: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('img', { name: 'Sales rose for the third month running' }),
    ).toBeVisible();
    await expect(canvasElement.querySelectorAll('[data-report-kpis] li')).toHaveLength(3);
    const table = canvas.getByRole('table');
    await expect(within(table).getByRole('rowheader', { name: 'Jun' })).toBeInTheDocument();
  },
};

/* RTL: the cards, chart and table follow the page direction; the chart mirrors so Q1 sits at the start. */
export const ArabicQuarterly: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'report-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('عن الربع السابق')).toHaveLength(2);
  },
};

export const FunnelWithoutTable: Story = {
  args: {
    node: { ...node, id: 'report-funnel' },
    props: exampleProps(2),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-report-table]')).toBeNull();
    await expect(canvasElement.querySelectorAll('[data-chart-stage]')).toHaveLength(4);
  },
};

/* A worsening reads in the ink with a down arrow; only an improvement wears the success role. */
export const CostsGoingUp: Story = {
  args: {
    node: { ...node, id: 'report-costs' },
    props: reportSchema.props.parse({
      title: 'Costs rose faster than revenue',
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [
        { name: 'Revenue', values: [42, 44, 45, 46] },
        { name: 'Costs', values: [30, 33, 37, 43] },
      ],
      valuePrefix: '$',
      valueSuffix: 'k',
      kpis: [
        { label: 'Revenue', series: 0 },
        { label: 'Costs', series: 1, better: 'down' },
      ],
      chartType: 'hbar',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const OnDarkSection: Story = {
  args: {
    node: { ...node, id: 'report-dark' },
    props: exampleProps(0, { tone: 'dark', variant: 'plain', chartType: 'line' }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

/* The library card: what a person sees the moment they insert a Report. */
export const LibraryDefault: Story = {
  args: {
    node: { ...node, id: 'report-default' },
    props: reportSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-ck-part="kpi.label"]');
    await expect(labels[1]).toHaveAttribute('data-ck-bind', 'kpis.1.label');
  },
};

export const EmptyOnCanvas: Story = {
  args: {
    node: { ...node, id: 'report-empty' },
    props: reportSchema.props.parse({
      title: 'Paste rows to fill this report',
      series: [],
      kpis: [],
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* A 390px column: the cards stack, the chart scales down and the table scrolls. */
export const Mobile: Story = {
  args: {
    node: { ...node, id: 'report-mobile' },
    props: exampleProps(0),
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
    const scroller = canvasElement.querySelector('[data-report-table]');
    await expect(scroller?.getBoundingClientRect().width).toBeLessThanOrEqual(390);
  },
};

export const FinancialGoals: Story = {
  args: { ...MonthlySales.args, props: exampleProps(3) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('progressbar', { name: 'Latest revenue — Plan: ≥ $100,000' }),
    ).toHaveAttribute('aria-valuetext', '120% (Plan: ≥ $100,000)');
  },
};

export const ProjectDelivery: Story = {
  args: { ...MonthlySales.args, props: exampleProps(4) },
};

export const MarketingMobileRtl: Story = {
  globals: { direction: 'rtl' },
  args: { ...MonthlySales.args, props: exampleProps(5) },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, maxInlineSize: '100%', marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('progressbar', { name: 'آخر أسبوع — الهدف: ≥ 1,500' }),
    ).toHaveAttribute('aria-valuetext', '120% (الهدف: ≥ 1,500)');
  },
};

export const ExplicitBaseline: Story = {
  args: {
    ...MonthlySales.args,
    props: reportSchema.props.parse({
      title: 'Compare against the approved reference',
      categories: ['Jan', 'Feb'],
      series: [{ name: 'Revenue', values: [100, 120] }],
      valuePrefix: '$',
      comparisonLabel: 'vs approved reference',
      kpis: [{ label: 'Latest revenue', comparisonValue: 80 }, { label: 'Monthly change' }],
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('vs approved reference')).toBeVisible();
    await expect(canvasElement.querySelector('[data-report-baseline]')).toHaveTextContent('$80');
    await expect(within(canvasElement).getByText('vs previous')).toBeVisible();
  },
};
