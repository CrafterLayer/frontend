import { describe, expect, it } from 'vitest';

import { encodeRoute, seoSlug } from './slug';

describe('seoSlug', () => {
  it('keeps Arabic and normalises harakat, tatweel and alef variants', () => {
    expect(seoSlug('مَقهى الأُردن', 'ar')).toBe('مقهى-الاردن');
    expect(seoSlug('قـــهوة  إربد!', 'ar')).toBe('قهوة-اربد');
    expect(seoSlug('مسؤول', 'ar')).toBe('مسؤول');
  });

  it('lower-cases Latin, drops accents, caps length at a hyphen and never returns empty', () => {
    expect(seoSlug('Café Déjà Vu — Menu', 'en')).toBe('cafe-deja-vu-menu');
    const long = seoSlug('word '.repeat(30), 'en');
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
    expect(seoSlug('!!!', 'en')).toBe('page');
    expect(seoSlug('', 'ar')).toBe('page');
  });
});

describe('encodeRoute', () => {
  it('percent-encodes Arabic segments as UTF-8 and is idempotent', () => {
    const encoded = encodeRoute('/قائمة/مقهى-الاردن');
    expect(encoded).toBe(`/${encodeURIComponent('قائمة')}/${encodeURIComponent('مقهى-الاردن')}`);
    expect(encodeRoute(encoded)).toBe(encoded);
  });

  it('keeps Latin paths, slashes and query untouched', () => {
    expect(encodeRoute('/')).toBe('/');
    expect(encodeRoute('/en/menu/')).toBe('/en/menu/');
    expect(encodeRoute('/a b')).toBe('/a%20b');
  });
});
