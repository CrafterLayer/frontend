import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { behaviorRuntimeScript, pageBehaviorPacks } from '../script';
import { mountCountdown } from './countdown';

/*
  The markup the Countdown block (blocks-marketing components/Countdown)
  renders for a published page: the date as text, a hidden clock, an empty
  polite summary and a status holding the hidden ended message.
*/
const TARGET = '2027-03-01T10:00:00+03:00';
const INSTANT = Date.UTC(2027, 2, 1, 7, 0, 0);
const UNITS = ['days', 'hours', 'minutes', 'seconds'];

function host(
  attrs = `data-ck-target="${TARGET}" data-ck-lang="en" data-ck-remaining="Time left"`,
): HTMLElement {
  const units = UNITS.map(
    (unit) =>
      `<div data-ck-countdown-unit="${unit}"><span data-ck-countdown-value="${unit}">00</span><span data-ck-countdown-label="${unit}">${unit[0]?.toUpperCase() ?? ''}${unit.slice(1)}</span></div>`,
  ).join('');
  document.body.innerHTML = `<section data-ck-behavior="countdown-clock" ${attrs}>
    <div data-ck-countdown-clock hidden aria-hidden="true">${units}</div>
    <p data-ck-countdown-when>Starts <time datetime="${TARGET}">Monday 1 March 2027 at 10:00</time></p>
    <p data-ck-countdown-summary aria-live="polite" aria-atomic="true"></p>
    <p data-ck-countdown-ended role="status"><span hidden>We are live</span></p>
  </section>`;
  return document.body.firstElementChild as HTMLElement;
}

function digits(el: Element): Record<string, string> {
  return Object.fromEntries(
    UNITS.map((unit) => [
      unit,
      el.querySelector(`[data-ck-countdown-value='${unit}']`)?.textContent ?? '',
    ]),
  );
}

const clockOf = (el: Element) => el.querySelector('[data-ck-countdown-clock]');
const summaryOf = (el: Element) => el.querySelector('[data-ck-countdown-summary]')?.textContent;
const messageOf = (el: Element) => el.querySelector('[data-ck-countdown-ended] > span');

function reduceMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(INSTANT - (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('mountCountdown', () => {
  it('reveals the clock, writes the digits and ticks every second', () => {
    const el = host();
    const dispose = mountCountdown(document);
    expect(clockOf(el)).not.toHaveAttribute('hidden');
    expect(digits(el)).toEqual({ days: '2', hours: '03', minutes: '04', seconds: '05' });
    expect(summaryOf(el)).toBe('Time left: 2 Days');
    vi.advanceTimersByTime(2000);
    expect(digits(el)['seconds']).toBe('03');
    dispose();
  });

  it('ends at zero: hides the clock and the date, shows the message, stops ticking', () => {
    vi.setSystemTime(INSTANT - 1500);
    const el = host();
    const dispose = mountCountdown(document);
    expect(messageOf(el)).toHaveAttribute('hidden');
    vi.advanceTimersByTime(2000);
    expect(messageOf(el)).not.toHaveAttribute('hidden');
    expect(clockOf(el)).toHaveAttribute('hidden');
    expect(el.querySelector('[data-ck-countdown-when]')).toHaveAttribute('hidden');
    expect(summaryOf(el)).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    dispose();
  });

  it('shows the ended state at once for a past target, with no timer', () => {
    vi.setSystemTime(INSTANT + 86_400_000);
    const el = host();
    mountCountdown(document);
    expect(messageOf(el)).not.toHaveAttribute('hidden');
    expect(clockOf(el)).toHaveAttribute('hidden');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves the static view alone for a target that does not parse, or a page without the clock', () => {
    const el = host('data-ck-target="soon"');
    mountCountdown(document);
    expect(clockOf(el)).toHaveAttribute('hidden');
    expect(el.querySelector('[data-ck-countdown-when]')).not.toHaveAttribute('hidden');
    expect(vi.getTimerCount()).toBe(0);
    document.body.innerHTML = `<section data-ck-behavior="countdown-clock" data-ck-target="${TARGET}"></section>`;
    expect(() => {
      mountCountdown(document)();
    }).not.toThrow();
  });

  it('drops the seconds and updates once a minute under reduced motion', () => {
    reduceMotion(true);
    const el = host();
    mountCountdown(document);
    expect(el.querySelector("[data-ck-countdown-unit='seconds']")).toHaveAttribute('hidden');
    vi.advanceTimersByTime(59_000);
    expect(digits(el)['minutes']).toBe('04');
    vi.advanceTimersByTime(1000);
    expect(digits(el)['minutes']).toBe('03');
  });

  it('writes once and never ticks on the editing canvas', () => {
    const el = host();
    mountCountdown(document, { interactive: false });
    expect(digits(el)['seconds']).toBe('05');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('prints Arabic-Indic digits and the summary words from the page', () => {
    const el = host(
      `data-ck-target="${TARGET}" data-ck-lang="ar" data-ck-remaining="الوقت المتبقي"`,
    );
    mountCountdown(el);
    expect(digits(el)['hours']).toBe('٠٣');
    expect(summaryOf(el)).toBe('الوقت المتبقي: ٢ Days');
  });

  it('summarises with the largest unit only: hours, then minutes in fives', () => {
    vi.setSystemTime(INSTANT - (3 * 3600 + 120) * 1000);
    const hours = host();
    const dispose = mountCountdown(document);
    expect(summaryOf(hours)).toBe('Time left: 3 Hours');
    dispose();
    vi.setSystemTime(INSTANT - (41 * 60 + 2) * 1000);
    const minutes = host('data-ck-target="2027-03-01T10:00:00+03:00"');
    mountCountdown(document);
    expect(summaryOf(minutes)).toBe('45 Minutes');
  });

  it('is idempotent and its disposer restores the static view', () => {
    const el = host();
    const dispose = mountCountdown(document);
    const again = mountCountdown(document);
    expect(vi.getTimerCount()).toBe(1);
    again();
    dispose();
    expect(clockOf(el)).toHaveAttribute('hidden');
    expect(digits(el)).toEqual({ days: '00', hours: '00', minutes: '00', seconds: '00' });
    expect(summaryOf(el)).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    dispose();
    /* Disposed, it can mount again. */
    mountCountdown(document);
    expect(clockOf(el)).not.toHaveAttribute('hidden');
  });

  it('does nothing without a window', () => {
    const detached = document.implementation.createHTMLDocument('x');
    Object.defineProperty(detached, 'defaultView', { value: null });
    expect(() => {
      mountCountdown(detached)();
    }).not.toThrow();
  });

  it('ships only to a page that carries the marker, within 2.5 kB gzip', () => {
    expect(pageBehaviorPacks('<section data-ck-behavior="countdown-clock"></section>')).toContain(
      mountCountdown,
    );
    /* The core runtime's own text clock is not this pack's marker. */
    expect(
      pageBehaviorPacks('<p data-ck-behavior="countdown" data-ck-until="x"></p>'),
    ).not.toContain(mountCountdown);
    expect(behaviorRuntimeScript(['<p>x</p>'])).not.toContain('function mountCountdown');
    expect(gzipSync(mountCountdown.toString()).length).toBeLessThanOrEqual(2560);
  });
});
