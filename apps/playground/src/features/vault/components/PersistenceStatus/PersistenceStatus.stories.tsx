import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { PersistenceStatus } from './PersistenceStatus';

const meta = {
  title: 'Playground/Vault/PersistenceStatus',
  component: PersistenceStatus,
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'var(--bldr-surface-sunken, #f6f7fa)',
          maxWidth: 760,
          padding: 24,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PersistenceStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Saving: Story = {
  args: { value: { kind: 'saving', sequence: 6 } },
};

export const Durable: Story = {
  args: { value: { kind: 'durable', sequence: 7 } },
};

export const SessionOnly: Story = {
  args: {
    value: {
      kind: 'session-only',
      sequence: 7,
      reason: 'IndexedDB is disabled in this browser.',
    },
    onDownload: fn(),
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Download project' }));
    await expect(args.onDownload).toHaveBeenCalledOnce();
  },
};

export const Error: Story = {
  args: {
    value: {
      kind: 'failed',
      sequence: 6,
      reason: 'Storage quota was exceeded.',
      recoverable: true,
    },
    onDownload: fn(),
    onRetry: fn(),
  },
};
