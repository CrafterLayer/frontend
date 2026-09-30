import { collapseSpace, normalizeArabic, primaryLang } from './text';

/*
  Non-descriptive link text. The English list is Lighthouse's `link-text`
  audit blocklist (GoogleChrome/lighthouse, core/audits/seo/link-text.js,
  Apache-2.0 — attribution recorded in vendor docs). Lighthouse ships no
  Arabic list; the Arabic entries are CraftKit's own.
*/

export const VAGUE_LINK_TEXT = {
  en: [
    'click here',
    'click this',
    'go',
    'here',
    'information',
    'learn more',
    'more',
    'more info',
    'more information',
    'right here',
    'read more',
    'see more',
    'start',
    'this',
  ],
  ar: ['اضغط هنا', 'هنا', 'المزيد', 'اقرأ المزيد', 'التفاصيل', 'اعرف أكثر', 'رابط'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type VagueLinkTextLang = keyof typeof VAGUE_LINK_TEXT;

/** Lower-cased, Arabic-normalised, punctuation and arrows stripped, spaces collapsed. */
export function normalizeLinkText(text: string): string {
  return collapseSpace(
    normalizeArabic(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' '),
  );
}

const NORMALISED: Readonly<Record<VagueLinkTextLang, ReadonlySet<string>>> = {
  en: new Set(VAGUE_LINK_TEXT.en.map(normalizeLinkText)),
  ar: new Set(VAGUE_LINK_TEXT.ar.map(normalizeLinkText)),
};

/**
 * True when a link's text says nothing about its target ("read more",
 * «اقرأ المزيد»). Checks the page language's list; for a language with no
 * list (or none given), checks every list.
 */
export function isVagueLinkText(text: string, lang?: string): boolean {
  const normalised = normalizeLinkText(text);
  if (normalised === '') return false;
  const primary = primaryLang(lang);
  if (primary === 'en' || primary === 'ar') return NORMALISED[primary].has(normalised);
  return NORMALISED.en.has(normalised) || NORMALISED.ar.has(normalised);
}
