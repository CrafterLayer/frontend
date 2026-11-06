import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  findCssRejection,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { summarizeDocumentForIntent } from '../../intent/document-summary';
import { applyAiPlan, validateAiPlan } from '../../plan';
import type { AiPlan } from '../../types';
import {
  PLACEHOLDER_CLASS,
  PLACEHOLDER_NODES_MAX,
  PLACEHOLDER_NOTE,
  placeholderShapeOf,
  type PlaceholderShape,
} from './placeholder-shapes';
import { PAGE_SKELETON_LABEL, skeletonFromPlan } from './skeleton-from-plan';
import { validatePagePlan, type PagePlan } from './index';

/*
  The placeholders are the first thing a person sees of a build. These tests
  hold them to the contracts they sit between: the kernel door (every shape
  lands through validateAiPlan), the lander (outer tag, one h1 in the hero),
  document-summary (a page of placeholders is still "placeholders only"), and
  a byte budget, since every region's css travels with the page.
*/

const NullRender: BlockRenderComponent = () => null;

/** The product's region schema (custom-code CustomCodeBlock/schema.ts): label, tree, css. */
function blocks(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'placeholder-fixture',
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
}

function kernel(): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [blocks()],
    ports: { clock: fixedClock(1), ids: seededIds('ph') },
  });
}

const ports = () => ({ clock: fixedClock(1), ids: seededIds('ph-door') });

function policyFor(plan: AiPlan) {
  return {
    allowedCommands: [...new Set(plan.commands.map(({ command }) => command))],
    maxCommands: plan.commands.length,
  };
}

function accepted(value: unknown): PagePlan {
  const result = validatePagePlan(value);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  return result.plan;
}

const SECTIONS = {
  en: [
    ['header', 'header', 'Header', undefined],
    ['hero', 'hero', 'Brands that hold', undefined],
    ['services', 'band', 'What we do', 'grid'],
    ['pricing', 'band', 'Plans', 'pricing'],
    ['work', 'band', 'Selected work', 'gallery'],
    ['reviews', 'band', 'Kind words', 'quote'],
    ['faq', 'band', 'Questions', 'faq'],
    ['menu', 'band', 'The menu', 'menu'],
    ['contact', 'band', 'Get in touch', 'contact'],
    ['story', 'band', 'Our story', undefined],
    ['book', 'cta', 'Start a project', undefined],
    ['footer', 'footer', 'Footer', undefined],
  ],
  ar: [
    ['header', 'header', 'الترويسة', undefined],
    ['hero', 'hero', 'قهوة تُحمّص كل صباح', undefined],
    ['services', 'band', 'خدماتنا', 'grid'],
    ['pricing', 'band', 'الباقات', 'pricing'],
    ['work', 'band', 'معرض الأعمال', 'gallery'],
    ['reviews', 'band', 'آراء الزبائن', 'quote'],
    ['faq', 'band', 'الأسئلة الشائعة', 'faq'],
    ['menu', 'band', 'القائمة', 'menu'],
    ['contact', 'band', 'تواصل معنا', 'contact'],
    ['story', 'band', 'حكايتنا', undefined],
    ['book', 'cta', 'اطلب الآن', undefined],
    ['footer', 'footer', 'التذييل', undefined],
  ],
} as const;

/** Every shape on one page, in English or Arabic; `bespoke` makes the header a placeholder too. */
function everyShape(lang: 'en' | 'ar', bespoke = false): PagePlan {
  const plan = accepted({
    intent: 'replace',
    locale: { lang },
    title: lang === 'ar' ? 'محمصة الهيل' : 'Northlight Studio',
    description: lang === 'ar' ? 'قهوة مختصة في عمّان.' : 'A two-person brand studio in Leeds.',
    tokens: {
      bg: 'stone-50',
      surface: 'white',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'orange-700',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: lang === 'ar' ? 'Lalezar' : 'Archivo Black' },
      fontBody: { family: lang === 'ar' ? 'Almarai' : 'Archivo', weights: [400, 700] },
      radius: 'xl',
      signature: 'one quiet rule under each heading',
    },
    primaryCta: { label: lang === 'ar' ? 'اطلب الآن' : 'Book a call', href: '#book' },
    nav: [{ label: lang === 'ar' ? 'القائمة' : 'Work', anchorId: lang === 'ar' ? 'menu' : 'work' }],
    sections: SECTIONS[lang].map(([key, role, title, variant]) => ({
      key,
      role,
      title,
      anchorId: key,
      purpose: 'A section.',
      ...(variant === undefined ? {} : { variant }),
    })),
    facts: [],
  });
  return bespoke
    ? {
        ...plan,
        design: { kind: 'website', composition: 'bespoke', chrome: 'none', concept: 'A calm page.' },
      }
    : plan;
}

interface TreeNode {
  kind: string;
  tag?: string;
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
}

interface Inserted {
  readonly tree: TreeNode;
  readonly css: string | undefined;
}

function inserted(plan: AiPlan): Inserted[] {
  return plan.commands
    .filter(({ command }) => command === 'insertNode')
    .map(({ args }) => {
      const props = (args as { props: { tree: TreeNode; css?: string } }).props;
      return { tree: props.tree, css: props.css };
    });
}

function walk(node: TreeNode, visit: (node: TreeNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function elements(tree: TreeNode): TreeNode[] {
  const found: TreeNode[] = [];
  for (const child of tree.children ?? []) walk(child, (node) => found.push(node));
  return found;
}

function outer(tree: TreeNode): TreeNode {
  return tree.children?.[0] ?? { kind: 'missing' };
}

const SHAPES: readonly PlaceholderShape[] = [
  'bar',
  'hero',
  'features',
  'pricing',
  'gallery',
  'testimonials',
  'faq',
  'menu',
  'form',
  'generic',
  'cta',
  'footer',
];

/** The most bytes one placeholder (its tree JSON and its css) may add to the page. */
const PLACEHOLDER_BYTES_MAX = 3_200;

const bytes = (text: string) => new TextEncoder().encode(text).length;

describe('placeholderShapeOf — what a placeholder previews', () => {
  it('reads the role, then the variant, then the words, in English and Arabic', () => {
    for (const lang of ['en', 'ar'] as const) {
      expect(everyShape(lang, true).sections.map(placeholderShapeOf)).toEqual(SHAPES);
    }
    const band = everyShape('en').sections[9]!;
    expect(placeholderShapeOf({ ...band, title: 'Frequently asked' })).toBe('generic');
    expect(placeholderShapeOf({ ...band, key: 'faq-2' })).toBe('faq');
    expect(placeholderShapeOf({ ...band, title: 'أسعارنا' })).toBe('pricing');
    expect(placeholderShapeOf({ ...band, title: 'Client reviews' })).toBe('testimonials');
    // A cta reads as a band unless it is a form.
    const cta = everyShape('en').sections[10]!;
    expect(placeholderShapeOf({ ...cta, variant: 'contact' })).toBe('form');
    expect(placeholderShapeOf({ ...cta, title: 'Our pricing' })).toBe('cta');
  });
});

describe('the placeholders skeletonFromPlan lays', () => {
  for (const lang of ['en', 'ar'] as const) {
    it(`passes the kernel door and lands as ONE transaction, every shape (${lang})`, () => {
      const pagePlan = everyShape(lang, true);
      const target = kernel();
      const { plan } = skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' });
      const verdict = validateAiPlan(plan, target, ports(), policyFor(plan));
      expect(verdict.ok ? [] : verdict.issues).toEqual([]);
      const applied = applyAiPlan({
        kernel: target,
        validationPorts: ports(),
        plan,
        policy: policyFor(plan),
        label: PAGE_SKELETON_LABEL,
      });
      expect(applied.transactions).toHaveLength(1);

      // A page of placeholders is still read as one: the next build replaces it, not appends.
      const summary = summarizeDocumentForIntent(target.getDocument());
      expect(summary.placeholderOnly).toBe(true);
      expect(summary.sectionLabels).toEqual(pagePlan.sections.map(({ title }) => title));
    });
  }

  it('keeps the shape contract: outer tag and anchor, one h1 in the hero, the title as the one text', () => {
    const pagePlan = everyShape('ar', true);
    const regions = inserted(skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' }).plan);
    expect(regions.map(({ tree }) => outer(tree).tag)).toEqual([
      ...Array<string>(11).fill('section'),
      'footer',
    ]);
    regions.forEach(({ tree }, index) => {
      const contract = pagePlan.sections[index]!;
      const top = outer(tree);
      const all = elements(tree);
      expect(top.attributes?.['id']).toBe(contract.anchorId);
      expect(top.className?.split(' ')).toEqual(
        expect.arrayContaining([PLACEHOLDER_CLASS, `${PLACEHOLDER_CLASS}--${SHAPES[index]!}`]),
      );
      expect(all.length).toBeLessThanOrEqual(PLACEHOLDER_NODES_MAX);
      expect(all.filter(({ tag }) => tag === 'h1')).toHaveLength(contract.role === 'hero' ? 1 : 0);
      // The real title is the one line of text; the label is drawn by the css.
      expect(all.flatMap(({ text }) => (text === undefined ? [] : [text]))).toEqual([contract.title]);
      const heading = all.find(({ tag }) => tag === 'h1' || tag === 'h2');
      expect(heading?.text).toBe(contract.title);
      // The label is a polite live region, announced once.
      const status = all.filter(({ attributes }) => attributes?.['role'] === 'status');
      expect(status).toHaveLength(1);
      expect(status[0]?.className).toBe('ck-ph-note');
    });
  });

  it('labels each placeholder in the page language and draws it from the page tokens only', () => {
    for (const lang of ['en', 'ar'] as const) {
      const regions = inserted(
        skeletonFromPlan(everyShape(lang, true), { parentId: 'root', regionType: 'customCode' }).plan,
      );
      for (const { css } of regions) {
        expect(css).toBeDefined();
        const sheet = css ?? '';
        expect(sheet).toContain(`.ck-ph-note::after{content:"${PLACEHOLDER_NOTE[lang]!}"}`);
        expect(findCssRejection(sheet)).toBeUndefined();
        // No colour literal and no face: every colour is a var(--ck-*) token.
        expect(sheet).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(|font-family/iu);
        expect(sheet).toMatch(/var\(--ck-ink\)/u);
      }
    }
  });

  it('shimmers softly, and not at all for a person who asked for reduced motion', () => {
    const regions = inserted(
      skeletonFromPlan(everyShape('en', true), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    for (const { css } of regions) {
      expect(css).toContain('@keyframes ck-ph-sweep{');
      expect(css).toContain('animation:ck-ph-sweep');
      expect(css).toContain(
        '@media (prefers-reduced-motion:reduce){.ck-ph::after{display:none}.ck-ph-note::before{animation:none}}',
      );
    }
  });

  it('mirrors for a right-to-left page: lines end on the left, the sweep runs right to left', () => {
    const plan = (lang: 'en' | 'ar') =>
      inserted(skeletonFromPlan(everyShape(lang), { parentId: 'root', regionType: 'customCode' }).plan);
    const services = (lang: 'en' | 'ar') => plan(lang)[2]?.css ?? '';
    expect(services('en')).toContain(') left 0rem top 2rem/100%');
    expect(services('en')).not.toContain(') right ');
    expect(services('ar')).toContain(') right 0rem top 2rem/100%');
    expect(services('ar')).not.toContain(') left ');
    expect(services('en')).toMatch(/ck-ph-sweep 2\.4s ease-in-out infinite\}/u);
    expect(services('ar')).toMatch(/ck-ph-sweep 2\.4s ease-in-out infinite reverse\}/u);
  });

  it(`stays small: at most ${String(PLACEHOLDER_BYTES_MAX)} bytes a placeholder, well inside the region css limit`, () => {
    for (const lang of ['en', 'ar'] as const) {
      const regions = inserted(
        skeletonFromPlan(everyShape(lang, true), { parentId: 'root', regionType: 'customCode' }).plan,
      );
      for (const { tree, css } of regions) {
        expect(bytes(JSON.stringify(tree)) + bytes(css ?? '')).toBeLessThanOrEqual(
          PLACEHOLDER_BYTES_MAX,
        );
        // The fixture's (and the smallest product) region css ceiling.
        expect((css ?? '').length).toBeLessThan(8_000);
      }
    }
  });

  it('leaves the header and footer a full skeleton writes without a placeholder sheet', () => {
    const regions = inserted(
      skeletonFromPlan(everyShape('en'), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    expect(regions[0]?.css).toBeUndefined();
    expect(regions.at(-1)?.css).toBeUndefined();
    expect(JSON.stringify(regions[0]?.tree)).not.toContain(PLACEHOLDER_CLASS);
    expect(JSON.stringify(regions.at(-1)?.tree)).not.toContain(PLACEHOLDER_CLASS);
  });
});
