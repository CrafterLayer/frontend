import { describe, expect, it } from 'vitest';

import { PHOTO_CATALOG, SECTION_KITS } from '@craftkit/builder';

import {
  KIT_SUMMARY_AR,
  PAGE_KIT_MARKER,
  kitPlaceholders,
  libraryMoney,
  librarySections,
  namedPlaceholder,
} from './library-sections';

const LANGS = ['en', 'ar'] as const;
const ARABIC_LETTER = /[؀-ۿ]/u;
const LATIN_LETTER = /[A-Za-z]/u;
const EMAIL_OR_URL = /^(?:[\w.+-]+@[\w.-]+|https?:\/\/\S+|mailto:\S+|tel:\S+|#\S*)$/u;

interface Leaf {
  readonly path: readonly string[];
  readonly value: string;
}

/** Every string inside slot values, with the slot names that lead to it (list indexes dropped). */
function leaves(value: unknown, path: readonly string[] = []): Leaf[] {
  if (typeof value === 'string') return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((item) => leaves(item, path));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
  }
  return [];
}

const key = (leaf: Leaf) => leaf.path.at(-1) ?? '';

/** Placeholder words a person reads — not addresses, icon names, photo data or by-design repeats. */
function wordsOf(values: Record<string, unknown>): Leaf[] {
  return leaves(values).filter((leaf) => {
    const name = key(leaf);
    if (['href', 'icon', 'src', 'alt', 'period'].includes(name)) return false;
    // A comparison table repeats "Included" / "—" by design; its cells are not placeholders.
    if (leaf.path.join('.').endsWith('rows.values.value')) return false;
    return true;
  });
}

/** Every text node of an instantiated tree. */
function treeTexts(node: unknown): string[] {
  if (typeof node !== 'object' || node === null) return [];
  const record = node as { text?: unknown; children?: unknown[] };
  const own = typeof record.text === 'string' ? [record.text] : [];
  return [...own, ...(record.children ?? []).flatMap(treeTexts)];
}

describe('librarySections (the Library Sections tab)', () => {
  it('fills every section kit in both languages, as a region tree', () => {
    for (const lang of LANGS) {
      const sections = librarySections(lang);
      expect(sections).toHaveLength(SECTION_KITS.length);
      for (const section of sections) {
        expect(section.tree.kind).toBe('root');
        expect(section.tree.children.length).toBeGreaterThan(0);
      }
    }
    expect(librarySections('ar')[0]?.group).toMatch(/[؀-ۿ]/u);
  });

  it('never writes "Feature 0", and numbers a fallback placeholder from 1', () => {
    for (const lang of LANGS) {
      for (const section of librarySections(lang)) {
        const text = JSON.stringify(section.tree);
        expect(text, section.id).not.toMatch(/Feature \d|ميزة \d/u);
        for (const leaf of treeTexts(section.tree)) {
          expect(leaf, `${section.id}: a standalone 0`).not.toMatch(/(^|\D)0(\D|$)/u);
          // Nothing was cut to fit its slot.
          expect(leaf, `${section.id}: clamped`).not.toContain('…');
        }
      }
    }
    expect(namedPlaceholder('title', 'en', 1)).toBe('A clear headline 1');
    expect(namedPlaceholder('title', 'ar', 1)).toBe('عنوان واضح 1');
    expect(namedPlaceholder('question', 'en', 2)).toBe('A question customers ask 2?');
    const steps = kitPlaceholders(SECTION_KITS.find((kit) => kit.id === 'steps-timeline')!, 'en');
    expect((steps['items'] as { step: string }[]).map((item) => item.step)).toEqual(['Step 1', 'Step 2', 'Step 3']);
  });

  it('no placeholder string repeats inside one kit', () => {
    for (const lang of LANGS) {
      for (const kit of SECTION_KITS) {
        const words = wordsOf(kitPlaceholders(kit, lang)).map((leaf) => leaf.value);
        const repeated = words.filter((word, at) => words.indexOf(word) !== at);
        expect({ kit: kit.id, lang, repeated }).toEqual({ kit: kit.id, lang, repeated: [] });
      }
    }
  });

  it('price slots hold formatted prices: $29 in English, 29 د.أ in Arabic', () => {
    expect(libraryMoney(29, 'en')).toBe('$29');
    expect(libraryMoney(420000, 'ar')).toBe('420,000 د.أ');
    expect(libraryMoney(4.5, 'en')).toBe('$4.50');
    const pattern = { en: /^\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/u, ar: /^\d{1,3}(?:,\d{3})*(?:\.\d{2})? د\.أ$/u };
    let seen = 0;
    for (const lang of LANGS) {
      for (const kit of SECTION_KITS) {
        for (const leaf of leaves(kitPlaceholders(kit, lang)).filter((item) => key(item) === 'price')) {
          seen += 1;
          expect(leaf.value, `${kit.id} ${lang}`).toMatch(pattern[lang]);
        }
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('English sections carry no Arabic; Arabic sections are Arabic (Latin only in an address)', () => {
    for (const kit of SECTION_KITS) {
      for (const leaf of leaves(kitPlaceholders(kit, 'en'))) {
        expect(leaf.value, `${kit.id} en ${leaf.path.join('.')}`).not.toMatch(ARABIC_LETTER);
      }
      for (const leaf of wordsOf(kitPlaceholders(kit, 'ar'))) {
        if (EMAIL_OR_URL.test(leaf.value)) continue;
        expect(leaf.value, `${kit.id} ar ${leaf.path.join('.')}`).not.toMatch(LATIN_LETTER);
      }
    }
    for (const section of librarySections('ar')) {
      expect(section.nameAr, section.id).toMatch(ARABIC_LETTER);
      expect(section.nameAr, section.id).not.toMatch(LATIN_LETTER);
      for (const text of treeTexts(section.tree)) {
        if (EMAIL_OR_URL.test(text.trim())) continue;
        expect(text, section.id).not.toMatch(LATIN_LETTER);
      }
    }
    for (const kit of SECTION_KITS) expect(KIT_SUMMARY_AR[kit.id], kit.id).toBeDefined();
  });

  it('every entry carries the page kit its classes need', () => {
    for (const lang of LANGS) {
      for (const section of librarySections(lang)) {
        expect(section.pageKit?.marker, section.id).toBe(PAGE_KIT_MARKER);
        expect(section.pageKit?.css, section.id).toContain(PAGE_KIT_MARKER);
        // The kit's own tokens and classes, within the page root's pageCss limit.
        expect(section.pageKit?.css).toContain('--ck-');
        expect(section.pageKit?.css).toContain('.ck-btn');
        expect(section.pageKit?.css.length ?? 0).toBeLessThan(20_000);
      }
    }
    // An Arabic page kit sets Arabic-capable faces.
    expect(librarySections('ar')[0]?.pageKit?.css).not.toBe(librarySections('en')[0]?.pageKit?.css);
  });

  it('photos are verified catalog photos, never repeated inside one kit', () => {
    const catalog = new Set(PHOTO_CATALOG.map((entry) => entry.url));
    for (const lang of LANGS) {
      for (const kit of SECTION_KITS) {
        const photos = leaves(kitPlaceholders(kit, lang))
          .filter((leaf) => key(leaf) === 'src')
          .map((leaf) => leaf.value);
        expect(new Set(photos).size, `${kit.id} repeats a photo`).toBe(photos.length);
        for (const src of photos) expect(catalog.has(src), `${kit.id}: ${src}`).toBe(true);
      }
    }
    // A team shows real portraits, not initial boxes.
    const team = kitPlaceholders(SECTION_KITS.find((kit) => kit.id === 'team-grid')!, 'en');
    expect((team['items'] as { image?: unknown }[]).every((item) => item.image !== undefined)).toBe(true);
  });

  it('list counts fill the layout: no empty grid cell beside a lead tile', () => {
    const count = (id: string) =>
      (kitPlaceholders(SECTION_KITS.find((kit) => kit.id === id)!, 'en')['items'] as unknown[]).length;
    // 3 columns, the lead card spans 2×2: 4 + 2 cells = two full rows.
    expect((4 + count('features-lead')) % 3).toBe(0);
    // 3×2, the photo spans 2×2: two items close the last column.
    expect(count('features-bento')).toBe(2);
    // 4 columns (2 on a phone), the first tile spans 2×2: 4 + (n − 1) cells close the rows.
    expect((4 + count('gallery-mosaic') - 1) % 4).toBe(0);
    expect(count('stats-row') % 4).toBe(0);
    expect(count('pricing-tiers')).toBe(3);
  });
});
