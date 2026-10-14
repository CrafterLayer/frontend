import { describe, expect, it } from 'vitest';

import { buildArtCatalog } from './catalog';
import { artKindOf, brandKey, EXACT, findArt, foldArtText } from './find-art';

const catalog = buildArtCatalog();
const ids = (query: string, kind?: 'logo' | 'character' | 'illustration') =>
  findArt(query, kind, catalog).map(({ id }) => id);
const first = (query: string, kind?: 'logo' | 'character' | 'illustration') => ids(query, kind)[0];

describe('foldArtText and brandKey', () => {
  it('folds case, diacritics, tashkeel and Arabic letter forms', () => {
    expect(foldArtText('Café  CRÈME')).toBe('cafe creme');
    expect(foldArtText('قَهْوَة')).toBe('قهوه');
    expect(foldArtText('أفاتار')).toBe(foldArtText('افاتار'));
  });

  it('spells a brand the way Simple Icons spells its slugs', () => {
    expect(brandKey('Coca-Cola')).toBe('cocacola');
    expect(brandKey('.NET')).toBe('dotnet');
    expect(brandKey('1&1')).toBe('1and1');
    expect(brandKey('Google+')).toBe('googleplus');
  });
});

describe('findArt — brand logos', () => {
  it('finds a brand by slug, title or spelling, exactly', () => {
    expect(findArt('stripe', 'logo', catalog)).toEqual([
      { kind: 'logo', id: 'stripe', title: 'Stripe', score: EXACT },
    ]);
    expect(first('Coca-Cola', 'logo')).toBe('cocacola');
    expect(first('Apple Pay', 'logo')).toBe('applepay');
    expect(first('MasterCard', 'logo')).toBe('mastercard');
    expect(first('McDonald’s', 'logo')).toBe('mcdonalds');
  });

  it('reads the kind from the words: «شعار», "logo"', () => {
    expect(artKindOf('شعار فيزا', catalog)).toBe('logo');
    expect(first('شعار visa')).toBe('visa');
    expect(first('logo paypal')).toBe('paypal');
    expect(first('لوغو stripe')).toBe('stripe');
  });

  it('offers near names for an unknown brand, never as an exact match', () => {
    const near = findArt('mercedes', 'logo', catalog);
    expect(near.every(({ score }) => score < EXACT)).toBe(true);
    expect(findArt('Acme Widgets of Amman', 'logo', catalog)).toEqual([]);
  });
});

describe('findArt — illustrations', () => {
  it('maps English needs to Fluent Emoji names', () => {
    expect(first('doctor', 'illustration')).toBe('health-worker');
    expect(first('coffee', 'illustration')).toBe('hot-beverage');
    expect(first('car', 'illustration')).toBe('automobile');
    expect(first('rocket', 'illustration')).toBe('rocket');
    expect(first('engineer', 'illustration')).toBe('technologist');
  });

  it('maps Arabic needs the same way', () => {
    expect(first('طبيب', 'illustration')).toBe('health-worker');
    expect(first('مهندس', 'illustration')).toBe('technologist');
    expect(first('قهوة', 'illustration')).toBe('hot-beverage');
    expect(first('سيارة', 'illustration')).toBe('automobile');
    expect(first('رائد فضاء', 'illustration')).toBe('astronaut');
    expect(first('رسم توضيحي لطبيب')).toBe('health-worker');
  });

  it('matches name words directly and takes an exact name as it is', () => {
    expect(first('pizza', 'illustration')).toBe('pizza');
    expect(first('woman-health-worker', 'illustration')).toBe('woman-health-worker');
    expect(ids('teacher', 'illustration').slice(0, 3)).toEqual([
      'teacher',
      'woman-teacher',
      'man-teacher',
    ]);
  });

  it('answers the same query the same way, every time', () => {
    expect(ids('travel', 'illustration')).toEqual(ids('travel', 'illustration'));
    expect(ids('xyzzy', 'illustration')).toEqual([]);
  });
});

describe('findArt — characters', () => {
  it('reads character words in both languages and offers no-credit styles only', () => {
    expect(artKindOf('شخصية كرتونية', catalog)).toBe('character');
    expect(artKindOf('أفاتار', catalog)).toBe('character');
    expect(first('cartoon avatar')).toBe('notionists');
    expect(first('robot', 'character')).toBe('bottts');
    expect(first('روبوت', 'character')).toBe('bottts');
    expect(first('pixel', 'character')).toBe('pixel-art');
    const offered = new Set(catalog.offeredStyles.map(({ id }) => id));
    expect(ids('character').every((id) => offered.has(id))).toBe(true);
  });
});
