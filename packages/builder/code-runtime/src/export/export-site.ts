import {
  buildSeoHead,
  encodeRoute,
  pageSeoSchema,
  robotsTxt,
  sitemapXml,
  type ArtifactFile,
  type CompileDiagnostic,
  type PageSeo,
  type SiteSeo,
} from '@craftkit/builder-schema';
import type { ExportOptions, ExportPage, ExportResult } from '../contracts';
import { fingerprint, projectFingerprints } from '../fingerprint';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
}

/** Unicode letters and digits are first-class: `/قائمة-الطعام` exports; the file path keeps UTF-8. */
const EXPORT_ROUTE = /^\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]*$/u;

function routePath(address: string): string {
  if (!EXPORT_ROUTE.test(address)) throw new Error(`Route cannot be exported: ${address}`);
  const first = address.replace(/^\//u, '').split('/')[0]?.toLowerCase() ?? '';
  if (
    first === 'assets' ||
    first === '404.html' ||
    first === 'sitemap.xml' ||
    first === 'robots.txt'
  )
    throw new Error(`Route cannot be exported: ${address} collides with a generated file.`);
  return address === '/'
    ? 'index.html'
    : `${address.replace(/^\//u, '').replace(/\/$/u, '')}/index.html`;
}

interface ExportedRoute {
  readonly route: string;
  readonly language: string;
  readonly direction: 'ltr' | 'rtl';
  readonly noIndex: boolean;
  readonly seo: PageSeo | undefined;
}

function siteFile(path: string, content: string): ArtifactFile {
  return { path, content };
}

function parsePageSeo(value: unknown): PageSeo | undefined {
  if (value === undefined) return undefined;
  const parsed = pageSeoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function validOrigin(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '')
    throw new Error('The export origin must be an https:// URL without credentials.');
  return url.origin;
}

/** The origin a host already told us through a page's canonical URL, when it is a clean https one. */
function canonicalOrigin(value: string | undefined): string | undefined {
  if (value === undefined || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  return url.protocol === 'https:' && url.username === '' && url.password === ''
    ? url.origin
    : undefined;
}

function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalRoute(address: string): string {
  const trimmed = address.replace(/\/$/u, '');
  return trimmed === '' ? '/' : trimmed;
}

const NOT_FOUND_COPY = {
  ar: {
    title: 'الصفحة غير موجودة',
    lead: 'لم نجد الصفحة التي تبحث عنها.',
    home: 'العودة إلى الصفحة الرئيسية',
  },
  en: {
    title: 'Page not found',
    lead: 'We could not find the page you were looking for.',
    home: 'Back to the home page',
  },
} as const;

/** A minimal, self-contained 404 in the home page's language; noindex, no canonical, no JSON-LD. */
function notFoundPage(language: string, direction: 'ltr' | 'rtl', site: SiteSeo): string {
  const copy = language.toLowerCase().startsWith('ar') ? NOT_FOUND_COPY.ar : NOT_FOUND_COPY.en;
  const head = buildSeoHead({
    title: copy.title,
    description: copy.lead,
    lang: language,
    path: '/404',
    site: site.siteName === undefined ? {} : { siteName: site.siteName },
    noIndex: true,
    jsonLd: false,
    applyTemplate: false,
  });
  const style =
    'body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}main{padding:2rem;text-align:center}';
  return `<!doctype html><html lang="${language}" dir="${direction}"><head>${head}<style>${style}</style></head><body><main><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.lead)}</p><p><a href="/">${escapeHtml(copy.home)}</a></p></main></body></html>`;
}

/** Assemble an immutable website; authored execution belongs exclusively to the prerender port. */
export async function exportSite(
  pages: readonly ExportPage[],
  options: ExportOptions,
): Promise<ExportResult> {
  options.signal?.throwIfAborted();
  const files: ArtifactFile[] = [];
  const artifactIds: string[] = [];
  try {
    pages = structuredClone(pages);
    options = {
      ...options,
      catalog: structuredClone(options.catalog),
      artifacts: structuredClone(options.artifacts),
    };
    const routes = new Set<string>();
    const exported: ExportedRoute[] = [];
    const homeSeo = parsePageSeo(pages.find(({ address }) => address === '/')?.seo);
    const origin =
      validOrigin(options.origin) ??
      validOrigin(homeSeo?.site?.origin) ??
      canonicalOrigin(pages.find(({ canonicalUrl }) => canonicalUrl !== undefined)?.canonicalUrl);
    const site: SiteSeo = { ...(homeSeo?.site ?? {}), ...(origin === undefined ? {} : { origin }) };
    for (const page of pages) {
      const path = routePath(page.address);
      if (routes.has(path)) throw new Error(`Duplicate exported route: ${page.address}`);
      routes.add(path);
      const artifact = options.artifacts.get(page.pageId);
      const expected = await projectFingerprints(page, options.catalog);
      options.signal?.throwIfAborted();
      if (
        artifact?.artifactId !== expected.artifactId ||
        artifact.sourceRevision !== page.project.revision ||
        artifact.projectId !== page.projectId ||
        artifact.pageId !== page.pageId
      )
        throw new Error(`Page ${page.pageId} has no revision-matching artifact.`);
      if (
        artifact.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
        artifact.js.length === 0
      )
        throw new Error(`Page ${page.pageId} has no valid hydration entry.`);
      const canonical = page.canonicalUrl === undefined ? undefined : new URL(page.canonicalUrl);
      if (
        canonical !== undefined &&
        (canonical.protocol !== 'https:' || canonical.username !== '' || canonical.password !== '')
      )
        throw new Error(`Page ${page.pageId} needs a valid HTTPS canonical URL.`);
      if (page.title.trim() === '' || page.description.trim() === '')
        throw new Error(`Page ${page.pageId} needs title and description metadata.`);
      const base = `assets/${artifact.artifactId}`;
      for (const file of [...artifact.js, ...artifact.css]) {
        if (!/^[a-zA-Z0-9_.-]+$/u.test(file.path) || file.path === '..')
          throw new Error('Artifact output path is unsafe.');
        if (file.integrity === undefined || (await fingerprint(file.content)) !== file.integrity)
          throw new Error('Artifact output integrity does not match.');
        files.push({ ...file, path: `${base}/${file.path}` });
      }
      // Validate before delegating execution, and keep the export snapshot private to this call.
      const rendered = await options.prerender(
        structuredClone(page),
        structuredClone(artifact),
        options.signal,
      );
      const renderMode: unknown = rendered.renderMode ?? 'server';
      if (renderMode !== 'client' && renderMode !== 'server')
        throw new Error('Unsupported prerender mode.');
      options.signal?.throwIfAborted();
      if (!page.noIndex && (!rendered.hasPrimaryContent || rendered.html.trim() === ''))
        throw new Error(`Page ${page.pageId} has no indexable primary content.`);
      const relativeBase = '../'.repeat(path.split('/').length - 1) + base;
      const styles = artifact.css
        .map((file) => `<link rel="stylesheet" href="${relativeBase}/${file.path}">`)
        .join('');
      const scripts = artifact.js
        .map((file) => `<script type="module" src="${relativeBase}/${file.path}"></script>`)
        .join('');
      const language = page.language ?? 'en';
      if (!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(language))
        throw new Error(`Page ${page.pageId} needs a valid language tag.`);
      const direction: unknown = page.direction ?? 'ltr';
      if (direction !== 'ltr' && direction !== 'rtl')
        throw new Error('Unsupported page direction.');
      const seo = parsePageSeo(page.seo);
      const pageOrigin = canonical?.origin ?? origin;
      const canonicalPath =
        canonical === undefined
          ? undefined
          : safeDecode(canonical.pathname.replace(/\/$/u, '') || '/');
      const head = buildSeoHead({
        title: page.title,
        description: page.description,
        lang: language,
        path: normalRoute(page.address),
        site: { ...site, ...(pageOrigin === undefined ? {} : { origin: pageOrigin }) },
        page: {
          ...(seo ?? {}),
          ...(canonicalPath === undefined || seo?.canonicalPath !== undefined
            ? {}
            : { canonicalPath }),
        },
        noIndex: page.noIndex === true,
        image: page.socialImage,
        socialTitle: page.socialTitle,
        socialDescription: page.socialDescription,
      });
      const html = `<!doctype html><html lang="${language}" dir="${direction}"><head>${head}${styles}</head><body><div id="root" data-craftkit-render-mode="${renderMode}">${rendered.html}</div>${scripts}</body></html>`;
      exported.push({
        route: normalRoute(page.address),
        language,
        direction,
        noIndex: page.noIndex === true,
        seo,
      });
      files.push({ path, content: html, integrity: await fingerprint(html) });
      artifactIds.push(artifact.artifactId);
    }
    if (pages.length === 0) throw new Error('Export requires at least one page.');
    const home = exported.find(({ route }) => route === '/') ?? exported[0];
    files.push(
      siteFile('404.html', notFoundPage(home?.language ?? 'en', home?.direction ?? 'ltr', site)),
    );
    if (origin !== undefined) {
      const lastmod = (options.now ?? new Date()).toISOString().slice(0, 10);
      const entries = exported
        .filter(({ noIndex }) => !noIndex)
        .map(({ route, language, seo }) => {
          const alternates = (seo?.alternates ?? []).map((alternate) => ({
            lang: alternate.lang,
            href: `${origin}${encodeRoute(alternate.path)}`,
          }));
          const loc = `${origin}${encodeRoute(route)}`;
          return {
            loc,
            lastmod,
            ...(alternates.length === 0
              ? {}
              : { alternates: [{ lang: language, href: loc }, ...alternates] }),
          };
        });
      files.push(siteFile('sitemap.xml', sitemapXml(entries)));
      files.push(siteFile('robots.txt', robotsTxt({ origin })));
    }
    for (const file of files) {
      file.integrity ??= await fingerprint(file.content);
    }
    options.signal?.throwIfAborted();
    return { ok: true, files, artifactIds };
  } catch (cause) {
    options.signal?.throwIfAborted();
    const diagnostics: CompileDiagnostic[] = [
      {
        code: 'export-refused',
        severity: 'error',
        message: cause instanceof Error ? cause.message : 'Export failed.',
      },
    ];
    return { ok: false, diagnostics };
  }
}
