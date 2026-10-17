import {
  codeViewExtension,
  createBuilder,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it, vi } from 'vitest';

import { fingerprintDocument } from './drafts';
import { commitKept, keepSucceeded, kept, notApplied, type KeepPlan } from './keep-plan';
import type { RunRecord, RunUnitRecord, RunUnitStatus } from './run-journal';

/**
 * A page with three scaffold placeholders, exactly as the skeleton leaves them:
 * a section wrapper and a heading, and no body.
 */
function pageWithShells(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1', 's2', 's3'] } },
      s1: { id: 's1', type: 'text', props: { content: 'Hero' } },
      s2: { id: 's2', type: 'text', props: { content: 'Proof' } },
      s3: { id: 's3', type: 'text', props: { content: 'Pricing' } },
    },
  } as unknown as BuilderDocument;
}

const kernelWith = (document: BuilderDocument, seed: string): BuilderKernel =>
  createBuilder({
    document,
    extensions: [fixtureBlocks, codeViewExtension],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });

const unit = (
  position: number,
  id: string,
  title: string,
  status: RunUnitStatus,
  reason?: string,
): RunUnitRecord => ({
  position,
  id,
  title,
  status,
  attempts: status === 'applied' ? 1 : 2,
  ...(reason === undefined ? {} : { reason }),
});

function recordWith(units: readonly RunUnitRecord[], baseFingerprint: string): RunRecord {
  return {
    runId: 'run-1',
    docId: 'doc',
    pageId: 'home',
    request: 'build me a page',
    mode: 'ask',
    providerKind: 'offline',
    baseFingerprint,
    limits: { maxTasks: 12, taskTimeoutMs: 240_000, buildBudgetMs: 900_000 },
    status: 'stopped',
    stage: 'settled',
    units,
    spent: { elapsedMs: 1000, tasksStarted: units.length },
    createdAt: 0,
    updatedAt: 1,
    heartbeatAt: 1,
  };
}

/**
 * A live page, a draft seeded from it, and a journal describing what the run did
 * to that draft. `fill` writes the body a real fill would have written.
 */
function setup(statuses: readonly [RunUnitStatus, string?][]) {
  const live = kernelWith(pageWithShells(), 'live');
  const baseFingerprint = fingerprintDocument(live.getDocument());
  const draft = kernelWith(live.getDocument(), 'draft');

  const ids = ['s1', 's2', 's3'];
  const titles = ['Hero', 'Proof', 'Pricing'];
  statuses.forEach(([status], index) => {
    if (status !== 'applied') return;
    draft.dispatch('setProp', {
      id: ids[index] ?? '',
      key: 'content',
      value: `${titles[index] ?? ''} — body copy`,
    });
  });

  const record = recordWith(
    statuses.map(([status, reason], index) =>
      unit(index + 1, ids[index] ?? '', titles[index] ?? '', status, reason),
    ),
    baseFingerprint,
  );
  return { live, draft, record, plan: keepSucceeded(record), baseFingerprint };
}

/** Which sections are still on the live page, by their content. */
const sectionsOn = (kernel: BuilderKernel): string[] =>
  (kernel.getDocument().nodes['root']?.slots?.['default'] ?? []).map((id) => {
    const content: unknown = kernel.getDocument().nodes[id]?.props['content'];
    return typeof content === 'string' ? content : '';
  });

const LABEL = 'AI: kept 2 of 3 sections';

describe('keepSucceeded', () => {
  it('keeps a unit that applied and drops every unit that did not', () => {
    const { plan } = setup([['applied'], ['skipped', 'twice refused'], ['not-started', 'budget']]);
    expect(plan.units.map((entry) => [entry.position, entry.keep])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
  });

  it('names every unit it did not apply, with its own cause and reason', () => {
    const { plan } = setup([
      ['applied'],
      ['skipped', 'refused on landing'],
      ['not-started', 'the build budget ran out'],
    ]);
    expect(notApplied(plan).map((entry) => [entry.title, entry.cause, entry.reason])).toEqual([
      ['Proof', 'skipped', 'refused on landing'],
      ['Pricing', 'not-started', 'the build budget ran out'],
    ]);
  });

  it('calls a torn unit interrupted, and invents no sentence for it', () => {
    const { plan } = setup([['applied'], ['running'], ['waiting']]);
    expect(notApplied(plan).map((entry) => [entry.cause, entry.reason])).toEqual([
      ['interrupted', undefined],
      ['interrupted', undefined],
    ]);
  });

  it('needs no acknowledgement when nothing is dropped', () => {
    const { plan } = setup([['applied'], ['applied'], ['applied']]);
    expect(plan.acknowledgement).toBeUndefined();
    expect(notApplied(plan)).toEqual([]);
  });

  it('mints a token over the LOSSES, so the same failure set is the same token', () => {
    const first = setup([['applied'], ['skipped', 'x']]).plan;
    const second = setup([['applied'], ['skipped', 'x']]).plan;
    expect(first.acknowledgement).toBe(second.acknowledgement);
  });

  it('mints a DIFFERENT token when the losses differ', () => {
    const one = setup([['applied'], ['applied'], ['skipped', 'x']]).plan;
    const two = setup([['applied'], ['skipped', 'x'], ['skipped', 'x']]).plan;
    expect(one.acknowledgement).not.toBe(two.acknowledgement);
  });
});

describe('commitKept', () => {
  it('removes the shells and lands everything else as ONE transaction', () => {
    const { live, draft, plan } = setup([['applied'], ['skipped', 'refused'], ['applied']]);

    const outcome = commitKept({
      live,
      draft,
      plan,
      label: LABEL,
      acknowledge: plan.acknowledgement,
    });

    expect(outcome).toMatchObject({ ok: true, removed: 1 });
    // The empty shell is GONE, not committed as an empty heading.
    expect(live.getDocument().nodes['s2']).toBeUndefined();
    expect(sectionsOn(live)).toEqual(['Hero — body copy', 'Pricing — body copy']);
    expect(live.transactions()).toHaveLength(1);
    expect(live.transactions()[0]?.author).toBe('ai');
    expect(live.validate()).toEqual([]);
  });

  it('is reversed by one undo, shells and all', () => {
    const { live, draft, plan } = setup([['applied'], ['skipped', 'x'], ['applied']]);
    const before = structuredClone(live.getDocument());
    commitKept({ live, draft, plan, label: LABEL, acknowledge: plan.acknowledgement });
    expect(live.undo()).toBe(true);
    /*
      `toEqual`, not a stringified compare. A restored node comes back at the
      END of `nodes`, and key insertion order is not part of a document's
      meaning — the slot array is the order that matters, and it is restored
      exactly. Comparing JSON text here would fail on a difference that says
      nothing, which is why the fingerprint sorts keys before hashing.
    */
    expect(live.getDocument()).toEqual(before);
  });

  it('commits a clean run with no token and removes nothing', () => {
    const { live, draft, plan } = setup([['applied'], ['applied'], ['applied']]);
    const outcome = commitKept({ live, draft, plan, label: LABEL });
    expect(outcome).toMatchObject({ ok: true, removed: 0 });
    expect(sectionsOn(live)).toHaveLength(3);
  });

  describe('the acknowledgement', () => {
    it('refuses a partial with no token at all, spending nothing', () => {
      const { live, draft, plan } = setup([['applied'], ['skipped', 'x']]);
      const outcome = commitKept({ live, draft, plan, label: LABEL });

      expect(outcome).toMatchObject({ ok: false, refusal: 'unacknowledged' });
      expect(live.transactions()).toHaveLength(0);
      // And the draft still has its shells: an unacknowledged partial costs nothing.
      expect(draft.getDocument().nodes['s2']).toBeDefined();
    });

    it('refuses a token minted for a DIFFERENT failure set', () => {
      const smaller = setup([['applied'], ['applied'], ['skipped', 'x']]).plan;
      const { live, draft, plan } = setup([['applied'], ['skipped', 'x'], ['skipped', 'x']]);

      const outcome = commitKept({
        live,
        draft,
        plan,
        label: LABEL,
        acknowledge: smaller.acknowledgement,
      });

      // A boolean would have proved the caller typed `true`. This proves they
      // saw the losses they are agreeing to.
      expect(outcome).toMatchObject({ ok: false, refusal: 'unacknowledged' });
      expect(live.transactions()).toHaveLength(0);
    });
  });

  describe('refusing without spending the draft', () => {
    it('refuses when nothing was written, rather than landing a stylesheet for nothing', () => {
      const { live, draft, plan } = setup([
        ['skipped', 'x'],
        ['skipped', 'x'],
        ['skipped', 'x'],
      ]);
      const outcome = commitKept({
        live,
        draft,
        plan,
        label: LABEL,
        acknowledge: plan.acknowledgement,
      });

      expect(outcome).toMatchObject({ ok: false, refusal: 'nothing-kept' });
      expect(live.transactions()).toHaveLength(0);
      expect(draft.getDocument().nodes['s1']).toBeDefined();
    });

    it('refuses a stale page without touching the draft AT ALL', () => {
      const { live, draft, plan } = setup([['applied'], ['skipped', 'x'], ['applied']]);
      live.dispatch('setProp', { id: 's1', key: 'content', value: 'the person edited this' });
      const draftTransactions = draft.transactions().length;
      const dispatchGroup = vi.spyOn(draft, 'dispatchGroup');

      const outcome = commitKept({
        live,
        draft,
        plan,
        label: LABEL,
        acknowledge: plan.acknowledgement,
      });

      expect(outcome).toMatchObject({ ok: false, refusal: 'stale' });
      /*
        Not merely "the shells came back" — an undo would give that too. The
        draft is PERSISTED, and every dispatch is an append: pruning and undoing
        would grow its log by two on an attempt that was refused before it
        began. Checking staleness first means the refusal costs nothing at all.
      */
      expect(dispatchGroup).not.toHaveBeenCalled();
      expect(draft.transactions()).toHaveLength(draftTransactions);
      expect(draft.getDocument().nodes['s2']).toBeDefined();
      expect(live.transactions()).toHaveLength(1);
    });

    it('puts the shells back when the commit itself refuses', () => {
      const { live, draft, plan } = setup([['applied'], ['skipped', 'x'], ['applied']]);
      const shellsBefore = structuredClone(draft.getDocument());

      // No projection registered, so `commitDraft` refuses AFTER the prune.
      const bare = createBuilder({
        document: live.getDocument(),
        extensions: [fixtureBlocks],
        ports: { clock: fixedClock(), ids: seededIds('bare') },
      });

      const outcome = commitKept({
        live: bare,
        draft,
        plan,
        label: LABEL,
        acknowledge: plan.acknowledgement,
      });

      expect(outcome).toMatchObject({ ok: false, refusal: 'unavailable' });
      // The refusal is only knowable after the prune, so the prune must be undone.
      expect(draft.getDocument()).toEqual(shellsBefore);
    });
  });

  it('skips a unit whose node was never created', () => {
    const { live, draft, baseFingerprint } = setup([['applied'], ['applied']]);
    const record = recordWith(
      [unit(1, 's1', 'Hero', 'applied'), unit(2, 'gone', 'Ghost', 'not-started', 'never made')],
      baseFingerprint,
    );
    const plan: KeepPlan = keepSucceeded(record);

    const outcome = commitKept({
      live,
      draft,
      plan,
      label: LABEL,
      acknowledge: plan.acknowledgement,
    });

    // `removeNode` throws for an unknown id; a unit with no node contributes none.
    expect(outcome.ok).toBe(true);
    expect(kept(plan)).toHaveLength(1);
  });
});
