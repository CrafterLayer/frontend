import type { AiBuildOwnEvent } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
  RUN_JOURNAL_TTL_MS,
  RUN_ORPHAN_AFTER_MS,
  createRunJournal,
  isResumable,
  resumePoint,
  type RunJournal,
  type RunRecord,
  type StartRunOptions,
} from './run-journal';
import { createMemoryVaultStore, type VaultStore } from './store';

const LIMITS = { maxTasks: 12, taskTimeoutMs: 240_000, buildBudgetMs: 900_000 };

const START: StartRunOptions = {
  runId: 'run-1',
  docId: 'playground/landing',
  pageId: 'home',
  request: 'build me a studio page',
  mode: 'ask',
  providerKind: 'offline',
  baseFingerprint: 'doc-v1-sha256-abc',
  snapshotId: 'snap-1',
  limits: LIMITS,
};

function testClock(start = 1_000_000) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

function setup(clock = testClock()) {
  const store: VaultStore = createMemoryVaultStore();
  const journal: RunJournal = createRunJournal({ store, now: clock.now });
  return { store, journal, clock };
}

/** The events a real split build emits, in the order run-build.ts emits them. */
const events = {
  scaffolding: (at: number): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 0,
    at,
    type: 'build.scaffolding',
  }),
  planned: (at: number, titles: readonly string[]): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 1,
    at,
    type: 'build.planned',
    direction: 'A calm studio page.',
    tasks: titles.map((title, index) => ({ id: `n${String(index + 1)}`, title })),
  }),
  started: (at: number, position: number, attempt: 1 | 2 = 1): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 2,
    at,
    type: 'task.started',
    position,
    total: 3,
    task: { id: `n${String(position)}`, title: `Section ${String(position)}` },
    attempt,
  }),
  completed: (at: number, position: number): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 3,
    at,
    type: 'task.completed',
    position,
    total: 3,
    task: { id: `n${String(position)}`, title: `Section ${String(position)}` },
    attempts: 1,
  }),
  skipped: (at: number, position: number, reason: string): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 3,
    at,
    type: 'task.skipped',
    position,
    total: 3,
    task: { id: `n${String(position)}`, title: `Section ${String(position)}` },
    attempts: 2,
    reason,
  }),
  stopped: (at: number): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 4,
    at,
    type: 'build.stopped',
    reason: 'signal',
  }),
  buildSkipped: (at: number, reason: string): AiBuildOwnEvent => ({
    runId: 'run-1',
    seq: 1,
    at,
    type: 'build.skipped',
    reason,
  }),
};

const TITLES = ['Hero', 'Work', 'Contact'];

async function plannedRun(journal: RunJournal, clock: ReturnType<typeof testClock>) {
  await journal.start(START);
  await journal.record('run-1', events.scaffolding(clock.now()));
  await journal.record('run-1', events.planned(clock.now(), TITLES));
}

/** Read back, or fail loudly — every assertion below is about a stored record. */
async function readBack(journal: RunJournal): Promise<RunRecord> {
  const record = await journal.read('run-1');
  if (record === undefined) throw new Error('The record was not stored.');
  return record;
}

describe('createRunJournal', () => {
  it('opens a record that is running, scaffolding, and has no units yet', async () => {
    const { journal } = setup();
    const record = await journal.start(START);
    expect(record).toMatchObject({ status: 'running', stage: 'scaffolding', units: [] });
    expect(await readBack(journal)).toEqual(record);
  });

  it('keeps what the run was started against, so a stale record is detectable', async () => {
    const { journal } = setup();
    const record = await journal.start(START);
    expect(record).toMatchObject({
      docId: 'playground/landing',
      pageId: 'home',
      request: 'build me a studio page',
      mode: 'ask',
      providerKind: 'offline',
      baseFingerprint: 'doc-v1-sha256-abc',
      snapshotId: 'snap-1',
    });
  });

  it('records only the limits it can read honestly', async () => {
    const { journal } = setup();
    const record = await journal.start(START);
    expect(record.limits).toEqual(LIMITS);
    expect(Object.keys(record.limits)).not.toContain('fillConcurrency');
  });

  describe('the unit table', () => {
    it('does not exist until the build is planned', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      await journal.record('run-1', events.scaffolding(clock.now()));
      expect((await readBack(journal)).units).toEqual([]);
    });

    it('is written by build.planned, in order, with real ids', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      const record = await readBack(journal);
      expect(record.stage).toBe('planned');
      expect(record.direction).toBe('A calm studio page.');
      expect(record.units.map((unit) => [unit.position, unit.id, unit.title, unit.status])).toEqual(
        [
          [1, 'n1', 'Hero', 'waiting'],
          [2, 'n2', 'Work', 'waiting'],
          [3, 'n3', 'Contact', 'waiting'],
        ],
      );
    });

    it('moves ONE unit per event, by position', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.started(clock.now(), 2));
      const record = await readBack(journal);
      expect(record.units.map((unit) => unit.status)).toEqual(['waiting', 'running', 'waiting']);
    });

    it('keeps the FIRST start time when a unit is attempted twice', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.started(1000, 1, 1));
      await journal.record('run-1', events.started(9999, 1, 2));
      const unit = (await readBack(journal)).units[0];
      // `task.started` fires per ATTEMPT; resetting the clock would report the
      // unit as younger than it is.
      expect(unit?.startedAt).toBe(1000);
      expect(unit?.attempts).toBe(2);
    });

    it('records a skip with the door’s own reason, as a string', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.skipped(clock.now(), 2, 'refused on landing'));
      const unit = (await readBack(journal)).units[1];
      expect(unit).toMatchObject({ status: 'skipped', attempts: 2, reason: 'refused on landing' });
      expect(typeof unit?.reason).toBe('string');
    });

    it('tolerates terminal events arriving while others are still starting', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      // Writers run concurrently: section 3 starts before section 1 lands.
      await journal.record('run-1', events.started(clock.now(), 1));
      await journal.record('run-1', events.started(clock.now(), 3));
      await journal.record('run-1', events.completed(clock.now(), 1));
      const record = await readBack(journal);
      expect(record.units.map((unit) => unit.status)).toEqual(['applied', 'waiting', 'running']);
    });
  });

  describe('build.stopped', () => {
    it('does NOT freeze the table — sections already writing still land', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.started(clock.now(), 1));
      await journal.record('run-1', events.stopped(clock.now()));
      await journal.record('run-1', events.completed(clock.now(), 1));
      const record = await readBack(journal);
      expect(record.units[0]?.status).toBe('applied');
    });

    it('is not terminal: the record is still running until something closes it', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.stopped(clock.now()));
      expect((await readBack(journal)).status).toBe('running');
    });
  });

  describe('build.completed', () => {
    it('closes the record and takes every verdict from the report', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', {
        runId: 'run-1',
        seq: 9,
        at: clock.now(),
        type: 'build.completed',
        applied: 1,
        skipped: 1,
        elapsedMs: 42_000,
        outcome: 'completed',
        tasks: [
          { id: 'n1', title: 'Hero', status: 'applied', attempts: 1 },
          { id: 'n2', title: 'Work', status: 'skipped', attempts: 2, reason: 'twice refused' },
          { id: 'n3', title: 'Contact', status: 'not-started', attempts: 0, reason: 'budget' },
        ],
      });
      const record = await readBack(journal);
      expect(record).toMatchObject({ status: 'completed', stage: 'settled', elapsedMs: 42_000 });
      expect(record.units.map((unit) => unit.status)).toEqual([
        'applied',
        'skipped',
        'not-started',
      ]);
      // `not-started` has no event of its own; its reason lives only here.
      expect(record.units[2]?.reason).toBe('budget');
    });

    it('keeps each section’s own landing time, not the build’s last moment', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.started(1000, 1));
      await journal.record('run-1', events.completed(2000, 1));
      await journal.record('run-1', {
        runId: 'run-1',
        seq: 9,
        at: 99_000,
        type: 'build.completed',
        applied: 1,
        skipped: 0,
        elapsedMs: 99_000,
        outcome: 'max-tasks',
        tasks: [
          { id: 'n1', title: 'Hero', status: 'applied', attempts: 1 },
          { id: 'n2', title: 'Work', status: 'not-started', attempts: 0 },
        ],
      });
      const units = (await readBack(journal)).units;
      // The report says WHAT happened; only the task events know WHEN.
      expect(units[0]?.settledAt).toBe(2000);
      expect(units[0]?.startedAt).toBe(1000);
      // And a section that never started has no settle time to invent.
      expect(units[1]?.settledAt).toBeUndefined();
    });

    it('reports a stopped outcome as stopped, not completed', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', {
        runId: 'run-1',
        seq: 9,
        at: clock.now(),
        type: 'build.completed',
        applied: 0,
        skipped: 0,
        elapsedMs: 1,
        outcome: 'signal',
        tasks: [],
      });
      expect((await readBack(journal)).status).toBe('stopped');
    });
  });

  describe('the three runs that emit no terminal event', () => {
    it('closes a PLAN-ONLY run from the result, not the stream', async () => {
      const { journal, clock } = setup();
      await journal.start({ ...START, mode: 'plan' });
      await journal.record('run-1', events.scaffolding(clock.now()));
      // That is the entire stream a plan-only run produces.
      expect((await readBack(journal)).status).toBe('running');

      await journal.settle('run-1', {
        runId: 'run-1',
        tasks: [],
        applied: 0,
        skipped: 0,
        elapsedMs: 900,
        direction: 'A calm studio page.',
        outcome: 'planned',
      });

      const record = await readBack(journal);
      expect(record).toMatchObject({ status: 'stopped', stage: 'settled', outcome: 'planned' });
      expect(isResumable(record)).toBe(false);
    });

    it('does NOT close a fallback run — the ordinary run is still writing the page', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      await journal.record('run-1', events.scaffolding(clock.now()));
      await journal.record('run-1', events.buildSkipped(clock.now(), 'one section only'));
      const record = await readBack(journal);
      /*
        `build.skipped` is emitted BEFORE the fallback agent runs, and that run
        is a success path. Marking the record terminal here buried it minutes
        before the work finished.
      */
      expect(record.status).toBe('running');
      expect(record).toMatchObject({ outcome: 'fallback', fallbackReason: 'one section only' });
    });

    it('does not call a fallback a FAILURE — it is a routing decision', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      await journal.record('run-1', events.buildSkipped(clock.now(), 'one section only'));
      expect((await readBack(journal)).failure).toBeUndefined();
    });

    it('closes a run that THREW, keeping the reason as a string', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.fail('run-1', 'The provider timed out.');
      const record = await readBack(journal);
      expect(record).toMatchObject({ status: 'failed', failure: 'The provider timed out.' });
      expect(typeof record.failure).toBe('string');
    });
  });

  describe('resuming', () => {
    it('points at the first unit still waiting', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.completed(clock.now(), 1));
      expect(resumePoint(await readBack(journal))?.position).toBe(2);
    });

    it('points at a unit left RUNNING, which is exactly the torn case', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.completed(clock.now(), 1));
      await journal.record('run-1', events.started(clock.now(), 2));
      await journal.fail('run-1', 'gone');
      expect(resumePoint(await readBack(journal))?.position).toBe(2);
    });

    it('points nowhere when every unit settled', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      for (const position of [1, 2, 3]) {
        await journal.record('run-1', events.completed(clock.now(), position));
      }
      expect(resumePoint(await readBack(journal))).toBeUndefined();
    });

    it('refuses to call a RUNNING record resumable — it may be alive elsewhere', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      expect(isResumable(await readBack(journal))).toBe(false);
    });

    it('refuses a record whose last checkpoint failed — its states are not trusted', async () => {
      const { journal, clock, store } = setup();
      await plannedRun(journal, clock);
      await journal.fail('run-1', 'gone');
      const record = await readBack(journal);
      await store.set('vault/run/run-1', { ...record, writeFailure: 'quota exceeded' });
      expect(isResumable(await readBack(journal))).toBe(false);
    });

    it('resumes a build stopped at its TASK LIMIT — the canonical resumable run', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.completed(clock.now(), 1));
      await journal.record('run-1', events.stopped(clock.now()));
      await journal.record('run-1', {
        runId: 'run-1',
        seq: 9,
        at: clock.now(),
        type: 'build.completed',
        applied: 1,
        skipped: 0,
        elapsedMs: 5000,
        outcome: 'max-tasks',
        tasks: [
          { id: 'n1', title: 'Hero', status: 'applied', attempts: 1 },
          { id: 'n2', title: 'Work', status: 'not-started', attempts: 0, reason: 'task limit' },
          { id: 'n3', title: 'Contact', status: 'not-started', attempts: 0, reason: 'task limit' },
        ],
      });

      const record = await readBack(journal);
      /*
        A clean stop reports untouched sections as `not-started`; a torn tab
        leaves them `waiting`. Same physical state, two words — and matching
        only `waiting` made the journal able to resume a CRASH and unable to
        resume a clean stop, which is the useful case and the common one.
      */
      expect(record.units.map((unit) => unit.status)).toEqual([
        'applied',
        'not-started',
        'not-started',
      ]);
      expect(resumePoint(record)?.position).toBe(2);
      expect(isResumable(record)).toBe(true);
    });

    it('resumes a build stopped by the person, from the first unwritten section', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', {
        runId: 'run-1',
        seq: 9,
        at: clock.now(),
        type: 'build.completed',
        applied: 0,
        skipped: 0,
        elapsedMs: 900,
        outcome: 'signal',
        tasks: [
          { id: 'n1', title: 'Hero', status: 'not-started', attempts: 0, reason: 'stopped' },
          { id: 'n2', title: 'Work', status: 'not-started', attempts: 0, reason: 'stopped' },
          { id: 'n3', title: 'Contact', status: 'not-started', attempts: 0, reason: 'stopped' },
        ],
      });
      expect(resumePoint(await readBack(journal))?.position).toBe(1);
    });

    it('refuses a plan the person DECLINED, which looks identical to a Stop', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.decline('run-1');
      await journal.record('run-1', {
        runId: 'run-1',
        seq: 9,
        at: clock.now(),
        type: 'build.completed',
        applied: 0,
        skipped: 0,
        elapsedMs: 900,
        outcome: 'signal',
        tasks: [{ id: 'n1', title: 'Hero', status: 'not-started', attempts: 0 }],
      });
      const record = await readBack(journal);
      // Nothing in the run can tell these apart; only the caller can.
      expect(resumePoint(record)).toBeDefined();
      expect(isResumable(record)).toBe(false);
    });

    it('refuses a record that never reached a unit table', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      await journal.record('run-1', events.scaffolding(clock.now()));
      await journal.fail('run-1', 'the scaffold was aborted');
      expect(isResumable(await readBack(journal))).toBe(false);
    });

    it('allows a torn run that got past planning', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.fail('run-1', 'the tab went away');
      expect(isResumable(await readBack(journal))).toBe(true);
    });
  });

  describe('recovery', () => {
    it('leaves a running record alone while its heartbeat is fresh', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      clock.advance(RUN_ORPHAN_AFTER_MS);
      expect(await journal.recover()).toEqual([]);
      expect((await readBack(journal)).status).toBe('running');
    });

    it('recovers one whose tab went away, and says so in its OWN field', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      clock.advance(RUN_ORPHAN_AFTER_MS + 1);
      expect(await journal.recover()).toEqual(['run-1']);
      const record = await readBack(journal);
      expect(record.status).toBe('stopped');
      expect(record.recovered).toBe(true);
      /*
        NOT `failure`. A run nobody closed may have finished perfectly; claiming
        it failed is a different statement, and one this record cannot support.
      */
      expect(record.failure).toBeUndefined();
    });

    it('takes the verdict BACK when the run turns out to be alive', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      clock.advance(RUN_ORPHAN_AFTER_MS + 1);
      await journal.recover();
      expect((await readBack(journal)).recovered).toBe(true);

      await journal.settle('run-1', {
        runId: 'run-1',
        tasks: [],
        applied: 3,
        skipped: 0,
        elapsedMs: 60_000,
        direction: 'd',
        outcome: 'completed',
      });

      const record = await readBack(journal);
      expect(record.status).toBe('completed');
      // A record cannot be both finished and abandoned.
      expect(record.recovered).toBe(false);
    });

    it('does not recover a run that settled AFTER the listing but before the write', async () => {
      const { journal, clock, store } = setup();
      await plannedRun(journal, clock);
      clock.advance(RUN_ORPHAN_AFTER_MS + 1);

      /*
        The window is narrow and has to be hit exactly. `recover` reads the
        candidate list first (get #1) and re-reads the record inside the chain
        before writing (get #2) — so the concurrent settle is injected on that
        SECOND read. Landing it any earlier only removes the record from the
        candidate list, which is the guard that is NOT under test here.
      */
      let reads = 0;
      const read = store.get.bind(store);
      store.get = async <T>(key: string): Promise<T | undefined> => {
        reads += 1;
        if (reads === 2) {
          const current = await read<RunRecord>(key);
          if (current !== undefined) {
            await store.set(key, { ...current, status: 'failed', failure: 'closed itself' });
          }
        }
        return read<T>(key);
      };

      expect(await journal.recover()).toEqual([]);
      store.get = read;
      const record = await readBack(journal);
      expect(record.status).toBe('failed');
      expect(record.recovered).toBeUndefined();
    });

    it('reports only what it actually wrote', async () => {
      const clock = testClock();
      const store = createMemoryVaultStore();
      const journal = createRunJournal({ store, now: clock.now });
      await plannedRun(journal, clock);
      clock.advance(RUN_ORPHAN_AFTER_MS + 1);
      store.set = () => Promise.reject(new Error('quota exceeded'));
      // The write cannot land, so nothing may be claimed.
      expect(await journal.recover()).toEqual([]);
    });

    it('is kept alive by checkpoints, so a slow build is never declared dead', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      clock.advance(RUN_ORPHAN_AFTER_MS - 1);
      await journal.record('run-1', events.completed(clock.now(), 1));
      clock.advance(RUN_ORPHAN_AFTER_MS - 1);
      expect(await journal.recover()).toEqual([]);
    });

    it('never touches a record that already settled', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.fail('run-1', 'done being sad');
      clock.advance(RUN_ORPHAN_AFTER_MS * 10);
      expect(await journal.recover()).toEqual([]);
      expect((await readBack(journal)).failure).toBe('done being sad');
    });
  });

  describe('listing and sweeping', () => {
    it('lists newest first', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      clock.advance(1000);
      await journal.start({ ...START, runId: 'run-2' });
      const listed = await journal.list();
      expect(listed.map((record) => record.runId)).toEqual(['run-2', 'run-1']);
    });

    it('filters to one document, because a record for another is not ours', async () => {
      const { journal } = setup();
      await journal.start(START);
      await journal.start({ ...START, runId: 'run-2', docId: 'playground/other' });
      const listed = await journal.list('playground/landing');
      expect(listed.map((record) => record.runId)).toEqual(['run-1']);
    });

    it('keeps a record that is younger than the TTL', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      clock.advance(RUN_JOURNAL_TTL_MS);
      expect(await journal.sweep()).toEqual([]);
    });

    it('does not drop a record that checkpointed AFTER the listing but before the delete', async () => {
      const { journal, clock, store } = setup();
      await plannedRun(journal, clock);
      clock.advance(RUN_JOURNAL_TTL_MS + 1);

      /* Injected on the re-read inside the chain, for the reason above. */
      let reads = 0;
      const read = store.get.bind(store);
      store.get = async <T>(key: string): Promise<T | undefined> => {
        reads += 1;
        if (reads === 2) {
          const current = await read<RunRecord>(key);
          if (current !== undefined) await store.set(key, { ...current, updatedAt: clock.now() });
        }
        return read<T>(key);
      };

      expect(await journal.sweep()).toEqual([]);
      store.get = read;
      expect(await journal.read('run-1')).toBeDefined();
    });

    it('drops one that aged out, and forgets it', async () => {
      const { journal, clock } = setup();
      await journal.start(START);
      clock.advance(RUN_JOURNAL_TTL_MS + 1);
      expect(await journal.sweep()).toEqual(['run-1']);
      expect(await journal.read('run-1')).toBeUndefined();
    });

    it('outlives a draft rather than the other way round', async () => {
      // The journal must never be the shorter-lived half, or Resume offers a
      // run whose document is gone.
      const { DRAFT_TTL_MS } = await import('./drafts');
      expect(RUN_JOURNAL_TTL_MS).toBeGreaterThanOrEqual(DRAFT_TTL_MS);
    });
  });

  describe('what it has spent', () => {
    it('starts at nothing', async () => {
      const { journal } = setup();
      expect((await journal.start(START)).spent).toEqual({ elapsedMs: 0, tasksStarted: 0 });
    });

    it('counts wall clock from the run’s own start, at every checkpoint', async () => {
      const clock = testClock(1_000_000);
      const { journal } = setup(clock);
      await journal.start(START);
      await journal.record('run-1', events.planned(1_000_000 + 4_000, TITLES));
      expect((await readBack(journal)).spent.elapsedMs).toBe(4_000);
    });

    it('counts units STARTED against the task limit, not units finished', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.started(clock.now(), 1));
      await journal.record('run-1', events.started(clock.now(), 2));
      await journal.record('run-1', events.completed(clock.now(), 1));
      const record = await readBack(journal);
      expect(record.spent.tasksStarted).toBe(2);
      expect(record.limits.maxTasks).toBe(12);
    });

    it('counts a twice-attempted unit once — it is one unit', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.record('run-1', events.started(clock.now(), 1, 1));
      await journal.record('run-1', events.started(clock.now(), 1, 2));
      expect((await readBack(journal)).spent.tasksStarted).toBe(1);
    });
  });

  describe('writing safely', () => {
    it('never throws when the store refuses, and marks the record instead', async () => {
      const clock = testClock();
      const store = createMemoryVaultStore();
      const journal = createRunJournal({ store, now: clock.now });
      await plannedRun(journal, clock);

      let refuse = true;
      const original = store.set.bind(store);
      store.set = async (key: string, value: unknown) => {
        if (refuse) throw new Error('quota exceeded');
        return original(key, value);
      };

      // The caller is inside an emitter that swallows throws. It must not throw.
      await expect(
        journal.record('run-1', events.completed(clock.now(), 1)),
      ).resolves.toBeUndefined();

      refuse = false;
      await journal.record('run-1', events.completed(clock.now(), 2));
      expect((await readBack(journal)).writeFailure).toBe('quota exceeded');
    });

    it('does nothing for a run it has no record of', async () => {
      const { journal, clock } = setup();
      await expect(
        journal.record('never', events.completed(clock.now(), 1)),
      ).resolves.toBeUndefined();
      expect(await journal.read('never')).toBeUndefined();
    });

    it('does not lose an update when checkpoints are written concurrently', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      // Three events fired without awaiting between them, which is what an
      // emitter does. Every one must land.
      await Promise.all([
        journal.record('run-1', events.completed(clock.now(), 1)),
        journal.record('run-1', events.completed(clock.now(), 2)),
        journal.record('run-1', events.completed(clock.now(), 3)),
      ]);
      expect((await readBack(journal)).units.map((unit) => unit.status)).toEqual([
        'applied',
        'applied',
        'applied',
      ]);
    });

    it('stores nothing that a structured clone would refuse', async () => {
      const { journal, clock } = setup();
      await plannedRun(journal, clock);
      await journal.fail('run-1', 'a plain string, never an Error');
      const record = await readBack(journal);
      // The memory store clones on both sides; a non-cloneable value throws
      // synchronously, inside the emitter, where it would be swallowed.
      expect(() => structuredClone(record)).not.toThrow();
    });
  });
});
