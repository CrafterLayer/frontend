import type { Meta, StoryObj } from '@storybook/react-vite';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { DirectionFlip } from './DirectionFlip';

const meta = {
  title: 'Playground/DirectionFlip',
  component: DirectionFlip,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DirectionFlip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { kernel: createPlaygroundKernel({ fixture: 'empty' }) },
};
