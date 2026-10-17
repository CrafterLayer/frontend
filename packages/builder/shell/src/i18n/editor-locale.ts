/*
  ── The editor chrome's language (arabic-editor) ──────────────────────────────

  The editor UI has a language of its own, separate from the PAGE's language
  (the document's `dir`/`lang` are the page's business). Arabic is first-class:
  the chrome flips to `dir="rtl"`, every label comes from the Arabic catalogue,
  and numbers stay in Latin digits (0–9) — the convention of Arabic software UIs,
  and the digits the page's own CSS values (px, %, ms) are written in.
*/

export type EditorLocale = 'en' | 'ar';

export type EditorDirection = 'ltr' | 'rtl';

export const EDITOR_LOCALES: readonly EditorLocale[] = ['en', 'ar'];

export function isEditorLocale(value: unknown): value is EditorLocale {
  return value === 'en' || value === 'ar';
}

/** The chrome's reading direction for a locale. */
export function editorDirection(locale: EditorLocale): EditorDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * A BCP 47 tag whose `Intl` output uses Latin digits. `ar` alone formats with
 * Arabic-Indic digits (٢٠٢٦); `ar-u-nu-latn` keeps 2026. A tag that already
 * carries a Unicode extension is the caller's explicit choice and is kept.
 */
export function latinDigitsLocale(locale: string): string {
  if (locale.includes('-u-')) return locale;
  return locale.toLowerCase().startsWith('ar') ? `${locale}-u-nu-latn` : locale;
}

/** A number for the chrome, grouped for the locale, always in Latin digits. */
export function formatEditorNumber(value: number, locale: EditorLocale): string {
  return new Intl.NumberFormat(latinDigitsLocale(locale)).format(value);
}

/**
 * The reading direction an element of the CHROME is laid out in: the nearest
 * `dir` attribute above it (the editor root carries the chrome's), else
 * `fallback`. Arrow keys in a tab strip or a tree follow what the person SEES,
 * so a panel inside an RTL editor mirrors its keys even over an LTR page.
 */
export function resolveChromeDir(
  element: Element | null | undefined,
  fallback: EditorDirection = 'ltr',
): EditorDirection {
  const holder = element?.closest('[dir]');
  const value = holder?.getAttribute('dir');
  return value === 'rtl' ? 'rtl' : value === 'ltr' ? 'ltr' : fallback;
}

/** `ArrowLeft`/`ArrowRight` swapped under RTL, so "forward" is always the inline end. */
export function logicalArrowKey(key: string, dir: EditorDirection): string {
  if (dir !== 'rtl') return key;
  if (key === 'ArrowLeft') return 'ArrowRight';
  if (key === 'ArrowRight') return 'ArrowLeft';
  return key;
}
