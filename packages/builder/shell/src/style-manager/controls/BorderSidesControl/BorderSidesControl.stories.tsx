import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { numberModel } from '../ScaleNumberControl';
import { BorderSidesControl } from './BorderSidesControl';

const one = { value: { kind: 'token' as const, token: '1' }, origin: 'here' as const };

const meta = {
  title: 'Builder/Shell/StyleManager/BorderSidesControl',
  component: BorderSidesControl,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '18rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    widths: { 'block-start': one, 'block-end': one, 'inline-start': one, 'inline-end': one },
    model: numberModel(['0', '1', '2', '4', '8'], 'px'),
    units: ['px'],
    borderStyle: 'solid',
    dir: 'ltr',
    onCommitWidth: fn(),
    onCommitStyle: fn(),
  },
} satisfies Meta<typeof BorderSidesControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RightToLeftPage: Story = { args: { dir: 'rtl' } };
