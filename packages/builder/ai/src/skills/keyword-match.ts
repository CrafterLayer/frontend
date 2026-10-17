import { tokenize, type IntentToken } from '../intent/intent-tokens';
import { normalizeIntentText } from '../intent/normalize-arabic';

/**
 * Keyword activation over WORDS, not characters.
 *
 * ## Why this replaced `request.includes(keyword)`
 *
 * A substring hit is a keyword found inside any longer word. Measured
 * 2026-09-28: occasion-page's "eid al" fired inside "Reid Allen Plumbing" (the
 * wave-1 verifier) — after the previous fix, trailing spaces on "eid " and
 * "عيد ", had already failed because definitions trim keywords and "عيد" then
 * matched inside "سعيد". The industry keywords were written around the same
 * trap ("spa" in "space", "villa" in "village") by leaving words out. The
 * class is closed here once: a keyword matches whole words of the request.
 *
 * ## What counts as the same word
 *
 * The request and every keyword are read the way the intent router reads a
 * request — `normalizeIntentText` (case, hamza, taa marbuta, alif maqsura,
 * tashkeel, presentation forms) plus Latin accents ("café" is "cafe") — and
 * split by the router's tokenizer, which peels the Arabic clitics a sentence
 * glues on: "لعيادتي" holds "عيادة", "بالعيد" holds "العيد". A keyword's LAST
 * word also takes the endings its word inflects by, which the substring
 * matcher gave for free and the keywords were written to rely on: "animate"
 * covers "animated", "bakery" covers "bakeries", "orthodont" covers
 * "orthodontist", "عقار" covers "عقارية". The endings are a closed list, so
 * "villa" never reaches "village" nor "doctor" "doctorate", and a Latin word
 * of three letters or fewer takes none: "eid" is not "eider", "cv" not "CVS".
 */

const LATIN_MARKS = /[̀-ͯ]/gu;
const ARABIC_LETTER = /[؀-ۿ]/u;

/** The request or keyword folded for matching: the router's fold, then Latin accents dropped. */
function fold(text: string): string {
  return normalizeIntentText(text).normalize('NFD').replace(LATIN_MARKS, '').normalize('NFC');
}

/*
  The dialect "for me" (2026-10-14). «سويلي لعبة» is «سوي لي لعبة» written as one word, and
  the router's tokenizer peels only the possessive ي from it — «سويل», no word at all — so
  «سوي لعبة» never matched. A token ending in «لي» is also read without it when three letters
  stay («سويلي» → «سوي», «صمملي» → «صمم»); a reading that is no keyword's word costs nothing.
*/
const DATIVE_SUFFIX = 'لي';
const MIN_DATIVE_STEM = 3;

function withDativeReading(token: IntentToken): IntentToken {
  const stem = token.raw.slice(0, -DATIVE_SUFFIX.length);
  if (
    !token.arabic ||
    !token.raw.endsWith(DATIVE_SUFFIX) ||
    stem.length < MIN_DATIVE_STEM ||
    token.readings.some((reading) => reading.stem === stem)
  ) {
    return token;
  }
  return { ...token, readings: [...token.readings, { stem, definite: false }] };
}

/** The request as words, read once per `prepare`. */
export function readRequestWords(request: string): readonly IntentToken[] {
  return tokenize(fold(request)).map(withDativeReading);
}

/*
  The endings a keyword's last word may carry. English: plurals, the past and
  the -ing form, the agent and specialist nouns ("barbers", "orthodontist",
  "pediatrician"). Arabic: the feminine and nisba endings ("فريدة", "عقاري",
  "عقارية"), and the indefinite accusative's alif once its tanween is folded
  away ("أضف مخططًا" holds "مخطط", "صمّم شعارًا" holds "شعار"; 2026-10-12) — not
  the plural ات, which reaches different words as often ("ذكرى" → "ذكريات"
  memories, "رحلة" → "رحلات" trips); plurals a keyword needs are listed as
  keywords.
*/
const LATIN_ENDINGS = [
  's',
  'es',
  'ed',
  'd',
  'ing',
  'er',
  'ers',
  'ist',
  'ists',
  'ian',
  'ians',
  'ics',
];
const LATIN_Y_ENDINGS = ['ies', 'ied', 'ian', 'ians', 'ist', 'ists'];
const ARABIC_ENDINGS = ['ه', 'ي', 'يه', 'ا'];

/*
  A Latin keyword word shorter than this takes no endings. Two or three
  letters is an abbreviation or a short root, and its "inflections" are other
  words: "eid" + "er" is Eider ("a page for Eider Ducks conservation" loaded
  occasion-page) and "cv" + "s" is CVS ("website for CVS pharmacy branch"
  loaded cv-page) — wave-2 verifier, 2026-09-28. A short keyword that needs
  its plural lists it, as the Arabic plurals are listed ("faqs", "juice
  bars"). Arabic roots are three letters as a rule, and their feminine is the
  same word ("حفل" / "حفلة"), so Arabic keeps its endings.
*/
const MIN_INFLECTED_LATIN = 4;

/** Every spelling a keyword word matches: itself, and its endings when it is the last word. */
function formsOf(word: string, last: boolean): ReadonlySet<string> {
  const forms = new Set([word]);
  if (!last) return forms;
  if (ARABIC_LETTER.test(word)) {
    for (const ending of ARABIC_ENDINGS) forms.add(`${word}${ending}`);
    return forms;
  }
  if (word.length < MIN_INFLECTED_LATIN) return forms;
  for (const ending of LATIN_ENDINGS) forms.add(`${word}${ending}`);
  if (word.endsWith('y')) {
    for (const ending of LATIN_Y_ENDINGS) forms.add(`${word.slice(0, -1)}${ending}`);
  }
  // "animate" → "animating": the silent e goes before -ing.
  if (word.endsWith('e')) forms.add(`${word.slice(0, -1)}ing`);
  return forms;
}

interface KeywordWord {
  readonly forms: ReadonlySet<string>;
  /** An Arabic word written with its article: "العيد" also matches "بالعيد", peeled to "عيد". */
  readonly bareDefinite?: string;
}

/** One keyword, compiled: its words in order. Empty when the keyword folds to no word at all. */
export type CompiledKeyword = readonly KeywordWord[];

export function compileKeyword(keyword: string): CompiledKeyword {
  const words = tokenize(fold(keyword)).map((token) => token.raw);
  return words.map((word, index) => {
    const last = index === words.length - 1;
    const forms = new Set(formsOf(word, last));
    /*
      A LATER Arabic word may carry the "and" a list glues on — "جلدية
      وتجميل" — which the request's tokenizer peels and the keyword's did not:
      compiled raw, "وتجميل" missed "مركز الجلدية والتجميل", read as "التجميل"
      and "تجميل" (wave-2 verifier, 2026-09-28). Such a word also matches
      without it. Never the first word, whose و or ف is its own letter as
      often as not: "فطور" (breakfast) is not "طور" (develop).
    */
    const bare = index > 0 ? peeledConjunction(word) : undefined;
    if (bare !== undefined) for (const form of formsOf(bare, last)) forms.add(form);
    const withArticle = [word, bare].find(
      (candidate) => candidate !== undefined && candidate.startsWith('ال') && candidate.length >= 4,
    );
    return withArticle === undefined ? { forms } : { forms, bareDefinite: withArticle.slice(2) };
  });
}

/** The word without a leading و/ف, where the tokenizer would peel one (four letters or more). */
function peeledConjunction(word: string): string | undefined {
  return ARABIC_LETTER.test(word) && word.length > 3 && /^[وف]/u.test(word)
    ? word.slice(1)
    : undefined;
}

function wordMatches(token: IntentToken, word: KeywordWord): boolean {
  return token.readings.some(
    (reading) =>
      word.forms.has(reading.stem) ||
      (word.bareDefinite !== undefined && reading.definite && reading.stem === word.bareDefinite),
  );
}

/*
  The same "for me" as its own word: «اعمل لي لعبة» holds «اعمل لعبة». Between two words of a
  keyword the request may carry one «لي» or «لنا» the keyword does not; a keyword that names
  it («صمم لي») still matches it as a word.
*/
const DATIVE_WORDS: ReadonlySet<string> = new Set(['لي', 'لنا']);

function matchesFrom(
  words: readonly IntentToken[],
  keyword: CompiledKeyword,
  start: number,
): boolean {
  let at = start;
  for (const [offset, word] of keyword.entries()) {
    const token = words[at];
    if (token === undefined) return false;
    if (!wordMatches(token, word)) {
      const next = words[at + 1];
      if (offset === 0 || !DATIVE_WORDS.has(token.raw) || next === undefined) return false;
      if (!wordMatches(next, word)) return false;
      at += 1;
    }
    at += 1;
  }
  return true;
}

/**
 * Whether the request holds the keyword as consecutive whole words.
 * Punctuation between them does not matter: "UI/UX" holds "ui ux".
 */
export function requestHasKeyword(
  words: readonly IntentToken[],
  keyword: CompiledKeyword,
): boolean {
  if (keyword.length === 0) return false;
  for (let start = 0; start + keyword.length <= words.length; start += 1) {
    if (matchesFrom(words, keyword, start)) return true;
  }
  return false;
}
