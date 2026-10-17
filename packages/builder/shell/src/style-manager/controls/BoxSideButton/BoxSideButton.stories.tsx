import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { spacingModel } from '../ScaleNumberControl';
import { BoxSideButton } from './BoxSideButton';

import '../BoxModelControl/BoxModelControl.css';

const meta = {
  title: 'Builder/Shell/StyleManager/BoxSideButton',
  component: BoxSideButton,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    side: 'inline-start',
    accessibleName: 'Padding inline-start, 16px',
    display: '16',
    fieldLabel: 'Padding inline-start',
    value: { kind: 'token', token: '4' },
    model: spacingModel(['0', '1', '2', '4', '6', '8', '12']),
    units: ['px', 'rem'],
    dir: 'ltr',
    onCommit: fn(),
    onPreview: fn(),
  },
} satisfies Meta<typeof BoxSideButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RightToLeftPage: Story = { args: { dir: 'rtl' } };
