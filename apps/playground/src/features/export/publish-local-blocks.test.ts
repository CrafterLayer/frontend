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
  The local-business blocks publish as the canvas draws them: a timeline as an
  ordered list, a menu with isolated prices, a location with OpenStreetMap
  links (and an embed only when asked), and a countdown whose date is plain
  text and whose clock the `countdown-clock` pack — shipped in
  assets/ck-behaviors.js only because the page carries its marker — brings to
  life. Every utility they render must have a rule in the linked stylesheet,
  exactly as publish-registered-blocks.test.ts proves for the landing page.
*/

const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

function selectorOf(name: string): string {
  return `.${name.replace(/[^\w-]/gu, (char) => `\\${char}`)}`;
}

const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

const LOCAL_BLOCKS: readonly { readonly type: string; readonly props: Record<string, unknown> }[] = [
  { type: 'timeline', props: {} },
  { type: 'timeline', props: { layout: 'alternating', tone: 'dark', eyebrow: 'History' } },
  {
    type: 'menuSection',
    props: {
      currency: 'ر.س',
      note: 'Prices include VAT.',
      categories: [
        { name: 'Grill', items: [{ name: 'Kebab', price: '42', tags: ['Popular'], imageSrc: PHOTO, imageAlt: 'Kebab' }] },
      ],
    },
  },
  { type: 'menuSection', props: { priceAlign: 'inline', leaders: false, columns: '1', tone: 'dark' } },
  {
    type: 'location',
    props: {
      phone: '+966 11 456 7890',
      email: 'hello@example.com',
      whatsapp: '+966 50 123 4567',
      latitude: 24.7136,
      longitude: 46.6753,
      embedMap: true,
      hoursNote: 'Closed on Eid.',
    },
  },
  { type: 'location', props: { layout: 'stacked', tone: 'dark' } },
  {
    type: 'countdown',
    props: { timezoneLabel: 'Riyadh time', actionLabel: 'Register', actionHref: '/register', variant: 'cards' },
  },
  { type: 'countdown', props: { variant: 'minimal', tone: 'dark', showSeconds: false, dateLanguage: 'ar' } },
];

describe('publishing the local-business blocks', () => {
  it('ships their semantic markup, the countdown pack, and a rule for every class', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    for (const block of LOCAL_BLOCKS) {
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
        { id: 'home', address: '/', title: 'Home', purpose: '', audience: '', document: kernel.getDocument(), regions: [] },
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
    const runtime = files.find(({ path }) => path === 'assets/ck-behaviors.js')?.content ?? '';

    /* The markup. */
    expect(html).toMatch(/<ol[^>]*data-timeline-layout="alternating"/u);
    expect(html).toContain('<bdi>');
    expect(html).toContain('data-menu-leader="dotted"');
    expect(html).toContain('<address');
    expect(html).toContain('href="https://wa.me/966501234567"');
    expect(html).toContain('href="tel:+966114567890"');
    expect(html).toMatch(/<iframe[^>]*loading="lazy"[^>]*referrerPolicy="no-referrer"|<iframe[^>]*referrerpolicy="no-referrer"/iu);
    expect(html).toContain('https://www.openstreetmap.org/export/embed.html?bbox=');
    expect((html.match(/data-ck-behavior="countdown-clock"/gu) ?? []).length).toBe(2);
    expect(html).toMatch(/<time[^>]*dateTime="2027-03-01T10:00:00\+03:00"|<time[^>]*datetime="2027-03-01T10:00:00\+03:00"/iu);
    expect(html).not.toMatch(/data-ck-(part|bind)/u);

    /* The countdown pack ships, because the page carries its marker. */
    expect(runtime).toContain('function mountCountdown');
    expect(html).toContain('ck-behaviors.js');

    /* Every utility the four blocks render has a rule. */
    const blocks = [...html.matchAll(/<section[^>]*>[\s\S]*?<\/section>/gu)]
      .map((match) => match[0])
      .filter((markup) => /data-(timeline|menu|location|countdown)-content/u.test(markup));
    expect(blocks.length).toBe(LOCAL_BLOCKS.length);
    const classes = new Set(
      blocks.flatMap((markup) =>
        [...markup.matchAll(/class="([^"]*)"/gu)].flatMap((match) => (match[1] ?? '').split(/\s+/u)),
      ),
    );
    const utilities = [...classes].filter((name) => name !== '' && compiler.isUtilityClass(name));
    for (const expected of [
      '@3xl:start-3',
      '@3xl:-start-3',
      '@3xl:flex-row-reverse',
      'border-dashed',
      'border-dotted',
      'whitespace-nowrap',
      'not-italic',
      'aspect-video',
      'sr-only',
      'bg-current/20',
    ]) {
      expect(utilities, expected).toContain(expected);
    }
    const missing = utilities.filter((name) => !css.includes(selectorOf(name)));
    expect(missing).toEqual([]);
  }, 60_000);
});
