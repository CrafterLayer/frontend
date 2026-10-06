import { safeHref } from '@craftkit/builder-renderer';

/**
 * Whether a typed address may become an image source: http(s), a relative
 * path, or an inline `data:image/…` picture (what a library entry can be).
 * `mailto:`/`tel:` pass `safeHref` but are not pictures.
 */
export function isAcceptableImageSrc(src: string): boolean {
  if (src === '') return true;
  if (/^data:image\//iu.test(src)) return !/\s/u.test(src.slice(0, 64));
  if (/^(?:mailto|tel):/iu.test(src)) return false;
  return safeHref(src) !== undefined;
}
