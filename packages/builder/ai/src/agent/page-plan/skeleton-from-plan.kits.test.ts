import { describe, expect, it } from 'vitest';
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

import { validateAiPlan } from '../../plan';
import type { AiPlan } from '../../types';
import { checkSection } from './check-section';
import { skeletonFromPlan } from './skeleton-from-plan';
import { validatePagePlan, type PagePlan } from './index';

/*
  The skeleton and the section kit (2026-09-30, DESIGN §B/D.1): a kit section
  whose slots the planner filled is written IN FULL by code, like the header
  and footer — no writer, no model tokens — and the root carries the plan's
  SEO: keyword, kind, the facts' samples and the slug.
*/

const NullRender: BlockRenderComponent = () => null;

const ROOT_PROPS = ['title', 'description', 'lang', 'pageCss', 'seo', 'slug'] as const;

function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'skeleton-kit-fixture',
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
              lang: z.string().max(12).default(''),
              slug: z.string().max(120).default(''),
              pageCss: customCss(20_000),
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
}

function kernel(rootProps: Record<string, unknown> = {}): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Home', ...rootProps }, slots: { default: [] } },
    },
  };
  return createBuilder({
    document,
    extensions: [manifest()],
    ports: { clock: fixedClock(1), ids: seededIds('skel-kit') },
  });
}

function policyFor(plan: AiPlan) {
  return {
    allowedCommands: [...new Set(plan.commands.map(({ command }) => command))],
    maxCommands: plan.commands.length,
  };
}

function arabicCafe(): PagePlan {
  const result = validatePagePlan({
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'محمصة الهيل — قهوة مختصة في عمّان',
    description: 'قهوة مختصة محمصة في عمّان، تصلك طازجة.',
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'the brand name at text-8xl, faint behind the menu',
    },
    primaryCta: { label: 'اطلب الآن', href: '#order' },
    nav: [{ label: 'اطلب', anchorId: 'order' }],
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'العلامة.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'قهوة تُحمّص كل صباح',
        anchorId: 'hero',
        purpose: 'ما هي المحمصة.',
        variant: 'split',
      },
      {
        key: 'order',
        role: 'cta',
        title: 'اطلب',
        anchorId: 'order',
        purpose: 'طريقة واحدة للطلب.',
        kit: 'cta-split',
        slots: { title: 'حبوب طازجة تصلك في عمّان', cta: { label: 'اطلب الآن', href: '#order' } },
      },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'العنوان.' },
    ],
    facts: [{ key: 'phone', sample: '+962 7 9646 1275', section: 'footer' }],
    seo: { keyword: 'قهوة مختصة في عمّان', pageKind: 'home', slug: 'قهوة مختصة عمان' },
  });
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('\n'));
  return result.plan;
}

type Args = Record<string, unknown>;

function rootSets(plan: AiPlan): Record<string, unknown> {
  return Object.fromEntries(
    plan.commands
      .map(({ command, args }) => ({ command, args: args as Args }))
      .filter(({ command, args }) => command === 'setProp' && args['id'] === 'root')
      .map(({ args }) => [args['key'] as string, args['value']]),
  );
}

function insertedProps(plan: AiPlan): Record<string, unknown>[] {
  return plan.commands
    .filter(({ command }) => command === 'insertNode')
    .map(({ args }) => (args as Args)['props'] as Record<string, unknown>);
}

function classesOf(value: unknown): string[] {
  const found: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...(node as unknown[]));
      continue;
    }
    if (typeof node !== 'object' || node === null) continue;
    const record = node as Record<string, unknown>;
    if (typeof record['className'] === 'string') found.push(...record['className'].split(/\s+/u));
    stack.push(...Object.values(record));
  }
  return found;
}

describe('skeletonFromPlan — a kit section with slots needs no writer', () => {
  it('writes the kit section in full, marks it complete, and the door accepts the skeleton', () => {
    const pagePlan = arabicCafe();
    const target = kernel();
    const { plan, regions } = skeletonFromPlan(pagePlan, {
      parentId: 'root',
      regionType: 'customCode',
      rootProps: ROOT_PROPS,
    });

    expect(regions.map(({ complete }) => complete)).toEqual([true, false, true, true]);
    expect(regions[2]?.kit).toBe('cta-split');
    expect(regions[1]?.kit).toBeUndefined();

    const order = insertedProps(plan)[2];
    const tree = order?.['tree'] as { children: { attributes?: Record<string, string> }[] };
    expect(tree.children[0]?.attributes?.['id']).toBe('order');
    expect(classesOf(tree)).toContain('ck-kit-cta-split');

    // The checker the build runs before trusting it finds nothing to send a writer for.
    expect(checkSection(pagePlan, pagePlan.sections[2]!, { tree: tree })).toEqual([]);

    const verdict = validateAiPlan(
      plan,
      target,
      { clock: fixedClock(1), ids: seededIds('skel-kit-door') },
      policyFor(plan),
    );
    expect(verdict.ok ? [] : verdict.issues).toEqual([]);
  });

  it('writes the seo keyword, kind and samples, and the slug, where the root declares them', () => {
    const { plan } = skeletonFromPlan(arabicCafe(), {
      parentId: 'root',
      regionType: 'customCode',
      rootProps: ROOT_PROPS,
    });
    const sets = rootSets(plan);
    expect(sets['seo']).toEqual({
      keyword: 'قهوة مختصة في عمّان',
      pageKind: 'home',
      samples: ['+962 7 9646 1275'],
      // The brand becomes the site name, so the page publishes a WebSite node.
      site: { siteName: 'محمصة الهيل' },
    });
    expect(sets['slug']).toBe(arabicCafe().seo?.slug);
    expect(sets['slug']).toMatch(/^[ء-ي-]+$/u);
  });

  it('keeps the site settings a home page already carries, and a slug someone set', () => {
    const site = { siteName: 'محمصة الهيل', origin: 'https://example.com' };
    const { plan } = skeletonFromPlan(
      { ...arabicCafe(), intent: 'replace' },
      {
        parentId: 'root',
        regionType: 'customCode',
        rootProps: ROOT_PROPS,
        currentSeo: { site, keyword: 'old' },
        currentSlug: 'home',
      },
    );
    const sets = rootSets(plan);
    expect(sets['seo']).toMatchObject({ site, keyword: 'قهوة مختصة في عمّان' });
    expect(sets['slug']).toBeUndefined();
  });

  it('carries the planner’s businessType into seo.site.business — the brand name only, no sample address or phone', () => {
    const plan = arabicCafe();
    const { plan: written } = skeletonFromPlan(
      { ...plan, seo: { ...(plan.seo ?? { keyword: 'x', pageKind: 'home' }), businessType: 'CafeOrCoffeeShop' } },
      { parentId: 'root', regionType: 'customCode', rootProps: ROOT_PROPS },
    );
    const seo = rootSets(written)['seo'] as { site?: Record<string, unknown> };
    expect(seo.site).toEqual({
      siteName: 'محمصة الهيل',
      business: { type: 'CafeOrCoffeeShop', name: 'محمصة الهيل' },
    });
    // An owner's business is never overwritten by the plan's guess.
    const owned = { type: 'Bakery', name: 'مخبز', telephone: '+96264000000' };
    const { plan: kept } = skeletonFromPlan(
      { ...plan, seo: { ...(plan.seo ?? { keyword: 'x', pageKind: 'home' }), businessType: 'CafeOrCoffeeShop' } },
      { parentId: 'root', regionType: 'customCode', rootProps: ROOT_PROPS, currentSeo: { site: { business: owned } } },
    );
    expect((rootSets(kept)['seo'] as { site?: Record<string, unknown> }).site?.['business']).toEqual(owned);
  });

  // page-defects additions (2026-10-06)
  it('re-types a generic business an earlier plan wrote to the plan’s specific kind, never an owner’s', () => {
    const plan = arabicCafe();
    const restaurant = { ...plan, seo: { ...(plan.seo ?? { keyword: 'x', pageKind: 'home' as const }), businessType: 'Restaurant' as const } };
    const business = (currentBusiness: Record<string, unknown>) => {
      const { plan: written } = skeletonFromPlan(restaurant, {
        parentId: 'root',
        regionType: 'customCode',
        rootProps: ROOT_PROPS,
        currentSeo: { site: { siteName: 'مطعم', business: currentBusiness } },
      });
      return (rootSets(written)['seo'] as { site?: Record<string, unknown> }).site?.['business'];
    };
    expect(business({ type: 'Organization', name: 'مطعم الياسمين' })).toEqual({ type: 'Restaurant', name: 'مطعم الياسمين' });
    expect(business({ type: 'LocalBusiness', name: 'مطعم الياسمين' })).toEqual({ type: 'Restaurant', name: 'مطعم الياسمين' });
    // Anything the owner added beyond the plan's two fields keeps the business theirs.
    const owned = { type: 'Organization', name: 'مطعم الياسمين', telephone: '+96264000000' };
    expect(business(owned)).toEqual(owned);
    expect(business({ type: 'Bakery', name: 'مخبز' })).toEqual({ type: 'Bakery', name: 'مخبز' });
  });

  it('writes no seo or slug on a root that does not declare them (the default four props)', () => {
    const { plan } = skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' });
    expect(Object.keys(rootSets(plan))).toEqual(['title', 'description', 'lang', 'pageCss']);
  });
});
