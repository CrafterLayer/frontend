import type { ArtCatalog, ArtKind, BrandEntry, DiceBearStyleEntry } from './types';

/**
 * findArt — a deterministic search over the art catalog (art catalog,
 * 2026-10-14): brand titles, slugs and aliases; Fluent Emoji names and
 * categories; DiceBear styles. English and Arabic words for common needs
 * («طبيب», «قهوة», «سيارة», "doctor") reach the catalog's own words through
 * art-words.ts. Same query, same answer, in the same order — no model, no
 * network, no randomness.
 */

export interface ArtMatch {
  readonly kind: ArtKind;
  /** A brand's slug, a style id or an emoji name: what an art spec names. */
  readonly id: string;
  readonly title: string;
  readonly score: number;
}

const MAX_MATCHES = 10;
/** A brand is named exactly: a partial match is a suggestion, never a logo on the page. */
export const EXACT = 100;

/** Lower case, no diacritics or tashkeel, Arabic letter forms unified, words split on anything else. */
export function foldArtText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟـ]/gu, '')
    .toLowerCase()
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Simple Icons' slug rule (+ → plus, . → dot, & → and, letters and digits only), any script. */
export function brandKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replaceAll('+', 'plus')
    .replaceAll('.', 'dot')
    .replaceAll('&', 'and')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** "Al-Rajhi Bank" also as "alrajhibank" and without an Arabic «ال»: the keys a brand answers to. */
function queryKeys(query: string): readonly string[] {
  const key = brandKey(query);
  const bare = brandKey(query.replace(/^\s*(?:the|ال)\s*/iu, ''));
  return [...new Set([key, bare])].filter((entry) => entry !== '');
}

function byScore(left: ArtMatch, right: ArtMatch): number {
  return (
    right.score - left.score ||
    left.title.length - right.title.length ||
    left.id.localeCompare(right.id, 'en')
  );
}

function brandMatch(brand: BrandEntry, score: number): ArtMatch {
  return { kind: 'logo', id: brand.slug, title: brand.title, score };
}

function findBrands(query: string, catalog: ArtCatalog): ArtMatch[] {
  const keys = queryKeys(query);
  const exact = keys.map((key) => catalog.brandByKey.get(key)).find((brand) => brand !== undefined);
  if (exact !== undefined) return [brandMatch(exact, EXACT)];
  const [key] = keys;
  if (key === undefined || key.length < 3) return [];
  const matches: ArtMatch[] = [];
  for (const brand of catalog.brands) {
    const names = [brand.slug, brandKey(brand.title), ...brand.aliases.map(brandKey)];
    if (names.some((name) => name.startsWith(key))) matches.push(brandMatch(brand, 60));
    else if (names.some((name) => name.includes(key))) matches.push(brandMatch(brand, 30));
  }
  return matches.sort(byScore).slice(0, MAX_MATCHES);
}

/** «لطبيب», «والقهوة», «بالسيارة»: an Arabic word without the particle and article it carries. */
function withoutProclitic(word: string): string {
  const bare = /^(?:وال|بال|فال|كال|لل|ال|و|ب|ل|ف|ك)(.{3,})$/u.exec(word)?.[1];
  return bare === undefined || !/[\u0600-\u06ff]/u.test(word) ? word : bare;
}

/** The targets of every word-table phrase the folded query holds, as written or without its particles. */
function phrasesOf(
  folded: string,
  table: ReadonlyMap<string, readonly string[]>,
): readonly (readonly string[])[] {
  const found: (readonly string[])[] = [];
  const padded = ` ${folded} `;
  const bare = ` ${folded.split(' ').map(withoutProclitic).join(' ')} `;
  for (const [phrase, targets] of table) {
    if (padded.includes(` ${phrase} `) || bare.includes(` ${phrase} `)) found.push(targets);
  }
  return found;
}

function emojiTitle(name: string): string {
  const words = name.replaceAll('-', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function findIllustrations(query: string, catalog: ArtCatalog): ArtMatch[] {
  const folded = foldArtText(query);
  const words = folded.split(' ').filter((word) => word !== '' && !catalog.words.kinds.has(word));
  const named = catalog.emojiByName.get(query.trim().toLowerCase());
  const scores = new Map<string, number>();
  const add = (name: string, points: number) => scores.set(name, (scores.get(name) ?? 0) + points);
  if (named !== undefined) add(named.name, EXACT * 2);
  for (const targets of phrasesOf(folded, catalog.words.illustrations)) {
    targets.forEach((name, rank) => add(name, EXACT - rank * 5));
  }
  for (const entry of catalog.emoji) {
    let points = 0;
    for (const word of words) {
      if (entry.tokens.includes(word)) points += 10;
      else if (word.length >= 4 && entry.tokens.some((token) => token.startsWith(word)))
        points += 4;
    }
    if (points > 0) add(entry.name, points - (entry.tokens.length - 1));
  }
  return [...scores]
    .filter(([name, score]) => score > 0 && catalog.emojiByName.has(name))
    .map(([name, score]): ArtMatch => ({
      kind: 'illustration',
      id: name,
      title: emojiTitle(name),
      score,
    }))
    .sort(byScore)
    .slice(0, MAX_MATCHES);
}

function styleMatch(style: DiceBearStyleEntry, score: number): ArtMatch {
  return { kind: 'character', id: style.id, title: style.title, score };
}

function findCharacters(query: string, catalog: ArtCatalog): ArtMatch[] {
  const folded = foldArtText(query);
  const offered = new Map(catalog.offeredStyles.map((style) => [style.id, style]));
  const scores = new Map<string, number>();
  const exact = offered.get(query.trim().toLowerCase());
  if (exact !== undefined) scores.set(exact.id, EXACT * 2);
  for (const targets of phrasesOf(folded, catalog.words.characters)) {
    targets.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + EXACT - rank * 5));
  }
  // Any other words ("a cartoon avatar"): every style a page may use, the default first.
  if (scores.size === 0)
    catalog.offeredStyles.forEach((style, rank) => scores.set(style.id, 50 - rank));
  return [...scores]
    .flatMap(([id, score]) => {
      const style = offered.get(id);
      return style === undefined ? [] : [styleMatch(style, score)];
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id, 'en'))
    .slice(0, MAX_MATCHES);
}

/** The kind a query's own words name («شعار ستربس» → logo), if any. */
export function artKindOf(query: string, catalog: ArtCatalog): ArtKind | undefined {
  const padded = ` ${foldArtText(query)} `;
  for (const [word, kind] of catalog.words.kinds) {
    if (padded.includes(` ${word} `)) return kind;
  }
  return undefined;
}

/** Remove the words that only name the kind: «شعار Stripe» → "Stripe". */
function withoutKindWords(query: string, catalog: ArtCatalog): string {
  const words = foldArtText(query).split(' ');
  const kept = words.filter((word) => !catalog.words.kinds.has(word));
  return kept.length === words.length ? query : kept.join(' ');
}

/**
 * The catalog entries a query names, best first (at most ten). With no
 * `kind`, the query's words decide («شعار» → logo, «كرتون» → character); a
 * query that names none is an exact brand first, then an illustration.
 */
export function findArt(
  query: string,
  kind: ArtKind | undefined,
  catalog: ArtCatalog,
): readonly ArtMatch[] {
  if (query.trim() === '') return [];
  const wanted = kind ?? artKindOf(query, catalog);
  const words = wanted === undefined ? query : withoutKindWords(query, catalog);
  switch (wanted) {
    case 'logo':
      return findBrands(words, catalog);
    case 'character':
      return findCharacters(words, catalog);
    case 'illustration':
      return findIllustrations(words, catalog);
    case undefined: {
      const brand = findBrands(words, catalog).filter(({ score }) => score >= EXACT);
      return [...brand, ...findIllustrations(words, catalog)].slice(0, MAX_MATCHES);
    }
  }
}
