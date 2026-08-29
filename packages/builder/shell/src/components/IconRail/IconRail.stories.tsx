import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconRail, type RailItem } from './IconRail';

const PRIMARY_ITEMS = [
  {
    id: 'pages',
    label: 'Pages',
    icon: (
      <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor">
        <path d="M4 2.5h6l4 4v9H4z" />
        <path d="M10 2.5v4h4" />
      </svg>
    ),
  },
  {
    id: 'blocks',
    label: 'Blocks',
    icon: (
      <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor">
        <rect x="2.5" y="2.5" width="5" height="5" />
        <rect x="10.5" y="2.5" width="5" height="5" />
        <rect x="2.5" y="10.5" width="5" height="5" />
        <rect x="10.5" y="10.5" width="5" height="5" />
      </svg>
    ),
  },
  {
    id: 'layers',
    label: 'Layers',
    icon: (
      <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor">
        <path d="m9 2.5 6 3.25L9 9 3 5.75z" />
        <path d="m3 9 6 3.25L15 9" />
        <path d="m3 12.25 6 3.25 6-3.25" />
      </svg>
    ),
  },
] as const satisfies readonly RailItem[];

const SECONDARY_ITEMS = [
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 2.5v2M9 13.5v2M2.5 9h2M13.5 9h2M4.4 4.4l1.4 1.4M12.2 12.2l1.4 1.4M13.6 4.4l-1.4 1.4M5.8 12.2l-1.4 1.4" />
      </svg>
    ),
  },
  {
    id: 'help',
    label: 'Help',
    icon: (
      <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor">
        <circle cx="9" cy="9" r="6.5" />
        <path d="M7.25 6.75a1.9 1.9 0 1 1 2.5 1.8c-.75.3-.75.95-.75 1.45" />
        <path d="M9 12.75h.01" />
      </svg>
    ),
  },
] as const satisfies readonly RailItem[];

const ACCOUNT = <span>AB</span>;

const meta = {
  title: 'Builder/Shell/IconRail',
  component: IconRail,
} satisfies Meta<typeof IconRail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: PRIMARY_ITEMS,
    onSelect: () => undefined,
  },
};

export const WithActiveItem: Story = {
  args: {
    items: PRIMARY_ITEMS,
    activeId: 'blocks',
    onSelect: () => undefined,
  },
};

export const WithSecondaryGroup: Story = {
  args: {
    items: PRIMARY_ITEMS,
    secondary: SECONDARY_ITEMS,
    activeId: 'pages',
    onSelect: () => undefined,
    account: ACCOUNT,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previewBody = canvasElement.ownerDocument.body;
    previewBody.focus();
    await expect(previewBody).toHaveFocus();

    for (const item of [...PRIMARY_ITEMS, ...SECONDARY_ITEMS]) {
      await userEvent.tab();
      await expect(canvas.getByRole('button', { name: item.label })).toHaveFocus();
    }
  },
};

export const RightToLeft: Story = {
  args: {
    items: PRIMARY_ITEMS,
    secondary: SECONDARY_ITEMS,
    activeId: 'layers',
    onSelect: () => undefined,
    account: ACCOUNT,
  },
  render: (args) => (
    <div dir="rtl">
      <IconRail {...args} />
    </div>
  ),
};
