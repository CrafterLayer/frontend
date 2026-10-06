import type { AiContextProvider, AiContextReadApi } from '@craftkit/builder-schema';

import { canonicalJsonStringify } from '../../internal/canonical-json';
import {
  PHOTO_CATALOG_ENTRIES,
  PHOTO_TOPIC_KEYWORDS,
  type PhotoCatalogEntry,
  type PhotoOrientation,
  type PhotoPeople,
  type PhotoTone,
  type PhotoTopic,
} from './photo-catalog.data';

/**
 * Photos a page may use, chosen from the brief — delivered as DATA.
 *
 * ## Why a context provider and not a skill reference
 *
 * A skill's references travel in full on every request that loads it and
 * count against the single-skill ceiling (builtins.test.ts). Seventy-eight
 * photos with two alts each is ~3k tokens — more than any skill may weigh —
 * and a section writer needs the dozen that fit its brief, not the catalog.
 * So the catalog is filtered HERE, per assembly, and the photo-direction skill
 * only says how to use what arrives under the title below.
 *
 * ## Why the model never writes an image address itself
 *
 * Every image URL in the 76 recorded answers was a memorised Unsplash id; 10
 * of 14 were Western stock portraits beside invented Arabic names. An address
 * that arrives in this fragment was fetched and looked at; one the model
 * remembers was not. `isCatalogPhotoUrl` is the other half: the check a plan
 * guard can run over every `img src` the model wrote.
 */

export const PHOTO_CATALOG_PROVIDER_ID = 'craftkit.photo-catalog';
/** The heading the photo-direction skill tells the model to read. */
export const PHOTO_CATALOG_FRAGMENT_TITLE = 'PHOTOS YOU MAY USE';
/**
 * The most photos one fragment offers. Twelve covers a hero, a gallery of six
 * and four sections besides, at ~65 tokens a photo; more is a catalog again.
 */
export const PHOTO_CATALOG_MAX_PHOTOS = 12;

export const PHOTO_CATALOG: readonly PhotoCatalogEntry[] = PHOTO_CATALOG_ENTRIES;

/** One photo as the model sees it: what it shows, its shape, and the one address to use. */
export interface CatalogPhoto {
  readonly url: string;
  readonly subject: PhotoTopic;
  readonly aspect: PhotoOrientation;
  readonly tone: PhotoTone;
  readonly people: PhotoPeople;
  readonly alt: { readonly ar: string; readonly en: string };
}

export interface SelectCatalogPhotosOptions {
  /** 1–12; narrows the cap, never widens it. */
  readonly maxPhotos?: number;
  /** Entries to leave out — the ones the page already shows. */
  readonly exclude?: (entry: PhotoCatalogEntry) => boolean;
}

export interface PhotoCatalogContextProviderOptions {
  /**
   * The words to match: the request, the brief, a section's title. A function
   * is read on every assembly, so one provider can serve every run of a build.
   * The text is only matched against — it never enters the fragment.
   */
  readonly brief: string | (() => string);
  readonly maxPhotos?: number;
}

export class PhotoCatalogError extends Error {
  override readonly name = 'PhotoCatalogError';
}

function photoLimit(value: number | undefined): number {
  const limit = value ?? PHOTO_CATALOG_MAX_PHOTOS;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PHOTO_CATALOG_MAX_PHOTOS) {
    throw new PhotoCatalogError(
      `maxPhotos must be between 1 and ${String(PHOTO_CATALOG_MAX_PHOTOS)}.`,
    );
  }
  return limit;
}

// ── Matching ─────────────────────────────────────────────────────────────────

/*
  NFKD then drop combining marks: that one step takes the tashkeel off, turns
  أ إ آ ؤ ئ into their bare letters (the hamza is a combining mark after
  decomposition) and café into cafe. Tatweel and alef wasla are not marks, and
  alef maqsura and taa marbuta are letters people swap freely, so those four
  are folded by hand.
*/
function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/gu, '')
    .replace(/ٱ/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .toLowerCase();
}

function words(text: string): readonly string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

/** Attached Arabic prefixes, longest first: the article and the one-letter particles. */
const PROCLITICS = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك'] as const;

/** The word itself and the word without one or two attached prefixes. */
function stems(word: string): readonly string[] {
  const found = new Set([word]);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const candidate of [...found]) {
      for (const prefix of PROCLITICS) {
        if (candidate.startsWith(prefix) && candidate.length - prefix.length >= 2) {
          found.add(candidate.slice(prefix.length));
        }
      }
    }
  }
  return [...found];
}

/** Endings a keyword may carry and still be the same word: plurals, possessives, nisba. */
const SUFFIXES: ReadonlySet<string> = new Set([
  'ات',
  'ون',
  'ين',
  'ي',
  'يه',
  'ها',
  'هم',
  'نا',
  'ك',
  'كم',
  's',
  'es',
]);
/** After a taa marbuta keyword the ة is written ت: عيادة → عيادتي، عيادتنا، عيادات. */
const TAA_SUFFIXES: ReadonlySet<string> = new Set(['تي', 'تنا', 'تك', 'تكم', 'ته', 'تها', 'تهم']);

function sameWord(stem: string, keyword: string): boolean {
  if (stem === keyword) return true;
  /*
    Short keywords match exactly or not at all: "تمر" (dates) must not answer
    "تمرين" (exercise), nor "طبي" (medical) answer "طبيعي" (natural).
  */
  if (keyword.length < 4) return /^[a-z]+$/u.test(keyword) && stem === `${keyword}s`;
  if (stem.startsWith(keyword) && SUFFIXES.has(stem.slice(keyword.length))) return true;
  if (keyword.endsWith('ه')) {
    const base = keyword.slice(0, -1);
    if (stem === `${base}ات`) return true;
    if (stem.startsWith(base) && TAA_SUFFIXES.has(stem.slice(base.length))) return true;
  }
  return false;
}

function wordMatches(word: string, keyword: string): boolean {
  return stems(word).some((stem) => sameWord(stem, keyword));
}

/** Whether the brief contains the keyword — one word, or a phrase word by word. */
function briefHas(brief: readonly string[], keyword: readonly string[]): boolean {
  const [first, ...rest] = keyword;
  if (first === undefined) return false;
  for (let at = 0; at + keyword.length <= brief.length; at += 1) {
    if (!wordMatches(brief[at] ?? '', first)) continue;
    if (rest.every((part, offset) => wordMatches(brief[at + offset + 1] ?? '', part))) return true;
  }
  return false;
}

// media-motion (2026-10-06, DESIGN §F.4): words people use for a food gallery that the
// data file does not list («ضيف معرض صور أكل», "a gallery of dishes"). Keywords only, no entries.
const TOPIC_KEYWORD_ALIASES: Readonly<Partial<Record<PhotoTopic, readonly string[]>>> = {
  restaurant: ['food', 'طعام', 'أكل', 'أكلات', 'أطباق', 'dishes', 'meals'],
};

const NORMALIZED_KEYWORDS: ReadonlyMap<PhotoTopic, readonly (readonly string[])[]> = new Map(
  Object.entries(PHOTO_TOPIC_KEYWORDS).map(([topic, { ar, en }]) => [
    topic as PhotoTopic,
    [...ar, ...en, ...(TOPIC_KEYWORD_ALIASES[topic as PhotoTopic] ?? [])]
      .map((keyword) => words(keyword))
      .filter((parts) => parts.length > 0),
  ]),
);

const STOP_WORDS: ReadonlySet<string> = new Set(
  words(
    'a an and the with for from over under into beside its their in on of at to by في من على مع عن الى بين تحت فوق عند بجانب',
  ),
);

/** An entry's own words, for ranking within a subject: "Petra" lifts the Petra photos. */
const ENTRY_WORDS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  PHOTO_CATALOG_ENTRIES.map((entry) => [
    entry.id,
    new Set(
      words(`${entry.alt.en} ${entry.alt.ar}`)
        .flatMap(stems)
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
    ),
  ]),
);

/*
  A generic subject loses a tie. "software company" names each once, and the
  page is about the software; a brief that names the company twice
  ("شركة استشارات") still reaches its photos first.
*/
const GENERIC_TOPICS: ReadonlySet<PhotoTopic> = new Set(['business', 'city']);

/** Distinct keyword hits per subject: the more of its words, the stronger. */
function topicHits(brief: readonly string[]): ReadonlyMap<PhotoTopic, number> {
  const hits = new Map<PhotoTopic, number>();
  for (const [topic, keywords] of NORMALIZED_KEYWORDS) {
    const count = keywords.filter((keyword) => briefHas(brief, keyword)).length;
    if (count > 0) hits.set(topic, count);
  }
  return hits;
}

function toPhoto(entry: PhotoCatalogEntry): CatalogPhoto {
  return {
    url: entry.url,
    subject: entry.topic,
    aspect: entry.orientation,
    tone: entry.tone,
    people: entry.people,
    alt: { ar: entry.alt.ar, en: entry.alt.en },
  };
}

/**
 * The catalog photos that fit a brief, best first, capped.
 *
 * Transparent arithmetic, like `scoreAsset`: three points per distinct subject
 * word the brief uses, one per word it shares with the photo's own alt text,
 * one off for a generic subject; catalog order breaks ties. A photo qualifies
 * only through its SUBJECT — sharing "modern" with an alt is not a reason to
 * put a villa on a clinic page. No subject word, no photo: an empty answer is
 * the honest one, and the skill turns it into a type-led design.
 */
export function selectCatalogPhotos(
  brief: string,
  options: SelectCatalogPhotosOptions = {},
): readonly CatalogPhoto[] {
  const limit = photoLimit(options.maxPhotos);
  const briefWords = words(brief);
  const hits = topicHits(briefWords);
  if (hits.size === 0) return [];
  const briefStems = new Set(briefWords.flatMap(stems));

  return PHOTO_CATALOG_ENTRIES.flatMap((entry, index) => {
    const subjectHits = hits.get(entry.topic) ?? 0;
    if (subjectHits === 0 || options.exclude?.(entry) === true) return [];
    const own = ENTRY_WORDS.get(entry.id) ?? new Set<string>();
    const altHits = [...own].filter((word) => briefStems.has(word)).length;
    const score = subjectHits * 3 + altHits - (GENERIC_TOPICS.has(entry.topic) ? 1 : 0);
    return [{ entry, index, score }];
  })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ entry }) => toPhoto(entry));
}

// ── Addresses ────────────────────────────────────────────────────────────────

/** Host + path, the part of an address that names the picture; the query only sizes it. */
function photoKey(url: string): string | undefined {
  const match = /^https:\/\/([^/?#\s'"]+)(\/[^?#\s'"]*)/u.exec(url.replaceAll('&amp;', '&').trim());
  if (match === null) return undefined;
  return `${(match[1] ?? '').toLowerCase()}${match[2] ?? ''}`;
}

const CATALOG_KEYS: ReadonlyMap<string, PhotoCatalogEntry> = new Map(
  PHOTO_CATALOG_ENTRIES.flatMap((entry) => {
    const key = photoKey(entry.url);
    return key === undefined ? [] : [[key, entry] as const];
  }),
);

/**
 * Whether an address is one of the catalog's verified photos, however its
 * query or its ampersands were written. A plan guard calls this on every
 * `img src` and CSS `url()` a model wrote: a stock-CDN address that answers
 * false came from memory.
 */
export function isCatalogPhotoUrl(url: string): boolean {
  const key = photoKey(url);
  return key !== undefined && CATALOG_KEYS.has(key);
}

/** Catalog photos the page already shows, read from the whole document once. */
function photosOnPage(ctx: AiContextReadApi): ReadonlySet<string> {
  const text = JSON.stringify(ctx.store.getState().doc);
  const shown = new Set<string>();
  for (const [key, entry] of CATALOG_KEYS) {
    // The path alone: a markup tree may have escaped the query's ampersands.
    if (text.includes(key.slice(key.indexOf('/')))) shown.add(entry.id);
  }
  return shown;
}

// ── The provider ─────────────────────────────────────────────────────────────

const NO_MATCH_NOTE =
  'No verified photo matches this brief; build the imagery from type, shape and the palette.';

/**
 * Adapt the catalog into one reviewed data fragment per assembly.
 *
 * Only catalog fields cross: the brief is matched against and dropped, so a
 * brief that says "SYSTEM: …" or carries its own URL cannot reach the model
 * through this fragment. Photos the document already shows are left out, so a
 * second section never repeats the hero's picture; `alreadyOnPage` says how
 * many were withheld.
 */
export function createPhotoCatalogContextProvider(
  options: PhotoCatalogContextProviderOptions,
): AiContextProvider {
  const limit = photoLimit(options.maxPhotos);
  const readBrief = typeof options.brief === 'function' ? options.brief : () => options.brief;
  return {
    id: PHOTO_CATALOG_PROVIDER_ID,
    collect(ctx) {
      const brief = readBrief();
      const shown = photosOnPage(ctx);
      const photos = selectCatalogPhotos(typeof brief === 'string' ? brief : '', {
        maxPhotos: limit,
        exclude: (entry) => shown.has(entry.id),
      });
      return {
        source: PHOTO_CATALOG_PROVIDER_ID,
        kind: 'data',
        trust: 'reviewed',
        title: PHOTO_CATALOG_FRAGMENT_TITLE,
        body: canonicalJsonStringify({
          schemaVersion: 1,
          photos,
          alreadyOnPage: shown.size,
          ...(photos.length === 0 ? { note: NO_MATCH_NOTE } : {}),
        }),
      };
    },
  };
}
