// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';
import {
  LATEST_SITE_VERSION,
  createLiveUtilities,
  darkTheme,
  defaultDesignSystem,
  lightTheme,
  type BuilderDocument,
  type BuilderSite,
  type Theme,
} from '@craftkit/builder';

import { createPlaygroundKernel } from '../preview/create-playground-kernel';

import { exportCompilers } from './export-compilers';
import { publishStaticSite } from './publish-static-site';

/*
  Fix pass 2026-10-06 (D03-export-top.png): the published site lost every
  registered block's styling — assets/site.css held the base reset and the
  scoped custom-code classes only, so 262 of the 289 classes in index.html had
  no rule and the hero's h1 rendered 16px black. This publishes the landing
  fixture (registered blocks only) through the REAL Tailwind compiler and
  proves every utility the page renders has a rule in the stylesheet it links.
*/

const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

/** A class as Tailwind writes it in a selector: `md:p-4` → `md\:p-4`. */
function selectorOf(name: string): string {
  return `.${name.replace(/[^\w-]/gu, (char) => `\\${char}`)}`;
}

function siteFor(document: BuilderDocument, theme: Theme = lightTheme): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: document.dir,
    pages: [
      { id: 'home', address: '/', title: 'Home', purpose: '', audience: '', document, regions: [] },
    ],
    sharedRegions: {},
    designSystem: { ...defaultDesignSystem(), tokens: theme },
    assets: {},
  };
}

async function publishWithCompiler(
  site: BuilderSite,
  kernel: ReturnType<typeof createPlaygroundKernel>,
  compileDocument?: (document: BuilderDocument) => Promise<string>,
) {
  const compiler = await createLiveUtilities({ tailwindThemeCss });
  try {
    const compilers = exportCompilers({ site, liveSheet: '', compiler });
    const files = await publishStaticSite(site, {
      blocks: kernel.context.registry.block,
      ...compilers,
      ...(compileDocument === undefined ? {} : { compileCss: compileDocument }),
    });
    const html = files.find(({ path }) => path === 'index.html')?.content ?? '';
    const sheet = /href="([^"]+\.css)"/u.exec(html)?.[1] ?? '';
    const css = files.find(({ path }) => path === sheet)?.content ?? '';
    return { html, css, files };
  } finally {
    compiler.dispose();
  }
}

describe('publishing registered blocks', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)(
    'keeps dark slabs and responsive comparisons in the %s palette',
    async (_name, theme) => {
      const kernel = createPlaygroundKernel({ fixture: 'empty' });
      for (const block of [
        { type: 'hero', props: { heading: 'Readable slab', tone: 'dark' } },
        {
          type: 'comparisonTable',
          props: {
            heading: 'Choose a plan',
            tone: 'dark',
            plans: [
              { name: 'Starter', price: '$19' },
              { name: 'Growth', price: '$49' },
            ],
            rows: [{ feature: 'Projects', values: ['3', 'Unlimited'] }],
          },
        },
      ]) {
        kernel.dispatch('insertNode', {
          type: block.type,
          parentId: kernel.getDocument().rootId,
          props: block.props,
        });
      }
      expect(kernel.validate()).toEqual([]);
      const { html, css } = await publishWithCompiler(siteFor(kernel.getDocument(), theme), kernel);
      expect(html).toContain('mkt-slab');
      expect(html).toContain('mkt-compare__table');
      expect(html).toContain('mkt-compare__cards');
      // These owner rules keep a dark section dark even when the inverse palette is light.
      expect(css.includes('.mkt-slab.bg-surface-inverse')).toBe(true);
      expect(
        css.includes('--mkt-slab-ground: oklch(from var(--t-surface-inverse) min(l, 0.27) c h)'),
      ).toBe(true);
      expect(css.includes('--mkt-slab-ink: oklch(from var(--t-text-inverse) max(l, 0.97)')).toBe(
        true,
      );
      expect(css).toMatch(/\.mkt-compare__cards\s*\{\s*display:\s*none/u);
      expect(css).toMatch(/@container \(width < 40rem\)/u);
      expect(css).toMatch(/\.mkt-compare__table\s*\{\s*display:\s*none/u);
      expect(css).toMatch(/\.mkt-compare__cards\s*\{\s*display:\s*grid/u);
      expect(css.match(/\.mkt-section\s*\{/gu)).toHaveLength(1);
    },
    60_000,
  );

  it('includes owner CSS once when only shared header and footer use marketing blocks', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    const main = kernel.getDocument();
    const region = (type: string): BuilderDocument => {
      const regionKernel = createPlaygroundKernel({ fixture: 'empty' });
      regionKernel.dispatch('insertNode', {
        type,
        parentId: regionKernel.getDocument().rootId,
        props: { tone: 'dark' },
      });
      return regionKernel.getDocument();
    };
    const base = siteFor(main);
    const site: BuilderSite = {
      ...base,
      pages: base.pages.map((page) => ({ ...page, regions: ['header', 'footer'] })),
      sharedRegions: {
        header: { id: 'header', kind: 'header', document: region('pageHeader') },
        footer: { id: 'footer', kind: 'footer', document: region('pageFooter') },
      },
    };
    // Distinct callbacks prevent whole-sheet deduplication from concealing repeated owner CSS.
    const { html, css } = await publishWithCompiler(site, kernel, (document) =>
      Promise.resolve(
        `/* ${Object.values(document.nodes)
          .map((node) => node.type)
          .join(' ')} */`,
      ),
    );
    expect(html).toContain('mkt-slab');
    expect(css.includes('.mkt-slab.bg-surface-inverse')).toBe(true);
    expect(css.match(/\.mkt-section\s*\{/gu)).toHaveLength(1);
  }, 60_000);

  it('omits marketing CSS from a custom-code-only page', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    kernel.dispatch('insertNode', {
      type: 'customCode',
      parentId: kernel.getDocument().rootId,
      props: {
        tree: {
          kind: 'root',
          children: [{ kind: 'element', tag: 'h1', text: 'Custom page', className: 'p-4' }],
        },
      },
    });
    const { html, css } = await publishWithCompiler(siteFor(kernel.getDocument()), kernel);
    expect(html).toContain('Custom page');
    expect(css).toContain('.p-4');
    expect(css).not.toContain('.mkt-section');
    expect(css).not.toContain('--mkt-slab-ground');
  }, 60_000);

  it('isolates styles when two pages share one main document but only one has a marketing header', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    const main = kernel.getDocument();
    const headerKernel = createPlaygroundKernel({ fixture: 'empty' });
    headerKernel.dispatch('insertNode', {
      type: 'pageHeader',
      parentId: headerKernel.getDocument().rootId,
      props: { tone: 'dark' },
    });
    const base = siteFor(main);
    const page = base.pages[0]!;
    const site: BuilderSite = {
      ...base,
      pages: [
        { ...page, regions: ['header'] },
        { ...page, id: 'about', address: '/about', regions: [] },
      ],
      sharedRegions: {
        header: { id: 'header', kind: 'header', document: headerKernel.getDocument() },
      },
    };
    const { html, css, files } = await publishWithCompiler(site, kernel);
    expect(html).toContain('mkt-slab');
    expect(css.includes('.mkt-slab.bg-surface-inverse')).toBe(true);
    expect(css.match(/\.mkt-section\s*\{/gu)).toHaveLength(1);
    const about = files.find(({ path }) => path === 'about/index.html')?.content ?? '';
    const aboutSheet = /href="([^"]+\.css)"/u.exec(about)?.[1]?.replace(/^\.\.\//u, '') ?? '';
    const aboutCss = files.find(({ path }) => path === aboutSheet)?.content ?? '';
    expect(aboutCss).not.toContain('.mkt-section');
  }, 60_000);

  it('keeps document CSS and adds owner rules without an original class compiler callback', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    kernel.dispatch('insertNode', {
      type: 'hero',
      parentId: kernel.getDocument().rootId,
      props: { tone: 'dark' },
    });
    const files = await publishStaticSite(siteFor(kernel.getDocument()), {
      blocks: kernel.context.registry.block,
      compileCss: () => Promise.resolve('.external-css{color:var(--t-text)}'),
    });
    const html = files.find(({ path }) => path === 'index.html')?.content ?? '';
    const sheet = /href="([^"]+\.css)"/u.exec(html)?.[1] ?? '';
    const css = files.find(({ path }) => path === sheet)?.content ?? '';
    expect(css).toContain('.external-css{color:var(--t-text)}');
    expect(css.includes('.mkt-slab.bg-surface-inverse')).toBe(true);
    expect(css.match(/\.mkt-section\s*\{/gu)).toHaveLength(1);
  });

  it('ships a rule for every utility class the published page renders', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const site: BuilderSite = {
      siteVersion: LATEST_SITE_VERSION,
      dir: kernel.getDocument().dir,
      pages: [
        {
          id: 'home',
          address: '/',
          title: 'Home',
          purpose: '',
          audience: '',
          document: kernel.getDocument(),
          regions: [],
        },
      ],
      sharedRegions: {},
      designSystem: defaultDesignSystem(),
      assets: {},
    };
    const compiler = await createLiveUtilities({ tailwindThemeCss });
    const { compileCss, compileClasses } = exportCompilers({ site, liveSheet: '', compiler });
    const files = await publishStaticSite(site, {
      blocks: kernel.context.registry.block,
      compileCss,
      ...(compileClasses === undefined ? {} : { compileClasses }),
    });
    const html = files.find(({ path }) => path === 'index.html')?.content ?? '';
    const sheet = /href="([^"]+\.css)"/u.exec(html)?.[1]?.replace(/^\.\//u, '') ?? '';
    const css = files.find(({ path }) => path === sheet)?.content ?? '';
    const body = html.slice(html.indexOf('<body'));
    const classes = new Set(
      [...body.matchAll(/class="([^"]*)"/gu)].flatMap((match) => (match[1] ?? '').split(/\s+/u)),
    );
    const utilities = [...classes].filter((name) => name !== '' && compiler.isUtilityClass(name));
    expect(utilities.length).toBeGreaterThan(20);
    const missing = utilities.filter((name) => !css.includes(selectorOf(name)));
    expect(missing).toEqual([]);
    // The token bridge resolves block colours through the theme, with its fallbacks.
    expect(css).toMatch(/var\(--t-/u);
  }, 60_000);
});
