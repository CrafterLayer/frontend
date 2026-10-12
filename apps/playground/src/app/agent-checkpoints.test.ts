/**
 * The agent's checkpoints over the page's shelf (2026-10-12): kept before a request, listed
 * with the person's own saves, restored as one forward change, remembered across a reload.
 */
import {
  codeViewExtension,
  createBuilder,
  defaultBlocks,
  emptyDocument,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { createSnapshotShelf } from '../features/vault/snapshots';
import { createMemoryVaultStore } from '../features/vault/store';

import {
  AGENT_CHECKPOINT_TURNS_KEY,
  createAgentCheckpoints,
  type CheckpointTurnStorage,
} from './agent-checkpoints';

const kernelWith = (extensions = [defaultBlocks, codeViewExtension]): BuilderKernel =>
  createBuilder({
    document: emptyDocument('site', 'ltr'),
    extensions,
    ports: { clock: fixedClock(), ids: seededIds('checkpoints') },
  });

function memoryStorage(): CheckpointTurnStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function setup(kernel = kernelWith()) {
  const shelf = createSnapshotShelf({
    store: createMemoryVaultStore(),
    docId: 'doc',
    maxAutoCount: 10,
  });
  const storage = memoryStorage();
  let clock = 1_000;
  const now = () => (clock += 1_000);
  const port = createAgentCheckpoints({ shelf, kernel, storage, now });
  return { kernel, shelf, storage, port, now };
}

const title = (kernel: BuilderKernel) => kernel.getDocument().nodes['root']?.props['title'];

describe('createAgentCheckpoints', () => {
  it('keeps the page before a request and restores to it as one undoable change', async () => {
    const { kernel, port } = setup();
    const before = structuredClone(kernel.getDocument()) as BuilderDocument;
    port.before('turn-1', 'Make the hero darker', before);
    kernel.dispatch('setProp', { id: 'root', key: 'title', value: 'Edited by the agent' });
    const log = kernel.transactions().length;

    expect(await port.restoreBefore('turn-1')).toBe('restored');
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(log + 1);
    kernel.undo();
    expect(title(kernel)).toBe('Edited by the agent');
  });

  it('lists automatic and saved points newest first, and tells its listeners', async () => {
    const { kernel, port } = setup();
    let heard = 0;
    const off = port.subscribe(() => {
      heard += 1;
    });
    port.before('turn-1', 'Build a café page', kernel.getDocument());
    const saved = await port.save('Before the new menu');
    expect(saved).toMatchObject({ label: 'Before the new menu', kind: 'manual' });
    const list = await port.list();
    expect(list.map(({ label, kind }) => [label, kind])).toEqual([
      ['Before the new menu', 'manual'],
      ['Build a café page', 'auto'],
    ]);
    expect(heard).toBe(2);
    off();
    await port.save('Again');
    expect(heard).toBe(2);
  });

  it('says unchanged when the page already matches, and missing for an unknown request or point', async () => {
    const { kernel, port } = setup();
    port.before('turn-1', 'Nothing changes', kernel.getDocument());
    expect(await port.restoreBefore('turn-1')).toBe('unchanged');
    expect(await port.restoreBefore('turn-404')).toBe('missing');
    expect(await port.restore('no-such-point')).toBe('missing');
  });

  it('refuses honestly when the page cannot be restored', async () => {
    const { port } = setup(kernelWith([defaultBlocks]));
    const saved = await port.save('A point');
    expect(saved).toBeDefined();
    expect(await port.restore(saved?.id ?? '')).toBe('failed');
  });

  it('remembers which point belongs to which request across a reload', async () => {
    const { kernel, shelf, storage, port } = setup();
    const before = structuredClone(kernel.getDocument()) as BuilderDocument;
    port.before('turn-7', 'A long request '.repeat(20), before);
    await port.list();
    expect(storage.items.get(AGENT_CHECKPOINT_TURNS_KEY)).toContain('turn-7');
    kernel.dispatch('setProp', { id: 'root', key: 'title', value: 'Later' });

    const reopened = createAgentCheckpoints({ shelf, kernel, storage });
    expect(await reopened.restoreBefore('turn-7')).toBe('restored');
    const [point] = await reopened.list();
    expect(point?.label.length).toBeLessThanOrEqual(120);
    expect(point?.label.endsWith('…')).toBe(true);
  });

  it('never fails a request when the shelf cannot keep a point', async () => {
    const kernel = kernelWith();
    const shelf = createSnapshotShelf({ store: createMemoryVaultStore(), docId: 'doc' });
    const broken = { ...shelf, save: () => Promise.reject(new Error('quota')) };
    const port = createAgentCheckpoints({ shelf: broken, kernel });
    port.before('turn-1', 'Anything', kernel.getDocument());
    expect(await port.restoreBefore('turn-1')).toBe('missing');
    expect(await port.save('Mine')).toBeUndefined();
  });
});
