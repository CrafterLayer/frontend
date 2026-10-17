import { describe, expect, it } from 'vitest';

import type { BuilderDocument } from '@craftkit/builder-schema';

import {
  orderedChildren,
  parentOf,
  resolveTraversalAction,
  traverse,
  type SlotOrderLookup,
} from './traversal';

// page(root) → [hero1(actions: cta1, cta2), sec1(default: p1)]
const doc: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero1', 'sec1'] } },
    hero1: { id: 'hero1', type: 'hero', props: {}, slots: { actions: ['cta1', 'cta2'] } },
    cta1: { id: 'cta1', type: 'cta', props: {} },
    cta2: { id: 'cta2', type: 'cta', props: {} },
    sec1: { id: 'sec1', type: 'section', props: {}, slots: { default: ['p1'] } },
    p1: { id: 'p1', type: 'text', props: {} },
  },
};
const slotOrder: SlotOrderLookup = (type) =>
  type === 'page' ? ['default'] : type === 'hero' ? ['actions'] : undefined;

describe('traversal model (005 contract §6)', () => {
  it('orders children by schema slot declaration, stored order as fallback', () => {
    expect(orderedChildren(doc, slotOrder, 'root')).toEqual(['hero1', 'sec1']);
    expect(orderedChildren(doc, slotOrder, 'sec1')).toEqual(['p1']); // fallback path
    expect(orderedChildren(doc, slotOrder, 'p1')).toEqual([]);
  });

  it('resolves parents', () => {
    expect(parentOf(doc, 'cta2')).toBe('hero1');
    expect(parentOf(doc, 'root')).toBeUndefined();
  });

  it('moves across siblings without wrapping', () => {
    expect(traverse(doc, slotOrder, 'hero1', 'next')).toBe('sec1');
    expect(traverse(doc, slotOrder, 'sec1', 'next')).toBe('sec1'); // no wrap
    expect(traverse(doc, slotOrder, 'sec1', 'previous')).toBe('hero1');
  });

  it('steps into the first populated slot and back out to the parent', () => {
    expect(traverse(doc, slotOrder, 'hero1', 'in')).toBe('cta1');
    expect(traverse(doc, slotOrder, 'cta1', 'out')).toBe('hero1');
    expect(traverse(doc, slotOrder, 'p1', 'in')).toBe('p1'); // leaf stays
    expect(traverse(doc, slotOrder, 'root', 'out')).toBe('root'); // root stops
  });

  it('enters at the root first child with no selection, or when the node vanished', () => {
    expect(traverse(doc, slotOrder, undefined, 'next')).toBe('hero1');
    expect(traverse(doc, slotOrder, 'ghost', 'in')).toBe('hero1');
  });

  it('clear always clears', () => {
    expect(traverse(doc, slotOrder, 'hero1', 'clear')).toBeUndefined();
  });

  it('mirrors horizontal keys under RTL (FR-009/FR-011)', () => {
    expect(resolveTraversalAction('ArrowRight', 'ltr')).toBe('in');
    expect(resolveTraversalAction('ArrowRight', 'rtl')).toBe('out');
    expect(resolveTraversalAction('ArrowLeft', 'ltr')).toBe('out');
    expect(resolveTraversalAction('ArrowLeft', 'rtl')).toBe('in');
    expect(resolveTraversalAction('ArrowDown', 'rtl')).toBe('next');
    expect(resolveTraversalAction('Escape', 'ltr')).toBe('clear');
    expect(resolveTraversalAction('Tab', 'ltr')).toBeUndefined();
  });
});
