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

/* Block parts (DESIGN §4.4): every tile and each of its lines is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...exampleProps(0),
      partStyles: {
        'item.title': { className: 'text-accent' },
        'item.title@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="item.title"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'items.0.title');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="items"]')).toHaveAttribute(
      'data-ck-bind',
      'items',
    );
  },
};
