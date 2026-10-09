import { describe, expect, it } from 'vitest';

import {
  compositionIdFor,
  digits,
  footer,
  header,
  ids,
  money,
  nodes,
  photo,
  thumbnailSrc,
} from './build';
import { TEMPLATE_COMPOSITIONS, TEMPLATE_DEFINITIONS } from './index';
import { TEMPLATE_PHOTOS } from './photos';
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
} from './test-helpers';
import type { TemplateLang } from './types';

/*
  templates-core (agent-script DESIGN §B.1–§B.3): the four core templates in
  English and Arabic, checked against the quality bar as data. Rendering at
  390–1440 px in light and dark is the end-of-program capture's job.
*/

const CORE_IDS = ['saas-launch', 'creative-agency', 'commerce-launch', 'professional-services'];

const byLang = (lang: TemplateLang) =>
  TEMPLATE_DEFINITIONS.slice(0, 4).map((definition) => definition.build(lang));

const coreCompositions = TEMPLATE_COMPOSITIONS.filter((composition) =>
  CORE_IDS.some((id) => composition.id === id || composition.id === `${id}-ar`),
);

describe('template helpers (build.ts)', () => {
  it('prefixes ids per template and language', () => {
    expect(ids('saas-en')('hero')).toBe('saas-en-hero');
    expect(compositionIdFor('saas-launch', 'en')).toBe('saas-launch');
    expect(compositionIdFor('saas-launch', 'ar')).toBe('saas-launch-ar');
  });

  it('writes prices the way each market reads them, with Latin digits', () => {
    expect(money(8, 'JOD', 'ar')).toBe('8 د.أ');
    expect(money(8, 'JOD', 'en')).toBe('JOD 8');
    expect(money(8, 'USD', 'en')).toBe('$8');
    expect(money(1250, 'SAR', 'ar')).toBe('1,250 ر.س');
    expect(money(1250, 'SAR', 'en')).toBe('SAR 1,250');
    expect(digits('ar')(1250)).toBe('1,250');
    expect(digits('ar', { arabicIndic: true })(1250.5)).toBe('١٬٢٥٠٫٥');
    expect(digits('en', { arabicIndic: true })(42)).toBe('42');
  });

  it('returns a verified photo with alt text in the content language, and throws on a typo', () => {
    const first = photo('people', 0, 'ar');
    expect(first.src).toBe(TEMPLATE_PHOTOS['people']?.[0]?.src);
    expect(arabicLetters(first.alt)).toBeGreaterThan(0);
    expect(arabicLetters(photo('people', 0, 'en').alt)).toBe(0);
    expect(() => photo('people', 999, 'en')).toThrow(/does not exist/u);
    expect(() => photo('nope', 0, 'en')).toThrow(/Unknown template photo topic/u);
    expect(thumbnailSrc('https://x.test/a.jpg?auto=format&w=1600&q=80')).toBe(
      'https://x.test/a.jpg?auto=format&w=640&q=80',
    );
  });

  it('builds a header (brand, navigation, one action) and a footer with a ruled legal line', () => {
    const top = header(
      {
        prefix: 't-en',
        brand: 'Brand',
        nav: [{ label: 'Work', href: '#work' }],
        cta: { label: 'Go', href: '#go' },
      },
      'en',
    );
    const headerNode = top.nodes[top.rootId];
    expect(headerNode?.type).toBe('pageHeader');
    expect(headerNode?.props['width']).toBe('wide');
    expect(headerNode?.slots).toEqual({
      start: ['t-en-brand'],
      center: ['t-en-nav'],
      end: ['t-en-header-cta'],
    });
    expect(top.nodes['t-en-nav']?.type).toBe('navLinks');

    const bottom = footer(
      {
        prefix: 't-ar',
        brand: 'العلامة',
        tagline: 'سطر تعريفي.',
        columns: [{ title: 'روابط', links: [{ label: 'الرئيسية', href: '#top' }] }],
      },
      'ar',
    );
    const footerNode = bottom.nodes[bottom.rootId];
    expect(footerNode?.type).toBe('pageFooter');
    expect(footerNode?.props['bottomBar']).toBe(true);
    const legal = JSON.stringify(bottom.nodes['t-ar-footer-legal']?.props);
    expect(legal).toContain('جميع الحقوق محفوظة');
  });

  it('refuses chrome copy in the wrong language and a node id used twice', () => {
    expect(() =>
      header({ prefix: 'x', brand: 'B', nav: [{ label: 'أعمالنا', href: '#w' }] }, 'en'),
    ).toThrow(/English header link/u);
    expect(() =>
      header({ prefix: 'x', brand: 'ب', nav: [{ label: 'Work', href: '#w' }] }, 'ar'),
    ).toThrow(/Arabic header link/u);
    const page = nodes('dup');
    page.add('a', 'cta', {});
    expect(() => page.add('a', 'cta', {})).toThrow(/used twice/u);
  });
});

describe('core templates (DESIGN §B.3)', () => {
  it('ships 8 compositions: the 4 historical English ids plus their Arabic twins', () => {
    expect(coreCompositions.map((composition) => composition.id)).toEqual([
      'saas-launch',
      'saas-launch-ar',
      'creative-agency',
      'creative-agency-ar',
      'commerce-launch',
      'commerce-launch-ar',
      'professional-services',
      'professional-services-ar',
    ]);
  });

  it.each(coreCompositions.map((composition) => [composition.id, composition] as const))(
    '%s inserts as one transaction, validates, and undoes exactly',
    (_id, composition) => {
      const result = insertAndValidate(composition);
      expect(result.insertedId).toBeDefined();
      expect(result.transactions).toBe(1);
      expect(result.violations).toEqual([]);
      expect(result.undoRestores).toBe(true);
    },
  );

  it('uses unique composition ids and unique node ids across every composition', () => {
    const compositionIds = TEMPLATE_COMPOSITIONS.map((composition) => composition.id);
    expect(new Set(compositionIds).size).toBe(compositionIds.length);
    const nodeIds = TEMPLATE_COMPOSITIONS.flatMap((composition) => Object.keys(composition.nodes));
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    for (const composition of coreCompositions) {
      for (const [key, node] of Object.entries(composition.nodes)) expect(node.id).toBe(key);
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

  it('opens with the header (an announcement bar may sit above it) and closes with the footer', () => {
    for (const composition of coreCompositions) {
      const types = sectionTypes(composition);
      const headerAt = types.indexOf('pageHeader');
      expect(
        headerAt === 0 || (headerAt === 1 && types[0] === 'announcementBar'),
        composition.id,
      ).toBe(true);
      expect(types.at(-1), composition.id).toBe('pageFooter');
      expect(
        types.filter((type) => type === 'pageHeader'),
        composition.id,
      ).toHaveLength(1);
      expect(
        types.filter((type) => type === 'pageFooter'),
        composition.id,
      ).toHaveLength(1);
      expect(types.length, composition.id).toBeGreaterThanOrEqual(9);
    }
  });

  it('gives every section the same content width', () => {
    for (const composition of coreCompositions) {
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

  it('uses only verified photos and never repeats one on a page', () => {
    const verified = templatePhotoSrcs();
    for (const composition of coreCompositions) {
      const srcs = collectImageSrcs(composition);
      expect(srcs.length, composition.id).toBeGreaterThan(0);
      for (const src of srcs) expect(verified.has(src), `${composition.id}: ${src}`).toBe(true);
      expect(new Set(srcs).size, composition.id).toBe(srcs.length);
    }
  });

  it('photographs every person and product, with alt text', () => {
    for (const composition of coreCompositions) {
      for (const node of Object.values(composition.nodes)) {
        const list =
          node.type === 'team'
            ? node.props['members']
            : node.type === 'productGrid'
              ? node.props['products']
              : undefined;
        if (!Array.isArray(list)) continue;
        expect(list.length, `${composition.id}/${node.id}`).toBeGreaterThan(0);
        for (const item of list) {
          const entry = item as Record<string, unknown>;
          const alt = entry['imageAlt'];
          expect(typeof entry['imageSrc'], `${composition.id}/${node.id}`).toBe('string');
          expect(typeof alt === 'string' && alt.length > 0, `${composition.id}/${node.id}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('never leaks block-default copy (headings, bodies, eyebrows, English labels, default rows)', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const composition of byLang(lang)) {
        expect(defaultLeaks(composition, lang), composition.id).toEqual([]);
      }
    }
  });

  it('never repeats a call-to-action label on a page', () => {
    for (const composition of coreCompositions) {
      const labels = actionLabels(composition);
      expect(labels.length, composition.id).toBeGreaterThanOrEqual(3);
      expect(new Set(labels).size, `${composition.id}: ${labels.join(' | ')}`).toBe(labels.length);
    }
  });

  it('fills every grid it lays out (no empty cell at 2, 3 or 4 columns)', () => {
    for (const composition of coreCompositions) {
      for (const node of Object.values(composition.nodes)) {
        const where = `${composition.id}/${node.id}`;
        if (node.type === 'productGrid' || node.type === 'portfolioGrid') {
          const items = (node.props['products'] ?? node.props['items']) as unknown[];
          expect(items.length % 6, where).toBe(0);
        }
        if (node.type === 'team') {
          expect((node.props['members'] as unknown[]).length % 4, where).toBe(0);
        }
        if (node.type === 'testimonials' && node.props['columns'] === '2') {
          expect((node.props['items'] as unknown[]).length % 2, where).toBe(0);
        }
        if (node.type === 'bento-grid') {
          const sizes = (node.props['items'] as { size: string }[]).map((item) => item.size);
          expect(sizes, where).toEqual(['featured', 'tall', 'small', 'wide']);
        }
        if (node.type === 'features' && node.props['columns'] === '3') {
          expect((node.props['items'] as unknown[]).length % 6, where).toBe(0);
        }
        if (node.type === 'faq' && node.props['layout'] === 'columns') {
          expect((node.props['items'] as unknown[]).length % 2, where).toBe(0);
        }
      }
    }
  });

  it('pairs each English template with an Arabic twin of the same shape', () => {
    for (const definition of TEMPLATE_DEFINITIONS.slice(0, 4)) {
      const en = definition.build('en');
      const ar = definition.build('ar');
      expect(sectionTypes(ar), definition.key).toEqual(sectionTypes(en));
      expect(Object.keys(ar.nodes).map((id) => id.replace('-ar-', '-en-'))).toEqual(
        Object.keys(en.nodes),
      );
    }
  });
});
