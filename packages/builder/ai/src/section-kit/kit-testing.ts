import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AgentToolContext } from '../tools/agent/types';
import type { SectionKit, SectionKitSlot } from './types';

/*
  Test-only (not exported from the barrel): a kernel shaped like the
  product's — a page root with title, lang and pageCss, customCode regions
  with label, tree and css — so every kit is judged by the real door.
*/

const NullRender: BlockRenderComponent = () => null;

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'section-kit-fixture',
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

/** Enough of the skeleton's page kit for `kit.section` to see kit styles. */
export const KIT_PAGE_CSS = '.ck-page-plan{--ck-page-plan:1}\n@layer components{\n.ck-btn{display:inline-flex}\n}\n.ck-page-plan-end{--ck-page-plan:0}';

export interface KitFixtureRegion {
  readonly id: string;
  readonly tree: unknown;
  readonly css?: string;
}

export function kitKernel(options: {
  readonly dir?: 'rtl' | 'ltr';
  readonly lang?: string;
  readonly pageCss?: string;
  readonly regions?: readonly KitFixtureRegion[];
} = {}): BuilderKernel {
  const regions = options.regions ?? [
    {
      id: 'r1',
      tree: {
        kind: 'root',
        children: [{ kind: 'element', tag: 'section', attributes: { id: 'hero' }, children: [] }],
      },
    },
    {
      id: 'r2',
      tree: {
        kind: 'root',
        children: [{ kind: 'element', tag: 'footer', attributes: { id: 'footer' }, children: [] }],
      },
    },
  ];
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: options.dir ?? 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Page', lang: options.lang ?? 'en', pageCss: options.pageCss ?? KIT_PAGE_CSS },
        slots: { default: regions.map(({ id }) => id) },
      },
      ...Object.fromEntries(
        regions.map((region) => [
          region.id,
          {
            id: region.id,
            type: 'customCode',
            props: { label: region.id, tree: region.tree as never, css: region.css ?? '' },
          },
        ]),
      ),
    },
  };
  return createBuilder({
    document,
    extensions: [BLOCKS],
    ports: { clock: fixedClock(100), ids: seededIds('kit') },
  });
}

export const kitPorts = () => ({ clock: fixedClock(200), ids: seededIds('kit-validate') });

/** A tool context over a kernel, reading props from the live page (no earlier plan steps). */
export function kitContext(kernel: BuilderKernel, lang = 'en', dir: 'rtl' | 'ltr' = 'ltr'): AgentToolContext {
  return {
    kernel,
    readProp: (nodeId, key) => kernel.getDocument().nodes[nodeId]?.props[key],
    locale: { lang, dir },
    sampleValues: [],
  };
}

const WORDS = {
  ar: ['قهوة مختصة تُحمّص كل صباح', 'فريقنا', 'اطلب الآن', 'تفاصيل', 'مرحبًا بكم'],
  en: ['Coffee roasted every morning', 'Our team', 'Order now', 'Details', 'Welcome in'],
} as const;

function sampleSlot(slot: SectionKitSlot, name: string, lang: 'ar' | 'en', seed: number): unknown {
  const words = WORDS[lang];
  const word = words[seed % words.length] ?? words[0];
  switch (slot.kind) {
    case 'text':
      if (name === 'href') return `#section-${String(seed)}`;
      if (name === 'initials') return lang === 'ar' ? 'ر خ' : 'RK';
      return `${word} ${String(seed)}`.slice(0, Math.max(1, slot.max ?? 200)).trim();
    case 'icon':
      return ['star', 'coffee', 'map-pin', 'phone'][seed % 4];
    case 'link':
      return { label: `${word} ${String(seed)}`.slice(0, 50).trim(), href: `#s-${String(seed)}` };
    case 'image':
      return {
        src: `https://images.unsplash.com/photo-${String(1_500_000_000_000 + seed)}?w=1200`,
        alt: `${word} ${String(seed)}`,
      };
    case 'list': {
      const count = Math.min(slot.max ?? 3, 3);
      return Array.from({ length: count }, (_unused, index) => sampleSlots(slot.item ?? {}, lang, seed * 10 + index + 1));
    }
  }
}

/** Sample values for every slot (optional ones too), distinct per slot and item. */
export function sampleSlots(
  slots: Readonly<Record<string, SectionKitSlot>>,
  lang: 'ar' | 'en',
  seed = 1,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot], index) => [name, sampleSlot(slot, name, lang, seed * 7 + index)]),
  );
}

export function kitSamples(kit: SectionKit, lang: 'ar' | 'en'): Record<string, unknown> {
  return sampleSlots(kit.slots, lang);
}
