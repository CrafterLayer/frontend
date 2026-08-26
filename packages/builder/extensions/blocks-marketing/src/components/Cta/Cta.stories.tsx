import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Cta } from './Cta';

const node: Node = { id: 'cta-story', type: 'cta', props: {} };

const meta = {
  title: 'Builder/Blocks/Cta',
  component: Cta,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Cta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    node,
    props: { label: 'Get started', emphasis: 'primary' },
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Get started' })).toBeEnabled();
  },
};

export const GhostWithNote: Story = {
  args: {
    ...Primary.args,
    props: { label: 'Learn more', emphasis: 'ghost', note: 'Free 14-day trial' },
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Primary.args,
    props: { label: 'تسوّق الآن', emphasis: 'primary', note: 'شحن مجاني فوق ١٠٠' },
  },
};
