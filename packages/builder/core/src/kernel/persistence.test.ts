import { describe, expect, it } from 'vitest';

import type { BuilderError, PersistenceAdapter } from '@craftkit/builder-schema';

import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { createMemoryPersistence } from '../testing/memory-persistence';
import { createBuilder } from './create-builder';
import { openDocument } from './open-document';

const ports = (seed: string) => ({ clock: fixedClock(), ids: seededIds(seed) });

describe('US4 — persist, reload, and replay deterministically', () => {
  it('scenario 1: reload from snapshot + tail reproduces the live document exactly', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-1', landingFixture());

    const session = await openDocument(adapter, 'doc-1', {
      extensions: [fixtureBlocks],
      ports: ports('a'),
    });
    session.dispatch('setProp', { id: 'p1', key: 'content', value: 'Persisted.' });
    session.dispatch('removeNode', { id: 'cta2' });
    const seq = await session.flush();
    expect(seq).toBe(2);

    const reloaded = await openDocument(adapter, 'doc-1', {
      extensions: [fixtureBlocks],
      ports: ports('b'),
    });
    expect(reloaded.getDocument()).toEqual(session.getDocument());
    expect(reloaded.validate()).toEqual([]);
  });

  it('scenario 3: a stale append is rejected as a conflict and the stored history is untouched', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-2', landingFixture());

    const first = await openDocument(adapter, 'doc-2', {
      extensions: [fixtureBlocks],
      ports: ports('a'),
    });
    const second = await openDocument(adapter, 'doc-2', {
      extensions: [fixtureBlocks],
      ports: ports('b'),
    });

    first.dispatch('setProp', { id: 'p1', key: 'content', value: 'From first.' });
    await first.flush();

    second.dispatch('setProp', { id: 'p1', key: 'content', value: 'From second.' });
    let caught: BuilderError | undefined;
    try {
      await second.flush();
    } catch (error) {
      caught = error as BuilderError;
    }
    expect(caught?.code).toBe('persist/seq-conflict');

    const stored = adapter.dump('doc-2');
    expect(stored?.seq).toBe(1);
    expect(stored?.tail).toHaveLength(1);
    expect(stored?.tail[0]?.patches[0]?.value).toBe('From first.');
  });

  it('coalescing: transactions auto-flush in count batches; typing never awaits the network', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-3', landingFixture());
    const kernel = await openDocument(adapter, 'doc-3', {
      extensions: [fixtureBlocks],
      ports: ports('c'),
      coalesceEvery: 2,
    });

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    expect(adapter.dump('doc-3')?.tail).toHaveLength(0); // below the batch size — nothing sent
    kernel.dispatch('setProp', { id: 'hero1', key: 'heading', value: 'Two' });
    await kernel.flush();
    expect(adapter.dump('doc-3')?.seq).toBe(2);
  });

  it('Law M: an old document migrates step-by-step before opening; a gap never half-opens', async () => {
    const adapter = createMemoryPersistence();
    const oldDoc = { ...landingFixture(), schemaVersion: 0 };
    adapter.seed('doc-4', oldDoc);

    const kernel = await openDocument(adapter, 'doc-4', {
      extensions: [fixtureBlocks],
      ports: ports('d'),
      migrations: { 1: (raw) => ({ ...(raw as object), schemaVersion: 1 }) },
    });
    expect(kernel.getDocument().schemaVersion).toBe(1);

    adapter.seed('doc-5', { ...landingFixture(), schemaVersion: 0 });
    await expect(
      openDocument(adapter, 'doc-5', { extensions: [fixtureBlocks] }),
    ).rejects.toMatchObject({ code: 'doc/migration-gap' });
  });

  it('snapshot compaction keeps reloads exact', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-6', landingFixture());
    const kernel = await openDocument(adapter, 'doc-6', {
      extensions: [fixtureBlocks],
      ports: ports('e'),
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Snapshotted.' });
    const seq = await kernel.flush();
    await adapter.snapshot?.('doc-6', kernel.getDocument(), seq);
    expect(adapter.dump('doc-6')?.tail).toHaveLength(0);

    const reloaded = await openDocument(adapter, 'doc-6', {
      extensions: [fixtureBlocks],
      ports: ports('f'),
    });
    expect(reloaded.getDocument()).toEqual(kernel.getDocument());
  });

  it('flush without a persistence binding is a safe no-op', async () => {
    const kernel = createBuilder({ extensions: [fixtureBlocks], ports: ports('g') });
    await expect(kernel.flush()).resolves.toBe(0);
  });
});

describe('US4 — a flush that fails is a flush that can be retried', () => {
  it('a rejected append does not poison the chain: the next flush reaches the adapter', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-7', landingFixture());
    let failOnce = true;
    const flaky: PersistenceAdapter = {
      ...adapter,
      append: (docId, txs, expectedSeq) => {
        if (failOnce) {
          failOnce = false;
          return Promise.reject(new Error('quota exceeded (one time)'));
        }
        return adapter.append(docId, txs, expectedSeq);
      },
    };

    const kernel = await openDocument(flaky, 'doc-7', {
      extensions: [fixtureBlocks],
      ports: ports('h'),
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    await expect(kernel.flush()).rejects.toThrow('quota exceeded');

    // Storage is healthy again. The very next flush must WRITE, not replay the
    // stale rejection: a one-time failure that freezes every later save is how
    // a session ends up with nothing stored and a green screen.
    kernel.dispatch('setProp', { id: 'hero1', key: 'heading', value: 'Two' });
    await expect(kernel.flush()).resolves.toBe(2);
    expect(adapter.dump('doc-7')?.seq).toBe(2);

    const reloaded = await openDocument(adapter, 'doc-7', {
      extensions: [fixtureBlocks],
      ports: ports('i'),
    });
    expect(reloaded.getDocument()).toEqual(kernel.getDocument());
  });

  it('a transaction dispatched while an append is in flight is still sent by the next flush', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-8', landingFixture());
    let release: (() => void) | undefined;
    const parked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: (() => void) | undefined;
    const inAppend = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let parkedOnce = false;
    const slow: PersistenceAdapter = {
      ...adapter,
      append: async (docId, txs, expectedSeq) => {
        if (!parkedOnce) {
          parkedOnce = true;
          entered?.();
          await parked;
        }
        return adapter.append(docId, txs, expectedSeq);
      },
    };

    const kernel = await openDocument(slow, 'doc-8', {
      extensions: [fixtureBlocks],
      ports: ports('j'),
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'A' });
    const inFlight = kernel.flush();
    // Awaited, so the append is GENUINELY in flight — the whole point. Without
    // this the flush body has not run yet and the second transaction rides
    // along in the same batch, which is not the race being tested.
    await inAppend;
    // Typing does not stop while the network is busy. This transaction is NOT
    // part of the append in flight, so it must still be pending afterwards.
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'B' });
    release?.();
    await inFlight;

    await expect(kernel.flush()).resolves.toBe(2);
    expect(adapter.dump('doc-8')?.seq).toBe(2);

    const reloaded = await openDocument(adapter, 'doc-8', {
      extensions: [fixtureBlocks],
      ports: ports('k'),
    });
    expect(reloaded.getDocument()).toEqual(kernel.getDocument());
  });
});
