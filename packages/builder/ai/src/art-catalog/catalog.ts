import { resolveArtImageIn } from './art-spec';
import { buildArtWords } from './art-words';
import { BRAND_ROWS } from './brands.data';
import { DICEBEAR_STYLES } from './characters.data';
import { EMOJI_BY_CATEGORY, EMOJI_TONED } from './emoji.data';
import { brandKey, foldArtText } from './find-art';
import type { ArtRuntime } from './runtime';
import type { ArtCatalog, BrandEntry, EmojiEntry } from './types';
import { isVerifiedArtUrlIn } from './verify-url';

/**
 * The art catalog built from its generated data (art catalog, 2026-10-14).
 * This module is the lazy chunk: only `loadArtCatalog()` imports it, so the
 * ~3,300 brands and ~1,600 illustrations — and the search and resolver that
 * read them — reach a session the first time a plan names art, never on an agent's or the playground's first load.
 */

/**
 * The styles a page may use without a credit line, in the order a plain
 * "cartoon avatar" request offers them: notionists (CC0, line-drawn people)
 * first, then the other CC0 people, then the free-for-commercial-use sets.
 */
const DEFAULT_STYLE_ORDER = [
  'notionists',
  'lorelei',
  'open-peeps',
  'avataaars',
  'notionists-neutral',
  'lorelei-neutral',
  'avataaars-neutral',
  'thumbs',
  'pixel-art',
  'pixel-art-neutral',
  'bottts',
  'bottts-neutral',
];

function brandOf(row: string): BrandEntry {
  const [slug = '', title = '', hex = '', aliases = ''] = row.split('|');
  return { slug, title, hex, aliases: aliases === '' ? [] : aliases.split(';') };
}

function emojiEntries(): EmojiEntry[] {
  return Object.entries(EMOJI_BY_CATEGORY).flatMap(([category, names]) =>
    names.split(' ').map((name) => ({ name, category, tokens: name.split('-') })),
  );
}

export function buildArtCatalog(): ArtCatalog {
  const brands = BRAND_ROWS.map(brandOf);
  const brandByKey = new Map<string, BrandEntry>();
  // A slug wins over a title, a title over an alias, when two brands share a key.
  for (const pick of [
    (brand: BrandEntry) => [brand.slug],
    (brand: BrandEntry) => [brand.title],
    (brand: BrandEntry) => brand.aliases,
  ]) {
    for (const brand of brands) {
      for (const name of pick(brand)) {
        const key = brandKey(name);
        if (key !== '' && !brandByKey.has(key)) brandByKey.set(key, brand);
      }
    }
  }
  const styles = [...DICEBEAR_STYLES];
  const rank = (id: string) => {
    const at = DEFAULT_STYLE_ORDER.indexOf(id);
    return at < 0 ? DEFAULT_STYLE_ORDER.length : at;
  };
  const offeredStyles = styles
    .filter((style) => !style.attribution)
    .sort((left, right) => rank(left.id) - rank(right.id) || left.id.localeCompare(right.id, 'en'));
  const emoji = emojiEntries();
  return {
    brands,
    brandByKey,
    styles,
    offeredStyles,
    emoji,
    emojiByName: new Map(emoji.map((entry) => [entry.name, entry])),
    toned: new Set(EMOJI_TONED.split(' ')),
    words: buildArtWords(foldArtText),
  };
}

/** The resolver the tools call once the catalog has loaded (runtime.ts). */
export function artRuntimeOf(catalog: ArtCatalog): ArtRuntime {
  return {
    resolve: (value, options) => resolveArtImageIn(catalog, value, options),
    verify: (url) => isVerifiedArtUrlIn(catalog, url),
  };
}
