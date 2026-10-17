import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { HelpPanel } from './HelpPanel';
import { HELP_PANEL_LABELS_AR } from './HelpPanel.labels';

const meta = {
  title: 'Playground/HelpPanel',
  component: HelpPanel,
  parameters: { layout: 'padded' },
  args: { onOpenShortcuts: fn(), onOpenCommands: fn(), commandsShortcut: 'Ctrl K' },
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: '20rem', background: 'var(--bldr-panel)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HelpPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Keyboard shortcuts' }),
    );
    await expect(args.onOpenShortcuts).toHaveBeenCalledOnce();
  },
};

export const Arabic: Story = {
  args: { labels: HELP_PANEL_LABELS_AR },
  decorators: [
    (Story) => (
      <div dir="rtl" lang="ar">
        <Story />
      </div>
    ),
  ],
};

export const ApplePlatform: Story = {
  args: { commandsShortcut: '⌘ K' },
};
