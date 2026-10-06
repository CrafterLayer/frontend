import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MotionPresetGrid, type MotionPresetGridProps } from './MotionPresetGrid';
import { MOTION_PRESET_GRID_LABELS_AR } from './MotionPresetGrid.labels';

function Controlled(props: MotionPresetGridProps) {
  const [value, setValue] = useState<string | undefined>(props.value);
  return (
    <MotionPresetGrid
      {...props}
      value={value}
      onSelect={(preset) => {
        setValue(preset ?? undefined);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/MotionPresetGrid',
  component: MotionPresetGrid,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { kind: 'motion', trigger: 'view', value: 'fade-up', onSelect: () => undefined },
} satisfies Meta<typeof MotionPresetGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnView: Story = {};
export const WhileScrolling: Story = { args: { trigger: 'scroll', value: 'parallax-slow' } };
export const Hover: Story = { args: { kind: 'hover', value: 'lift' } };
export const Arabic: Story = { args: { labels: MOTION_PRESET_GRID_LABELS_AR, dir: 'rtl' } };
