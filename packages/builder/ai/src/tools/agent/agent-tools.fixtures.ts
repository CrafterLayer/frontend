import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  pageSeoSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../../plan/tree-markup';
import { validateAiPlan } from '../../plan/validate-plan';
import type { AiPlanValidationResult } from '../../types';
import { expandAgentTools } from './expand';
import { readPageKit, writePageKit } from './page-kit';
import type { AgentToolContext } from './types';

/*
  Test-only: a kernel shaped like the product's (a page root with title,
  description, slug, lang and pageCss; customCode regions with label, tree and
  css) so every tool's output is judged by the real door.
*/

const NullRender: BlockRenderComponent = () => null;

export const agentToolsFixtureBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'agent-tools-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({
            title: z.string().max(120).default(''),
            description: z.string().max(200).default(''),
            slug: z.string().max(120).default(''),
            lang: z.string().max(12).default(''),
            pageCss: customCss(20_000),
            socialTitle: z.string().max(120).optional(),
            socialDescription: z.string().max(200).optional(),
            seo: pageSeoSchema.optional(),
          }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(8_000),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

export const CAFE_PHOTO =
  'https://images.pexels.com/photos/30146018/pexels-photo-30146018.jpeg?auto=compress&cs=tinysrgb&w=1600';

type Region = readonly [id: string, label: string, markup: string];

const EN_REGIONS: readonly Region[] = [
  [
    'r-header',
    'Header',
    "<header class='flex items-center gap-4 py-4'><a class='ck-link' href='#top'>Brew</a><nav class='flex gap-4'><a class='ck-link' href='#menu'>Old menu</a><a class='ck-link' href='#gone'>Gone</a></nav><a class='ck-btn' href='#visit'>Order</a></header>",
  ],
  [
    'r-hero',
    'Hero',
    `<section id='hero' class='py-16 text-left'><h1 class='text-5xl'>Fresh coffee daily</h1><p class='rounded-r-lg border-r'>Roasted every morning.</p><img src='${CAFE_PHOTO}' alt='Coffee'/><a class='ck-btn' href='#menu'>See the menu<icon name='arrow-right'/></a></section>`,
  ],
  [
    'r-menu',
    'Menu',
    "<section id='menu' class='py-16'><h2 class='text-3xl'>Our menu</h2><p>Espresso</p><p class='rounded-l-lg border-l'>Latte</p><icon name='coffee'/></section>",
  ],
  [
    'r-story',
    'Story',
    "<section id='story' class='py-16'><h2 class='text-3xl'>Our story</h2><p>Since 1998.</p></section>",
  ],
  [
    'r-footer',
    'Footer',
    "<footer class='py-8'><nav><ul class='space-y-2'><li><a class='ck-link' href='#menu'>Menu</a></li></ul></nav><p>© Brew</p></footer>",
  ],
];

const AR_REGIONS: readonly Region[] = [
  [
    'r-header',
    'الترويسة',
    "<header class='flex items-center gap-4 py-4'><a class='ck-link' href='#top'>بُن</a><nav class='flex gap-4'><a class='ck-link' href='#menu'>القائمة القديمة</a></nav></header>",
  ],
  [
    'r-hero',
    'الرئيسية',
    `<section id='hero' class='py-16'><h1 class='text-5xl'>قهوة تُحمّص كل صباح</h1><p class='ms-4'>من المزرعة إلى فنجانك.</p><img src='${CAFE_PHOTO}' alt='قهوة'/><a class='ck-btn' href='#menu'>اطلب الآن<icon name='arrow-left'/></a></section>`,
  ],
  [
    'r-menu',
    'الأسعار',
    "<section id='menu' class='py-16'><h2 class='text-3xl'>الأسعار</h2><p>إسبريسو</p><p>لاتيه</p></section>",
  ],
  [
    'r-story',
    'قصتنا',
    "<section id='story' class='py-16'><h2 class='text-3xl'>قصتنا</h2><p>منذ ١٩٩٨.</p></section>",
  ],
  [
    'r-footer',
    'التذييل',
    "<footer class='py-8'><nav><ul class='space-y-2'><li><a class='ck-link' href='#menu'>الأسعار</a></li></ul></nav></footer>",
  ],
];

export interface FixtureOptions {
  readonly locale?: 'ar' | 'en';
  /** Write a kit block into pageCss (default true). */
  readonly kit?: boolean;
}

/** The kit block a page plan would have written, for a page with the default look. */
export function kitCss(locale: 'ar' | 'en'): string {
  const { state } = readPageKit('', locale === 'ar');
  return writePageKit('', { ...state, hasHeader: true }, { lang: locale, dir: locale === 'ar' ? 'rtl' : 'ltr' });
}

export function fixtureDocument(options: FixtureOptions = {}): BuilderDocument {
  const locale = options.locale ?? 'en';
  const regions = locale === 'ar' ? AR_REGIONS : EN_REGIONS;
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: {
          title: locale === 'ar' ? 'بُن' : 'Brew',
          description: '',
          slug: '',
          lang: locale,
          pageCss: options.kit === false ? '' : kitCss(locale),
        },
        slots: { default: regions.map(([id]) => id) },
      },
      ...Object.fromEntries(
        regions.map(([id, label, markup]) => [
          id,
          { id, type: 'customCode', props: { label, tree: parseTreeMarkup(markup), css: '' }, slots: {} },
        ]),
      ),
    },
  } as unknown as BuilderDocument;
}

export function fixtureKernel(options: FixtureOptions = {}): BuilderKernel {
  return createBuilder({
    document: fixtureDocument(options),
    extensions: [agentToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('agent-tools') },
  });
}

/** A tool context over the live page (no earlier steps). */
export function liveContext(kernel: BuilderKernel): AgentToolContext {
  const document = kernel.getDocument();
  const lang = document.nodes[document.rootId]?.props['lang'];
  return {
    kernel,
    readProp: (id, key) => kernel.getDocument().nodes[id]?.props[key],
    locale: { lang: typeof lang === 'string' && lang !== '' ? lang : 'en', dir: document.dir === 'rtl' ? 'rtl' : 'ltr' },
    sampleValues: [],
  };
}

export function toolPlan(name: string, input: unknown, title?: string) {
  return {
    rationale: `use ${name}`,
    commands: [{ command: 'tool', args: { name, input }, ...(title === undefined ? {} : { title }) }],
  };
}

/** Expand a one-tool plan and judge it with the real door. */
export function expandAndValidate(
  kernel: BuilderKernel,
  name: string,
  input: unknown,
): { readonly issues: readonly string[]; readonly result?: AiPlanValidationResult; readonly plan: unknown } {
  const expanded = expandAgentTools(toolPlan(name, input), kernel);
  if (expanded.issues.length > 0) return { issues: expanded.issues.map(({ message }) => message), plan: expanded.plan };
  const result = validateAiPlan(expanded.plan, kernel, { clock: fixedClock(2), ids: seededIds('agent-tools-door') });
  return { issues: result.ok ? [] : result.issues.map(({ message }) => message), result, plan: expanded.plan };
}
