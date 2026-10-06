import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { blockPartProps, type Node } from '@craftkit/builder-schema';

import { marqueeSchema } from '../Marquee/schema';
import { MarqueeTrack } from './MarqueeTrack';

const meta = {
  title: 'Builder/MagicUI/Marquee/Track',
  component: MarqueeTrack,
  parameters: { layout: 'fullscreen' },
  args: {
    items: [
      { title: 'Northstar', meta: 'Strategy', href: '/northstar' },
      { title: 'Monument', meta: 'Product' },
      { title: 'Fieldwork', meta: 'Research' },
    ],
    presentation: 'cards',
    radius: 'large',
    direction: 'forward',
    isCanvas: false,
  },
} satisfies Meta<typeof MarqueeTrack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const DecorativeSecondary: Story = {
  args: { secondary: true, direction: 'reverse' },
};

const partsNode: Node = { id: 'marquee-track-parts', type: 'marquee', props: {} };

/* Block parts (DESIGN §4.4): given Marquee's part helper, every copy's elements are parts. */
export const Parts: Story = {
  args: {
    isCanvas: true,
    part: blockPartProps(
      {
        node: partsNode,
        props: { partStyles: { 'item.title': { className: 'text-accent' } } },
        isCanvas: true,
      },
      marqueeSchema.parts,
    ),
  },
  play: async ({ canvasElement }) => {
    const titles = canvasElement.querySelectorAll('[data-ck-part="item.title"]');
    /* Three items in each of the two copies. */
    await expect(titles).toHaveLength(6);
    await expect(titles[1]).toHaveAttribute('data-ck-bind', 'items.1.title');
    await expect(titles[4]).toHaveClass('text-accent');
  },
};
