import { describe, expect, it } from 'vitest';

import type { Node } from '../document/types';
import type { BlockParts } from './block-parts';
import { blockPartProps, mergePartClasses } from './part-attributes';

const label = (en: string, ar: string) => ({ en, ar });

const parts: BlockParts = {
  heading: { kind: 'text', bind: 'heading', label: label('Heading', 'العنوان') },
  'item.title': { kind: 'text', bind: 'items.*.title', label: label('Item title', 'عنوان العنصر') },
  item: { kind: 'item', bind: 'items.*', label: label('Item', 'العنصر') },
  link: { kind: 'link', bind: { text: 'link.label', href: 'link.href' }, label: label('Link', 'الرابط') },
  image: { kind: 'image', bind: { src: 'imageSrc', alt: 'imageAlt' }, label: label('Image', 'الصورة') },
  frame: { kind: 'box', label: label('Frame', 'الإطار') },
};

const node: Node = { id: 'n1', type: 'demo', props: {} };

describe('blockPartProps', () => {
  it('on the canvas, stamps the part, its index and its bind path', () => {
    const part = blockPartProps({ node, props: {}, isCanvas: true }, parts);
    expect(part('heading', { className: 'm-0', id: 'h1' })).toEqual({
      id: 'h1',
      className: 'm-0',
      dir: 'auto',
      'data-ck-part': 'heading',
      'data-ck-bind': 'heading',
      // block-parts (2026-10-06): the block's own classes, the Design tab's baseline
      'data-ck-part-own': 'm-0',
    });
    expect(part('item.title', { index: [2] })).toEqual({
      dir: 'auto',
      'data-ck-part': 'item.title',
      'data-ck-part-index': '2',
      'data-ck-bind': 'items.2.title',
    });
    expect(part('link')['data-ck-bind']).toBe('link.label');
    expect(part('image')['data-ck-bind']).toBe('imageSrc');
    expect(part('item', { index: [0] })['data-ck-bind']).toBe('items.0');
  });

  it('in the published render, emits no markers', () => {
    const part = blockPartProps({ node, props: {}, isCanvas: false }, parts);
    expect(part('heading', { className: 'm-0' })).toEqual({ className: 'm-0', dir: 'auto' });
    expect(part('item.title', { index: [1] })).toEqual({ dir: 'auto' });
  });

  it('gives dir=auto to text, rich and link parts only; boxes and images follow the page', () => {
    const part = blockPartProps({ node, props: {}, isCanvas: false }, parts);
    expect(part('link').dir).toBe('auto');
    expect(part('image').dir).toBeUndefined();
    expect(part('frame').dir).toBeUndefined();
    expect(part('item', { index: [0] }).dir).toBeUndefined();
  });

  it('merges the block classes, then the all entry, then the this entry; this-dir wins', () => {
    const props = {
      partStyles: {
        'item.title': { className: 'ps-4 text-accent', dir: 'rtl' },
        'item.title@1': { className: 'ps-8', dir: 'ltr' },
        frame: { dir: 'ltr' },
      },
    };
    const part = blockPartProps({ node, props, isCanvas: false }, parts);
    expect(part('item.title', { index: [0], className: 'ps-2 font-bold' })).toEqual({
      className: 'font-bold ps-4 text-accent',
      dir: 'rtl',
    });
    expect(part('item.title', { index: [1], className: 'ps-2' })).toEqual({
      className: 'text-accent ps-8',
      dir: 'ltr',
    });
    expect(part('frame').dir).toBe('ltr');
  });

  it('passes the block classes through untouched when nothing is stored', () => {
    const part = blockPartProps({ node, props: {}, isCanvas: false }, parts);
    expect(part('heading', { className: 'p-4 p-2' }).className).toBe('p-4 p-2');
  });

  it('throws for an undeclared part under test, naming the block and the part', () => {
    const part = blockPartProps({ node, props: {}, isCanvas: true }, parts);
    expect(() => part('subtitle')).toThrow(/Block "demo" renders part "subtitle"/);
    const none = blockPartProps({ node, props: {}, isCanvas: true }, undefined);
    expect(() => none('heading')).toThrow(/does not declare/);
  });
});

// ── block-parts (2026-10-06) ──
describe('mergePartClasses — a stored size beats the block\'s responsive size (fix pass)', () => {
  it('a base font size replaces the block\'s container and breakpoint sizes, and keeps its line height', () => {
    const own = 'm-0 max-w-2xl text-pretty text-lg leading-relaxed @md:text-xl';
    expect(mergePartClasses(own, 'text-2xl')).toBe('m-0 max-w-2xl text-pretty leading-relaxed text-2xl');
  });

  it('the hero heading: @md and @xl sizes both give way to a base size', () => {
    expect(mergePartClasses('m-0 text-4xl @md:text-5xl @xl:text-6xl font-semibold', 'text-3xl')).toBe(
      'm-0 font-semibold text-3xl',
    );
  });

  it('a variant override replaces only its own bucket', () => {
    expect(mergePartClasses('text-lg @md:text-xl @xl:text-2xl', '@md:text-3xl')).toBe(
      'text-lg @xl:text-2xl @md:text-3xl',
    );
  });

  it('other properties are untouched, and a colour never removes a size', () => {
    expect(mergePartClasses('px-3 py-1 text-sm @md:text-base', 'text-accent')).toBe(
      'px-3 py-1 text-sm @md:text-base text-accent',
    );
  });

  it('through blockPartProps, the published classes carry the merge', () => {
    const part = blockPartProps(
      { node, props: { partStyles: { heading: { className: 'text-2xl' } } }, isCanvas: false },
      parts,
    );
    expect(part('heading', { className: 'text-lg leading-relaxed @md:text-xl' }).className).toBe(
      'leading-relaxed text-2xl',
    );
  });
});
// ── /block-parts ──
