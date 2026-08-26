import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { Hero } from './Hero';

const node: Node = { id: 'hero-story', type: 'hero', props: {} };

const meta = {
  title: 'Builder/Blocks/Hero',
  component: Hero,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Hero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: {
    node,
    props: {
      tone: 'light',
      align: 'center',
      heading: 'See your numbers clearly',
      body: 'Realtime analytics without the noise.',
    },
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const DarkWithActions: Story = {
  args: {
    ...Light.args,
    props: { tone: 'dark', align: 'start', heading: 'Build faster tonight' },
    slots: { actions: <button type="button">Get started</button> },
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Light.args,
    props: {
      tone: 'dark',
      align: 'center',
      heading: 'عود يليق بذوقك',
      body: 'تركيبات فاخرة تدوم طويلاً',
    },
  },
};
