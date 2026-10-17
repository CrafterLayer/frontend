import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createElementSelection } from './element-selection';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'element-selection-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({ tree: customCodeTree().default(emptyCustomCodeTree()) }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const tree = {
  kind: 'root',
  children: [
    { kind: 'element', tag: 'p', text: 'One' },
    { kind: 'element', tag: 'p', text: 'Two' },
    { kind: 'element', tag: 'p', text: 'Three' },
  ],
};

const DOC = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'r2'] } },
    r1: { id: 'r1', type: 'region', props: { tree } },
    r2: { id: 'r2', type: 'region', props: { tree } },
  },
} as unknown as BuilderDocument;

const setup = () => {
  const kernel = createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('es') },
  });
  return { kernel, selection: createElementSelection(kernel) };
};

const t = (nodeId: string, ...path: number[]) => ({ kind: 'tree' as const, nodeId, path });

describe('createElementSelection', () => {
  it('mirrors the kernel primary and keeps it first', () => {
    const { kernel, selection } = setup();
    expect(selection.targets()).toEqual([]);
    kernel.focusElement('r1', [1]);
    expect(selection.targets()).toEqual([t('r1', 1)]);
    kernel.setSelection(['r2']);
    expect(selection.targets()).toEqual([{ kind: 'block', nodeId: 'r2' }]);
  });

  it('toggles members in, promotes the next primary when the primary leaves, and clears', () => {
    const { kernel, selection } = setup();
    selection.toggle(t('r1', 0));
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'r1', path: [0] });
    selection.toggle(t('r2', 2));
    selection.toggle(t('r1', 1));
    expect(selection.targets()).toEqual([t('r1', 0), t('r2', 2), t('r1', 1)]);
    expect(selection.has(t('r2', 2))).toBe(true);
    selection.toggle(t('r1', 0));
    expect(selection.targets()).toEqual([t('r2', 2), t('r1', 1)]);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'r2', path: [2] });
    selection.clear();
    expect(selection.targets()).toEqual([]);
    expect(kernel.context.store.getState().selection).toEqual([]);
  });

  it('collapses to the new primary when the kernel focus moves from outside', () => {
    const { kernel, selection } = setup();
    selection.set([t('r1', 0), t('r1', 1)]);
    expect(selection.targets()).toHaveLength(2);
    kernel.focusElement('r2', [0]); // a plain click elsewhere
    expect(selection.targets()).toEqual([t('r2', 0)]);
  });

  it('prunes members whose path vanished after an edit, and restores nothing on undo', () => {
    const { kernel, selection } = setup();
    selection.set([t('r1', 0), t('r1', 2), t('r2', 1)]);
    kernel.dispatch('setProp', {
      id: 'r1',
      key: 'tree',
      value: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Only' }] },
    });
    expect(selection.targets()).toEqual([t('r1', 0), t('r2', 1)]);
    kernel.undo();
    // Pruned members stay pruned: the store never invents a selection.
    expect(selection.targets()).toEqual([t('r1', 0), t('r2', 1)]);
  });

  it('ignores stale targets in set/toggle and keeps a stable snapshot', () => {
    const { selection } = setup();
    selection.set([t('r1', 9), t('r1', 1)]);
    expect(selection.targets()).toEqual([t('r1', 1)]);
    const first = selection.targets();
    selection.toggle(t('ghost', 0));
    expect(selection.targets()).toBe(first);
  });

  it('notifies subscribers only on membership changes, and stops after dispose', () => {
    const { kernel, selection } = setup();
    const listener = vi.fn();
    const unsubscribe = selection.subscribe(listener);
    selection.toggle(t('r1', 0));
    expect(listener).toHaveBeenCalledTimes(1);
    kernel.dispatch('setProp', { id: 'r2', key: 'tree', value: tree }); // no membership change
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    selection.toggle(t('r1', 1));
    expect(listener).toHaveBeenCalledTimes(1);
    selection.dispose();
    kernel.focusElement('r2', [0]);
    expect(selection.targets()).toEqual([t('r1', 0), t('r1', 1)]);
  });
});
