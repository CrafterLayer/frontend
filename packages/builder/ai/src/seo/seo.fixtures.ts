import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  pageSeoSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { PHOTO_CATALOG_ENTRIES } from '../context/providers/photo-catalog.data';
import type { AgentToolContext } from '../tools/agent/types';

/* Test-only fixtures for the SEO suites (not exported from the package). */

const NullRender: BlockRenderComponent = () => null;

/** A registry with the page root (seo included) and customCode, like the product's. */
export const seoBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'seo-fixture',
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
            socialTitle: z.string().max(120).optional(),
            socialDescription: z.string().max(200).optional(),
            noIndex: z.boolean().default(false),
            lang: z.string().max(12).default(''),
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
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`The photo catalog has no ${what}.`);
  return value;
}

export const CAFE_PHOTO = required(PHOTO_CATALOG_ENTRIES.find((entry) => entry.topic === 'cafe'), 'cafe photo');
export const SECOND_PHOTO = required(
  PHOTO_CATALOG_ENTRIES.find((entry) => entry.topic === 'cafe' && entry.id !== CAFE_PHOTO.id),
  'second cafe photo',
);

export const el = (tag: string, extra: Record<string, unknown> = {}) => ({ kind: 'element', tag, ...extra });
export const tree = (...children: unknown[]) => ({ kind: 'root', children });

/** 25–55 Arabic characters: inside the title budget. */
export const AR_TITLE = 'قهوة بُن المختصة في عمّان، محمصة يومية طازجة';
/** 60–130 Arabic characters: inside the description budget. */
export const AR_DESCRIPTION =
  'محمصة بُن في عمّان تقدّم قهوة مختصة تُحمّص كل صباح، مع حلويات بيتية وجلسات هادئة للعمل والقراءة طوال اليوم.';

export interface RegionSpec {
  readonly id: string;
  readonly tree: unknown;
  readonly label?: string;
}

export function pageDocument(
  regions: readonly RegionSpec[],
  root: Record<string, unknown> = {},
  dir: 'rtl' | 'ltr' = 'rtl',
): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: '', description: '', slug: '', noIndex: false, lang: '', ...root },
        slots: { default: regions.map((region) => region.id) },
      },
      ...Object.fromEntries(
        regions.map((region) => [
          region.id,
          {
            id: region.id,
            type: 'customCode',
            props: { label: region.label ?? region.id, tree: region.tree },
            slots: {},
          },
        ]),
      ),
    },
  };
}

/** A clean Arabic café page: every check passes. */
export function cleanArabicRegions(): RegionSpec[] {
  return [
    {
      id: 'hero',
      tree: tree(
        el('section', {
          attributes: { 'aria-labelledby': 'hero-title' },
          children: [
            el('h1', { text: 'قهوة تُحمّص كل صباح', attributes: { id: 'hero-title' } }),
            el('p', { text: 'محمصة صغيرة في قلب عمّان تقدّم قهوة مختصة طازجة.' }),
            el('img', {
              attributes: {
                src: CAFE_PHOTO.url,
                alt: CAFE_PHOTO.alt.ar,
                width: String(CAFE_PHOTO.width),
                height: String(CAFE_PHOTO.height),
                loading: 'eager',
                fetchpriority: 'high',
              },
            }),
            el('a', { text: 'اطلب قهوتك الآن', attributes: { href: '#menu' } }),
          ],
        }),
      ),
    },
    {
      id: 'menu',
      tree: tree(
        el('section', {
          attributes: { id: 'menu', 'aria-labelledby': 'menu-title' },
          children: [
            el('h2', { text: 'قائمة المشروبات', attributes: { id: 'menu-title' } }),
            el('p', { text: 'إسبريسو، لاتيه، وقهوة مقطّرة من محاصيل موسمية.' }),
            el('img', {
              attributes: {
                src: SECOND_PHOTO.url,
                alt: SECOND_PHOTO.alt.ar,
                width: String(SECOND_PHOTO.width),
                height: String(SECOND_PHOTO.height),
                loading: 'lazy',
              },
            }),
          ],
        }),
      ),
    },
  ];
}

/** The same page with one of every fixable defect. */
export function dirtyArabicRegions(): RegionSpec[] {
  return [
    {
      id: 'hero',
      tree: tree(
        el('section', {
          children: [
            el('h1', { text: 'قهوة تُحمّص كل صباح' }),
            el('p', { text: 'محمصة صغيرة في قلب عمّان تقدّم قهوة مختصة طازجة.' }),
            el('img', { attributes: { src: CAFE_PHOTO.url, loading: 'lazy' } }),
          ],
        }),
      ),
    },
    {
      id: 'menu',
      tree: tree(
        el('section', {
          attributes: { id: 'menu' },
          children: [
            el('h1', { text: 'قائمة المشروبات' }),
            el('p', { text: 'إسبريسو، لاتيه، وقهوة مقطّرة من محاصيل موسمية.' }),
            el('img', { attributes: { src: SECOND_PHOTO.url, alt: SECOND_PHOTO.alt.ar } }),
            el('a', { text: 'اقرأ المزيد', attributes: { href: '#menu' } }),
          ],
        }),
      ),
    },
  ];
}

export function kernelFor(document: BuilderDocument): BuilderKernel {
  return createBuilder({
    document,
    extensions: [seoBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('seo') },
  });
}

export const validationPorts = () => ({ clock: fixedClock(2), ids: seededIds('seo-validate') });

/** A tool context over the live page (no earlier plan steps). */
export function toolContext(
  kernel: BuilderKernel,
  sampleValues: readonly string[] = [],
): AgentToolContext {
  const document = kernel.getDocument();
  const lang = document.nodes[document.rootId]?.props['lang'];
  return {
    kernel,
    readProp: (id, key) => kernel.getDocument().nodes[id]?.props[key],
    locale: { lang: typeof lang === 'string' ? lang : '', dir: document.dir === 'rtl' ? 'rtl' : 'ltr' },
    sampleValues,
  };
}
