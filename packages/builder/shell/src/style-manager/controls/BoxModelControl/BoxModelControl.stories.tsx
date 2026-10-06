import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { spacingModel } from '../ScaleNumberControl';
import { BoxModelControl } from './BoxModelControl';
import { BOX_MODEL_CONTROL_LABELS_AR } from './BoxModelControl.labels';

const model = spacingModel(['0', 'px', '1', '2', '3', '4', '6', '8', '12', '16']);
const value = (token: string) => ({ value: { kind: 'token' as const, token }, origin: 'here' as const });
const unset = { value: undefined, origin: 'unset' as const };

const meta = {
  title: 'Builder/Shell/StyleManager/BoxModelControl',
  component: BoxModelControl,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '18rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    dir: 'ltr',
    onCommit: fn(),
    onPreview: fn(),
    rings: [
      {
        id: 'margin',
        label: 'Margin',
        model,
        min: -100,
        sides: { 'block-start': unset, 'block-end': value('8'), 'inline-start': unset, 'inline-end': unset },
      },
      {
        id: 'padding',
        label: 'Padding',
        model,
        units: ['px', 'rem', '%'],
        sides: {
          'block-start': value('6'),
          'block-end': value('6'),
          'inline-start': value('4'),
          'inline-end': { value: { kind: 'raw', css: '17px' }, origin: 'larger-bucket' },
        },
      },
    ],
  },
} satisfies Meta<typeof BoxModelControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RightToLeftPage: Story = {
  args: { dir: 'rtl', labels: BOX_MODEL_CONTROL_LABELS_AR },
};
