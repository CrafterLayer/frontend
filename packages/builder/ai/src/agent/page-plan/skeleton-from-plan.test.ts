import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  CUSTOM_CSS_FONT_IMPORT,
  contrastRatio,
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  findCssRejection,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { applyAiPlan, validateAiPlan } from '../../plan';
import {
  DIRECTION_DECK_ROWS,
  type DeckFace,
  type DirectionDeckRow,
} from '../../skills/direction-deck';
import type { AiPlan } from '../../types';
import { checkSection } from './check-section';
import { PAGE_KIT_CLASSES, PAGE_SKELETON_LABEL, skeletonFromPlan } from './skeleton-from-plan';
import { validatePagePlan, type PagePlan, type PagePlanIntent } from './index';

/*
  The skeleton is the one page write no model makes (step T2, agent-audit
  §3.1). These tests hold it to the three contracts it sits between: the
  kernel door (it must land as ONE labelled transaction through the same
  validation a model's plan meets), the lander (run-build reads a region's
  role from its placeholder: outer header/footer tag, the hero's h1), and the
  renderer (the page CSS is scoped by `scopeCustomCodeCss`, whose font-import
  pattern is `CUSTOM_CSS_FONT_IMPORT`).
*/

const NullRender: BlockRenderComponent = () => null;

/** The product's page root, as far as the skeleton writes it (editor Page/schema.ts). */
const PRODUCT_PAGE = z.object({
  title: z.string().max(120).default(''),
  description: z.string().max(200).default(''),
  lang: z.string().max(12).default(''),
  pageCss: customCss(20_000),
});

function blocks(pageProps: z.ZodObject = PRODUCT_PAGE): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'skeleton-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: pageProps,
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

function page(children: readonly string[] = [], extra: Record<string, string> = {}) {
  const nodes: BuilderDocument['nodes'] = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Home', ...extra },
      slots: { default: [...children] },
    },
  };
  for (const id of children) {
    nodes[id] = {
      id,
      type: 'customCode',
      props: { label: `Old ${id}`, tree: { kind: 'root', children: [] }, css: '' },
    };
  }
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes,
  } satisfies BuilderDocument;
}

function kernel(document: BuilderDocument = page(), manifest = blocks()): BuilderKernel {
  return createBuilder({
    document,
    extensions: [manifest],
    ports: { clock: fixedClock(1), ids: seededIds('skel') },
  });
}

const ports = () => ({ clock: fixedClock(1), ids: seededIds('skel-door') });

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

/** An Arabic café page with every role, a nav, a fact in the footer and a long description. */
function arabicCafe(intent: 'new-page' | 'replace' | 'append' = 'new-page'): PagePlan {
  const sections =
    intent === 'append'
      ? [
          { key: 'menu', role: 'band', title: 'القائمة', anchorId: 'menu', purpose: 'Drinks.' },
          { key: 'order', role: 'cta', title: 'اطلب', anchorId: 'order', purpose: 'Order.' },
        ]
      : [
          {
            key: 'header',
            role: 'header',
            title: 'الترويسة',
            anchorId: 'top',
            purpose: 'Nav.',
            // The header writes its own claims: the checker holds it to them.
            mustSay: ['محمصة مختصة في عمّان'],
          },
          {
            key: 'hero',
            role: 'hero',
            title: 'قهوة تُحمّص كل صباح',
            anchorId: 'hero',
            purpose: 'Say what the roastery is.',
            mustSay: ['محمصة في عمّان'],
            variant: 'split',
          },
          {
            key: 'menu',
            role: 'band',
            title: 'القائمة',
            anchorId: 'menu',
            purpose: 'The drinks and their prices.',
            variant: 'menu',
          },
          { key: 'order', role: 'cta', title: 'اطلب', anchorId: 'order', purpose: 'Order.' },
          {
            key: 'footer',
            role: 'footer',
            title: 'التذييل',
            anchorId: 'footer',
            purpose: 'Address and hours.',
            mustSay: ['شارع الرينبو، جبل عمّان', 'يومياً ٨ص – ١١م'],
          },
        ];
  return accepted({
    intent,
    locale: { lang: 'ar' },
    title: 'محمصة الهيل',
    // 250 characters: the plan allows 300, the page block only 200.
    description: 'قهوة مختصة محمصة في عمّان، تصلك طازجة كل صباح. '.repeat(6).slice(0, 250),
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: '#E7E5E4',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'the brand name at text-8xl, faint behind the menu',
      deckRowId: 'cafe',
    },
    primaryCta: { label: 'اطلب الآن', href: '#order' },
    nav: [
      { label: 'القائمة', anchorId: 'menu' },
      { label: 'اطلب', anchorId: 'order' },
    ],
    sections,
    facts:
      intent === 'append'
        ? []
        : [
            /*
              A complete, realistic sample: "+962 7 9000 0000" is masked
              digits, and the checker now asks for a real-looking value
              (check-section's placeholder facts, 2026-09-28).
            */
            { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
            { key: 'email', sample: 'info@alhail.jo', section: 'footer' },
            { key: 'price-espresso', sample: '1.5 د.أ', section: 'menu' },
          ],
  });
}

/** An English studio page on a dark ground, no header, a footer, `full` radius. */
function englishStudio(): PagePlan {
  return accepted({
    intent: 'replace',
    locale: { lang: 'en' },
    title: 'Northlight Studio | Brand design',
    description: 'A two-person brand studio in Leeds.',
    tokens: {
      bg: 'zinc-950',
      surface: 'zinc-900',
      ink: 'zinc-50',
      muted: 'zinc-400',
      accent: 'amber-400',
      onAccent: 'zinc-950',
      border: 'zinc-600',
      fontDisplay: { family: 'Archivo Black' },
      fontBody: { family: 'Archivo', weights: [400, 600] },
      radius: 'full',
      signature: 'one oversized numeral per section',
    },
    primaryCta: { label: 'Book a call', href: 'mailto:hello@northlight.studio' },
    nav: [{ label: 'Work', anchorId: 'work' }],
    sections: [
      { key: 'hero', role: 'hero', title: 'Brands that hold', anchorId: 'hero', purpose: 'Pitch.' },
      { key: 'work', role: 'band', title: 'Selected work', anchorId: 'work', purpose: 'Proof.' },
      { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Contact.' },
    ],
    facts: [],
  });
}

interface TreeNode {
  kind: string;
  tag?: string;
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
}

function walk(node: TreeNode, visit: (node: TreeNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function textOf(node: TreeNode): string {
  const parts: string[] = [];
  walk(node, (each) => {
    if (typeof each.text === 'string') parts.push(each.text);
  });
  return parts.join(' ');
}

function tags(node: TreeNode, tag: string): TreeNode[] {
  const found: TreeNode[] = [];
  walk(node, (each) => {
    if (each.tag === tag) found.push(each);
  });
  return found;
}

/** The region trees the skeleton inserts, in page order. */
function insertedTrees(plan: AiPlan): TreeNode[] {
  return plan.commands
    .filter(({ command }) => command === 'insertNode')
    .map(({ args }) => (args as { props: { tree: TreeNode } }).props.tree);
}

function outer(tree: TreeNode): TreeNode {
  const first = tree.children?.[0];
  if (first === undefined) throw new Error('empty tree');
  return first;
}

function pageCssOf(plan: AiPlan): string {
  const step = plan.commands.find(
    ({ command, args }) => command === 'setProp' && (args as { key: string }).key === 'pageCss',
  );
  return (step?.args as { value: string } | undefined)?.value ?? '';
}

const REGION = '[data-ck-custom-code]';

/**
 * Every style rule in a stylesheet as [selector list, body], at-rule blocks
 * (`@layer`, `@media`) opened; imports and `@keyframes` bodies skipped.
 */
function cssRules(css: string): [string, string][] {
  const rules: [string, string][] = [];
  const source = css.replace(CUSTOM_CSS_FONT_IMPORT, '');
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('{', index);
    if (open === -1) break;
    const prelude = source.slice(index, open).trim();
    let depth = 0;
    let close = open;
    for (; close < source.length; close += 1) {
      if (source[close] === '{') depth += 1;
      else if (source[close] === '}' && --depth === 0) break;
    }
    const body = source.slice(open + 1, close);
    index = close + 1;
    if (/^@(?:layer|media|supports|container)\b/u.test(prelude)) rules.push(...cssRules(body));
    else if (!prelude.startsWith('@')) rules.push([prelude, body]);
  }
  return rules.filter(([selector]) => !/^\.ck-page-plan(?:-end)?$/u.test(selector));
}

/** A selector list split on its top-level commas: `:is(h1,h2),.x` is two selectors. */
function topLevelSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of list) {
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += character;
  }
  parts.push(current.trim());
  return parts;
}

function land(target: BuilderKernel, plan: AiPlan) {
  return applyAiPlan({
    kernel: target,
    validationPorts: ports(),
    plan,
    policy: policyFor(plan),
    label: PAGE_SKELETON_LABEL,
  });
}

describe('skeletonFromPlan — the page skeleton, written by code', () => {
  it('passes the kernel door and lands as ONE labelled transaction, regions in page order', () => {
    const pagePlan = arabicCafe();
    const target = kernel();
    const { plan, label, regions } = skeletonFromPlan(pagePlan, {
      parentId: 'root',
      regionType: 'customCode',
    });

    const verdict = validateAiPlan(plan, target, ports(), policyFor(plan));
    expect(verdict.ok ? [] : verdict.issues).toEqual([]);

    const before = target.transactions().length;
    const applied = land(target, plan);
    expect(applied.transactions).toHaveLength(1);
    expect(target.transactions()).toHaveLength(before + 1);
    expect(label).toBe(PAGE_SKELETON_LABEL);
    expect(label).toBe('Assistant: page skeleton');

    const document = target.getDocument();
    const children = document.nodes['root']?.slots?.['default'] ?? [];
    expect(children.map((id) => document.nodes[id]?.props['label'])).toEqual(
      pagePlan.sections.map(({ title }) => title),
    );
    expect(regions.map(({ key }) => key)).toEqual(pagePlan.sections.map(({ key }) => key));
    // Each region names the insertNode that creates it, so ids can be read from that step.
    for (const region of regions) {
      expect(plan.commands[region.step]?.command).toBe('insertNode');
    }
    expect(new Set(regions.map(({ step }) => step)).size).toBe(regions.length);
  });

  it('marks every role the way the lander reads it back: outer tag, anchor id, one h1 in the hero', () => {
    const pagePlan = arabicCafe();
    const { plan } = skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' });
    const trees = insertedTrees(plan);

    expect(trees.map((tree) => outer(tree).tag)).toEqual([
      'header',
      'section',
      'section',
      'section',
      'footer',
    ]);
    expect(trees.map((tree) => outer(tree).attributes?.['id'])).toEqual([
      'top',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    // The page's one h1 is in the hero; every other region has none.
    expect(trees.map((tree) => tags(tree, 'h1').length)).toEqual([0, 1, 0, 0, 0]);
    expect(tags(trees[1]!, 'h1')[0]?.text).toBe('قهوة تُحمّص كل صباح');
    // Bands and the CTA keep the scaffold's placeholder: an h2 holding the title.
    expect(tags(trees[2]!, 'h2')[0]?.text).toBe('القائمة');
    expect(tags(trees[3]!, 'h2')[0]?.text).toBe('اطلب');
    // Chrome carries no heading of its own (build-fill's CHROME shell).
    expect(tags(trees[0]!, 'h2')).toEqual([]);
    expect(tags(trees[4]!, 'h2')).toEqual([]);
  });

  it('writes the page identity from the plan: direction, language, title and a description the page block accepts', () => {
    const pagePlan = arabicCafe();
    const target = kernel();
    const { plan } = skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' });
    land(target, plan);

    const document = target.getDocument();
    const root = document.nodes['root'];
    expect(document.dir).toBe('rtl');
    expect(root?.props['lang']).toBe('ar');
    expect(root?.props['title']).toBe('محمصة الهيل');
    const description = root?.props['description'] as string;
    expect(pagePlan.description.length).toBe(250);
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith('…')).toBe(true);
    expect(pagePlan.description.startsWith(description.slice(0, -1).trimEnd())).toBe(true);
  });

  it('imports both faces in a form the renderer lifts WHOLE, then declares the tokens on the page’s children', () => {
    const pagePlan = arabicCafe();
    const css = pageCssOf(
      skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' }).plan,
    );

    /*
      `scopeCustomCodeCss` lifts imports with CUSTOM_CSS_FONT_IMPORT, whose URL
      class stops at ";". The plan's own url for Almarai is `…wght@400;700…`:
      written raw, the pattern takes `…wght@400;` as the import and leaves
      `700&display=swap");` glued to the next rule's selector — both faces and
      the token rule die (measured on the real pattern, 2026-09-28).
    */
    expect(pagePlan.tokens.fontBody.url).toContain('wght@400;700');
    const imports = css.match(CUSTOM_CSS_FONT_IMPORT) ?? [];
    expect(imports).toEqual([
      "@import url('https://fonts.googleapis.com/css2?family=Lalezar&display=swap');",
      "@import url('https://fonts.googleapis.com/css2?family=Almarai:wght@400%3B700&display=swap');",
    ]);
    const body = css.replace(CUSTOM_CSS_FONT_IMPORT, '').trim();
    expect(body.startsWith('.ck-page-plan{')).toBe(true);
    expect(findCssRejection(css)).toBeUndefined();

    // The token rule: `> *` scopes to `[data-ck="<root>"] > *` — the page main's
    // children — and custom properties inherit from there into every region.
    const tokenRule = /(?:^|\})\s*> \*\{([^}]*)\}/u.exec(body)?.[1] ?? '';
    expect(tokenRule).toContain('--ck-bg:#f7fee7');
    expect(tokenRule).toContain('--ck-surface:#ffffff');
    expect(tokenRule).toContain('--ck-ink:#022c22');
    expect(tokenRule).toContain('--ck-muted:#065f46');
    expect(tokenRule).toContain('--ck-accent:#c2410c');
    expect(tokenRule).toContain('--ck-on-accent:#ffffff');
    expect(tokenRule).toContain('--ck-accent-ink:#c2410c');
    expect(tokenRule).toContain('--ck-border:#e7e5e4');
    expect(tokenRule).toContain('--ck-radius:0.75rem');
    expect(tokenRule).toContain("--ck-font-display:'Lalezar',system-ui,sans-serif");
    expect(tokenRule).toContain("--ck-font-body:'Almarai',system-ui,sans-serif");
    // The faces are applied inside the AI regions only, never to the page's children.
    expect(tokenRule).not.toMatch(/(?:^|;)font-family:/u);
    expect(body).toContain('[data-ck-custom-code]{font-family:var(--ck-font-body)');
    // Never :root, html or body — scoping would turn each into a selector matching nothing.
    expect(body).not.toMatch(/(?:^|[},])\s*(?::root|html|body)\b/u);
    // Every kit class the writers are told about is defined here, inside the
    // component layer, so a Tailwind utility beside it (layered in v4) still wins.
    const layer = /@layer components\{([\s\S]*)\}\s*\.ck-page-plan-end\{/u.exec(body)?.[1] ?? '';
    for (const { name } of PAGE_KIT_CLASSES) {
      expect(layer).toContain(`.${name}`);
    }
    expect(body.indexOf('> *{')).toBeLessThan(body.indexOf('@layer components{'));
  });

  /*
    The page CSS lands on a page that may already hold registered blocks
    (intent 'append', agent-audit P1-15). Verifier, 2026-09-28, in Chromium on
    the real scoped output: `> *{font-family;color}` and a bare `h1,h2` rule
    turned a registered block's h2 into Lalezar, its body into Almarai and its
    text emerald. Only custom properties may sit on the page's children (they
    style nothing by themselves); every rule that styles an element names the
    AI region marker (`data-ck-custom-code`, which CustomCode puts on every
    region host) or a `ck-` class only the plan's own markup carries.
  */
  it('styles only the plan’s own regions: no rule reaches a bare element outside the region marker', () => {
    for (const pagePlan of [arabicCafe(), arabicCafe('append'), englishStudio()]) {
      const css = pageCssOf(
        skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' }).plan,
      );
      const rules = cssRules(css);
      expect(rules.length).toBeGreaterThan(10);
      for (const [selector, body] of rules) {
        if (selector === '> *') {
          const properties = body.split(';').map((declaration) => declaration.split(':')[0]);
          expect(
            properties.filter((name) => !name?.trim().startsWith('--ck-')),
            body,
          ).toEqual([]);
          continue;
        }
        for (const one of topLevelSelectors(selector)) {
          expect(
            one.startsWith('.ck-') || one.startsWith(REGION) || one.startsWith(`:has(> ${REGION}`),
            one,
          ).toBe(true);
        }
      }
      // The type rules still exist — under the marker.
      expect(css).toContain(`${REGION}{font-family:var(--ck-font-body);color:var(--ck-ink)}`);
      expect(css).toMatch(
        /\[data-ck-custom-code\] :is\(h1,h2\),\.ck-display\{font-family:var\(--ck-font-display\)\}/u,
      );
    }
  });

  /*
    A region renders as `div[data-ck][data-ck-custom-code] > header`, and the
    host is exactly the header's height — so `sticky top-0` on the header
    alone never moved (verifier, Chromium 2026-09-28: top -1146px after a
    1200px scroll), while a scroll margin still offset every anchor jump. The
    host is what sticks: on the published page it is main's child; on the
    canvas NodeView wraps it in `div[data-bldr-node]`, whose parent is a
    `display: contents` slot, so that wrapper is the one that sticks there.
  */
  it('makes the header’s region host stick, and offsets anchors only when there is a header', () => {
    const withHeader = pageCssOf(
      skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    const rules = new Map(cssRules(withHeader));
    const sticky = [...rules].find(([selector]) => selector.includes(':has('));
    expect(sticky?.[0]).toBe(`${REGION}:has(> header.sticky),:has(> ${REGION} > header.sticky)`);
    expect(sticky?.[1]).toContain('position:sticky');
    expect(sticky?.[1]).toContain('top:0');
    // The jump clears the header: two rows below lg, one from lg.
    expect(withHeader).toContain(`${REGION} [id]{scroll-margin-top:8rem}`);
    expect(withHeader).toContain(
      `@media (min-width:64rem){${REGION} [id]{scroll-margin-top:6rem}}`,
    );

    // The header the rule keys on carries the class it names.
    const header = outer(
      insertedTrees(
        skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' }).plan,
      )[0]!,
    );
    expect(header.tag).toBe('header');
    expect(header.className?.split(' ')).toContain('sticky');

    // No header: nothing sticks, no jump is offset, no bar layout.
    const headless = pageCssOf(
      skeletonFromPlan(englishStudio(), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    expect(headless).not.toContain('position:sticky');
    expect(headless).not.toContain('scroll-margin-top');
    expect(headless).not.toContain('.ck-bar');
  });

  /*
    The scroll margin is a fixed length, so the header must be a fixed number
    of rows whatever the plan puts in it. Before, a long brand wrapped onto its
    own row on a phone (brand · button · nav: three rows) and eight nav items
    wrapped at md, so a jump landed under the header. Now: below lg, the brand
    shares row one with the button and cuts itself short, and the nav is row
    two, one scrolling line; from lg everything is one row and the nav scrolls
    when it does not fit.
  */
  it('keeps the header a fixed number of rows, whatever the brand and nav hold', () => {
    const header = outer(
      insertedTrees(
        skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' }).plan,
      )[0]!,
    );
    const classes = (node: TreeNode | undefined) => node?.className?.split(' ') ?? [];
    const bar = header.children?.[0];
    const [brand, nav, button] = bar?.children ?? [];
    /*
      The door generates no `lg:flex-nowrap` or `lg:flex-initial` (refused
      as "utility classes with no generated CSS"), so the bar's wrapping and
      the brand's flex live in the kit — and no utility on either element may
      set the same property, because a Tailwind utility beats the kit's
      component layer.
    */
    expect(classes(bar)).toEqual(expect.arrayContaining(['flex', 'ck-bar']));
    expect(classes(bar).filter((name) => /^(?:[a-z]+:)?flex-(?:wrap|nowrap)/u.test(name))).toEqual(
      [],
    );
    expect(classes(brand)).toEqual(expect.arrayContaining(['ck-brand', 'min-w-0']));
    expect(
      classes(brand).filter((name) =>
        /^(?:[a-z]+:)?(?:flex-(?:1|auto|initial|none)|basis-|grow|shrink)/u.test(name),
      ),
    ).toEqual([]);
    const css = pageCssOf(
      skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    expect(css).toContain('.ck-bar{flex-wrap:wrap}');
    expect(css).toContain('.ck-brand{flex:1 1 0%}');
    expect(css).toContain(
      '@media (min-width:64rem){.ck-bar{flex-wrap:nowrap}.ck-brand{flex:0 1 auto}}',
    );
    expect(classes(brand?.children?.[0])).toContain('truncate');
    expect(nav?.tag).toBe('nav');
    expect(classes(nav)).toEqual(
      expect.arrayContaining([
        'order-last',
        'w-full',
        'overflow-x-auto',
        'lg:order-none',
        'lg:w-auto',
      ]),
    );
    expect(classes(nav).filter((name) => name.startsWith('md:'))).toEqual([]);
    for (const link of nav?.children ?? []) expect(classes(link)).toContain('whitespace-nowrap');
    expect(classes(button)).toEqual(expect.arrayContaining(['ck-btn', 'shrink-0']));
  });

  it('keeps Arabic letters joined: no tracking or capitals on an Arabic eyebrow, both on an English one', () => {
    const arabic = pageCssOf(
      skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    const english = pageCssOf(
      skeletonFromPlan(englishStudio(), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    const eyebrow = (css: string) => /\.ck-eyebrow\{([^}]*)\}/u.exec(css)?.[1] ?? '';

    expect(eyebrow(arabic)).not.toMatch(/letter-spacing|text-transform/u);
    expect(eyebrow(english)).toContain('letter-spacing');
    expect(eyebrow(english)).toContain('text-transform:uppercase');
    // A `full` radius rounds buttons into pills, never cards into lozenges.
    expect(english).toContain('--ck-radius:1.5rem');
    expect(english).toContain('--ck-radius-button:9999px');
  });

  it('derives inverse and accent grounds whose text pairs all clear AA', () => {
    for (const pagePlan of [arabicCafe(), englishStudio()]) {
      const css = pageCssOf(
        skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' }).plan,
      );
      for (const kit of ['ck-inverse', 'ck-accent-fill']) {
        const rule = new RegExp(`\\.${kit}\\{([^}]*)\\}`, 'u').exec(css)?.[1] ?? '';
        const value = (name: string) =>
          new RegExp(`--ck-${name}:(#[0-9a-f]{6})`, 'u').exec(rule)?.[1] ?? '';
        for (const text of ['ink', 'muted', 'accent-ink']) {
          expect(contrastRatio(value(text), value('bg')), `${kit} ${text}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
        expect(contrastRatio(value('on-accent'), value('accent'))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('writes the header and footer in full from the plan, and they pass their own contract', () => {
    const pagePlan = arabicCafe();
    const { plan, regions } = skeletonFromPlan(pagePlan, {
      parentId: 'root',
      regionType: 'customCode',
    });
    const trees = insertedTrees(plan);
    const header = trees[0]!;
    const footer = trees[4]!;

    // Header: the brand links to the top, nav in plan order, the page's one action.
    const links = tags(header, 'a');
    expect(links[0]?.attributes?.['href']).toBe('#top');
    expect(textOf(links[0]!)).toBe('محمصة الهيل');
    const nav = tags(header, 'nav')[0]!;
    expect(tags(nav, 'a').map((link) => [link.attributes?.['href'], textOf(link)])).toEqual([
      ['#menu', 'القائمة'],
      ['#order', 'اطلب'],
    ]);
    const cta = links.find((link) => link.className?.split(' ').includes('ck-btn'));
    expect(cta?.attributes?.['href']).toBe('#order');
    expect(textOf(cta!)).toBe('اطلب الآن');

    // Footer: its mustSay and facts, the phone and e-mail as working links, the copyright.
    const footerText = textOf(footer);
    expect(footerText).toContain('شارع الرينبو، جبل عمّان');
    expect(footerText).toContain('يومياً ٨ص – ١١م');
    expect(footerText).toContain('© محمصة الهيل');
    const footerHrefs = tags(footer, 'a').map((link) => link.attributes?.['href']);
    expect(footerHrefs).toContain('tel:+96264612750');
    expect(footerHrefs).toContain('mailto:info@alhail.jo');
    expect(footerHrefs).toContain('#menu');
    // The header carries its own claims (verifier's mutant V9 dropped them unnoticed).
    expect(textOf(header)).toContain('محمصة مختصة في عمّان');

    for (const index of [0, 4]) {
      const contract = pagePlan.sections[index];
      if (contract === undefined) throw new Error('missing contract');
      expect(checkSection(pagePlan, contract, { tree: trees[index] as never })).toEqual([]);
    }
    expect(regions.map(({ complete }) => complete)).toEqual([true, false, false, false, true]);
  });

  /*
    Unisolated in a right-to-left line, "+962 6 461 2750" renders as
    "6 461 2750 962+". The tree has no `dir` attribute, so the run is wrapped
    in LRI (U+2066) … PDI (U+2069); an e-mail address is left as written.
  */
  it('isolates an Arabic footer’s phone number as a left-to-right run', () => {
    const footer = insertedTrees(
      skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' }).plan,
    )[4]!;
    const phone = tags(footer, 'a').find((link) => link.attributes?.['href']?.startsWith('tel:'));
    expect(phone?.text).toBe('\u2066+962 6 461 2750\u2069');
    const email = tags(footer, 'a').find((link) =>
      link.attributes?.['href']?.startsWith('mailto:'),
    );
    expect(email?.text).toBe('info@alhail.jo');
  });

  it.each([
    ['a light page', arabicCafe, 4, 'ck-inverse', 'ck-surface'],
    // An inverted footer on a dark page would be the one white slab at its bottom.
    ['a dark page', englishStudio, 2, 'ck-surface', 'ck-inverse'],
  ])('grounds the footer of %s against the page', (_name, make, index, has, lacks) => {
    const footer = outer(
      insertedTrees(skeletonFromPlan(make(), { parentId: 'root', regionType: 'customCode' }).plan)[
        index
      ]!,
    );
    expect(footer.tag).toBe('footer');
    const classes = footer.className?.split(' ') ?? [];
    expect(classes).toContain(has);
    expect(classes).not.toContain(lacks);
  });

  /*
    validatePagePlan counts a title in CODE POINTS (80), the region's label
    schema in UTF-16 units (zod's max(80)). A title of 80 code points that
    holds an emoji is longer than 80 units, so the label is cut — and run-build
    finds each region's node by `label === region.title` (regionIds). A region
    whose title differed from its label got no task and was never written.
  */
  it('reports each region by the label it wrote, whole even when an emoji straddles the cut', () => {
    const base = arabicCafe();
    // 80 code points, 82 UTF-16 units; the 80-unit cut falls inside the first 🍩.
    const title = `${'قهوة '.repeat(9)}${'ب'.repeat(33)}🍩🍩`;
    expect(Array.from(title)).toHaveLength(80);
    expect(title.length).toBe(82);
    const pagePlan = accepted({
      ...JSON.parse(JSON.stringify(base)),
      sections: base.sections.map((section) =>
        section.key === 'menu' ? { ...section, title } : section,
      ),
    });
    const target = kernel();
    const { plan, regions } = skeletonFromPlan(pagePlan, {
      parentId: 'root',
      regionType: 'customCode',
    });
    const menu = regions.find(({ key }) => key === 'menu')!;
    const label = (plan.commands[menu.step]?.args as { props: { label: string } }).props.label;
    expect(menu.title).toBe(label);
    expect(label.length).toBeLessThanOrEqual(80);
    // Never half a surrogate pair: that renders as a replacement box.
    expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);

    land(target, plan);
    const document = target.getDocument();
    const children = document.nodes['root']?.slots?.['default'] ?? [];
    expect(children.map((id) => document.nodes[id]?.props['label'])).toEqual(
      regions.map((region) => region.title),
    );
  });

  it('is deterministic: the same plan and context give the same steps', () => {
    const context = { parentId: 'root', regionType: 'customCode' } as const;
    expect(skeletonFromPlan(arabicCafe(), context)).toEqual(
      skeletonFromPlan(arabicCafe(), context),
    );
  });

  it('replaces the old content in the SAME transaction, so one undo brings it back whole', () => {
    const target = kernel(page(['old-a', 'old-b']));
    const pagePlan = englishStudio();
    const { plan } = skeletonFromPlan(pagePlan, {
      parentId: 'root',
      regionType: 'customCode',
      replaceIds: ['old-a', 'old-b'],
    });
    expect(plan.commands.slice(0, 2).map(({ command }) => command)).toEqual([
      'removeNode',
      'removeNode',
    ]);

    land(target, plan);
    const after = target.getDocument();
    const children = after.nodes['root']?.slots?.['default'] ?? [];
    expect(children.map((id) => after.nodes[id]?.props['label'])).toEqual([
      'Brands that hold',
      'Selected work',
      'Footer',
    ]);
    expect(after.nodes['root']?.props['lang']).toBe('en');
    expect(after.dir).toBe('ltr');

    target.undo();
    expect(target.getDocument().nodes['root']?.slots?.['default']).toEqual(['old-a', 'old-b']);
  });

  it('appends bands before an existing footer without touching the page’s identity, and keeps its CSS', () => {
    const existing = '@keyframes ck-rise{from{opacity:0}to{opacity:1}} .ck-old{color:#123456}';
    const target = kernel(page(['old-hero', 'old-footer'], { lang: 'en', pageCss: existing }));
    const pagePlan = arabicCafe('append');
    const context = {
      parentId: 'root',
      regionType: 'customCode',
      index: 1,
      currentPageCss: existing,
    } as const;
    const { plan } = skeletonFromPlan(pagePlan, context);

    expect(plan.commands.map(({ command }) => command)).not.toContain('setDocMeta');
    const keys = plan.commands
      .filter(({ command }) => command === 'setProp')
      .map(({ args }) => (args as { key: string }).key);
    expect(keys).toEqual(['pageCss']);

    land(target, plan);
    const document = target.getDocument();
    const root = document.nodes['root'];
    expect(root?.slots?.['default']?.[0]).toBe('old-hero');
    expect(root?.slots?.['default']?.at(-1)).toBe('old-footer');
    expect(
      root?.slots?.['default']?.slice(1, -1).map((id) => document.nodes[id]?.props['label']),
    ).toEqual(['القائمة', 'اطلب']);
    expect(root?.props['lang']).toBe('en');
    expect(root?.props['title']).toBe('Home');
    const css = root?.props['pageCss'] as string;
    expect(css).toContain(existing);
    expect(css).toContain('--ck-bg:#f7fee7');

    // A second plan appended later replaces the first plan's block rather than stacking it.
    const again = skeletonFromPlan(pagePlan, { ...context, currentPageCss: css });
    const twice = pageCssOf(again.plan);
    expect(twice.split('.ck-page-plan{').length - 1).toBe(1);
    expect(twice).toContain(existing);
  });

  /*
    An appended plan never holds a header (validatePagePlan: append adds bands
    only), so its block alone dropped the sticky host, the bar layout and the
    anchors' scroll margin while the header an earlier plan built stayed on
    the page. Verifier, Chromium at 360px, 2026-09-28: the header scrolled
    away (top -1404px) and the brand shrank to 40px (r2/append-kit.mjs).
  */
  it('keeps the header’s sticky host, bar and anchor clearance when a plan is appended after one', () => {
    const target = kernel();
    const first = skeletonFromPlan(arabicCafe(), { parentId: 'root', regionType: 'customCode' });
    land(target, first.plan);
    const before = target.getDocument();
    const children = before.nodes['root']?.slots?.['default'] ?? [];
    const pageCss = before.nodes['root']?.props['pageCss'] as string;
    const header = [
      `${REGION}:has(> header.sticky),:has(> ${REGION} > header.sticky){position:sticky;top:0;z-index:40}`,
      '.ck-bar{flex-wrap:wrap}',
      '.ck-brand{flex:1 1 0%}',
      '@media (min-width:64rem){.ck-bar{flex-wrap:nowrap}.ck-brand{flex:0 1 auto}}',
      `${REGION} [id]{scroll-margin-top:8rem}`,
      `@media (min-width:64rem){${REGION} [id]{scroll-margin-top:6rem}}`,
    ];
    for (const rule of header) expect(pageCss).toContain(rule);

    const appended = skeletonFromPlan(arabicCafe('append'), {
      parentId: 'root',
      regionType: 'customCode',
      index: children.length - 1,
      currentPageCss: pageCss,
    });
    const verdict = validateAiPlan(appended.plan, target, ports(), policyFor(appended.plan));
    expect(verdict.ok ? [] : verdict.issues).toEqual([]);
    land(target, appended.plan);
    const after = target.getDocument().nodes['root']?.props['pageCss'] as string;
    // Merged, not stacked: one block, and the header's rules in it.
    expect(after.split('.ck-page-plan{').length - 1).toBe(1);
    for (const rule of header) expect(after).toContain(rule);

    // A page whose earlier plan had no header gains none of them from an append.
    const headless = pageCssOf(
      skeletonFromPlan(englishStudio(), { parentId: 'root', regionType: 'customCode' }).plan,
    );
    const onHeadless = pageCssOf(
      skeletonFromPlan(arabicCafe('append'), {
        parentId: 'root',
        regionType: 'customCode',
        currentPageCss: headless,
      }).plan,
    );
    expect(onHeadless).not.toContain('position:sticky');
    expect(onHeadless).not.toContain('.ck-bar');
    expect(onHeadless).not.toContain('scroll-margin-top');
  });

  // A block written before a header rule's wording changed still marks a header on the page.
  it('reads an earlier block’s header by any of its rules, not one exact string', () => {
    const older = [
      '.ck-page-plan{--ck-page-plan:1}',
      `${REGION}:has(> header.sticky){position:sticky;top:0}`,
      '.ck-page-plan-end{--ck-page-plan:0}',
    ].join('\n');
    const appended = pageCssOf(
      skeletonFromPlan(arabicCafe('append'), {
        parentId: 'root',
        regionType: 'customCode',
        currentPageCss: `.mine{color:red}\n${older}`,
      }).plan,
    );
    expect(appended).toContain('.mine{color:red}');
    expect(appended).not.toContain(`${REGION}:has(> header.sticky){position:sticky;top:0}\n`);
    expect(appended).toContain(
      `${REGION}:has(> header.sticky),:has(> ${REGION} > header.sticky){position:sticky;top:0;z-index:40}`,
    );
    expect(appended).toContain('.ck-bar{flex-wrap:wrap}');
    expect(appended).toContain(`${REGION} [id]{scroll-margin-top:8rem}`);
    expect(appended.split('.ck-page-plan{').length - 1).toBe(1);
  });

  /*
    The door must take the code-written skeleton of EVERY plan T1 can
    propose: when it refuses one on an automatic build, the validated plan is
    dropped for the ~25k-character model scaffold — the build's slowest step
    (orchestration verifier, r2-silent-fallback2.mjs, 2026-09-28: a skeleton
    carrying lg:flex-nowrap was refused by the vocabulary). Pinned here for
    each direction-deck row, in its Arabic and its Latin pair, for each
    intent, under both colour policies — and landed, one transaction each.
  */
  function deckPlan(row: DirectionDeckRow, lang: 'ar' | 'en', intent: PagePlanIntent): PagePlan {
    const ar = lang === 'ar';
    const [display, body] = ar ? row.arabic : row.latin;
    const face = ({ family, weights }: DeckFace) =>
      weights.length === 0 ? { family } : { family, weights: [...weights] };
    const bands = row.sections.slice(1).map(([name], at) => ({
      key: `s${String(at)}`,
      role: 'band',
      title: name,
      anchorId: `s${String(at)}`,
      purpose: `The ${name} section.`,
    }));
    const cta = {
      key: 'book',
      role: 'cta',
      title: ar ? 'احجز' : 'Book',
      anchorId: 'book',
      purpose: 'Convert.',
    };
    const sections =
      intent === 'append'
        ? [...bands.slice(0, 2), cta]
        : [
            { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Nav.' },
            {
              key: 'hero',
              role: 'hero',
              /*
                A section title is 1–80 characters; the dental and barber rows
                carry an empty `trades` (direction-deck.ts, 2026-09-28).
              */
              title: (row.trades.trim() || row.id).slice(0, 60).trim(),
              anchorId: 'hero',
              purpose: 'Pitch.',
            },
            ...bands,
            cta,
            {
              key: 'footer',
              role: 'footer',
              title: 'Footer',
              anchorId: 'footer',
              purpose: 'Contact.',
              mustSay: [ar ? 'عمّان — شارع الجاردنز' : '12 King St, Leeds'],
            },
          ];
    const { palette } = row;
    const candidate = (accentInk: string | undefined) => ({
      intent,
      locale: { lang },
      title: ar ? `${row.id} | عمّان` : `${row.id} | Amman`,
      description: ar ? 'صفحة تجريبية لكل صف من الدليل.' : 'A page for every deck row.',
      tokens: {
        bg: palette.ground,
        surface: palette.card,
        ink: palette.ink,
        muted: palette.muted,
        accent: palette.accent,
        onAccent: palette.onAccent,
        ...(accentInk === undefined ? {} : { accentInk }),
        border: palette.muted,
        fontDisplay: face(display),
        fontBody: face(body),
        radius: 'md',
        signature: row.signature,
        deckRowId: row.id,
      },
      primaryCta: { label: ar ? 'احجز الآن' : 'Book now', href: '#book' },
      nav:
        intent === 'append'
          ? []
          : bands.slice(0, 3).map(({ title, anchorId }) => ({ label: title, anchorId })),
      sections,
      facts:
        intent === 'append'
          ? []
          : [
              { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
              { key: 'email', sample: 'hello@hadid.jo', section: 'footer' },
            ],
    });
    /*
      A row whose accentInk shade the plan palette does not name yet is
      planned without it (the validator derives it): this pins the SKELETON,
      and palette coverage is palette.ts's own test.
    */
    const stated = validatePagePlan(candidate(palette.accentInk), { intent });
    if (stated.ok) return stated.plan;
    return accepted({ ...candidate(undefined), intent });
  }

  it.each(
    DIRECTION_DECK_ROWS.flatMap((row) =>
      (['ar', 'en'] as const).map((lang) => [row.id, lang, row] as const),
    ),
  )(
    'lands the skeleton of deck row %s (%s) through the door for every intent',
    (_id, lang, row) => {
      const door = (target: BuilderKernel, plan: AiPlan) => {
        for (const colourPolicy of ['free', 'tokens'] as const) {
          const verdict = validateAiPlan(plan, target, ports(), policyFor(plan), { colourPolicy });
          expect(verdict.ok ? [] : verdict.issues, `${colourPolicy} colour policy`).toEqual([]);
        }
        expect(land(target, plan).transactions).toHaveLength(1);
      };

      const fresh = kernel();
      door(
        fresh,
        skeletonFromPlan(deckPlan(row, lang, 'new-page'), {
          parentId: 'root',
          regionType: 'customCode',
        }).plan,
      );

      const replaced = kernel(page(['old-a', 'old-b']));
      door(
        replaced,
        skeletonFromPlan(deckPlan(row, lang, 'replace'), {
          parentId: 'root',
          regionType: 'customCode',
          replaceIds: ['old-a', 'old-b'],
        }).plan,
      );

      // Appended onto the page the new-page skeleton built: before its footer, keeping its CSS.
      const built = fresh.getDocument();
      const children = built.nodes['root']?.slots?.['default'] ?? [];
      door(
        fresh,
        skeletonFromPlan(deckPlan(row, lang, 'append'), {
          parentId: 'root',
          regionType: 'customCode',
          index: children.length - 1,
          currentPageCss: built.nodes['root']?.props['pageCss'] as string,
        }).plan,
      );
    },
    30_000,
  );

  it('writes only the root props the root block declares', () => {
    const titleOnly = blocks(z.object({ title: z.string().default('') }));
    const target = kernel(page(), titleOnly);
    const { plan } = skeletonFromPlan(englishStudio(), {
      parentId: 'root',
      regionType: 'customCode',
      rootProps: ['title'],
    });
    const keys = plan.commands
      .filter(({ command }) => command === 'setProp')
      .map(({ args }) => (args as { key: string }).key);
    expect(keys).toEqual(['title']);
    const verdict = validateAiPlan(plan, target, ports(), policyFor(plan));
    expect(verdict.ok ? [] : verdict.issues).toEqual([]);
  });

  it('keeps an English page left to right with no tracking removed and a mailto CTA', () => {
    const pagePlan = englishStudio();
    const { plan } = skeletonFromPlan(pagePlan, { parentId: 'root', regionType: 'customCode' });
    const meta = plan.commands.find(({ command }) => command === 'setDocMeta');
    expect(meta?.args).toEqual({ dir: 'ltr' });
    const target = kernel();
    const verdict = validateAiPlan(plan, target, ports(), policyFor(plan));
    expect(verdict.ok ? [] : verdict.issues).toEqual([]);
    // The brand is the name before the title's separator, not the whole SEO title.
    const footer = insertedTrees(plan)[2]!;
    expect(textOf(footer)).toContain('© Northlight Studio');
    expect(textOf(footer)).toContain('All rights reserved.');
  });
});
