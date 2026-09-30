import { describe, expect, it } from 'vitest';

import {
  customCodeClassNames,
  customCodeTreeSchema,
  isCustomHookClass,
  utilityVocabulary,
} from '@craftkit/builder-schema';

import type { AiPlan } from '../../types';
import { checkSection } from './check-section';
import { skeletonFromPlan } from './skeleton-from-plan';
import { validatePagePlan, type PagePlan } from './index';

/*
  The header's phone menu (design-code, 2026-09-28). Before, a phone's header
  was two rows — brand and action, then a sideways-scrolling line of links
  nobody could tell was there. Now a menu button opens the links as a popover
  sheet: HTML's own toggle, no script, closed by a tap outside, Escape, or
  its own close button. Desktop keeps the inline nav.
*/

interface TreeNode {
  readonly kind: string;
  readonly tag?: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly TreeNode[];
}

function planFor(lang: string, nav = true): PagePlan {
  const result = validatePagePlan({
    intent: 'new-page',
    locale: { lang },
    title: 'Hail Roastery',
    description: 'Specialty coffee roasted in Amman every morning.',
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
      signature: 'the brand name huge and faint behind the menu',
      deckRowId: 'cafe',
    },
    primaryCta: { label: 'Order now', href: '#order' },
    nav: nav
      ? [
          { label: 'Menu', anchorId: 'menu' },
          { label: 'Order', anchorId: 'order' },
        ]
      : [],
    sections: [
      { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Nav.' },
      { key: 'hero', role: 'hero', title: 'Roasted today', anchorId: 'hero', purpose: 'Say it.' },
      { key: 'menu', role: 'band', title: 'Menu', anchorId: 'menu', purpose: 'Drinks.' },
      { key: 'order', role: 'cta', title: 'Order', anchorId: 'order', purpose: 'Order.' },
    ],
    facts: [],
  });
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join('\n'));
  return result.plan;
}

function headerOf(plan: PagePlan): TreeNode {
  const skeleton: AiPlan = skeletonFromPlan(plan, {
    parentId: 'root',
    regionType: 'customCode',
  }).plan;
  const insert = skeleton.commands.find(({ command }) => command === 'insertNode');
  return (insert?.args as { props: { tree: TreeNode } }).props.tree;
}

function walk(node: TreeNode, visit: (each: TreeNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function tags(node: TreeNode, tag: string): TreeNode[] {
  const found: TreeNode[] = [];
  walk(node, (each) => {
    if (each.tag === tag) found.push(each);
  });
  return found;
}

const classes = (node: TreeNode | undefined): string[] => node?.className?.split(' ') ?? [];

describe('skeletonFromPlan — the header on a phone', () => {
  it('opens the links from a menu button as a popover sheet, and keeps the inline nav from lg', () => {
    const tree = headerOf(planFor('en'));
    const bar = tree.children?.[0]?.children?.[0];
    const [, inline, action, toggle, sheet] = bar?.children ?? [];

    expect(inline?.tag).toBe('nav');
    expect(classes(inline)).toEqual(expect.arrayContaining(['hidden', 'lg:flex']));
    expect(classes(action)).toContain('ck-btn');

    expect(toggle?.tag).toBe('button');
    expect(classes(toggle)).toContain('lg:hidden');
    expect(toggle?.attributes).toEqual({
      popovertarget: 'ck-nav-top',
      'aria-label': 'Open the section menu',
    });
    expect(tags(toggle!, 'path')[0]?.attributes?.['d']).toBe('M4 6h16M4 12h16M4 18h16');

    expect(sheet?.tag).toBe('nav');
    expect(sheet?.attributes).toEqual({ id: 'ck-nav-top', popover: '', 'aria-label': 'Page sections' });
    const close = tags(sheet!, 'button')[0];
    expect(close?.attributes).toEqual({
      popovertarget: 'ck-nav-top',
      popovertargetaction: 'hide',
      'aria-label': 'Close the section menu',
    });
    expect(tags(sheet!, 'a').map((link) => [link.attributes?.['href'], link.text])).toEqual([
      ['#menu', 'Menu'],
      ['#order', 'Order'],
      // The bar's action, which a phone's bar hides.
      ['#order', 'Order now'],
    ]);
  });

  /*
    A display utility on a popover beats the browser's `display:none` for a
    closed one: `flex` on the sheet would keep the menu open on every page.
  */
  it('puts no display utility on the sheet itself, only lg:hidden', () => {
    const sheet = tags(headerOf(planFor('en')), 'nav')[1];
    const display = /^(?:block|flex|grid|inline|inline-block|inline-flex|contents|hidden)$/u;
    expect(classes(sheet).filter((name) => display.test(name))).toEqual([]);
    expect(classes(sheet)).toContain('lg:hidden');
    expect(classes(sheet)).toEqual(expect.arrayContaining(['ck-surface', 'me-0', 'ms-auto', 'h-full']));
  });

  it('passes the door, the utility vocabulary and its own section contract', () => {
    const plan = planFor('ar');
    const tree = { kind: 'root', children: [...(headerOf(plan).children ?? [])] };
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
    const vocabulary = utilityVocabulary();
    const unknown = customCodeClassNames(tree)
      .flatMap((value) => value.split(' '))
      .filter((name) => name !== '' && !isCustomHookClass(name) && !vocabulary.has(name));
    expect(unknown).toEqual([]);
    const contract = plan.sections[0];
    if (contract === undefined) throw new Error('missing header');
    expect(checkSection(plan, contract, { tree: tree as never })).toEqual([]);
  });

  it('labels the buttons in the page language, and with the nav label in any other', () => {
    const arabic = tags(headerOf(planFor('ar')), 'button');
    expect(arabic.map((button) => button.attributes?.['aria-label'])).toEqual([
      'افتح قائمة الأقسام',
      'أغلق قائمة الأقسام',
    ]);
    const french = tags(headerOf(planFor('fr')), 'button');
    expect(french.map((button) => button.attributes?.['aria-label'])).toEqual([
      'Hail Roastery',
      'Hail Roastery',
    ]);
  });

  it('keeps a long brand whole at 390px: a phone bar with a menu hides its action, which moves into the sheet', () => {
    const plan = { ...planFor('ar'), title: 'مطعم شاورما الأصيل للتوصيل السريع' } as PagePlan;
    const tree = headerOf(plan);
    const bar = tree.children?.[0]?.children?.[0];
    const action = bar?.children?.find(
      (child) => child.tag === 'a' && classes(child).includes('ck-btn'),
    );
    expect(classes(action)).toContain('ck-bar-cta');
    const sheet = tags(tree, 'nav').find((nav) => nav.attributes?.['popover'] !== undefined);
    const inSheet = tags(sheet ?? { kind: 'element' }, 'a').filter((a) =>
      classes(a).includes('ck-btn'),
    );
    expect(inSheet.map((a) => a.attributes?.['href'])).toEqual(['#order']);
    const css = JSON.stringify(
      skeletonFromPlan(plan, { parentId: 'root', regionType: 'customCode' }).plan,
    );
    expect(css).toContain('@media (max-width:39.99rem){.ck-bar .ck-bar-cta{display:none}}');
  });

  it('keeps the bar action on a phone when there is no menu to carry it', () => {
    const tree = headerOf(planFor('en', false));
    const action = tags(tree, 'a').find((a) => classes(a).includes('ck-btn'));
    expect(classes(action)).not.toContain('ck-bar-cta');
  });

  it('draws no menu when the plan has no nav', () => {
    const tree = headerOf(planFor('en', false));
    expect(tags(tree, 'button')).toEqual([]);
    expect(tags(tree, 'nav')).toEqual([]);
  });
});
