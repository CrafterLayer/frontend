import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  partStylesProp,
  type BlockRenderComponent,
  type CustomCodeNode,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { kitKernel } from '../section-kit/kit-testing';
import { partsKernel } from '../style-tools/part-tools.fixtures';
import { styleKernel, treeOf } from '../style-tools/style-tools.fixtures';
import { CAFE_PHOTO, expandAndValidate } from '../tools/agent/agent-tools.fixtures';
import { loadArtCatalog } from './load';

/*
  The art catalog through the agent's own tools (2026-10-14): an art spec
  written where an image src goes — media.add images, a kit image slot,
  part.image, image.set — expands to the verified address with its alt in
  the page language, and the real door takes the steps. A brand the catalog
  lacks, or a style that needs a credit, is refused with the fix.
*/

beforeAll(async () => {
  await loadArtCatalog();
});

interface Step {
  readonly command: string;
  readonly args: Record<string, unknown>;
}

function door(kernel: BuilderKernel, name: string, input: unknown) {
  const result = expandAndValidate(kernel, name, input);
  return { ...result, steps: (result.plan as { commands?: Step[] }).commands ?? [] };
}

type Element = Extract<CustomCodeNode, { kind: 'element' }>;

function images(tree: CustomCodeRoot | undefined): Element[] {
  const out: Element[] = [];
  const walk = (node: CustomCodeNode | CustomCodeRoot): void => {
    if (node.kind === 'element' && node.tag === 'img') out.push(node);
    for (const child of (node as { children?: readonly CustomCodeNode[] }).children ?? [])
      walk(child);
  };
  if (tree !== undefined) walk(tree);
  return out;
}

function insertedTree(steps: readonly Step[]): CustomCodeRoot | undefined {
  const insert = steps.find(({ command }) => command === 'insertNode');
  return (insert?.args['props'] as { tree?: CustomCodeRoot } | undefined)?.tree;
}

describe('media.add — art in images', () => {
  it('fills a gallery with illustrations and logos, alt in the page language', () => {
    const kernel = styleKernel({ locale: 'ar' });
    const { issues, steps } = door(kernel, 'media.add', {
      kind: 'gallery',
      images: [
        { src: 'illustration:طبيب' },
        { src: 'illustration:قهوة', alt: 'فنجان قهوة' },
        { src: 'logo:visa' },
      ],
    });
    expect(issues).toEqual([]);
    const shown = images(insertedTree(steps)).map(({ attributes }) => [
      attributes?.src,
      attributes?.alt,
    ]);
    expect(shown).toEqual([
      ['https://api.iconify.design/fluent-emoji-flat/health-worker.svg', 'طبيب'],
      ['https://api.iconify.design/fluent-emoji-flat/hot-beverage.svg', 'فنجان قهوة'],
      ['https://cdn.simpleicons.org/visa', 'شعار Visa'],
    ]);
  });

  it('refuses a brand the catalog lacks, naming the fix', () => {
    const { issues } = door(styleKernel(), 'media.add', {
      kind: 'gallery',
      images: [{ src: 'logo:Acme Widgets of Amman' }],
    });
    expect(issues.join(' ')).toContain('ask the person to upload their logo');
  });

  it('takes an art spec as a single image field (a compare picture)', () => {
    const { issues, steps } = door(styleKernel(), 'media.add', {
      kind: 'compare',
      before: 'illustration:seedling',
      after: 'illustration:deciduous tree',
    });
    expect(issues).toEqual([]);
    expect(images(insertedTree(steps)).map(({ attributes }) => attributes?.src)).toEqual([
      'https://api.iconify.design/fluent-emoji-flat/seedling.svg',
      'https://api.iconify.design/fluent-emoji-flat/deciduous-tree.svg',
    ]);
  });
});

describe('kit slots — logos, characters and illustrations', () => {
  it('puts named brands into the logo row, drawn whole', () => {
    const { issues, steps } = door(kitKernel(), 'kit.insert', {
      kit: 'logos-row',
      slots: {
        title: 'Pay the way you already do',
        items: [
          { name: 'Stripe', image: { src: 'logo:stripe' } },
          { name: 'Apple Pay', image: { src: 'logo:Apple Pay' } },
        ],
      },
    });
    expect(issues).toEqual([]);
    const logos = images(insertedTree(steps));
    expect(logos.map(({ attributes }) => attributes?.src)).toEqual([
      'https://cdn.simpleicons.org/stripe',
      'https://cdn.simpleicons.org/applepay',
    ]);
    expect(logos.map(({ attributes }) => attributes?.alt)).toEqual([
      'Stripe logo',
      'Apple Pay logo',
    ]);
  });

  it('gives sample testimonial authors a cartoon avatar instead of a stranger’s face', () => {
    const { issues, steps } = door(kitKernel({ lang: 'ar', dir: 'rtl' }), 'kit.insert', {
      kit: 'testimonials-cards',
      slots: {
        title: 'ماذا يقول عملاؤنا',
        items: [
          {
            quote: 'خدمة سريعة ونتيجة رائعة.',
            name: 'سارة',
            image: { src: 'character:lorelei:سارة' },
          },
          { quote: 'أنصح بهم بشدة.', name: 'عمر', initials: 'ع' },
        ],
      },
    });
    expect(issues).toEqual([]);
    const [avatar, ...rest] = images(insertedTree(steps));
    expect(avatar?.attributes?.src).toBe(
      'https://api.dicebear.com/9.x/lorelei/svg?seed=%D8%B3%D8%A7%D8%B1%D8%A9',
    );
    expect(avatar?.attributes?.alt).toBe('صورة رمزية كرتونية');
    expect(avatar?.className).toContain('rounded-full');
    expect(rest).toEqual([]);
  });

  it('draws the same team member the same way, and an illustration contained in a photo frame', () => {
    const team = door(kitKernel(), 'kit.insert', {
      kit: 'team-grid',
      slots: {
        title: 'Our team',
        items: [
          {
            name: 'Lina',
            role: 'Designer',
            image: { src: 'character:Lina', alt: 'Lina, our designer' },
          },
        ],
      },
    });
    expect(team.issues).toEqual([]);
    const [portrait] = images(insertedTree(team.steps));
    expect(portrait?.attributes).toMatchObject({
      src: 'https://api.dicebear.com/9.x/notionists/svg?seed=Lina',
      alt: 'Lina, our designer',
    });
    expect(portrait?.className).toContain('object-cover');

    const rows = door(kitKernel(), 'kit.insert', {
      kit: 'content-zigzag',
      slots: {
        title: 'How it works',
        items: [{ image: { src: 'illustration:rocket' }, title: 'Launch in a day' }],
      },
    });
    expect(rows.issues).toEqual([]);
    const [picture] = images(insertedTree(rows.steps));
    expect(picture?.attributes?.src).toBe(
      'https://api.iconify.design/fluent-emoji-flat/rocket.svg',
    );
    expect(picture?.className).toContain('object-contain');
    expect(picture?.className).not.toContain('object-cover');
  });

  it('refuses a style whose licence needs a credit line', () => {
    const { issues } = door(kitKernel(), 'kit.insert', {
      kit: 'team-grid',
      slots: {
        title: 'Our team',
        items: [{ name: 'Lina', image: { src: 'character:adventurer:Lina' } }],
      },
    });
    expect(issues.join(' ')).toMatch(
      /CC BY 4\.0 and needs a visible credit.*use one of notionists/u,
    );
  });
});

describe('part.image — a registered block’s image part', () => {
  it('sets a character or an illustration with its alt', () => {
    const { issues, steps } = door(partsKernel(), 'part.image', {
      id: 'features-1',
      part: 'image',
      src: 'illustration:doctor',
    });
    expect(issues).toEqual([]);
    expect(steps.map(({ args }) => [args['key'], args['value']])).toEqual([
      ['imageSrc', 'https://api.iconify.design/fluent-emoji-flat/health-worker.svg'],
      ['imageAlt', 'Health worker'],
    ]);
  });

  it('writes no alt where the part keeps none (a logo beside its visible name)', () => {
    const { issues, steps } = door(logoKernel(), 'part.image', {
      id: 'logos-1',
      part: 'item.logo',
      index: 1,
      src: 'logo:mastercard/white',
    });
    expect(issues).toEqual([]);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.args['key']).toBe('items');
    expect(steps[0]?.args['value']).toEqual([
      { name: 'Visa' },
      { name: 'Mastercard', logo: 'https://cdn.simpleicons.org/mastercard/ffffff' },
    ]);
  });

  it('still refuses an index past the end of the list', () => {
    const { issues } = door(logoKernel(), 'part.image', {
      id: 'logos-1',
      part: 'item.logo',
      index: 5,
      src: 'logo:visa',
    });
    expect(issues).not.toEqual([]);
  });

  it('refuses an unknown brand before any step', () => {
    const { issues } = door(logoKernel(), 'part.image', {
      id: 'logos-1',
      part: 'item.logo',
      index: 0,
      src: 'logo:my own company',
    });
    expect(issues.join(' ')).toContain('no verified logo for "my own company"');
  });
});

describe('image.set — swap a composed region’s picture for art', () => {
  it('replaces the photo with a square illustration and drops the photo’s srcset', () => {
    const kernel = styleKernel();
    const { issues, steps } = door(kernel, 'image.set', {
      id: 'r-hero',
      find: CAFE_PHOTO,
      subject: 'illustration:coffee',
      alt: 'A cup of coffee',
    });
    expect(issues).toEqual([]);
    const tree = steps.find(({ args }) => args['key'] === 'tree')?.args['value'] as CustomCodeRoot;
    const [picture] = images(tree);
    expect(picture?.attributes).toMatchObject({
      src: 'https://api.iconify.design/fluent-emoji-flat/hot-beverage.svg',
      alt: 'A cup of coffee',
      width: '256',
      height: '256',
    });
    expect(picture?.attributes?.srcset).toBeUndefined();
    expect(images(treeOf(kernel, 'r-hero'))[0]?.attributes?.src).toBe(CAFE_PHOTO);
  });
});

// ── A logo-cloud-shaped block: an image part bound to `src` only ─────────────

const NullRender: BlockRenderComponent = () => null;

const LOGO_BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'art-tools-fixture',
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
          slots: { default: { allow: ['logoCloud', 'customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'logoCloud',
          description: 'Brand names, each with an optional logo.',
          props: z.object({
            items: z
              .array(z.object({ name: z.string().max(32), logo: z.string().max(2000).optional() }))
              .max(12),
            partStyles: partStylesProp(),
          }),
          parts: {
            items: { kind: 'list', bind: 'items', label: { en: 'Brands', ar: 'العلامات' } },
            item: {
              kind: 'item',
              bind: 'items.*',
              list: 'items',
              label: { en: 'Brand', ar: 'العلامة' },
            },
            'item.name': {
              kind: 'text',
              bind: 'items.*.name',
              label: { en: 'Brand name', ar: 'اسم العلامة' },
            },
            'item.logo': {
              kind: 'image',
              bind: { src: 'items.*.logo' },
              label: { en: 'Brand logo', ar: 'صورة الشعار' },
            },
          },
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

function logoKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: { title: 'Logos', lang: 'en' },
          slots: { default: ['logos-1'] },
        },
        'logos-1': {
          id: 'logos-1',
          type: 'logoCloud',
          props: { items: [{ name: 'Visa' }, { name: 'Mastercard' }] },
        },
      },
    },
    extensions: [LOGO_BLOCKS],
    ports: { clock: fixedClock(1), ids: seededIds('art-tools') },
  });
}
