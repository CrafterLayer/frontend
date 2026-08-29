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

/** Resolve a chrome token to the colour the browser actually paints. */
function paintedToken(root: HTMLElement, token: string): string {
  const view = root.ownerDocument.defaultView;
  if (view === null) {
    throw new Error('The rail has no rendering window');
  }
  const probe = root.ownerDocument.createElement('span');
  probe.style.color = `var(${token})`;
  root.append(probe);
  const painted = view.getComputedStyle(probe).color;
  probe.remove();
  return painted;
}

/**
 * The product publishes ONE focus ring and permits a component to re-colour it.
 * The rail must, because the ring's own token is the same violet as the accent
 * the selected tab is filled with.
 *
 * `activeId` is the FIRST item on purpose: one Tab then lands on the selected
 * tab, which is the element whose ring this story is about.
 */
export const FocusRingContrastsWithTheSelectedFill: Story = {
  name: 'Focus ring contrasts with the selected fill',
  args: {
    items: PRIMARY_ITEMS,
    activeId: 'pages',
    onSelect: () => undefined,
  },
  render: (args) => (
    <div className="bldr-root" data-testid="rail-root">
      <IconRail {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector<HTMLElement>('[data-testid="rail-root"]');
    if (root === null) {
      throw new Error('The rail root must render');
    }
    const view = root.ownerDocument.defaultView;
    if (view === null) {
      throw new Error('The rail has no rendering window');
    }

    /*
      Non-vacuous, and the reason this story exists: `--bldr-focus-ring` IS
      `--bldr-accent`. Drawn unchanged on the selected tab, the ring was the
      fill's own colour separated from it by a 1px gap of dark rail — a doubled
      border rather than a focus indicator. If these two ever stop being equal
      this assertion fails and the override can simply be deleted.
    */
    await expect(paintedToken(root, '--bldr-focus-ring')).toBe(paintedToken(root, '--bldr-accent'));

    const selected = canvas.getByRole('button', { name: 'Pages' });
    // The selected tab carries the accent fill the ring has to survive.
    await expect(view.getComputedStyle(selected).backgroundColor).toBe(
      paintedToken(root, '--bldr-accent'),
    );

    canvasElement.ownerDocument.body.focus();
    await userEvent.tab();
    await expect(selected).toHaveFocus();

    const painted = view.getComputedStyle(selected);
    // The ring is still drawn — re-coloured, never removed.
    await expect(painted.outlineStyle).toBe('solid');
    await expect(Number.parseFloat(painted.outlineWidth)).toBeGreaterThan(0);
    // And it is no longer the colour of the thing it is meant to outline.
    await expect(painted.outlineColor).not.toBe(painted.backgroundColor);
    await expect(painted.outlineColor).toBe(paintedToken(root, '--bldr-rail-text-strong'));
  },
};
