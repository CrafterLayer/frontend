import type { Meta, StoryObj } from '@storybook/react-vite';

import { landingFixture } from '@craftkit/builder-core/testing';

import { StaticNode } from './StaticNode';

const meta = {
  title: 'Builder/Renderer/StaticNode',
  component: StaticNode,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StaticNode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnknownTypeFallback: Story = {
  args: {
    document: landingFixture(),
    id: 'hero1',
    blocks: () => undefined,
    breakpoint: 'desktop',
  },
};
