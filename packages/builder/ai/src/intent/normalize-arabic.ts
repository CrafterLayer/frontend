/**
 * One spelling per word, so a rule written once matches every way it is typed.
 *
 * ## Why this exists
 *
 * The router it replaced matched keywords with `includes` over a lowercased
 * request, and Arabic has no case — it has VARIANTS. The same word arrives as
 * صفحة or صفحه (taa marbuta typed as haa, the commonest keyboard shortcut there
 * is), إلكتروني or الكتروني (hamza written or not), على or علي, stretched with
 * tatweel for emphasis, or voweled by a careful writer. The audit measured the
 * cost (agent-audit §2 P1-5, 2026-09-28): "اعمل صفحة هبوط" reached the build and
 * "اعمل صفحه هبوط" — the same request, one letter apart — did not.
 *
 * Folding is lossy by design and only ever used for MATCHING. Nothing here is
 * written back to a page, shown to a person, or sent to a model: the request
 * a run carries is always the one the person typed.
 */

/*
  Harakat, tanween, shadda, sukun (U+064B–U+065F), the dagger alif (U+0670),
  the Quranic annotation marks (U+0610–U+061A, U+06D6–U+06ED) — none of them
  changes which word it is — and tatweel (U+0640), which only stretches one.
*/
const ARABIC_MARKS =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/gu;
/** أ إ آ ٱ and the hamza-below/above alifs all read as bare alif. */
const ALIF_VARIANTS = /[\u0622\u0623\u0625\u0671\u0672\u0673]/gu;
const TAA_MARBUTA = /\u0629/gu;
const ALIF_MAQSURA = /\u0649/gu;
/** Persian yeh and keheh, which a request pasted from a Persian keyboard carries. */
const PERSIAN_YEH = /\u06CC/gu;
const PERSIAN_KEHEH = /\u06A9/gu;

/**
 * Fold the Arabic letter variants a person types interchangeably.
 *
 * ة→ه, أ/إ/آ/ٱ→ا, ى→ي, ی→ي, ک→ك; diacritics and tatweel dropped. Latin text
 * passes through untouched, so this is safe on a mixed-language request.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(ARABIC_MARKS, '')
    .replace(ALIF_VARIANTS, 'ا')
    .replace(TAA_MARBUTA, 'ه')
    .replace(ALIF_MAQSURA, 'ي')
    .replace(PERSIAN_YEH, 'ي')
    .replace(PERSIAN_KEHEH, 'ك');
}

/** Arabic-Indic (U+0660) and extended Arabic-Indic (U+06F0) digits, read as 0–9. */
function asciiDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/gu, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

const ARABIC_PUNCTUATION: Readonly<Record<string, string>> = {
  '\u061F': '?', // ؟
  '\u060C': ',', // ،
  '\u061B': ';', // ؛
  '\u2019': "'", // ’ — "I’d" and "I'd" are one token
  '\u2018': "'",
};

/**
 * The whole request, folded for matching: presentation forms decomposed
 * (NFKC — a shaping editor pastes ﻣﻮﻗﻊ, not موقع), Arabic variants folded,
 * digits read as ASCII ("من ٤ صفحات" counts four pages), Arabic punctuation
 * read as Latin (so "؟" ends a question), English lowercased, and every run
 * of whitespace — newlines and no-break spaces included — one space.
 */
export function normalizeIntentText(text: string): string {
  const folded = normalizeArabic(text.normalize('NFKC'));
  return asciiDigits(folded)
    .replace(/[\u061F\u060C\u061B\u2019\u2018]/gu, (mark) => ARABIC_PUNCTUATION[mark] ?? mark)
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}
