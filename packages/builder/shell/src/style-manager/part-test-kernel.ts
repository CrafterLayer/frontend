/*
  Test-only kernel for block PARTS (block-parts DESIGN §2.13): one registered
  block, `promo`, that declares a part of every kind — text, multiline text, a
  link over an object, an image over two top-level props, a list with its
  items and an item sub-part, and a box — plus the `partStyles` prop the part
  style planner writes. Shared by part-source, the Inspector part panel and
  the Layers part rows, so all three prove their side against one shape.
*/
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  partStylesProp,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

const NullRender: BlockRenderComponent = () => null;

export const PROMO_PROPS = z.object({
  badge: z.string().max(60).default('New'),
  heading: z.string().max(120).default('Build faster'),
  body: z.string().max(600).default('Every edit is one undo.'),
  cta: z
    .object({ label: z.string().max(40), href: z.string().max(300) })
    .default({ label: 'Start', href: '/start' }),
  imageSrc: z.string().max(500).default(''),
  imageAlt: z.string().max(200).default(''),
  items: z
    .array(z.object({ title: z.string().max(80), body: z.string().max(300) }))
    .max(8)
    .default([]),
  partStyles: partStylesProp(),
});

export const PART_TEST_MANIFEST: TrustedExtensionManifest = {
  tier: 1,
  name: 'block-parts-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['promo'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'promo',
          description: 'A promo section with a part of every kind',
          props: PROMO_PROPS,
          propertyGroups: {
            badge: { tab: 'content', section: 'Content' },
            heading: { tab: 'content', section: 'Content' },
            body: { tab: 'content', section: 'Content' },
            cta: { tab: 'content', section: 'Content' },
            imageSrc: { tab: 'content', section: 'Media' },
            imageAlt: { tab: 'content', section: 'Media' },
            items: { tab: 'content', section: 'Features' },
            partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
          },
          parts: {
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' }, aliases: ['title'] },
            body: { kind: 'text', bind: 'body', label: { en: 'Body', ar: 'الوصف' }, multiline: true },
            cta: {
              kind: 'link',
              bind: { text: 'cta.label', href: 'cta.href' },
              label: { en: 'Button', ar: 'الزر' },
            },
            image: { kind: 'image', bind: { src: 'imageSrc', alt: 'imageAlt' }, label: { en: 'Image', ar: 'الصورة' } },
            items: { kind: 'list', bind: 'items', label: { en: 'Features', ar: 'الميزات' } },
            item: { kind: 'item', bind: 'items.*', list: 'items', label: { en: 'Feature', ar: 'الميزة' } },
            'item.title': { kind: 'text', bind: 'items.*.title', label: { en: 'Feature title', ar: 'عنوان الميزة' } },
            frame: { kind: 'box', label: { en: 'Frame', ar: 'الإطار' } },
          },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

export const PROMO_ID = 'p1';

export function partTestDocument(dir: 'ltr' | 'rtl' = 'ltr'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: [PROMO_ID] } },
      [PROMO_ID]: {
        id: PROMO_ID,
        type: 'promo',
        props: {
          badge: 'New',
          heading: 'Build faster',
          body: 'Every edit is one undo.',
          cta: { label: 'Start', href: '/start' },
          imageSrc: 'https://example.com/hero.jpg',
          imageAlt: 'A calm desk',
          items: [
            { title: 'Fast', body: 'Ships today' },
            { title: 'Safe', body: 'One undo' },
            { title: 'Arabic', body: 'من اليمين' },
          ],
          partStyles: {},
        },
      },
    },
  };
}

export function makePartTestKernel(options: { readonly dir?: 'ltr' | 'rtl' } = {}): BuilderKernel {
  return createBuilder({
    document: partTestDocument(options.dir),
    extensions: [PART_TEST_MANIFEST],
    ports: { clock: fixedClock(), ids: seededIds('parts') },
  });
}

/** The node's props, read from document truth. */
export function promoProps(kernel: BuilderKernel): Readonly<Record<string, unknown>> {
  return kernel.getDocument().nodes[PROMO_ID]?.props ?? {};
}

/** `partStyles[key]`, or undefined. */
export function partStyleAt(kernel: BuilderKernel, key: string): { className?: string; dir?: string } | undefined {
  const styles = promoProps(kernel)['partStyles'] as Readonly<Record<string, { className?: string; dir?: string }>> | undefined;
  return styles?.[key];
}
