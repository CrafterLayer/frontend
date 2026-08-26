import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { featuresExamples } from './examples';
import { Features } from './Features';
import { featuresSchema } from './schema';

const node: Node = { id: 'features-story', type: 'features', props: {} };
const exampleProps = (index: number) =>
  featuresSchema.props.parse((featuresExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Features',
  component: Features,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Features>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeColumns: Story = {
  args: { node, props: exampleProps(1), slots: {}, data: {}, isCanvas: false },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: featuresSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};
