import { describe, expect, it, vi } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  LATEST_SCHEMA_VERSION,
  type BlockRenderProps,
  type BuilderDocument,
  type JsonValue,
  type RegisteredBlock,
  type SiteLibrary,
} from '@craftkit/builder-schema';

import { CustomCode } from '../components/CustomCode';
import { STATIC_BASE_CSS } from './base-css';
import { exportStaticSite, VIEW_TRANSITION_CSS, type StaticSitePageInput } from './export-static-site';
import { routeFile } from './routes';

/* A real registered schema from the kernel fixtures; the renderers are this test's own. */
const anySchema =
  (fixtureBlocks.contributes?.blocks ?? []).find(({ schema }) => schema.type === 'hero')?.schema ??
  raise();

function raise(): never {
  throw new Error('Fixture is missing the "hero" block.');
}

function PageRoot({ slots }: BlockRenderProps) {
  return <main>{slots['default']}</main>;
}

function Section({ node }: BlockRenderProps) {
  const behavior = node.props['behavior'];
  const css = node.props['css'];
  const heading = node.props['heading'];
  return (
    <section {...(typeof behavior === 'string' ? { 'data-ck-behavior': behavior } : {})}>
      {typeof css === 'string' ? <style>{css}</style> : null}
      <h2>{typeof heading === 'string' ? heading : ''}</h2>
    </section>
  );
}

const registry: Record<string, RegisteredBlock> = {
  page: { schema: anySchema, render: PageRoot as NonNullable<RegisteredBlock['render']> },
  section: { schema: anySchema, render: Section as NonNullable<RegisteredBlock['render']> },
};
const blocks = (type: string) => registry[type];

function doc(
  rootProps: Record<string, JsonValue>,
  sections: Record<string, JsonValue>[],
  dir: 'ltr' | 'rtl' = 'rtl',
): BuilderDocument {
  const ids = sections.map((_, index) => `s${String(index)}`);
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: rootProps, slots: { default: ids } },
      ...Object.fromEntries(
        sections.map((props, index) => [
          ids[index] ?? '',
          { id: ids[index] ?? '', type: 'section', props },
        ]),
      ),
    },
  };
}

const business = {
  type: 'Restaurant',
  name: 'مطعم الياسمين',
  telephone: '+962791234567',
  address: { city: 'عمّان', country: 'JO' },
};

function arabicSite(): StaticSitePageInput[] {
  return [
    {
      pageId: 'home',
      address: '/',
      document: doc(
        {
          title: 'مطعم الياسمين',
          description: 'مطعم شرقي في عمّان يقدم أطباقاً طازجة كل يوم مع توصيل سريع.',
          lang: 'ar',
          seo: { pageKind: 'home', site: { origin: 'https://example.com', siteName: 'الياسمين', business } },
        },
        [{ heading: 'أهلاً بكم' }],
      ),
    },
    {
      pageId: 'menu',
      address: '/قائمة-الطعام',
      document: doc({ title: 'قائمة الطعام', description: 'أطباقنا وأسعارها.', lang: 'ar' }, [
        { heading: 'المشاوي', behavior: 'reveal' },
      ]),
    },
  ];
}

async function run(
  pages = arabicSite(),
  compileCss: (document: BuilderDocument) => Promise<string> = () => Promise.resolve('.p-4{padding:1rem}'),
) {
  const { files } = await exportStaticSite({
    pages,
    blocks,
    compileCss,
    now: new Date('2026-09-30T00:00:00Z'),
  });
  const file = (path: string) => files.find((candidate) => candidate.path === path)?.content;
  return { files, file };
}

describe('exportStaticSite', () => {
  it('publishes a two-page Arabic site with lang/dir, the SEO head and JSON-LD from seo.site', async () => {
    const { file } = await run();
    const home = file('index.html') ?? '';
    expect(home.startsWith('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">')).toBe(true);
    expect(home).toContain('<link rel="canonical" href="https://example.com/">');
    expect(home).toContain('property="og:locale" content="ar_AR"');
    expect(home).toContain('application/ld+json');
    expect(home).toContain('Restaurant');
    expect(home).toContain('<h2>أهلاً بكم</h2>');
    const menu = file('قائمة-الطعام/index.html') ?? '';
    expect(menu).toContain('<html lang="ar" dir="rtl">');
    expect(menu).toContain(`href="https://example.com${encodeURI('/قائمة-الطعام')}"`);
  });

  it('writes a percent-encoded sitemap, robots.txt and an Arabic 404', async () => {
    const { file } = await run();
    expect(file('sitemap.xml')).toContain(`<loc>https://example.com${encodeURI('/قائمة-الطعام')}</loc>`);
    expect(file('sitemap.xml')).toContain('<lastmod>2026-09-30</lastmod>');
    expect(file('robots.txt')).toContain('Sitemap: https://example.com/sitemap.xml');
    const notFound = file('404.html') ?? '';
    expect(notFound).toContain('<html lang="ar" dir="rtl">');
    expect(notFound).toContain('الصفحة غير موجودة');
    expect(notFound).toContain('noindex');
  });

  it('adds the behaviour runtime only to the page that uses data-ck-behavior', async () => {
    const { file } = await run();
    expect(file('index.html')).not.toContain('ck-behaviors.js');
    const menu = file('قائمة-الطعام/index.html') ?? '';
    expect(menu).toContain('<script defer src="../assets/ck-behaviors.js"></script>');
    expect(menu).toContain('href="../assets/ck-behaviors.css"');
    expect(file('assets/ck-behaviors.js')).toContain('(document)');
    expect(file('assets/ck-behaviors.css')).toContain('data-ck-behavior');
  });

  it('shares one site.css when every page compiles alike, and splits it when they differ', async () => {
    const same = await run();
    expect(same.file('assets/site.css')).toBe(`${STATIC_BASE_CSS}\n${VIEW_TRANSITION_CSS}\n.p-4{padding:1rem}`);
    expect(same.file('index.html')).toContain('<link rel="stylesheet" href="assets/site.css">');
    expect(same.file('قائمة-الطعام/index.html')).toContain('href="../assets/site.css"');

    const compileCss = vi.fn((document: BuilderDocument) =>
      Promise.resolve(document.nodes['root']?.props['title'] === 'قائمة الطعام' ? '.menu{}' : '.home{}'),
    );
    const split = await run(arabicSite(), compileCss);
    expect(split.file('assets/site.css')).toBeUndefined();
    expect(split.file('assets/home.css')).toBe(`${STATIC_BASE_CSS}\n${VIEW_TRANSITION_CSS}\n.home{}`);
    expect(split.file('assets/menu.css')).toBe(`${STATIC_BASE_CSS}\n${VIEW_TRANSITION_CSS}\n.menu{}`);
    expect(split.file('قائمة-الطعام/index.html')).toContain('href="../assets/menu.css"');
  });

  it('renders shared header/footer regions around the page', async () => {
    const [home] = arabicSite();
    const { file } = await run([
      {
        ...(home ?? raise()),
        before: [doc({}, [{ heading: 'الترويسة' }])],
        after: [doc({}, [{ heading: 'التذييل' }])],
      },
    ]);
    const html = file('index.html') ?? '';
    expect(html.indexOf('الترويسة')).toBeLessThan(html.indexOf('أهلاً بكم'));
    expect(html.indexOf('أهلاً بكم')).toBeLessThan(html.indexOf('التذييل'));
  });

  it('skips sitemap and robots without an origin; options.origin overrides the stored one', async () => {
    const pages = arabicSite().map((page) => ({
      ...page,
      document: doc({ title: 'x', lang: 'en' }, [{ heading: 'Hi' }], 'ltr'),
    }));
    const bare = await run(pages);
    expect(bare.file('sitemap.xml')).toBeUndefined();
    expect(bare.file('robots.txt')).toBeUndefined();
    expect(bare.file('index.html')).toContain('<html lang="en" dir="ltr">');
    expect(bare.file('404.html')).toContain('Page not found');

    const { files } = await exportStaticSite({
      pages: arabicSite(),
      blocks,
      compileCss: () => Promise.resolve(''),
      origin: 'https://menu.example.org/',
    });
    const home = files.find(({ path }) => path === 'index.html')?.content ?? '';
    expect(home).toContain('<link rel="canonical" href="https://menu.example.org/">');
    // Even an empty compile ships the base reset (and, on a multi-page site, the page transition).
    expect(files.find(({ path }) => path === 'assets/site.css')?.content).toBe(
      `${STATIC_BASE_CSS}\n${VIEW_TRANSITION_CSS}`,
    );
  });

  it('ships the base reset: border-box sizing, no figure/blockquote margins, unstyled lists, inherited link colour', async () => {
    const { file } = await run();
    const css = file('assets/site.css') ?? '';
    expect(css.startsWith('@layer properties,theme,base,components,utilities;')).toBe(true);
    expect(css).toMatch(/\*,::after,::before[^{]*\{box-sizing:border-box;margin:0;padding:0/u);
    expect(css).toContain('ol,ul,menu{list-style:none}');
    expect(css).toContain('a{color:inherit;');
    // Utilities come after the base layer and are layered above it.
    expect(css.indexOf('@layer base{')).toBeLessThan(css.indexOf('.p-4{padding:1rem}'));
  });

  it('lifts web-font @imports from body styles into head preconnect + stylesheet links', async () => {
    const font = 'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&display=swap';
    const [home] = arabicSite();
    const page = home ?? raise();
    const { file } = await run([
      {
        ...page,
        document: doc(page.document.nodes['root']?.props ?? {}, [
          { heading: 'أهلاً', css: `@import url('${font}');.ck-x{color:red}` },
          { heading: 'فقط', css: `@import url("${font}");` },
        ]),
      },
    ]);
    const html = file('index.html') ?? '';
    const head = html.slice(0, html.indexOf('</head>'));
    const body = html.slice(html.indexOf('<body>'));
    expect(head).toContain('<link rel="preconnect" href="https://fonts.googleapis.com">');
    expect(head).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    expect(head.split(`<link rel="stylesheet" href="${font.replaceAll('&', '&amp;')}">`)).toHaveLength(2);
    expect(head.indexOf('fonts.googleapis.com/css2')).toBeLessThan(head.indexOf('assets/site.css'));
    expect(body).not.toContain('@import');
    expect(body).toContain('<style>.ck-x{color:red}</style>');
    // A style left empty by the lift is dropped, not written as <style></style>.
    expect(body).not.toContain('<style></style>');
  });

  it('preloads the hero with its srcset/sizes so a phone fetches its own candidate', async () => {
    const [home] = arabicSite();
    const page = home ?? raise();
    const src = 'https://images.unsplash.com/photo-1?w=1600&q=80';
    const srcset = 'https://images.unsplash.com/photo-1?w=640&q=80 640w, https://images.unsplash.com/photo-1?w=1600&q=80 1600w';
    const { file } = await run([
      {
        ...page,
        document: doc(page.document.nodes['root']?.props ?? {}, [
          {
            heading: 'أهلاً',
            // The customCode tree the SEO extractor reads (the renderer here is the test's own).
            tree: {
              kind: 'root',
              children: [{ kind: 'element', tag: 'img', attributes: { src, alt: 'قهوة', srcset, sizes: '100vw' } }],
            },
          },
        ]),
      },
    ]);
    const html = file('index.html') ?? '';
    expect(html).toContain(
      `<link rel="preload" href="${src.replaceAll('&', '&amp;')}" as="image" fetchpriority="high" imagesrcset="${srcset.replaceAll('&', '&amp;')}" imagesizes="100vw">`,
    );
  });

  it('refuses duplicate and invalid routes with a clear message', async () => {
    const [home, menu] = arabicSite();
    await expect(run([home ?? raise(), { ...(menu ?? raise()), address: '/' }])).rejects.toThrow(
      /same route: "\/"/u,
    );
    await expect(run([{ ...(menu ?? raise()), address: '/قائمة الطعام' }])).rejects.toThrow(
      /Route cannot be exported/u,
    );
    await expect(run([{ ...(menu ?? raise()), address: '/assets' }])).rejects.toThrow(/collides/u);
    expect(routeFile('/a/b/')).toBe('a/b/index.html');
    await expect(
      exportStaticSite({ pages: [], blocks, compileCss: () => Promise.resolve('') }),
    ).rejects.toThrow(/at least one page/u);
  });
});

/* ── style-manager (P4): library, named styles, motion, effects, transitions, smooth scroll ── */

function Code({ node }: BlockRenderProps) {
  return <CustomCode hostId={node.id} tree={node.props['tree']} />;
}

const codeRegistry: Record<string, RegisteredBlock> = {
  ...registry,
  code: { schema: anySchema, render: Code as NonNullable<RegisteredBlock['render']> },
};

function codeDoc(tree: JsonValue): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'الرئيسية', lang: 'ar' }, slots: { default: ['c'] } },
      c: { id: 'c', type: 'code', props: { tree } },
    },
  };
}

const animatedTree: JsonValue = {
  kind: 'root',
  children: [
    { kind: 'element', tag: 'h1', text: 'مرحبا', attributes: { 'data-ck-motion': 'fade-up' } },
    { kind: 'element', tag: 'a', text: 'اطلب', attributes: { href: '/menu', 'data-ck-hover': 'lift' } },
    { kind: 'element', tag: 'div', className: 'ck-fx-glass ck-s-card p-2', text: 'بطاقة' },
  ],
};
const plainTree: JsonValue = { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'قائمة' }] };

const designLibrary: SiteLibrary = {
  styles: { card: { id: 'card', name: 'Card', className: 'rounded-lg p-6 bg-accent' } },
  settings: { smoothScroll: true },
};

async function exportCode(
  pages: { address: string; tree: JsonValue }[],
  extra: Partial<Parameters<typeof exportStaticSite>[0]> = {},
) {
  const { files } = await exportStaticSite({
    pages: pages.map(({ address, tree }, at) => ({ pageId: `p${String(at)}`, address, document: codeDoc(tree) })),
    blocks: (type: string) => codeRegistry[type],
    compileCss: () => Promise.resolve(''),
    ...extra,
  });
  return (path: string) => files.find((candidate) => candidate.path === path)?.content;
}

describe('exportStaticSite — design library and motion', () => {
  it('expands named styles, and ships only the presets, hovers and effects the site uses', async () => {
    const file = await exportCode(
      [
        { address: '/', tree: animatedTree },
        { address: '/menu', tree: plainTree },
      ],
      { library: designLibrary },
    );
    const home = file('index.html') ?? '';
    const card = /<div class="([^"]*)"[^>]*>بطاقة/u.exec(home)?.[1]?.split(' ') ?? [];
    expect(card).toContain('ck-s-card');
    expect(card).toContain('rounded-lg');
    expect(card).toContain('p-2');
    expect(card).not.toContain('p-6');

    const motion = file('assets/ck-motion.css') ?? '';
    expect(motion).toContain("[data-ck-motion='fade-up']");
    expect(motion).toContain("[data-ck-hover='lift']");
    expect(motion).toContain('.ck-fx-glass');
    expect(motion).not.toContain("[data-ck-motion='fade-down']");
    expect(motion).not.toContain('.ck-fx-mesh');

    expect(home).toContain('<link rel="stylesheet" href="assets/ck-motion.css">');
    expect(home).toContain('<script defer src="assets/ck-behaviors.js"></script>');
    const menu = file('menu/index.html') ?? '';
    expect(menu).not.toContain('ck-motion.css');
    expect(menu).not.toContain('ck-behaviors.js');
  });

  it('adds the cross-fade page transition to a multi-page site, and the opt-in smooth scroll', async () => {
    const file = await exportCode(
      [
        { address: '/', tree: animatedTree },
        { address: '/menu', tree: plainTree },
      ],
      { library: designLibrary },
    );
    expect(file('assets/site.css')).toContain('@view-transition');
    const smooth = file('assets/ck-smooth-scroll.js') ?? '';
    expect(smooth).toContain('MIT License');
    expect(smooth).toContain('Lenis');
    expect(smooth).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(file('index.html')).toContain('<script defer src="assets/ck-smooth-scroll.js"></script>');
    expect(file('menu/index.html')).toContain('<script defer src="../assets/ck-smooth-scroll.js"></script>');
    expect(file('assets/site.css')).toContain('html.lenis');
  });

  it('ships none of it when nothing asks: one page, no library, no motion', async () => {
    const file = await exportCode([{ address: '/', tree: plainTree }]);
    expect(file('assets/ck-motion.css')).toBeUndefined();
    expect(file('assets/ck-smooth-scroll.js')).toBeUndefined();
    expect(file('assets/ck-behaviors.js')).toBeUndefined();
    expect(file('assets/site.css')).toBe(STATIC_BASE_CSS);
    const turnedOff = await exportCode(
      [
        { address: '/', tree: plainTree },
        { address: '/menu', tree: plainTree },
      ],
      { library: { settings: { pageTransitions: false } } },
    );
    expect(turnedOff('assets/site.css')).not.toContain('@view-transition');
  });

  it('compiles the classes the RENDERED page carries, so expanded named styles get CSS', async () => {
    const compileClasses = vi.fn((names: Iterable<string>) =>
      Promise.resolve([...names].includes('rounded-lg') ? '.rounded-lg{border-radius:.5rem}' : ''),
    );
    const file = await exportCode([{ address: '/', tree: animatedTree }], { library: designLibrary, compileClasses });
    expect(compileClasses).toHaveBeenCalled();
    expect(file('assets/site.css')).toContain('.rounded-lg{border-radius:.5rem}');
  });
});
