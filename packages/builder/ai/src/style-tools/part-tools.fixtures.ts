import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  partStylesProp,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';

/*
  Test-only (block-parts P7): a page shaped like the product's marketing
  pages — a hero with an eyebrow, heading, body and meta line plus a CTA
  child in its actions slot, a features block with a repeated card list, a
  link and an image, a rich-text block, and one composed region — each
  registered block declaring its parts and a `partStyles` prop, so every
  part tool's output is judged by the real setProp door.
*/

const NullRender: BlockRenderComponent = () => null;

export const partToolsFixtureBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'part-tools-fixture',
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
          }),
          slots: { default: { allow: ['hero', 'features', 'richText', 'customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'hero',
          description: 'The opening section.',
          props: z.object({
            eyebrow: z.string().max(80).optional(),
            heading: z.string().max(160),
            body: z.string().max(400).default(''),
            trustLine: z.string().max(160).optional(),
            partStyles: partStylesProp(),
          }),
          parts: {
            eyebrow: { kind: 'text', bind: 'eyebrow', label: { en: 'Badge', ar: 'الشارة' }, aliases: ['badge', 'eyebrow', 'شارة'] },
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' }, aliases: ['title', 'headline', 'عنوان'] },
            body: { kind: 'text', bind: 'body', label: { en: 'Description', ar: 'الوصف' }, aliases: ['paragraph', 'body', 'وصف'], multiline: true },
            trustLine: { kind: 'text', bind: 'trustLine', label: { en: 'Meta line', ar: 'السطر التعريفي' } },
          },
          slots: { actions: { allow: ['cta'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'cta',
          description: 'A call-to-action button.',
          props: z.object({
            label: z.string().max(80),
            href: z.string().max(400).default('#'),
            partStyles: partStylesProp(),
          }),
          parts: {
            button: { kind: 'link', bind: { text: 'label', href: 'href' }, label: { en: 'Button', ar: 'الزر' }, aliases: ['button', 'cta', 'زر'] },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'features',
          description: 'A grid of feature cards.',
          props: z.object({
            heading: z.string().max(160),
            items: z
              .array(z.object({ title: z.string().max(80).default('New feature'), body: z.string().max(400).default('') }))
              .max(12)
              .default([]),
            link: z.object({ label: z.string().max(80), href: z.string().max(400) }).optional(),
            imageSrc: z.string().max(2000).optional(),
            imageAlt: z.string().max(300).optional(),
            partStyles: partStylesProp(),
          }),
          parts: {
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' }, aliases: ['title'] },
            items: { kind: 'list', bind: 'items', label: { en: 'Cards', ar: 'البطاقات' }, aliases: ['cards'] },
            item: { kind: 'item', bind: 'items.*', list: 'items', label: { en: 'Card', ar: 'البطاقة' }, aliases: ['card'] },
            'item.title': { kind: 'text', bind: 'items.*.title', label: { en: 'Card title', ar: 'عنوان البطاقة' } },
            'item.body': { kind: 'text', bind: 'items.*.body', label: { en: 'Card text', ar: 'نص البطاقة' } },
            link: { kind: 'link', bind: { text: 'link.label', href: 'link.href' }, label: { en: 'Link', ar: 'الرابط' } },
            image: { kind: 'image', bind: { src: 'imageSrc', alt: 'imageAlt' }, label: { en: 'Image', ar: 'الصورة' } },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'richText',
          description: 'Formatted text.',
          props: z.object({ content: richText(), partStyles: partStylesProp() }),
          parts: { content: { kind: 'rich', bind: 'content', label: { en: 'Text', ar: 'النص' }, aliases: ['content'] } },
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

export const RICH_PARAGRAPH = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Every edit becomes one undo.' }] }],
} as const;

/** The fixture page: hero (+ two CTAs), features (three cards), rich text, one composed region. */
export function partsDocument(locale: 'en' | 'ar' = 'en'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Parts', lang: locale },
        slots: { default: ['hero-1', 'features-1', 'text-1', 'r-story'] },
      },
      'hero-1': {
        id: 'hero-1',
        type: 'hero',
        props: {
          eyebrow: 'THE PROFESSIONAL WEBSITE BUILDER',
          heading: 'welcom',
          body: 'Blocks that grow with your site.',
          trustLine: 'Every edit becomes one undo.',
        },
        slots: { actions: ['cta-1', 'cta-2'] },
      },
      'cta-1': { id: 'cta-1', type: 'cta', props: { label: 'Get started', href: '/start' } },
      'cta-2': { id: 'cta-2', type: 'cta', props: { label: 'اقرأ التوثيق', href: '/docs' } },
      'features-1': {
        id: 'features-1',
        type: 'features',
        props: {
          heading: 'Why teams pick it',
          items: [
            { title: 'Fast', body: 'Ships in a day.' },
            { title: 'Safe', body: 'One door for every edit.' },
            { title: 'Fast', body: 'Twice, on purpose.' },
          ],
          link: { label: 'See all features', href: '/features' },
          imageSrc: 'https://example.com/a.jpg',
          imageAlt: 'A builder at work',
        },
      },
      'text-1': { id: 'text-1', type: 'richText', props: { content: RICH_PARAGRAPH } },
      'r-story': {
        id: 'r-story',
        type: 'customCode',
        props: {
          label: 'Our story',
          tree: parseTreeMarkup('<section><h2>Our story</h2><p>Since 2019.</p></section>'),
          css: '',
        },
      },
    },
  } as unknown as BuilderDocument;
}

export function partsKernel(locale: 'en' | 'ar' = 'en'): BuilderKernel {
  return createBuilder({
    document: partsDocument(locale),
    extensions: [partToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('part-tools') },
  });
}
