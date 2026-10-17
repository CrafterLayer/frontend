import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { createDesignTestKernel, homeTree } from '../DesignSystemPanel/design-test-site';
import { IconBrowser } from './IconBrowser';
import { ICON_BROWSER_LABELS_AR } from './IconBrowser.labels';
import { iconSteps, searchIcons } from './icon-search';

afterEach(cleanup);

describe('searchIcons', () => {
  it('finds Lucide and Tabler names, exact and prefix first, spelled as icon nodes store them', () => {
    const found = searchIcons('heart', 'all', 400);
    expect(found[0]).toBe('heart');
    expect(found).toContain('tabler:heart');
    expect(found).toContain('tabler-filled:heart');
    expect(searchIcons('heart', 'tabler-filled', 5).every((name) => name.startsWith('tabler-filled:'))).toBe(true);
  });

  it('caps the list and returns nothing for nonsense', () => {
    expect(searchIcons('', 'lucide', 30)).toHaveLength(30);
    expect(searchIcons('zzqqxx-nothing')).toEqual([]);
  });
});

describe('iconSteps', () => {
  const TREE: CustomCodeRoot = {
    kind: 'root',
    children: [
      { kind: 'element', tag: 'p', text: 'Call us', children: [{ kind: 'icon', name: 'phone', size: 20, className: 'text-accent' }] },
    ],
  };

  it('replaces a selected icon, keeping its size and classes, in one transaction', () => {
    const kernel = createDesignTestKernel({ tree: TREE });
    const steps = iconSteps(kernel.page('home'), { kind: 'tree', nodeId: 'region', path: [0, 0] }, 'tabler:phone', 'home');
    expect(steps.ok).toBe(true);
    if (!steps.ok) return;
    kernel.dispatchGroup(steps.steps, { author: 'user', label: 'Icon' });
    const p = homeTree(kernel).children[0];
    expect(p?.kind === 'element' && p.children?.[0]).toEqual({
      kind: 'icon',
      name: 'tabler:phone',
      size: 20,
      className: 'text-accent',
    });
  });

  it('appends an icon inside a selected element, and refuses a block', () => {
    const kernel = createDesignTestKernel({ tree: TREE });
    const steps = iconSteps(kernel.page('home'), { kind: 'tree', nodeId: 'region', path: [0] }, 'mail', 'home');
    expect(steps.ok && steps.steps[0]?.args).toMatchObject({ parent: [0], index: 1, node: { kind: 'icon', name: 'mail' } });
    expect(iconSteps(kernel.page('home'), { kind: 'block', nodeId: 'region' }, 'mail', 'home').ok).toBe(false);
  });
});

describe('IconBrowser', () => {
  it('searches, draws each icon with the page renderer, and hands the pick to the host', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn<(name: string) => void>();
    render(<IconBrowser onPick={onPick} defaultSet="lucide" value="mail" />);
    await user.type(screen.getByLabelText('Search icons'), 'mail');
    const grid = screen.getByRole('list', { name: 'Icons' });
    const mail = within(grid).getByRole('button', { name: 'mail' });
    expect(mail).toHaveAttribute('aria-pressed', 'true');
    expect(mail.querySelector('svg')).not.toBeNull();
    await user.click(within(grid).getByRole('button', { name: 'mail-open' }));
    expect(onPick).toHaveBeenCalledWith('mail-open');
  });

  it('says when nothing matches, and when the list is capped', async () => {
    const user = userEvent.setup();
    render(<IconBrowser onPick={vi.fn()} defaultSet="lucide" limit={10} />);
    expect(screen.getByText('Showing the first 10. Type to narrow the list.')).toBeVisible();
    await user.type(screen.getByLabelText('Search icons'), 'zzqqxx');
    expect(screen.getByRole('status')).toHaveTextContent('No icon matches “zzqqxx”.');
  });

  it('speaks Arabic', () => {
    render(<IconBrowser onPick={vi.fn()} defaultSet="lucide" labels={ICON_BROWSER_LABELS_AR} dir="rtl" limit={5} />);
    expect(screen.getByRole('region', { name: 'الأيقونات' })).toHaveAttribute('dir', 'rtl');
  });
});
