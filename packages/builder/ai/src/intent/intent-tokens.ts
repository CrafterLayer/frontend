/**
 * A request as words, each with every reading the router may need.
 *
 * English words are read as written. An Arabic word usually carries more than
 * one word inside it — "وللصفحه" is "and for the page", "موقعي" is "my site" —
 * so each Arabic token lists its READINGS: the token itself first, then the
 * stems left after peeling the clitics a sentence glues on, each marked
 * definite or not. "Definite" is what separates "make the page darker" (the
 * page that exists) from "make a page" (one that does not yet), and Arabic
 * marks it with ال or a possessive suffix rather than a separate word.
 *
 * The peeling is conservative: a clitic is only removed when at least three
 * letters remain, so "من" never becomes "ن" and "بدي" never becomes "دي". The
 * lexicon is the second guard — a reading that is not a listed word is simply
 * never matched, so an over-eager peel costs nothing.
 */

export interface IntentReading {
  readonly stem: string;
  /** The reading carried ال, a demonstrative's article, or a possessive ("my", "our"). */
  readonly definite: boolean;
}

export interface IntentToken {
  /** The token as it stands in the folded request. */
  readonly raw: string;
  readonly arabic: boolean;
  /** Itself first, then every peeled reading. Never empty. */
  readonly readings: readonly IntentReading[];
  /** A comma, colon, full stop or other break came before this token. */
  readonly breakBefore: boolean;
}

const ARABIC_LETTER = /[\u0600-\u06FF]/u;
/*
  One word: letters (with their marks), digits, and an apostrophe INSIDE a word
  ("i'd", "what's"). Hyphens split words, so "one-page" is "one" "page" and
  "re-build" is "re" "build". A break is any punctuation that ends a phrase.
*/
const PIECE = /([\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}\p{N}]+)*)|([.,;:!?()[\]{}"«»…—–/\\|])/gu;

const CONJUNCTIONS = ['و', 'ف'] as const;
/** Article-bearing prefixes, longest first: "بال" "with the", "لل" "for the". */
const DEFINITE_PREFIXES = ['بال', 'كال', 'لل', 'ال'] as const;
/** Bare prepositions glued to an indefinite noun: "لمطعم" "for a restaurant". */
const PREPOSITIONS = ['ب', 'ل', 'ك'] as const;
/** Possessive suffixes — "my", "our", "your", "their", "her" — longest first. */
const POSSESSIVES = ['هم', 'كم', 'ها', 'نا', 'ي', 'ك'] as const;
const MIN_STEM = 3;

function arabicReadings(token: string): IntentReading[] {
  const bases: IntentReading[] = [{ stem: token, definite: false }];
  const firstLetter = token.charAt(0);
  if (token.length > MIN_STEM && CONJUNCTIONS.some((conjunction) => conjunction === firstLetter)) {
    bases.push({ stem: token.slice(1), definite: false });
  }
  const prefixed: IntentReading[] = [];
  for (const base of bases) {
    const article = DEFINITE_PREFIXES.find(
      (prefix) => base.stem.startsWith(prefix) && base.stem.length - prefix.length >= MIN_STEM - 1,
    );
    if (article !== undefined) {
      prefixed.push({ stem: base.stem.slice(article.length), definite: true });
      continue;
    }
    const preposition = PREPOSITIONS.find(
      (prefix) => base.stem.startsWith(prefix) && base.stem.length - prefix.length >= MIN_STEM,
    );
    if (preposition !== undefined) {
      prefixed.push({ stem: base.stem.slice(preposition.length), definite: false });
    }
  }
  const readings = [...bases, ...prefixed];
  /*
    Possessives, over every reading so far. A taa marbuta turns into ت before a
    suffix ("صفحه" → "صفحتي"), so a stem left ending in ت is also read with
    its ه restored — "my page" is still a page.
  */
  for (const reading of [...readings]) {
    const suffix = POSSESSIVES.find(
      (ending) => reading.stem.endsWith(ending) && reading.stem.length - ending.length >= MIN_STEM,
    );
    if (suffix === undefined) continue;
    const stem = reading.stem.slice(0, -suffix.length);
    readings.push({ stem, definite: true });
    if (stem.endsWith('ت')) readings.push({ stem: `${stem.slice(0, -1)}ه`, definite: true });
  }
  return readings;
}

function englishReadings(token: string): IntentReading[] {
  const readings: IntentReading[] = [{ stem: token, definite: false }];
  // "page's" is still a page — and a possessive of it is the page that exists.
  if (token.endsWith("'s")) readings.push({ stem: token.slice(0, -2), definite: true });
  return readings;
}

/** Split a FOLDED request (see `normalizeIntentText`) into tokens. */
export function tokenize(folded: string): IntentToken[] {
  const tokens: IntentToken[] = [];
  let pendingBreak = false;
  for (const match of folded.matchAll(PIECE)) {
    const word = match[1];
    if (word === undefined) {
      pendingBreak = true;
      continue;
    }
    const arabic = ARABIC_LETTER.test(word);
    tokens.push({
      raw: word,
      arabic,
      readings: arabic ? arabicReadings(word) : englishReadings(word),
      breakBefore: pendingBreak,
    });
    pendingBreak = false;
  }
  return tokens;
}

/** The first of a token's readings that satisfies `accept`, if any does. */
export function readingOf(
  token: IntentToken,
  accept: (stem: string) => boolean,
): IntentReading | undefined {
  return token.readings.find((reading) => accept(reading.stem));
}

/** Whether any reading of the token is one of `words`. */
export function readsAs(token: IntentToken | undefined, words: ReadonlySet<string>): boolean {
  return token?.readings.some((reading) => words.has(reading.stem)) ?? false;
}

/**
 * Whether `phrase` starts at `index`, each word matched against the token's
 * readings — so "وابدا من الصفر" holds the phrase "ابدا من صفر". A phrase never
 * spans a break: "start, over" is two thoughts.
 */
export function phraseAt(
  tokens: readonly IntentToken[],
  index: number,
  phrase: readonly string[],
): boolean {
  return phrase.every((word, offset) => {
    const token = tokens[index + offset];
    if (token === undefined) return false;
    if (offset > 0 && token.breakBefore) return false;
    return token.readings.some((reading) => reading.stem === word);
  });
}

/** The index of the first place `phrase` starts, or -1. */
export function findPhrase(tokens: readonly IntentToken[], phrase: readonly string[]): number {
  for (let index = 0; index < tokens.length; index += 1) {
    if (phraseAt(tokens, index, phrase)) return index;
  }
  return -1;
}
