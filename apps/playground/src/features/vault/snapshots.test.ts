import { emptyDocument, type BuilderDocument } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { createSnapshotShelf, kindOf } from './snapshots';
import { createMemoryVaultStore } from './store';

const docWith = (title: string): BuilderDocument => ({
  ...emptyDocument('site', 'ltr'),
  nodes: { root: { id: 'root', type: 'page', props: { title } } },
});

const entry = (label: string, ts: number, seq: number, title = label) => ({
  label,
  ts,
  seq,
  document: docWith(title),
});

describe('createSnapshotShelf', () => {
  it('saves labelled restore points and lists them NEWEST FIRST', async () => {
    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-1' });

    await shelf.save(entry('first', 10, 1));
    await shelf.save(entry('second', 20, 2));

    const listed = await shelf.list();
    expect(listed.map(({ label }) => label)).toEqual(['second', 'first']);
    expect(listed[0]?.seq).toBe(2);
    expect(listed[0]?.bytes).toBeGreaterThan(0);
  });

  it('derives ids from ts plus a counter — never Math.random', async () => {
    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-2' });

    const a = await shelf.save(entry('a', 7, 1));
    const b = await shelf.save(entry('b', 7, 2));

    expect(a.id).toBe('7-0');
    expect(b.id).toBe('7-1');
  });

  it('reads back the full document by id, and undefined for an id it never held', async () => {
    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-3' });
    const meta = await shelf.save(entry('only', 10, 1, 'Kept'));

    const read = await shelf.read(meta.id);
    expect(read?.label).toBe('only');
    expect(read?.document).toEqual(docWith('Kept'));
    expect(await shelf.read('nope')).toBeUndefined();
  });

  it('evicts by COUNT, oldest first, and drops the evicted entry’s body too', async () => {
    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-4', maxCount: 2 });

    const oldest = await shelf.save(entry('a', 10, 1));
    await shelf.save(entry('b', 20, 2));
    await shelf.save(entry('c', 30, 3));

    expect((await shelf.list()).map(({ label }) => label)).toEqual(['c', 'b']);
    expect(await shelf.read(oldest.id)).toBeUndefined();
  });

  it('evicts by TOTAL BYTES, oldest first', async () => {
    const probeStore = createMemoryVaultStore();
    const probe = createSnapshotShelf({ store: probeStore, docId: 'probe' });
    const { bytes } = await probe.save(entry('probe', 1, 1, 'x'.repeat(200)));

    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-5', maxBytes: bytes * 2 });

    const oldest = await shelf.save(entry('a', 10, 1, 'x'.repeat(200)));
    await shelf.save(entry('b', 20, 2, 'x'.repeat(200)));
    await shelf.save(entry('c', 30, 3, 'x'.repeat(200)));

    expect((await shelf.list()).map(({ label }) => label)).toEqual(['c', 'b']);
    expect(await shelf.read(oldest.id)).toBeUndefined();
  });

  it('still stores a single snapshot that alone exceeds the byte cap — refusing to save is worse', async () => {
    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-6', maxBytes: 1 });

    const meta = await shelf.save(entry('huge', 10, 1, 'x'.repeat(500)));

    expect(meta.bytes).toBeGreaterThan(1);
    expect((await shelf.list()).map(({ id }) => id)).toEqual([meta.id]);
    expect(await shelf.read(meta.id)).toBeDefined();
  });

  it('clears everything it owns, leaving no orphaned bodies behind', async () => {
    const store = createMemoryVaultStore();
    const shelf = createSnapshotShelf({ store, docId: 'doc-7' });
    const meta = await shelf.save(entry('a', 10, 1));
    await store.set('vault/session/doc-7', { keep: true });

    await shelf.clear();

    expect(await shelf.list()).toEqual([]);
    expect(await shelf.read(meta.id)).toBeUndefined();
    expect(await store.keys('vault/shelf/doc-7/')).toEqual([]);
    expect(await store.get('vault/session/doc-7')).toEqual({ keep: true });
  });

  it('keeps two documents’ shelves apart', async () => {
    const store = createMemoryVaultStore();
    const one = createSnapshotShelf({ store, docId: 'doc-8' });
    const two = createSnapshotShelf({ store, docId: 'doc-9' });

    await one.save(entry('mine', 10, 1));
    expect(await two.list()).toEqual([]);
  });

  describe('kinds pay for themselves', () => {
    it('calls an unlabelled save manual, and an old entry manual too', async () => {
      const store = createMemoryVaultStore();
      const shelf = createSnapshotShelf({ store, docId: 'doc-1' });
      const meta = await shelf.save(entry('mine', 10, 1));
      expect(meta.kind).toBe('manual');
      // Written before kinds existed: nothing in it says which it was, and
      // nothing but a person could write to the shelf then.
      expect(kindOf({ id: 'x', label: 'old', ts: 0, seq: 0, bytes: 1 })).toBe('manual');
    });

    it('keeps an auto snapshot on its own small budget', async () => {
      const store = createMemoryVaultStore();
      const shelf = createSnapshotShelf({ store, docId: 'doc-1', maxAutoCount: 2 });

      for (const index of [1, 2, 3]) {
        await shelf.save({ ...entry(`run-${String(index)}`, index * 10, index), kind: 'auto' });
      }

      const listed = await shelf.list();
      expect(listed.map(({ label }) => label)).toEqual(['run-3', 'run-2']);
    });

    it('never lets a build push a person’s own restore points off the shelf', async () => {
      const store = createMemoryVaultStore();
      const shelf = createSnapshotShelf({ store, docId: 'doc-1', maxCount: 2, maxAutoCount: 2 });

      await shelf.save(entry('mine A', 10, 1));
      await shelf.save(entry('mine B', 20, 2));
      for (const index of [1, 2, 3, 4]) {
        await shelf.save({ ...entry(`run-${String(index)}`, 100 + index, index), kind: 'auto' });
      }

      const listed = await shelf.list();
      expect(listed.filter((meta) => kindOf(meta) === 'manual').map(({ label }) => label)).toEqual([
        'mine B',
        'mine A',
      ]);
    });

    it('never lets ordinary saves evict the pre-run snapshot an undo points at', async () => {
      const store = createMemoryVaultStore();
      const shelf = createSnapshotShelf({ store, docId: 'doc-1', maxCount: 2, maxAutoCount: 2 });

      const auto = await shelf.save({ ...entry('before the run', 10, 1), kind: 'auto' });
      for (const index of [1, 2, 3, 4]) {
        await shelf.save(entry(`mine ${String(index)}`, 100 + index, index));
      }

      /*
        A button that is still on screen and no longer works is worse than no
        button — so the generation undo's snapshot must survive a person saving.
      */
      expect(await shelf.read(auto.id)).toBeDefined();
      expect((await shelf.list()).some((meta) => meta.id === auto.id)).toBe(true);
    });

    it('takes the evicted body with it, whichever kind was dropped', async () => {
      const store = createMemoryVaultStore();
      const shelf = createSnapshotShelf({ store, docId: 'doc-1', maxAutoCount: 1 });
      const first = await shelf.save({ ...entry('run-1', 10, 1), kind: 'auto' });
      await shelf.save({ ...entry('run-2', 20, 2), kind: 'auto' });
      expect(await shelf.read(first.id)).toBeUndefined();
    });
  });
});
