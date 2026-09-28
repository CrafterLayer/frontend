/**
 * JumpToLatest (SPEC §4.4, §3.12): the pill that says why there is news below.
 *
 * Its word per run ("Latest" idle, "Building", "Editing", "Working"), its name opening
 * with that word (WCAG 2.5.3), a press by pointer or key, and, hidden, no trace in the tab
 * order or the accessibility tree. Where it shows and when is AgentThread's test.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { JUMP_LABEL_KEY, t } from '../../copy';
import type { Locale, RunActivity } from '../../model/view-types';

import { JumpToLatest } from './JumpToLatest';

const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];
const ACTIVITIES = [
  'routing',
  'build',
  'edit',
  'plan',
  'proposal',
  'answer',
] as const satisfies readonly RunActivity[];

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'JumpToLatest', 'JumpToLatest.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

describe('JumpToLatest', () => {
  it('reads "Latest" when nothing runs, and is named "Jump to the latest"', () => {
    render(<JumpToLatest locale="en" activity={null} visible onJump={vi.fn()} />);
    const pill = screen.getByRole('button', { name: 'Jump to the latest' });
    expect(pill).toHaveTextContent('Latest');
  });

  it('reads «الأحدث» in Arabic, inside its name «الانتقال إلى الأحدث»', () => {
    render(<JumpToLatest locale="ar" activity={null} visible onJump={vi.fn()} />);
    const pill = screen.getByRole('button', { name: 'الانتقال إلى الأحدث' });
    expect(pill).toHaveTextContent('الأحدث');
  });

  it('says why there is news below while a run is live, its word opening its name', () => {
    for (const locale of LOCALES) {
      for (const activity of ACTIVITIES) {
        const { unmount } = render(
          <JumpToLatest locale={locale} activity={activity} visible onJump={vi.fn()} />,
        );
        const word = t(locale, JUMP_LABEL_KEY[activity]);
        const pill = screen.getByRole('button');
        expect(pill, `${locale} ${activity}`).toHaveTextContent(word);
        expect(pill).toHaveAccessibleName(t(locale, 'jump.aria.live', { label: word }));
        expect(pill.getAttribute('aria-label')?.startsWith(word)).toBe(true);
        unmount();
      }
    }
  });

  it('names the live run the way SPEC §3.12 draws it: Building, Editing', () => {
    const { rerender } = render(
      <JumpToLatest locale="en" activity="build" visible onJump={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Building: jump to the latest' })).toBeVisible();
    rerender(<JumpToLatest locale="en" activity="edit" visible onJump={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Editing: jump to the latest' })).toBeVisible();
    rerender(<JumpToLatest locale="ar" activity="build" visible onJump={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'يبني الآن: الانتقال إلى الأحدث' })).toBeVisible();
  });

  it('jumps on a click, Enter and Space', async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    render(<JumpToLatest locale="en" activity="build" visible onJump={onJump} />);
    const pill = screen.getByRole('button', { name: 'Building: jump to the latest' });
    await user.click(pill);
    expect(pill).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onJump).toHaveBeenCalledTimes(3);
  });

  it('when hidden, leaves the accessibility tree and the tab order', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <JumpToLatest locale="en" activity="build" visible={false} onJump={vi.fn()} />
        <button type="button">After</button>
      </>,
    );
    expect(screen.queryByRole('button', { name: /jump to the latest/u })).toBeNull();
    const before = screen.getByRole('button', { name: 'Before' });
    before.focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('hands its button to its owner, which watches for it hiding under focus', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<JumpToLatest ref={ref} locale="en" activity={null} visible onJump={vi.fn()} />);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Jump to the latest' }));
  });

  it('is a plain button with a decorative arrow that never mirrors', () => {
    render(<JumpToLatest locale="ar" activity={null} visible onJump={vi.fn()} />);
    const pill = screen.getByRole('button');
    expect(pill).toHaveAttribute('type', 'button');
    const arrow = pill.querySelector('svg');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-icon', 'arrowDown');
    expect(arrow).not.toHaveAttribute('data-mirror');
  });
});

describe('JumpToLatest.css', () => {
  it('is an e2 pill: Sheet, surface border, floating shadow, radius full, 32px', () => {
    expect(CSS).toMatch(/block-size:\s*var\(--bldr-control-md\)/u);
    expect(CSS).toMatch(/border-radius:\s*var\(--bldr-radius-full\)/u);
    expect(CSS).toMatch(/box-shadow:\s*var\(--bldr-shadow-floating\)/u);
    expect(CSS).toMatch(/background-color:\s*var\(--bldr-surface\)/u);
  });

  it('grows to 44px on a coarse pointer', () => {
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*\.ck-agent-jump\s*\{[^}]*block-size:\s*var\(--bldr-hit-target-min\)/u,
    );
  });

  it('moves over `move` in and `exit` out, and only fades under reduced motion', () => {
    expect(CSS).toMatch(/transition-duration:\s*var\(--bldr-duration-move\)/u);
    expect(CSS).toMatch(/\[hidden\]\s*\{[^}]*transition-duration:\s*var\(--bldr-duration-exit\)/u);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*translate:\s*none/u);
    // Hover changes colour only: never Indigo, never a move.
    expect(CSS).not.toMatch(/:hover[^{]*\{[^}]*(?:translate|accent)/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/translateX\(|\btranslate:(?!\s*(?:0\s|none))/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
