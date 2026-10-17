import { describe, expect, it } from 'vitest';

import { isAllowedIframeSrc, type CustomCodeElement, type CustomCodeNode } from '../custom-code/custom-code-tree';
import { mediaRecipeProblems } from './checks';
import { isMediaRecipeError, mediaRecipeNode, type MediaLocale, type MediaRecipeResult } from './types';
import { mapsEmbedUrl } from './urls';
import { buildCompare, buildLottie, buildMailtoForm, buildMapFacade, buildPricingToggle } from './widgets';

const LOCALES: readonly MediaLocale[] = ['ar', 'en'];
const BEFORE = { src: 'https://images.example.com/before.jpg', alt: '', width: 1600, height: 900 };
const AFTER = { src: 'https://images.example.com/after.jpg', alt: 'بعد الترميم', width: 1600, height: 900 };
const PLANS = [
  { name: 'أساسي', a: '١٠ د.أ', b: '١٠٠ د.أ', features: ['صفحة واحدة', 'دعم بالبريد'] },
  { name: 'Pro', a: '$29', b: '$290' },
  { name: 'Team', a: '$59', b: '$590' },
  { name: 'Scale', a: '$99', b: '$990' },
];

function recipe(result: MediaRecipeResult) {
  if (isMediaRecipeError(result)) throw new Error(result.error);
  return result;
}

function all(node: CustomCodeNode, test: (element: CustomCodeElement) => boolean): CustomCodeElement[] {
  const found: CustomCodeElement[] = node.kind === 'element' && test(node) ? [node] : [];
  for (const child of node.kind === 'icon' ? [] : (node.children ?? [])) found.push(...all(child, test));
  return found;
}

describe('widget recipes', () => {
  it('every widget, standalone or not, passes the door in Arabic and English', () => {
    for (const locale of LOCALES) {
      for (const standalone of [true, false]) {
        const options = { locale, standalone, title: locale === 'ar' ? 'عنوان' : 'Title' };
        const outputs = [
          buildCompare({ ...options, before: BEFORE, after: AFTER }),
          ...[1, 2, 3, 4].map((count) => buildPricingToggle({ ...options, plans: PLANS.slice(0, count) })),
          buildMapFacade('جبل القلعة، عمّان', options),
          buildMailtoForm('hello@example.com', { ...options, idPrefix: 'contact' }),
          buildLottie('https://assets.example.com/hero.json', BEFORE, options),
          buildLottie('https://assets.example.com/hero.json', undefined, options),
        ];
        for (const output of outputs) {
          const built = recipe(output);
          expect(mediaRecipeProblems(built), JSON.stringify(built.tree)).toEqual([]);
        }
      }
    }
  });

  it('compare: two images, before then after, with locale alt text when none is given', () => {
    const node = mediaRecipeNode(recipe(buildCompare({ locale: 'ar', standalone: false, before: BEFORE, after: AFTER })));
    expect(node.attributes).toEqual({ 'data-ck-behavior': 'compare' });
    expect(node.children?.map((child) => (child as CustomCodeElement).attributes?.alt)).toEqual(['قبل', 'بعد الترميم']);
    expect(buildCompare({ locale: 'en', before: { src: '', alt: '' }, after: AFTER })).toEqual({
      error: 'a before/after compare needs two images',
    });
  });

  it('pricing: side b is hidden in the markup, so only monthly reads without script', () => {
    const node = mediaRecipeNode(recipe(buildPricingToggle({ locale: 'ar', standalone: false, plans: PLANS.slice(0, 2) })));
    expect(node.attributes).toEqual({ 'data-ck-behavior': 'toggle-group' });
    const a = all(node, (element) => element.attributes?.['data-ck-option'] === 'a');
    const b = all(node, (element) => element.attributes?.['data-ck-option'] === 'b');
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    expect(a.every((element) => element.attributes?.hidden === undefined)).toBe(true);
    expect(b.every((element) => element.attributes?.hidden === '')).toBe(true);
    expect(all(node, (element) => element.tag === 'button')[0]?.text).toBe('شهري / سنوي');
    expect(all(node, (element) => element.tag === 'button')[0]?.attributes).toEqual({ type: 'button' });
    expect(buildPricingToggle({ locale: 'en', plans: [] })).toEqual({ error: expect.any(String) as unknown });
    expect(buildPricingToggle({ locale: 'en', plans: [...PLANS, { name: 'Extra', a: '1', b: '10' }] })).toEqual({
      error: expect.stringMatching(/at most 4/u) as unknown,
    });
  });

  it('map: a link to Google Maps whose embed the iframe allowlist admits', () => {
    const node = mediaRecipeNode(recipe(buildMapFacade('Amman Citadel', { locale: 'en', standalone: false })));
    expect(node.attributes).toEqual({
      'data-ck-behavior': 'embed-facade',
      href: 'https://www.google.com/maps?q=Amman%20Citadel',
      'aria-label': 'Map: Amman Citadel',
    });
    expect(isAllowedIframeSrc(mapsEmbedUrl('Amman Citadel') ?? '')).toBe(true);
    expect(buildMapFacade('  ', { locale: 'en' })).toEqual({ error: expect.any(String) as unknown });
  });

  it('mailto: labelled fields tied to their ids, a submit, and the address on the form', () => {
    const form = mediaRecipeNode(recipe(buildMailtoForm('hello@example.com', { locale: 'ar', standalone: false })));
    expect(form.attributes).toEqual({ 'data-ck-behavior': 'mailto-form', 'data-ck-email': 'hello@example.com' });
    const labels = all(form, (element) => element.tag === 'label').map((label) => label.attributes?.for);
    const ids = all(form, (element) => element.tag === 'input' || element.tag === 'textarea').map(
      (control) => control.attributes?.id,
    );
    expect(labels).toEqual(['ck-mail-name', 'ck-mail-email', 'ck-mail-message']);
    expect(ids).toEqual(labels);
    expect(all(form, (element) => element.tag === 'button')[0]).toMatchObject({ text: 'أرسل', attributes: { type: 'submit' } });
    expect(buildMailtoForm('not-an-email', { locale: 'en' })).toEqual({ error: expect.stringMatching(/email/u) as unknown });
  });

  it('lottie: the marker, a bounded https .json, and a poster; decorative without alt', () => {
    const node = mediaRecipeNode(recipe(buildLottie('https://assets.example.com/hero.json', BEFORE, { locale: 'en', standalone: false })));
    expect(node.attributes).toEqual({
      'data-ck-lottie': '',
      'data-ck-src': 'https://assets.example.com/hero.json',
      'aria-hidden': 'true',
    });
    const meaningful = mediaRecipeNode(recipe(buildLottie('https://assets.example.com/hero.json', AFTER, { locale: 'ar', standalone: false })));
    expect(meaningful.attributes?.['aria-hidden']).toBeUndefined();
    expect(buildLottie('https://assets.example.com/hero.gif', undefined, { locale: 'en' })).toEqual({
      error: expect.stringMatching(/\.json/u) as unknown,
    });
  });
});
