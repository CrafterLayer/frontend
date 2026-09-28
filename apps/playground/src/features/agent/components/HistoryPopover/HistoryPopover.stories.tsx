import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useId, useRef, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale, RowState, SessionSummary } from '../../model/view-types';
import {
  buildRecord,
  clinicRows,
  conversations,
  FIXTURE_NOW,
  SEARCH_QUERY,
} from '../../testing/wp-15-history-phone-fixtures';
import { AgentHeader } from '../AgentHeader';
// The phone sheet's density (44px targets, 16px input) is set on `.ck-agent-sheet`.
import '../AgentSheet/AgentSheet.css';
import { BuildRecord, type BuildRecordActions } from '../BuildRecord';
import { AgentTooltipProvider } from '../IconButton';

import { HistoryPopover, type HistoryPresentation } from './HistoryPopover';

/* ── The panel the list opens in ──────────────────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  /** 320 (the default panel), 420 (a widened one), or 390 (the phone sheet). */
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: a region named أبو غضب
 * with the theme, the story's language and direction, and the `agent` inline-size
 * container. The list mounts inside it (it reads its portal scope off `[◷]`), so it takes
 * the panel's theme and direction and its width from the panel. The phone frame is the
 * sheet's full face: positioned, so the sheet's list page covers it.
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const sheet = args['presentation'] === 'sheet';
  const { theme = 'light', width = sheet ? 390 : 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <section
      className={sheet ? 'ck-agent ck-agent-sheet' : 'ck-agent'}
      aria-label={t(locale, 'header.name')}
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        inlineSize: width,
        blockSize: sheet ? 640 : 520,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <AgentTooltipProvider>
        <Story />
      </AgentTooltipProvider>
    </section>
  );
};

const buildActions: BuildRecordActions = {
  undoSection: fn(),
  redoSection: fn(),
  undoBuild: fn(),
  redoBuild: fn(),
  retrySections: fn(),
  finishRest: fn(),
  removeEmpty: fn(),
  tryAgain: fn(),
  reveal: fn(),
  peek: fn(),
  openPageHistory: fn(),
};

interface ConversationsProps {
  readonly locale: Locale;
  readonly sessions: readonly SessionSummary[];
  readonly presentation?: HistoryPresentation | undefined;
  readonly running?: boolean | undefined;
  readonly startOpen?: boolean | undefined;
  readonly onOpenConversation: (id: string) => void;
  readonly onDeleteConversation: (id: string) => void;
}

/**
 * The header and the list, wired as AgentPanel wires them: `[◷]` toggles the list and is
 * its anchor; a delete removes the row (as the controller would), and New conversation
 * takes focus when none are left. The thread under it holds the §3.13 frame's finished
 * build, so the popover is judged over a real record.
 */
function Conversations({
  locale,
  sessions: initial,
  presentation = 'popover',
  running = false,
  startOpen = true,
  onOpenConversation,
  onDeleteConversation,
}: ConversationsProps) {
  const [sessions, setSessions] = useState(initial);
  const [open, setOpen] = useState(startOpen);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const sheet = presentation === 'sheet';
  return (
    <div
      ref={panel}
      style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minBlockSize: 0 }}
    >
      <AgentHeader
        locale={locale}
        face={{ mood: running ? 'working' : 'idle' }}
        scrolled={false}
        running={running}
        conversationsOpen={open}
        onConversations={() => {
          setOpen((was) => !was);
        }}
        onNewConversation={fn()}
        conversationsRef={anchor}
        conversationsControls={open ? listId : undefined}
        {...(sheet ? { onClose: fn(), onShowPage: fn() } : {})}
      />
      <div style={{ flex: '1 1 auto', minBlockSize: 0, paddingBlockStart: 'var(--bldr-space-md)' }}>
        <BuildRecord
          locale={locale}
          view={buildRecord('done', clinicRows(locale, Array<RowState>(8).fill('landed')), {
            elapsedMs: 141_000,
            collapsed: true,
            actions: {
              undoBuild: true,
              redoBuild: false,
              finishRest: 0,
              removeEmpty: 0,
              retryFailed: 0,
            },
          })}
          actions={buildActions}
          onMenuSelect={fn()}
        />
      </div>
      <HistoryPopover
        id={listId}
        locale={locale}
        sessions={sessions}
        open={open}
        onOpenChange={setOpen}
        onOpenConversation={onOpenConversation}
        onDeleteConversation={(id) => {
          onDeleteConversation(id);
          setSessions((list) => list.filter((session) => session.id !== id));
        }}
        anchorRef={anchor}
        presentation={presentation}
        running={running}
        now={FIXTURE_NOW}
        focusWhenEmpty={() =>
          panel.current?.querySelector<HTMLElement>(
            `.ck-agent-header [aria-label="${t(locale, 'header.new')}"]`,
          )
        }
      />
    </div>
  );
}

/* ── What every list must be (SPEC §4.18) ────────────────────────────────── */

async function listOf(canvasElement: HTMLElement, locale: Locale): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  return waitFor(() =>
    canvas.getByRole(
      canvasElement.querySelector('[data-presentation="sheet"]') === null ? 'dialog' : 'region',
      { name: t(locale, 'history.title') },
    ),
  );
}

function rowButtons(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>('.ck-agent-history-row__open')];
}

/** In the docked panel: e2, radius 9, 8px in from each side of a 320 panel (304 wide). */
async function expectPopoverFrame(canvasElement: HTMLElement, list: HTMLElement): Promise<void> {
  const panel = canvasElement.querySelector('.ck-agent')?.getBoundingClientRect();
  if (panel === undefined) throw new Error('no panel');
  const box = list.getBoundingClientRect();
  await expect(Math.round(box.width)).toBe(Math.min(360, Math.round(panel.width) - 16));
  await expect(box.height).toBeLessThanOrEqual(panel.height);
  await expect(getComputedStyle(list).borderTopLeftRadius).toBe('9px');
}

async function expectFocusOnCurrent(list: HTMLElement): Promise<void> {
  const current = list.querySelector<HTMLElement>('[aria-current="true"]');
  await waitFor(() => expect(current).toHaveFocus());
}

const meta = {
  title: 'Agent/History/HistoryPopover',
  component: Conversations,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    sessions: conversations('en'),
    onOpenConversation: fn(),
    onDeleteConversation: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof Conversations>;

export default meta;
type Story = StoryObj<typeof meta>;

function rtl(locale: Locale): Pick<Story, 'globals'> {
  return locale === 'ar' ? { globals: { direction: 'rtl' } } : {};
}

/* ── The list ────────────────────────────────────────────────────────────── */

function list(locale: Locale, theme: 'light' | 'dark' = 'light'): Story {
  return {
    args: { locale, sessions: conversations(locale) },
    parameters: { panel: { theme } },
    ...rtl(locale),
    play: async ({ canvasElement }) => {
      const element = await listOf(canvasElement, locale);
      await expectPopoverFrame(canvasElement, element);
      await expect(rowButtons(element)).toHaveLength(5);
      await expectFocusOnCurrent(element);
      // One tab stop for the whole list: the rows share it (SPEC §6.7).
      await expect(
        rowButtons(element).filter((button) => button.getAttribute('tabindex') === '0'),
      ).toHaveLength(1);
    },
  };
}

/** The §3.13 frame: five conversations, the current one first, focus on it. */
export const List: Story = list('en');
export const ListDark: Story = list('en', 'dark');
export const ListArabic: Story = list('ar');
export const ListArabicDark: Story = list('ar', 'dark');

/** At 420px the list stops at 360 (SPEC §3.17). */
export const ListWide: Story = { ...list('en'), parameters: { panel: { width: 420 } } };

/** ↓ moves, End jumps, Esc closes and returns focus to `[◷]` (SPEC §4.18, §6.7). */
export const Keyboard: Story = {
  args: { locale: 'en', sessions: conversations('en') },
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'en');
    await expectFocusOnCurrent(element);
    const rows = rowButtons(element);
    await userEvent.keyboard('{ArrowDown}');
    await expect(rows[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(rows[4]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(rows[0]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    const conversationsButton = within(canvasElement).getByRole('button', {
      name: t('en', 'header.conversations'),
    });
    await waitFor(() => expect(conversationsButton).toHaveFocus());
    await expect(conversationsButton).toHaveAttribute('aria-expanded', 'false');
  },
};

/** Nothing earlier: one quiet line where the rows would be. */
export const Empty: Story = {
  args: { locale: 'en', sessions: [] },
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'en');
    await expect(element).toHaveTextContent(t('en', 'history.empty'));
    await expect(element.querySelector('ul')).toBeNull();
  },
};

export const EmptyArabicDark: Story = {
  args: { locale: 'ar', sessions: [] },
  parameters: { panel: { theme: 'dark' } },
  ...rtl('ar'),
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'ar');
    await expect(element).toHaveTextContent(t('ar', 'history.empty'));
  },
};

/* ── Search, above eight conversations ───────────────────────────────────── */

/** Twelve conversations: the search field comes first and takes focus. */
export const Long: Story = {
  args: { locale: 'en', sessions: conversations('en', 12) },
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'en');
    const search = within(element).getByRole('searchbox', { name: t('en', 'history.search') });
    await waitFor(() => expect(search).toHaveFocus());
    await expect(rowButtons(element)).toHaveLength(12);
  },
};

export const LongArabic: Story = {
  args: { locale: 'ar', sessions: conversations('ar', 12) },
  ...rtl('ar'),
};

function search(locale: Locale, theme: 'light' | 'dark' = 'light'): Story {
  return {
    args: { locale, sessions: conversations(locale, 12) },
    parameters: { panel: { theme } },
    ...rtl(locale),
    play: async ({ canvasElement }) => {
      const element = await listOf(canvasElement, locale);
      const field = within(element).getByRole('searchbox');
      await waitFor(() => expect(field).toHaveFocus());
      await userEvent.type(field, SEARCH_QUERY[locale]);
      // Both clinics, whichever way «عيادة» was spelled (SPEC §4.18).
      await expect(rowButtons(element)).toHaveLength(2);
      await userEvent.keyboard('{ArrowDown}');
      await expect(rowButtons(element)[0]).toHaveFocus();
      await userEvent.keyboard('{ArrowUp}');
      await expect(field).toHaveFocus();
    },
  };
}

/** Typing narrows the list; ↓ enters it, ↑ from the first row returns to the field. */
export const Search: Story = search('en');
export const SearchDark: Story = search('en', 'dark');
export const SearchArabic: Story = search('ar');
export const SearchArabicDark: Story = search('ar', 'dark');

/** Nothing matches: the line says so, and the field keeps focus. */
export const SearchNoMatch: Story = {
  args: { locale: 'en', sessions: conversations('en', 12) },
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'en');
    const field = within(element).getByRole('searchbox');
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.type(field, 'bicycle');
    await expect(element).toHaveTextContent(t('en', 'history.noMatch'));
    await expect(field).toHaveFocus();
  },
};

/* ── Deleting ────────────────────────────────────────────────────────────── */

function deleting(locale: Locale, theme: 'light' | 'dark' = 'light'): Story {
  return {
    args: { locale, sessions: conversations(locale) },
    parameters: { panel: { theme } },
    ...rtl(locale),
    play: async ({ canvasElement }) => {
      const element = await listOf(canvasElement, locale);
      await expectFocusOnCurrent(element);
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Delete}');
      const cancel = within(element).getByRole('button', { name: t(locale, 'history.confirm.no') });
      await expect(cancel).toHaveFocus();
      await expect(within(element).getByRole('group')).toHaveAccessibleName(
        t(locale, 'history.confirm'),
      );
    },
  };
}

/** Delete asks in the row, with focus on Cancel; the list stays open around it. */
export const Deleting: Story = deleting('en');
export const DeletingDark: Story = deleting('en', 'dark');
export const DeletingArabic: Story = deleting('ar');
export const DeletingArabicDark: Story = deleting('ar', 'dark');

/** Esc spends itself on the question first: the list stays, focus returns to the row. */
export const DeletingEscape: Story = {
  args: { locale: 'en', sessions: conversations('en') },
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'en');
    await expectFocusOnCurrent(element);
    await userEvent.keyboard('{ArrowDown}');
    const row = rowButtons(element)[1];
    await userEvent.keyboard('{Delete}');
    await userEvent.keyboard('{Escape}');
    await expect(row).toHaveFocus();
    await expect(await listOf(canvasElement, 'en')).toBeInTheDocument();
  },
};

/** Deleted: the row goes, and focus lands on the one that took its place (SPEC §6.3). */
export const Deleted: Story = {
  args: { locale: 'en', sessions: conversations('en') },
  play: async ({ canvasElement, args }) => {
    const element = await listOf(canvasElement, 'en');
    await expectFocusOnCurrent(element);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Delete}');
    await userEvent.click(
      within(element).getByRole('button', { name: t('en', 'history.confirm.yes') }),
    );
    await expect(args.onDeleteConversation).toHaveBeenCalledWith('c-roaster');
    const rows = rowButtons(element);
    await expect(rows).toHaveLength(4);
    await expect(rows[1]).toHaveFocus();
    await expect(rows[1]).toHaveTextContent(conversations('en')[2]?.title ?? '');
  },
};

/* ── While a run is live ─────────────────────────────────────────────────── */

/** Other conversations wait, and the list says why; the current one cannot be deleted. */
export const Busy: Story = {
  args: { locale: 'en', sessions: conversations('en'), running: true },
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'en');
    await expect(element).toHaveTextContent(t('en', 'history.busy'));
    const [current, other] = rowButtons(element);
    await expect(current).not.toHaveAttribute('aria-disabled');
    await expect(other).toHaveAttribute('aria-disabled', 'true');
    await expect(other).toHaveAccessibleDescription(t('en', 'history.busy'));
  },
};

export const BusyArabic: Story = {
  args: { locale: 'ar', sessions: conversations('ar'), running: true },
  ...rtl('ar'),
};

/* ── The phone sheet: a page of its own ──────────────────────────────────── */

function phone(locale: Locale, theme: 'light' | 'dark' = 'light', count = 5): Story {
  return {
    args: { locale, sessions: conversations(locale, count), presentation: 'sheet' },
    parameters: { panel: { theme } },
    ...rtl(locale),
    play: async ({ canvasElement }) => {
      const element = await listOf(canvasElement, locale);
      const back = within(element).getByRole('button', { name: t(locale, 'history.back') });
      const panel = canvasElement.querySelector('.ck-agent')?.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      // It covers the sheet's face, header and all.
      await expect(Math.round(box.width)).toBe(Math.round(panel?.width ?? 0));
      await expect(Math.round(box.height)).toBe(Math.round(panel?.height ?? 0));
      // Back stands where Close stood: at the inline start, 44px.
      await expect(Math.round(back.getBoundingClientRect().height)).toBe(44);
      for (const row of rowButtons(element)) {
        await expect(Math.round(row.getBoundingClientRect().height)).toBe(44);
      }
    },
  };
}

/** The phone's full-sheet list, with Back at the inline start (mirrored in Arabic). */
export const Sheet: Story = phone('en');
export const SheetDark: Story = phone('en', 'dark');
export const SheetArabic: Story = phone('ar');
export const SheetArabicDark: Story = phone('ar', 'dark');
export const SheetSearchArabic: Story = phone('ar', 'light', 12);

/** Back closes the page and returns focus to `[◷]`. */
export const SheetBack: Story = {
  args: { locale: 'ar', sessions: conversations('ar'), presentation: 'sheet' },
  ...rtl('ar'),
  play: async ({ canvasElement }) => {
    const element = await listOf(canvasElement, 'ar');
    await userEvent.click(within(element).getByRole('button', { name: t('ar', 'history.back') }));
    const conversationsButton = within(canvasElement).getByRole('button', {
      name: t('ar', 'header.conversations'),
    });
    await waitFor(() => expect(conversationsButton).toHaveFocus());
  },
};
