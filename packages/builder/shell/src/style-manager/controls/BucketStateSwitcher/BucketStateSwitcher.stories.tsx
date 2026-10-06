import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleBucket, StyleState } from '@craftkit/builder-schema';

import { BucketStateSwitcher, type BucketStateSwitcherProps } from './BucketStateSwitcher';
import { BUCKET_STATE_SWITCHER_LABELS_AR } from './BucketStateSwitcher.labels';

function Controlled(props: BucketStateSwitcherProps) {
  const [bucket, setBucket] = useState<StyleBucket>(props.bucket);
  const [state, setState] = useState<StyleState>(props.state);
  return (
    <BucketStateSwitcher
      {...props}
      bucket={bucket}
      state={state}
      onBucketChange={setBucket}
      onStateChange={setState}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/BucketStateSwitcher',
  component: BucketStateSwitcher,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    bucket: 'base',
    state: 'default',
    onBucketChange: () => undefined,
    onStateChange: () => undefined,
  },
} satisfies Meta<typeof BucketStateSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Mobile' }));
    await expect(canvas.getByRole('radio', { name: 'Mobile' })).toHaveAttribute('aria-checked', 'true');
  },
};

export const CustomBreakpoints: Story = { args: { customWidths: [600, 480], freeWidth: 700 } };

export const Arabic: Story = {
  args: { labels: BUCKET_STATE_SWITCHER_LABELS_AR, dir: 'rtl' },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
