import { normalizeArabic } from './text';

/*
  URL slugs in the audience's language (Google: "simple descriptive words in
  the audience's language, UTF-8 for non-ASCII"). An Arabic page keeps an
  Arabic slug; the wire form is percent-encoded by `encodeRoute`.
*/

export const SEO_SLUG_MAX = 60;
export const SEO_SLUG_FALLBACK = 'page';

function lowerCase(text: string, lang: string | undefined): string {
  try {
    return text.toLocaleLowerCase(lang !== undefined && lang !== '' ? lang : undefined);
  } catch {
    return text.toLowerCase();
  }
}

/**
 * A hyphenated slug of letters and digits: Arabic kept and normalised (alef,
 * yeh, kaf and ta-marbuta variants; harakat and tatweel stripped), Latin
 * lower-cased with accents dropped, at most 60 characters, never empty.
 */
export function seoSlug(text: string, lang?: string): string {
  const folded = normalizeArabic(text)
    // Latin accents only: a blanket NFD would also split hamza off waw and yeh.
    .replace(/\p{Script=Latin}\p{M}*/gu, (match) => match.normalize('NFD').replace(/\p{M}/gu, ''))
    .replace(/[ßẞ]/gu, 'ss');
  const hyphenated = lowerCase(folded, lang)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-{2,}/gu, '-')
    .replace(/^-|-$/gu, '');
  let slug = hyphenated;
  // Code points (Array.from), so an Arabic letter is never cut in half.
  if (Array.from(slug).length > SEO_SLUG_MAX) {
    const chars = Array.from(slug).slice(0, SEO_SLUG_MAX).join('');
    const lastHyphen = chars.lastIndexOf('-');
    slug = (lastHyphen >= SEO_SLUG_MAX / 2 ? chars.slice(0, lastHyphen) : chars).replace(/-+$/u, '');
  }
  return slug === '' ? SEO_SLUG_FALLBACK : slug;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Percent-encodes each path segment as UTF-8 (`/مقهى` → `/%D9%85%D9%82…`).
 * Already-encoded segments are decoded first, so encoding is idempotent.
 * Slashes, a leading `/` and a trailing `/` are kept.
 */
export function encodeRoute(path: string): string {
  const [pathname = '', ...rest] = path.split(/(?=[?#])/u);
  const encoded = pathname
    .split('/')
    .map((segment) => (segment === '' ? '' : encodeURIComponent(decodeSegment(segment))))
    .join('/');
  return encoded + rest.join('');
}
