import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  motionSpecSchema,
  partStylesProp,
  type BlockParts,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';
import { treeCommandsFixture } from '../style-tools/style-tools.fixtures';

/*
  Test-only (gsap-pixi, 2026-10-08): a page shaped like the PLAYGROUND's
  landing (apps/playground create-playground-kernel.ts `marketingLanding`) —
  an announcement bar, a hero inside an aurora surface, a carousel, features,
  stats, pricing, testimonials, faq, a scroll-zooming image, a footer — each
  registered block declaring the real marketing shape: a `motion` prop
  (MotionSpec) and, where the real one has parts, its parts and `partStyles`.
  The ai package may not import the marketing extension (layer 4), so the
  schemas are re-declared here from the schema package's own helpers; every
  motion.add / media.add step is judged by the real setProp door.
*/

const NullRender: BlockRenderComponent = () => null;

const text = (en: string, ar: string, aliases: readonly string[] = []) => ({
  kind: 'text' as const,
  bind: en.toLowerCase(),
  label: { en, ar },
  aliases,
});

const sectionProps = {
  heading: z.string().max(160).optional(),
  eyebrow: z.string().max(80).optional(),
  body: z.string().max(400).optional(),
  motion: motionSpecSchema.optional(),
  partStyles: partStylesProp(),
};

const HEADED: BlockParts = {
  eyebrow: text('Eyebrow', 'الشارة', ['badge']),
  heading: text('Heading', 'العنوان', ['title', 'headline', 'عنوان']),
  body: { ...text('Body', 'الوصف', ['paragraph']), multiline: true },
};

function listParts(list: string, label: { en: string; ar: string }): BlockParts {
  return {
    ...HEADED,
    [list]: { kind: 'list', bind: list, label, aliases: ['cards', 'list'] },
    item: { kind: 'item', bind: `${list}.*`, list, label: { en: 'Item', ar: 'العنصر' } },
  };
}

const ITEMS = z.array(z.record(z.string(), z.union([z.string(), z.number()]))).max(12).default([]);

function section(type: string, parts: BlockParts, extra: Record<string, z.ZodType> = {}, slots?: Record<string, { allow: string[] }>) {
  return {
    schema: defineBlockSchema({
      type,
      description: `The ${type} section.`,
      props: z.object({ ...sectionProps, ...extra }),
      parts,
      ...(slots === undefined ? {} : { slots }),
      examples: [],
    }),
    render: NullRender,
  };
}

const SECTION_TYPES = [
  'announcementBar',
  'auroraBackground',
  'hero',
  'carousel',
  'features',
  'stats',
  'pricing',
  'testimonials',
  'faq',
  'image',
  'pageFooter',
  'richText',
  'customCode',
];

export const motionBlocksFixture: TrustedExtensionManifest = {
  tier: 1,
  name: 'motion-blocks-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({
            title: z.string().max(120).default(''),
            lang: z.string().max(12).default(''),
            pageCss: customCss(20_000),
          }),
          slots: { default: { allow: SECTION_TYPES } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        // Chrome: motion, no parts (the real announcement bar's shape).
        schema: defineBlockSchema({
          type: 'announcementBar',
          description: 'A one-line notice.',
          props: z.object({ message: z.string().max(200), motion: motionSpecSchema.optional() }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        // A background surface: motion, no parts, one slot holding the hero.
        schema: defineBlockSchema({
          type: 'auroraBackground',
          description: 'An animated aurora behind its children.',
          props: z.object({ tone: z.string().max(20).optional(), motion: motionSpecSchema.optional() }),
          slots: { default: { allow: ['hero'] } },
          examples: [],
        }),
        render: NullRender,
      },
      section('hero', HEADED, {}, { actions: { allow: ['cta'] } }),
      {
        schema: defineBlockSchema({
          type: 'cta',
          description: 'A button.',
          props: z.object({
            label: z.string().max(80),
            href: z.string().max(400).default('#'),
            motion: motionSpecSchema.optional(),
            partStyles: partStylesProp(),
          }),
          parts: { button: { kind: 'link', bind: { text: 'label', href: 'href' }, label: { en: 'Button', ar: 'الزر' } } },
          examples: [],
        }),
        render: NullRender,
      },
      section('carousel', listParts('items', { en: 'Slides', ar: 'الشرائح' }), { items: ITEMS }),
      section('features', listParts('items', { en: 'Features', ar: 'الميزات' }), { items: ITEMS }),
      section('stats', listParts('items', { en: 'Stats', ar: 'الأرقام' }), { items: ITEMS }),
      section('pricing', HEADED),
      section('testimonials', listParts('items', { en: 'Quotes', ar: 'الآراء' }), { items: ITEMS }),
      section('faq', listParts('items', { en: 'Questions', ar: 'الأسئلة' }), { items: ITEMS }),
      {
        schema: defineBlockSchema({
          type: 'image',
          description: 'One image.',
          props: z.object({ src: z.string().max(2000), alt: z.string().max(300), motion: motionSpecSchema.optional() }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        // A container footer: motion, no parts, slots.
        schema: defineBlockSchema({
          type: 'pageFooter',
          description: 'The page footer.',
          props: z.object({ motion: motionSpecSchema.optional() }),
          slots: { body: { allow: ['richText'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        // No motion prop, parts + partStyles: only a part can move.
        schema: defineBlockSchema({
          type: 'richText',
          description: 'Formatted text.',
          props: z.object({ heading: z.string().max(160).optional(), partStyles: partStylesProp() }),
          parts: { heading: text('Heading', 'العنوان') },
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

const items = (count: number, word: string) =>
  Array.from({ length: count }, (_, at) => ({ title: `${word} ${String(at + 1)}`, body: 'Short line.' }));

export interface PlaygroundLikeOptions {
  readonly locale?: 'en' | 'ar';
  /** Add one composed region (a gallery-like story section) after the features. */
  readonly withRegion?: boolean;
}

/** The playground-shaped page. */
export function playgroundLikeDocument(options: PlaygroundLikeOptions = {}): BuilderDocument {
  const locale = options.locale ?? 'en';
  const order = [
    'announcement',
    'aurora',
    'carousel',
    'features',
    ...(options.withRegion === true ? ['r-story'] : []),
    'stats',
    'pricing',
    'quotes',
    'faq',
    'showcase',
    'note',
    'footer',
  ];
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Landing', lang: locale, pageCss: '' }, slots: { default: order } },
      announcement: { id: 'announcement', type: 'announcementBar', props: { message: 'Templates are here.' } },
      aurora: { id: 'aurora', type: 'auroraBackground', props: { tone: 'dark' }, slots: { default: ['hero'] } },
      hero: {
        id: 'hero',
        type: 'hero',
        props: {
          eyebrow: 'The professional website builder',
          heading: 'Build pages your kernel can prove',
          body: 'Every change stays validated and reversible.',
          motion: { reveal: 'fade-up', duration: 'normal', easing: 'ease-out' },
        },
        slots: { actions: ['cta-start'] },
      },
      'cta-start': { id: 'cta-start', type: 'cta', props: { label: 'Get started' } },
      carousel: { id: 'carousel', type: 'carousel', props: { heading: 'A complete visual system', items: items(3, 'Slide') } },
      features: {
        id: 'features',
        type: 'features',
        props: { heading: locale === 'ar' ? 'لماذا كرافت كيت' : 'Why CraftKit', items: items(3, 'Feature') },
      },
      ...(options.withRegion === true
        ? {
            'r-story': {
              id: 'r-story',
              type: 'customCode',
              props: {
                label: 'Our story',
                tree: parseTreeMarkup("<section id='story' class='py-16'><h2 class='text-3xl'>Our story</h2><p>Since 2019.</p></section>"),
                css: '',
              },
            },
          }
        : {}),
      stats: { id: 'stats', type: 'stats', props: { heading: 'Quality you can inspect', items: items(4, 'Stat') } },
      pricing: { id: 'pricing', type: 'pricing', props: { heading: 'Pricing' } },
      quotes: { id: 'quotes', type: 'testimonials', props: { heading: 'Loved by teams', items: items(2, 'Quote') } },
      faq: { id: 'faq', type: 'faq', props: { heading: 'Everything you need', items: items(4, 'Question') } },
      showcase: {
        id: 'showcase',
        type: 'image',
        props: { src: 'https://example.com/a.jpg', alt: 'Panels', motion: { scroll: 'scale-on-scroll', duration: 'slow' } },
      },
      note: { id: 'note', type: 'richText', props: { heading: 'Why it holds' } },
      footer: { id: 'footer', type: 'pageFooter', props: {}, slots: { body: [] } },
    },
  } as unknown as BuilderDocument;
}

/** The playground-shaped page in a kernel, with the tree commands registered (for a composed region). */
export function playgroundLikeKernel(options: PlaygroundLikeOptions = {}): BuilderKernel {
  return createBuilder({
    document: playgroundLikeDocument(options),
    extensions: [motionBlocksFixture, treeCommandsFixture],
    ports: { clock: fixedClock(1), ids: seededIds('motion-blocks') },
  });
}
