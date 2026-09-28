import { describe, expect, it } from 'vitest';

import {
  ADDABLE_PAGE_NOUNS,
  ADVERBIAL_START_OVERS,
  BARE_START_OVER_WORDS,
  CHANGE_VERBAL_NOUNS_AR,
  CLEAR_ALL,
  COMPARATIVES,
  CONSEQUENCE_AUXILIARIES,
  CONTROL_FILLERS,
  CONTROL_WORDS,
  COPULAS,
  DEFINITE_AR,
  DEFINITE_EN,
  EXISTENTIALS_AR,
  EXISTENTIALS_EN,
  FIRST_PERSON,
  FUNCTION_WORDS,
  GREETINGS,
  HYPOTHETICAL_OPENERS,
  IDENTITY_WORDS,
  INDEFINITE_EN,
  INTERROGATIVE_PAIRS,
  INTERROGATIVES,
  IRREGULAR_PASTS_EN,
  JUDGMENTS,
  NEGATIONS,
  NEW_WORDS_AR,
  NEW_WORDS_EN,
  NOT_THE_ARTICLE,
  NOUN_PAIRS_AR,
  NOUNS,
  OBJECT_FILLERS,
  OBJECT_PRONOUNS,
  OPENERS,
  PAGE_NAME_PAIRS_AR,
  PAGE_NAMES_AR,
  PAGE_NAMES_EN,
  PAGE_WORDS,
  PAST_SUFFIXES_AR,
  PHRASE_STOPS,
  PLURAL_PAGE_NOUNS,
  PRONOUNS,
  REPLACE_STRONG,
  REPLACE_WEAK,
  RESTART_VERBS_AR,
  SECTION_WORDS,
  START_OVER_LINKS,
  START_OVER_OBJECTS_AR,
  SUGGESTION_OPENERS,
  SUGGESTION_SUBJECTS,
  THIRD_PERSON_WANTS,
  TIME_ADVERBS,
  VERB_GOVERNORS_AR,
  VERB_PAIRS_EN,
  VERBAL_NOUNS_AR,
  VERBS_AR,
  VERBS_EN,
} from './intent-lexicon';
import { normalizeIntentText } from './normalize-arabic';

/*
  The router compares FOLDED text with lexicon entries, so an entry that is not
  already its own fold — "صفحة" with a taa marbuta, "أضف" with a hamza, "Page"
  with a capital — is a rule that can never fire, and nothing else would say so.
*/
const EVERY_WORD: readonly string[] = [
  ...NOUNS.keys(),
  ...NOUN_PAIRS_AR.flatMap(([first, second]) => [first, second]),
  ...ADDABLE_PAGE_NOUNS,
  ...PLURAL_PAGE_NOUNS,
  ...PAGE_WORDS,
  ...PAGE_NAMES_EN.keys(),
  ...PAGE_NAMES_AR.keys(),
  ...PAGE_NAME_PAIRS_AR.flatMap(([first, second]) => [first, second]),
  ...OBJECT_FILLERS,
  ...PHRASE_STOPS,
  ...START_OVER_LINKS,
  ...ADVERBIAL_START_OVERS.flat(),
  ...BARE_START_OVER_WORDS,
  ...THIRD_PERSON_WANTS,
  ...DEFINITE_AR,
  ...DEFINITE_EN,
  ...INDEFINITE_EN,
  ...NEW_WORDS_AR,
  ...NEW_WORDS_EN,
  ...VERBS_EN.keys(),
  ...VERB_PAIRS_EN.flatMap(([first, second]) => [first, second]),
  ...COMPARATIVES,
  ...COPULAS,
  ...INTERROGATIVES,
  ...INTERROGATIVE_PAIRS.flat(),
  ...OPENERS.flatMap((opener) => opener.words),
  ...GREETINGS,
  ...REPLACE_STRONG.flat(),
  ...REPLACE_WEAK.flat(),
  ...CLEAR_ALL.flat(),
  ...CONTROL_WORDS,
  ...CONTROL_FILLERS,
  ...PRONOUNS,
  ...OBJECT_PRONOUNS,
  ...NOT_THE_ARTICLE,
  ...START_OVER_OBJECTS_AR,
  ...SUGGESTION_OPENERS.flat(),
  // router-3, 2026-09-28.
  ...HYPOTHETICAL_OPENERS.flat(),
  ...CONSEQUENCE_AUXILIARIES,
  ...FIRST_PERSON,
  ...SUGGESTION_SUBJECTS,
  ...EXISTENTIALS_EN.flat(),
  ...EXISTENTIALS_AR.flat(),
  ...IRREGULAR_PASTS_EN.keys(),
  ...IRREGULAR_PASTS_EN.values(),
  ...PAST_SUFFIXES_AR,
  ...CHANGE_VERBAL_NOUNS_AR,
  ...VERBAL_NOUNS_AR,
  ...VERB_GOVERNORS_AR,
  ...TIME_ADVERBS.flat(),
  ...IDENTITY_WORDS,
  ...JUDGMENTS,
  ...NEGATIONS,
  ...RESTART_VERBS_AR,
  ...SECTION_WORDS,
  ...FUNCTION_WORDS,
];

describe('the intent lexicon', () => {
  it.each(EVERY_WORD)('lists “%s” exactly as a folded request spells it', (word) => {
    expect(normalizeIntentText(word)).toBe(word);
  });

  it('lists every word as one token — a space would never match a single word', () => {
    expect(EVERY_WORD.filter((word) => /\s/u.test(word))).toEqual([]);
  });

  it('reads the nouns the rules turn on as the category those rules expect', () => {
    expect(NOUNS.get('page')).toBe('page');
    expect(NOUNS.get('website')).toBe('site');
    expect(NOUNS.get('section')).toBe('section');
    expect(NOUNS.get('button')).toBe('element');
    expect(NOUNS.get('صفحه')).toBe('page');
    expect(NOUNS.get('موقع')).toBe('site');
    expect(NOUNS.get('قسم')).toBe('section');
    expect(NOUNS.get('زر')).toBe('element');
  });

  it.each([
    ['سوي', 'create'],
    ['سويلي', 'create'],
    ['تسويلي', 'create'],
    ['اعمل', 'create'],
    ['اعمللي', 'create'],
    ['وصمم', 'create'],
    ['صمملي', 'create'],
    ['انشئ', 'create'],
    ['انشاء', 'create'],
    ['ابني', 'create'],
    ['بناء', 'create'],
    ['جهزلي', 'create'],
    ['بدي', 'want'],
    ['اريد', 'want'],
    ['ابغي', 'want'],
    ['عايز', 'want'],
    ['محتاج', 'want'],
    ['اعطني', 'want'],
    ['اجعل', 'make'],
    ['خلي', 'make'],
    ['اضف', 'add'],
    ['ضيف', 'add'],
    ['ضيفلي', 'add'],
    ['اضافه', 'add'],
    ['حطلي', 'add'],
    ['غير', 'edit'],
    ['عدل', 'edit'],
    ['احذف', 'edit'],
    ['ترجم', 'edit'],
    ['اكتب', 'edit'],
  ])('reads the Arabic verb form “%s” as %s', (form, kind) => {
    expect(VERBS_AR.find(([pattern]) => pattern.test(form))?.[1]).toBe(kind);
  });

  it.each(['بنا', 'ابن', 'موقع', 'صفحه', 'كتب', 'مطعم', 'عملاء', 'لي'])(
    'reads “%s” as no verb at all',
    (word) => {
      expect(VERBS_AR.find(([pattern]) => pattern.test(word))).toBeUndefined();
    },
  );

  /*
    router-3, 2026-09-28: an explicit QUESTION of possibility asks the product
    ("is it possible to…", "هل يمكن + verbal noun"); courtesy addressed to the
    assistant ("can you", "هل يمكنك", the Levantine bare "ممكن") asks it to act.
  */
  it('marks the questions of possibility, and only those', () => {
    const possibility = (...words: string[]) =>
      OPENERS.find((opener) => opener.words.join(' ') === words.join(' '))?.possibility;
    expect(possibility('is', 'it', 'possible', 'to')).toBe('infinitive');
    expect(possibility('would', 'it', 'be', 'possible', 'to')).toBe('infinitive');
    expect(possibility('هل', 'يمكن')).toBe('verbal-noun');
    expect(possibility('هل', 'من', 'الممكن')).toBe('verbal-noun');
    expect(possibility('can', 'you')).toBeUndefined();
    expect(possibility('هل', 'يمكنك')).toBeUndefined();
    expect(possibility('ممكن')).toBeUndefined();
  });

  it('maps every irregular past to a verb the router reads', () => {
    expect([...IRREGULAR_PASTS_EN.values()].filter((present) => !VERBS_EN.has(present))).toEqual([]);
  });

  it('counts every verbal noun of change among the verbal nouns', () => {
    expect([...CHANGE_VERBAL_NOUNS_AR].filter((noun) => !VERBAL_NOUNS_AR.has(noun))).toEqual([]);
  });
});
