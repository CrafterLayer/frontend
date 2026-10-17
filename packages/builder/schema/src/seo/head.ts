import { buildJsonLdGraph, serializeJsonLd, type JsonLdGraph } from './jsonld';
import type { SeoContent } from './extract';
import { seoMeta } from './meta';
import type { PageSeo, SiteSeo } from './schema';
import { encodeRoute } from './slug';
import { escapeHtml, isHttpsUrl, isLangTag, primaryLang } from './text';

/*
  The full `<head>` body for an exported page (DESIGN D.2; checklist from
  astro-seo / next-seo, both MIT, studied not vendored). One string, every
  value escaped; the JSON-LD script is serialised with `</` and `<!--`
  neutralised. Callers wrap it in `<head>…</head>` themselves.
*/

export interface SeoHeadInput {
  /** The page title before the site template; `seoMeta` fits and templates it. */
  title: string;
  description: string;
  lang: string;
  /** The page's site address, e.g. '/' or '/قائمة-الطعام'. */
  path: string;
  /** Site settings (from the home page root). Falls back to `page.site`. */
  site?: SiteSeo | undefined;
  page?: PageSeo | undefined;
  noIndex?: boolean | undefined;
  /** Social image override; falls back to `site.defaultImage`. */
  image?: string | undefined;
  imageAlt?: string | undefined;
  socialTitle?: string | undefined;
  socialDescription?: string | undefined;
  /** A colour for `<meta name="theme-color">`, e.g. '#0f766e'. */
  themeColor?: string | undefined;
  favicon?: string | undefined;
  /** The LCP image to preload with high priority. */
  preloadImage?: string | undefined;
  /** The LCP image's `srcset`/`sizes`, so a phone preloads the candidate it will use. */
  preloadImageSrcset?: string | undefined;
  preloadImageSizes?: string | undefined;
  /** A display font (woff2) to preload. */
  preloadFont?: string | undefined;
  /** Where `x-default` points; the page's own path when absent. */
  xDefaultPath?: string | undefined;
  /** Extracted content for FAQ/Menu/Product structured data. */
  content?: SeoContent | undefined;
  /** A prebuilt graph; built from site/page/content when absent. `false` omits JSON-LD. */
  jsonLd?: JsonLdGraph | false | undefined;
  /** When false, `title` is written verbatim (already fitted and templated). Default true. */
  applyTemplate?: boolean | undefined;
}

const OG_LOCALE_DEFAULTS: Readonly<Record<string, string>> = {
  ar: 'ar_AR',
  en: 'en_US',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
  tr: 'tr_TR',
  fa: 'fa_IR',
  he: 'he_IL',
  ur: 'ur_PK',
};

/** BCP-47 to the Open Graph `ll_CC` form: `ar-JO` → `ar_JO`, `ar` → `ar_AR`. */
export function ogLocale(lang: string): string | undefined {
  if (!isLangTag(lang)) return undefined;
  const parts = lang.split('-');
  const primary = primaryLang(lang);
  const region = parts.slice(1).find((part) => /^[a-zA-Z]{2}$/u.test(part));
  if (region !== undefined) return `${primary}_${region.toUpperCase()}`;
  return OG_LOCALE_DEFAULTS[primary] ?? `${primary}_${primary.toUpperCase()}`;
}

/** https URLs, or site-root-relative paths; anything else (javascript:, data:) is dropped. */
function safeHref(value: string | undefined, origin: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (isHttpsUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !/\s/u.test(trimmed)) {
    return origin === undefined ? encodeRoute(trimmed) : `${origin}${encodeRoute(trimmed)}`;
  }
  return undefined;
}

function meta(attribute: 'name' | 'property', key: string, value: string | undefined): string {
  return value === undefined || value === '' ? '' : `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
}

function link(rel: string, href: string | undefined, extra = ''): string {
  return href === undefined ? '' : `<link rel="${rel}" href="${escapeHtml(href)}"${extra}>`;
}

/** Every head tag for one page as a single escaped string. */
export function buildSeoHead(input: SeoHeadInput): string {
  const site = input.site ?? input.page?.site ?? {};
  const page = input.page ?? {};
  const origin = site.origin?.replace(/\/+$/u, '');
  const lang = isLangTag(input.lang) ? input.lang : '';

  const fitted =
    input.applyTemplate === false
      ? { title: input.title, description: input.description }
      : seoMeta({
          title: input.title,
          description: input.description,
          lang,
          siteName: site.siteName,
          template: site.titleTemplate,
        });
  const title = fitted.title;
  const description = fitted.description;

  const canonicalPath = page.canonicalPath ?? input.path;
  const canonical = origin === undefined ? undefined : `${origin}${encodeRoute(canonicalPath)}`;
  const selfUrl = origin === undefined ? undefined : `${origin}${encodeRoute(input.path)}`;
  const image = safeHref(input.image, origin) ?? safeHref(site.defaultImage, origin);
  const ogType =
    page.ogType ?? (page.pageKind === 'article' ? 'article' : page.pageKind === 'product' ? 'product' : 'website');
  const alternates = (page.alternates ?? []).filter((alternate) => isLangTag(alternate.lang));

  const tags: string[] = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    meta('name', 'description', description),
    link('canonical', canonical),
    meta('name', 'robots', input.noIndex === true ? 'noindex, follow' : 'index, follow, max-image-preview:large'),
  ];

  // Open Graph + Twitter.
  const socialTitle = input.socialTitle ?? title;
  const socialDescription = input.socialDescription ?? description;
  tags.push(
    meta('property', 'og:type', ogType),
    meta('property', 'og:title', socialTitle),
    meta('property', 'og:description', socialDescription),
    meta('property', 'og:url', canonical),
    meta('property', 'og:site_name', site.siteName ?? site.business?.name),
    meta('property', 'og:locale', ogLocale(lang)),
  );
  const alternateLocales = new Set(
    alternates.map((alternate) => ogLocale(alternate.lang)).filter((locale): locale is string => locale !== undefined),
  );
  alternateLocales.delete(ogLocale(lang) ?? '');
  for (const locale of alternateLocales) tags.push(meta('property', 'og:locale:alternate', locale));
  if (image !== undefined) {
    tags.push(meta('property', 'og:image', image), meta('property', 'og:image:alt', input.imageAlt));
  }
  tags.push(
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', socialTitle),
    meta('name', 'twitter:description', socialDescription),
  );
  if (image !== undefined) {
    tags.push(meta('name', 'twitter:image', image), meta('name', 'twitter:image:alt', input.imageAlt));
  }

  // hreflang: itself, every alternate, and x-default — reciprocal by construction
  // when every page in the set lists the others.
  if (origin !== undefined && selfUrl !== undefined && alternates.length > 0) {
    const seen = new Set<string>();
    const entries: [string, string][] = [];
    if (lang !== '') entries.push([lang, selfUrl]);
    for (const alternate of alternates) entries.push([alternate.lang, `${origin}${encodeRoute(alternate.path)}`]);
    for (const [hreflang, href] of entries) {
      const key = hreflang.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(link('alternate', href, ` hreflang="${escapeHtml(hreflang)}"`));
    }
    const xDefault = `${origin}${encodeRoute(input.xDefaultPath ?? input.path)}`;
    tags.push(link('alternate', xDefault, ' hreflang="x-default"'));
  }

  if (input.themeColor !== undefined && /^#[0-9a-fA-F]{3,8}$|^[a-z]+$/u.test(input.themeColor)) {
    tags.push(meta('name', 'theme-color', input.themeColor));
  }
  tags.push(link('icon', safeHref(input.favicon, origin)));
  const preloadImage = safeHref(input.preloadImage, origin);
  if (preloadImage !== undefined) {
    const srcset = input.preloadImageSrcset?.trim();
    const responsive =
      srcset === undefined || srcset === '' || /javascript:|data:/iu.test(srcset)
        ? ''
        : ` imagesrcset="${escapeHtml(srcset)}"${
            input.preloadImageSizes?.trim() ? ` imagesizes="${escapeHtml(input.preloadImageSizes.trim())}"` : ''
          }`;
    tags.push(link('preload', preloadImage, ` as="image" fetchpriority="high"${responsive}`));
  }
  const preloadFont = safeHref(input.preloadFont, origin);
  if (preloadFont !== undefined) tags.push(link('preload', preloadFont, ' as="font" type="font/woff2" crossorigin'));

  if (input.jsonLd !== false) {
    const graph =
      input.jsonLd ??
      buildJsonLdGraph({
        site,
        page: { title: input.title.trim() || title, description, lang, path: input.path, image, seo: page },
        url: canonical,
        content: input.content,
      });
    if (graph['@graph'].length > 0) {
      tags.push(`<script type="application/ld+json">${serializeJsonLd(graph)}</script>`);
    }
  }

  return tags.filter((tag) => tag !== '').join('');
}
