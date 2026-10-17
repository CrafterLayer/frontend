import { describe, expect, it } from 'vitest';

import { findPhrase, phraseAt, readingOf, readsAs, tokenize } from './intent-tokens';
import { normalizeIntentText } from './normalize-arabic';

const tokens = (text: string) => tokenize(normalizeIntentText(text));
const stems = (text: string) => (tokens(text)[0]?.readings ?? []).map((reading) => reading.stem);

describe('tokenize', () => {
  it('splits hyphenated words, so “one-page” reads as “one” “page”', () => {
    expect(tokens('a one-page site').map((token) => token.raw)).toEqual([
      'a',
      'one',
      'page',
      'site',
    ]);
  });

  it('keeps an apostrophe inside a word', () => {
    expect(tokens("I'd like what's new").map((token) => token.raw)).toEqual([
      "i'd",
      'like',
      "what's",
      'new',
    ]);
  });

  it('marks the word after punctuation, so a phrase never runs across a comma', () => {
    const split = tokens('home, about: services');
    expect(split.map((token) => token.breakBefore)).toEqual([false, true, true]);
  });

  it('marks Arabic words as Arabic', () => {
    expect(tokens('build موقع').map((token) => token.arabic)).toEqual([false, true]);
  });

  it('peels a conjunction: “وخدمات” is “and services”', () => {
    expect(stems('وخدمات')).toContain('خدمات');
  });

  it('peels the article and records it: “الصفحه” is the page that exists', () => {
    const [token] = tokens('الصفحة');
    expect(token === undefined ? undefined : readingOf(token, (stem) => stem === 'صفحه')).toEqual({
      stem: 'صفحه',
      definite: true,
    });
  });

  it('peels “for the” and “with the” in one go', () => {
    expect(stems('للصفحة')).toContain('صفحه');
    expect(stems('بالموقع')).toContain('موقع');
  });

  it('peels a bare preposition without making the noun definite', () => {
    const [token] = tokens('لمطعم');
    expect(token === undefined ? undefined : readingOf(token, (stem) => stem === 'مطعم')).toEqual({
      stem: 'مطعم',
      definite: false,
    });
  });

  it('reads a possessive as definite, restoring the taa marbuta it hid', () => {
    const [mine] = tokens('موقعي');
    expect(mine === undefined ? undefined : readingOf(mine, (stem) => stem === 'موقع')).toEqual({
      stem: 'موقع',
      definite: true,
    });
    expect(stems('صفحتي')).toContain('صفحه');
  });

  it('never peels a short word to nothing', () => {
    expect(stems('من')).toEqual(['من']);
    expect(stems('بدي')).toEqual(['بدي']);
    expect(stems('لي')).toEqual(['لي']);
  });

  it('reads an English possessive as the thing that exists', () => {
    const [token] = tokens("page's");
    expect(token === undefined ? undefined : readingOf(token, (stem) => stem === 'page')).toEqual({
      stem: 'page',
      definite: true,
    });
  });

  it('answers an empty request with no tokens', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('!?')).toEqual([]);
  });
});

describe('phrases', () => {
  it('matches a phrase through the clitics on its words', () => {
    const request = tokens('وابدأ من الصفر');
    expect(findPhrase(request, ['ابدا', 'من', 'صفر'])).toBe(0);
    expect(phraseAt(request, 1, ['من', 'صفر'])).toBe(true);
  });

  it('never matches across a break', () => {
    expect(findPhrase(tokens('start, over'), ['start', 'over'])).toBe(-1);
  });

  it('never matches past the end', () => {
    expect(findPhrase(tokens('start'), ['start', 'over'])).toBe(-1);
  });

  it('reads nothing into a missing token', () => {
    expect(readsAs(undefined, new Set(['page']))).toBe(false);
  });
});
