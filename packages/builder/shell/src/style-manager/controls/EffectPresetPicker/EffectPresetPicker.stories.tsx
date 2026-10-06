import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CustomCodeEffect } from '@craftkit/builder-schema';

import { EffectPresetPicker, type EffectPresetPickerProps } from './EffectPresetPicker';
import { EFFECT_PRESET_PICKER_LABELS_AR } from './EffectPresetPicker.labels';

function Controlled(props: EffectPresetPickerProps) {
  const [value, setValue] = useState<readonly CustomCodeEffect[]>(props.value);
  return <EffectPresetPicker {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Builder/Shell/StyleManager/EffectPresetPicker',
  component: EffectPresetPicker,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '18rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { value: ['glass'], onChange: () => undefined },
} satisfies Meta<typeof EffectPresetPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Arabic: Story = { args: { labels: EFFECT_PRESET_PICKER_LABELS_AR } };
