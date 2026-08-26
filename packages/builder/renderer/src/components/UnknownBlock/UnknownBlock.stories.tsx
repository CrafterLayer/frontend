import type { Meta, StoryObj } from '@storybook/react-vite';

import { UnknownBlock } from './UnknownBlock';

const meta = {
  title: 'Builder/Renderer/UnknownBlock',
  component: UnknownBlock,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof UnknownBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: 'widget:reviews' },
};

export const AfterExtensionDisposal: Story = {
  args: { type: 'announcement' },
};
