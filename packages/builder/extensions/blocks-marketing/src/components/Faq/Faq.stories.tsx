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

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...faqSchema.props.parse({
        eyebrow: 'Support',
        heading: 'Frequently asked questions.',
        body: 'Everything about the builder.',
        items: [
          { question: 'Can I edit in place?', answer: 'Yes, every line.' },
          { question: 'Is Arabic supported?', answer: 'Right to left, first class.' },
        ],
      }),
      partStyles: {
        'item.question': { className: 'text-accent' },
        'item.question@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="item.question"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'items.0.question');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="items"]')).toHaveAttribute(
      'data-ck-bind',
      'items',
    );
  },
};
