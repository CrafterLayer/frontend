import { describe, expect, it } from 'vitest';

import type { CompositionDef, JsonValue, Node } from '@craftkit/builder-schema';

import { money, thumbnailSrc, type Currency } from '../build';
import { marketingTemplateCatalog } from '../catalog';
import { TEMPLATE_COMPOSITIONS, TEMPLATE_DEFINITIONS } from '../index';
import { TEMPLATE_PHOTOS } from '../photos';
import {
  actionLabels,
  arabicLetters,
  collectImageSrcs,
  collectStrings,
  defaultLeaks,
  insertAndValidate,
  latinWords,
  schemaDefaults,
  sectionTypes,
  templatePhotoSrcs,
} from '../test-helpers';
import type { TemplateLang } from '../types';
import { VERTICAL_DEFINITIONS } from './index';

/*
  templates-verticals (agent-script DESIGN §B.1–§B.3): five vertical
  templates, each in English and Arabic, checked against the quality bar as
  data. Rendering at 390–1440 px in light and dark is the end-of-program
  capture's job; this file proves what can be proven without a browser.
*/

const VERTICAL_IDS = ['restaurant', 'clinic', 'portfolio-cv', 'real-estate', 'events'];

const compositions: readonly CompositionDef[] = VERTICAL_DEFINITIONS.flatMap((definition) => [
  definition.build('en'),
  definition.build('ar'),
]);

const langOf = (composition: CompositionDef): TemplateLang =>
  composition.id.endsWith('-ar') ? 'ar' : 'en';

const byLang = (lang: TemplateLang) => compositions.filter((c) => langOf(c) === lang);

const nodesOfType = (composition: CompositionDef, type: string): Node[] =>
  Object.values(composition.nodes).filter((node) => node.type === type);

const list = (value: JsonValue | undefined): Record<string, JsonValue>[] =>
  Array.isArray(value) ? (value as Record<string, JsonValue>[]) : [];

/** A prop as shown text; anything that is not a string reads as ''. */
const text = (value: JsonValue | undefined): string => (typeof value === 'string' ? value : '');

/** The outline of every template, in order (DESIGN §B.3). */
const OUTLINES: Record<string, readonly string[]> = {
  restaurant: [
    'pageHeader',
    'hero',
    'bento-grid',
    'productGrid',
    'gallery',
    'testimonials',
    'contact',
    'promoBanner',
    'pageFooter',
  ],
  clinic: [
    'pageHeader',
    'hero',
    'features',
    'processSteps',
    'team',
    'stats',
    'testimonials',
    'faq',
    'formSection',
    'pageFooter',
  ],
  'portfolio-cv': [
    'pageHeader',
    'hero',
    'content-section',
    'stats',
    'portfolioGrid',
    'processSteps',
    'features',
    'testimonials',
    'contact',
    'pageFooter',
  ],
  'real-estate': [
    'pageHeader',
    'hero',
    'productGrid',
    'features',
    'stats',
    'gallery',
    'team',
    'testimonials',
    'contact',
    'pageFooter',
  ],
  events: [
    'announcementBar',
    'pageHeader',
    'hero',
    'stats',
    'processSteps',
    'team',
    'pricing',
    'gallery',
    'faq',
    'promoBanner',
    'pageFooter',
  ],
};

/**
 * Column counts each grid passes through between 390 and 1440 px (beyond the
 * single column), read from the components' container-query classes — e.g.
 * ProductGrid '4' is `grid-cols-1 @sm:2 @lg:3 @xl:4`. An item count that every
 * step divides leaves no empty cell at any width.
 */
const COLUMN_STEPS: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = {
  productGrid: { '2': [2], '3': [2, 3], '4': [2, 3, 4] },
  portfolioGrid: { '2': [2], '3': [2, 3] },
  team: { '2': [2], '3': [2, 3], '4': [2, 4] },
  features: { '1': [], '2': [2], '3': [2, 3], '4': [2, 3, 4] },
  stats: { auto: [2, 4], '2': [2], '3': [3], '4': [2, 4] },
  processSteps: { auto: [2, 4], '2': [2], '3': [3], '4': [2, 4] },
  testimonials: { auto: [2, 3], '1': [], '2': [2], '3': [2, 3] },
  gallery: { '2': [2], '3': [2, 3], '4': [2, 3, 4] },
};

const ITEMS_KEY: Readonly<Record<string, string>> = {
  productGrid: 'products',
  portfolioGrid: 'items',
  team: 'members',
  features: 'items',
  stats: 'items',
  processSteps: 'steps',
  testimonials: 'items',
  gallery: 'items',
  faq: 'items',
};

/**
 * The editorial gallery is two columns where the first item and every
 * `featured` item span both. Walks the row: a wide item that would start in
 * the second column leaves a hole, and so does a half-filled last row.
 */
function editorialFills(items: readonly Record<string, JsonValue>[]): boolean {
  let column = 0;
  for (const [index, item] of items.entries()) {
    const span = index === 0 || item['featured'] === true ? 2 : 1;
    if (span === 2 && column === 1) return false;
    column = (column + span) % 2;
  }
  return column === 0;
}

/** Keys whose string default is shown as copy (mirrors test-helpers' TEXT_KEY). */
const COPY_KEY =
  /(label|title|heading|body|eyebrow|text|note|message|placeholder|caption|privacy|prefix|suffix|headline)$/iu;

/** Currency each priced list is written in. */
const PRICED: readonly { readonly id: string; readonly type: string; readonly currency: Currency }[] = [
  { id: 'restaurant', type: 'productGrid', currency: 'JOD' },
  { id: 'real-estate', type: 'productGrid', currency: 'AED' },
  { id: 'events', type: 'pricingPlan', currency: 'SAR' },
];

const baseIdOf = (composition: CompositionDef) => composition.id.replace(/-ar$/u, '');

describe('vertical templates (DESIGN §B.3)', () => {
  it('ships 10 compositions — five verticals, each with an Arabic twin — after the core eight', () => {
    expect(compositions.map((composition) => composition.id)).toEqual(
      VERTICAL_IDS.flatMap((id) => [id, `${id}-ar`]),
    );
    expect(TEMPLATE_DEFINITIONS.slice(4)).toEqual([...VERTICAL_DEFINITIONS]);
    expect(TEMPLATE_COMPOSITIONS.slice(8).map((composition) => composition.id)).toEqual(
      compositions.map((composition) => composition.id),
    );
  });

  it.each(compositions.map((composition) => [composition.id, composition] as const))(
    '%s inserts as one transaction, validates, and undoes exactly',
    (_id, composition) => {
      const result = insertAndValidate(composition);
      expect(result.insertedId).toBeDefined();
      expect(result.transactions).toBe(1);
      expect(result.violations).toEqual([]);
      expect(result.undoRestores).toBe(true);
    },
  );

  it('uses unique composition ids and unique node ids, keyed by their own id', () => {
    const all = TEMPLATE_COMPOSITIONS.map((composition) => composition.id);
    expect(new Set(all).size).toBe(all.length);
    const nodeIds = TEMPLATE_COMPOSITIONS.flatMap((composition) => Object.keys(composition.nodes));
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    for (const composition of compositions) {
      for (const [key, node] of Object.entries(composition.nodes)) expect(node.id).toBe(key);
      const prefix = composition.nodes[composition.rootId]?.id.replace(/-root$/u, '') ?? '';
      expect(prefix, composition.id).toMatch(new RegExp(`-${langOf(composition)}$`, 'u'));
      for (const id of Object.keys(composition.nodes)) expect(id.startsWith(`${prefix}-`), id).toBe(true);
    }
  });

  it('follows each outline exactly, header first (after the date bar) and footer last', () => {
    for (const composition of compositions) {
      const types = sectionTypes(composition);
      expect(types, composition.id).toEqual(OUTLINES[baseIdOf(composition)]);
      const headerAt = types.indexOf('pageHeader');
      expect(headerAt === 0 || (headerAt === 1 && types[0] === 'announcementBar'), composition.id).toBe(
        true,
      );
      expect(types.at(-1), composition.id).toBe('pageFooter');
    }
  });

  it('keeps English pages free of Arabic letters', () => {
    for (const composition of byLang('en')) {
      const arabic = collectStrings(composition).filter((entry) => arabicLetters(entry.value) > 0);
      expect(arabic, composition.id).toEqual([]);
      expect(arabicLetters(composition.name), composition.id).toBe(0);
    }
  });

  it('writes Arabic pages in Arabic: ≥ 400 letters and no Latin words beyond the allow-list', () => {
    for (const composition of byLang('ar')) {
      const strings = collectStrings(composition);
      const letters = strings.reduce((sum, entry) => sum + arabicLetters(entry.value), 0);
      expect(letters, composition.id).toBeGreaterThanOrEqual(400);
      const latin = strings
        .map((entry) => ({ ...entry, words: latinWords(entry.value) }))
        .filter((entry) => entry.words.length > 0);
      expect(latin, composition.id).toEqual([]);
      expect(arabicLetters(composition.name), composition.id).toBeGreaterThan(0);
    }
  });

  it('gives every section the same wide content width', () => {
    for (const composition of compositions) {
      const root = composition.nodes[composition.rootId];
      for (const id of root?.slots?.['default'] ?? []) {
        const node = composition.nodes[id];
        const defaults = schemaDefaults(node?.type ?? '');
        if (defaults !== undefined && 'width' in defaults) {
          expect(node?.props['width'], `${composition.id}/${id}`).toBe('wide');
        }
      }
    }
  });

  it('uses only verified photos, never the same one twice on a page', () => {
    const verified = templatePhotoSrcs();
    for (const composition of compositions) {
      const srcs = collectImageSrcs(composition);
      expect(srcs.length, composition.id).toBeGreaterThanOrEqual(5);
      for (const src of srcs) expect(verified.has(src), `${composition.id}: ${src}`).toBe(true);
      expect(new Set(srcs).size, composition.id).toBe(srcs.length);
    }
  });

  it('records every vertical photo as verified on the list date, with alt text in both languages', () => {
    for (const topic of ['restaurant', 'clinic', 'portfolio', 'realestate', 'events', 'portraits']) {
      const photos = TEMPLATE_PHOTOS[topic] ?? [];
      expect(photos.length, topic).toBeGreaterThan(0);
      for (const entry of photos) {
        expect(entry.src, topic).toMatch(/^https:\/\/images\.(unsplash|pexels)\.com\/.+[?&]w=1600(?:&|$)/u);
        expect(entry.verifiedAt, entry.src).toBe('2026-10-08');
        expect(arabicLetters(entry.alt.en), entry.src).toBe(0);
        expect(latinWords(entry.alt.ar), entry.src).toEqual([]);
        expect(arabicLetters(entry.alt.ar), entry.src).toBeGreaterThan(5);
      }
    }
  });

  it('photographs every team member, dish, listing and project, with alt text', () => {
    for (const composition of compositions) {
      for (const node of Object.values(composition.nodes)) {
        const key =
          node.type === 'team'
            ? 'members'
            : node.type === 'productGrid'
              ? 'products'
              : node.type === 'portfolioGrid'
                ? 'items'
                : undefined;
        if (key === undefined) continue;
        const items = list(node.props[key]);
        expect(items.length, `${composition.id}/${node.id}`).toBeGreaterThan(0);
        for (const item of items) {
          expect(typeof item['imageSrc'], `${composition.id}/${node.id}`).toBe('string');
          expect(text(item['imageAlt']).length, `${composition.id}/${node.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('carries the content each outline promises', () => {
    for (const composition of compositions) {
      const where = composition.id;
      const first = (type: string) => nodesOfType(composition, type)[0];
      switch (baseIdOf(composition)) {
        case 'restaurant': {
          expect(list(first('productGrid')?.props['products']).length, where).toBeGreaterThanOrEqual(8);
          expect(list(first('gallery')?.props['items']), where).toHaveLength(6);
          expect(first('gallery')?.props['layout'], where).toBe('editorial');
          expect(list(first('bento-grid')?.props['items']).map((item) => item['size']), where).toEqual([
            'featured',
            'small',
            'small',
          ]);
          break;
        }
        case 'clinic': {
          expect(list(first('features')?.props['items']), where).toHaveLength(6);
          expect(list(first('processSteps')?.props['steps']), where).toHaveLength(3);
          expect(list(first('team')?.props['members']), where).toHaveLength(4);
          expect(first('formSection'), where).toBeDefined();
          break;
        }
        case 'portfolio-cv': {
          const heroMedia = composition.nodes[`portfolio-${langOf(composition)}-hero-image`];
          expect(heroMedia?.props['ratio'], where).toBe('portrait');
          expect(list(first('portfolioGrid')?.props['items']), where).toHaveLength(6);
          expect(first('processSteps')?.props['layout'], where).toBe('vertical');
          expect(list(first('features')?.props['items']), where).toHaveLength(6);
          break;
        }
        case 'real-estate': {
          const listings = list(first('productGrid')?.props['products']);
          expect(listings, where).toHaveLength(6);
          for (const listing of listings) {
            // "type · beds · baths · area · feature": the area is always a number.
            const parts = text(listing['description']).split('·');
            expect(parts.length, where).toBeGreaterThanOrEqual(4);
            expect(parts[3], where).toMatch(/\d/u);
          }
          expect(list(first('gallery')?.props['items']), where).toHaveLength(6);
          expect(list(first('team')?.props['members']), where).toHaveLength(4);
          break;
        }
        case 'events': {
          expect(list(first('stats')?.props['items']), where).toHaveLength(3);
          const agenda = list(first('processSteps')?.props['steps']);
          expect(agenda, where).toHaveLength(6);
          expect(agenda.every((step) => typeof step['meta'] === 'string'), where).toBe(true);
          expect(list(first('team')?.props['members']), where).toHaveLength(4);
          const plans = nodesOfType(composition, 'pricingPlan');
          expect(plans, where).toHaveLength(3);
          for (const plan of plans) {
            const children = (plan.slots?.['default'] ?? []).map((id) => composition.nodes[id]?.type);
            expect(children, `${where}/${plan.id}`).toContain('cta');
          }
          expect(plans.filter((plan) => plan.props['emphasis'] === 'featured'), where).toHaveLength(1);
          expect(list(first('gallery')?.props['items']), where).toHaveLength(6);
          break;
        }
        default:
          throw new Error(`Unexpected composition ${where}`);
      }
    }
  });

  it('writes every menu, listing and ticket price with money() for the page language', () => {
    for (const { id, type, currency } of PRICED) {
      for (const lang of ['en', 'ar'] as const) {
        const composition = compositions.find((c) => c.id === (lang === 'en' ? id : `${id}-ar`));
        expect(composition, `${id}/${lang}`).toBeDefined();
        if (composition === undefined) continue;
        const prices =
          type === 'pricingPlan'
            ? nodesOfType(composition, type).map((node) => node.props['price'])
            : list(nodesOfType(composition, type)[0]?.props['products']).flatMap((item) =>
                [item['price'], item['originalPrice']].filter((price) => price !== undefined),
              );
        expect(prices.length, composition.id).toBeGreaterThanOrEqual(3);
        for (const price of prices) {
          const shown = text(price);
          const amount = Number(shown.replace(/[^\d.]/gu, '').replace(/^\.+|\.+$/gu, ''));
          expect(shown, composition.id).toBe(money(amount, currency, lang));
        }
      }
    }
  });

  it('never shows block-default copy: every copy prop is set and differs from its default', () => {
    for (const composition of compositions) {
      expect(defaultLeaks(composition, langOf(composition)), composition.id).toEqual([]);
      for (const node of Object.values(composition.nodes)) {
        const defaults = schemaDefaults(node.type);
        if (defaults === undefined) continue;
        for (const [key, fallback] of Object.entries(defaults)) {
          if (typeof fallback !== 'string' || fallback === '') continue;
          if (!COPY_KEY.test(key) && key !== 'name' && key !== 'price') continue;
          const where = `${composition.id}/${node.id}.${key}`;
          expect(node.props[key], where).toBeDefined();
          expect(node.props[key], where).not.toBe(fallback);
        }
      }
    }
  });

  it('never repeats a call-to-action label on a page', () => {
    for (const composition of compositions) {
      const labels = actionLabels(composition);
      expect(labels.length, composition.id).toBeGreaterThanOrEqual(3);
      expect(new Set(labels).size, `${composition.id}: ${labels.join(' | ')}`).toBe(labels.length);
    }
  });

  it('fills every grid it lays out at every column count it passes through', () => {
    for (const composition of compositions) {
      for (const node of Object.values(composition.nodes)) {
        const where = `${composition.id}/${node.id}`;
        const itemsKey = ITEMS_KEY[node.type];
        if (itemsKey === undefined) continue;
        const items = list(node.props[itemsKey]);
        if (node.type === 'gallery' && node.props['layout'] === 'editorial') {
          expect(editorialFills(items), where).toBe(true);
          continue;
        }
        if (node.type === 'faq') {
          if (node.props['layout'] === 'columns') expect(items.length % 2, where).toBe(0);
          continue;
        }
        if (node.type === 'processSteps' && node.props['layout'] === 'vertical') continue;
        const steps = COLUMN_STEPS[node.type]?.[text(node.props['columns'])];
        expect(steps, `${where} columns ${text(node.props['columns'])}`).toBeDefined();
        for (const step of steps ?? []) expect(items.length % step, `${where} @${String(step)}`).toBe(0);
      }
    }
  });

  it('pairs each English template with an Arabic twin of the same shape', () => {
    for (const definition of VERTICAL_DEFINITIONS) {
      const en = definition.build('en');
      const ar = definition.build('ar');
      expect(sectionTypes(ar), definition.key).toEqual(sectionTypes(en));
      expect(Object.keys(ar.nodes).map((id) => id.replace('-ar-', '-en-'))).toEqual(
        Object.keys(en.nodes),
      );
    }
  });
});

describe('vertical template cards', () => {
  const CATEGORIES: Record<string, string> = {
    restaurant: 'restaurant',
    clinic: 'clinic',
    'portfolio-cv': 'portfolio',
    'real-estate': 'realestate',
    events: 'events',
  };

  const cards = marketingTemplateCatalog.filter((card) =>
    compositions.some((composition) => composition.id === card.id),
  );

  it('has exactly one card per vertical composition, in the same order', () => {
    expect(cards.map((card) => card.id)).toEqual(compositions.map((composition) => composition.id));
    expect(marketingTemplateCatalog).toHaveLength(TEMPLATE_COMPOSITIONS.length);
  });

  it('names, describes and files each card in both languages', () => {
    for (const card of cards) {
      const composition = compositions.find((entry) => entry.id === card.id);
      expect(card.category, card.id).toBe(CATEGORIES[card.id.replace(/-ar$/u, '')]);
      expect(card.lang, card.id).toBe(card.id.endsWith('-ar') ? 'ar' : 'en');
      expect(card.sections, card.id).toBe(composition === undefined ? -1 : sectionTypes(composition).length);
      for (const text of [card.name.en, card.name.ar, card.description.en, card.description.ar]) {
        expect(text.length, card.id).toBeGreaterThan(0);
        expect(text.length, `${card.id}: ${text}`).toBeLessThanOrEqual(120);
      }
      expect(arabicLetters(card.name.en + card.description.en), card.id).toBe(0);
      expect(arabicLetters(card.description.ar), card.id).toBeGreaterThan(20);
      expect(composition?.name, card.id).toBe(card.lang === 'ar' ? card.name.ar : card.name.en);
    }
  });

  it('shows the hero photo at w=640 as the thumbnail, alt in the content language', () => {
    for (const card of cards) {
      const composition = compositions.find((entry) => entry.id === card.id);
      const heroImage = Object.values(composition?.nodes ?? {}).find((node) =>
        node.id.endsWith('-hero-image'),
      );
      const heroSrc = text(heroImage?.props['src']);
      expect(card.thumbnail.src, card.id).toBe(thumbnailSrc(heroSrc));
      expect(card.thumbnail.src, card.id).toMatch(/[?&]w=640(?:&|$)/u);
      expect(card.thumbnail.alt, card.id).toBe(heroImage?.props['alt']);
    }
  });
});
