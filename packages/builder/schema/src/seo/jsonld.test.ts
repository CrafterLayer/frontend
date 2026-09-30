import { describe, expect, it } from 'vitest';

import { extractSeoContent } from './extract';
import { seoFixture } from './fixtures.test-helpers';
import { buildJsonLdGraph, deriveSchemaKinds, serializeJsonLd, type JsonLdObject } from './jsonld';
import type { SiteSeo } from './schema';

const site: SiteSeo = {
  origin: 'https://qahwa.example',
  siteName: 'قهوة',
  business: {
    type: 'CafeOrCoffeeShop',
    name: 'قهوة',
    telephone: '+962 7 9000 0000',
    whatsapp: '+962 79 123 4567',
    address: { street: 'شارع الرينبو 12', city: 'عمّان', country: 'JO' },
    openingHours: ['Sa-Th 08:00-23:00'],
    servesCuisine: ['قهوة مختصة'],
  },
};

function byType(graph: JsonLdObject[], type: string): JsonLdObject | undefined {
  return graph.find((node) => node['@type'] === type);
}

describe('buildJsonLdGraph', () => {
  it('builds an Arabic café graph and omits every facts-ledger sample value', () => {
    const content = extractSeoContent(seoFixture('ar'));
    const graph = buildJsonLdGraph({
      site,
      page: {
        title: 'قائمة الطعام',
        lang: 'ar',
        path: '/قائمة',
        seo: { schemaKinds: ['FAQPage', 'Menu'], samples: ['+962 7 9000 0000', 'شارع الرينبو 12'] },
      },
      content,
    });
    const nodes = graph['@graph'];
    expect(graph['@context']).toBe('https://schema.org');
    const cafe = byType(nodes, 'CafeOrCoffeeShop');
    expect(cafe).toBeDefined();
    expect(cafe?.['telephone']).toBeUndefined();
    expect(JSON.stringify(graph)).not.toContain('الرينبو');
    expect(JSON.stringify(graph)).not.toContain('9000 0000');
    expect(cafe?.['openingHours']).toEqual(['Sa-Th 08:00-23:00']);
    expect(cafe?.['contactPoint']).toEqual(
      expect.objectContaining({ '@type': 'ContactPoint', url: 'https://wa.me/962791234567' }),
    );
    expect(byType(nodes, 'WebPage')?.['inLanguage']).toBe('ar');
    const crumbs = byType(nodes, 'BreadcrumbList')?.['itemListElement'] as JsonLdObject[];
    expect(crumbs.map((item) => item['name'])).toEqual(['قهوة', 'قائمة الطعام']);
    expect(crumbs[1]?.['item']).toBe(`https://qahwa.example/${encodeURIComponent('قائمة')}`);
    expect(byType(nodes, 'FAQPage')).toBeDefined();
    expect(byType(nodes, 'Menu')?.['hasMenuItem']).toEqual([
      expect.objectContaining({ name: 'لاتيه', offers: { '@type': 'Offer', price: '3.5', priceCurrency: 'JOD' } }),
    ]);
  });

  it('skips LocalBusiness without an address city and skips FAQ/Menu kinds not asked for (en)', () => {
    const graph = buildJsonLdGraph({
      site: { origin: 'https://shop.example', business: { type: 'Store', name: 'Brew Shop' } },
      page: { title: 'Home', lang: 'en', path: '/' },
      content: extractSeoContent(seoFixture('en')),
    });
    const types = graph['@graph'].map((node) => node['@type']);
    expect(types).not.toContain('Store');
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).not.toContain('FAQPage');
    expect(types).not.toContain('Menu');
    expect(types).not.toContain('BreadcrumbList');
  });

  it('drops the business entirely when its name is a sample', () => {
    const graph = buildJsonLdGraph({
      site: { business: { type: 'Restaurant', name: 'Sample Bistro', address: { city: 'Leeds', country: 'GB' } } },
      page: { lang: 'en', seo: { samples: ['Sample Bistro'] } },
    });
    expect(JSON.stringify(graph)).not.toContain('Sample Bistro');
    expect(graph['@graph'].map((n) => n['@type'])).toEqual(['WebPage']);
  });
});

describe('serializeJsonLd', () => {
  it('neutralises </script> and <!-- in page text', () => {
    const out = serializeJsonLd({ '@type': 'Thing', name: '</script><script>alert(1)</script><!-- x' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<!--');
    expect(JSON.parse(out)).toEqual({ '@type': 'Thing', name: '</script><script>alert(1)</script><!-- x' });
  });
});

describe('deriveSchemaKinds', () => {
  const faq = { question: 'هل توصلون؟', answer: 'نعم.' };
  const price = { text: '3.5 د.أ', amount: 3.5, currency: 'JOD', label: 'قهوة عربية' };
  it('asks for FAQPage from FAQ pairs, Menu from a food business’s prices, Product from a store’s', () => {
    expect(deriveSchemaKinds({ faqs: [faq], prices: [] })).toEqual(['FAQPage']);
    expect(deriveSchemaKinds({ faqs: [faq], prices: [price] }, 'Restaurant')).toEqual(['FAQPage', 'Menu']);
    expect(deriveSchemaKinds({ faqs: [], prices: [price] }, 'Store')).toEqual(['Product']);
  });
  it('claims nothing the content cannot back', () => {
    expect(deriveSchemaKinds({ faqs: [], prices: [] }, 'Restaurant')).toEqual([]);
    expect(deriveSchemaKinds({ faqs: [], prices: [{ text: '$' }] }, 'Restaurant')).toEqual([]);
    expect(deriveSchemaKinds({ faqs: [], prices: [price] })).toEqual([]);
  });
});
