import { z } from 'zod';

import { createBuilder, createSiteBuilder, type BuilderKernel, type BuilderSiteKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCss,
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type BuilderSite,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import { onePageSite } from '@craftkit/builder-schema/testing';

import { parseTreeMarkup } from '../plan/tree-markup';
import { resolveAiCommandPolicy } from '../skills/command-policy';
import { KIT_PAGE_CSS } from '../section-kit/kit-testing';
import { partToolsFixtureBlocks } from '../style-tools/part-tools.fixtures';
import { treeCommandsFixture } from '../style-tools/style-tools.fixtures';
import { agentToolsFixtureBlocks } from '../tools/agent/agent-tools.fixtures';
import type { ScriptSite } from './element-index';
import type { ScriptPage } from './types';

/*
  Test-only (agent-script script-host): pages shaped like the product's, so a
  script's expansion is judged by the real door —
  - an Arabic landing page: customCode regions with headings, buttons, cards
    and images, plus registered blocks (hero + two CTAs, a features list);
  - fourteen buttons over three regions, the round-every-button case;
  - an empty menu block, the "add 12 dishes" case;
  - a two-page site, for writes across pages.
*/

const NullRender: BlockRenderComponent = () => null;

const PAGE = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({
    title: z.string().max(120).default(''),
    description: z.string().max(200).default(''),
    slug: z.string().max(120).default(''),
    lang: z.string().max(12).default(''),
    pageCss: customCss(20_000),
  }),
  slots: { default: { allow: ['customCode', 'hero', 'features', 'richText'] } },
  examples: [],
});

function blockOf(manifest: TrustedExtensionManifest, type: string) {
  const block = manifest.contributes?.blocks?.find((entry) => entry.schema.type === type);
  if (block === undefined) throw new Error(`fixture: no ${type} block`);
  return block;
}

/** The page root, customCode, and the part-tools blocks (hero, cta, features, richText). */
export const scriptFixtureBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'script-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: PAGE, render: NullRender },
      blockOf(agentToolsFixtureBlocks, 'customCode'),
      blockOf(partToolsFixtureBlocks, 'hero'),
      blockOf(partToolsFixtureBlocks, 'cta'),
      blockOf(partToolsFixtureBlocks, 'features'),
      blockOf(partToolsFixtureBlocks, 'richText'),
    ],
  },
};

export const SCRIPT_PHOTO = 'https://images.pexels.com/photos/30146018/pexels-photo-30146018.jpeg?auto=compress&cs=tinysrgb&w=1600';

type Region = readonly [id: string, label: string, markup: string];

/** An Arabic landing page: header, hero, three service cards, a gallery, contact, footer. */
const AR_REGIONS: readonly Region[] = [
  [
    'r-header',
    'الترويسة',
    "<header class='flex items-center gap-4 py-4'><a class='ck-link' href='#top'>بُن</a><nav class='flex gap-4'><a class='ck-link' href='#menu'>القائمة</a><a class='ck-link' href='#story'>قصتنا</a></nav><a class='ck-btn' href='#order'>اطلب</a></header>",
  ],
  [
    'r-hero',
    'الرئيسية',
    `<section id='hero' class='py-16'><h1 class='text-5xl'>قهوة تُحمّص كل صباح</h1><p>من المزرعة إلى فنجانك منذ 1998.</p><img src='${SCRIPT_PHOTO}' alt='قهوة'/><a class='ck-btn' href='#menu'>اطلب الآن<icon name='arrow-left'/></a><a class='ck-btn' href='#story'><span>اعرف أكثر</span></a></section>`,
  ],
  [
    'r-services',
    'خدماتنا',
    "<section id='services' class='py-16'><h2 class='text-3xl'>خدماتنا</h2><div class='grid gap-4'><article class='ck-card p-4'><h3>تحميص</h3><p>نحمّص 3 مرات أسبوعيًا.</p><a class='ck-btn' href='#a'>المزيد</a></article><article class='ck-card p-4'><h3>توصيل</h3><p>خلال 30 دقيقة.</p><a class='ck-btn' href='#b'>المزيد</a></article><div class='ck-card p-4'><h3>تدريب</h3><p>دورات للباريستا.</p></div></div></section>",
  ],
  [
    'r-gallery',
    'المعرض',
    `<section id='gallery' class='py-16'><h2>المعرض</h2><ul class='grid gap-2'><li><img src='${SCRIPT_PHOTO}' alt='فنجان'/></li><li><img src='${SCRIPT_PHOTO}' alt='حبوب'/></li><li>صورة قادمة</li></ul></section>`,
  ],
  [
    'r-contact',
    'تواصل',
    "<section id='contact' class='py-16'><h2>تواصل معنا</h2><p>اتصل بنا: <strong>0790000000</strong></p><input type='email' placeholder='بريدك'/><button type='submit'>أرسل</button></section>",
  ],
  [
    'r-footer',
    'التذييل',
    "<footer class='py-8'><nav><ul class='space-y-2'><li><a class='ck-link' href='#menu'>القائمة</a></li></ul></nav><p>© بُن 2024</p></footer>",
  ],
];

function region(id: string, label: string, markup: string) {
  return { id, type: 'customCode', props: { label, tree: parseTreeMarkup(markup), css: '' }, slots: {} };
}

function root(locale: 'ar' | 'en', children: readonly string[], title = locale === 'ar' ? 'بُن' : 'Brew') {
  return {
    id: 'root',
    type: 'page',
    props: { title, description: '', slug: '', lang: locale, pageCss: KIT_PAGE_CSS },
    slots: { default: [...children] },
  };
}

/** The Arabic landing page: six customCode regions, then a registered hero (+2 CTAs) and features block. */
export function arabicDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: root('ar', [...AR_REGIONS.slice(0, 5).map(([id]) => id), 'hero-1', 'features-1', 'r-footer']),
      ...Object.fromEntries(AR_REGIONS.map(([id, label, markup]) => [id, region(id, label, markup)])),
      'hero-1': {
        id: 'hero-1',
        type: 'hero',
        props: { eyebrow: 'جديد', heading: 'مرحبًا بكم', body: 'أفضل قهوة في عمّان.' },
        slots: { actions: ['cta-1', 'cta-2'] },
      },
      'cta-1': { id: 'cta-1', type: 'cta', props: { label: 'ابدأ الآن', href: '/start' } },
      'cta-2': { id: 'cta-2', type: 'cta', props: { label: 'اقرأ المزيد', href: '/docs' } },
      'features-1': {
        id: 'features-1',
        type: 'features',
        props: {
          heading: 'لماذا نحن',
          items: [
            { title: 'سريع', body: 'خلال يوم.' },
            { title: 'آمن', body: 'باب واحد لكل تعديل.' },
          ],
          link: { label: 'كل الميزات', href: '/features' },
          imageSrc: SCRIPT_PHOTO,
          imageAlt: 'صانع',
        },
      },
    },
  } as unknown as BuilderDocument;
}

function kernelOf(document: BuilderDocument, seed: string): BuilderKernel {
  return createBuilder({
    document,
    extensions: [scriptFixtureBlocks, treeCommandsFixture],
    ports: { clock: fixedClock(1), ids: seededIds(seed) },
  });
}

export function arabicKernel(): BuilderKernel {
  return kernelOf(arabicDocument(), 'script-ar');
}

/** Fourteen buttons over three regions (5 + 5 + 4), the «خلي كل الأزرار مدورة» case. */
export function buttonsDocument(): BuilderDocument {
  const buttons = (count: number, from: number) =>
    Array.from({ length: count }, (_, index) => `<a class='ck-btn' href='#b${String(from + index)}'>Button ${String(from + index)}</a>`).join('');
  const regions: Region[] = [
    ['r-a', 'Hero', `<section id='a' class='py-16'><h1>Welcome</h1>${buttons(5, 1)}</section>`],
    ['r-b', 'Offers', `<section id='b' class='py-16'><h2>Offers</h2><div class='flex gap-2'>${buttons(5, 6)}</div></section>`],
    ['r-c', 'Footer', `<footer class='py-8'><p>Links</p>${buttons(4, 11)}</footer>`],
  ];
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: root('en', regions.map(([id]) => id)),
      ...Object.fromEntries(regions.map(([id, label, markup]) => [id, region(id, label, markup)])),
    },
  } as unknown as BuilderDocument;
}

export function buttonsKernel(): BuilderKernel {
  return kernelOf(buttonsDocument(), 'script-buttons');
}

/** A menu: a features block with an empty card list, the «ضيف 12 طبق» case. */
export function menuDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: root('ar', ['r-intro', 'menu-1']),
      'r-intro': region('r-intro', 'المقدمة', "<section id='intro'><h1>مطعم الجبل</h1></section>"),
      'menu-1': { id: 'menu-1', type: 'features', props: { heading: 'قائمتنا', items: [] } },
    },
  } as unknown as BuilderDocument;
}

export function menuKernel(): BuilderKernel {
  return kernelOf(menuDocument(), 'script-menu');
}

/** Twelve dishes priced 2–8 JOD, written as ONE script. */
export const MENU_SCRIPT = [
  "const d=['حمص','متبل','فلافل','فتوش','تبولة','منسف','مقلوبة','مسخن','كبة','شاورما','كنافة','قطايف']",
  "const m=ck.find({kind:'heading',text:'قائمتنا'})[0]",
  "d.forEach((t,i)=>ck.tool('part.list',{id:m.node,part:'items',op:'add',index:[i],item:{title:t,body:ck.fmt.money(2+Math.round(i*6/11),'JOD')}}))",
].join(';');

/** The same dishes as the plain tool steps a model writes without a script. */
export function menuToolSteps(): readonly { readonly command: string; readonly args: Record<string, unknown> }[] {
  const dishes = ['حمص', 'متبل', 'فلافل', 'فتوش', 'تبولة', 'منسف', 'مقلوبة', 'مسخن', 'كبة', 'شاورما', 'كنافة', 'قطايف'];
  return dishes.map((title, index) => ({
    command: 'tool',
    args: {
      name: 'part.list',
      input: { id: 'menu-1', part: 'items', op: 'add', index: [index], item: { title, body: `${String(2 + Math.round((index * 6) / 11))} د.أ` } },
    },
  }));
}

/** A one-step plan holding a script. */
export function scriptPlan(code: string, title?: string) {
  return {
    rationale: 'script',
    commands: [{ command: 'tool', args: { name: 'script.run', input: { code } }, ...(title === undefined ? {} : { title }) }],
  };
}

export function policyOf(kernel: BuilderKernel) {
  return resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() });
}

export const scriptPorts = () => ({ clock: fixedClock(2), ids: seededIds('script-door') });

// ── Two pages ─────────────────────────────────────────────────────────────────

function pageDocument(locale: 'en', regions: readonly Region[], title: string): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: root(locale, regions.map(([id]) => id), title),
      ...Object.fromEntries(regions.map(([id, label, markup]) => [id, region(id, label, markup)])),
    },
  } as unknown as BuilderDocument;
}

/** A two-page site (home, about), each with a heading that names the brand and a button. */
export function twoPageSite(): { readonly site: BuilderSiteKernel; readonly scriptSite: ScriptSite } {
  const base = onePageSite('ltr');
  const [home] = base.pages;
  if (home === undefined) throw new Error('fixture: no home page');
  const homeDoc = pageDocument(
    'en',
    [['r-h', 'Hero', "<section id='h'><h1>Brew Co</h1><a class='ck-btn' href='#a'>Order</a></section>"]],
    'Home',
  );
  const aboutDoc = pageDocument(
    'en',
    [['r-s', 'Story', "<section id='s'><h2>About Brew Co</h2><p>Since 1998.</p><a class='ck-btn' href='#c'>Contact</a></section>"]],
    'About',
  );
  const site: BuilderSite = {
    ...base,
    pages: [
      { ...home, document: homeDoc },
      { ...home, id: 'about', address: '/about', title: 'About', document: aboutDoc },
    ],
  };
  const kernel = createSiteBuilder({
    site,
    extensions: [scriptFixtureBlocks, treeCommandsFixture],
    ports: { clock: fixedClock(1), ids: seededIds('script-site') },
  });
  const pages: readonly ScriptPage[] = [
    { id: home.id, title: 'Home', slug: '', lang: 'en', dir: 'ltr', current: true },
    { id: 'about', title: 'About', slug: 'about', lang: 'en', dir: 'ltr', current: false },
  ];
  return {
    site: kernel,
    scriptSite: {
      pages: () => pages.map((page) => ({ ...page, current: page.id === kernel.currentPage() })),
      page: (pageId) => kernel.page(pageId),
      currentPage: () => kernel.currentPage(),
    },
  };
}
