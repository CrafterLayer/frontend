import { describe, expect, it } from 'vitest';

import type { CompiledPageArtifact, ExportPage, ManagedCatalog, RuntimeSnapshot } from '../contracts';
import { compileProject } from '../compiler/compile-project';
import { exportSite } from './export-site';

const catalog: ManagedCatalog = {
  manifest: {
    catalogVersion: 'test-1',
    runtimeProfile: 'craftkit-react-v1',
    packages: [
      {
        packageId: 'react',
        version: '19.2.8',
        importSpecifiers: ['react', 'react/jsx-runtime'],
        sourceArtifactId: 'react',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'test',
      },
      {
        packageId: 'react-dom',
        version: '19.2.8',
        importSpecifiers: ['react-dom/client'],
        sourceArtifactId: 'react-dom',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'test',
      },
    ],
  },
  modules: {
    react: {
      language: 'js',
      source: 'export function createElement(type,props){return {type,props}}',
    },
    'react/jsx-runtime': {
      language: 'js',
      source: 'export function jsx(type,props){return {type,props}};export const jsxs=jsx;',
    },
    'react-dom/client': {
      language: 'js',
      source:
        'export function createRoot(root){return {render(node){root.textContent=JSON.stringify(node)}}};export function hydrateRoot(root,node){createRoot(root).render(node)}',
    },
  },
};

function snapshot(
  source = 'export default function Page(){return <main><h1>Hello</h1><button>Go</button></main>}',
): RuntimeSnapshot {
  return {
    projectId: 'project',
    pageId: 'home',
    address: '/',
    entry: 'pages/home/Page.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: 'r1',
      dependencyLock: {
        catalogVersion: 'test-1',
        packages: { react: '19.2.8', 'react-dom': '19.2.8' },
      },
      files: { 'pages/home/Page.tsx': { language: 'tsx', source } },
    },
  };
}

async function built(address = '/'): Promise<CompiledPageArtifact> {
  const result = await compileProject({ ...snapshot(), address }, { catalog });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.artifact;
}

const prerender = () => Promise.resolve({ html: '<main><h1>مرحبا</h1></main>', hasPrimaryContent: true });

function arabicPage(overrides: Partial<ExportPage> = {}): ExportPage {
  return {
    ...snapshot(),
    address: '/قائمة-الطعام',
    title: 'قائمة الطعام',
    description: 'أطباق شرقية طازجة كل يوم في قلب عمّان مع توصيل سريع.',
    language: 'ar',
    direction: 'rtl',
    socialImage: 'https://images.example.com/menu.jpg',
    seo: {
      pageKind: 'menu',
      alternates: [{ lang: 'en', path: '/menu' }],
      site: {
        origin: 'https://example.com',
        siteName: 'مطعم الياسمين',
        business: {
          type: 'Restaurant',
          name: 'مطعم الياسمين',
          telephone: '+962791234567',
          address: { city: 'عمّان', country: 'JO' },
        },
      },
    },
    ...overrides,
  };
}

async function exportOne(page: ExportPage, origin?: string) {
  const artifact = await built(page.address);
  const result = await exportSite([page], {
    catalog,
    artifacts: new Map([['home', artifact]]),
    prerender,
    now: new Date('2026-09-30T12:00:00Z'),
    ...(origin === undefined ? {} : { origin }),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const file = (path: string) => result.files.find((candidate) => candidate.path === path)?.content;
  return { result, file };
}

describe('code page export: Unicode routes and the SEO head', () => {
  it('exports an Arabic route with a UTF-8 file path and a percent-encoded canonical', async () => {
    const { file, result } = await exportOne(arabicPage(), 'https://example.com');
    const html = file('قائمة-الطعام/index.html');
    expect(html).toBeDefined();
    expect(html).toContain('<html lang="ar" dir="rtl">');
    const encoded = encodeURI('/قائمة-الطعام');
    expect(html).toContain(`<link rel="canonical" href="https://example.com${encoded}">`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:locale" content="ar_AR"');
    expect(html).toContain('property="og:image" content="https://images.example.com/menu.jpg"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('application/ld+json');
    // Every generated file carries an integrity fingerprint like the artifact files.
    expect(result.files.every((candidate) => candidate.integrity !== undefined)).toBe(true);
  });

  it('emits sitemap.xml, robots.txt and a 404 in the page language', async () => {
    const { file } = await exportOne(arabicPage(), 'https://example.com');
    const sitemap = file('sitemap.xml') ?? '';
    expect(sitemap).toContain(`<loc>https://example.com${encodeURI('/قائمة-الطعام')}</loc>`);
    expect(sitemap).toContain('<lastmod>2026-09-30</lastmod>');
    expect(sitemap).toContain('hreflang="en"');
    expect(file('robots.txt')).toContain('Sitemap: https://example.com/sitemap.xml');
    const notFound = file('404.html') ?? '';
    expect(notFound).toContain('lang="ar" dir="rtl"');
    expect(notFound).toContain('الصفحة غير موجودة');
    expect(notFound).toContain('noindex');
  });

  it('takes the origin from the home page seo.site when the host passes none', async () => {
    const { file } = await exportOne(arabicPage({ address: '/' }));
    expect(file('index.html')).toContain('<link rel="canonical" href="https://example.com/">');
    expect(file('sitemap.xml')).toContain('<loc>https://example.com/</loc>');
  });

  it('omits sitemap and robots without any known origin, but still writes the 404', async () => {
    const { file } = await exportOne(arabicPage({ seo: { pageKind: 'menu' } }));
    expect(file('sitemap.xml')).toBeUndefined();
    expect(file('robots.txt')).toBeUndefined();
    expect(file('404.html')).toBeDefined();
    expect(file('قائمة-الطعام/index.html')).not.toContain('rel="canonical"');
  });

  it('escapes </script> in a title everywhere it lands, JSON-LD included', async () => {
    const { file } = await exportOne(
      arabicPage({ title: 'عرض </script><script>alert(1)</script> خاص' }),
      'https://example.com',
    );
    const html = file('قائمة-الطعام/index.html') ?? '';
    expect(html).not.toContain('</script><script>alert(1)');
    const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gu) ?? [];
    for (const script of scripts) expect(script).not.toContain('alert(1)</script');
  });

  it('refuses a route with spaces or a traversal, and a route that collides with generated files', async () => {
    const artifact = await built();
    for (const address of ['/قائمة الطعام', '/../x', '/assets', '/sitemap.xml']) {
      const result = await exportSite([arabicPage({ address })], {
        catalog,
        artifacts: new Map([['home', artifact]]),
        prerender,
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ message: expect.stringMatching(/Route cannot be exported/u) as unknown }],
      });
    }
  });

  it('ignores stored seo that does not parse instead of failing the export', async () => {
    const { file } = await exportOne(arabicPage({ seo: { pageKind: 'not-a-kind' } }), 'https://example.com');
    expect(file('قائمة-الطعام/index.html')).toContain('<html lang="ar" dir="rtl">');
  });
});
