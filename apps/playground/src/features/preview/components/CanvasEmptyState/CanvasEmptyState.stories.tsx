import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { CanvasEmptyState } from './CanvasEmptyState';
import { CANVAS_EMPTY_STATE_LABELS_AR } from './CanvasEmptyState.labels';

const meta = {
  title: 'Playground/CanvasEmptyState',
  component: CanvasEmptyState,
  parameters: { layout: 'fullscreen' },
  args: { onAddBlock: fn(), onUseTemplate: fn() },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', blockSize: '32rem', background: 'var(--bldr-ground)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CanvasEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add a block' }));
    await expect(args.onAddBlock).toHaveBeenCalledOnce();
  },
};

export const Arabic: Story = {
  args: { labels: CANVAS_EMPTY_STATE_LABELS_AR, dir: 'rtl' },
};
