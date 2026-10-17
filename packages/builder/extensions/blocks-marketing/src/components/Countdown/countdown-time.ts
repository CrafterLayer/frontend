/**
 * Countdown time, React-free: the target as written (an ISO 8601 date-time
 * with its UTC offset), the instant it names, what is left until it, and how
 * the event's own wall-clock time reads in English or Arabic.
 *
 * The printed date never depends on the machine that renders it: the wall
 * time is the one WRITTEN in the target ("10:00 at +03:00" prints 10:00 on a
 * server in London and a phone in Tokyo), formatted in UTC from its parts.
 * Nothing here throws: an impossible target is `undefined`, and every caller
 * keeps the page whole without it.
 */

/** `2027-03-01T10:00` with optional seconds, then `Z` or `±HH:MM`. */
export const TARGET_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|([+-])(\d{2}):(\d{2}))$/u;

export interface CountdownTarget {
  /** Milliseconds since the epoch: the moment the countdown reaches zero. */
  readonly instant: number;
  /** The wall-clock time as written, as a UTC timestamp (for formatting only). */
  readonly wall: number;
}

/** The target, or `undefined` when it is malformed or names a day that does not exist. */
export function parseTarget(iso: string): CountdownTarget | undefined {
  const match = TARGET_PATTERN.exec(iso.trim());
  if (match === null) return undefined;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  const h = Number(match[4]);
  const mi = Number(match[5]);
  /* The seconds group is optional: absent, it is undefined at run time. */
  const s = Number(match[6] ?? '0');
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59) return undefined;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(wall);
  /* 31 February rolls over to March: refuse it instead of counting to the wrong day. */
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return undefined;
  }
  let offset = 0;
  if (match[7] !== 'Z') {
    const hours = Number(match[9]);
    const minutes = Number(match[10]);
    if (hours > 14 || minutes > 59) return undefined;
    offset = (match[8] === '-' ? -1 : 1) * (hours * 60 + minutes);
  }
  return { instant: wall - offset * 60_000, wall };
}

/** Whether a string is a target the countdown can use. */
export function isValidTarget(iso: string): boolean {
  return parseTarget(iso) !== undefined;
}

export interface Remaining {
  readonly ended: boolean;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

/** What is left from `now` to `instant`, in whole units; `ended` at or past zero. */
export function remainingUntil(instant: number, now: number): Remaining {
  const left = Math.max(0, Math.floor((instant - now) / 1000));
  return {
    ended: left === 0,
    days: Math.floor(left / 86_400),
    hours: Math.floor((left % 86_400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  };
}

export type CountdownLanguage = 'en' | 'ar';

/* Arabic prints Arabic-Indic digits, as the carousel and compare packs do on an Arabic page. */
function localeOf(language: CountdownLanguage): string {
  return language === 'ar' ? 'ar-u-nu-arab' : 'en-GB';
}

/** The event's wall-clock date and time: "Monday 1 March 2027 at 10:00", «الاثنين، ١ مارس ٢٠٢٧ في ١٠:٠٠». */
export function formatWall(wall: number, language: CountdownLanguage): string {
  try {
    return new Intl.DateTimeFormat(localeOf(language), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(new Date(wall));
  } catch {
    return new Date(wall).toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** A unit's digits in the page's numerals, padded to two places for hours, minutes and seconds. */
export function formatUnit(value: number, language: CountdownLanguage, pad: boolean): string {
  try {
    return new Intl.NumberFormat(localeOf(language), {
      minimumIntegerDigits: pad ? 2 : 1,
      useGrouping: false,
    }).format(value);
  } catch {
    return pad ? String(value).padStart(2, '0') : String(value);
  }
}

export interface SummaryLabels {
  readonly remaining: string;
  readonly days: string;
  readonly hours: string;
  readonly minutes: string;
}

/**
 * The polite summary a screen reader hears: only the largest unit, coarse on
 * purpose — days, then hours, then minutes in steps of five — so it changes
 * once a day, once an hour, or every five minutes, never every second.
 */
export function summaryOf(
  left: Remaining,
  labels: SummaryLabels,
  language: CountdownLanguage,
): string {
  if (left.ended) return '';
  if (left.days > 0)
    return `${labels.remaining}: ${formatUnit(left.days, language, false)} ${labels.days}`;
  if (left.hours > 0)
    return `${labels.remaining}: ${formatUnit(left.hours, language, false)} ${labels.hours}`;
  const minutes = Math.max(5, Math.ceil((left.minutes + (left.seconds > 0 ? 1 : 0)) / 5) * 5);
  return `${labels.remaining}: ${formatUnit(minutes, language, false)} ${labels.minutes}`;
}
