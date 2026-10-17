import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SelectionTarget } from '@craftkit/builder-schema';

import { SelectionToolbar } from './SelectionToolbar';

const target = (id: string, capabilities: SelectionTarget['capabilities']): SelectionTarget => ({
  pageId: 'home',
  sourceOrNodeId: id,
  revision: 'site-1',
  capabilities,
});

describe('SelectionToolbar', () => {
  it('sends the visible command with the exact selected target', async () => {
    const selected = target('hero-image', ['inspect', 'delete']);
    const onAction = vi.fn();
    render(<SelectionToolbar targets={[selected]} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onAction).toHaveBeenCalledWith('delete', [selected]);
    expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
  });

  it('shows only capabilities common to every selected item', () => {
    render(
      <SelectionToolbar
        targets={[
          target('a', ['inspect', 'duplicate', 'delete']),
          target('b', ['inspect', 'delete']),
        ]}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('2 items')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
  });

  it('exposes shared impact and disables every stale command', async () => {
    const onAction = vi.fn();
    render(
      <SelectionToolbar
        targets={[target('hero', ['inspect', 'editSource', 'delete'])]}
        sharedScope={{ instances: 6, pages: 3 }}
        state="stale"
        onAction={onAction}
      />,
    );
    expect(screen.getByText(/Shared component · 6 instances · 3 pages/u)).toBeVisible();
    expect(screen.getByText(/select it again/u)).toBeVisible();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('uses roving toolbar navigation and mirrors horizontal arrows in RTL', async () => {
    render(
      <SelectionToolbar
        targets={[target('hero', ['inspect', 'duplicate', 'delete'])]}
        dir="rtl"
        onAction={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
    const agent = screen.getByRole('button', { name: 'Edit with Agent' });
    const duplicate = screen.getByRole('button', { name: 'Duplicate' });
    duplicate.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(agent).toHaveFocus();
    expect(toolbar).toHaveAccessibleDescription('Block');
  });

  it('marks Move as the only structural pointer handle', () => {
    render(
      <SelectionToolbar
        targets={[target('hero', ['inspect', 'move', 'delete'])]}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute('data-bldr-drag-handle');
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute(
      'data-bldr-drag-handle',
    );
  });
});
