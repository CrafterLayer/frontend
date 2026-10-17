// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';
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
  The Table and Chart blocks publish as the canvas draws them: a semantic
  table, and a chart that is plain SVG plus HTML labels — no chart library and
  no client script. Every utility they render (fill-/stroke- tones with opacity
  steps, `rtl:` mirroring, container-query label thinning) must have a rule in
  the stylesheet the page links, exactly as publish-registered-blocks.test.ts
  proves for the landing page.
*/

const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

function selectorOf(name: string): string {
  return `.${name.replace(/[^\w-]/gu, (char) => `\\${char}`)}`;
}

const CATEGORIES = Array.from({ length: 10 }, (_, index) => `M${String(index + 1)}`);

const DATA_BLOCKS: readonly { readonly type: string; readonly props: Record<string, unknown> }[] = [
  { type: 'table', props: { title: 'Services', caption: 'Prices include tax.', striped: true } },
  { type: 'table', props: { variant: 'minimal', density: 'compact', tone: 'dark' } },
  { type: 'chart', props: { title: 'Revenue', showValues: true, valuePrefix: '$' } },
  { type: 'chart', props: { chartType: 'bar', stacked: true, showValues: true, palette: 'mixed' } },
  {
    type: 'chart',
    props: {
      chartType: 'line',
      palette: 'accent',
      categories: CATEGORIES,
      series: [
        { name: 'A', values: CATEGORIES.map((_, index) => index + 1) },
        { name: 'B', values: CATEGORIES.map((_, index) => 10 - index) },
        { name: 'C', values: CATEGORIES.map(() => 5) },
      ],
    },
  },
  { type: 'chart', props: { chartType: 'area', stacked: true, palette: 'success' } },
  {
    type: 'chart',
    props: {
      chartType: 'donut',
      showValues: true,
      palette: 'mono',
      variant: 'plain',
      tone: 'dark',
    },
  },
  { type: 'chart', props: { chartType: 'pie', height: 'lg' } },
  // 2026-10-12: the added chart types and the report.
  {
    type: 'chart',
    props: {
      chartType: 'hbar',
      showValues: true,
      stacked: true,
      categories: ['Close to home or work', 'Recommended by a friend'],
    },
  },
  {
    type: 'chart',
    props: {
      chartType: 'hbar',
      showValues: true,
      series: [{ name: 'Net', values: [5, -3, 2, 1] }],
    },
  },
  { type: 'chart', props: { chartType: 'combo', showValues: true, palette: 'mixed' } },
  {
    type: 'chart',
    props: { chartType: 'scatter', categories: ['10', '20', '35', '50'], showValues: true },
  },
  { type: 'chart', props: { chartType: 'radar', maxValue: 100, height: 'lg' } },
  { type: 'chart', props: { chartType: 'funnel', palette: 'accent' } },
  {
    type: 'chart',
    props: {
      chartType: 'gauge',
      categories: ['Uptime', 'Speed', 'Care', 'Quality'],
      series: [{ name: 'Score', values: [99, 82, 71, 64] }],
      maxValue: 100,
      targetValue: 80,
      valueSuffix: '%',
    },
  },
  {
    type: 'chart',
    props: {
      chartType: 'gauge',
      series: [{ name: 'NPS', values: [72] }],
      categories: ['NPS'],
      height: 'sm',
    },
  },
  { type: 'chart', props: { chartType: 'sparkline', height: 'lg', palette: 'mixed' } },
  {
    type: 'report',
    props: { summary: 'Revenue rose every quarter.', valuePrefix: '$', chartType: 'combo' },
  },
  {
    type: 'report',
    props: { variant: 'plain', tone: 'dark', showTable: false, chartType: 'funnel' },
  },
];

describe('publishing the data blocks', () => {
  it('ships a semantic table and a script-free SVG chart with a rule for every class', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    for (const block of DATA_BLOCKS) {
      kernel.dispatch('insertNode', {
        type: block.type,
        parentId: kernel.getDocument().rootId,
        props: block.props,
      });
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
    const css = files.find(({ path }) => path === sheet)?.content ?? '';

    /* The markup: real tables, named SVG images, and the screen-reader data tables. */
    expect(html).toContain('<th scope="col"');
    expect(html).toContain('<th scope="row"');
    expect(html).toContain('<caption');
    expect((html.match(/<svg[^>]*role="img"/gu) ?? []).length).toBeGreaterThanOrEqual(12);
    /* A gauge's dials and a sparkline's rows are one named image around their small SVGs. */
    expect((html.match(/<div[^>]*role="img"/gu) ?? []).length).toBe(3);
    expect(html).toContain('data-report-kpis');
    expect(html).toContain('data-report-change');
    expect(html).toContain('data-chart-table');
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).not.toMatch(/data-ck-(part|bind)/u);

    /* Every utility the data blocks render has a rule. */
    const blocks = [...html.matchAll(/<section[^>]*>[\s\S]*?<\/section>/gu)]
      .map((match) => match[0])
      .filter(
        (markup) =>
          markup.includes('data-chart') ||
          markup.includes('data-table-scroll') ||
          markup.includes('data-report-content'),
      );
    expect(blocks.length).toBe(DATA_BLOCKS.length);
    const classes = new Set(
      blocks.flatMap((markup) =>
        [...markup.matchAll(/class="([^"]*)"/gu)].flatMap((match) =>
          (match[1] ?? '').split(/\s+/u),
        ),
      ),
    );
    const utilities = [...classes].filter((name) => name !== '' && compiler.isUtilityClass(name));
    for (const expected of [
      'fill-accent',
      'fill-accent/55',
      'stroke-accent/55',
      'bg-accent/55',
      'fill-current',
      'stroke-surface',
      'stroke-surface-inverse',
      'fill-surface',
      'rtl:-scale-x-100',
      'rtl:translate-x-1/2',
      '@max-3xl:invisible',
      'even:bg-current/5',
      'sr-only',
      'rtl:translate-x-full',
      '-translate-x-full',
      'max-w-28',
      '@sm:grid-cols-2',
      '@4xl:grid-cols-4',
      'text-success',
      'border-s-2',
    ]) {
      expect(utilities, expected).toContain(expected);
    }
    const missing = utilities.filter((name) => !css.includes(selectorOf(name)));
    expect(missing).toEqual([]);
  }, 60_000);
});
