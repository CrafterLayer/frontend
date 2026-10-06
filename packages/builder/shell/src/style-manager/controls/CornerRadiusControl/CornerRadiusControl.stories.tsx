import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { namedModel } from '../ScaleNumberControl';
import { CornerRadiusControl } from './CornerRadiusControl';

const lg = { value: { kind: 'token' as const, token: 'lg' }, origin: 'here' as const };

const meta = {
  title: 'Builder/Shell/StyleManager/CornerRadiusControl',
  component: CornerRadiusControl,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '16rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    corners: { 'start-start': lg, 'start-end': lg, 'end-start': lg, 'end-end': lg },
    model: namedModel(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full']),
    units: ['px', 'rem', '%'],
    dir: 'ltr',
    onCommit: fn(),
  },
} satisfies Meta<typeof CornerRadiusControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Linked: Story = {};
export const PerCorner: Story = {
  args: {
    corners: {
      'start-start': lg,
      'start-end': { value: undefined, origin: 'unset' },
      'end-start': { value: undefined, origin: 'unset' },
      'end-end': lg,
    },
    dir: 'rtl',
  },
};
