import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ComparisonTable } from './ComparisonTable';
import { comparisonTableExamples } from './examples';
import { comparisonTableSchema } from './schema';

const node: Node = { id: 'comparison-story', type: 'comparisonTable', props: {} };
const exampleProps = (index: number) =>
  comparisonTableSchema.props.parse(
    (comparisonTableExamples[index]?.node as { props: unknown }).props,
  );

const meta = {
  title: 'Builder/Blocks/Comparison Table',
  component: ComparisonTable,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ComparisonTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PricingComparison: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', { name: /Choose the plan/i });
    await expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    await expect(canvas.getByRole('link', { name: 'Start free Growth' })).toBeVisible();
  },
};

export const ArabicContrast: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'comparison-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const EmptyTable: Story = {
  args: {
    node: { ...node, id: 'comparison-empty' },
    props: comparisonTableSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): plan headers, row names and every cell are parts on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'comparison-parts' },
    props: comparisonTableSchema.props.parse({
      ...(comparisonTableExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'plan.price': { className: 'text-accent' },
        'row.value@0.1': { className: 'underline' },
      },
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const prices = canvasElement.querySelectorAll('[data-ck-part="plan.price"]');
    await expect(prices[1]).toHaveAttribute('data-ck-bind', 'plans.1.price');
    await expect(prices[1]).toHaveClass('text-accent');
    const cells = canvasElement.querySelectorAll('[data-ck-part="row.value"]');
    await expect(cells[1]).toHaveAttribute('data-ck-bind', 'rows.0.values.1');
    await expect(cells[1]).toHaveClass('underline');
  },
};

/*
  Mobile (blocks-polish 2026-10-08): in a 390px column the comparison is a
  stack of plan cards — name, price, then label: value rows — and the table is
  display:none, so the page reads it once. From a 640px container up the table
  returns (section-layout.css, `.mkt-compare__*`).
*/
export const Mobile: Story = {
  args: {
    node: { ...node, id: 'comparison-mobile' },
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
    const canvas = within(canvasElement);
    const cards = canvasElement.querySelector('[data-comparison-cards]');
    await expect(cards).toBeVisible();
    await expect(canvasElement.querySelector('[data-comparison-scroll]')).not.toBeVisible();
    await expect(canvas.getByRole('heading', { level: 3, name: 'Growth' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Start free Growth' })).toBeVisible();
  },
};
