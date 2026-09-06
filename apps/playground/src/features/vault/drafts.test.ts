import { createBuilder, emptyDocument, type BuilderDocument } from '@craftkit/builder';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import {
  createDrafts,
  DRAFT_LIMIT,
  DRAFT_TTL_MS,
  draftDocId,
  fingerprintDocument,
  fingerprintSite,
  type Drafts,
} from './drafts';
import { createVaultPersistence, sessionKey } from './persistence';
import { createMemoryVaultStore, type VaultStore } from './store';

const seed = (): BuilderDocument => emptyDocument('site', 'ltr');
const ports = (id: string) => ({ clock: fixedClock(), ids: seededIds(id) });

/** A live page with real content, so "byte-identical" means something. */
function liveDocument(content = 'The live page'): BuilderDocument {
  const kernel = createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: ports('live'),
  });
  kernel.dispatch('setProp', { id: 'p1', key: 'content', value: content });
  return kernel.getDocument();
}

/** A clock the test moves by hand, because a sweep is a question about time. */
function testClock(start = 1_000_000) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

function setup(clock = testClock()) {
  const store: VaultStore = createMemoryVaultStore();
  const adapter = createVaultPersistence({ store, seed });
  const drafts: Drafts = createDrafts({
    store,
    adapter,
    now: clock.now,
    extensions: [fixtureBlocks],
    ports: ports('draft'),
  });
  return { store, adapter, drafts, clock };
}

describe('fingerprints', () => {
  it('are stable for the same document', () => {
    expect(fingerprintDocument(liveDocument())).toBe(fingerprintDocument(liveDocument()));
  });

  it('change when anything in the document changes', () => {
    expect(fingerprintDocument(liveDocument('a'))).not.toBe(fingerprintDocument(liveDocument('b')));
  });

  it('do not depend on key ORDER, which a document is free to vary', () => {
    const document = liveDocument();
    /*
      The SAME document with its top-level keys inserted in reverse. Two kernels
      that produced the same page by different routes serialise their keys in
      insertion order, and a fingerprint that noticed would refuse a commit that
      changed nothing at all.
    */
    const reordered = Object.fromEntries(
      Object.entries(document).reverse(),
    ) as unknown as BuilderDocument;
    expect(Object.keys(reordered)).not.toEqual(Object.keys(document));
    expect(fingerprintDocument(reordered)).toBe(fingerprintDocument(document));
  });

  it('say what KIND they are, so two empties cannot compare equal', () => {
    const empty = emptyDocument('site', 'ltr');
    const site = { schemaVersion: 1, siteVersion: 1, pages: [], shared: {} } as never;
    expect(fingerprintDocument(empty)).toMatch(/^doc-v1-sha256-/u);
    expect(fingerprintSite(site)).toMatch(/^site-v1-sha256-/u);
    expect(fingerprintDocument(empty)).not.toBe(fingerprintSite(site));
  });
});

describe('createDrafts', () => {
  it('seeds a draft that a SECOND reader sees as the live document exactly', async () => {
    const { drafts, store } = setup();
    const live = liveDocument();
    const { kernel } = await drafts.create('run-1', live);

    expect(kernel.getDocument()).toEqual(live);
    expect(kernel.transactions()).toHaveLength(0);
    // Through a completely independent adapter: memory would pass either way.
    const second = createVaultPersistence({ store, seed });
    expect((await second.load(draftDocId('run-1'))).doc).toEqual(live);
  });

  it('records the fingerprint of the LIVE document, taken before anything is stored', async () => {
    const { drafts } = setup();
    const live = liveDocument();
    const { meta } = await drafts.create('run-1', live);
    expect(meta.baseFingerprint).toBe(fingerprintDocument(live));
  });

  it('leaves the live document untouched while the draft is written', async () => {
    const { drafts } = setup();
    const live = liveDocument();
    const before = JSON.stringify(live);
    const { kernel } = await drafts.create('run-1', live);
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Draft only' });
    await kernel.flush();
    expect(JSON.stringify(live)).toBe(before);
  });

  it('resumes a half-written draft with its transactions intact', async () => {
    const { drafts } = setup();
    const { kernel } = await drafts.create('run-1', liveDocument());
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Written by the run' });
    await kernel.flush();

    const resumed = await drafts.resume('run-1');
    expect(resumed?.kernel.getDocument().nodes['p1']?.props['content']).toBe('Written by the run');
  });

  it('resumes with the ORIGINAL fingerprint, not one taken now', async () => {
    const { drafts } = setup();
    const live = liveDocument();
    await drafts.create('run-1', live);
    const resumed = await drafts.resume('run-1');
    expect(resumed?.meta.baseFingerprint).toBe(fingerprintDocument(live));
  });

  it('resumes nothing for a run that never had a draft', async () => {
    const { drafts } = setup();
    expect(await drafts.resume('never')).toBeUndefined();
  });

  it('lists drafts newest first', async () => {
    const { drafts, clock } = setup();
    await drafts.create('old', liveDocument());
    clock.advance(1000);
    await drafts.create('new', liveDocument());
    expect((await drafts.list()).map((meta) => meta.runId)).toEqual(['new', 'old']);
  });

  it('moves a draft to the front when a run checkpoints it', async () => {
    const { drafts, clock } = setup();
    await drafts.create('a', liveDocument());
    clock.advance(1000);
    await drafts.create('b', liveDocument());
    clock.advance(1000);
    await drafts.touch('a');
    expect((await drafts.list()).map((meta) => meta.runId)).toEqual(['a', 'b']);
  });

  it('checkpoints a draft that is gone without throwing — that must not kill a build', async () => {
    const { drafts } = setup();
    await expect(drafts.touch('never')).resolves.toBeUndefined();
  });

  it('forgets BOTH halves on discard: the metadata and the session', async () => {
    const { drafts, store } = setup();
    await drafts.create('run-1', liveDocument());
    expect(await store.get(sessionKey(draftDocId('run-1')))).toBeDefined();

    await drafts.discard('run-1');
    expect(await drafts.resume('run-1')).toBeUndefined();
    expect(await store.get(sessionKey(draftDocId('run-1')))).toBeUndefined();
  });

  describe('the sweep', () => {
    it('keeps a draft that is young and within the limit', async () => {
      const { drafts } = setup();
      await drafts.create('run-1', liveDocument());
      expect(await drafts.sweep()).toEqual([]);
      expect(await drafts.list()).toHaveLength(1);
    });

    it('drops a draft that has aged past the TTL', async () => {
      const { drafts, clock } = setup();
      await drafts.create('stale', liveDocument());
      clock.advance(DRAFT_TTL_MS + 1);
      expect(await drafts.sweep()).toEqual(['stale']);
      expect(await drafts.list()).toEqual([]);
    });

    it('keeps one that is exactly at the TTL — the boundary belongs to the living', async () => {
      const { drafts, clock } = setup();
      await drafts.create('edge', liveDocument());
      clock.advance(DRAFT_TTL_MS);
      expect(await drafts.sweep()).toEqual([]);
    });

    it('keeps the newest few and drops the rest, whatever their age', async () => {
      const { drafts, clock } = setup();
      for (let index = 0; index < DRAFT_LIMIT + 2; index += 1) {
        await drafts.create(`run-${String(index)}`, liveDocument());
        clock.advance(1000);
      }
      const swept = await drafts.sweep();
      expect(swept).toEqual(['run-1', 'run-0']);
      expect(await drafts.list()).toHaveLength(DRAFT_LIMIT);
    });

    it('reports a doubly-doomed draft ONCE, not twice', async () => {
      const { drafts, clock } = setup();
      for (let index = 0; index < DRAFT_LIMIT + 1; index += 1) {
        await drafts.create(`run-${String(index)}`, liveDocument());
        clock.advance(1000);
      }
      clock.advance(DRAFT_TTL_MS);
      const swept = await drafts.sweep();
      expect(swept).toEqual([...new Set(swept)]);
    });

    it('takes the sessions with it, not only the metadata', async () => {
      const { drafts, store, clock } = setup();
      await drafts.create('stale', liveDocument());
      clock.advance(DRAFT_TTL_MS + 1);
      await drafts.sweep();
      expect(await store.get(sessionKey(draftDocId('stale')))).toBeUndefined();
    });
  });
});
