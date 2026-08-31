import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Faq } from './Faq';
import { faqExamples } from './examples';
import { faqSchema } from './schema';

const node: Node = { id: 'faq-story', type: 'faq', props: {} };
const exampleProps = (index: number) =>
  faqSchema.props.parse((faqExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Faq',
  component: Faq,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Faq>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardColumns: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summary = canvas.getByText('Can we start with one team?');
    const details = summary.closest('details');
    await expect(details).not.toHaveAttribute('open');
    await userEvent.click(summary);
    await expect(details).toHaveAttribute('open');
  },
};

export const ArabicNumberedRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'faq-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const Empty: Story = {
  args: {
    node: { ...node, id: 'faq-empty' },
    props: faqSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
