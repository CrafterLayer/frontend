import { describe, expect, it } from 'vitest';

import {
  ADDABLE_PAGE_NOUNS,
  ADVERBIAL_START_OVERS,
  BARE_START_OVER_WORDS,
  CLEAR_ALL,
  COMPARATIVES,
  CONTROL_FILLERS,
  CONTROL_WORDS,
  COPULAS,
  DEFINITE_AR,
  DEFINITE_EN,
  GREETINGS,
  INDEFINITE_EN,
  INTERROGATIVE_PAIRS,
  INTERROGATIVES,
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
  PHRASE_STOPS,
  PLURAL_PAGE_NOUNS,
  PRONOUNS,
  REPLACE_STRONG,
  REPLACE_WEAK,
  START_OVER_LINKS,
  START_OVER_OBJECTS_AR,
  SUGGESTION_OPENERS,
  THIRD_PERSON_WANTS,
  VERB_PAIRS_EN,
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
});
