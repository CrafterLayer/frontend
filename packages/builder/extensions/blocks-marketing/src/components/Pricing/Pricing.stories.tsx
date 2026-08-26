import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { pricingExamples } from './examples';
import { Pricing } from './Pricing';
import { pricingSchema } from './schema';

const node: Node = { id: 'pricing-story', type: 'pricing', props: {} };
const exampleProps = (index: number) =>
  pricingSchema.props.parse((pricingExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Pricing',
  component: Pricing,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Pricing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoPlans: Story = {
  args: { node, props: exampleProps(1), slots: {}, data: {}, isCanvas: false },
};

export const ArabicRtlHighlighted: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: pricingSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};
