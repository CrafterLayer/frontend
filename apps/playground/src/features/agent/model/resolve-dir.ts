/**
 * The direction of a piece of text, decided by the script most of its letters are in.
 *
 * Adapted from Streamdown's `detectTextDirection` (vercel/streamdown @ 0b6b20d,
 * `packages/streamdown/lib/detect-direction.ts`, Copyright 2023 Vercel, Inc., Apache-2.0).
 * This file is a MODIFIED version of that work: the verbatim original is
 * `vendor/streamdown-detect-direction/detect-direction.upstream.ts`, and the changes are
 * listed in `vendor/VENDOR.md`. Licence text: `vendor/THIRD_PARTY_LICENSES.md`.
 *
 * Why not `dir="auto"`: it looks at the FIRST strong character only, so «Hero قسم الخدمات»
 * (four Latin letters, then ten Arabic ones) lays out left to right. People writing to
 * أبو غضب mix scripts constantly: block names, brand names and CSS words are Latin inside
 * Arabic sentences. The majority of letters is the honest answer (SPEC §4.5, §6.6).
 *
 * Two changes from upstream, both about what counts as a vote:
 * 1. Only letters vote. Upstream counts every code point in U+0590–U+08FF as a strong RTL
 *    character, which includes Arabic-Indic digits (٣), Arabic punctuation (؟ ،) and
 *    harakat (U+064E fatha, U+0652 sukun). A page count typed in Arabic digits is a number,
 *    not Arabic, and a vocalised word must not outvote the same number of Latin letters.
 * 2. No letters means the UI direction, not "ltr". A message of «5/8» or «١٢٣» sits in
 *    an Arabic panel; nothing in it asks to be laid out left to right.
 */
import type { Locale } from './view-types';

export type TextDirection = 'ltr' | 'rtl';

/**
 * Unicode ranges for RTL "strong" characters: Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan,
 * Mandaic, Arabic Supplement/Extended, and RTL presentation forms. The ranges and their
 * `\u` spelling are upstream's, verbatim; the `u` flag is added to match LETTER_PATTERN and
 * changes nothing here, because every range is inside the Basic Multilingual Plane.
 */
const RTL_PATTERN = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;

const LETTER_PATTERN = /\p{L}/u;

/**
 * Best-effort markdown stripping (upstream, verbatim). Fenced and inline code are dropped
 * because code always renders ltr and must not sway the prose around it; link URLs are
 * dropped and their text kept. Harmless for a person's plain request, and it matters for
 * model answers, which are markdown.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/(```|~~~)[\s\S]*?\1/g, '') // fenced code
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/(\*{1,3}|_{1,3})/g, '') // bold/italic
    .replace(/`[^`]*`/g, '') // inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links (keep text)
    .replace(/^[\s>*\-+\d.]+/gm, ''); // list markers, blockquotes
}

/**
 * `rtl` when most letters are in a right-to-left script, `ltr` when most are not; a tie
 * goes to the first letter, and text with no letters at all takes `uiDir`.
 *
 * Pair it with `unicode-bidi: plaintext` on each line, so a line that runs the other way
 * inside a multi-line message still orders itself correctly.
 */
export function resolveDir(text: string, uiDir: TextDirection): TextDirection {
  let firstStrong: TextDirection | undefined;
  let ltrCount = 0;
  let rtlCount = 0;

  for (const char of stripMarkdown(text)) {
    if (!LETTER_PATTERN.test(char)) continue;
    if (RTL_PATTERN.test(char)) {
      firstStrong ??= 'rtl';
      rtlCount += 1;
    } else {
      // Latin, CJK, Cyrillic, etc.: any letter that is not RTL is LTR.
      firstStrong ??= 'ltr';
      ltrCount += 1;
    }
  }

  if (rtlCount > ltrCount) return 'rtl';
  if (ltrCount > rtlCount) return 'ltr';
  return firstStrong ?? uiDir;
}

/**
 * The `lang` for the same text (SPEC §4.5, §6.2: screen readers switch voice on `lang`).
 * The panel speaks two languages, so right-to-left letters are read as Arabic and every
 * other script as English; a Hebrew message would get an Arabic voice, which is the one
 * known miss and the price of not guessing languages from letters.
 */
export function resolveLang(text: string, uiLocale: Locale): Locale {
  const uiDir: TextDirection = uiLocale === 'ar' ? 'rtl' : 'ltr';
  return resolveDir(text, uiDir) === 'rtl' ? 'ar' : 'en';
}
