import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StackControl, type StackControlProps } from './StackControl';

function Controlled(props: StackControlProps) {
  const [layers, setLayers] = useState<readonly string[]>(props.layers);
  return <StackControl {...props} layers={layers} onCommit={setLayers} />;
}

const meta = {
  title: 'Builder/Shell/StyleManager/StackControl',
  component: StackControl,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Shadow',
    layers: ['0 1px 2px rgb(0 0 0 / 8%)', '0 8px 24px rgb(0 0 0 / 12%)'],
    newLayer: '0 4px 12px rgb(0 0 0 / 10%)',
    presets: [
      { id: 'soft', label: 'Soft' },
      { id: 'strong', label: 'Strong' },
      { id: 'elevated', label: 'Elevated' },
    ],
    onCommit: () => undefined,
    onPreset: () => undefined,
  },
} satisfies Meta<typeof StackControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shadows: Story = {};
export const Gradients: Story = {
  args: {
    label: 'Gradient',
    layers: ['linear-gradient(to bottom, #0f766e, transparent)'],
    newLayer: 'radial-gradient(circle, #ffffff33, transparent)',
    presets: [],
  },
};
export const PresetsOnly: Story = { args: { editable: false, preset: 'soft', layers: [] } };
