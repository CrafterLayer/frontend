/**
 * The words of a site build (T230, 2026-10-12), in both languages: the site's line while
 * its pages are planned and built, the line it ends on, and how a page's record names its
 * page. Kept beside the catalog rather than in it, like `jobs-labels.ts`: the catalog files
 * are at their size limit and these strings belong to one flow. Page names are the site's
 * own words, joined the way each language joins a list; Arabic page counts agree with
 * their number (`arabicCount`), and digits stay Latin in both languages.
 */
import { AR_PAGES, arabicCount } from '../../preview/arabic-count';
import type { Locale } from '../model/view-types';

import { formatList } from './format';

export interface SiteLabels {
  /** The site's line while its pages are being planned. */
  readonly planning: string;
  /** The site's line once planned: which pages are being built. */
  readonly building: (titles: readonly string[]) => string;
  /** The line a site build ends on: which of its pages were built. */
  readonly built: (built: readonly string[], total: number) => string;
  /** Between a page's name and its record's state, in the record's head ("About: Page built"). */
  readonly pageSeparator: string;
  /** The history entry that links a built site's pages from each page's menus (T230b). */
  readonly linked: string;
}

const EN: SiteLabels = {
  planning: "Planning the site's pages…",
  building: (titles) =>
    `Building a ${String(titles.length)}-page site: ${formatList('en', titles)}.`,
  built: (built, total) =>
    built.length === total
      ? `Built all ${String(total)} pages: ${formatList('en', built)}.`
      : `Built ${String(built.length)} of ${String(total)} pages: ${formatList('en', built)}.`,
  pageSeparator: ': ',
  linked: "Assistant: link the site's pages",
};

const AR: SiteLabels = {
  planning: 'أخطط صفحات الموقع…',
  building: (titles) =>
    `صفحات الموقع: ${formatList('ar', titles)}. تُبنى ${arabicCount(titles.length, AR_PAGES)} معًا.`,
  built: (built, total) =>
    built.length === total
      ? `بُنيت صفحات الموقع كلها: ${formatList('ar', built)}.`
      : `بُنيت ${arabicCount(built.length, AR_PAGES)} من ${String(total)}: ${formatList('ar', built)}.`,
  pageSeparator: ': ',
  linked: 'المساعد: ربط صفحات الموقع',
};

export function siteLabels(locale: Locale): SiteLabels {
  return locale === 'ar' ? AR : EN;
}
