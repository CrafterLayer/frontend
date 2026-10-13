import { describe, expect, it } from 'vitest';

import { marketingTemplateCatalog as fromPackage } from '../index';
import { marketingTemplateCatalog } from './catalog';
import { TEMPLATE_COMPOSITIONS } from './index';
import { arabicLetters, collectImageSrcs, sectionTypes, templatePhotoSrcs } from './test-helpers';
import type { MarketingTemplateCard } from './types';

/*
  The Library card list (agent-script DESIGN §B.2). Its shape is load-bearing:
  the shell's TemplateCardInfo is structurally equal to MarketingTemplateCard.
*/

const CARD_KEYS = [
  'category',
  'description',
  'id',
  'lang',
  'name',
  'sections',
  'templateKey',
  'thumbnail',
];

const CATEGORIES = new Set([
  'saas',
  'agency',
  'store',
  'services',
  'restaurant',
  'clinic',
  'portfolio',
  'realestate',
  'events',
  'education',
  'fitness',
  'legal',
  'nonprofit',
  'hospitality',
  'personal',
]);

describe('marketingTemplateCatalog', () => {
  it('is exported from the package entry', () => {
    expect(fromPackage).toBe(marketingTemplateCatalog);
  });

  it('has exactly one card per registered composition, in the same order', () => {
    expect(marketingTemplateCatalog.map((card) => card.id)).toEqual(
      TEMPLATE_COMPOSITIONS.map((composition) => composition.id),
    );
  });

  it('matches the card shape exactly', () => {
    for (const card of marketingTemplateCatalog) {
      expect(Object.keys(card).sort(), card.id).toEqual(CARD_KEYS);
      expect(Object.keys(card.name).sort(), card.id).toEqual(['ar', 'en']);
      expect(Object.keys(card.description).sort(), card.id).toEqual(['ar', 'en']);
      expect(Object.keys(card.thumbnail).sort(), card.id).toEqual(['alt', 'src']);
      expect(CATEGORIES.has(card.category), card.id).toBe(true);
    }
  });

  it('names and describes every template in both languages within 120 characters', () => {
    for (const card of marketingTemplateCatalog) {
      for (const text of [card.name.en, card.name.ar, card.description.en, card.description.ar]) {
        expect(text.length, card.id).toBeGreaterThan(0);
        expect(text.length, `${card.id}: ${text}`).toBeLessThanOrEqual(120);
      }
      expect(arabicLetters(card.name.en + card.description.en), card.id).toBe(0);
      expect(arabicLetters(card.name.ar), card.id).toBeGreaterThan(0);
      expect(arabicLetters(card.description.ar), card.id).toBeGreaterThan(20);
    }
  });

  it('pairs each template key with one English and one Arabic card', () => {
    const byKey = new Map<string, MarketingTemplateCard[]>();
    for (const card of marketingTemplateCatalog) {
      byKey.set(card.templateKey, [...(byKey.get(card.templateKey) ?? []), card]);
    }
    for (const [key, cards] of byKey) {
      expect(cards.map((card) => card.lang).sort(), key).toEqual(['ar', 'en']);
      const [en, ar] = [cards.find((c) => c.lang === 'en'), cards.find((c) => c.lang === 'ar')];
      expect(ar?.id, key).toBe(`${en?.id ?? ''}-ar`);
      expect(ar?.name, key).toEqual(en?.name);
      expect(ar?.category, key).toBe(en?.category);
    }
  });

  it('counts the sections the composition really has', () => {
    for (const card of marketingTemplateCatalog) {
      const composition = TEMPLATE_COMPOSITIONS.find((entry) => entry.id === card.id);
      expect(composition, card.id).toBeDefined();
      if (composition !== undefined)
        expect(card.sections, card.id).toBe(sectionTypes(composition).length);
    }
  });

  it('shows a verified photo thumbnail at w=640 with alt text in the content language', () => {
    const verified = templatePhotoSrcs();
    for (const card of marketingTemplateCatalog) {
      expect(card.thumbnail.src, card.id).toMatch(/[?&]w=640(?:&|$)/u);
      expect(verified.has(card.thumbnail.src.replace(/([?&])w=640/u, '$1w=1600')), card.id).toBe(
        true,
      );
      expect(card.thumbnail.alt.length, card.id).toBeGreaterThan(0);
      if (card.lang === 'ar') expect(arabicLetters(card.thumbnail.alt), card.id).toBeGreaterThan(0);
      else expect(arabicLetters(card.thumbnail.alt), card.id).toBe(0);
    }
  });

  it('uses a photo the page itself shows (the hero) as the thumbnail', () => {
    for (const card of marketingTemplateCatalog) {
      const composition = TEMPLATE_COMPOSITIONS.find((entry) => entry.id === card.id);
      const shown = composition === undefined ? [] : collectImageSrcs(composition);
      expect(shown, card.id).toContain(card.thumbnail.src.replace(/([?&])w=640/u, '$1w=1600'));
    }
  });
});
