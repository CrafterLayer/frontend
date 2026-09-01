import type { Meta, StoryObj } from '@storybook/react-vite';

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
