/**
 * CommandPalette (Studio Indigo, 2026-10-12): one searchable list of every place and action
 * in the editor. Asserted by role and name: the trigger opens a titled dialog, typing
 * filters, Enter runs the active row after the palette closes, a disabled row stays listed
 * but does not run, and the Arabic labels and right-to-left direction reach the dialog.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  groupCommands,
  isPaletteShortcut,
  paletteShortcutLabel,
  type CommandItem,
} from '../../command-model';
import { COMMAND_PALETTE_LABELS_AR, type CommandPaletteLabels } from '../../command-palette.labels';
import { useCommandPaletteShortcut } from '../../use-command-palette-shortcut';

import { CommandPalette } from './CommandPalette';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'command',
    'components',
    'CommandPalette',
    'CommandPalette.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

beforeAll(() => {
  // jsdom draws no layout: cmdk scrolls the active row into view and measures the list.
  Element.prototype.scrollIntoView = (): void => undefined;
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

function commands(run: (id: string) => void): CommandItem[] {
  const item = (id: string, group: CommandItem['group'], label: string, extra = {}) => ({
    id,
    group,
    label,
    run: () => {
      run(id);
    },
    ...extra,
  });
  return [
    item('publish', 'actions', 'Publish site', { keywords: ['نشر', 'deploy'] }),
    item('undo', 'actions', 'Undo', { hint: 'Ctrl Z', disabled: true }),
    item('layers', 'navigate', 'Layers', { current: true }),
    item('pages', 'navigate', 'Pages'),
    item('device-phone', 'view', 'Phone preview'),
  ];
}

function Host({
  run,
  labels,
  dir,
}: {
  readonly run: (id: string) => void;
  readonly labels?: CommandPaletteLabels;
  readonly dir?: 'ltr' | 'rtl';
}) {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(() => {
    setOpen((value) => !value);
  });
  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      commands={commands(run)}
      labels={labels}
      dir={dir}
      shortcut="Ctrl K"
    />
  );
}

describe('CommandPalette', () => {
  it('opens from its trigger as a titled dialog with every group', async () => {
    const user = userEvent.setup();
    render(<Host run={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Search and commands/u });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Ctrl K');
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Go to')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Layers/u })).toHaveTextContent('Current');
  });

  it('filters by label and by keyword in either language', async () => {
    const user = userEvent.setup();
    render(<Host run={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Search and commands/u }));
    const input = await screen.findByRole('combobox');
    await user.type(input, 'نشر');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    expect(screen.getByRole('option', { name: 'Publish site' })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'zzzz');
    expect(
      await screen.findByText('Nothing matches. Try a section, a page or an action.'),
    ).toBeInTheDocument();
  });

  it('closes first, then runs the chosen row', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<Host run={run} />);
    await user.click(screen.getByRole('button', { name: /Search and commands/u }));
    await user.type(await screen.findByRole('combobox'), 'phone');
    await user.keyboard('{Enter}');
    expect(run).toHaveBeenCalledWith('device-phone');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('lists a disabled row without running it', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<Host run={run} />);
    await user.click(screen.getByRole('button', { name: /Search and commands/u }));
    const undo = await screen.findByRole('option', { name: /Undo/u });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveTextContent('Ctrl Z');
    await user.click(undo);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles with Ctrl K and closes with Escape, returning focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Host run={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Search and commands/u });
    trigger.focus();
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('speaks Arabic and lays out right to left', async () => {
    const user = userEvent.setup();
    render(<Host run={vi.fn()} labels={COMMAND_PALETTE_LABELS_AR} dir="rtl" />);
    await user.click(screen.getByRole('button', { name: /البحث والأوامر/u }));
    const dialog = await screen.findByRole('dialog', { name: 'لوحة الأوامر' });
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(screen.getByPlaceholderText('ابحث عن قسم أو إجراء…')).toBeInTheDocument();
    expect(screen.getByText('إجراءات')).toBeInTheDocument();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});

describe('command model', () => {
  it('groups in the fixed order and drops empty groups', () => {
    const grouped = groupCommands(commands(vi.fn()));
    expect(grouped.map((entry) => entry.group)).toEqual(['actions', 'navigate', 'view']);
    expect(grouped[1]?.items.map((item) => item.id)).toEqual(['layers', 'pages']);
  });

  it('names the shortcut for the platform', () => {
    expect(paletteShortcutLabel('MacIntel')).toBe('⌘ K');
    expect(paletteShortcutLabel('iPhone')).toBe('⌘ K');
    expect(paletteShortcutLabel('Win32')).toBe('Ctrl K');
    expect(paletteShortcutLabel('Linux x86_64')).toBe('Ctrl K');
  });

  it('opens only on Ctrl or ⌘ with K, without Shift or Alt', () => {
    const key = { key: 'k', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(isPaletteShortcut({ ...key, ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ ...key, metaKey: true, key: 'K' })).toBe(true);
    expect(isPaletteShortcut(key)).toBe(false);
    expect(isPaletteShortcut({ ...key, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isPaletteShortcut({ ...key, ctrlKey: true, altKey: true })).toBe(false);
    expect(isPaletteShortcut({ ...key, ctrlKey: true, key: 'j' })).toBe(false);
  });
});
