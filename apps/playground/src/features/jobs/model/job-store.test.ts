/**
 * The per-site job store (2026-10-12): records survive a reload (a new store over the same
 * storage), stay per site, come back newest first and capped, and a storage that throws on
 * read or write — a private window, a full quota, a sandboxed frame — never breaks the panel:
 * the records live in memory for the visit. A stored value this version cannot read is
 * skipped, record by record.
 */
import { AI_BATCH_JOB_VERSION, type AiBatchJobRecord } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
  BATCH_JOBS_MAX,
  batchJobsKey,
  createLocalBatchJobStore,
  readJobRecord,
  type JobStorage,
} from './job-store';

function record(id: string, createdAt = 1_000): AiBatchJobRecord {
  return {
    version: AI_BATCH_JOB_VERSION,
    id,
    kind: 'page-request',
    request: `Request ${id}`,
    pageIds: ['home'],
    targets: [{ itemId: 'p0', pageId: 'home' }],
    skipped: [],
    batchId: `msgbatch_${id}`,
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
    endedAt: null,
  };
}

function memory(): JobStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('createLocalBatchJobStore', () => {
  it('keeps records across a reload, newest first, per site', async () => {
    const storage = memory();
    const first = createLocalBatchJobStore(storage, 'playground/landing');
    await first.put(record('a', 1_000));
    await first.put(record('b', 2_000));

    const reloaded = createLocalBatchJobStore(storage, 'playground/landing');
    expect((await reloaded.list()).map(({ id }) => id)).toEqual(['b', 'a']);
    expect(await reloaded.get('a')).toEqual(record('a', 1_000));
    expect(await createLocalBatchJobStore(storage, 'playground/empty').list()).toEqual([]);
    expect([...storage.data.keys()]).toEqual([batchJobsKey('playground/landing')]);
  });

  it('replaces a record by id and forgets a removed one', async () => {
    const store = createLocalBatchJobStore(memory(), 'site');
    await store.put(record('a'));
    await store.put({ ...record('a'), status: 'ended' });
    expect(await store.list()).toHaveLength(1);
    expect((await store.get('a'))?.status).toBe('ended');
    await store.remove('a');
    expect(await store.list()).toEqual([]);
  });

  it(`keeps the newest ${String(BATCH_JOBS_MAX)} jobs`, async () => {
    const store = createLocalBatchJobStore(memory(), 'site');
    for (let index = 0; index <= BATCH_JOBS_MAX; index += 1) {
      await store.put(record(`job-${String(index)}`, index));
    }
    const kept = await store.list();
    expect(kept).toHaveLength(BATCH_JOBS_MAX);
    expect(kept.some(({ id }) => id === 'job-0')).toBe(false);
  });

  it('skips what it cannot read, record by record', async () => {
    const storage = memory();
    storage.setItem(
      batchJobsKey('site'),
      JSON.stringify([record('good'), { ...record('old'), version: 0 }, { id: 'half' }, 7]),
    );
    expect((await createLocalBatchJobStore(storage, 'site').list()).map(({ id }) => id)).toEqual([
      'good',
    ]);
    storage.setItem(batchJobsKey('site'), '{not json');
    expect(await createLocalBatchJobStore(storage, 'site').list()).toEqual([]);
  });

  it('never breaks on a storage that throws: the jobs stay known for the visit', async () => {
    const throwing: JobStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createLocalBatchJobStore(throwing, 'site');
    expect(await store.list()).toEqual([]);
    await store.put(record('a'));
    expect((await store.list()).map(({ id }) => id)).toEqual(['a']);

    const none = createLocalBatchJobStore(undefined, 'site');
    await none.put(record('b'));
    expect(await none.get('b')).toEqual(record('b'));
  });

  it('reads only records it understands', () => {
    expect(readJobRecord(record('a'))).toEqual(record('a'));
    expect(readJobRecord({ ...record('a'), status: 'lost' })).toBeUndefined();
    expect(readJobRecord({ ...record('a'), counts: { processing: -1 } })).toBeUndefined();
    expect(
      readJobRecord({ ...record('a'), outcomes: [{ pageId: 'home', status: 'maybe' }] }),
    ).toBeUndefined();
    expect(readJobRecord(null)).toBeUndefined();
  });
});
