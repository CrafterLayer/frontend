import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setUtilityClassOracle } from '@craftkit/builder-schema';

import { partTarget } from '../../overlay/part-target';
import { promoKernel, promoProps } from '../../overlay/part-test-kit';
import {
  createPartBarModel,
  PART_NO_ATTRIBUTES,
  PART_NO_CSS_MOTION,
  PART_NO_ICON,
  partQuickKind,
  planPartLinkValue,
  dispatchPartPlan,
} from './part-bar-model';
import { quickGroupsForPart } from './quick-bar-groups';

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

const OPTIONS = { bucket: 'base', state: 'default', pageDir: 'ltr' } as const;
const padding = { property: 'padding', value: { kind: 'token', token: '4' }, side: 'inline-start' } as const;

describe('createPartBarModel (block-parts DESIGN §2.14)', () => {
  it('maps the part kind to its bar and names the part beside its block', () => {
    const kernel = promoKernel();
    expect(partQuickKind('text')).toBe('text');
    expect(partQuickKind('rich')).toBe('text');
    expect(partQuickKind('link')).toBe('link');
    expect(partQuickKind('image')).toBe('media');
    expect(partQuickKind('item')).toBe('container');
    const heading = createPartBarModel(kernel, partTarget('promo', { part: 'heading', index: [] }), OPTIONS);
    expect(heading?.kind).toBe('text');
    expect(heading?.name).toBe('Heading · Promo');
    expect(heading?.node).toEqual({ kind: 'element', tag: 'p' });
    const arabic = createPartBarModel(kernel, partTarget('promo', { part: 'item.title', index: [1] }), {
      ...OPTIONS,
      locale: 'ar',
    });
    expect(arabic?.name).toMatch(/^عنوان الميزة 2 · /u);
  });

  it('is undefined for a part, an instance or a node that is not there', () => {
    const kernel = promoKernel();
    expect(createPartBarModel(kernel, partTarget('promo', { part: 'missing', index: [] }), OPTIONS)).toBeUndefined();
    expect(createPartBarModel(kernel, partTarget('promo', { part: 'item', index: [7] }), OPTIONS)).toBeUndefined();
    expect(createPartBarModel(kernel, partTarget('ghost', { part: 'heading', index: [] }), OPTIONS)).toBeUndefined();
  });

  it('a style control writes partStyles in tokens mode as ONE labelled transaction, one Undo', () => {
    const kernel = promoKernel();
    const model = createPartBarModel(kernel, partTarget('promo', { part: 'heading', index: [] }), OPTIONS);
    const before = kernel.transactions().length;
    expect(model?.apply([padding], 'Padding')).toEqual({ ok: true });
    expect(kernel.transactions().length).toBe(before + 1);
    expect(promoProps(kernel).partStyles).toEqual({ heading: { className: 'ps-4' } });
    // The model reads back what it wrote.
    const after = createPartBarModel(kernel, partTarget('promo', { part: 'heading', index: [] }), OPTIONS);
    expect(after?.read('padding').origin).not.toBe('unset');
    expect(kernel.undo()).toBe(true);
    expect(promoProps(kernel).partStyles).toEqual({});
  });

  it('scope `this` styles one card; `all` styles every card', () => {
    const kernel = promoKernel();
    const target = partTarget('promo', { part: 'item.title', index: [2] });
    createPartBarModel(kernel, target, { ...OPTIONS, scope: 'this' })?.apply([padding], 'Padding');
    expect(promoProps(kernel).partStyles).toEqual({ 'item.title@2': { className: 'ps-4' } });
    createPartBarModel(kernel, target, { ...OPTIONS, scope: 'all' })?.apply([padding], 'Padding');
    expect(promoProps(kernel).partStyles).toEqual({
      'item.title@2': { className: 'ps-4' },
      'item.title': { className: 'ps-4' },
    });
  });

  it('a palette colour is refused by the tokens law and nothing is written', () => {
    const kernel = promoKernel();
    const model = createPartBarModel(kernel, partTarget('promo', { part: 'heading', index: [] }), OPTIONS);
    const before = kernel.transactions().length;
    const result = model?.apply([{ property: 'backgroundColor', value: { kind: 'raw', css: '#ff0000' } }], 'Background');
    expect(result?.ok).toBe(false);
    expect(kernel.transactions().length).toBe(before);
  });

  it('alt and href are bound values written through the part planner; free attributes and icons are refused', () => {
    const kernel = promoKernel();
    const image = createPartBarModel(kernel, partTarget('promo', { part: 'image', index: [] }), OPTIONS);
    expect(image?.attribute('alt')).toBe('Team');
    expect(image?.setAttributes({ alt: 'Our team' }, 'Alternative text')).toEqual({ ok: true });
    expect(promoProps(kernel).imageAlt).toBe('Our team');
    expect(image?.setAttributes({ title: 'x' }, 'Title')).toEqual({ ok: false, message: PART_NO_ATTRIBUTES });
    expect(image?.setIcon({ name: 'star' }, 'Icon')).toEqual({ ok: false, message: PART_NO_ICON });
    const link = createPartBarModel(kernel, partTarget('promo', { part: 'cta', index: [] }), OPTIONS);
    expect(link?.attribute('href')).toBe('/start');
    // The attribute link editor's cleared new-tab pair is nothing to write.
    expect(link?.setAttributes({ href: '/go', target: null, rel: null }, 'Link')).toEqual({ ok: true });
    expect(promoProps(kernel).cta).toEqual({ label: 'Get started', href: '/go' });
  });

  it('a link part edits its text and address as ONE transaction', () => {
    const kernel = promoKernel();
    const target = partTarget('promo', { part: 'cta', index: [] });
    const before = kernel.transactions().length;
    expect(dispatchPartPlan(kernel, planPartLinkValue(kernel, target, { text: 'ابدأ الآن', href: '/ar/start' }))).toEqual({
      ok: true,
    });
    expect(kernel.transactions().length).toBe(before + 1);
    expect(promoProps(kernel).cta).toEqual({ label: 'ابدأ الآن', href: '/ar/start' });
    // Nothing changed: no transaction at all.
    dispatchPartPlan(kernel, planPartLinkValue(kernel, target, { text: 'ابدأ الآن', href: '/ar/start' }));
    expect(kernel.transactions().length).toBe(before + 1);
    kernel.undo();
    expect(promoProps(kernel).cta).toEqual({ label: 'Get started', href: '/start' });
  });

  it('part bars drop the attribute-only groups and narrow to declared sectors', () => {
    const ids = (groups: readonly { id: string }[]) => groups.map((group) => group.id);
    expect(ids(quickGroupsForPart('text'))).not.toContain('direction');
    // gsap-pixi (2026-10-08): motion is back on parts — Cinematic motion only.
    expect(ids(quickGroupsForPart('text'))).toContain('motion');
    expect(ids(quickGroupsForPart('container'))).toContain('motion');
    expect(ids(quickGroupsForPart('media'))).toContain('motion');
    expect(ids(quickGroupsForPart('link'))).toContain('motion');
    expect(ids(quickGroupsForPart('link'))).not.toContain('hoverPreset');
    expect(ids(quickGroupsForPart('link'))).not.toContain('link');
    expect(ids(quickGroupsForPart('media'))).toEqual(expect.arrayContaining(['replace', 'alt']));
    expect(ids(quickGroupsForPart('media', ['borders']))).toEqual(['replace', 'radius', 'alt']);
  });
});

// gsap-pixi additions (2026-10-08)
describe('a part’s Cinematic motion (partStyles timeline/scrub)', () => {
  it('reads and writes the recipe as ONE labelled setProp, keeps the classes, and undoes in one step', () => {
    const kernel = promoKernel();
    const target = partTarget('promo', { part: 'heading', index: [] });
    createPartBarModel(kernel, target, OPTIONS)?.apply([padding], 'Padding');
    const model = createPartBarModel(kernel, target, OPTIONS);
    expect(model?.motionScope).toBe('part');
    expect(model?.attribute('data-ck-timeline')).toBeUndefined();
    const before = kernel.transactions().length;
    expect(model?.setAttributes({ 'data-ck-timeline': 'fade-in', 'data-ck-scrub': 'false' }, 'حركة سينمائية')).toEqual({
      ok: true,
    });
    expect(kernel.transactions().length).toBe(before + 1);
    // History labels stay English, whatever the bar's language.
    expect(kernel.transactions().at(-1)?.command).toBe('Cinematic motion · Promo heading');
    expect(promoProps(kernel).partStyles).toEqual({ heading: { className: 'ps-4', timeline: 'fade-in', scrub: false } });
    const after = createPartBarModel(kernel, target, OPTIONS);
    expect(after?.attribute('data-ck-timeline')).toBe('fade-in');
    expect(after?.attribute('data-ck-scrub')).toBe('false');
    // The same value again is no transaction.
    expect(after?.setAttributes({ 'data-ck-timeline': 'fade-in', 'data-ck-scrub': 'false' }, 'Cinematic motion')).toEqual({
      ok: true,
    });
    expect(kernel.transactions().length).toBe(before + 1);
    // A class edit keeps the recipe.
    after?.editClasses((className) => `${className} pe-4`, 'Padding');
    expect(promoProps(kernel).partStyles).toEqual({
      heading: { className: 'ps-4 pe-4', timeline: 'fade-in', scrub: false },
    });
    kernel.undo();
    kernel.undo();
    expect(promoProps(kernel).partStyles).toEqual({ heading: { className: 'ps-4' } });
  });

  it('clearing the recipe takes its scrub with it and drops an emptied entry', () => {
    const kernel = promoKernel();
    const target = partTarget('promo', { part: 'heading', index: [] });
    createPartBarModel(kernel, target, OPTIONS)?.setAttributes(
      { 'data-ck-timeline': 'split-reveal', 'data-ck-scrub': 'true' },
      'Cinematic motion',
    );
    expect(promoProps(kernel).partStyles).toEqual({ heading: { timeline: 'split-reveal', scrub: true } });
    createPartBarModel(kernel, target, OPTIONS)?.setAttributes({ 'data-ck-timeline': null, 'data-ck-scrub': null }, 'Cinematic motion');
    expect(promoProps(kernel).partStyles).toEqual({});
  });

  it('scope `this` writes one item; the bar reads what plays there (`this` wins over `all`)', () => {
    const kernel = promoKernel();
    const target = partTarget('promo', { part: 'item.title', index: [1] });
    createPartBarModel(kernel, target, { ...OPTIONS, scope: 'all' })?.setAttributes(
      { 'data-ck-timeline': 'fade-in' },
      'Cinematic motion',
    );
    const one = createPartBarModel(kernel, target, { ...OPTIONS, scope: 'this' });
    expect(one?.attribute('data-ck-timeline')).toBe('fade-in');
    one?.setAttributes({ 'data-ck-timeline': 'slide-in' }, 'Cinematic motion');
    expect(promoProps(kernel).partStyles).toEqual({
      'item.title': { timeline: 'fade-in' },
      'item.title@1': { timeline: 'slide-in' },
    });
    expect(createPartBarModel(kernel, target, { ...OPTIONS, scope: 'this' })?.attribute('data-ck-timeline')).toBe('slide-in');
  });

  it('refuses CSS presets, hover effects, unknown recipes and mixed patches — nothing written', () => {
    const kernel = promoKernel();
    const model = createPartBarModel(kernel, partTarget('promo', { part: 'heading', index: [] }), OPTIONS);
    const before = kernel.transactions().length;
    expect(model?.setAttributes({ 'data-ck-motion': 'fade-up' }, 'Animation')).toEqual({
      ok: false,
      message: PART_NO_CSS_MOTION,
    });
    expect(model?.setAttributes({ 'data-ck-hover': 'lift' }, 'Hover effect')).toEqual({
      ok: false,
      message: PART_NO_CSS_MOTION,
    });
    expect(model?.setAttributes({ 'data-ck-timeline': 'warp-speed' }, 'Cinematic motion').ok).toBe(false);
    expect(model?.setAttributes({ 'data-ck-timeline': 'fade-in', title: 'x' }, 'Cinematic motion')).toEqual({
      ok: false,
      message: PART_NO_ATTRIBUTES,
    });
    // The other attributes keep their refusal.
    expect(model?.setAttributes({ 'data-ck-scene': 'particles' }, 'Animated background')).toEqual({
      ok: false,
      message: PART_NO_ATTRIBUTES,
    });
    expect(kernel.transactions().length).toBe(before);
    expect(promoProps(kernel).partStyles).toEqual({});
  });
});
// ── end gsap-pixi additions ──
