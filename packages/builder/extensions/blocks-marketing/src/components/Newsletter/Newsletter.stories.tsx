import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Newsletter } from './Newsletter';
import { newsletterExamples } from './examples';
import { newsletterSchema } from './schema';

const node: Node = { id: 'newsletter-story', type: 'newsletter', props: {} };
const exampleProps = (index: number) =>
  newsletterSchema.props.parse((newsletterExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Newsletter',
  component: Newsletter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Newsletter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Split: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Work email' })).toBeRequired();
    await expect(canvas.getByRole('button', { name: 'Join the list' })).toBeVisible();
  },
};

export const ArabicCardRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'newsletter-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const CompactInline: Story = {
  args: {
    node: { ...node, id: 'newsletter-inline' },
    props: newsletterSchema.props.parse({
      heading: 'Get the launch notes',
      body: 'Short product updates, sent only when they matter.',
      variant: 'inline',
      spacing: 'sm',
      width: 'narrow',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'newsletter-parts', type: 'newsletter', props: {} },
    props: newsletterSchema.props.parse({
      heading: 'Stay in the loop.',
      body: 'One email a month.',
      privacy: 'We never share your email.',
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ck-part="heading"]')).toHaveAttribute(
      'data-ck-bind',
      'heading',
    );
  },
};
