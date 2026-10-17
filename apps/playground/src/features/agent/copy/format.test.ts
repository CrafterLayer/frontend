/**
 * The Intl formatters (SPEC §4.0 "Punctuation and direction", §4.17 RunClock, §4.18
 * HistoryRow). Arabic formats as `ar-JO-u-nu-latn`: Levantine month names and Latin
 * digits. Plain `ar` gives «سبتمبر» and plain `ar-JO` Arabic-Indic digits (SPEC A.2),
 * so both are asserted against, not just the happy path.
 *
 * Dates are built with the local-time constructor so the calendar-day rules hold in any
 * time zone the suite runs in.
 */
import { describe, expect, it } from 'vitest';

import {
  formatClock,
  formatDate,
  formatList,
  formatNumber,
  formatRelativeTime,
  formatWhen,
  localeTag,
  pluralCategory,
  stopShortcut,
} from './format';

const NON_LATIN_DIGIT = /[٠-٩۰-۹]/u;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** 28 Sep 2026, 12:00 local: the SPEC's own date, so its frames read true. */
const NOW = new Date(2026, 8, 28, 12, 0).getTime();
const at = (day: number, hour = 12, minute = 0): number =>
  new Date(2026, 8, day, hour, minute).getTime();

describe('localeTag', () => {
  it('pins Arabic to Jordanian Arabic with Latin digits', () => {
    expect(localeTag('ar')).toBe('ar-JO-u-nu-latn');
    expect(localeTag('en')).toBe('en-u-nu-latn');
  });
});

describe('pluralCategory', () => {
  it('returns all six Arabic categories, including 103 back to few (SPEC §4.0)', () => {
    const table: readonly (readonly [number, string])[] = [
      [0, 'zero'],
      [1, 'one'],
      [2, 'two'],
      [3, 'few'],
      [10, 'few'],
      [11, 'many'],
      [99, 'many'],
      [100, 'other'],
      [102, 'other'],
      [103, 'few'],
    ];
    for (const [n, category] of table) expect(pluralCategory('ar', n), String(n)).toBe(category);
  });

  it('returns only one and other in English', () => {
    expect([0, 1, 2, 103].map((n) => pluralCategory('en', n))).toEqual([
      'other',
      'one',
      'other',
      'other',
    ]);
  });
});

describe('formatClock (m:ss, the RunBar clock)', () => {
  it('reads m:ss with no leading zero on the minutes', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(999)).toBe('0:00');
    expect(formatClock(4_000)).toBe('0:04');
    expect(formatClock(72_000)).toBe('1:12');
    expect(formatClock(141_000)).toBe('2:21');
  });

  it('keeps counting minutes past the hour instead of wrapping', () => {
    expect(formatClock(3_723_000)).toBe('62:03');
  });

  it('never shows a negative or non-finite time', () => {
    expect(formatClock(-5_000)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('formatNumber', () => {
  it('uses Latin digits in Arabic, grouped', () => {
    expect(formatNumber('ar', 8)).toBe('8');
    expect(formatNumber('ar', 1234)).toBe('1,234');
    expect(formatNumber('en', 1234)).toBe('1,234');
  });

  it('keeps at most two decimals (contrast ratios)', () => {
    expect(formatNumber('ar', 4.567)).toBe('4.57');
    expect(formatNumber('en', 21)).toBe('21');
  });
});

describe('formatRelativeTime', () => {
  it('puts the genitive after «قبل»: «قبل دقيقتين»', () => {
    expect(formatRelativeTime('ar', NOW - 2 * MINUTE, NOW)).toBe('قبل دقيقتين');
    expect(formatRelativeTime('en', NOW - 2 * MINUTE, NOW)).toBe('2 minutes ago');
  });

  it('counts minutes, then hours within today, then calendar days', () => {
    expect(formatRelativeTime('ar', NOW - 11 * MINUTE, NOW)).toBe('قبل 11 دقيقة');
    expect(formatRelativeTime('ar', NOW - 5 * HOUR, NOW)).toBe('قبل 5 ساعات');
    expect(formatRelativeTime('en', NOW - 5 * HOUR, NOW)).toBe('5 hours ago');
    expect(formatRelativeTime('ar', at(27, 9), NOW)).toBe('أمس');
    expect(formatRelativeTime('en', at(25, 18), NOW)).toBe('3 days ago');
  });

  it('calls last night yesterday, not a count of hours', () => {
    expect(formatRelativeTime('ar', at(27, 20), NOW)).toBe('أمس');
    expect(formatRelativeTime('en', at(27, 23, 50), at(28, 0, 30))).toBe('40 minutes ago');
    expect(formatRelativeTime('en', at(27, 23), at(28, 1))).toBe('yesterday');
  });

  it('says "now" under a minute and for a clock that ran ahead', () => {
    expect(formatRelativeTime('ar', NOW - 30_000, NOW)).toBe('الآن');
    expect(formatRelativeTime('en', NOW + 5 * MINUTE, NOW)).toBe('now');
  });
});

describe('formatDate', () => {
  it('writes «21 أيلول» and "21 Sep" (SPEC §4.0, §3.13)', () => {
    expect(formatDate('ar', at(21), NOW)).toBe('21 أيلول');
    expect(formatDate('en', at(21), NOW)).toBe('21 Sep');
  });

  it('uses the Levantine month names, every month, never «سبتمبر»', () => {
    const months = Array.from({ length: 12 }, (_, month) =>
      formatDate('ar', new Date(2026, month, 9).getTime(), NOW),
    );
    expect(months).toEqual([
      '9 كانون الثاني',
      '9 شباط',
      '9 آذار',
      '9 نيسان',
      '9 أيار',
      '9 حزيران',
      '9 تموز',
      '9 آب',
      '9 أيلول',
      '9 تشرين الأول',
      '9 تشرين الثاني',
      '9 كانون الأول',
    ]);
  });

  it('adds the year only when it is not this year', () => {
    const lastYear = new Date(2025, 8, 21).getTime();
    expect(formatDate('ar', lastYear, NOW)).toBe('21 أيلول 2025');
    expect(formatDate('en', lastYear, NOW)).toBe('21 Sep 2025');
  });
});

describe('formatWhen (HistoryRow time, SPEC §3.13, §4.18)', () => {
  it('is relative within six days and a date after that', () => {
    const table: readonly (readonly [number, string, string])[] = [
      [NOW - 10_000, 'الآن', 'Now'],
      [NOW - 2 * MINUTE, 'قبل دقيقتين', '2 minutes ago'],
      [at(27, 20), 'أمس', 'Yesterday'],
      [at(25, 12), 'قبل 3 أيام', '3 days ago'],
      [at(22, 12), 'قبل 6 أيام', '6 days ago'],
      [at(21, 12), '21 أيلول', '21 Sep'],
      [at(9, 12), '9 أيلول', '9 Sep'],
    ];
    for (const [when, arabic, english] of table) {
      expect(formatWhen('ar', when, NOW)).toBe(arabic);
      expect(formatWhen('en', when, NOW)).toBe(english);
    }
  });
});

describe('formatList', () => {
  it('joins with the locale conjunction', () => {
    expect(formatList('en', ['Background', 'Text', 'Accent'])).toBe('Background, Text, and Accent');
    expect(formatList('ar', ['الخلفية', 'النص'])).toBe('الخلفية والنص');
  });
});

describe('stopShortcut (SPEC §4.17 stop.tooltip)', () => {
  it('names ⌘. on macOS and Ctrl+. elsewhere', () => {
    expect(stopShortcut(true)).toBe('⌘.');
    expect(stopShortcut(false)).toBe('Ctrl+.');
  });
});

describe('no Arabic-Indic digits', () => {
  it('in any Arabic output of any formatter', () => {
    const outputs = [
      formatNumber('ar', 1_234_567.89),
      formatRelativeTime('ar', NOW - 47 * MINUTE, NOW),
      formatRelativeTime('ar', NOW - 23 * HOUR, NOW),
      formatWhen('ar', at(24), NOW),
      formatDate('ar', new Date(2024, 11, 31).getTime(), NOW),
      ...Array.from({ length: 31 }, (_, day) => formatDate('ar', at(day + 1), NOW)),
    ];
    for (const text of outputs) expect(text).not.toMatch(NON_LATIN_DIGIT);
  });
});
