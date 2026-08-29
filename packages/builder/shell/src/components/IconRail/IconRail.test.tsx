import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IconRail, type RailItem } from './IconRail';

const ITEMS = [
  {
    id: 'pages',
    label: 'Pages',
    icon: <svg data-testid="pages-icon" />,
  },
  {
    id: 'blocks',
    label: 'Blocks',
    icon: <svg data-testid="blocks-icon" />,
  },
  {
    id: 'layers',
    label: 'Layers',
    icon: <svg data-testid="layers-icon" />,
  },
] as const satisfies readonly RailItem[];

const SECONDARY = [
  {
    id: 'settings',
    label: 'Settings',
    icon: <svg data-testid="settings-icon" />,
  },
  {
    id: 'help',
    label: 'Help',
    icon: <svg data-testid="help-icon" />,
  },
] as const satisfies readonly RailItem[];

afterEach(cleanup);

describe('IconRail', () => {
  it('renders a named navigation list with every label visible and every icon hidden from AT', () => {
    render(<IconRail items={ITEMS} />);

    const navigation = screen.getByRole('navigation', { name: 'Builder sections' });
    expect(within(navigation).getAllByRole('list')).toHaveLength(1);

    for (const item of ITEMS) {
      const button = within(navigation).getByRole('button', { name: item.label });
      expect(button).toBeVisible();
      expect(button.closest('li')).toBeInTheDocument();
      expect(within(navigation).getByText(item.label)).toBeVisible();
      expect(screen.getByTestId(`${item.id}-icon`).closest('[aria-hidden="true"]')).toBeVisible();
    }
  });

  it('marks only the active item as the current page and accepts a custom navigation label', () => {
    render(<IconRail items={ITEMS} activeId="layers" label="Editor navigation" />);

    const navigation = screen.getByRole('navigation', { name: 'Editor navigation' });
    expect(within(navigation).getByRole('button', { name: 'Layers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByRole('button', { name: 'Pages' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('calls onSelect with the item id on native keyboard and click activation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<IconRail items={ITEMS} secondary={SECONDARY} onSelect={onSelect} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Pages' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('pages');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSelect).toHaveBeenLastCalledWith('settings');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('renders the secondary group after the primary group and the account below both', () => {
    render(
      <IconRail
        items={ITEMS}
        secondary={SECONDARY}
        activeId="settings"
        account={<span>AB</span>}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Builder sections' });
    expect(within(navigation).getAllByRole('list')).toHaveLength(2);
    expect(
      within(navigation)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Pages', 'Blocks', 'Layers', 'Settings', 'Help']);
    expect(within(navigation).getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByText('AB')).toBeVisible();
  });

  it('works with no activeId or onSelect', async () => {
    const user = userEvent.setup();
    render(<IconRail items={ITEMS} />);

    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button).not.toHaveAttribute('aria-current');
    }

    const pagesButton = screen.getByRole('button', { name: 'Pages' });
    await user.click(pagesButton);
    expect(pagesButton).toBeVisible();
  });

  it('routes every navigation item through the lg ChromeButton scale', () => {
    render(<IconRail items={ITEMS} secondary={SECONDARY} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('data-bldr-chrome-button', '');
      expect(button).toHaveAttribute('data-size', 'lg');
      expect(button).toHaveAttribute('data-variant', 'quiet');
    }
  });
});
