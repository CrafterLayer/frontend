import { isRtlLang } from './text';

/**
 * The direction a page in a language set reads in (2026-10-12).
 *
 * A site keeps ONE direction (`validateSite` refuses a page that turns alone), but a site in
 * Arabic and English holds pages of both. A page whose root names its language versions
 * (`seo.alternates`) and its own `lang` therefore reads in that language's direction, set on
 * the page itself (`<main dir>` on the canvas, `<html dir>` on export), while the site keeps
 * its own. Any other page follows the document: `undefined`.
 */
export function languageSetDirection(
  rootProps: Readonly<Record<string, unknown>> | undefined,
): 'ltr' | 'rtl' | undefined {
  const lang = rootProps?.['lang'];
  if (typeof lang !== 'string' || lang.trim() === '') return undefined;
  if (!hasLanguageVersions(rootProps?.['seo'])) return undefined;
  return isRtlLang(lang) ? 'rtl' : 'ltr';
}

/** Whether a page root's `seo` value names language versions (`alternates`). */
export function hasLanguageVersions(seo: unknown): boolean {
  if (typeof seo !== 'object' || seo === null) return false;
  const alternates = (seo as { readonly alternates?: unknown }).alternates;
  return Array.isArray(alternates) && alternates.length > 0;
}
