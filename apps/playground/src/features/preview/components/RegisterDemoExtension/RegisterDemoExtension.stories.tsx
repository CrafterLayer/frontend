import type { Meta, StoryObj } from '@storybook/react-vite';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { RegisterDemoExtension } from './RegisterDemoExtension';

const meta = {
  title: 'Playground/RegisterDemoExtension',
  component: RegisterDemoExtension,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RegisterDemoExtension>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { kernel: createPlaygroundKernel({ fixture: 'empty' }) },
};
