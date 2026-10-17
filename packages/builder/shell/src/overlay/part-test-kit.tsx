import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  blockPartProps,
  defineBlockSchema,
  partStylesProp,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

/*
  TEST SUPPORT ONLY (block-parts P5). One registered block that declares every
  part kind the canvas handles — text, link, image, list and item, plus a text
  part inside each item — and a nested child block with a part of its own, so
  the canvas, quick-bar and action tests share one honest fixture rendered
  through the real `blockPartProps` helper.
*/

export interface PromoProps {
  readonly heading: string;
  readonly cta: { readonly label: string; readonly href: string };
  readonly imageSrc: string;
  readonly imageAlt: string;
  readonly items: readonly { readonly title: string }[];
  readonly partStyles?: Readonly<Record<string, { className?: string; dir?: 'auto' | 'ltr' | 'rtl' }>>;
}

export const promoSchema = defineBlockSchema({
  type: 'promo',
  description: 'A promotional section with a heading, a button, an image and features',
  props: z.object({
    heading: z.string().min(1).max(120),
    cta: z.object({ label: z.string().max(60), href: z.string().max(400) }),
    imageSrc: z.string().max(400),
    imageAlt: z.string().max(200),
    items: z.array(z.object({ title: z.string().max(120) })).max(8),
    partStyles: partStylesProp(),
  }),
  slots: { actions: { allow: ['chip'] } },
  parts: {
    heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' }, aliases: ['title'] },
    cta: {
      kind: 'link',
      bind: { text: 'cta.label', href: 'cta.href' },
      label: { en: 'Button', ar: 'الزر' },
    },
    image: { kind: 'image', bind: { src: 'imageSrc', alt: 'imageAlt' }, label: { en: 'Image', ar: 'الصورة' } },
    items: { kind: 'list', bind: 'items', label: { en: 'Features', ar: 'الميزات' } },
    item: { kind: 'item', bind: 'items.*', list: 'items', label: { en: 'Feature', ar: 'ميزة' } },
    'item.title': { kind: 'text', bind: 'items.*.title', label: { en: 'Feature title', ar: 'عنوان الميزة' } },
  },
  examples: [],
});

export const chipSchema = defineBlockSchema({
  type: 'chip',
  description: 'A small label',
  // `text`, not `label`: a `label` prop is the block's instance name in the chrome.
  props: z.object({ text: z.string().max(60), partStyles: partStylesProp() }),
  parts: { label: { kind: 'text', bind: 'text', label: { en: 'Label', ar: 'التسمية' } } },
  examples: [],
});

const PromoRender = ((render: BlockRenderProps<PromoProps> & { slots: Record<string, unknown> }) => {
  const { node, props, isCanvas, slots } = render;
  const part = blockPartProps({ node, props, isCanvas }, promoSchema.parts);
  return (
    <section className="p-6">
      <h1 {...part('heading', { className: 'text-3xl' })}>{props.heading}</h1>
      <a {...part('cta', { className: 'rounded' })} href={props.cta.href}>
        {props.cta.label}
      </a>
      <img {...part('image')} src={props.imageSrc} alt={props.imageAlt} />
      <ul {...part('items', { className: 'grid' })}>
        {props.items.map((item, at) => (
          <li key={at} {...part('item', { index: [at] })}>
            <h3 {...part('item.title', { index: [at] })}>{item.title}</h3>
          </li>
        ))}
      </ul>
      <div className="actions">{slots['actions']}</div>
    </section>
  );
}) as unknown as BlockRenderComponent;

const ChipRender = ((render: BlockRenderProps<{ text: string }>) => {
  const part = blockPartProps({ node: render.node, props: render.props, isCanvas: render.isCanvas }, chipSchema.parts);
  return <span {...part('label')}>{render.props.text}</span>;
}) as unknown as BlockRenderComponent;

const PageRender = ((render: { slots: Record<string, unknown> }) => (
  <main>{render.slots['default'] as React.ReactNode}</main>
)) as unknown as BlockRenderComponent;

export const PART_BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'part-test-blocks',
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
        render: PageRender,
      },
      { schema: promoSchema, render: PromoRender },
      { schema: chipSchema, render: ChipRender },
    ],
  },
};

/** A page holding one promo (`promo`) whose `actions` slot holds one chip (`chip`). */
export function promoDocument(dir: 'ltr' | 'rtl' = 'ltr'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['promo'] } },
      promo: {
        id: 'promo',
        type: 'promo',
        props: {
          heading: dir === 'rtl' ? 'مرحبا بكم' : 'Welcome',
          cta: { label: 'Get started', href: '/start' },
          imageSrc: 'https://example.com/a.jpg',
          imageAlt: 'Team',
          items: [{ title: 'Fast' }, { title: 'Safe' }, { title: 'Simple' }],
          partStyles: {},
        },
        slots: { actions: ['chip'] },
      },
      chip: { id: 'chip', type: 'chip', props: { text: 'New', partStyles: {} } },
    },
  };
}

export function promoKernel(dir: 'ltr' | 'rtl' = 'ltr'): BuilderKernel {
  return createBuilder({
    document: promoDocument(dir),
    extensions: [PART_BLOCKS],
    ports: { clock: fixedClock(), ids: seededIds('parts') },
  });
}

/** The promo's props as stored (test reads). */
export function promoProps(kernel: BuilderKernel): PromoProps {
  return kernel.getDocument().nodes['promo']?.props as unknown as PromoProps;
}
