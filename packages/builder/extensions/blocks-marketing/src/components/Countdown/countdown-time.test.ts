import { describe, expect, it } from 'vitest';

import {
  formatUnit,
  formatWall,
  isValidTarget,
  parseTarget,
  remainingUntil,
  summaryOf,
} from './countdown-time';

const LABELS = { remaining: 'Time left', days: 'Days', hours: 'Hours', minutes: 'Minutes' };

describe('the countdown target', () => {
  it('reads the instant from the written time and its offset', () => {
    const riyadh = parseTarget('2027-03-01T10:00:00+03:00');
    expect(riyadh?.instant).toBe(Date.UTC(2027, 2, 1, 7, 0, 0));
    /* The wall time stays as written, whatever the offset. */
    expect(riyadh?.wall).toBe(Date.UTC(2027, 2, 1, 10, 0, 0));
    expect(parseTarget('2027-03-01T10:00Z')?.instant).toBe(Date.UTC(2027, 2, 1, 10, 0));
    expect(parseTarget('2027-03-01T10:00:30-05:30')?.instant).toBe(
      Date.UTC(2027, 2, 1, 15, 30, 30),
    );
    expect(parseTarget('  2027-03-01T10:00:00+00:00  ')).toBeDefined();
  });

  it.each([
    ['', 'empty'],
    ['2027-03-01', 'a date without a time'],
    ['2027-03-01T10:00:00', 'no offset'],
    ['2027-02-31T10:00:00+03:00', 'a day that does not exist'],
    ['2027-13-01T10:00:00Z', 'month 13'],
    ['2027-03-01T24:00:00Z', 'hour 24'],
    ['2027-03-01T10:60:00Z', 'minute 60'],
    ['2027-03-01T10:00:61Z', 'second 61'],
    ['2027-03-01T10:00:00+15:00', 'an offset past 14 hours'],
    ['2027-03-01T10:00:00+03:61', 'an offset minute past 59'],
    ['next tuesday', 'words'],
  ])('refuses %j (%s)', (value) => {
    expect(parseTarget(value)).toBeUndefined();
    expect(isValidTarget(value)).toBe(false);
  });
});

describe('what is left', () => {
  const at = Date.UTC(2027, 0, 1);

  it('splits the time left into whole units', () => {
    const left = remainingUntil(at, at - ((2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000 + 999));
    expect(left).toEqual({ ended: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it('ends at zero and never counts below it', () => {
    expect(remainingUntil(at, at).ended).toBe(true);
    expect(remainingUntil(at, at + 5000)).toEqual({
      ended: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
    expect(remainingUntil(at, at - 500).ended).toBe(true);
  });
});

describe('printing', () => {
  const wall = Date.UTC(2027, 2, 1, 10, 0);

  it('prints the wall time in English and Arabic, independent of the machine', () => {
    /* ICU versions differ on the comma after the weekday. */
    expect(formatWall(wall, 'en')).toMatch(/^Monday,? 1 March 2027 at 10:00$/u);
    const arabic = formatWall(wall, 'ar');
    expect(arabic).toContain('مارس');
    expect(arabic).toContain('٢٠٢٧');
    expect(arabic).toContain('١٠:٠٠');
  });

  it('pads hours, minutes and seconds, in Arabic-Indic digits for Arabic', () => {
    expect(formatUnit(5, 'en', true)).toBe('05');
    expect(formatUnit(5, 'en', false)).toBe('5');
    expect(formatUnit(123, 'en', false)).toBe('123');
    expect(formatUnit(7, 'ar', true)).toBe('٠٧');
  });

  it('summarises with the largest unit only, minutes in fives', () => {
    const base = { ended: false, days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(summaryOf({ ...base, days: 12, hours: 4 }, LABELS, 'en')).toBe('Time left: 12 Days');
    expect(summaryOf({ ...base, hours: 3, minutes: 59 }, LABELS, 'en')).toBe('Time left: 3 Hours');
    expect(summaryOf({ ...base, minutes: 41, seconds: 2 }, LABELS, 'en')).toBe(
      'Time left: 45 Minutes',
    );
    expect(summaryOf({ ...base, minutes: 40 }, LABELS, 'en')).toBe('Time left: 40 Minutes');
    expect(summaryOf({ ...base, seconds: 9 }, LABELS, 'en')).toBe('Time left: 5 Minutes');
    expect(summaryOf({ ...base, ended: true }, LABELS, 'en')).toBe('');
    expect(
      summaryOf({ ...base, days: 3 }, { ...LABELS, remaining: 'الوقت المتبقي', days: 'يوم' }, 'ar'),
    ).toBe('الوقت المتبقي: ٣ يوم');
  });
});
