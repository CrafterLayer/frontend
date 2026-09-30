/*
  Text helpers shared by the SEO core. Pure string work: no DOM, no Intl
  segmenter, no URL global (this package compiles against ES2024 only).
*/

/** Arabic harakat, Quranic marks and the superscript alef. Zero-width in rendering. */
export const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/gu;
/** Tatweel (kashida): a stretch glyph, never part of a word. */
export const TATWEEL = /ـ/gu;

const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const CJK_LETTER =
  /[ᄀ-ᇿ⺀-⿟　-ヿ㄰-㆏㐀-䶿一-鿿가-힯豈-﫿＀-｠]/u;

export function isArabicChar(char: string): boolean {
  return ARABIC_LETTER.test(char);
}

export function isCjkChar(char: string): boolean {
  return CJK_LETTER.test(char);
}

/** Collapse runs of whitespace and trim. */
export function collapseSpace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * Letter-level Arabic normalisation for comparison and slugs: presentation
 * forms folded (NFKC), harakat and tatweel stripped, alef variants to bare
 * alef, Persian yeh/kaf to their Arabic letters, the Urdu ta marbuta to `ة`.
 * Alef maqsura (`ى`) and hamza on waw/ya are kept: they spell different words.
 */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(ARABIC_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/[آأإٱٲٳ]/gu, 'ا')
    .replace(/[یي]/gu, 'ي')
    .replace(/ک/gu, 'ك')
    .replace(/ۃ/gu, 'ة');
}

const RTL_LANGS = new Set(['ar', 'fa', 'he', 'iw', 'ur', 'ps', 'ckb', 'sd', 'ug', 'yi', 'dv']);

/** The primary subtag of a BCP-47 tag, lower-cased (`ar-JO` → `ar`). */
export function primaryLang(lang: string | undefined): string {
  return (lang ?? '').trim().split(/[-_]/u)[0]?.toLowerCase() ?? '';
}

export function isRtlLang(lang: string | undefined): boolean {
  return RTL_LANGS.has(primaryLang(lang));
}

const BCP47 = /^(?:[a-zA-Z]{2,3}|[a-zA-Z]{5,8})(?:-[a-zA-Z0-9]{1,8})*$/u;

export function isLangTag(value: string): boolean {
  return BCP47.test(value);
}

/**
 * An absolute https URL with a host and no credentials. A regex rather than
 * `new URL`, which this layer cannot see.
 */
export function isHttpsUrl(value: string): boolean {
  return /^https:\/\/[^\s/?#@\\]+(?:[/?#]\S*)?$/u.test(value);
}

/** Escapes text for an HTML text node or a double- or single-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

/** Escapes text for XML (sitemap). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}
