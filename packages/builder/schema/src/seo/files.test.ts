import { describe, expect, it } from 'vitest';

import { robotsTxt, sitemapXml } from './files';

describe('sitemapXml', () => {
  it('writes Arabic and English alternates with lastmod', () => {
    const ar = 'https://qahwa.example/' + encodeURIComponent('قائمة');
    const en = 'https://qahwa.example/en/menu';
    const xml = sitemapXml([
      {
        loc: ar,
        lastmod: '2026-09-30',
        alternates: [
          { lang: 'ar', href: ar },
          { lang: 'en', href: en },
          { lang: 'x-default', href: ar },
        ],
      },
      { loc: 'https://qahwa.example/a&b', lastmod: 'yesterday' },
    ]);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="ar" href="${ar}"/>`);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${en}"/>`);
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('<lastmod>2026-09-30</lastmod>');
    expect(xml).toContain('<loc>https://qahwa.example/a&amp;b</loc>');
    expect(xml).not.toContain('yesterday');
  });
});

describe('robotsTxt', () => {
  it('allows crawling and names the sitemap', () => {
    expect(robotsTxt({ origin: 'https://qahwa.example/' })).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://qahwa.example/sitemap.xml\n',
    );
  });

  it('disallows everything for a staging site and omits Sitemap without an origin', () => {
    const txt = robotsTxt({ disallowAll: true });
    expect(txt).toContain('Disallow: /');
    expect(txt).not.toContain('Sitemap');
  });
});
