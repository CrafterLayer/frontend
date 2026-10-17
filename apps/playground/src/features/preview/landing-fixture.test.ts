import { describe, expect, it } from 'vitest';

import type { BuilderDocument, Node } from '@craftkit/builder';

import {
  codeViewEditing,
  createPlaygroundKernel,
  inlineEditing,
  marketingLanding,
} from './create-playground-kernel';
import { LANDING_COPY, landingCopy } from './landing-copy';

/**
 * blocks-polish (2026-10-08): the playground's landing reads as a finished
 * page in English OR in Arabic, never a mix, and every plan can be bought.
 */

const ARABIC = /[؀-ۿ]/gu;
const LATIN_WORD = /[A-Za-z][A-Za-z.@'-]*/gu;
/* Brand and technical names an Arabic page may keep in Latin letters. */
const LATIN_ALLOWED = new Set(['CraftKit', 'name@company.com', 'RTL', 'LTR']);

function arabicLetters(document: BuilderDocument): number {
  return (JSON.stringify(document.nodes).match(ARABIC) ?? []).length;
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

function nodesOfType(document: BuilderDocument, type: string): Node[] {
  return Object.values(document.nodes).filter((node) => node.type === type);
}

/* The id list other tests address; a change here is a change they must hear about. */
const LANDING_IDS = [
  'about',
  'announcement',
  'aurora',
  'bento',
  'carousel',
  'cta-docs',
  'cta-start',
  'faq',
  'features',
  'form',
  'hero',
  'logos',
  'marquee',
  'newsletter',
  'plan-solo',
  'plan-solo-body',
  'plan-solo-cta',
  'plan-team',
  'plan-team-body',
  'plan-team-cta',
  'pricing',
  'promo',
  'quotes',
  'rich-story',
  'root',
  'showcase',
  'spotlight-promo',
  'stats',
];

describe('landing fixture languages', () => {
  it.each([
    ['landing', marketingLanding('ltr')],
    ['inline', inlineEditing('ltr')],
    ['code-view', codeViewEditing('ltr')],
  ] as const)('the English %s document holds 0 Arabic letters', (_name, document) => {
    expect(arabicLetters(document)).toBe(0);
  });

  it('the Arabic landing is written in Arabic', () => {
    expect(arabicLetters(marketingLanding('rtl'))).toBeGreaterThanOrEqual(300);
    expect(arabicLetters(inlineEditing('rtl'))).toBeGreaterThan(0);
    expect(arabicLetters(codeViewEditing('rtl'))).toBeGreaterThan(0);
  });

  it('the Arabic copy keeps Latin letters for brand and technical names only', () => {
    const latin = strings(LANDING_COPY.ar).flatMap((text) => text.match(LATIN_WORD) ?? []);
    expect(latin.filter((word) => !LATIN_ALLOWED.has(word))).toEqual([]);
  });

  it('the English copy holds no Arabic at all', () => {
    expect(strings(LANDING_COPY.en).join(' ').match(ARABIC)).toBeNull();
  });

  it('picks the copy by direction', () => {
    expect(landingCopy('rtl')).toBe(LANDING_COPY.ar);
    expect(landingCopy('ltr')).toBe(LANDING_COPY.en);
    const arabic = marketingLanding('rtl');
    expect(arabic.dir).toBe('rtl');
    expect(arabic.nodes['hero']?.props['heading']).toBe(LANDING_COPY.ar.hero.heading);
    expect(arabic.nodes['cta-docs']?.props['label']).toBe(LANDING_COPY.ar.ctaDocs);
    expect(marketingLanding('ltr').nodes['cta-docs']?.props['label']).toBe('Read the docs');
  });
});

describe('landing fixture structure', () => {
  it('keeps every node id, in both languages', () => {
    expect(Object.keys(marketingLanding('ltr').nodes).sort()).toEqual(LANDING_IDS);
    expect(Object.keys(marketingLanding('rtl').nodes).sort()).toEqual(LANDING_IDS);
    expect(Object.keys(inlineEditing('rtl').nodes).sort()).toEqual(['note', 'root', 'tale']);
    expect(Object.keys(codeViewEditing('rtl').nodes).sort()).toEqual([
      'cta-docs',
      'cta-start',
      'hero',
      'root',
    ]);
  });

  it.each(['ltr', 'rtl'] as const)('gives every pricing plan an action (%s)', (dir) => {
    const document = marketingLanding(dir);
    const plans = nodesOfType(document, 'pricingPlan');
    expect(plans.length).toBe(2);
    for (const plan of plans) {
      const children = (plan.slots?.['default'] ?? []).map((id) => document.nodes[id]);
      expect(children.some((child) => child?.type === 'cta'), plan.id).toBe(true);
    }
  });

  it('keeps the pricing section inside the page: the shared column, a gutter, no scaled card', () => {
    const document = marketingLanding('ltr');
    const pricing = document.nodes['pricing'];
    expect(pricing?.props['width']).toBe('wide');
    expect(pricing?.props['gutter']).toBeUndefined();
    const teamClasses = document.nodes['plan-team']?.props['className'];
    expect(typeof teamClasses === 'string' ? teamClasses : '').not.toMatch(/scale-/u);
    expect(pricing?.props['eyebrow']).toBe('Plans');
    expect(marketingLanding('rtl').nodes['plan-team']?.props['badge']).toBe('الأكثر طلبًا');
    expect(marketingLanding('rtl').nodes['plan-solo']?.props['periodLabel']).toBe('شهريًا');
  });

  it.each(['ltr', 'rtl'] as const)('opens through the real registry (%s)', (dir) => {
    const kernel = createPlaygroundKernel({ fixture: 'landing', dir });
    const document = kernel.getDocument();
    expect(Object.keys(document.nodes).sort()).toEqual(LANDING_IDS);
    expect(document.nodes['plan-solo-cta']?.type).toBe('cta');
  });
});
