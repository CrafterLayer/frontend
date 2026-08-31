import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { BentoGrid } from './BentoGrid';
import { bentoGridExamples } from './examples';
import { bentoGridSchema } from './schema';

const node: Node = { id: 'bento-story', type: 'bento-grid', props: {} };
const exampleProps = (index: number) =>
  bentoGridSchema.props.parse((bentoGridExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/BentoGrid',
  component: BentoGrid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BentoGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mosaic: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
    await expect(canvas.getByText('3.4×')).toBeVisible();
  },
};

export const ArabicEqualRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'bento-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const Empty: Story = {
  args: {
    node: { ...node, id: 'bento-empty' },
    props: bentoGridSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
