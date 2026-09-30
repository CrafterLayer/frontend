/**
 * HistoryRow (SPEC §4.18): one conversation in the Conversations list.
 *
 * What the owner sees and what a screen reader hears, each a test: the title and its time
 * as one phrase; the current conversation marked by Mist, a bar and the word "Current",
 * never by ✓; Delete a sibling of the row button, asking first in the row; the Delete key
 * doing the same; and focus named at every step (Cancel on asking, back to whichever
 * control opened the question on Esc).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { formatWhen, t } from '../../copy';
import type { Locale, SessionSummary } from '../../model/view-types';
import { conversations, FIXTURE_NOW } from '../../testing/wp-15-history-phone-fixtures';

import { HistoryRow, type HistoryRowProps } from './HistoryRow';

beforeAll(() => {
  // Radix measures tooltips; jsdom has no ResizeObserver. These tests never read positions.
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
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'HistoryRow', 'HistoryRow.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function session(locale: Locale, index: number, current = false): SessionSummary {
  const found = conversations(locale, 12, null)[index];
  if (found === undefined) throw new Error(`no conversation ${String(index)}`);
  return { ...found, current };
}

function renderRow(overrides: Partial<HistoryRowProps> = {}) {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  const props: HistoryRowProps = {
    locale: 'en',
    session: session('en', 1),
    now: FIXTURE_NOW,
    onOpen,
    onDelete,
    ...overrides,
  };
  const utils = render(
    <ul>
      <HistoryRow {...props} />
    </ul>,
  );
  return { ...utils, onOpen, onDelete, props };
}

function rowButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('.ck-agent-history-row__open');
  if (button === null) throw new Error('no row button');
  return button;
}

describe('HistoryRow', () => {
  it('shows the first request and its time, and says them as one phrase', () => {
    const { container, props } = renderRow();
    const when = formatWhen('en', props.session.updatedAt ?? 0, FIXTURE_NOW);
    expect(when).toBe('Yesterday');
    const open = rowButton(container);
    expect(open).toHaveAccessibleName(`${props.session.title}, Yesterday`);
    expect(open).toHaveTextContent(props.session.title);
    expect(within(open).getByText('Yesterday').tagName).toBe('TIME');
  });

  it('marks the current conversation by word and by aria-current, never by a check mark', () => {
    const { container } = renderRow({ session: session('en', 0, true) });
    const open = rowButton(container);
    expect(open).toHaveAttribute('aria-current', 'true');
    expect(within(open).getByText('Current')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/✓|✔/u);
    expect(container.querySelector('li')).toHaveAttribute('data-current');
  });

  it('names an untitled new conversation "New conversation", visibly and to a screen reader', () => {
    for (const locale of ['en', 'ar'] as const) {
      const { container, unmount } = renderRow({
        locale,
        session: { ...session(locale, 0, true), title: '', updatedAt: null },
      });
      const open = rowButton(container);
      const fallback = t(locale, 'header.new');
      expect(open.querySelector('.ck-agent-history-row__title')).toHaveTextContent(fallback);
      expect(open).toHaveAccessibleName(fallback);
      expect(within(open).getByText(t(locale, 'history.current'))).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps "Current" visible on the current row while it has focus', () => {
    expect(CSS).toMatch(
      /\.ck-agent-history-row\[data-current\]:focus-within \.ck-agent-history-row__meta[^{]*\{[^}]*opacity:\s*1/u,
    );
  });

  it('leaves a past conversation unmarked', () => {
    const { container } = renderRow();
    expect(rowButton(container)).not.toHaveAttribute('aria-current');
    expect(container.textContent).not.toContain('Current');
  });

  it('shows no time for a conversation migrated without one', () => {
    const { container, props } = renderRow({ session: session('en', 11) });
    expect(props.session.updatedAt).toBeNull();
    expect(rowButton(container)).toHaveAccessibleName(props.session.title);
    expect(container.querySelector('time')).toBeNull();
  });

  it('shows a date past six days, in Latin digits in Arabic too', () => {
    const { container } = renderRow({ locale: 'ar', session: session('ar', 3) });
    expect(container.querySelector('time')?.textContent).toMatch(/^21 /u);
  });

  it('opens the conversation it names', async () => {
    const user = userEvent.setup();
    const { container, onOpen } = renderRow();
    await user.click(rowButton(container));
    expect(onOpen).toHaveBeenCalledWith('c-roaster');
    rowButton(container).focus();
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('puts Delete beside the row button, not inside it, named for what it deletes', () => {
    const { container, props } = renderRow();
    const trash = screen.getByRole('button', { name: 'Delete conversation' });
    expect(rowButton(container).contains(trash)).toBe(false);
    expect(trash).toHaveAccessibleDescription(props.session.title);
  });

  it('asks before deleting, in the row, with focus on Cancel; Esc returns to Delete', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    const group = screen.getByRole('group', { name: t('en', 'history.confirm') });
    expect(within(group).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Delete conversation' })).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes once the question is answered', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('c-roaster');
  });

  it.each(['{Delete}', '{Backspace}'])(
    'asks on %s from the row, and Esc returns focus to the row itself',
    async (key) => {
      const user = userEvent.setup();
      const { container, onDelete } = renderRow();
      rowButton(container).focus();
      await user.keyboard(key);
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(rowButton(container)).toHaveFocus();
      expect(onDelete).not.toHaveBeenCalled();
    },
  );

  it('Cancel after the Delete key also returns to the row', async () => {
    const user = userEvent.setup();
    const { container } = renderRow();
    rowButton(container).focus();
    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rowButton(container)).toHaveFocus();
  });

  it('while a run is live, keeps another conversation focusable but unavailable, and says why', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { container } = render(
      <ul>
        <HistoryRow
          locale="en"
          session={session('en', 1)}
          now={FIXTURE_NOW}
          onOpen={onOpen}
          onDelete={vi.fn()}
          openUnavailable
          unavailableId="busy"
        />
        <li id="busy">{t('en', 'history.busy')}</li>
      </ul>,
    );
    const open = rowButton(container);
    expect(open).toHaveAttribute('aria-disabled', 'true');
    expect(open).not.toBeDisabled();
    expect(open).toHaveAccessibleDescription(t('en', 'history.busy'));
    await user.click(open);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the current conversation from being deleted while its run is live', async () => {
    const user = userEvent.setup();
    const { container, onDelete } = renderRow({
      session: session('en', 0, true),
      deleteUnavailable: true,
    });
    const trash = screen.getByRole('button', { name: 'Delete conversation' });
    expect(trash).toHaveAttribute('aria-disabled', 'true');
    await user.click(trash);
    rowButton(container).focus();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('group')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('takes one tab stop for the list: off the stop, both buttons leave the tab order', () => {
    const { container } = renderRow({ tabStop: false });
    expect(rowButton(container)).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Delete conversation' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('gives a title in the other script its own direction and language', () => {
    const { container } = renderRow({ session: session('en', 5) });
    const title = container.querySelector('.ck-agent-history-row__title');
    expect(title).toHaveAttribute('dir', 'rtl');
    expect(title).toHaveAttribute('lang', 'ar');
  });

  it('leaves a title in the UI’s own script alone', () => {
    const { container } = renderRow({ locale: 'ar', session: session('ar', 1) });
    const title = container.querySelector('.ck-agent-history-row__title');
    expect(title).toHaveAttribute('dir', 'rtl');
    expect(title).not.toHaveAttribute('lang');
  });

  it('speaks Arabic in Arabic: «الحالية» and a quoted title', () => {
    const { container } = renderRow({ locale: 'ar', session: session('ar', 0, true) });
    const open = rowButton(container);
    expect(within(open).getByText(t('ar', 'history.current'))).toBeInTheDocument();
    expect(open.getAttribute('aria-label')).toMatch(/^«.+»، /u);
    expect(screen.getByRole('button', { name: t('ar', 'history.delete') })).toBeInTheDocument();
  });

  it('marks the phone sheet’s rows for touch', () => {
    const { container } = renderRow({ touch: true });
    expect(container.querySelector('li')).toHaveAttribute('data-touch');
  });
});

describe('HistoryRow.css', () => {
  it('is 40px on a mouse and 44 on a finger', () => {
    expect(CSS).toMatch(
      /--ck-agent-history-row-height:\s*max\(\s*calc\(var\(--bldr-control-md\) \+ var\(--bldr-space-md\)\),\s*var\(--bldr-agent-row-height\)\s*\)/u,
    );
    expect(CSS).toMatch(
      /\[data-touch\]\s*\{[^}]*--ck-agent-history-row-height:\s*var\(--bldr-hit-target-min\)/u,
    );
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)[\s\S]*--ck-agent-history-delete:\s*var\(--bldr-hit-target-min\)/u,
    );
  });

  it('draws the ring inside the row, from tokens', () => {
    expect(CSS).toMatch(
      /__open:focus-visible\s*\{[^}]*outline:\s*var\(--bldr-focus-ring-width\) solid var\(--bldr-focus-ring\)[^}]*outline-offset:\s*calc\(-1 \* var\(--bldr-focus-ring-width\)\)/u,
    );
  });

  it('marks the current row with Mist, a 2px Indigo bar, and Graphite (never Slate) on Mist', () => {
    expect(CSS).toMatch(
      /\[data-current\] \.ck-agent-history-row__open\s*\{[^}]*--bldr-accent-soft/u,
    );
    expect(CSS).toMatch(
      /\[data-current\] \.ck-agent-history-row__open::before\s*\{[^}]*border-inline-start:\s*var\(--bldr-border-thick\) solid var\(--bldr-accent\)/u,
    );
    expect(CSS).toMatch(
      /\[data-current\] \.ck-agent-history-row__meta\s*\{[^}]*--bldr-panel-text-soft/u,
    );
  });

  it('never paints a hover in Indigo', () => {
    for (const [, body = ''] of CSS.matchAll(/:hover[^{}]*\{([^}]*)\}/gu)) {
      expect(body).not.toMatch(/--bldr-accent(?:-strong|-ring)?\)/u);
    }
  });

  it('keeps Delete in reach on a finger and quiet under reduced motion', () => {
    expect(CSS).toMatch(/@media \(pointer: coarse\)[\s\S]*opacity:\s*1/u);
    expect(CSS).toMatch(/prefers-reduced-motion: reduce[\s\S]*transition:\s*none/u);
    expect(CSS).toMatch(/forced-colors: active[\s\S]*Highlight/u);
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
