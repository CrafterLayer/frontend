import {
  createBuilder,
  emptyDocument,
  openDocument,
  type BuilderDocument,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { createVaultPersistence, sessionKey } from './persistence';
import { createMemoryVaultStore } from './store';

/**
 * SPIKE S2 — the exit gate for how a draft is SEEDED and RESUMED.
 *
 * QUESTION: does `takeOver(draft:<runId>, live.getDocument(), 0)` followed by
 * `openDocument(adapter, 'draft:<runId>')` produce a draft that a SECOND reader
 * sees byte-identically before any transaction, and that survives a reboot with
 * its transactions intact?
 *
 * WHY IT MATTERS: the obvious route — `createBuilder({ document, persistence })`
 * then `flush()` — does not store the SEED. `flush()` returns early when no
 * transactions are pending (`create-builder.ts:215`), so the document the
 * kernel was constructed with never reaches storage.
 *
 * Stated precisely, because a first draft of this comment overstated it: the
 * route is not inert forever. After the first dispatch, `flush()` appends that
 * transaction and a reader replays it — ON TOP OF THE ADAPTER'S OWN SEED, not
 * on top of the live document. So the failure is worse than "nothing is
 * stored": a draft opened after a refresh is the fixture with the run's edits
 * grafted onto it, which is a plausible-looking document that was never the
 * page the person was editing. The first two tests below pin both halves.
 */

const runId = 'run-0001';
const draftId = `draft:${runId}`;
const seed = (): BuilderDocument => emptyDocument('site', 'ltr');
const ports = (id: string) => ({ clock: fixedClock(), ids: seededIds(id) });

/** A live document with real content, so "byte-identical" means something. */
function liveDocument(): BuilderDocument {
  const kernel = createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: ports('live'),
  });
  kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'The live page' });
  return kernel.getDocument();
}

/** What a page's first paragraph says, which is what these tests compare. */
function contentOf(doc: BuilderDocument): unknown {
  return doc.nodes['p1']?.props['content'];
}

describe('S2 — seeding and resuming a draft document', () => {
  it('REPRODUCES the trap: createBuilder + flush() never stores the seed', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    const live = liveDocument();

    const draft = createBuilder({
      document: live,
      extensions: [fixtureBlocks],
      ports: ports('draft'),
      persistence: { adapter, docId: draftId },
    });
    await draft.flush();

    /*
      Nothing was written AT ALL — not the live document, and not the adapter's
      fixture either. The distinction matters and an earlier version of this
      test could not make it: `load` FALLS BACK to `seed()` when the key is
      absent, so asserting `doc === seed()` alone is equally true of "stored the
      fixture" and "stored nothing". Reading the raw key is what separates them.
    */
    expect(await store.get(sessionKey(draftId))).toBeUndefined();

    // And what a refresh would then see: the fixture, not the page being edited.
    const reopened = await adapter.load(draftId);
    expect(reopened.doc).toEqual(seed());
    expect(reopened.doc).not.toEqual(live);
  });

  it('REPRODUCES the worse half: a later flush makes the draft UNOPENABLE', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    const live = liveDocument();

    const draft = createBuilder({
      document: live,
      extensions: [fixtureBlocks],
      ports: ports('draft'),
      persistence: { adapter, docId: draftId },
    });
    draft.dispatch('setProp', { id: 'p1', key: 'content', value: 'Written by the run' });
    await draft.flush();

    // Something IS stored now — the transaction — while the stored BASE is
    // still the adapter's fixture, because the seed never went in.
    expect((await adapter.load(draftId)).tail).toHaveLength(1);

    /*
      And the two do not fit together. The patch names `nodes/p1/props/content`,
      a path the fixture does not have, so the replay inside `openDocument`
      throws and the draft cannot be opened at all.

      This is sharper than the description this test started with. "Stores
      nothing" was too kind; "grafts the run's edits onto the fixture" was the
      next guess and is also wrong here — a graft needs the path to resolve.
      What actually happens is a hard failure at open time, and which of the two
      you get depends only on whether the fixture happens to contain the nodes
      the run touched. Both are unacceptable; only one of them is loud.
    */
    await expect(
      openDocument(createVaultPersistence({ store, seed }), draftId, {
        extensions: [fixtureBlocks],
        ports: ports('reader'),
      }),
    ).rejects.toThrow(/path doesn't resolve/i);
  });

  it('seeds through takeOver so a second reader sees the live document exactly', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    const live = liveDocument();

    await adapter.takeOver(draftId, live, 0);
    const draft = await openDocument(adapter, draftId, {
      extensions: [fixtureBlocks],
      ports: ports('draft'),
    });

    expect(draft.getDocument()).toEqual(live);
    // And through a completely independent adapter over the same store, which
    // is the only reader that proves storage rather than memory.
    const second = createVaultPersistence({ store, seed });
    expect((await second.load(draftId)).doc).toEqual(live);
    expect(draft.transactions()).toHaveLength(0);
  });

  it('keeps the live document untouched while the draft is written', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    const live = liveDocument();
    const liveJson = JSON.stringify(live);

    await adapter.takeOver(draftId, live, 0);
    const draft = await openDocument(adapter, draftId, {
      extensions: [fixtureBlocks],
      ports: ports('draft'),
    });
    draft.dispatch('setProp', { id: 'p1', key: 'content', value: 'Draft only' });
    await draft.flush();

    // The draft moved; the document the live kernel holds did not.
    expect(contentOf(draft.getDocument())).toBe('Draft only');
    expect(JSON.stringify(live)).toBe(liveJson);
  });

  it('resumes a half-written draft after a reboot, transactions included', async () => {
    const store = createMemoryVaultStore();
    const first = createVaultPersistence({ store, seed });
    await first.takeOver(draftId, liveDocument(), 0);

    const before = await openDocument(first, draftId, {
      extensions: [fixtureBlocks],
      ports: ports('draft'),
    });
    before.dispatch('setProp', { id: 'p1', key: 'content', value: 'Section one' });
    before.dispatch('setProp', { id: 'p1', key: 'content', value: 'Section two' });
    await before.flush();

    // A reboot: a new adapter over the same store, nothing shared in memory.
    const rebooted = await openDocument(createVaultPersistence({ store, seed }), draftId, {
      extensions: [fixtureBlocks],
      ports: ports('resumed'),
    });

    expect(contentOf(rebooted.getDocument())).toBe('Section two');
    expect(rebooted.getDocument()).toEqual(before.getDocument());
  });

  it('keeps two drafts and the live session apart under their own ids', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    const live = liveDocument();

    await adapter.takeOver('playground/landing', live, 0);
    await adapter.takeOver('draft:run-a', live, 0);
    await adapter.takeOver('draft:run-b', live, 0);

    const a = await openDocument(adapter, 'draft:run-a', {
      extensions: [fixtureBlocks],
      ports: ports('a'),
    });
    a.dispatch('setProp', { id: 'p1', key: 'content', value: 'Only A' });
    await a.flush();

    // One chain per docId (persistence.ts): B and the live session are untouched.
    expect(contentOf((await adapter.load('draft:run-b')).doc)).toBe('The live page');
    expect(contentOf((await adapter.load('playground/landing')).doc)).toBe('The live page');
    expect((await adapter.load('draft:run-a')).tail).toHaveLength(1);
  });
});

describe('S2 — what takeOver is actually for', () => {
  it('truncates a stale tail, so a re-based session replays nothing old', async () => {
    const store = createMemoryVaultStore();
    const adapter = createVaultPersistence({ store, seed });
    const live = liveDocument();
    await adapter.takeOver(draftId, live, 0);

    const first = await openDocument(adapter, draftId, {
      extensions: [fixtureBlocks],
      ports: ports('first'),
    });
    first.dispatch('setProp', { id: 'p1', key: 'content', value: 'Old work' });
    await first.flush();
    expect((await adapter.load(draftId)).tail).toHaveLength(1);

    /*
      `takeOver` exists to answer a seq conflict, and its whole value is the
      TRUNCATION: it stores a whole document at a position with an EMPTY tail,
      so the next reader replays nothing stale. Nothing in this repo asserted
      that until now — the seeding tests above only ever used it on a key that
      had no tail to lose, which is the easy half.
    */
    const rebased = first.getDocument();
    await adapter.takeOver(draftId, rebased, 7);

    const stored = await adapter.load(draftId);
    expect(stored.tail).toEqual([]);
    expect(stored.seq).toBe(7);
    expect(stored.doc).toEqual(rebased);
  });
});
