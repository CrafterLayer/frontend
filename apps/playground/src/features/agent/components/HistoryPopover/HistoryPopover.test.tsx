/**
 * HistoryPopover (SPEC §4.18, §3.13, §6.3, §6.7): the Conversations list.
 *
 * Every focus destination is asserted by name, never by "focus left X" (a focus that fell
 * to `body` passes that): opening lands on the current conversation or the search field;
 * the arrows, Home and End move between rows that share one tab stop; Esc closes and
 * returns to `[◷]`; a delete lands on the row that took the deleted one's place, else the
 * new last row, else the search field, else New conversation. Search folds the letters
 * people type interchangeably, Arabic first. The phone sheet's page has Back.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale, SessionSummary } from '../../model/view-types';
import {
  conversations,
  FIXTURE_NOW,
  SEARCH_QUERY,
} from '../../testing/wp-15-history-phone-fixtures';

import { HistoryPopover, SEARCH_THRESHOLD, type HistoryPresentation } from './HistoryPopover';
import { foldForSearch, matchesQuery } from './match-conversation';

beforeAll(() => {
  // Radix measures the popover and its tooltips; jsdom has no ResizeObserver. These tests
  // read names, roles and focus, never positions.
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'HistoryPopover',
    'HistoryPopover.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface HarnessProps {
  readonly locale?: Locale;
  readonly sessions: readonly SessionSummary[];
  readonly presentation?: HistoryPresentation;
  readonly running?: boolean;
  readonly onOpenConversation?: (id: string) => void;
  readonly onDeleteConversation?: (id: string) => void;
  readonly onOpenChange?: (open: boolean) => void;
}

/**
 * The header's two buttons and the list, wired as AgentPanel wires them: `[◷]` toggles
 * the list and anchors it; a delete removes the row, as the controller would; New
 * conversation takes focus when nothing is left.
 */
function Harness({
  locale = 'en',
  sessions: initial,
  presentation = 'popover',
  running = false,
  onOpenConversation = vi.fn(),
  onDeleteConversation = vi.fn(),
  onOpenChange,
}: HarnessProps) {
  const [sessions, setSessions] = useState(initial);
  const [open, setOpen] = useState(true);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const newButton = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="ck-agent" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {t(locale, 'header.conversations')}
      </button>
      <button ref={newButton} type="button">
        {t(locale, 'header.new')}
      </button>
      <HistoryPopover
        locale={locale}
        sessions={sessions}
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
        onOpenConversation={onOpenConversation}
        onDeleteConversation={(id) => {
          onDeleteConversation(id);
          setSessions((list) => list.filter((session) => session.id !== id));
        }}
        anchorRef={anchor}
        presentation={presentation}
        running={running}
        now={FIXTURE_NOW}
        focusWhenEmpty={() => newButton.current}
      />
    </div>
  );
}

function conversationsButton(locale: Locale = 'en'): HTMLElement {
  return screen.getByRole('button', { name: t(locale, 'header.conversations') });
}

async function theList(locale: Locale = 'en'): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: t(locale, 'history.title') }));
}

function rows(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>('.ck-agent-history-row__open')];
}

function rowNamed(list: HTMLElement, title: string): HTMLElement {
  const found = rows(list).find((row) => row.textContent.includes(title));
  if (found === undefined) throw new Error(`no row «${title}»`);
  return found;
}

const FIVE = conversations('en');
const TWELVE = conversations('en', 12);

function titleOf(list: readonly SessionSummary[], index: number): string {
  return list[index]?.title ?? '';
}

/* ── Opening, reading, moving ────────────────────────────────────────────── */

describe('HistoryPopover', () => {
  it('opens as a dialog named Conversations, on the current conversation', async () => {
    render(<Harness sessions={FIVE} />);
    const list = await theList();
    expect(within(list).getByRole('heading', { name: 'Conversations' })).toBeInTheDocument();
    expect(rows(list)).toHaveLength(5);
    const current = rowNamed(list, titleOf(FIVE, 0));
    expect(current).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(current).toHaveFocus());
  });

  it('gives the rows one tab stop, and no search field at eight or fewer', async () => {
    render(<Harness sessions={conversations('en', SEARCH_THRESHOLD)} />);
    const list = await theList();
    expect(rows(list).filter((row) => row.tabIndex === 0)).toHaveLength(1);
    expect(within(list).queryByRole('searchbox')).toBeNull();
  });

  it('moves with ↑ ↓, jumps with Home and End, and the tab stop follows', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={FIVE} />);
    const list = await theList();
    const [first, second, , , last] = rows(list);
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{End}');
    expect(last).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(last).toHaveFocus();
    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(first).toHaveFocus();
  });

  it('closes on Esc and returns focus to Conversations', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={FIVE} />);
    const list = await theList();
    await waitFor(() => expect(rows(list)[0]).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(conversationsButton()).toHaveFocus());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(conversationsButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens another conversation with Enter, closes, and returns focus to Conversations', async () => {
    const user = userEvent.setup();
    const onOpenConversation = vi.fn();
    render(<Harness sessions={FIVE} onOpenConversation={onOpenConversation} />);
    const list = await theList();
    await waitFor(() => expect(rows(list)[0]).toHaveFocus());
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onOpenConversation).toHaveBeenCalledWith('c-roaster');
    await waitFor(() => expect(conversationsButton()).toHaveFocus());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('choosing the current conversation just closes the list', async () => {
    const user = userEvent.setup();
    const onOpenConversation = vi.fn();
    render(<Harness sessions={FIVE} onOpenConversation={onOpenConversation} />);
    const list = await theList();
    await user.click(rows(list)[0]!);
    expect(onOpenConversation).not.toHaveBeenCalled();
    await waitFor(() => expect(conversationsButton()).toHaveFocus());
  });

  it('pressing Conversations again closes the list once, not closes and reopens it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness sessions={FIVE} onOpenChange={onOpenChange} />);
    await theList();
    await user.click(conversationsButton());
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(true);
    await waitFor(() => expect(conversationsButton()).toHaveFocus());
  });

  it('labels the dialog and every row in Arabic when the panel speaks Arabic', async () => {
    render(<Harness locale="ar" sessions={conversations('ar')} />);
    const list = await theList('ar');
    expect(list).toHaveAttribute('dir', 'rtl');
    expect(list).toHaveAttribute('lang', 'ar');
    expect(within(list).getByText(t('ar', 'history.current'))).toBeInTheDocument();
    expect(within(list).getAllByRole('button', { name: t('ar', 'history.delete') })).toHaveLength(
      5,
    );
  });

  it('says so when there is nothing earlier', async () => {
    render(<Harness sessions={[]} />);
    const list = await theList();
    expect(list).toHaveTextContent(t('en', 'history.empty'));
    expect(within(list).queryByRole('list')).toBeNull();
  });

  /* ── Search ─────────────────────────────────────────────────────────────── */

  it('above eight conversations, puts a search field first and focuses it', async () => {
    render(<Harness sessions={TWELVE} />);
    const list = await theList();
    const field = within(list).getByRole('searchbox', { name: 'Search conversations' });
    await waitFor(() => expect(field).toHaveFocus());
    expect(rows(list)).toHaveLength(12);
  });

  it('narrows as it is typed, ↓ enters the list and ↑ from the first row returns', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={TWELVE} />);
    const list = await theList();
    const field = within(list).getByRole('searchbox');
    await waitFor(() => expect(field).toHaveFocus());
    await user.type(field, SEARCH_QUERY.en);
    expect(rows(list).map((row) => row.textContent)).toEqual([
      expect.stringContaining('dental clinic'),
      expect.stringContaining('Physiotherapy clinic'),
    ]);
    await user.keyboard('{ArrowDown}');
    expect(rows(list)[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(field).toHaveFocus();
  });

  it('finds «عيادة» when «عياده» is typed', async () => {
    const user = userEvent.setup();
    const sessions = conversations('ar', 12);
    render(<Harness locale="ar" sessions={sessions} />);
    const list = await theList('ar');
    const field = within(list).getByRole('searchbox');
    await waitFor(() => expect(field).toHaveFocus());
    await user.type(field, SEARCH_QUERY.ar);
    expect(rows(list)).toHaveLength(2);
    expect(rowNamed(list, titleOf(sessions, 0))).toBeInTheDocument();
  });

  it('says when nothing matches, and keeps focus in the field', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={TWELVE} />);
    const list = await theList();
    const field = within(list).getByRole('searchbox');
    await waitFor(() => expect(field).toHaveFocus());
    await user.type(field, 'bicycle');
    expect(list).toHaveTextContent('No matching conversations');
    expect(field).toHaveFocus();
  });

  /* ── Deleting ───────────────────────────────────────────────────────────── */

  it('asks with the Delete key, focus on Cancel; Esc closes only the question', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={FIVE} />);
    const list = await theList();
    await waitFor(() => expect(rows(list)[0]).toHaveFocus());
    await user.keyboard('{ArrowDown}{Delete}');
    expect(within(list).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(rowNamed(list, titleOf(FIVE, 1))).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Conversations' })).toBeInTheDocument();
  });

  it('keeps one question open at a time', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={FIVE} />);
    const list = await theList();
    const trash = within(list).getAllByRole('button', { name: 'Delete conversation' });
    await user.click(trash[1]!);
    await user.click(trash[3]!);
    expect(within(list).getAllByRole('group')).toHaveLength(1);
  });

  it('after a delete, focuses the row that took its place', async () => {
    const user = userEvent.setup();
    const onDeleteConversation = vi.fn();
    render(<Harness sessions={FIVE} onDeleteConversation={onDeleteConversation} />);
    const list = await theList();
    await waitFor(() => expect(rows(list)[0]).toHaveFocus());
    await user.keyboard('{ArrowDown}{Delete}');
    await user.click(within(list).getByRole('button', { name: 'Delete' }));
    expect(onDeleteConversation).toHaveBeenCalledWith('c-roaster');
    expect(rows(list)).toHaveLength(4);
    expect(rowNamed(list, titleOf(FIVE, 2))).toHaveFocus();
  });

  it('after deleting the last row, focuses the new last row', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={FIVE} />);
    const list = await theList();
    await waitFor(() => expect(rows(list)[0]).toHaveFocus());
    await user.keyboard('{End}{Delete}');
    await user.click(within(list).getByRole('button', { name: 'Delete' }));
    expect(rowNamed(list, titleOf(FIVE, 3))).toHaveFocus();
  });

  it('after deleting the last match of a search, focuses the search field', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={TWELVE} />);
    const list = await theList();
    const field = within(list).getByRole('searchbox');
    await waitFor(() => expect(field).toHaveFocus());
    await user.type(field, 'yoga');
    expect(rows(list)).toHaveLength(1);
    await user.click(within(list).getByRole('button', { name: 'Delete conversation' }));
    await user.click(within(list).getByRole('button', { name: 'Delete' }));
    expect(field).toHaveFocus();
    expect(list).toHaveTextContent('No matching conversations');
  });

  it('after deleting the only conversation, focuses New conversation and closes', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={conversations('en', 1)} />);
    const list = await theList();
    await user.click(within(list).getByRole('button', { name: 'Delete conversation' }));
    await user.click(within(list).getByRole('button', { name: 'Delete' }));
    const newConversation = screen.getByRole('button', { name: 'New conversation' });
    await waitFor(() => expect(newConversation).toHaveFocus());
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(newConversation).toHaveFocus();
  });

  /* ── While a run is live ────────────────────────────────────────────────── */

  it('while a run is live, keeps other conversations waiting and says why', async () => {
    const user = userEvent.setup();
    const onOpenConversation = vi.fn();
    render(<Harness sessions={FIVE} running onOpenConversation={onOpenConversation} />);
    const list = await theList();
    expect(list).toHaveTextContent(t('en', 'history.busy'));
    const [current, other] = rows(list);
    expect(current).not.toHaveAttribute('aria-disabled');
    expect(other).toHaveAttribute('aria-disabled', 'true');
    expect(other).toHaveAccessibleDescription(t('en', 'history.busy'));
    await user.click(other!);
    expect(onOpenConversation).not.toHaveBeenCalled();
    const trash = within(list).getAllByRole('button', { name: 'Delete conversation' });
    expect(trash[0]).toHaveAttribute('aria-disabled', 'true');
    expect(trash[1]).not.toHaveAttribute('aria-disabled');
  });

  /* ── The phone sheet ────────────────────────────────────────────────────── */

  it('in the phone sheet, is a page of its own with Back, on the current conversation', () => {
    render(<Harness sessions={FIVE} presentation="sheet" />);
    const page = screen.getByRole('region', { name: 'Conversations' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(page).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    const current = rowNamed(page, titleOf(FIVE, 0));
    expect(current).toHaveFocus();
    expect(page.querySelectorAll('li[data-touch]')).toHaveLength(5);
  });

  it('in the phone sheet, Back closes the page and returns focus to Conversations', async () => {
    const user = userEvent.setup();
    render(<Harness sessions={FIVE} presentation="sheet" />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('region', { name: 'Conversations' })).toBeNull();
    expect(conversationsButton()).toHaveFocus();
  });

  it('in the phone sheet, Esc does the same, and does not reach the sheet behind', async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Harness sessions={FIVE} presentation="sheet" />
      </div>,
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Conversations' })).toBeNull();
    expect(conversationsButton()).toHaveFocus();
    expect(outer).not.toHaveBeenCalled();
  });

  it('in the phone sheet, with twelve, focuses the search field', () => {
    render(<Harness sessions={TWELVE} presentation="sheet" />);
    expect(screen.getByRole('searchbox', { name: 'Search conversations' })).toHaveFocus();
  });
});

/* ── Search folding ──────────────────────────────────────────────────────── */

describe('foldForSearch', () => {
  it.each([
    ['عيادة', 'عياده'],
    ['أحمد', 'احمد'],
    ['إربد', 'اربد'],
    ['آمنة', 'امنه'],
    ['مستشفى', 'مستشفي'],
    ['مُؤسَّسة', 'موسسه'],
    ['قـــهوة', 'قهوه'],
    ['کتاب ی', 'كتاب ي'],
    ['٢١ أيلول', '21 ايلول'],
    ['Café  Latte', 'cafe latte'],
  ])('%s → %s', (input, folded) => {
    expect(foldForSearch(input)).toBe(folded);
  });

  it('matches every word, in any order', () => {
    expect(matchesQuery('A dental clinic page in Amman', 'amman clinic')).toBe(true);
    expect(matchesQuery('A dental clinic page in Amman', 'amman bakery')).toBe(false);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });
});

describe('HistoryPopover.css', () => {
  it('floats (e2, radius 9) at the panel width less 16, never wider than 360', () => {
    expect(CSS).toMatch(
      /\[data-presentation='popover'\]\s*\{[^}]*inline-size:\s*min\(360px, calc\(100cqi - var\(--bldr-space-3xl\)\)\)/u,
    );
    expect(CSS).toMatch(
      /\[data-presentation='popover'\]\s*\{[^}]*border-radius:\s*var\(--bldr-radius-lg\)/u,
    );
    expect(CSS).toMatch(
      /\[data-presentation='popover'\]\s*\{[^}]*box-shadow:\s*var\(--bldr-shadow-floating\)/u,
    );
    expect(CSS).toMatch(
      /\[data-presentation='popover'\]\s*\{[^}]*max-block-size:\s*min\(\s*calc\(0\.6 \*/u,
    );
  });

  it('scrolls only the list, and never on into the thread', () => {
    expect(CSS).toMatch(
      /\.ck-agent-history__list\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/u,
    );
  });

  it('rises 4px from its anchor on arriving, opacity only under reduced motion', () => {
    expect(CSS).toMatch(/--ck-agent-float-from:\s*calc\(-1 \* var\(--bldr-space-xs\)\)/u);
    expect(CSS).toMatch(
      /animation:\s*ck-agent-history-in var\(--bldr-duration-enter\) var\(--bldr-easing-enter\)/u,
    );
    expect(CSS).toMatch(
      /animation:\s*ck-agent-history-out var\(--bldr-duration-exit\) var\(--bldr-easing-exit\)/u,
    );
    const reduced = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/ck-agent-history-fade-in var\(--bldr-duration-state\)/u);
  });

  it('gives the search field 16px text and 44px on a finger, so iOS never zooms', () => {
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)[\s\S]*block-size:\s*var\(--bldr-hit-target-min\)/u,
    );
    expect(CSS).toMatch(
      /\[data-presentation='sheet'\] \.ck-agent-history__search-field\s*\{[^}]*font-size:\s*16px/u,
    );
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--bldr-[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
