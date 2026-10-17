import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeometryPorts } from './geometry-ports';
import { createRectIndex } from './rect-index';

/*
  Block parts on the hit path (block-parts DESIGN §2.6): a registered block's
  inner elements carry `data-ck-part` (+ index, + bind) on the canvas, and the
  index reads them — but only for the node that OWNS the part.
*/

function mountFrame(): { frame: HTMLIFrameElement; doc: Document } {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (doc === null) throw new Error('jsdom iframe must expose contentDocument');
  return { frame, doc };
}

function el(doc: Document, tag: string, attributes: Record<string, string>, ...children: Node[]) {
  const element = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

describe('createRectIndex — block parts', () => {
  let frame: HTMLIFrameElement;
  let doc: Document;
  let target: Element | null;
  const measure = vi.fn((element: Element) =>
    element.hasAttribute('data-ck-part')
      ? { x: 10, y: 20, width: 30, height: 12 }
      : { x: 0, y: 0, width: 400, height: 300 },
  );

  beforeEach(() => {
    ({ frame, doc } = mountFrame());
    target = null;
    measure.mockClear();
  });
  afterEach(() => {
    frame.remove();
  });

  const build = () => {
    const heading = el(doc, 'h1', { 'data-ck-part': 'heading', 'data-ck-bind': 'heading' });
    heading.append(doc.createTextNode('Welcome'));
    const strong = el(doc, 'strong', {});
    heading.append(strong);
    const title2 = el(doc, 'h3', {
      'data-ck-part': 'item.title',
      'data-ck-part-index': '2',
      'data-ck-bind': 'items.2.title',
    });
    const card2 = el(doc, 'li', { 'data-ck-part': 'item', 'data-ck-part-index': '2', 'data-ck-bind': 'items.2' }, title2);
    // A nested node inside the hero's slot: its own part, not the hero's.
    const childHeading = el(doc, 'span', { 'data-ck-part': 'label', 'data-ck-bind': 'label' });
    const child = el(doc, 'div', { 'data-bldr-node': 'cta' }, childHeading);
    const body = el(doc, 'div', {}); // unaddressed block body
    const hero = el(doc, 'section', { 'data-bldr-node': 'hero' }, heading, el(doc, 'ul', {}, card2), child, body);
    doc.body.appendChild(hero);
    const index = createRectIndex({
      frame,
      ports: { measure: measure as unknown as GeometryPorts['measure'], hitTest: () => target },
    });
    index.attach('hero', hero);
    index.attach('cta', child);
    return { index, hero, heading, strong, title2, card2, child, childHeading, body };
  };

  it('hitAt names the part under the point, its index and its bind — without measuring', () => {
    const { index, heading, strong, title2, card2 } = build();
    target = heading;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'hero', part: { part: 'heading', index: [], bind: 'heading' } });
    // A descendant without its own stamp resolves to the nearest stamped ancestor.
    target = strong;
    expect(index.hitAt?.(1, 1)?.part?.part).toBe('heading');
    target = title2;
    expect(index.hitAt?.(1, 1)).toEqual({
      nodeId: 'hero',
      part: { part: 'item.title', index: [2], bind: 'items.2.title' },
    });
    target = card2;
    expect(index.hitAt?.(1, 1)?.part).toEqual({ part: 'item', index: [2], bind: 'items.2' });
    expect(index.stats().measures).toBe(0);
    index.dispose();
  });

  it('a part inside a NESTED node belongs to that node, never to the block around it', () => {
    const { index, childHeading, child, body } = build();
    target = childHeading;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'cta', part: { part: 'label', index: [], bind: 'label' } });
    // The nested node's own body: no part of the hero leaks in.
    target = child;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'cta' });
    // The hero's body outside any part: the whole block.
    target = body;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'hero' });
    index.dispose();
  });

  it('a malformed index or name is refused rather than read as an address', () => {
    const { index, heading } = build();
    heading.setAttribute('data-ck-part-index', '2;drop');
    target = heading;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'hero' });
    heading.setAttribute('data-ck-part-index', '');
    heading.setAttribute('data-ck-part', 'Bad Name');
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'hero' });
    index.dispose();
  });

  it('a customCode element path keeps precedence over a part stamp', () => {
    const { index, heading } = build();
    const authored = el(doc, 'em', { 'data-ck-path': '0.1' });
    heading.appendChild(authored);
    target = authored;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'hero', elementPath: [0, 1] });
    index.dispose();
  });

  it('partRect measures one instance lazily, caches per version, and never crosses into a nested node', () => {
    const { index } = build();
    const rect = index.partRect?.('hero', { part: 'item.title', index: [2] });
    expect(rect).toMatchObject({ nodeId: 'hero', x: 10, y: 20, width: 30, height: 12 });
    expect(index.partRect?.('hero', { part: 'item.title', index: [2] })).toBe(rect);
    expect(measure).toHaveBeenCalledTimes(1);
    // Wrong index, unknown part, the CHILD's part asked of the hero, unknown node.
    expect(index.partRect?.('hero', { part: 'item.title', index: [1] })).toBeUndefined();
    expect(index.partRect?.('hero', { part: 'missing', index: [] })).toBeUndefined();
    expect(index.partRect?.('hero', { part: 'label', index: [] })).toBeUndefined();
    expect(index.partRect?.('ghost', { part: 'heading', index: [] })).toBeUndefined();
    expect(index.partRect?.('cta', { part: 'label', index: [] })).toBeDefined();
    expect(index.partElement?.('hero', { part: 'heading', index: [] })?.tagName).toBe('H1');
    // An invalidation re-measures on the next read.
    doc.dispatchEvent(new Event('scroll'));
    expect(index.partRect?.('hero', { part: 'item.title', index: [2] })).not.toBe(rect);
    index.dispose();
  });
  // ── block-parts (2026-10-06) ──
  it('a part a parent draws for a child (a tab trigger) belongs to the child: hit and lookup', () => {
    const trigger = el(doc, 'button', {
      'data-ck-part': 'label',
      'data-ck-bind': 'label',
      'data-ck-part-owner': 'panel-b',
    });
    const panelBody = el(doc, 'div', { 'data-bldr-node': 'panel-b' });
    const tabs = el(doc, 'div', { 'data-bldr-node': 'tabs' }, el(doc, 'div', {}, trigger), panelBody);
    doc.body.appendChild(tabs);
    const index = createRectIndex({
      frame,
      ports: { measure: measure as unknown as GeometryPorts['measure'], hitTest: () => target },
    });
    index.attach('tabs', tabs);
    index.attach('panel-b', panelBody);
    target = trigger;
    expect(index.hitAt?.(1, 1)).toEqual({ nodeId: 'panel-b', part: { part: 'label', index: [], bind: 'label' } });
    expect(index.partElement?.('panel-b', { part: 'label', index: [] })).toBe(trigger);
    expect(index.partRect?.('panel-b', { part: 'label', index: [] })).toMatchObject({ nodeId: 'panel-b', width: 30 });
    // The Tabs block itself owns no "label" part.
    expect(index.partElement?.('tabs', { part: 'label', index: [] })).toBeUndefined();
    index.dispose();
  });
  // ── /block-parts ──
});
