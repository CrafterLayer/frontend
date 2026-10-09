import { describe, expect, it } from 'vitest';

import { normalizeArabic } from '../intent/normalize-arabic';
import { resolveElement } from '../style-tools/address';
import { partsKernel } from '../style-tools/part-tools.fixtures';
import { resolvePartAddress } from '../style-tools/part-address';
import { styleKernel } from '../style-tools/style-tools.fixtures';
import { liveContext } from '../tools/agent/agent-tools.fixtures';
import type { BuilderKernel } from '@craftkit/builder-core';
import { buildElementIndex, type ElementIndex } from './element-index';
import { parseHandleId } from './handles';
import { arabicKernel, twoPageSite } from './script.fixtures';
import type { ScriptElement } from './types';

function live(kernel: BuilderKernel) {
  return (id: string, key: string): unknown => kernel.getDocument().nodes[id]?.props[key];
}

function indexOf(kernel: BuilderKernel, pageId = 'page'): ElementIndex {
  return buildElementIndex(kernel, live(kernel), { pageId });
}

function one(index: ElementIndex, predicate: (element: ScriptElement) => boolean): ScriptElement {
  const hits = index.elements.filter(predicate);
  expect(hits).toHaveLength(1);
  const [hit] = hits;
  if (hit === undefined) throw new Error('no element');
  return hit;
}

describe('buildElementIndex — customCode trees (style-tools fixture)', () => {
  const kernel = styleKernel();
  const index = indexOf(kernel);

  it('lists every section, labelled, in page order', () => {
    const sections = index.elements.filter(({ kind }) => kind === 'section');
    expect(sections.map(({ node, text }) => [node, text])).toEqual([
      ['r-header', 'Header'],
      ['r-hero', 'Hero'],
      ['r-menu', 'Menu'],
      ['r-story', 'Story'],
      ['r-footer', 'Footer'],
    ]);
    expect(sections[1]?.id).toBe('s|page|r-hero');
    expect(index.handles.get('s|page|r-hero')).toMatchObject({ type: 'section', nodeId: 'r-hero', path: [0] });
  });

  it('reads kinds from tags and classes, with section labels and visible text', () => {
    const heading = one(index, (el) => el.kind === 'heading' && el.node === 'r-hero');
    expect(heading).toMatchObject({ id: 't|page|r-hero|[0,0]', text: 'Fresh coffee daily', tag: 'h1', section: 'Hero', sectionId: 'r-hero', page: 'page', path: '[0,0]' });
    const buttons = index.elements.filter(({ kind }) => kind === 'button');
    expect(buttons.map(({ text }) => text)).toEqual(['Order', 'See the menu']);
    expect(one(index, (el) => el.kind === 'image')).toMatchObject({ text: '', alt: 'Coffee', tag: 'img' });
    expect(index.elements.filter(({ kind }) => kind === 'icon')).toHaveLength(2);
    expect(index.elements.filter(({ kind }) => kind === 'link').map(({ text, href }) => [text, href])).toEqual([
      ['Brew', '#top'],
      ['Old menu', '#menu'],
      ['Gone', '#gone'],
      ['Menu', '#menu'],
    ]);
    // Layout (header, nav, section, ul) is not indexed.
    expect(index.elements.some(({ tag }) => tag === 'nav' || tag === 'ul' || tag === 'header')).toBe(false);
  });

  it('gives a text path to the single text-bearing element, and none to mixed content', () => {
    const button = one(index, (el) => el.kind === 'button' && el.text === 'See the menu');
    // Own text beside an icon: the button itself carries the words.
    expect(index.handles.get(button.id)?.textPath).toEqual([0, 3]);
    const item = one(index, (el) => el.kind === 'item');
    expect(item.text).toBe('Menu');
    expect(index.handles.get(item.id)?.textPath).toEqual([0, 0, 0, 0, 0]);
  });

  it('ids round-trip through parsePath to the element element.* resolves', () => {
    const context = liveContext(kernel);
    for (const element of index.elements.filter(({ id }) => id.startsWith('t|'))) {
      const handle = parseHandleId(element.id);
      expect(handle?.type).toBe('tree');
      expect(JSON.stringify(handle?.path)).toBe(element.path?.replace(/\s/gu, ''));
      const resolved = resolveElement(context, { id: element.node, path: handle?.path ?? [] });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) continue;
      const node = resolved.value.node;
      expect(node.kind === 'element' ? node.tag : node.kind).toBe(element.tag);
    }
  });
});

describe('buildElementIndex — registered-block parts (part-tools fixture)', () => {
  const kernel = partsKernel();
  const index = indexOf(kernel);

  it('maps part kinds to script kinds and nests CTA children under their section', () => {
    expect(index.elements.filter(({ kind }) => kind === 'section').map(({ node }) => node)).toEqual([
      'hero-1',
      'features-1',
      'text-1',
      'r-story',
    ]);
    expect(one(index, (el) => el.node === 'hero-1' && el.part === 'heading')).toMatchObject({ kind: 'heading', text: 'welcom', id: 'p|page|hero-1|heading|' });
    expect(one(index, (el) => el.node === 'hero-1' && el.part === 'eyebrow').kind).toBe('text');
    const cta = one(index, (el) => el.node === 'cta-1');
    expect(cta).toMatchObject({ kind: 'button', text: 'Get started', href: '/start', sectionId: 'hero-1', part: 'button' });
    const titles = index.elements.filter((el) => el.part === 'item.title');
    expect(titles.map(({ kind, text, index: at }) => [kind, text, at])).toEqual([
      ['heading', 'Fast', 0],
      ['heading', 'Safe', 1],
      ['heading', 'Fast', 2],
    ]);
    const cards = index.elements.filter((el) => el.part === 'item');
    expect(cards.map(({ kind }) => kind)).toEqual(['card', 'card', 'card']);
    expect(cards[0]?.text).toBe('Fast · Ships in a day.');
    expect(index.handles.get(cards[0]?.id ?? '')?.textPart).toBeUndefined();
    expect(one(index, (el) => el.part === 'image')).toMatchObject({ kind: 'image', src: 'https://example.com/a.jpg', alt: 'A builder at work', text: '' });
    expect(one(index, (el) => el.part === 'link')).toMatchObject({ kind: 'link', href: '/features' });
    expect(one(index, (el) => el.part === 'content').text).toBe('Every edit becomes one undo.');
  });

  it('ids round-trip through resolvePartAddress', () => {
    for (const element of index.elements.filter(({ id }) => id.startsWith('p|'))) {
      const handle = parseHandleId(element.id);
      expect(handle?.type).toBe('part');
      const resolved = resolvePartAddress(kernel, {
        id: handle?.nodeId ?? '',
        part: handle?.part ?? '',
        ...(handle?.index !== undefined && handle.index.length > 0 ? { index: handle.index } : {}),
      });
      expect(resolved.ok, element.id).toBe(true);
    }
  });
});

describe('buildElementIndex — an Arabic page', () => {
  const kernel = arabicKernel();
  const index = indexOf(kernel);

  it('folds Arabic for find({text}) and keeps the visible text as written', () => {
    const h1 = one(index, (el) => el.tag === 'h1');
    expect(h1.text).toBe('قهوة تُحمّص كل صباح');
    expect(h1.norm).toBe(normalizeArabic('قهوة تُحمّص كل صباح').toLowerCase());
    expect(h1.norm).toContain('قهوه تحمص');
    expect(h1.section).toBe('الرئيسية');
  });

  it('finds headings, buttons, cards, images, inputs and items', () => {
    const count = (kind: string) => index.elements.filter((el) => el.kind === kind).length;
    // Tree buttons: header, 2 in the hero, 2 in cards, the submit; part buttons: two CTAs.
    expect(count('button')).toBe(8);
    expect(count('card')).toBe(3 + 2);
    expect(count('input')).toBe(1);
    expect(one(index, (el) => el.kind === 'input').text).toBe('بريدك');
    expect(index.elements.filter((el) => el.kind === 'image' && el.node === 'r-gallery').map(({ alt }) => alt)).toEqual(['فنجان', 'حبوب']);
    expect(index.elements.filter((el) => el.kind === 'item' && el.node === 'r-gallery')).toHaveLength(3);
  });

  it('marks mixed content (no text path) and points a wrapper at its one text child', () => {
    const card = index.elements.find((el) => el.kind === 'card' && el.node === 'r-services');
    expect(index.handles.get(card?.id ?? '')?.textPath).toBeUndefined();
    const call = one(index, (el) => el.kind === 'text' && el.text.startsWith('اتصل بنا'));
    expect(call.text).toBe('اتصل بنا: 0790000000');
    expect(index.handles.get(call.id)?.textPath).toBeUndefined();
    const strong = one(index, (el) => el.tag === 'strong');
    expect(index.handles.get(strong.id)?.textPath).toEqual(JSON.parse(strong.path ?? '[]'));
    const more = one(index, (el) => el.kind === 'button' && el.text === 'اعرف أكثر');
    expect(index.handles.get(more.id)?.textPath).toEqual([0, 4, 0]);
    const photo = index.elements.find((el) => el.kind === 'item' && el.node === 'r-gallery');
    expect(index.handles.get(photo?.id ?? '')?.textPath).toBeUndefined();
  });

  it('caps a page, dropping the deepest elements first and keeping sections', () => {
    const capped = buildElementIndex(kernel, live(kernel), { pageId: 'page', maxPerPage: 12 });
    expect(capped.elements).toHaveLength(12);
    expect(capped.elements.filter(({ kind }) => kind === 'section')).toHaveLength(8);
    expect(capped.handles.size).toBe(12);
  });

  it('cuts text at 500 characters', () => {
    const long = 'كلمة '.repeat(200);
    const document = kernel.getDocument();
    const reader = (id: string, key: string): unknown =>
      id === 'hero-1' && key === 'body' ? long : document.nodes[id]?.props[key];
    const body = buildElementIndex(kernel, reader, { pageId: 'page' }).elements.find((el) => el.part === 'body');
    expect(body?.text.length).toBe(500);
    expect(body?.text.endsWith('…')).toBe(true);
  });
});

describe('buildElementIndex — a site', () => {
  it('indexes every page through its lens, the open page marked current', () => {
    const { site, scriptSite } = twoPageSite();
    const home = site.page(site.currentPage());
    const index = buildElementIndex(home, live(home), { pageId: site.currentPage(), site: scriptSite });
    expect(index.pages.map(({ id, current }) => [id, current])).toEqual([
      [site.currentPage(), true],
      ['about', false],
    ]);
    const about = index.elements.filter(({ page }) => page === 'about');
    expect(about.map(({ kind }) => kind)).toEqual(['section', 'heading', 'text', 'button']);
    expect(about[1]?.id).toBe('t|about|r-s|[0,0]');
  });
});
