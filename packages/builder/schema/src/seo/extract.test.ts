import { describe, expect, it } from 'vitest';

import { extractSeoContent } from './extract';
import { seoFixture } from './fixtures.test-helpers';

describe('extractSeoContent', () => {
  it('reads an Arabic page: headings in order, image, link text, FAQ from details/summary, price', () => {
    const content = extractSeoContent(seoFixture('ar'));
    expect(content.lang).toBe('ar');
    expect(content.title).toBe('الرئيسية');
    expect(content.headings.map((h) => [h.level, h.text])).toEqual([
      [1, 'قهوة تُحمّص كل صباح'],
      [2, 'أسئلة شائعة'],
      [3, 'لاتيه'],
    ]);
    expect(content.images).toEqual([
      expect.objectContaining({ src: 'https://img.example/hero.jpg', alt: 'فنجان قهوة', decorative: false, loading: 'eager' }),
    ]);
    expect(content.links).toEqual([{ href: '#menu', text: 'اقرأ المزيد', nodeId: 'hero' }]);
    expect(content.faqs).toEqual([{ question: 'هل لديكم حليب نباتي؟', answer: 'نعم، حليب الشوفان واللوز.' }]);
    expect(content.firstParagraph).toBe('محمصة صغيرة في جبل عمّان تقدّم قهوة مختصة.');
    expect(content.prices).toEqual([
      expect.objectContaining({ amount: 3.5, currency: 'JOD', label: 'لاتيه' }),
    ]);
    // A node not reachable from the root is not on the page.
    expect(content.headings.some((h) => h.text === 'orphan')).toBe(false);
  });

  it('reads an English page the same way', () => {
    const content = extractSeoContent(seoFixture('en'));
    expect(content.faqs).toEqual([{ question: 'Do you have oat milk?', answer: 'Yes, oat and almond.' }]);
    expect(content.prices[0]).toEqual(expect.objectContaining({ amount: 4.5, currency: 'USD', label: 'Latte' }));
    expect(content.links[0]?.text).toBe('Read more');
  });
});
