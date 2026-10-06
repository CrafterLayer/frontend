import type { HistoryEntry } from '@craftkit/builder-core';

import type { HistoryListLabels } from './HistoryList.labels';

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** "now", "2 minutes ago", "قبل ساعة" — the largest whole unit, rounded toward zero. */
export function relativeTime(at: number, now: number, locale: string): string {
  const seconds = Math.round((at - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(seconds) < 10) return format.format(0, 'second');
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return format.format(0, 'second');
}

/** A grouped step already says what it did; a single command gets its friendly name. */
export function entryLabel(entry: HistoryEntry, labels: HistoryListLabels): string {
  const known = labels.commands[entry.label];
  if (known !== undefined) return known;
  if (/^[a-z][A-Za-z]*$/u.test(entry.label)) {
    const words = entry.label.replace(/([a-z])([A-Z])/gu, '$1 $2').toLowerCase();
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  }
  return entry.label;
}
