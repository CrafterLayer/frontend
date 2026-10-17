import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { BuilderSiteKernel } from '@craftkit/builder-core';
import { applySymbolOverrides, type CustomCodeRoot, type Node, type SiteLibrary } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { SymbolsPanel } from './SymbolsPanel';
import { SYMBOLS_PANEL_LABELS_AR } from './SymbolsPanel.labels';
import { withSymbolOverride } from './symbol-ops';

afterEach(cleanup);

const BANNER: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'p-8',
      children: [
        { kind: 'element', tag: 'h2', text: 'Summer sale' },
        { kind: 'element', tag: 'p', text: 'Ends Friday' },
      ],
    },
  ],
};

const LIBRARY: SiteLibrary = { symbols: { banner: { id: 'banner', name: 'Banner', tree: BANNER } } };

const INSTANCE: Node = {
  id: 'inst',
  type: 'customCodeSymbol',
  props: { label: 'Banner', symbolId: 'banner', overrides: [{ path: [0, 0], text: 'Mine' }] },
};

function withInstance(): BuilderSiteKernel {
  return createDesignTestKernel({ library: LIBRARY, extraNodes: { inst: INSTANCE } });
}

const doc = (kernel: BuilderSiteKernel) => kernel.page('home').getDocument();

describe('SymbolsPanel', () => {
  it('makes a region a symbol in ONE undo: the master in the library, an instance in its place', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel();
    render(<SymbolsPanel site={kernel} nodeId="region" />);

    await user.type(screen.getByLabelText('Symbol name'), 'Card row');
    await user.click(screen.getByRole('button', { name: 'Make into symbol' }));

    const symbol = kernel.getSite().library?.symbols?.['card-row'];
    expect(symbol?.name).toBe('Card row');
    const root = doc(kernel).nodes['root'];
    const placed = doc(kernel).nodes[root?.slots?.['default']?.[0] ?? ''];
    expect(placed?.type).toBe('customCodeSymbol');
    expect(placed?.props['symbolId']).toBe('card-row');
    expect(doc(kernel).nodes['region']).toBeUndefined();
    expect(kernel.transactions()).toHaveLength(1);

    act(() => {
      kernel.undo();
    });
    expect(kernel.getSite().library).toBeUndefined();
    expect(doc(kernel).nodes['region']?.type).toBe('customCode');
  });

  it('keeps an instance override when the master is edited, and marks it in the outline', async () => {
    const user = userEvent.setup();
    const kernel = withInstance();
    render(<SymbolsPanel site={kernel} nodeId="inst" />);

    const card = screen.getByRole('region', { name: 'Instance of Banner' });
    await user.click(within(card).getByRole('button', { name: 'Edit master' }));
    const outline = screen.getByRole('list', { name: 'Master of Banner' });
    expect(within(outline).getAllByText('Overridden')).toHaveLength(1);

    const text = screen.getByLabelText('Text of Text “Ends Friday”');
    await user.clear(text);
    await user.type(text, 'Ends Sunday{Enter}');
    const heading = screen.getByLabelText('Text of Heading “Summer sale”');
    await user.clear(heading);
    await user.type(heading, 'Winter sale{Enter}');

    const master = kernel.getSite().library?.symbols?.['banner']?.tree ?? BANNER;
    const instance = doc(kernel).nodes['inst'];
    const shown = applySymbolOverrides(master, instance?.props['overrides'] as never);
    expect(JSON.stringify(master)).toContain('Winter sale');
    expect(JSON.stringify(shown)).toContain('Mine');
    expect(JSON.stringify(shown)).toContain('Ends Sunday');
    expect(kernel.transactions()).toHaveLength(2);
  });

  it('shows each override with a badge and resets it in one transaction', async () => {
    const user = userEvent.setup();
    const kernel = withInstance();
    render(<SymbolsPanel site={kernel} nodeId="inst" />);
    expect(screen.getByText('Heading “Summer sale” · text')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset Heading “Summer sale” · text' }));
    expect(doc(kernel).nodes['inst']?.props['overrides']).toEqual([]);
    expect(screen.getByText('No overrides: this instance shows the master exactly.')).toBeVisible();
  });

  it('pushes overrides into the master and clears them', async () => {
    const user = userEvent.setup();
    const kernel = withInstance();
    render(<SymbolsPanel site={kernel} nodeId="inst" />);
    await user.click(screen.getByRole('button', { name: 'Push overrides to master' }));
    expect(JSON.stringify(kernel.getSite().library?.symbols?.['banner']?.tree)).toContain('Mine');
    expect(doc(kernel).nodes['inst']?.props['overrides']).toEqual([]);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('detaches an instance into a plain region with its overrides baked in', async () => {
    const user = userEvent.setup();
    const kernel = withInstance();
    render(<SymbolsPanel site={kernel} nodeId="inst" />);
    await user.click(screen.getByRole('button', { name: 'Detach instance' }));
    const slots = doc(kernel).nodes['root']?.slots?.['default'] ?? [];
    const detached = doc(kernel).nodes[slots[1] ?? ''];
    expect(detached?.type).toBe('customCode');
    expect(JSON.stringify(detached?.props['tree'])).toContain('Mine');
    expect(doc(kernel).nodes['inst']).toBeUndefined();
  });

  it('refuses to delete a symbol in use; detaching its instances deletes it in one undo', async () => {
    const user = userEvent.setup();
    const kernel = withInstance();
    render(<SymbolsPanel site={kernel} />);
    const list = screen.getByRole('list', { name: 'Site symbols' });
    expect(list).toHaveTextContent('1 instance');
    await user.click(within(list).getByRole('button', { name: 'Delete' }));
    expect(kernel.transactions()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Detach instances and delete' }));
    expect(kernel.getSite().library).toBeUndefined();
    expect(doc(kernel).nodes['inst']?.type).toBe('customCode');
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('deletes an unused symbol directly and renames in place', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ library: LIBRARY });
    render(<SymbolsPanel site={kernel} />);
    const name = screen.getByLabelText('Name of Banner');
    await user.clear(name);
    await user.type(name, 'Promo{Enter}');
    expect(kernel.getSite().library?.symbols?.['banner']?.name).toBe('Promo');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(kernel.getSite().library).toBeUndefined();
  });

  it('refuses to make an empty region a symbol, in words', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ tree: { kind: 'root', children: [] } });
    render(<SymbolsPanel site={kernel} nodeId="region" />);
    await user.type(screen.getByLabelText('Symbol name'), 'Nothing');
    await user.click(screen.getByRole('button', { name: 'Make into symbol' }));
    expect(screen.getByRole('status')).toHaveTextContent('This region is empty');
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('merges element-panel writes into an instance override (withSymbolOverride)', () => {
    const merged = withSymbolOverride([{ path: [0, 0], text: 'Mine' }], [0, 0], { className: 'text-accent' });
    expect(merged).toEqual([{ path: [0, 0], text: 'Mine', className: 'text-accent' }]);
    expect(withSymbolOverride([], [1], { attributes: { href: 'https://x.io' } })).toEqual([
      { path: [1], attributes: { href: 'https://x.io' } },
    ]);
  });

  it('speaks Arabic', () => {
    const kernel = withInstance();
    render(<SymbolsPanel site={kernel} nodeId="inst" labels={SYMBOLS_PANEL_LABELS_AR} dir="rtl" />);
    expect(screen.getByRole('region', { name: 'الرموز' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'افصل النسخة' })).toBeVisible();
  });
});
