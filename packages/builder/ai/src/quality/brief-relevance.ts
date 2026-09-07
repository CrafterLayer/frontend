/**
 * SC-005's first half, measured: how much of a site's copy is actually ABOUT
 * the business it was written for.
 *
 * ## Why a measure and not a check
 *
 * The other files here answer yes or no and block a commit. This one returns a
 * RATIO, because the criterion is a ratio — "at least 95% of generated text
 * spans contain business-specific terms drawn from the brief" — and because the
 * number is the interesting part. A model that scores 0.4 is writing about
 * nothing in particular; one that scores 0.98 is writing about a ceramics
 * studio in Amman. A boolean would hide the difference, and the difference is
 * exactly what the tier comparison and the human evaluation need to see.
 *
 * ## What it does NOT do
 *
 * It does not look for filler. That is SC-005's second half and it already has
 * two owners — the content stage refuses filler on the WIRE, before a document
 * exists, and `checkDocumentQuality` reports it on a DOCUMENT. Both keep their
 * own vocabulary on purpose. A third list here would be a third answer to one
 * question, and the day the three disagreed nobody could say which was right.
 *
 * ## Why substring matching, and why a length floor
 *
 * Arabic attaches its article: a brief saying "خزف" produces copy saying
 * "الخزف", and a word-boundary match would score that zero. Substring matching
 * gets it right, at the cost of false positives on very short terms — so terms
 * shorter than three characters are dropped, along with the closed-class words
 * of both languages, which appear in every sentence ever written and would make
 * every span look relevant.
 */

export interface BriefRelevance {
  /** Every span that was measured. */
  readonly spans: number;
  /** Spans carrying at least one term from the brief. */
  readonly relevant: number;
  /** `relevant / spans`. One when there was nothing to measure. */
  readonly coverage: number;
  /** The terms the brief contributed, for a reader who wants to see the basis. */
  readonly terms: readonly string[];
  /** Spans carrying none of them, in the order they were given. */
  readonly generic: readonly string[];
}

/*
  Closed-class words only — articles, pronouns, prepositions, auxiliaries. Not a
  general stopword list: dropping ordinary nouns would drop the very terms a
  brief contributes. Both languages are here because the default locale is
  Arabic and a measure that only knew English would score an Arabic site zero.
*/
const CLOSED_CLASS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
  'من',
  'إلى',
  'الى',
  'على',
  'عن',
  'في',
  'مع',
  'هذا',
  'هذه',
  'ذلك',
  'التي',
  'الذي',
  'أن',
  'ان',
  'إن',
  'كان',
  'كانت',
  'هو',
  'هي',
  'هم',
  'ما',
  'لا',
  'قد',
  'كل',
  'بعض',
]);

const MIN_TERM_LENGTH = 3;

/** Lowercase word-ish runs, Unicode-aware, with the article stripped from Arabic. */
function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== '');
}

/**
 * The terms a brief contributes.
 *
 * The Arabic definite article is stripped from the TERM as well as matched
 * inside a span, so a brief saying "الخزف" and copy saying "خزف" count as the
 * same word — the alternative is a measure that scores an honest site zero
 * because the brief happened to be definite.
 */
export function briefTerms(brief: string): readonly string[] {
  const terms = new Set<string>();
  for (const token of tokenize(brief)) {
    const bare = token.startsWith('ال') && token.length > 4 ? token.slice(2) : token;
    if (bare.length < MIN_TERM_LENGTH || CLOSED_CLASS.has(bare) || CLOSED_CLASS.has(token)) {
      continue;
    }
    terms.add(bare);
  }
  return [...terms];
}

export function measureBriefRelevance(brief: string, spans: readonly string[]): BriefRelevance {
  const terms = briefTerms(brief);
  /*
    A span with no words in it is not measurable and is not counted either way.
    Counting it as generic would penalise a design for an empty alt text; as
    relevant, it would let a page of blanks score a perfect one.
  */
  const measurable = spans.filter((span) => span.trim() !== '');
  const generic: string[] = [];

  for (const span of measurable) {
    const haystack = span.toLowerCase();
    if (!terms.some((term) => haystack.includes(term))) {
      generic.push(span);
    }
  }

  const relevant = measurable.length - generic.length;
  return {
    spans: measurable.length,
    relevant,
    coverage: measurable.length === 0 ? 1 : relevant / measurable.length,
    terms,
    generic,
  };
}
