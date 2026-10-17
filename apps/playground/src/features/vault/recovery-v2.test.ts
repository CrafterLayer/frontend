import type { AiBuildOwnEvent, BuilderSite } from '@craftkit/builder';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REFERENCE_CODE_PROJECT_ID,
  createReferenceCodePageSite,
} from '../preview/code-page-fixture';
import { createRunJournal, isResumable, type StartRunOptions } from './run-journal';
import {
  createSiteSourceDownload,
  createVaultSitePersistence,
  type SiteArtifactMetadata,
} from './site-persistence';
import { createIndexedDbVaultStore, createMemoryVaultStore, type VaultStore } from './store';

const SITE_ID = 'playground/recovery';
const START: StartRunOptions = {
  runId: 'run-recovery',
  docId: SITE_ID,
  pageId: 'home',
  request: 'Finish the page',
  mode: 'auto',
  providerKind: 'offline',
  baseFingerprint: 'source-r1',
  limits: { maxTasks: 3, taskTimeoutMs: 10_000, buildBudgetMs: 30_000 },
};

const artifact: SiteArtifactMetadata = {
  artifactId: 'artifact-r1',
  projectId: REFERENCE_CODE_PROJECT_ID,
  pageId: 'home',
  sourceRevision: 'source-r1',
  sourceFingerprint: 'fingerprint-r1',
  dependencyFingerprint: 'dependencies-r1',
  compilerFingerprint: 'compiler-r1',
  runtimeFingerprint: 'runtime-r1',
  catalogFingerprint: 'catalog-r1',
  routeEntries: { '/': 'pages/home/index.tsx' },
  createdAt: 100,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('vault v2 recovery', () => {
  it('acknowledges IndexedDB only after the write transaction completes', async () => {
    const fake = deferredIndexedDb();
    vi.stubGlobal('indexedDB', fake.factory);
    const store = createIndexedDbVaultStore('transaction-ack');
    let settled = false;
    const saving = store.set('site', { revision: 1 }, 9).then((value) => {
      settled = true;
      return value;
    });

    await flushMicrotasks();
    expect(settled).toBe(false);
    fake.complete();
    await expect(saving).resolves.toEqual({ kind: 'durable', sequence: 9 });
  });

  it('reports session-only when a successful request is followed by an aborted transaction', async () => {
    const fake = deferredIndexedDb();
    vi.stubGlobal('indexedDB', fake.factory);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createIndexedDbVaultStore('transaction-abort');
    const saving = store.set('site', { revision: 2 }, 10);

    await flushMicrotasks();
    fake.abort();
    await expect(saving).resolves.toMatchObject({
      kind: 'session-only',
      sequence: 10,
    });
    expect(await store.get('site')).toEqual({ revision: 2 });
  });

  it('reloads invalid source byte-for-byte and creates a session recovery download', async () => {
    const invalid = 'export default function Page() { return <main>unfinished';
    const site = sourceSite(invalid, 'source-invalid');
    const store = createMemoryVaultStore();
    const first = createVaultSitePersistence({ store, seed: () => createReferenceCodePageSite() });

    const acknowledgement = await first.takeOverSite(SITE_ID, site, 0);
    expect(acknowledgement).toMatchObject({ kind: 'session-only', sequence: 0 });

    const reopened = await createVaultSitePersistence({
      store,
      seed: () => createReferenceCodePageSite(),
    }).load(SITE_ID);
    const source =
      reopened.site.codeProjects?.[REFERENCE_CODE_PROJECT_ID]?.files['pages/home/index.tsx']
        ?.source;
    expect(source).toBe(invalid);

    const download = createSiteSourceDownload(SITE_ID, reopened.site);
    expect(download.fileName).toBe('playground-recovery.craftkit.json');
    expect(
      (JSON.parse(download.contents) as BuilderSite).codeProjects?.[REFERENCE_CODE_PROJECT_ID]
        ?.files['pages/home/index.tsx']?.source,
    ).toBe(invalid);
  });

  it('does not advance acknowledgement on quota failure and leaves source downloadable', async () => {
    const inner = createMemoryVaultStore();
    const quotaStore: VaultStore = {
      get: (key) => inner.get(key),
      set: () => Promise.reject(new Error('quota exceeded')),
      remove: (key) => inner.remove(key),
      keys: (prefix) => inner.keys(prefix),
    };
    const site = sourceSite('invalid <tsx', 'source-r2');
    const adapter = createVaultSitePersistence({
      store: quotaStore,
      seed: () => createReferenceCodePageSite(),
    });

    await expect(adapter.takeOverSite(SITE_ID, site, 0)).rejects.toThrow('quota exceeded');
    expect(adapter.acknowledgement(SITE_ID)).toEqual({
      kind: 'failed',
      sequence: 0,
      reason: 'quota exceeded',
      recoverable: true,
    });
    expect(createSiteSourceDownload(SITE_ID, site).contents).toContain('invalid <tsx');
  });

  it('keeps last-good artifact identity stale until undo restores its source revision', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultSitePersistence({
      store,
      seed: () => createReferenceCodePageSite(),
    });
    await adapter.takeOverSite(SITE_ID, sourceSite('valid r1', 'source-r1'), 0);
    await adapter.saveArtifactMetadata(SITE_ID, artifact);
    await adapter.takeOverSite(SITE_ID, sourceSite('invalid r2', 'source-r2'), 0);

    const staleSource = await adapter.load(SITE_ID);
    const lastGood = (await adapter.loadArtifactMetadata(SITE_ID))['home'];
    expect(lastGood?.sourceRevision).not.toBe(
      staleSource.site.codeProjects?.[REFERENCE_CODE_PROJECT_ID]?.revision,
    );

    await adapter.takeOverSite(SITE_ID, sourceSite('valid r1', 'source-r1'), 0);
    const undone = await adapter.load(SITE_ID);
    expect(lastGood?.sourceRevision).toBe(
      undone.site.codeProjects?.[REFERENCE_CODE_PROJECT_ID]?.revision,
    );
  });

  it('persists completed units across cancel and lets only one successor claim resume', async () => {
    const store = createMemoryVaultStore();
    let now = 1_000;
    const journal = createRunJournal({ store, now: () => now });
    await journal.start(START);
    await journal.record('run-recovery', planned(now));
    now += 1;
    await journal.record('run-recovery', completed(now));
    expect(journal.acknowledgement('run-recovery')).toMatchObject({
      kind: 'session-only',
    });
    now += 1;
    await journal.record('run-recovery', cancelled(now));

    const reloaded = createRunJournal({ store, now: () => now });
    const record = await reloaded.read('run-recovery');
    expect(record?.units.map((unit) => unit.status)).toEqual(['applied', 'not-started']);
    expect(record === undefined ? false : isResumable(record)).toBe(true);

    await expect(reloaded.claimResume('run-recovery', 'run-successor')).resolves.toMatchObject({
      resumedByRunId: 'run-successor',
    });
    await expect(reloaded.claimResume('run-recovery', 'run-second')).resolves.toBeUndefined();
    expect(isResumable((await reloaded.read('run-recovery'))!)).toBe(false);
  });
});

function sourceSite(source: string, revision: string): BuilderSite {
  const site = createReferenceCodePageSite();
  const project = site.codeProjects?.[REFERENCE_CODE_PROJECT_ID];
  if (project === undefined) throw new Error('Reference code project is missing.');
  return {
    ...site,
    codeProjects: {
      ...site.codeProjects,
      [REFERENCE_CODE_PROJECT_ID]: {
        ...project,
        revision,
        files: {
          ...project.files,
          'pages/home/index.tsx': { language: 'tsx', source },
        },
      },
    },
  };
}

function planned(at: number): AiBuildOwnEvent {
  return {
    runId: 'run-recovery',
    seq: 1,
    at,
    type: 'build.planned',
    direction: 'Keep the completed hero.',
    tasks: [
      { id: 'hero', title: 'Hero' },
      { id: 'work', title: 'Work' },
    ],
  };
}

function completed(at: number): AiBuildOwnEvent {
  return {
    runId: 'run-recovery',
    seq: 2,
    at,
    type: 'task.completed',
    position: 1,
    total: 2,
    task: { id: 'hero', title: 'Hero' },
    attempts: 1,
  };
}

function cancelled(at: number): AiBuildOwnEvent {
  return {
    runId: 'run-recovery',
    seq: 3,
    at,
    type: 'build.completed',
    applied: 1,
    skipped: 0,
    elapsedMs: 2,
    outcome: 'signal',
    tasks: [
      { id: 'hero', title: 'Hero', status: 'applied', attempts: 1 },
      { id: 'work', title: 'Work', status: 'not-started', attempts: 0, reason: 'stopped' },
    ],
  };
}

function deferredIndexedDb() {
  let transaction:
    | {
        error: DOMException | null;
        oncomplete: (() => void) | null;
        onerror: (() => void) | null;
        onabort: (() => void) | null;
        objectStore: () => { put: () => IDBRequest<IDBValidKey> };
      }
    | undefined;

  const database = {
    transaction: () => {
      const pending = {
        result: 'site',
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<IDBValidKey>;
      transaction = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => ({
          put: () => {
            queueMicrotask(() => {
              pending.onsuccess?.(new Event('success'));
            });
            return pending;
          },
        }),
      };
      return transaction as unknown as IDBTransaction;
    },
  } as unknown as IDBDatabase;

  const factory = {
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

  return {
    factory,
    complete: () => transaction?.oncomplete?.(),
    abort: () => transaction?.onabort?.(),
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
