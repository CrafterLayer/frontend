import {
  buildSeoHead,
  encodeRoute,
  extractSeoContent,
  pageSeoSchema,
  robotsTxt,
  sitemapXml,
  type BuilderDocument,
  type JsonValue,
  type PageSeo,
  type RegisteredBlock,
  type SiteSeo,
  type SitemapEntry,
} from '@craftkit/builder-schema';

import { BEHAVIOR_CSS, behaviorRuntimeScript, hasBehaviors } from '../behaviors';
import { renderStaticMarkup } from '../render-static-markup';
import type { Theme } from '../resolve/theme';
import { STATIC_BASE_CSS } from './base-css';
import { normalRoute, relativeRoot, routeFile } from './routes';

/**
 * Publish kernel / customCode pages as a static website (DESIGN D.4).
 *
 * Each page is the pure static render (`renderStaticMarkup`, the same render
 * the preview uses) inside a complete document: `<html lang dir>`, the full
 * SEO head from `buildSeoHead` (title/description fitted to rendered width,
 * canonical, robots, Open Graph, Twitter, hreflang, JSON-LD built from the
 * page's visible content), the page's compiled Tailwind CSS, and — only on a
 * page that uses a `data-ck-behavior` — the self-contained behaviour runtime.
 * The site also gets `sitemap.xml` + `robots.txt` (when an origin is known)
 * and a `404.html` in the home page's language.
 *
 * Site settings (origin, name, template, business) are read from the HOME
 * page root's `seo.site` — DESIGN D.1's decision — and `options.origin`
 * overrides the stored origin.
 */

export interface StaticSitePageInput {
  readonly pageId: string;
  /** The page's site address: '/', '/menu', '/قائمة-الطعام'. */
  readonly address: string;
  readonly document: BuilderDocument;
  /** Fallbacks for a root without its own title/description (SitePage.title / purpose). */
  readonly title?: string;
  readonly description?: string;
  /** Shared regions rendered before (header) and after (footer) the page, in order. */
  readonly before?: readonly BuilderDocument[];
  readonly after?: readonly BuilderDocument[];
}

export interface ExportStaticSiteOptions {
  readonly pages: readonly StaticSitePageInput[];
  readonly blocks: (type: string) => RegisteredBlock | undefined;
  readonly theme?: Theme;
  /** CSS for every class the document renders (the host's Tailwind compiler). */
  readonly compileCss: (document: BuilderDocument) => Promise<string>;
  /** The published https origin; overrides the home page's `seo.site.origin`. */
  readonly origin?: string;
  /** The sitemap's lastmod; defaults to now. */
  readonly now?: Date;
}

export interface StaticSiteFile {
  readonly path: string;
  readonly content: string;
}

export interface StaticSiteResult {
  readonly files: StaticSiteFile[];
}

const LANGUAGE_TAG = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u;

function rootProps(document: BuilderDocument): Readonly<Record<string, JsonValue>> {
  return document.nodes[document.rootId]?.props ?? {};
}

function text(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function parsePageSeo(value: JsonValue | undefined): PageSeo | undefined {
  if (value === undefined) return undefined;
  const parsed = pageSeoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** `<html lang>`: the root's own tag, else the direction decides (RTL pages are Arabic here). */
function languageOf(document: BuilderDocument): string {
  const lang = text(rootProps(document)['lang']);
  if (lang !== undefined && LANGUAGE_TAG.test(lang)) return lang;
  return document.dir === 'rtl' ? 'ar' : 'en';
}

function validOrigin(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`The site origin "${value}" is not a URL.`);
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '')
    throw new Error(`The site origin "${value}" must be an https:// URL without credentials.`);
  return url.origin;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/gu, (character) =>
    character === '&'
      ? '&amp;'
      : character === '<'
        ? '&lt;'
        : character === '>'
          ? '&gt;'
          : character === '"'
            ? '&quot;'
            : '&#39;',
  );
}

/** A file-name-safe key for a page's own stylesheet. */
function cssKey(pageId: string, index: number, used: Set<string>): string {
  const base = pageId.replace(/[^a-zA-Z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '') || `page-${String(index + 1)}`;
  let key = base;
  for (let n = 2; used.has(key); n += 1) key = `${base}-${String(n)}`;
  used.add(key);
  return key;
}

const STYLE_ELEMENT = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/giu;
const FONT_IMPORT =
  /@import\s+url\(\s*['"]?(https:\/\/fonts\.(?:googleapis\.com|bunny\.net)\/[^'")\s]+)['"]?\s*\)\s*;?/giu;

/**
 * Lift web-font `@import`s out of the body's `<style>` elements: an import
 * inside a body style is discovered only after the HTML parser reaches it, so
 * the fonts arrive late (LCP) and swap in (CLS). The head gets a preconnect
 * plus a stylesheet link for each instead, found on the first bytes.
 */
function liftFontImports(body: string): { body: string; fonts: string[] } {
  const fonts: string[] = [];
  const lifted = body.replace(STYLE_ELEMENT, (_match, open: string, css: string, close: string) => {
    const rest = css.replace(FONT_IMPORT, (_import, url: string) => {
      if (!fonts.includes(url)) fonts.push(url);
      return '';
    });
    return rest.trim() === '' ? '' : `${open}${rest}${close}`;
  });
  return { body: lifted, fonts };
}

function fontLinks(fonts: readonly string[]): string {
  if (fonts.length === 0) return '';
  const hosts = [...new Set(fonts.map((url) => new URL(url).origin))];
  const preconnect = hosts.flatMap((host) =>
    host === 'https://fonts.googleapis.com'
      ? [
          `<link rel="preconnect" href="${host}">`,
          '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        ]
      : [`<link rel="preconnect" href="${host}" crossorigin>`],
  );
  return [...preconnect, ...fonts.map((url) => `<link rel="stylesheet" href="${escapeAttribute(url)}">`)].join('');
}

interface RenderedPage {
  readonly input: StaticSitePageInput;
  readonly file: string;
  readonly route: string;
  readonly lang: string;
  readonly dir: 'ltr' | 'rtl';
  readonly body: string;
  readonly fonts: readonly string[];
  readonly css: string;
  readonly behaviors: boolean;
  readonly seo: PageSeo | undefined;
  readonly noIndex: boolean;
}

const NOT_FOUND_COPY = {
  ar: { title: 'الصفحة غير موجودة', lead: 'لم نجد الصفحة التي تبحث عنها.', home: 'العودة إلى الصفحة الرئيسية' },
  en: { title: 'Page not found', lead: 'We could not find the page you were looking for.', home: 'Back to the home page' },
} as const;

function notFoundPage(lang: string, dir: 'ltr' | 'rtl', site: SiteSeo): string {
  const copy = lang.toLowerCase().startsWith('ar') ? NOT_FOUND_COPY.ar : NOT_FOUND_COPY.en;
  // The 404 must not carry a canonical or JSON-LD: it is not a page of the site.
  const head = buildSeoHead({
    title: copy.title,
    description: copy.lead,
    lang,
    path: '/404',
    site: { ...(site.siteName === undefined ? {} : { siteName: site.siteName }) },
    noIndex: true,
    jsonLd: false,
    applyTemplate: false,
  });
  const style =
    'body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#fafafa;color:#18181b}main{padding:2rem;text-align:center}h1{font-size:2rem;margin:0 0 .5rem}a{color:inherit}';
  return `<!doctype html><html lang="${escapeAttribute(lang)}" dir="${dir}"><head>${head}<style>${style}</style></head><body><main><h1>${escapeAttribute(copy.title)}</h1><p>${escapeAttribute(copy.lead)}</p><p><a href="/">${escapeAttribute(copy.home)}</a></p></main></body></html>`;
}

export async function exportStaticSite(options: ExportStaticSiteOptions): Promise<StaticSiteResult> {
  if (options.pages.length === 0) throw new Error('Publishing needs at least one page.');

  // Routes first: a bad or duplicate address fails before any render or compile.
  const files = new Set<string>();
  const routed = options.pages.map((input) => {
    const file = routeFile(input.address);
    if (files.has(file))
      throw new Error(`Two pages export to the same route: "${normalRoute(input.address)}".`);
    files.add(file);
    return { input, file, route: normalRoute(input.address) };
  });

  const home = routed.find(({ route }) => route === '/') ?? routed[0];
  const homeSeo = home === undefined ? undefined : parsePageSeo(rootProps(home.input.document)['seo']);
  const origin = validOrigin(options.origin) ?? validOrigin(homeSeo?.site?.origin);
  const site: SiteSeo = { ...(homeSeo?.site ?? {}), ...(origin === undefined ? {} : { origin }) };

  const rendered: RenderedPage[] = [];
  for (const { input, file, route } of routed) {
    const documents = [...(input.before ?? []), input.document, ...(input.after ?? [])];
    const render = (document: BuilderDocument) =>
      renderStaticMarkup(document, {
        blocks: options.blocks,
        ...(options.theme === undefined ? {} : { theme: options.theme }),
      });
    const { body, fonts } = liftFontImports(documents.map(render).join(''));
    const sheets = await Promise.all(documents.map((document) => options.compileCss(document)));
    // The base reset leads every sheet: the canvas's host page carries it, a published page does not.
    const css = [
      STATIC_BASE_CSS,
      ...new Set(sheets.map((sheet) => sheet.trim()).filter((sheet) => sheet !== '')),
    ].join('\n');
    const props = rootProps(input.document);
    rendered.push({
      input,
      file,
      route,
      lang: languageOf(input.document),
      dir: input.document.dir,
      body,
      fonts,
      css,
      behaviors: hasBehaviors(body),
      seo: parsePageSeo(props['seo']),
      noIndex: props['noIndex'] === true,
    });
  }

  const out: StaticSiteFile[] = [];
  // One shared stylesheet when every page compiles to the same CSS; otherwise one per page.
  const shared = rendered.every((page) => page.css === rendered[0]?.css);
  const usedKeys = new Set<string>();
  const cssPath = new Map<RenderedPage, string | undefined>();
  if (shared) {
    const css = rendered[0]?.css ?? '';
    if (css !== '') out.push({ path: 'assets/site.css', content: css });
    for (const page of rendered) cssPath.set(page, css === '' ? undefined : 'assets/site.css');
  } else {
    rendered.forEach((page, index) => {
      if (page.css === '') {
        cssPath.set(page, undefined);
        return;
      }
      const path = `assets/${cssKey(page.input.pageId, index, usedKeys)}.css`;
      out.push({ path, content: page.css });
      cssPath.set(page, path);
    });
  }
  const anyBehaviors = rendered.some((page) => page.behaviors);
  if (anyBehaviors) {
    out.push({ path: 'assets/ck-behaviors.css', content: BEHAVIOR_CSS });
    out.push({ path: 'assets/ck-behaviors.js', content: behaviorRuntimeScript() });
  }

  for (const page of rendered) {
    const props = rootProps(page.input.document);
    const content = extractSeoContent(page.input.document);
    const hero = content.images.find((image) => !image.decorative && image.src.startsWith("https://"));
    const socialImage = text(props['socialImage']);
    const head = buildSeoHead({
      title: text(props['title']) ?? page.input.title ?? '',
      description: text(props['description']) ?? page.input.description ?? '',
      lang: page.lang,
      path: page.route,
      site,
      ...(page.seo === undefined ? {} : { page: page.seo }),
      noIndex: page.noIndex,
      image: socialImage ?? hero?.src,
      imageAlt: socialImage === undefined ? hero?.alt : undefined,
      socialTitle: text(props['socialTitle']),
      socialDescription: text(props['socialDescription']),
      preloadImage: hero?.src,
      preloadImageSrcset: hero?.srcset,
      preloadImageSizes: hero?.sizes,
      content,
      xDefaultPath: '/',
    });
    const up = relativeRoot(page.file);
    const stylesheet = cssPath.get(page);
    const links = [
      fontLinks(page.fonts),
      stylesheet === undefined ? '' : `<link rel="stylesheet" href="${up}${stylesheet}">`,
      page.behaviors ? `<link rel="stylesheet" href="${up}assets/ck-behaviors.css">` : '',
      page.behaviors ? `<script defer src="${up}assets/ck-behaviors.js"></script>` : '',
    ].join('');
    const html = `<!doctype html><html lang="${escapeAttribute(page.lang)}" dir="${page.dir}"><head>${head}${links}</head><body>${page.body}</body></html>`;
    out.push({ path: page.file, content: html });
  }

  const homePage = rendered.find(({ route }) => route === '/') ?? rendered[0];
  out.push({
    path: '404.html',
    content: notFoundPage(homePage?.lang ?? 'en', homePage?.dir ?? 'ltr', site),
  });

  if (origin !== undefined) {
    const lastmod = (options.now ?? new Date()).toISOString().slice(0, 10);
    const entries: SitemapEntry[] = rendered
      .filter((page) => !page.noIndex)
      .map((page) => {
        const alternates = (page.seo?.alternates ?? []).map((alternate) => ({
          lang: alternate.lang,
          href: `${origin}${encodeRoute(alternate.path)}`,
        }));
        return {
          loc: `${origin}${encodeRoute(page.route)}`,
          lastmod,
          ...(alternates.length === 0
            ? {}
            : { alternates: [{ lang: page.lang, href: `${origin}${encodeRoute(page.route)}` }, ...alternates] }),
        };
      });
    out.push({ path: 'sitemap.xml', content: sitemapXml(entries) });
    out.push({ path: 'robots.txt', content: robotsTxt({ origin }) });
  }

  return { files: out };
}
