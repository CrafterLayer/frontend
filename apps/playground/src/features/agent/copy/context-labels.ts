/**
 * The context meter's and the focused scope chip's words (2026-10-12), in both languages.
 * Kept beside the catalog rather than in it, like `toolbar-labels.ts`: the catalog files
 * are at their size limit. Numbers keep Latin digits in both languages (SPEC A.2).
 */
import type { Locale } from '../model/view-types';

import { formatList, formatNumber } from './format';

export interface ContextLabels {
  /** The meter's accessible name. */
  readonly meter: string;
  /** The meter's spoken value: the estimate against the budget, in whole tokens. */
  readonly meterValue: (used: string, max: string) => string;
  /** Under the pointer: what the figure is. */
  readonly meterHint: string;
  /** Added past 80% of the budget. */
  readonly meterNear: string;
  /** Added when older messages were left out, or cut short, so the request would fit. */
  readonly trimmed: string;
  /** The focused chip's words before the section names. */
  readonly focusedPrefix: string;
  /** After the names, when the rest of the page was sent as an outline. */
  readonly outlineSuffix: string;
}

const EN: ContextLabels = {
  meter: 'Context',
  meterValue: (used, max) => `About ${used} of ${max} tokens`,
  meterHint: 'Estimated size of the latest request against its limit',
  meterNear: 'Close to the limit: older messages go first',
  trimmed: 'Older messages were shortened or left out to fit',
  focusedPrefix: 'Focused: ',
  outlineSuffix: ' (+ outline)',
};

const AR: ContextLabels = {
  meter: 'السياق',
  meterValue: (used, max) => `نحو ${used} من ${max} توكن`,
  meterHint: 'الحجم التقديري لآخر طلب مقارنة بحدّه',
  meterNear: 'قريب من الحد: تُحذف الرسائل الأقدم أولًا',
  trimmed: 'اختُصرت رسائل أقدم أو حُذفت ليتسع الطلب',
  focusedPrefix: 'التركيز على: ',
  outlineSuffix: ' (+ مخطط الباقي)',
};

export function contextLabels(locale: Locale): ContextLabels {
  return locale === 'ar' ? AR : EN;
}

/**
 * A token count as the meter shows it, the same in both languages: `850`, `1.2k`, `12k`.
 * Rounded to the nearest shown digit; the spoken value carries the exact count.
 */
export function compactTokens(tokens: number): string {
  const whole = Math.max(0, Math.round(tokens));
  if (whole < 1_000) return String(whole);
  if (whole < 10_000) {
    const tenths = Math.round(whole / 100) / 10;
    return `${Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)}k`;
  }
  return `${String(Math.round(whole / 1_000))}k`;
}

/** The meter's spoken value, with grouped Latin digits: «نحو 12,345 من 64,000 توكن». */
export function meterValueText(locale: Locale, used: number, max: number): string {
  return contextLabels(locale).meterValue(formatNumber(locale, used), formatNumber(locale, max));
}

/** The sections a focused chip names, joined the way the locale joins a list. */
export function focusNames(locale: Locale, names: readonly string[]): string {
  return formatList(locale, names);
}
