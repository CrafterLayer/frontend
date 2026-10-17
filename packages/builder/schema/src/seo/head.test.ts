import { describe, expect, it } from 'vitest';

import { buildSeoHead, ogLocale } from './head';
import type { PageSeo, SiteSeo } from './schema';

const site: SiteSeo = {
  origin: 'https://qahwa.example',
  siteName: 'قهوة',
  titleTemplate: '%s | قهوة',
  defaultImage: 'https://img.example/og.jpg',
};

describe('buildSeoHead', () => {
  it('writes the Arabic head with reciprocal hreflang, Unicode canonical and the default image', () => {
    const arPage: PageSeo = { alternates: [{ lang: 'en', path: '/en/menu' }], site };
    const enPage: PageSeo = { alternates: [{ lang: 'ar', path: '/قائمة' }], site };
    const ar = buildSeoHead({ title: 'قائمة الطعام', description: 'قهوة مختصة وحلويات يومية.', lang: 'ar', path: '/قائمة', page: arPage });
    const en = buildSeoHead({ title: 'Menu', description: 'Specialty coffee.', lang: 'en', path: '/en/menu', page: enPage });
    const arUrl = `https://qahwa.example/${encodeURIComponent('قائمة')}`;
    const enUrl = 'https://qahwa.example/en/menu';

    expect(ar).toContain('<title>قائمة الطعام | قهوة</title>');
    expect(ar).toContain(`<link rel="canonical" href="${arUrl}">`);
    expect(ar).toContain('<meta property="og:locale" content="ar_AR">');
    expect(ar).toContain('<meta property="og:locale:alternate" content="en_US">');
    expect(ar).toContain('<meta property="og:image" content="https://img.example/og.jpg">');
    expect(ar).toContain('<meta name="twitter:card" content="summary_large_image">');
    // Reciprocal: each page names itself and the other.
    for (const head of [ar, en]) {
      expect(head).toContain(`<link rel="alternate" href="${arUrl}" hreflang="ar">`);
      expect(head).toContain(`<link rel="alternate" href="${enUrl}" hreflang="en">`);
      expect(head).toContain('hreflang="x-default"');
    }
    expect(ar).toContain('<script type="application/ld+json">');
  });

  it('escapes a </script> injection and honours noIndex (en)', () => {
    const head = buildSeoHead({
      title: 'Menu</script><script>alert(1)</script>',
      description: '"><img src=x onerror=alert(1)>',
      lang: 'en',
      path: '/menu',
      site: { origin: 'https://shop.example', siteName: 'Shop', business: { type: 'Organization', name: 'Shop</script>' } },
      noIndex: true,
      image: 'javascript:alert(1)',
      favicon: '/favicon.ico',
    });
    expect(head.match(/<\/script>/gu)?.length).toBe(1); // only the JSON-LD script's own close
    // Outside the JSON-LD script nothing is live markup; inside it `</` is `<\/`.
    const [markup = '', jsonLd = ''] = head.split('<script type="application/ld+json">');
    expect(markup).not.toContain('<script>');
    expect(jsonLd).toContain('<\\/script>');
    expect(head).toContain('<meta name="description" content="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">');
    expect(head).toContain('&lt;/script&gt;');
    expect(head).toContain('<meta name="robots" content="noindex, follow">');
    expect(head).not.toContain('javascript:');
    expect(head).toContain('<link rel="icon" href="https://shop.example/favicon.ico">');
    expect(head).toContain('<meta charset="utf-8">');
  });

  it('maps BCP-47 tags to Open Graph locales', () => {
    expect(ogLocale('ar-JO')).toBe('ar_JO');
    expect(ogLocale('en')).toBe('en_US');
    expect(ogLocale('not a tag')).toBeUndefined();
  });
});
