import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { GenerationProgress, type GenerationStage } from './GenerationProgress';

const ALL_PENDING = [
  { id: 'sitemap', status: 'pending' },
  { id: 'structure', status: 'pending' },
  { id: 'content', status: 'pending' },
  { id: 'design', status: 'pending' },
  { id: 'assembly', status: 'pending' },
] as const satisfies readonly GenerationStage[];

/** Settle the first `count` stages and run the next one. */
function through(count: number): readonly GenerationStage[] {
  const timings = ['00:01.123', '00:02.347', '00:03.891', '00:04.512', '00:06.204'];
  return ALL_PENDING.map((stage, index) => {
    if (index < count) return { ...stage, status: 'done', detail: timings[index] };
    if (index === count) return { ...stage, status: 'active' };
    return stage;
  });
}

const meta = {
  title: 'Shell/GenerationProgress',
  component: GenerationProgress,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GenerationProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { stages: ALL_PENDING },
};

export const Planning: Story = {
  args: { stages: through(0), onCancel: fn() },
};

export const Structuring: Story = {
  args: { stages: through(1), onCancel: fn() },
};

export const Writing: Story = {
  args: { stages: through(2), onCancel: fn() },
};

export const Designing: Story = {
  args: { stages: through(3), onCancel: fn() },
};

export const Applying: Story = {
  args: { stages: through(4), onCancel: fn() },
};

export const Complete: Story = {
  args: {
    stages: ALL_PENDING.map((stage) => ({ ...stage, status: 'done' })),
    onCancel: fn(),
  },
};

/* A stage that names a block type the registry does not carry fails the run
   rather than inventing one, and the reason is shown on the row that failed. */
export const Failed: Story = {
  args: {
    stages: [
      { id: 'sitemap', status: 'done', detail: '00:01.123' },
      { id: 'structure', status: 'failed', detail: 'No block type named "carousel".' },
      { id: 'content', status: 'pending' },
      { id: 'design', status: 'pending' },
      { id: 'assembly', status: 'pending' },
    ],
  },
};

export const Cancelled: Story = {
  args: {
    stages: [
      { id: 'sitemap', status: 'done', detail: '00:01.123' },
      { id: 'structure', status: 'done', detail: '00:02.347' },
      { id: 'content', status: 'cancelled' },
      { id: 'design', status: 'pending' },
      { id: 'assembly', status: 'pending' },
    ],
  },
};

/* Inside the assistant thread the panel already owns the one `role="status"`,
   so the card hands announcing to the host and keeps only its rows and words.
   Same stages as `Structuring`; no Cancel, because in a chat the composer's
   Stop is the one abort. */
export const SilentInsideAChat: Story = {
  args: { stages: through(1), announce: false, heading: 'Working on the page' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '18rem' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(canvas.getByRole('region', { name: 'Working on the page' })).toBeInTheDocument();
  },
};

export const RightToLeft: Story = {
  args: { stages: through(3), onCancel: fn() },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '22rem' }}>
        <Story />
      </div>
    ),
  ],
};

export const CancelIsKeyboardReachable: Story = {
  args: { stages: through(2), onCancel: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const cancel = canvas.getByRole('button', { name: 'Cancel generation' });

    await userEvent.tab();
    await expect(cancel).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};
