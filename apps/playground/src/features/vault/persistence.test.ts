import {
  defaultBlocks,
  emptyDocument,
  openDocument,
  type BuilderDocument,
  type BuilderError,
  type Transaction,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { createVaultPersistence } from './persistence';
import { createMemoryVaultStore } from './store';

const seed = (): BuilderDocument => emptyDocument('site', 'ltr');

/** A hand-built transaction: the adapter is dumb storage, the kernel owns meaning. */
const titleTx = (id: string, value: string, previous: string): Transaction => ({
  id,
  command: 'setProp',
  author: 'user',
  patches: [{ op: 'replace', path: ['nodes', 'root', 'props', 'title'], value }],
  inverse: [{ op: 'replace', path: ['nodes', 'root', 'props', 'title'], value: previous }],
  ts: 0,
});

const ports = (id: string) => ({ clock: fixedClock(), ids: seededIds(id) });

describe('createVaultPersistence', () => {
  it('returns a session-only acknowledgement when the write lands in memory', async () => {
    const adapter = createVaultPersistence({ store: createMemoryVaultStore(), seed });

    await expect(adapter.append('ack-doc', [titleTx('t1', 'Hello', '')], 0)).resolves.toMatchObject(
      {
        seq: 1,
        persistence: { kind: 'session-only', sequence: 1 },
      },
    );
    expect(adapter.acknowledgement('ack-doc')).toMatchObject({
      kind: 'session-only',
      sequence: 1,
    });
  });

  it('first boot loads the SEED as an empty history; a second boot returns what was appended', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });

    const first = await adapter.load('doc-1');
    expect(first.doc).toEqual(seed());
    expect(first.seq).toBe(0);
    expect(first.tail).toEqual([]);

    const { seq } = await adapter.append('doc-1', [titleTx('t1', 'Hello', '')], 0);
    expect(seq).toBe(1);

    const second = await adapter.load('doc-1');
    expect(second.seq).toBe(1);
    expect(second.tail).toHaveLength(1);
    expect(second.doc).toEqual(seed());
  });

  it('counts seq in TRANSACTIONS, not batches', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });

    const { seq } = await adapter.append(
      'doc-2',
      [titleTx('t1', 'a', ''), titleTx('t2', 'b', 'a')],
      0,
    );

    expect(seq).toBe(2);
    expect((await adapter.load('doc-2')).seq).toBe(2);
  });

  it('rejects a stale expectedSeq with persist/seq-conflict and leaves the tail untouched', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    await adapter.append('doc-3', [titleTx('t1', 'first', '')], 0);

    let caught: BuilderError | undefined;
    try {
      await adapter.append('doc-3', [titleTx('t2', 'stale', '')], 0);
    } catch (error) {
      caught = error as BuilderError;
    }

    expect(caught?.name).toBe('BuilderError');
    expect(caught?.code).toBe('persist/seq-conflict');
    expect(caught?.meta).toEqual({ expected: 0, actual: 1 });

    const stored = await adapter.load('doc-3');
    expect(stored.seq).toBe(1);
    expect(stored.tail).toHaveLength(1);
    expect(stored.tail[0]?.id).toBe('t1');
  });

  it('serialises concurrent appends: two in flight at once cannot interleave a read-modify-write', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });

    const both = await Promise.all([
      adapter.append('doc-4', [titleTx('t1', 'a', '')], 0),
      adapter.append('doc-4', [titleTx('t2', 'b', 'a')], 1),
    ]);

    expect(both.map(({ seq }) => seq)).toEqual([1, 2]);
    const stored = await adapter.load('doc-4');
    expect(stored.seq).toBe(2);
    expect(stored.tail.map(({ id }) => id)).toEqual(['t1', 't2']);
  });

  it('keeps serving after a rejection: a conflict must not poison the doc’s write chain', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    await adapter.append('doc-5', [titleTx('t1', 'a', '')], 0);

    await expect(adapter.append('doc-5', [titleTx('t2', 'stale', '')], 0)).rejects.toThrow();

    const { seq } = await adapter.append('doc-5', [titleTx('t3', 'b', 'a')], 1);
    expect(seq).toBe(2);
  });

  it('snapshot compaction truncates the tail at the CURRENT position, and no-ops at a stale one', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    await adapter.append('doc-6', [titleTx('t1', 'a', ''), titleTx('t2', 'b', 'a')], 0);

    const compacted: BuilderDocument = {
      ...seed(),
      nodes: { root: { id: 'root', type: 'page', props: { title: 'b' } } },
    };

    await adapter.snapshot?.('doc-6', compacted, 1);
    const stale = await adapter.load('doc-6');
    expect(stale.tail).toHaveLength(2);

    await adapter.snapshot?.('doc-6', compacted, 2);
    const after = await adapter.load('doc-6');
    expect(after.seq).toBe(2);
    expect(after.tail).toEqual([]);
    expect(after.doc).toEqual(compacted);
  });

  it('round-trips a real kernel session: seed → edit → flush → reopen replays identically', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });

    const session = await openDocument(adapter, 'doc-7', {
      extensions: [defaultBlocks],
      ports: ports('a'),
    });
    session.dispatch('setProp', { id: 'root', key: 'title', value: 'Persisted.' });
    expect(await session.flush()).toBe(1);

    const reopened = await openDocument(adapter, 'doc-7', {
      extensions: [defaultBlocks],
      ports: ports('b'),
    });

    expect(reopened.getDocument()).toEqual(session.getDocument());
    expect(reopened.validate()).toEqual([]);
  });

  it('compaction lets a reopened session start from the snapshot with an empty tail', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });

    const session = await openDocument(adapter, 'doc-8', {
      extensions: [defaultBlocks],
      ports: ports('a'),
    });
    session.dispatch('setProp', { id: 'root', key: 'title', value: 'One.' });
    session.dispatch('setProp', { id: 'root', key: 'title', value: 'Two.' });
    const seq = await session.flush();
    await adapter.snapshot?.('doc-8', session.getDocument(), seq);

    const stored = await adapter.load('doc-8');
    expect(stored.tail).toEqual([]);
    expect(stored.seq).toBe(seq);

    const reopened = await openDocument(adapter, 'doc-8', {
      extensions: [defaultBlocks],
      ports: ports('b'),
    });
    expect(reopened.getDocument()).toEqual(session.getDocument());
  });
});
