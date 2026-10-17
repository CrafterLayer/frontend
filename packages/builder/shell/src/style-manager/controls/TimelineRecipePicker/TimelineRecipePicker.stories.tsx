import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { TimelinePatch } from './timeline-patch';
import { TimelineRecipePicker, type TimelineRecipePickerProps } from './TimelineRecipePicker';
import { TIMELINE_RECIPE_PICKER_LABELS_AR } from './TimelineRecipePicker.labels';

function Controlled(props: TimelineRecipePickerProps) {
  const [attributes, setAttributes] = useState(props.attributes);
  return (
    <TimelineRecipePicker
      {...props}
      attributes={attributes}
      onCommit={(patch: TimelinePatch) => {
        const next: Record<string, string | undefined> = { ...attributes };
        for (const [name, value] of Object.entries(patch)) next[name] = value ?? undefined;
        setAttributes(next);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/TimelineRecipePicker',
  component: TimelineRecipePicker,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { attributes: { 'data-ck-timeline': 'split-reveal' }, onCommit: () => undefined, dir: 'ltr' },
} satisfies Meta<typeof TimelineRecipePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** English, left to right. */
export const EnglishLtr: Story = {};
/** Arabic, right to left: a pinned sequence tied to the scrollbar. */
export const ArabicRtl: Story = {
  args: {
    attributes: { 'data-ck-timeline': 'pin-sequence', 'data-ck-scrub': 'true' },
    dir: 'rtl',
    labels: TIMELINE_RECIPE_PICKER_LABELS_AR,
  },
};
