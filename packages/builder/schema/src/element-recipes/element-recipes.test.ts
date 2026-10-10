import { describe, expect, it } from 'vitest';
import { customCodeClassNames, customCodeTreeSchema } from '../custom-code/custom-code-tree';
import { unknownUtilityClasses } from '../custom-code/utility-vocabulary';
import { buildElementRecipe, ELEMENT_RECIPE_CATALOG, ELEMENT_RECIPE_IDS, elementRecipeContentSchema } from './index';

describe('shared element recipes', () => {
  it('has one bilingual, searchable catalog entry per recipe', () => {
    expect(ELEMENT_RECIPE_CATALOG.map(({ id }) => id)).toEqual(ELEMENT_RECIPE_IDS);
    expect(new Set(ELEMENT_RECIPE_IDS).size).toBe(8);
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
});
