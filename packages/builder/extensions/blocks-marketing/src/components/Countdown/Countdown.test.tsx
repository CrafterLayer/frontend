import { act, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Countdown } from './Countdown';
import { countdownExamples } from './examples';
import { countdownSchema, type CountdownProps } from './schema';

const node: Node = { id: 'countdown', type: 'countdown', props: {} };
const TARGET = '2027-03-01T10:00:00+03:00';
const INSTANT = Date.UTC(2027, 2, 1, 7, 0, 0);

function props(overrides: Record<string, unknown> = {}): CountdownProps {
  return countdownSchema.props.parse({ target: TARGET, ...overrides });
}

function renderLive(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Countdown node={node} props={props(overrides)} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function staticMarkup(value: CountdownProps): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(
    <Countdown node={node} props={value} slots={{}} data={{}} isCanvas={false} />,
  );
  return host;
}

function digits(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    [...container.querySelectorAll('[data-ck-countdown-value]')].map((value) => [
      value.getAttribute('data-ck-countdown-value') ?? '',
      value.textContent,
    ]),
  );
}

function reduceMotion(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  /* Two days, three hours, four minutes and five seconds before the doors open. */
  vi.setSystemTime(INSTANT - (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Countdown — the published page', () => {
  it('renders the date as text and a hidden clock under the countdown-clock behaviour', () => {
    const host = staticMarkup(props({ timezoneLabel: 'Riyadh time' }));
    const section = host.querySelector('section');
    expect(section).toHaveAttribute('data-ck-behavior', 'countdown-clock');
    expect(section).toHaveAttribute('data-ck-target', TARGET);
    expect(section).toHaveAttribute('data-ck-lang', 'en');
    expect(section).toHaveAttribute('data-ck-remaining', 'Time left');
    expect(host.querySelector('[data-ck-countdown-clock]')).toHaveAttribute('hidden');
    expect(host.querySelector('[data-ck-countdown-clock]')).toHaveAttribute('aria-hidden', 'true');
    const when = host.querySelector('[data-ck-countdown-when]');
    expect(when).not.toHaveAttribute('hidden');
    expect(when?.textContent).toMatch(/^Starts Monday,? 1 March 2027 at 10:00 · Riyadh time$/u);
    expect(when?.querySelector('time')).toHaveAttribute('datetime', TARGET);
    /* The ended message waits, hidden, inside a polite status. */
    expect(host.querySelector('[data-ck-countdown-ended]')).toHaveAttribute('role', 'status');
    expect(host.querySelector('[data-ck-countdown-ended] > span')).toHaveAttribute('hidden');
    expect(host.querySelector('[data-ck-countdown-summary]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(host.querySelector('[data-ck-countdown-summary]')?.textContent).toBe('');
    expect(Object.keys(digits(host))).toEqual(['days', 'hours', 'minutes', 'seconds']);
  });

  it('draws no date and no behaviour for a target that does not parse', () => {
    /* The door refuses one; a stale document might still carry one. */
    const host = staticMarkup({ ...props(), target: '2027-02-31T10:00:00+03:00' });
    expect(host.querySelector('section')).not.toHaveAttribute('data-ck-behavior');
    expect(host.querySelector('[data-ck-countdown-when]')).toBeNull();
    expect(host.querySelector('h2')).toHaveTextContent('Doors open soon');
  });

  it('prints the date in Arabic for an Arabic page', () => {
    const host = staticMarkup(props({ dateLanguage: 'ar', startsLabel: 'يبدأ' }));
    expect(host.querySelector('section')).toHaveAttribute('data-ck-lang', 'ar');
    expect(host.querySelector('[data-ck-countdown-when]')?.textContent).toContain('٢٠٢٧');
  });
});

describe('Countdown — live', () => {
  it('counts down every second, with a coarse polite summary', () => {
    const { container } = renderLive();
    expect(container.querySelector('[data-ck-countdown-clock]')).not.toHaveAttribute('hidden');
    expect(container.querySelector('section')).not.toHaveAttribute('data-ck-behavior');
    expect(digits(container)).toEqual({ days: '2', hours: '03', minutes: '04', seconds: '05' });
    expect(container.querySelector('[data-ck-countdown-summary]')).toHaveTextContent(
      'Time left: 2 Days',
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(digits(container)['seconds']).toBe('02');
  });

  it('shows the ended message and hides the clock and date once the moment passes', () => {
    vi.setSystemTime(INSTANT - 2000);
    const { container } = renderLive({ endedMessage: 'We are open!' });
    expect(screen.getByText('We are open!')).not.toBeVisible();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('We are open!')).toBeVisible();
    expect(container.querySelector('[data-ck-countdown-clock]')).toHaveAttribute('hidden');
    expect(container.querySelector('[data-ck-countdown-when]')).toHaveAttribute('hidden');
    expect(container.querySelector('[data-ck-countdown-summary]')?.textContent).toBe('');
  });

  it('drops the seconds and moves once a minute under reduced motion', () => {
    reduceMotion(true);
    const { container } = renderLive();
    expect(Object.keys(digits(container))).toEqual(['days', 'hours', 'minutes']);
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(digits(container)['minutes']).toBe('04');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(digits(container)['minutes']).toBe('03');
  });

  it('holds still on the editing canvas, moving once a minute', () => {
    reduceMotion(false);
    const { container } = renderLive({}, true);
    const before = digits(container);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(digits(container)).toEqual(before);
  });

  it('honours showSeconds, the cards or minimal variant, and the action', () => {
    const { container } = renderLive({
      showSeconds: false,
      variant: 'minimal',
      actionLabel: 'Register',
      actionHref: '/register',
    });
    expect(Object.keys(digits(container))).toEqual(['days', 'hours', 'minutes']);
    expect(container.querySelector('[data-ck-countdown-unit]')).not.toHaveClass('bg-surface');
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    const cards = renderLive().container.querySelector('[data-ck-countdown-unit]');
    expect(cards).toHaveClass('bg-surface', 'rounded-xl');
    /* The digits carry the card's ink: a dark section's slab rules recolour the card, not its children. */
    expect(cards?.querySelector('[data-ck-countdown-value]')).toHaveClass('text-text');
    expect(container.querySelector('[data-ck-countdown-value]')).not.toHaveClass('text-text');
  });

  it('keeps secondary text legible on a dark section and combines the shared controls', () => {
    const { container } = renderLive({
      tone: 'dark',
      body: 'Intro.',
      background: 'accent',
      marginInlineEnd: 4,
    });
    expect(screen.getByText('Intro.')).toHaveClass('opacity-80');
    const section = container.querySelector('section')!;
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('Countdown schema', () => {
  it('defaults to a useful countdown and maps every inspector prop', () => {
    const defaults = countdownSchema.props.parse({});
    expect(defaults).toMatchObject({
      target: TARGET,
      dateLanguage: 'en',
      showSeconds: true,
      align: 'center',
    });
    expect(Object.keys(countdownSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(countdownSchema.props.shape).sort(),
    );
  });

  it('refuses a target without an offset, an impossible date and an unsafe action', () => {
    const parse = (value: unknown) => countdownSchema.props.safeParse(value).success;
    expect(parse({ target: '2027-03-01T10:00:00' })).toBe(false);
    expect(parse({ target: '2027-02-31T10:00:00+03:00' })).toBe(false);
    expect(parse({ target: '2027-03-01T10:00Z' })).toBe(true);
    expect(parse({ actionHref: 'javascript:alert(1)' })).toBe(false);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of countdownExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('countdown');
      expect(countdownSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(countdownExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
