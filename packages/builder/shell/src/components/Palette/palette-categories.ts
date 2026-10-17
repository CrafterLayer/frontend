import type { PaletteCategory } from './Palette.labels';

/**
 * Which Library group a block's tile sits in, from its type alone. Moved out of
 * `Palette.tsx` (2026-10-12) so the vocabulary can grow without growing the
 * component. The groups are checked in order: content-first types, then
 * Marketing, Layout and Content; anything else is Primary.
 */

/** `bento-grid` / `BentoGrid` → `bentogrid`. */
export function normalizedBlockType(type: string): string {
  return type.replace(/[^a-zA-Z0-9]/g, '').toLocaleLowerCase();
}

export function categoryForBlock(type: string): PaletteCategory {
  const key = normalizedBlockType(type);

  /*
    Content a person writes, checked first: `menuSection` would otherwise be
    claimed by the Layout group's `section`. (2026-10-12: the local-business
    blocks — a timeline, a menu or price list, a location. 2026-10-13: a pull
    quote, a jobs list and a list of downloads.)
  */
  if (
    key.includes('timeline') ||
    key.includes('menusection') ||
    key === 'location' ||
    key === 'pullquote' ||
    key === 'jobslist' ||
    key === 'downloadlist'
  ) {
    return 'Content';
  }

  if (
    key.includes('hero') ||
    key.includes('feature') ||
    key.includes('pricing') ||
    key.includes('testimonial') ||
    key.includes('cta') ||
    key.includes('faq') ||
    key.includes('navigation') ||
    key.includes('navbar') ||
    key.includes('footer') ||
    key.includes('banner') ||
    key.includes('announcement') ||
    key.includes('logo') ||
    key.includes('stats') ||
    key.includes('bento') ||
    key.includes('contentsection') ||
    key.includes('process') ||
    key.includes('newsletter') ||
    key.includes('team') ||
    key.includes('blog') ||
    key.includes('contact') ||
    key.includes('comparison') ||
    key.includes('carousel') ||
    key.includes('gallery') ||
    key.includes('videosection') ||
    key.includes('formsection') ||
    key.includes('portfolio') ||
    key.includes('productgrid') ||
    /* A launch countdown is a promotional band, beside the promo banner and the CTA. */
    key.includes('countdown') ||
    /* 2026-10-13: proof (ratings, a customer story, a before/after) and conversion. */
    key === 'reviewsummary' ||
    key === 'casestudy' ||
    key === 'beforeafter' ||
    key === 'appdownload' ||
    key === 'fundraiser'
  ) {
    return 'Marketing';
  }
  if (
    key.includes('page') ||
    key.includes('section') ||
    key.includes('container') ||
    key.includes('column') ||
    key.includes('grid') ||
    key.includes('row') ||
    key.includes('stack') ||
    key.includes('spacer') ||
    key.includes('divider')
  ) {
    return 'Layout';
  }
  if (
    key.includes('richtext') ||
    key.includes('text') ||
    key.includes('heading') ||
    key.includes('paragraph') ||
    key.includes('image') ||
    key.includes('media') ||
    key.includes('video') ||
    key.includes('embed') ||
    key.includes('table') ||
    key.includes('chart') ||
    /* A report is one dataset as cards, a chart and a table: data a person writes. */
    key === 'report' ||
    key.includes('form') ||
    /*
      A row of links is CONTENT — it is words a person writes. The marketing
      group above claims `navbar` and `navigation` first, and it is checked
      first, so a site's masthead nav stays where it was.
    */
    key.includes('link') ||
    key.includes('nav')
  ) {
    return 'Content';
  }
  return 'Primary';
}
