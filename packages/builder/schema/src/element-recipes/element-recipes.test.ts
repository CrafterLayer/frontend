import { describe, expect, it } from 'vitest';
import { customCodeClassNames, customCodeTreeSchema } from '../custom-code/custom-code-tree';
import { unknownUtilityClasses } from '../custom-code/utility-vocabulary';
import { buildElementRecipe, ELEMENT_RECIPE_CATALOG, ELEMENT_RECIPE_IDS, elementRecipeContentSchema } from './index';

describe('shared element recipes', () => {
  it('has one bilingual, searchable catalog entry per recipe', () => {
    expect(ELEMENT_RECIPE_CATALOG.map(({ id }) => id)).toEqual(ELEMENT_RECIPE_IDS);
    expect(new Set(ELEMENT_RECIPE_IDS).size).toBe(9);
    for (const entry of ELEMENT_RECIPE_CATALOG) {
      expect(entry.labels.ar).toMatch(/[\u0600-\u06ff]/u);
      expect(entry.description.en.length).toBeGreaterThan(10);
    }
  });
  it.each(['ar', 'en'] as const)('every preset passes the static tree and class doors in %s', (locale) => {
    for (const id of ELEMENT_RECIPE_IDS) {
      for (const palette of ['site', 'page'] as const) {
        const tree = { kind: 'root', children: [buildElementRecipe(id, locale, {}, palette)] };
        expect(customCodeTreeSchema.safeParse(tree).success, `${id}/${palette}`).toBe(true);
        expect(customCodeClassNames(tree).flatMap(unknownUtilityClasses), id).toEqual([]);
      }
    }
  });
  it('does not invent metrics, endorsements or contact links in a blank preset', () => {
    const metric = JSON.stringify(buildElementRecipe('metric-card', 'en'));
    expect(metric).toContain('verified number');
    expect(metric).not.toContain('99%');
    expect(JSON.stringify(buildElementRecipe('quote-card', 'ar'))).toContain('إذن نشره');
    expect(JSON.stringify(buildElementRecipe('contact-card', 'en'))).not.toContain('href');
  });
  it('keeps text as data, emits semantic lists, and stacks layouts on phones', () => {
    const tree = buildElementRecipe('process-steps', 'ar', { items: [{ title: '<script>alert(1)</script>', text: 'تفاصيل' }] });
    expect(tree.tag).toBe('ol');
    expect(tree.className).toContain('max-md:grid-cols-1');
    expect(tree.children).toHaveLength(1);
    expect(JSON.stringify(tree)).toContain('<script>alert(1)</script>');
    expect(buildElementRecipe('bento-grid', 'ar').className).toContain('max-md:grid-cols-1');
  });
  it('bounds content and refuses unknown keys, empty lists and oversized inputs', () => {
    for (const value of [{ items: [] }, { items: Array.from({ length: 9 }, () => ({ title: 'a' })) }, { text: 'x'.repeat(501) }, { script: 'alert(1)' }]) {
      expect(elementRecipeContentSchema.safeParse(value).success).toBe(false);
    }
  });
  it('builds a semantic, responsive data table from the shared content shape', () => {
    const tree = buildElementRecipe('data-table', 'ar', {
      title: 'أسعار الباقات',
      text: 'الأسعار شاملة الضريبة.',
      label: 'الباقة | السعر | المستخدمون',
      items: [{ title: 'الأساسية', text: '٤٩ ر.س | ١' }, { title: 'الاحترافية', text: '١٤٩ ر.س | ٥' }, { title: 'المؤسسات', text: 'تواصل معنا' }],
    });
    expect(tree.tag).toBe('div');
    expect(tree.attributes).toEqual({ role: 'region', 'aria-label': 'أسعار الباقات', tabindex: '0' });
    expect(tree.className).toContain('overflow-x-auto');
    const table = tree.children?.[0];
    expect(table?.kind === 'element' ? table.tag : undefined).toBe('table');
    const json = JSON.stringify(tree);
    expect(json).toContain('"tag":"caption"');
    expect(json).toContain('الأسعار شاملة الضريبة.');
    const cellsOf = (tag: 'th' | 'td') => [...json.matchAll(new RegExp(`"tag":"${tag}","className":"([^"]*)","attributes":\\{"scope":"(\\w+)"\\},"text":"([^"]*)"|"tag":"${tag}","className":"([^"]*)","text":"([^"]*)"`, 'gu'))];
    const headers = cellsOf('th').map((match) => [match[2], match[3]]);
    expect(headers.slice(0, 3)).toEqual([['col', 'الباقة'], ['col', 'السعر'], ['col', 'المستخدمون']]);
    expect(headers.slice(3)).toEqual([['row', 'الأساسية'], ['row', 'الاحترافية'], ['row', 'المؤسسات']]);
    /* "تواصل معنا" is no number, so the price column stays at the start; the seats column is numeric. */
    const cells = cellsOf('td').map((match) => [match[5], match[4]]);
    expect(cells[0]).toEqual(['٤٩ ر.س', 'px-4 py-3 text-start']);
    expect(cells[1]).toEqual(['١', 'px-4 py-3 text-end tabular-nums']);
    expect(cells.find(([text]) => text === '')).toBeDefined();
  });
  it('aligns a numeric column to the end and names a blank table without inventing figures', () => {
    const priced = JSON.stringify(buildElementRecipe('data-table', 'en', { items: [{ title: 'Basic', text: '$9' }, { title: 'Pro', text: '$1,240' }] }));
    expect(priced).toContain('"className":"px-4 py-3 font-semibold whitespace-nowrap text-end tabular-nums","attributes":{"scope":"col"},"text":"Details"');
    const blank = buildElementRecipe('data-table', 'en');
    expect(blank.attributes?.['aria-label']).toBe('Data table');
    const words = [...JSON.stringify(blank).matchAll(/"text":"([^"]*)"/gu)].map((match) => match[1]);
    expect(words).toContain('First item');
    expect(words.join(' ')).not.toMatch(/\d/u);
  });
});
