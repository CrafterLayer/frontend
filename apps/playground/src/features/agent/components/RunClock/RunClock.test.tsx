/**
 * RunClock (SPEC §4.17 RunBar, §4.3): a run's one clock, `m:ss`.
 * - never announced: `aria-hidden`, and not a live region (SPEC §4.3 "The clock and the
 *   estimate are never announced");
 * - Latin digits in an LTR island in both locales (`1:24` stays intact in Arabic);
 * - live, it steps with the panel's shared ticker; finished, it is frozen and costs nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, isInaccessible, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TickerPausedContext } from '../../hooks/use-ticker';

import { RunClock } from './RunClock';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'RunClock', 'RunClock.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** 12:00:00.000 local. */
const NOON = new Date(2026, 8, 28, 12, 0, 0, 0).getTime();

function clockOf(container: HTMLElement): HTMLElement {
  const clock = container.querySelector<HTMLElement>('.ck-agent-clock');
  if (clock === null) throw new Error('no clock rendered');
  return clock;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOON);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RunClock', () => {
  it('is an LTR island that assistive technology never reads', () => {
    const { container } = render(
      <p lang="ar" dir="rtl">
        <RunClock startedAt={NOON - 84_000} />
      </p>,
    );
    const clock = clockOf(container);
    expect(clock.tagName).toBe('BDI');
    expect(clock).toHaveAttribute('dir', 'ltr');
    expect(clock).toHaveAttribute('aria-hidden', 'true');
    expect(isInaccessible(clock)).toBe(true);
    expect(clock).not.toHaveAttribute('aria-live');
    expect(clock).not.toHaveAttribute('role');
    expect(clock).toHaveTextContent('1:24');
  });

  it('counts up once a second while the run is live', () => {
    const { container } = render(<RunClock startedAt={NOON - 4_000} />);
    expect(clockOf(container)).toHaveTextContent('0:04');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(clockOf(container)).toHaveTextContent('0:05');
    act(() => {
      vi.advanceTimersByTime(55_000);
    });
    expect(clockOf(container)).toHaveTextContent('1:00');
  });

  it('holds the final time once the run has ended, and runs no timer', () => {
    const { container } = render(<RunClock startedAt={NOON - 200_000} endedAt={NOON - 59_000} />);
    expect(clockOf(container)).toHaveTextContent('2:21');
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(clockOf(container)).toHaveTextContent('2:21');
  });

  it('stops ticking the moment it is given an end', () => {
    const { container, rerender } = render(<RunClock startedAt={NOON - 10_000} />);
    expect(vi.getTimerCount()).toBe(1);
    rerender(<RunClock startedAt={NOON - 10_000} endedAt={NOON + 2_500} />);
    expect(vi.getTimerCount()).toBe(0);
    expect(clockOf(container)).toHaveTextContent('0:12');
  });

  it('stops while its panel is hidden, and shows the real time when the panel returns', () => {
    const tree = (hidden: boolean) => (
      <TickerPausedContext value={hidden}>
        <RunClock startedAt={NOON - 4_000} />
      </TickerPausedContext>
    );
    const { container, rerender } = render(tree(false));
    expect(vi.getTimerCount()).toBe(1);

    rerender(tree(true));
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    rerender(tree(false));
    expect(clockOf(container)).toHaveTextContent('0:34');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('reads 0:00 for a start a skewed clock places in the future', () => {
    const { container } = render(<RunClock startedAt={NOON + 5_000} />);
    expect(clockOf(container)).toHaveTextContent('0:00');
  });

  it('sets figures in a fixed tabular slot, in Slate', () => {
    const rule = /\.ck-agent-clock\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(rule).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(rule).toMatch(/min-inline-size:\s*4\.5ch/);
    expect(rule).toMatch(/font-size:\s*var\(--bldr-font-size-figure\)/);
    expect(rule).toMatch(/line-height:\s*var\(--bldr-line-height-figure\)/);
    expect(rule).toMatch(/color:\s*var\(--bldr-panel-muted\)/);
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/,
    );
  });
});
