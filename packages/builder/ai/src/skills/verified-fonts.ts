/**
 * The web fonts a skill may name, with the weights each one actually has.
 *
 * ## Why weights are part of the fact
 *
 * Measured 2026-09-28: `fonts.googleapis.com/css2?family=Lalezar:wght@700`
 * answers HTTP 400 — Lalezar has one weight — and because the families of a
 * page share one css2 request, a single wrong weight drops EVERY face in the
 * `@import`, silently. So a face is named with the weights it has, and the
 * direction deck's import lines are built from this table, never guessed.
 *
 * ## Why this list and not "any Google font"
 *
 * Every recorded skeleton (9 of 9) used Cairo for its headings, because the
 * skills named four Arabic faces and nothing else. The pages all looked the
 * same. Each family here was fetched from both allowed hosts — 200 text/css
 * with Arabic unicode ranges for the Arabic ones — and rendered in Chromium
 * (page-power research, 2026-09-28; the specimen showed two rules that live in
 * the deck: no tashkeel in Changa, Lemonada or Reem Kufi headings, and body
 * text in Markazi Text, Beiruti or Amiri one step up). The import URLs the
 * deck prescribes were re-fetched on the same date.
 */

export interface VerifiedFontFamily {
  /** Weights the family ships; a css2 request for any other answers 400. */
  readonly weights: readonly number[];
  readonly arabic: boolean;
}

export const FONTS_VERIFIED_AT = '2026-09-28';

export const VERIFIED_FONT_FAMILIES: Readonly<Record<string, VerifiedFontFamily>> = {
  // Arabic (every one also carries Latin glyphs).
  Alexandria: { arabic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  Almarai: { arabic: true, weights: [300, 400, 700, 800] },
  Amiri: { arabic: true, weights: [400, 700] },
  'Aref Ruqaa': { arabic: true, weights: [400, 700] },
  'Baloo Bhaijaan 2': { arabic: true, weights: [400, 500, 600, 700, 800] },
  Beiruti: { arabic: true, weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  Cairo: { arabic: true, weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  Changa: { arabic: true, weights: [200, 300, 400, 500, 600, 700, 800] },
  'El Messiri': { arabic: true, weights: [400, 500, 600, 700] },
  Fustat: { arabic: true, weights: [200, 300, 400, 500, 600, 700, 800] },
  'IBM Plex Sans Arabic': { arabic: true, weights: [100, 200, 300, 400, 500, 600, 700] },
  Lalezar: { arabic: true, weights: [400] },
  Lemonada: { arabic: true, weights: [300, 400, 500, 600, 700] },
  'Markazi Text': { arabic: true, weights: [400, 500, 600, 700] },
  'Noto Kufi Arabic': { arabic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  'Noto Naskh Arabic': { arabic: true, weights: [400, 500, 600, 700] },
  'Noto Sans Arabic': { arabic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  'Readex Pro': { arabic: true, weights: [200, 300, 400, 500, 600, 700] },
  'Reem Kufi': { arabic: true, weights: [400, 500, 600, 700] },
  Rubik: { arabic: true, weights: [300, 400, 500, 600, 700, 800, 900] },
  Tajawal: { arabic: true, weights: [200, 300, 400, 500, 700, 800, 900] },
  Vazirmatn: { arabic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  // Latin, for English pages only.
  Archivo: { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  'Archivo Black': { arabic: false, weights: [400] },
  Barlow: { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  'Big Shoulders Display': {
    arabic: false,
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
  'Bricolage Grotesque': { arabic: false, weights: [200, 300, 400, 500, 600, 700, 800] },
  'Cormorant Garamond': { arabic: false, weights: [300, 400, 500, 600, 700] },
  'DM Sans': { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  'DM Serif Display': { arabic: false, weights: [400] },
  Figtree: { arabic: false, weights: [300, 400, 500, 600, 700, 800, 900] },
  Fraunces: { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  Geist: { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  Gloock: { arabic: false, weights: [400] },
  'IBM Plex Sans': { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700] },
  'Instrument Sans': { arabic: false, weights: [400, 500, 600, 700] },
  Manrope: { arabic: false, weights: [200, 300, 400, 500, 600, 700, 800] },
  'Nunito Sans': { arabic: false, weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  Outfit: { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  Sora: { arabic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  'Space Grotesk': { arabic: false, weights: [300, 400, 500, 600, 700] },
  Syne: { arabic: false, weights: [400, 500, 600, 700, 800] },
  'Young Serif': { arabic: false, weights: [400] },
};

/**
 * Two measured rendering rules (Chromium specimen, 2026-09-28): these display
 * faces open a gap or misjoin around a shadda + damma, so their headings carry
 * no tashkeel; and these faces render visibly small at the same px, so their
 * body text goes one `text-*` step up.
 */
export const NO_TASHKEEL_FACES: readonly string[] = ['Changa', 'Lemonada', 'Reem Kufi'];
export const ONE_STEP_UP_FACES: readonly string[] = ['Amiri', 'Beiruti', 'Markazi Text'];
