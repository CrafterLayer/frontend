import type { CompletedUnitJournalInput, QueuedRunRequest, RunRecord } from '@craftkit/builder';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSourceRunJournal } from './source-run-journal';
import { createIndexedDbVaultStore, createMemoryVaultStore } from './store';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('source run journal', () => {
  it('never publishes a completed checkpoint from session memory', async () => {
    const journal = createSourceRunJournal({ store: createMemoryVaultStore() });
    const run = activeRun();

    await expect(journal.saveRun(run)).resolves.toMatchObject({ kind: 'session-only' });
    await expect(journal.commitCompletedUnit(completedInput(run))).rejects.toMatchObject({
      name: 'RunCoordinatorError',
      code: 'journal-not-durable',
    });

    expect((await journal.loadRun(run.runId))?.units[0]).toMatchObject({
      status: 'active',
      checkpointId: null,
      persisted: null,
    });
    await expect(journal.loadCheckpoint('checkpoint-hero')).resolves.toBeUndefined();
  });

  it('stores the checkpoint and completed marker in one durable envelope', async () => {
    vi.stubGlobal('indexedDB', persistentIndexedDb());
    const store = createIndexedDbVaultStore('source-run-durable');
    const journal = createSourceRunJournal({ store });
    const run = activeRun();

    await expect(journal.saveRun(run)).resolves.toEqual({ kind: 'durable', sequence: 1 });
    await expect(journal.commitCompletedUnit(completedInput(run))).resolves.toMatchObject({
      runId: run.runId,
      recoveryPoint: 'checkpoint-hero',
      units: [
        {
          unitId: 'hero',
          status: 'completed',
          checkpointId: 'checkpoint-hero',
          persisted: { kind: 'durable', sequence: 2 },
        },
      ],
    });

    const reopened = createSourceRunJournal({ store });
    await expect(reopened.loadCheckpoint('checkpoint-hero')).resolves.toEqual({
      files: { 'pages/home/index.tsx': 'export default function Home() {}' },
    });
    await expect(reopened.loadActiveRunForProject(run.projectId)).resolves.toMatchObject({
      runId: run.runId,
      recoveryPoint: 'checkpoint-hero',
    });
  });

  it('captures one editable queued request and removes it from the same store', async () => {
    vi.stubGlobal('indexedDB', persistentIndexedDb());
    const store = createIndexedDbVaultStore('source-run-queue');
    const journal = createSourceRunJournal({ store });
    const request = queuedRequest();

    await expect(journal.saveQueuedRequest(request.projectId, request)).resolves.toEqual({
      kind: 'durable',
      sequence: 1,
    });
    await expect(
      createSourceRunJournal({ store }).loadQueuedRequest(request.projectId),
    ).resolves.toEqual(request);
    await expect(journal.saveQueuedRequest(request.projectId, null)).resolves.toEqual({
      kind: 'durable',
      sequence: 2,
    });
    await expect(journal.loadQueuedRequest(request.projectId)).resolves.toBeUndefined();
  });

  it('rejects a stale provider attempt without changing the stored unit', async () => {
    vi.stubGlobal('indexedDB', persistentIndexedDb());
    const journal = createSourceRunJournal({
      store: createIndexedDbVaultStore('source-run-stale'),
    });
    const run = activeRun();
    await journal.saveRun(run);

    await expect(
      journal.commitCompletedUnit({ ...completedInput(run), attempt: 2 }),
    ).rejects.toMatchObject({ code: 'stale-result' });
    expect((await journal.loadRun(run.runId))?.units[0]?.status).toBe('active');
  });
});

function activeRun(): RunRecord {
  return {
    formatVersion: 1,
    runId: 'source-run-1',
    predecessorRunId: null,
    siteId: 'playground/site',
    projectId: 'project-home',
    pageId: 'home',
    mode: 'auto',
    status: 'active',
    target: null,
    baseRevision: 'source-r1',
    draftRevision: 'source-r1',
    routingPolicyVersion: 'economic-v1',
    units: [
      {
        unitId: 'hero',
        stage: 'generate',
        status: 'active',
        sourceRevision: 'source-r1',
        checkpointId: null,
        provider: 'openai',
        model: 'test-model',
        effort: 'medium',
        fallback: null,
        attempt: 1,
        latencyMs: null,
        usage: unknownUsage(),
        persisted: null,
      },
    ],
    cancellation: { requested: false, requestedAt: null, reason: null },
    createdAt: 100,
    startedAt: 100,
    endedAt: null,
    recoveryPoint: null,
    queuedRequestPaused: false,
    outcome: null,
  };
}

function completedInput(run: RunRecord): CompletedUnitJournalInput {
  return {
    record: run,
    unitId: 'hero',
    attempt: 1,
    sourceRevision: 'source-r1',
    checkpointId: 'checkpoint-hero',
    checkpoint: {
      files: { 'pages/home/index.tsx': 'export default function Home() {}' },
    },
    latencyMs: 240,
    usage: {
      inputTokens: 120,
      cachedInputTokens: 80,
      cacheWriteTokens: 20,
      outputTokens: 40,
      costUsd: 0.001,
    },
  };
}

function queuedRequest(): QueuedRunRequest {
  return {
    formatVersion: 1,
    requestId: 'request-next',
    siteId: 'playground/site',
    projectId: 'project-home',
    pageId: 'home',
    mode: 'auto',
    prompt: 'Add a compact testimonials section.',
    target: null,
    baseRevision: 'source-r1',
    createdAt: 200,
    updatedAt: 200,
    paused: false,
  };
}

function unknownUsage() {
  return {
    inputTokens: null,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    outputTokens: null,
    costUsd: null,
  };
}

function persistentIndexedDb(): IDBFactory {
  const entries = new Map<string, unknown>();
  const database = {
    transaction: () => {
      const transaction = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => ({
          get: (key: IDBValidKey) =>
            operation(transaction, () => {
              const value = entries.get(stringKey(key));
              return value === undefined ? undefined : structuredClone(value);
            }),
          put: (value: unknown, key: IDBValidKey) =>
            operation(transaction, () => {
              entries.set(stringKey(key), structuredClone(value));
              return key;
            }),
          delete: (key: IDBValidKey) =>
            operation(transaction, () => {
              entries.delete(stringKey(key));
              return undefined;
            }),
          getAllKeys: () => operation(transaction, () => [...entries.keys()]),
        }),
      };
      return transaction as unknown as IDBTransaction;
    },
  } as unknown as IDBDatabase;

  return {
    open: () => {
      const opening = {
        result: database,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        opening.onsuccess?.(new Event('success'));
      });
      return opening;
    },
  } as unknown as IDBFactory;
}

function stringKey(key: IDBValidKey): string {
  if (typeof key !== 'string') throw new TypeError('The test store accepts string keys only.');
  return key;
}

function operation<T>(
  transaction: {
    error: DOMException | null;
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
  },
  perform: () => T,
): IDBRequest<T> {
  const pending = {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
  } as unknown as IDBRequest<T>;
  queueMicrotask(() => {
    try {
      (pending as { result: T }).result = perform();
      pending.onsuccess?.(new Event('success'));
      queueMicrotask(() => transaction.oncomplete?.());
    } catch (error) {
      (pending as { error: DOMException | null }).error =
        error instanceof DOMException ? error : new DOMException(String(error));
      pending.onerror?.(new Event('error'));
      transaction.onerror?.();
    }
  });
  return pending;
}
