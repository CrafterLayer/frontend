import type { DiceBearStyleEntry } from './characters.data';

/**
 * The art catalog's shapes (art catalog, 2026-10-14). Types only, so the
 * modules every agent run loads never pull the data in: the data arrives
 * with `loadArtCatalog()` (load.ts) the first time a plan names art.
 */

export type ArtKind = 'logo' | 'character' | 'illustration';

/** One brand the Simple Icons index holds; the mark is its owner's trademark. */
export interface BrandEntry {
  readonly slug: string;
  readonly title: string;
  /** The brand colour, six upper-case hex digits. */
  readonly hex: string;
  readonly aliases: readonly string[];
}

/** One Fluent Emoji Flat name, with the words a search matches. */
export interface EmojiEntry {
  readonly name: string;
  readonly category: string;
  readonly tokens: readonly string[];
}

export type { DiceBearStyleEntry };

/** Search words: what a person says → the catalog's own words (built in words.ts). */
export interface ArtWords {
  /** Words that name the kind of art itself: «شعار» → logo, "avatar" → character. */
  readonly kinds: ReadonlyMap<string, ArtKind>;
  /** A word or phrase → the Fluent Emoji names it means, best first. */
  readonly illustrations: ReadonlyMap<string, readonly string[]>;
  /** A word → the DiceBear styles it means, best first. */
  readonly characters: ReadonlyMap<string, readonly string[]>;
  /** An emoji name → its Arabic label, for alt text on an Arabic page. */
  readonly arabicLabels: ReadonlyMap<string, string>;
}

export interface ArtCatalog {
  readonly brands: readonly BrandEntry[];
  /** `brandKey(slug | title | alias)` → the brand. */
  readonly brandByKey: ReadonlyMap<string, BrandEntry>;
  /** Every character style whose artwork licence allows commercial use. */
  readonly styles: readonly DiceBearStyleEntry[];
  /** The styles a page may use without a credit line, default first. */
  readonly offeredStyles: readonly DiceBearStyleEntry[];
  readonly emoji: readonly EmojiEntry[];
  readonly emojiByName: ReadonlyMap<string, EmojiEntry>;
  /** Names that come in skin tones: `<name>-light` … `<name>-dark`. */
  readonly toned: ReadonlySet<string>;
  readonly words: ArtWords;
}

/** A resolved picture: a verified https address, its alt in the page language, its intrinsic size. */
export interface ArtImage {
  readonly kind: ArtKind;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}
