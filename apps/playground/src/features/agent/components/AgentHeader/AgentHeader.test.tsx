/**
 * AgentHeader (SPEC §4.2): one 44px line, the face, one name, two actions.
 *
 * The owner's screenshot of the v1 header read "Agent  Let m…", with a truncated
 * conversation title and a count badge beside it. Every test here keeps one of those out:
 * one name in the UI language and no other words, in every state; the two actions with
 * their popup and availability semantics; the hairline only while scrolled; and the
 * phone sheet's extra Close and Show the page, in reading order.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { AgentHeader, type AgentHeaderProps } from './AgentHeader';

/*
  Radix measures a tooltip before positioning it, and jsdom has no ResizeObserver. A no-op
  is the honest stand-in: these tests read what the tooltip says, never where it lands.
*/
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'AgentHeader', 'AgentHeader.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function props(overrides: Partial<AgentHeaderProps> = {}): AgentHeaderProps {
  return {
    locale: 'en',
    face: { mood: 'idle' },
    scrolled: false,
    running: false,
    conversationsOpen: false,
    onConversations: vi.fn(),
    onNewConversation: vi.fn(),
    ...overrides,
  };
}

function headerOf(container: HTMLElement): HTMLElement {
  const header = container.querySelector<HTMLElement>('.ck-agent-header');
  if (header === null) throw new Error('no header');
  return header;
}

/** The words the header draws: its text, less what is `hidden` (a tooltip's hint). */
function drawnText(header: HTMLElement): string {
  const copy = header.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[hidden]')) hidden.remove();
  return copy.textContent.replace(/\s+/gu, ' ').trim();
}

describe('AgentHeader', () => {
  it('names the panel once, in the UI language: an h2 and no other words', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = render(<AgentHeader {...props({ locale })} />);
      const header = headerOf(container);
      const name = within(header).getByRole('heading', { level: 2 });
      expect(name).toHaveTextContent(t(locale, 'header.name'));
      expect(drawnText(header)).toBe(t(locale, 'header.name'));
      expect(within(header).getAllByRole('heading')).toHaveLength(1);
      unmount();
    }
    const { container } = render(<AgentHeader {...props({ locale: 'ar' })} />);
    expect(drawnText(headerOf(container))).toBe('أبو غضب');
  });

  it('never says "Agent", a status, a title or a count, even while a run is live', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = render(
        <AgentHeader {...props({ locale, running: true, face: { mood: 'working' } })} />,
      );
      const drawn = drawnText(headerOf(container));
      expect(drawn).toBe(t(locale, 'header.name'));
      expect(drawn).not.toMatch(/agent|\d|…/iu);
      unmount();
    }
  });

  it('opens Conversations as a dialog trigger that says whether it is open', async () => {
    const user = userEvent.setup();
    const onConversations = vi.fn();
    const { rerender } = render(<AgentHeader {...props({ onConversations })} />);
    const button = screen.getByRole('button', { name: 'Conversations' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
    await user.click(button);
    expect(onConversations).toHaveBeenCalledTimes(1);

    rerender(
      <AgentHeader
        {...props({ onConversations, conversationsOpen: true, conversationsControls: 'history' })}
      />,
    );
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'history');
  });

  it('hands the Conversations button to its popover, to anchor to and return focus to', () => {
    const conversationsRef = createRef<HTMLButtonElement>();
    render(<AgentHeader {...props({ conversationsRef })} />);
    const button = screen.getByRole('button', { name: 'Conversations' });
    expect(conversationsRef.current).toBe(button);
    conversationsRef.current?.focus();
    expect(button).toHaveFocus();
  });

  it('starts a new conversation when nothing runs', async () => {
    const user = userEvent.setup();
    const onNewConversation = vi.fn();
    render(<AgentHeader {...props({ onNewConversation })} />);
    const fresh = screen.getByRole('button', { name: 'New conversation' });
    expect(fresh).not.toHaveAttribute('aria-disabled');
    await user.click(fresh);
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('while running, keeps New conversation focusable, unavailable, and says when it will be', async () => {
    const user = userEvent.setup();
    const onNewConversation = vi.fn();
    render(<AgentHeader {...props({ running: true, onNewConversation })} />);
    const fresh = screen.getByRole('button', { name: 'New conversation' });
    expect(fresh).toHaveAttribute('aria-disabled', 'true');
    expect(fresh).not.toBeDisabled();
    expect(fresh).toHaveAccessibleDescription('Available when the current work ends');
    await user.click(fresh);
    expect(onNewConversation).not.toHaveBeenCalled();
    // Still in the tab order: focus lands on it and stays, and Enter does nothing either.
    expect(fresh).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onNewConversation).not.toHaveBeenCalled();
    expect(fresh).toHaveFocus();
  });

  it('draws the hairline only while the thread is scrolled beneath it', () => {
    const { container, rerender } = render(<AgentHeader {...props()} />);
    expect(headerOf(container)).not.toHaveAttribute('data-scrolled');
    rerender(<AgentHeader {...props({ scrolled: true })} />);
    expect(headerOf(container)).toHaveAttribute('data-scrolled');
  });

  it('wears the 24px face, live, as decoration, in the run’s mood', () => {
    const { container } = render(
      <AgentHeader {...props({ face: { mood: 'planning', variant: 'checking' } })} />,
    );
    const wrapper = container.querySelector('.ck-agent-header__face');
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    const face = wrapper?.querySelector('.pg-face');
    expect(face).toHaveAttribute('data-size', 'sm');
    expect(face).toHaveAttribute('data-live');
    expect(face).toHaveAttribute('data-mood', 'planning');
    expect(face).toHaveAttribute('data-variant', 'checking');
  });

  it('takes the heading id it is given, so the panel can be named by it', () => {
    render(
      <section aria-labelledby="agent-name">
        <AgentHeader {...props({ headingId: 'agent-name' })} />
      </section>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'agent-name');
    expect(screen.getByRole('region', { name: 'Abu Ghadab' })).toBeVisible();
  });

  it('in the phone sheet, puts Close first and Show the page last', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onShowPage = vi.fn();
    const { container } = render(<AgentHeader {...props({ locale: 'ar', onClose, onShowPage })} />);
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      t('ar', 'sheet.close'),
      t('ar', 'header.conversations'),
      t('ar', 'header.new'),
      t('ar', 'sheet.showPage'),
    ]);
    expect(headerOf(container)).toHaveAttribute('data-sheet');
    await user.click(screen.getByRole('button', { name: t('ar', 'sheet.close') }));
    await user.click(screen.getByRole('button', { name: t('ar', 'sheet.showPage') }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShowPage).toHaveBeenCalledTimes(1);
  });

  it('leaves Close and Show the page out of the docked panel', () => {
    render(<AgentHeader {...props()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

describe('AgentHeader.css', () => {
  it('is one 44px line: 16px in at the start, 8 at the end, actions 4 apart', () => {
    expect(CSS).toMatch(/block-size:\s*var\(--bldr-agent-header-height\)/u);
    expect(CSS).toMatch(/padding-inline:\s*var\(--bldr-space-3xl\) var\(--bldr-space-md\)/u);
    expect(CSS).toMatch(/\.ck-agent-header__name\s*\{[^}]*white-space:\s*nowrap/u);
    expect(CSS).toMatch(/\.ck-agent-header__actions\s*\{[^}]*gap:\s*var\(--bldr-space-xs\)/u);
  });

  it('sets the name in Name type, 600, Ink', () => {
    expect(CSS).toMatch(/font-size:\s*var\(--bldr-font-size-name\)/u);
    expect(CSS).toMatch(/line-height:\s*var\(--bldr-line-height-name\)/u);
    expect(CSS).toMatch(/font-weight:\s*var\(--bldr-font-weight-semibold\)/u);
  });

  it('draws the hairline inside the header, Rule under more contrast, a border in forced colours', () => {
    expect(CSS).toMatch(
      /\[data-scrolled\]\s*\{[^}]*box-shadow:\s*inset[^;]*var\(--bldr-panel-border\)/u,
    );
    expect(CSS).toMatch(/prefers-contrast: more[\s\S]*var\(--bldr-panel-border-strong\)/u);
    expect(CSS).toMatch(/forced-colors: active[\s\S]*border-block-end/u);
  });

  it('follows the thread’s gutter below 320px and spaces touch targets 8px apart', () => {
    expect(CSS).toMatch(/@container agent \(inline-size < 320px\)/u);
    expect(CSS).toMatch(/@media \(pointer: coarse\)[\s\S]*gap:\s*var\(--bldr-space-md\)/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
    // Hover belongs to IconButton; the header never paints Indigo.
    expect(CSS).not.toMatch(/--bldr-accent/u);
  });
});
