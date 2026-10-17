import { describe, expect, it } from 'vitest';

import { SEO_DESCRIPTION_MAX_PX, SEO_TITLE_MAX_PX, scriptOf, seoMeta, seoTextWidth } from './meta';

describe('seoTextWidth / scriptOf', () => {
  it('measures Arabic narrower per character than Latin and ignores harakat', () => {
    expect(seoTextWidth('ب'.repeat(10))).toBe(100);
    expect(seoTextWidth('b'.repeat(10))).toBe(110);
    expect(seoTextWidth('بَ')).toBe(seoTextWidth('ب'));
    expect(seoTextWidth('b'.repeat(10), 'description')).toBeCloseTo(77);
  });

  it('names the dominant script', () => {
    expect(scriptOf('قهوة مختصة in Amman')).toBe('arabic');
    expect(scriptOf('Fresh coffee')).toBe('latin');
    expect(scriptOf('123 — !')).toBe('other');
  });
});

describe('seoMeta', () => {
  it('clamps an Arabic title by width, not count, and flips the separator', () => {
    // 54 characters: ≈549px in Arabic (fits); the same count in Latin is 594px (does not).
    const arabic = 'قهوة مختصة '.repeat(5).trim();
    const width = seoTextWidth(arabic);
    expect(width).toBeLessThanOrEqual(SEO_TITLE_MAX_PX);
    expect(Array.from(arabic).length).toBeGreaterThan(Math.floor(SEO_TITLE_MAX_PX / 11));
    const fitted = seoMeta({ title: arabic, lang: 'ar' });
    expect(fitted.title).toBe(arabic);
    expect(fitted.issues.map((issue) => issue.code)).not.toContain('title-truncated');

    const latin = 'x'.repeat(Array.from(arabic).length);
    expect(seoMeta({ title: latin, lang: 'en' }).issues.map((i) => i.code)).toContain('title-truncated');

    const flipped = seoMeta({ title: 'قهوة مختصة محمصة يومياً', lang: 'ar', template: '%s › قهوة' });
    expect(flipped.title).toBe('قهوة مختصة محمصة يومياً ‹ قهوة');
  });

  it('cuts an English title at a word boundary with no dangling punctuation and drops the site name first', () => {
    const title =
      'Specialty coffee roasted every morning, brewed by hand, served all day in Amman and';
    const result = seoMeta({ title, lang: 'en', siteName: 'Qahwa Roasters' });
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['title-suffix-dropped', 'title-truncated']),
    );
    expect(seoTextWidth(result.title)).toBeLessThanOrEqual(SEO_TITLE_MAX_PX);
    expect(title.startsWith(result.title)).toBe(true);
    expect(result.title).not.toMatch(/[\s,;:|-]$/u);
    expect(result.title).not.toMatch(/\band$/u);
  });

  it('fills a missing title and description from the h1 and lead (ar)', () => {
    const result = seoMeta({
      lang: 'ar',
      h1: 'قهوة تُحمّص كل صباح',
      lead: 'محمصة صغيرة في جبل عمّان تقدّم قهوة مختصة من مزارع إثيوبيا وكولومبيا، مع حلويات تُخبز يومياً في مطبخنا.',
      siteName: 'بيت البن',
    });
    expect(result.title).toBe('قهوة تُحمّص كل صباح | بيت البن');
    expect(result.description.startsWith('محمصة صغيرة')).toBe(true);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain('title-filled');
    expect(codes).toContain('description-filled');
  });

  it('cuts a long English description inside the budget and flags a wrong-script title', () => {
    const sentence = 'We roast small batches of single-origin beans every morning in our shop. ';
    const result = seoMeta({ title: 'مقهى', description: sentence.repeat(4), lang: 'en' });
    expect(seoTextWidth(result.description, 'description')).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX_PX);
    expect(result.description.endsWith('.')).toBe(true);
    expect(result.issues.map((i) => i.code)).toContain('title-script');
  });
});
