/** The candidate widths a responsive catalog image offers. */
const WIDTHS = [640, 1024, 1600] as const;

/**
 * A responsive `srcset` for a CDN address sized by its `w=` query (the photo
 * catalog's Unsplash/Pexels addresses), else undefined — shared by the kit
 * instantiator and the `image.set` tool so both emit the same candidates.
 */
export function srcsetFor(url: string): string | undefined {
  if (!/[?&]w=\d+/u.test(url)) return undefined;
  return WIDTHS.map((width) => `${url.replace(/([?&])w=\d+/u, `$1w=${String(width)}`)} ${String(width)}w`).join(', ');
}

/** `sizes` for a full-bleed hero image vs. an image in a column or card. */
export const HERO_IMAGE_SIZES = '100vw';
export const COLUMN_IMAGE_SIZES = '(min-width:1024px) 50vw, 100vw';
