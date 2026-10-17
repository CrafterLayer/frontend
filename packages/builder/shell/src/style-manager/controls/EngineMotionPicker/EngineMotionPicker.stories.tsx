import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { engineRecipesFor, type EngineMotionValue } from './engine-motion';
import { EngineMotionPicker, type EngineMotionPickerProps } from './EngineMotionPicker';
import { ENGINE_MOTION_PICKER_LABELS_AR } from './EngineMotionPicker.labels';

function Controlled(props: EngineMotionPickerProps) {
  const [value, setValue] = useState<EngineMotionValue>(props.value);
  return (
    <EngineMotionPicker
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/EngineMotionPicker',
  component: EngineMotionPicker,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { value: { timeline: 'fade-in' }, onChange: () => undefined, dir: 'ltr' },
} satisfies Meta<typeof EngineMotionPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A heading: the text recipes only, English, left to right. */
export const TextElement: Story = { args: { recipes: engineRecipesFor('text') } };
/** A section: every container recipe plus the Animated background, with a scene chosen. */
export const SectionWithScene: Story = {
  args: {
    value: { timeline: 'stagger-in', scrub: false, scene: 'particles', density: 'high', palette: 'accent' },
    recipes: engineRecipesFor('container'),
    scenes: true,
  },
};
/** Arabic, right to left: the arrows are mirrored and names never split. */
export const ArabicRtl: Story = {
  args: {
    value: { timeline: 'slide-in', scrub: true },
    recipes: engineRecipesFor('media'),
    dir: 'rtl',
    labels: ENGINE_MOTION_PICKER_LABELS_AR,
  },
};
/** The Inspector's Animated background section: scenes only. */
export const ScenesOnly: Story = { args: { value: {}, recipes: [], scenes: true } };
