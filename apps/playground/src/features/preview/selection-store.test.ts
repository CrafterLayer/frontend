import { describe, expect, it, vi } from 'vitest';

import type { BuilderKernel, SelectionIdentityResolver, SelectionTarget } from '@craftkit/builder';

import { createPreviewSelectionStore } from './selection-store';

const target = (id: string, revision = 'site-1'): SelectionTarget => ({
  pageId: 'home',
  sourceOrNodeId: id,
  revision,
  capabilities: ['inspect', 'editProps', 'delete'],
});

function resolver(): SelectionIdentityResolver & { revision: string; nodes: Set<string> } {
  const state = { revision: 'site-1', nodes: new Set(['hero', 'features', 'inserted']) };
  return {
    currentRevision: () => state.revision,
    resolveNode: (_pageId, nodeId) =>
      state.nodes.has(nodeId)
        ? { identity: nodeId, capabilities: ['inspect', 'editProps', 'delete'] }
        : null,
    resolveSource: () => [],
    parentOf: () => target('features'),
    get revision() {
      return state.revision;
    },
    set revision(value: string) {
      state.revision = value;
    },
    get nodes() {
      return state.nodes;
    },
    set nodes(value: Set<string>) {
      state.nodes = value;
    },
  };
}

describe('preview selection store', () => {
  it('publishes canvas, layers, inspector, breadcrumb, toolbar and Agent through one snapshot', () => {
    const store = createPreviewSelectionStore({ pageId: 'home', resolver: resolver() });
    const listener = vi.fn();
    store.subscribe(listener);

    for (const origin of ['canvas', 'layers', 'inspector', 'toolbar', 'agent'] as const) {
      expect(store.select(origin, [target('hero')])).toBe(true);
      expect(store.getSnapshot()).toMatchObject({ origin, targets: [{ sourceOrNodeId: 'hero' }] });
    }
    expect(store.selectParent()).toBe(true);
    expect(store.getSnapshot()).toMatchObject({
      origin: 'breadcrumb',
      targets: [{ sourceOrNodeId: 'features' }],
    });
    expect(listener).toHaveBeenCalled();
  });

  it('captures Agent context independently and emits a post-insert reveal request', () => {
    const store = createPreviewSelectionStore({ pageId: 'home', resolver: resolver() });
    store.select('canvas', [target('hero')]);
    const captured = store.captureForAgent();

    expect(store.revealAfterInsert(target('inserted'))).toBe(true);
    expect(store.getSnapshot()).toMatchObject({
      origin: 'insert',
      reveal: { nonce: 1, target: { sourceOrNodeId: 'inserted' } },
    });
    expect(captured[0]?.sourceOrNodeId).toBe('hero');
  });

  it('clears instead of retargeting when a selected identity disappears', () => {
    const truth = resolver();
    const store = createPreviewSelectionStore({ pageId: 'home', resolver: truth });
    store.select('canvas', [target('hero')]);
    truth.nodes.delete('hero');

    expect(store.reconcile()).toBe(false);
    expect(store.getSnapshot()).toMatchObject({ targets: [], invalidReason: 'missing-target' });
  });

  it('bridges legacy native kernel selection in both directions without duplicate writes', () => {
    let ids = ['hero'];
    const kernelListeners = new Set<() => void>();
    const setSelection = vi.fn((next: readonly string[]) => {
      ids = [...next];
      for (const listener of [...kernelListeners]) listener();
    });
    const kernel = {
      getDocument: () => ({
        rootId: 'root',
        nodes: { hero: { type: 'hero' }, features: { type: 'section' } },
      }),
      setSelection,
      context: {
        registry: { block: () => ({ schema: { inlineEditable: undefined, slots: undefined } }) },
        store: {
          getState: () => ({ selection: ids }),
          subscribe: (listener: () => void) => {
            kernelListeners.add(listener);
            return () => kernelListeners.delete(listener);
          },
        },
      },
    } as unknown as BuilderKernel;
    const store = createPreviewSelectionStore({ pageId: 'home', resolver: resolver() });
    const disconnect = store.connectKernel({
      kernel,
      pageId: 'home',
      revision: () => 'site-1',
      capabilitiesFor: () => ['inspect', 'editProps', 'delete'],
    });
    expect(store.getSnapshot().targets[0]?.sourceOrNodeId).toBe('hero');

    store.select('layers', [target('features')]);
    expect(setSelection).toHaveBeenLastCalledWith(['features']);
    expect(store.getSnapshot().origin).toBe('layers');
    disconnect();
  });
});
