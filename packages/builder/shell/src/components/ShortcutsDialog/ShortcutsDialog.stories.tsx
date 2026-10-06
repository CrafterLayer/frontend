import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ShortcutsDialog } from './ShortcutsDialog';
import { SHORTCUTS_DIALOG_LABELS_AR } from './ShortcutsDialog.labels';

const meta = {
  title: 'Shell/ShortcutsDialog',
  component: ShortcutsDialog,
  args: { open: true, onClose: fn(), platform: 'mac' },
} satisfies Meta<typeof ShortcutsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mac: Story = {};

export const Windows: Story = { args: { platform: 'other' } };

export const Arabic: Story = {
  args: { labels: SHORTCUTS_DIALOG_LABELS_AR },
  render: (args) => (
    <div dir="rtl" lang="ar">
      <ShortcutsDialog {...args} />
    </div>
  ),
};

export const EscapeCloses: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalled();
  },
};
