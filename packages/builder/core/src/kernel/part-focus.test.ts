import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  defineBlockSchema,
  LATEST_SCHEMA_VERSION,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { fixedClock, seededIds } from '../testing/fixed-ports';
import { createBuilder } from './create-builder';

/**
 * Part focus (block-parts DESIGN §2.5): an ephemeral focus on one named inner
 * element of the selected block. One write, never a transaction; it excludes
 * element focus; and the dispatcher drops it once the part instance is gone.
 */

const NullRender: BlockRenderComponent = () => null;

const partBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'part-blocks',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Test page root.',
          props: z.object({}),
          slots: { default: { allow: ['cards'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'cards',
          description: 'Test block with parts.',
          props: z.object({
            eyebrow: z.string().optional(),
            heading: z.string().default('Cards'),
            items: z.array(z.object({ title: z.string() })).default([]),
          }),
          parts: {
            eyebrow: { kind: 'text', bind: 'eyebrow', label: { en: 'Eyebrow', ar: 'العنوان الصغير' } },
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
            items: { kind: 'list', bind: 'items', label: { en: 'Items', ar: 'العناصر' } },
            item: { kind: 'item', bind: 'items.*', list: 'items', label: { en: 'Item', ar: 'العنصر' } },
            'item.title': {
              kind: 'text',
              bind: 'items.*.title',
              label: { en: 'Item title', ar: 'عنوان العنصر' },
            },
          },
          inlineEditable: 'heading',
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function cardsDocument(): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1', 'c2'] } },
      c1: {
        id: 'c1',
        type: 'cards',
        props: { eyebrow: 'New', heading: 'Cards', items: [{ title: 'A' }, { title: 'B' }] },
      },
      c2: { id: 'c2', type: 'cards', props: { heading: 'Other', items: [] } },
    },
  };
}

function kernel() {
  return createBuilder({
    document: cardsDocument(),
    extensions: [partBlocks],
    ports: { clock: fixedClock(), ids: seededIds('pf') },
  });
}

describe('kernel.focusPart', () => {
  it('selects the block and focuses the part in ONE write, with no transaction', () => {
    const k = kernel();
    let writes = 0;
    k.context.store.subscribe(() => {
      writes += 1;
    });
    k.focusPart('c1', { part: 'item.title', index: [1] });
    const state = k.context.store.getState();
    expect(writes).toBe(1);
    expect(state.selection).toEqual(['c1']);
    expect(state.elementFocus).toBeNull();
    expect(state.partFocus).toEqual({ id: 'c1', part: 'item.title', index: [1] });
    expect(k.transactions()).toHaveLength(0);
    expect(k.canUndo()).toBe(false);
  });

  it('copies the index, so a caller mutating its array cannot move the focus', () => {
    const k = kernel();
    const index = [0];
    k.focusPart('c1', { part: 'item.title', index });
    index[0] = 1;
    expect(k.context.store.getState().partFocus?.index).toEqual([0]);
  });

  it('clearPartFocus keeps the selection', () => {
    const k = kernel();
    k.focusPart('c1', { part: 'heading', index: [] });
    k.clearPartFocus();
    const state = k.context.store.getState();
    expect(state.partFocus).toBeNull();
    expect(state.selection).toEqual(['c1']);
  });
});

describe('part focus excludes element focus', () => {
  it('focusPart clears elementFocus, and focusElement clears partFocus', () => {
    const k = kernel();
    k.focusElement('c1', [0]);
    k.focusPart('c1', { part: 'heading', index: [] });
    expect(k.context.store.getState().elementFocus).toBeNull();
    k.focusElement('c1', [0]);
    expect(k.context.store.getState().partFocus).toBeNull();
    expect(k.context.store.getState().elementFocus).toEqual({ id: 'c1', path: [0] });
  });

  it('setSelection and clearSelection clear partFocus', () => {
    const k = kernel();
    k.focusPart('c1', { part: 'heading', index: [] });
    k.setSelection(['c2']);
    expect(k.context.store.getState().partFocus).toBeNull();
    k.focusPart('c1', { part: 'heading', index: [] });
    k.clearSelection();
    expect(k.context.store.getState().partFocus).toBeNull();
  });
});

describe('part focus pruning', () => {
  it('drops the focus when the focused item is removed', () => {
    const k = kernel();
    k.focusPart('c1', { part: 'item.title', index: [1] });
    k.dispatch('setProp', { id: 'c1', key: 'items', value: [{ title: 'A' }] });
    expect(k.context.store.getState().partFocus).toBeNull();
    expect(k.context.store.getState().selection).toEqual(['c1']);
  });

  it('keeps the focus BY REFERENCE while the instance still exists', () => {
    const k = kernel();
    k.focusPart('c1', { part: 'item.title', index: [0] });
    const before = k.context.store.getState().partFocus;
    k.dispatch('setProp', { id: 'c1', key: 'items', value: [{ title: 'A2' }] });
    k.dispatch('setProp', { id: 'c1', key: 'heading', value: 'Renamed' });
    expect(k.context.store.getState().partFocus).toBe(before);
  });

  it('keeps a focus on a defaulted prop the document never stored', () => {
    const k = kernel();
    k.focusPart('c2', { part: 'heading', index: [] });
    k.dispatch('setProp', { id: 'c2', key: 'items', value: [{ title: 'X' }] });
    expect(k.context.store.getState().partFocus).toEqual({ id: 'c2', part: 'heading', index: [] });
  });

  it('drops the focus when the node is removed, and on undo of an item add it stays dropped', () => {
    const k = kernel();
    k.focusPart('c1', { part: 'heading', index: [] });
    k.dispatch('removeNode', { id: 'c1' });
    expect(k.context.store.getState().partFocus).toBeNull();
    expect(k.context.store.getState().selection).toEqual([]);

    const again = kernel();
    again.dispatch('setProp', {
      id: 'c1',
      key: 'items',
      value: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
    });
    again.focusPart('c1', { part: 'item.title', index: [2] });
    again.undo();
    expect(again.context.store.getState().partFocus).toBeNull();
  });

  it('drops a focus naming an undeclared part on the next write', () => {
    const k = kernel();
    k.focusPart('c1', { part: 'subtitle', index: [] });
    k.dispatch('setProp', { id: 'c1', key: 'heading', value: 'X' });
    expect(k.context.store.getState().partFocus).toBeNull();
  });
});
