import type { Meta, StoryObj } from '@storybook/react-vite';

import { landingFixture } from '@craftkit/builder-core/testing';

import { StaticDocument } from './StaticDocument';

const meta = {
  title: 'Builder/Renderer/StaticDocument',
  component: StaticDocument,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StaticDocument>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FallbackOnly: Story = {
  args: {
    document: landingFixture(),
    blocks: () => undefined,
    breakpoint: 'desktop',
  },
};
