import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';
import {
  LATEST_SITE_VERSION,
  createLiveUtilities,
  defaultDesignSystem,
  type BuilderSite,
} from '@craftkit/builder';

import { createPlaygroundKernel } from '../preview/create-playground-kernel';

import { exportCompilers } from './export-compilers';
import { publishStaticSite } from './publish-static-site';

/*
  The Table block's sort, search and pages publish as a static table plus the
  `table-tools` behaviour pack: the page carries the pack only when one of its
  tables turns a tool on, every utility the tools render has a rule in the
  linked stylesheet, and the published page — no React — sorts, filters and
  pages once its runtime runs. Siblings: publish-data-blocks.test.ts (the
  plain table) and publish-local-blocks.test.ts (the countdown pack).
*/

const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

function selectorOf(name: string): string {
  return `.${name.replace(/[^\w-]/gu, (char) => `\\${char}`)}`;
}

const PARTS = {
  title: 'Spare parts',
  columns: [
    { label: 'Part', align: 'start' },
    { label: 'Stock', align: 'end' },
    { label: 'Price', align: 'end' },
    { label: 'Restocked', align: 'end' },
  ],
  rows: [
    { cells: ['Brake pads', '42', '$38.00', '2026-09-28'] },
    { cells: ['Oil filter', '120', '$9.50', '2026-10-02'] },
    { cells: ['Air filter', '64', '$14.00', '15/09/2026'] },
    { cells: ['Spark plug set', '35', '$22.00', '2026-08-30'] },
    { cells: ['Timing belt', '12', '', '2026-07-21'] },
  ],
};

const TOOLS = { sortable: true, searchable: true, pageSize: 3, stickyHeader: true, striped: true };

async function publish(tables: readonly Record<string, unknown>[]) {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  for (const props of tables) {
    kernel.dispatch('insertNode', { type: 'table', parentId: kernel.getDocument().rootId, props });
  }
  expect(kernel.validate()).toEqual([]);
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
  return {
    html,
    css: files.find(({ path }) => path === sheet)?.content ?? '',
    runtime: files.find(({ path }) => path === 'assets/ck-behaviors.js')?.content ?? '',
    compiler,
  };
}

const firstCells = (root: ParentNode) =>
  [...root.querySelectorAll('tbody tr')]
    .filter((row) => !row.hasAttribute('hidden'))
    .map((row) => row.firstElementChild?.textContent);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('publishing the Table block’s tools', () => {
  it('ships the table-tools pack, its markup and a rule for every class the tools render', async () => {
    const { html, css, runtime, compiler } = await publish([{ ...PARTS, ...TOOLS }]);

    /* The markup: the whole table, the tools hidden until the pack runs. */
    expect((html.match(/data-ck-behavior="table-tools"/gu) ?? []).length).toBe(1);
    expect(html).toContain('data-ck-page-size="3"');
    expect(html).toContain('<template data-ck-table-button=""');
    expect(html).toMatch(/<th[^>]*data-ck-table-sort="number"/u);
    expect(html).toMatch(/data-ck-key="38"/u);
    expect(html).toMatch(/<div[^>]*hidden=""[^>]*data-ck-table-search=""/u);
    expect(html).toMatch(/<nav[^>]*hidden=""[^>]*data-ck-table-pager=""/u);
    expect(html).not.toMatch(/data-ck-(part|bind)/u);

    /* The pack ships, because the page carries its marker. */
    expect(runtime).toContain('function mountTableTools');
    expect(html).toContain('ck-behaviors.js');

    /* Every utility the table renders has a rule — the template's sort arrows included. */
    const table = [...html.matchAll(/<section[^>]*>[\s\S]*?<\/section>/gu)]
      .map((match) => match[0])
      .filter((markup) => markup.includes('data-table-scroll'));
    expect(table).toHaveLength(1);
    const classes = new Set(
      table.flatMap((markup) =>
        [...markup.matchAll(/class="([^"]*)"/gu)].flatMap((match) =>
          (match[1] ?? '').split(/\s+/u),
        ),
      ),
    );
    const utilities = [...classes].filter((name) => name !== '' && compiler.isUtilityClass(name));
    for (const expected of [
      'group-data-sort-up:opacity-100',
      'group-data-sort-down:opacity-0',
      'aria-disabled:opacity-40',
      'max-h-[70vh]',
      'sticky',
      'rtl:-scale-x-100',
      'placeholder:text-text-muted',
      'ps-9',
    ]) {
      expect(utilities, expected).toContain(expected);
    }
    const missing = utilities.filter((name) => !css.includes(selectorOf(name)));
    expect(missing).toEqual([]);
  }, 60_000);

  it('leaves the pack off a page whose tables use no tool', async () => {
    const { html, runtime } = await publish([PARTS, { ...PARTS, stickyHeader: true }]);
    expect(html).not.toContain('table-tools');
    expect(html).not.toContain('<template');
    expect(runtime).not.toContain('function mountTableTools');
  }, 60_000);

  it('sorts, filters and pages on the published page, with no React', async () => {
    const { html, runtime } = await publish([{ ...PARTS, ...TOOLS }]);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.body.replaceWith(document.importNode(parsed.body, true));
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the published runtime IS the test
    new Function('document', runtime)(document);

    const section = document.querySelector('[data-ck-behavior="table-tools"]')!;
    expect(section.querySelector('[data-ck-table-search]')).not.toHaveAttribute('hidden');
    expect(section.querySelector('[role="status"]')).toHaveTextContent('5 of 5 rows');
    expect(firstCells(section)).toEqual(['Brake pads', 'Oil filter', 'Air filter']);
    expect(section.querySelector('[data-ck-table-page]')).toHaveTextContent('Page 1 of 2');

    const price = section.querySelectorAll('thead th')[2]!;
    price.querySelector('button')!.click();
    expect(price).toHaveAttribute('aria-sort', 'ascending');
    expect(price).toHaveAttribute('data-sort-up', '');
    expect(firstCells(section)).toEqual(['Oil filter', 'Air filter', 'Spark plug set']);
    section.querySelector<HTMLButtonElement>('[data-ck-table-next]')!.click();
    /* The row without a price sorts last. */
    expect(firstCells(section)).toEqual(['Brake pads', 'Timing belt']);

    const restocked = section.querySelectorAll('thead th')[3]!;
    restocked.querySelector('button')!.click();
    expect(firstCells(section)).toEqual(['Timing belt', 'Spark plug set', 'Air filter']);

    const input = section.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'FILTER';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(firstCells(section)).toEqual(['Air filter', 'Oil filter']);
    expect(section.querySelector('[role="status"]')).toHaveTextContent('2 of 5 rows');
    expect(section.querySelector('[data-ck-table-page]')).toHaveTextContent('Page 1 of 1');
  }, 60_000);
});
