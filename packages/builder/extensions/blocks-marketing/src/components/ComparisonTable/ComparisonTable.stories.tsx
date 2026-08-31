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
    await expect(canvas.getByRole('link', { name: 'Start free: Growth' })).toBeVisible();
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
