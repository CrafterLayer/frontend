import { escapeXml, isLangTag } from './text';

/*
  sitemap.xml and robots.txt (DESIGN D.2). Alternates are written as
  `xhtml:link` entries — Google treats sitemap hreflang as equivalent to the
  head tags — and every noindex page stays crawlable (robots never disallows
  a single page: a disallowed page's noindex is never seen).
*/

export interface SitemapAlternate {
  /** BCP-47 tag or 'x-default'. */
  lang: string;
  /** Absolute URL. */
  href: string;
}

export interface SitemapEntry {
  /** Absolute, already percent-encoded URL. */
  loc: string;
  /** ISO date or datetime; anything else is omitted. */
  lastmod?: string | undefined;
  alternates?: readonly SitemapAlternate[] | undefined;
}

const LASTMOD = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/u;

export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const hasAlternates = entries.some((entry) => (entry.alternates ?? []).length > 0);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${
      hasAlternates ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''
    }>`,
  ];
  for (const entry of entries) {
    lines.push('  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod !== undefined && LASTMOD.test(entry.lastmod)) {
      lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    }
    const seen = new Set<string>();
    for (const alternate of entry.alternates ?? []) {
      const lang = alternate.lang === 'x-default' || isLangTag(alternate.lang) ? alternate.lang : undefined;
      if (lang === undefined || seen.has(lang.toLowerCase())) continue;
      seen.add(lang.toLowerCase());
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(alternate.href)}"/>`,
      );
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

export interface RobotsTxtInput {
  /** Site origin; adds the `Sitemap:` line. */
  origin?: string | undefined;
  /** A staging site: disallow everything. */
  disallowAll?: boolean | undefined;
}

export function robotsTxt(input: RobotsTxtInput = {}): string {
  const lines = ['User-agent: *', input.disallowAll === true ? 'Disallow: /' : 'Allow: /'];
  const origin = input.origin?.trim().replace(/\/+$/u, '');
  if (origin !== undefined && origin !== '' && /^https?:\/\/\S+$/u.test(origin)) {
    lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  }
  lines.push('');
  return lines.join('\n');
}
