import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { CommandItem } from '../../command-model';
import {
  COMMAND_PALETTE_LABELS_AR,
  COMMAND_PALETTE_LABELS_EN,
  type CommandPaletteLabels,
} from '../../command-palette.labels';
import { useCommandPaletteShortcut } from '../../use-command-palette-shortcut';

import { CommandPalette } from './CommandPalette';

const ran = fn();

type Row = readonly [
  id: string,
  group: CommandItem['group'],
  label: string,
  extra?: Partial<CommandItem>,
];

const EN_ROWS: readonly Row[] = [
  ['publish', 'actions', 'Publish site', { keywords: ['نشر'] }],
  ['preview', 'actions', 'Preview'],
  ['undo', 'actions', 'Undo', { hint: 'Ctrl Z' }],
  ['redo', 'actions', 'Redo', { hint: 'Ctrl ⇧ Z', disabled: true }],
  ['go:blocks', 'navigate', 'Blocks', { current: true }],
  ['go:pages', 'navigate', 'Pages'],
  ['go:layers', 'navigate', 'Layers'],
  ['go:design', 'navigate', 'Design'],
  ['go:assistant', 'navigate', 'Assistant'],
  ['device:desktop', 'view', 'Desktop', { current: true }],
  ['device:tablet', 'view', 'Tablet'],
  ['device:mobile', 'view', 'Mobile'],
  ['page:home', 'pages', 'Home', { hint: '/', current: true }],
  ['page:about', 'pages', 'About us', { hint: '/about' }],
  ['language:en', 'language', 'English', { current: true }],
  ['language:ar', 'language', 'العربية'],
  ['help:shortcuts', 'help', 'Keyboard shortcuts', { hint: '?' }],
];

const AR_ROWS: readonly Row[] = [
  ['publish', 'actions', 'نشر الموقع', { keywords: ['publish'] }],
  ['preview', 'actions', 'معاينة'],
  ['undo', 'actions', 'تراجع', { hint: 'Ctrl Z' }],
  ['go:blocks', 'navigate', 'العناصر', { current: true }],
  ['go:pages', 'navigate', 'الصفحات'],
  ['go:layers', 'navigate', 'الطبقات'],
  ['device:desktop', 'view', 'سطح المكتب', { current: true }],
  ['device:mobile', 'view', 'جوال'],
  ['page:home', 'pages', 'الرئيسية', { hint: '/', current: true }],
  ['language:en', 'language', 'English'],
  ['language:ar', 'language', 'العربية', { current: true }],
];

function rows(list: readonly Row[]): CommandItem[] {
  return list.map(([id, group, label, extra]) => ({
    id,
    group,
    label,
    run: () => {
      ran(id);
    },
    ...extra,
  }));
}

/** The top bar's palette as the editor hosts it: the trigger, Ctrl/⌘ K, the dialog. */
function Host({
  startOpen,
  labels,
  dir,
  list,
}: {
  readonly startOpen: boolean;
  readonly labels: CommandPaletteLabels;
  readonly dir: 'ltr' | 'rtl';
  readonly list: readonly Row[];
}) {
  const [open, setOpen] = useState(startOpen);
  useCommandPaletteShortcut(() => {
    setOpen((value) => !value);
  });
  return (
    <div
      lang={dir === 'rtl' ? 'ar' : 'en'}
      dir={dir}
      style={{
        display: 'flex',
        padding: 'var(--bldr-space-3xl)',
        background: 'var(--bldr-panel)',
        fontFamily: 'var(--bldr-font)',
      }}
    >
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        commands={rows(list)}
        labels={labels}
        dir={dir}
        shortcut="Ctrl K"
      />
    </div>
  );
}

const meta = {
  title: 'Playground/Command/CommandPalette',
  component: Host,
  parameters: { layout: 'fullscreen' },
  args: { startOpen: true, labels: COMMAND_PALETTE_LABELS_EN, dir: 'ltr', list: EN_ROWS },
} satisfies Meta<typeof Host>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every group, the current place marked, a disabled row still listed. */
export const Open: Story = {
  play: async () => {
    const page = within(document.body);
    await expect(await page.findByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveFocus();
    await expect(page.getByRole('option', { name: /Redo/u })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

/** Typing filters by name and by the other language's name: «نشر» finds Publish site. */
export const Filtered: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.type(await page.findByRole('combobox'), 'نشر');
    await waitFor(async () => {
      await expect(page.getAllByRole('option')).toHaveLength(1);
    });
    await expect(page.getByRole('option', { name: 'Publish site' })).toBeVisible();
  },
};

/** Nothing matches: the palette says so and suggests what to type instead. */
export const NoMatch: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.type(await page.findByRole('combobox'), 'qqqq');
    await expect(
      await page.findByText('Nothing matches. Try a section, a page or an action.'),
    ).toBeVisible();
  },
};

/** Closed: only the top bar's trigger, with its key cap. Ctrl/⌘ K opens it. */
export const Trigger: Story = {
  args: { startOpen: false },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /Search and commands/u });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(
      await within(document.body).findByRole('dialog', { name: 'Command palette' }),
    ).toBeVisible();
  },
};

/** The Arabic editor: the dialog, its groups and its rows read right to left. */
export const OpenRightToLeft: Story = {
  args: { labels: COMMAND_PALETTE_LABELS_AR, dir: 'rtl', list: AR_ROWS },
  globals: { direction: 'rtl' },
  play: async () => {
    const dialog = await within(document.body).findByRole('dialog', { name: 'لوحة الأوامر' });
    await expect(dialog).toHaveAttribute('dir', 'rtl');
  },
};
