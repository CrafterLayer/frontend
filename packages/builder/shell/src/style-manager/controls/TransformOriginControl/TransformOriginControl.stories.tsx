import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TransformOriginControl } from './TransformOriginControl';
import { TRANSFORM_ORIGIN_CONTROL_LABELS_AR } from './TransformOriginControl.labels';

const meta = {
  title: 'Builder/Shell/StyleManager/TransformOriginControl',
  component: TransformOriginControl,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { value: 'center', dir: 'ltr', onCommit: fn() },
} satisfies Meta<typeof TransformOriginControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RightToLeftPage: Story = {
  args: { dir: 'rtl', value: 'top-right', labels: TRANSFORM_ORIGIN_CONTROL_LABELS_AR },
};
