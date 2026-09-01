import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ShimmerButton } from './ShimmerButton';
import { shimmerButtonExamples } from './examples';
import { shimmerButtonSchema } from './schema';

const node: Node = { id: 'shimmer-button-story', type: 'shimmerButton', props: {} };
const exampleProps = (index: number) =>
  shimmerButtonSchema.props.parse((shimmerButtonExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/MagicUI/Shimmer Button',
  component: ShimmerButton,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ShimmerButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryAction: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Start building' })).toBeVisible();
  },
};

export const ArabicFullWidth: Story = {
  globals: { direction: 'rtl' },
  parameters: { layout: 'padded' },
  args: {
    node: { ...node, id: 'shimmer-button-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const StaticSubmit: Story = {
  args: {
    node: { ...node, id: 'shimmer-button-static' },
    props: exampleProps(2),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const Inverse: Story = {
  args: {
    node: { ...node, id: 'shimmer-button-inverse' },
    props: shimmerButtonSchema.props.parse({ label: 'Explore plans', tone: 'inverse' }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
