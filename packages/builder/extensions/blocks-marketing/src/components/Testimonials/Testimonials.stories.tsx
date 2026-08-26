import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { testimonialsExamples } from './examples';
import { testimonialsSchema } from './schema';
import { Testimonials } from './Testimonials';

const node: Node = { id: 'testimonials-story', type: 'testimonials', props: {} };
const exampleProps = (index: number) =>
  testimonialsSchema.props.parse((testimonialsExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Testimonials',
  component: Testimonials,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Testimonials>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleQuote: Story = {
  args: { node, props: exampleProps(1), slots: {}, data: {}, isCanvas: false },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: testimonialsSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};
