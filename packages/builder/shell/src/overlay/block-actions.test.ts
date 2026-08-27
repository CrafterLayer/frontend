import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { performBlockAction, resolveBlockActions } from './block-actions';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, slots?: Record<string, { allow: string[]; max?: number }>) => ({
  schema: defineBlockSchema({
    type,
    description: type,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const inlineTextBlock = {
  schema: defineBlockSchema({
    type: 'text',
    description: 'text',
    props: z.object({ content: z.string().default('') }),
    inlineEditable: 'content',
    examples: [],
  }),
  render: NullRender,
};

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'block-actions-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', { default: { allow: ['section', 'cover'] } }),
      block('section', { default: { allow: ['text', 'section'] } }),
      // A capacity-limited slot: duplicating its only child would overflow it.
      block('cover', { default: { allow: ['text'], max: 1 } }),
      inlineTextBlock,
    ],
  },
};

// root → [sA(t1, t2, sInner), sB, cap(tCap — the full max:1 slot)]
const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['sA', 'sB', 'cap'] } },
    sA: { id: 'sA', type: 'section', props: {}, slots: { default: ['t1', 't2', 'sInner'] } },
    t1: { id: 't1', type: 'text', props: {} },
    t2: { id: 't2', type: 'text', props: {} },
    sInner: { id: 'sInner', type: 'section', props: {} },
    sB: { id: 'sB', type: 'section', props: {} },
    cap: { id: 'cap', type: 'cover', props: {}, slots: { default: ['tCap'] } },
    tCap: { id: 'tCap', type: 'text', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ba') },
  });

const enabledOf = (kernel: ReturnType<typeof makeKernel>, id: string) =>
  Object.fromEntries(resolveBlockActions(kernel, id).map((action) => [action.id, action.enabled]));

describe('resolveBlockActions (009 contract §6 a1/a3)', () => {
  it('adds Edit text as the fifth action only for an inline-editable block', () => {
    const kernel = makeKernel();
    expect(resolveBlockActions(kernel, 't2')).toEqual([
      { id: 'duplicate', label: 'Duplicate', enabled: true },
      { id: 'delete', label: 'Delete', enabled: true },
      { id: 'moveEarlier', label: 'Move earlier', enabled: true },
      { id: 'moveLater', label: 'Move later', enabled: true },
      { id: 'editText', label: 'Edit text', enabled: true },
    ]);
    expect(resolveBlockActions(kernel, 'sA').map((action) => action.id)).toEqual([
      'duplicate',
      'delete',
      'moveEarlier',
      'moveLater',
    ]);
  });

  it('disables the edges: first cannot move earlier, last cannot move later', () => {
    const kernel = makeKernel();
    expect(enabledOf(kernel, 't1')).toEqual({
      duplicate: true,
      delete: true,
      moveEarlier: false,
      moveLater: true,
      editText: true,
    });
    expect(enabledOf(kernel, 'sInner')).toEqual({
      duplicate: true,
      delete: true,
      moveEarlier: true,
      moveLater: false,
    });
  });

  it('disables everything for the document root (US3/AC3 — never a door failure)', () => {
    const kernel = makeKernel();
    expect(enabledOf(kernel, 'root')).toEqual({
      duplicate: false,
      delete: false,
      moveEarlier: false,
      moveLater: false,
    });
  });

  it('disables duplicate when the parent slot is at capacity', () => {
    const kernel = makeKernel();
    expect(enabledOf(kernel, 'tCap')).toEqual({
      duplicate: false,
      delete: true,
      moveEarlier: false, // only child: both edges at once
      moveLater: false,
      editText: true,
    });
  });

  it('resolves NO actions for a node that no longer exists', () => {
    const kernel = makeKernel();
    expect(resolveBlockActions(kernel, 'ghost')).toEqual([]);
  });
});

describe('performBlockAction — one dispatch, defined resulting selection (a2)', () => {
  it('duplicate: +1 transaction, clone lands after the origin, clone selected', () => {
    const kernel = makeKernel();
    const result = performBlockAction(kernel, 't1', 'duplicate');
    expect(result.ok).toBe(true);
    expect(result.announcement).toBe('Duplicated text');
    expect(kernel.transactions()).toHaveLength(1);

    const children = kernel.getDocument().nodes['sA']?.slots?.['default'] ?? [];
    expect(children).toHaveLength(4);
    expect(children[0]).toBe('t1');
    const clone = children[1];
    expect(result.selection).toBe(clone);
    expect(kernel.getDocument().nodes[clone ?? '']?.type).toBe('text');
    expect(kernel.context.store.getState().selection).toEqual([clone]);
  });

  it('delete (middle): the sibling that takes the seat is selected', () => {
    const kernel = makeKernel();
    const result = performBlockAction(kernel, 't1', 'delete');
    expect(result.ok).toBe(true);
    expect(result.announcement).toBe('Deleted text');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['t1']).toBeUndefined();
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual(['t2', 'sInner']);
    expect(result.selection).toBe('t2');
    expect(kernel.context.store.getState().selection).toEqual(['t2']);
  });

  it('delete (last): the new last sibling is selected', () => {
    const kernel = makeKernel();
    const result = performBlockAction(kernel, 'sInner', 'delete');
    expect(result.ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual(['t1', 't2']);
    expect(result.selection).toBe('t2');
    expect(kernel.context.store.getState().selection).toEqual(['t2']);
  });

  it('delete (only child): the parent is selected when no sibling remains', () => {
    const kernel = makeKernel();
    const result = performBlockAction(kernel, 'tCap', 'delete');
    expect(result.ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['tCap']).toBeUndefined();
    expect(result.selection).toBe('cap');
    expect(kernel.context.store.getState().selection).toEqual(['cap']);
  });

  it('moveEarlier: one transaction, order swapped, moved node stays selected', () => {
    const kernel = makeKernel();
    const result = performBlockAction(kernel, 't2', 'moveEarlier');
    expect(result.ok).toBe(true);
    expect(result.announcement).toBe('Moved text earlier');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual(['t2', 't1', 'sInner']);
    expect(result.selection).toBe('t2');
    expect(kernel.context.store.getState().selection).toEqual(['t2']);
  });

  it('moveLater: one transaction, order swapped, moved node stays selected', () => {
    const kernel = makeKernel();
    const result = performBlockAction(kernel, 't1', 'moveLater');
    expect(result.ok).toBe(true);
    expect(result.announcement).toBe('Moved text later');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual(['t2', 't1', 'sInner']);
    expect(result.selection).toBe('t1');
    expect(kernel.context.store.getState().selection).toEqual(['t1']);
  });
});

describe('performBlockAction — disabled means refused, and the door agrees', () => {
  it('root delete/duplicate: refused with no dispatch; FORCING them throws at the door', () => {
    const kernel = makeKernel();
    expect(performBlockAction(kernel, 'root', 'delete')).toEqual({
      ok: false,
      announcement: 'Cannot delete the document root',
      selection: 'root',
    });
    expect(performBlockAction(kernel, 'root', 'duplicate').ok).toBe(false);
    expect(performBlockAction(kernel, 'root', 'moveEarlier').ok).toBe(false);
    expect(kernel.transactions()).toHaveLength(0);

    // The disable is not arbitrary: the door itself rejects the forced command.
    expect(() => kernel.dispatch('removeNode', { id: 'root' })).toThrow(/root/);
    expect(() => kernel.dispatch('duplicateNode', { id: 'root' })).toThrow(/root/);
    expect(() =>
      kernel.dispatch('moveNode', { id: 'root', toParentId: 'sA', toSlot: 'default', toIndex: 0 }),
    ).toThrow(/root/);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('moveEarlier on the first child: refused; the forced dispatch (toIndex -1) throws', () => {
    const kernel = makeKernel();
    expect(performBlockAction(kernel, 't1', 'moveEarlier')).toEqual({
      ok: false,
      announcement: 'Already first',
      selection: 't1',
    });
    expect(kernel.transactions()).toHaveLength(0);
    expect(() =>
      kernel.dispatch('moveNode', { id: 't1', toParentId: 'sA', toSlot: 'default', toIndex: -1 }),
    ).toThrow();
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('moveLater on the last child: refused; forcing it records NO observable change', () => {
    const kernel = makeKernel();
    expect(performBlockAction(kernel, 'sInner', 'moveLater')).toEqual({
      ok: false,
      announcement: 'Already last',
      selection: 'sInner',
    });
    expect(kernel.transactions()).toHaveLength(0);
    // Past-the-end is clamped by the door into the SAME seat: the document does
    // not change and no transaction is logged — the disable spares the user a
    // button that announces a move which never happens.
    kernel.dispatch('moveNode', { id: 'sInner', toParentId: 'sA', toSlot: 'default', toIndex: 3 });
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual(['t1', 't2', 'sInner']);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('duplicate into a full slot: refused; the forced dispatch throws capacity', () => {
    const kernel = makeKernel();
    expect(performBlockAction(kernel, 'tCap', 'duplicate')).toEqual({
      ok: false,
      announcement: 'Cannot duplicate: slot "default" is full',
      selection: 'tCap',
    });
    expect(kernel.transactions()).toHaveLength(0);
    expect(() => kernel.dispatch('duplicateNode', { id: 'tCap' })).toThrow(/at most/);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('a vanished node and an unknown action id are refusals, not throws', () => {
    const kernel = makeKernel();
    expect(performBlockAction(kernel, 'ghost', 'delete')).toEqual({
      ok: false,
      announcement: 'The block no longer exists',
      selection: null,
    });
    expect(performBlockAction(kernel, 't1', 'explode')).toEqual({
      ok: false,
      announcement: 'Unknown block action "explode"',
      selection: null,
    });
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('Edit text is explicitly NOT a performBlockAction dispatch path', () => {
    const kernel = makeKernel();
    expect(performBlockAction(kernel, 't1', 'editText')).toEqual({
      ok: false,
      announcement: 'Edit text must be opened by the canvas',
      selection: 't1',
    });
    expect(kernel.transactions()).toHaveLength(0);
  });
});
