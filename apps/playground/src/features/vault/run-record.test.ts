/**
 * The run journal as a page build writes it (2026-11-06): the streamed outline, each landing
 * with its transaction label, why the run ended — and what a reload, or a tab that crashed
 * mid-build, reads back from the store.
 */
import type { AiBuildOwnEvent } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
  createRunJournal,
  describeRun,
  isRecoverable,
  landedUnits,
  pendingUnits,
  runEnding,
  type RunRecord,
  type StartRunOptions,
} from './run-journal';
import { createMemoryVaultStore } from './store';

const RUN = 'run-7';
const KEYS = ['header', 'hero', 'menu', 'story', 'visit', 'order', 'footer'] as const;
const TITLES = ['Header', 'Hero', 'Menu', 'Our story', 'Visit us', 'Order today', 'Footer'];

const START: StartRunOptions = {
  runId: RUN,
  docId: 'playground/empty',
  pageId: 'home',
  request: 'A landing page for Northlight Coffee',
  turnId: 'turn-3',
  mode: 'auto',
  providerKind: 'remote',
  baseFingerprint: 'doc-v1-sha256-empty',
};

let seq = 0;
const base = (at: number) => ({ runId: RUN, seq: (seq += 1), at });

const outline = (at: number, count: number): AiBuildOwnEvent => ({
  ...base(at),
  type: 'build.outline',
  sections: KEYS.slice(0, count).map((key, index) => ({
    key,
    title: TITLES[index] ?? key,
    briefed: false,
  })),
});

const planned = (at: number): AiBuildOwnEvent => ({
  ...base(at),
  type: 'build.planned',
  direction: 'Warm, roasted.',
  tasks: KEYS.map((key, index) => ({ id: `node-${key}`, title: TITLES[index] ?? key })),
});

const task = (position: number) => ({
  id: `node-${KEYS[position - 1] ?? ''}`,
  title: TITLES[position - 1] ?? '',
});

const started = (at: number, position: number): AiBuildOwnEvent => ({
  ...base(at),
  type: 'task.started',
  position,
  total: KEYS.length,
  task: task(position),
  attempt: 1,
});

const landed = (at: number, position: number): AiBuildOwnEvent => ({
  ...base(at),
  type: 'task.completed',
  position,
  total: KEYS.length,
  task: task(position),
  attempts: 1,
  transactionId: `tx-${String(position)}`,
  label: `Assistant: ${String(position)}/7 — ${TITLES[position - 1] ?? ''}`,
});

/** A streamed build: the outline, the provisional regions, then three sections landed early. */
async function threeOfSeven(journal: ReturnType<typeof createRunJournal>): Promise<void> {
  await journal.start(START);
  await journal.record(RUN, { ...base(1), type: 'build.scaffolding' });
  await journal.record(RUN, outline(2, 3));
  await journal.record(RUN, outline(3, 7));
  await journal.record(RUN, planned(4));
  for (const position of [1, 2, 3, 4, 5]) await journal.record(RUN, started(5, position));
  for (const position of [1, 2, 3]) await journal.record(RUN, landed(6 + position, position));
}

function stored(record: RunRecord | undefined): RunRecord {
  if (record === undefined) throw new Error('No record was stored.');
  return record;
}

describe('a page build’s run journal', () => {
  it('survives a reload: a new journal over the same store reads what the build did', async () => {
    const store = createMemoryVaultStore();
    let now = 1_000;
    await threeOfSeven(createRunJournal({ store, now: () => (now += 1) }));

    // The reload: the tab's journal is gone; another opens the same store.
    const reopened = createRunJournal({ store, now: () => (now += 1) });
    const record = stored(await reopened.read(RUN));
    expect(record).toMatchObject({
      request: START.request,
      pageId: 'home',
      turnId: 'turn-3',
      status: 'running',
      stage: 'planned',
    });
    expect(record.outline).toEqual(KEYS.map((key, index) => ({ key, title: TITLES[index] })));
    expect(
      landedUnits(record).map(({ id, transactionId, label }) => ({ id, transactionId, label })),
    ).toEqual([
      { id: 'node-header', transactionId: 'tx-1', label: 'Assistant: 1/7 — Header' },
      { id: 'node-hero', transactionId: 'tx-2', label: 'Assistant: 2/7 — Hero' },
      { id: 'node-menu', transactionId: 'tx-3', label: 'Assistant: 3/7 — Menu' },
    ]);
    expect(pendingUnits(record).map(({ id }) => id)).toEqual(
      KEYS.slice(3).map((key) => `node-${key}`),
    );
    expect((await reopened.list('playground/empty')).map(({ runId }) => runId)).toEqual([RUN]);
  });

  it('reads a crash mid-build as interrupted after 3 of 7, with the rest to write', async () => {
    const store = createMemoryVaultStore();
    await threeOfSeven(createRunJournal({ store, now: () => 2_000 }));
    // No end mark was ever written: the tab died.
    const record = stored(await createRunJournal({ store, now: () => 3_000 }).read(RUN));
    expect(runEnding(record)).toBe('interrupted');
    expect(describeRun(record)).toBe('interrupted after 3 of 7 sections');
    expect(isRecoverable(record)).toBe(true);
  });

  it('says why each run ended: completed, stopped, errored', async () => {
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 4_000 });
    await threeOfSeven(journal);
    await journal.halt(RUN);
    const halted = stored(await journal.read(RUN));
    // Stop while the plan streamed: what landed early stays recorded, the rest is pending.
    expect(runEnding(halted)).toBe('stopped');
    expect(landedUnits(halted)).toHaveLength(3);
    expect(isRecoverable(halted)).toBe(true);

    await journal.fail(RUN, 'The provider went away.');
    expect(runEnding(stored(await journal.read(RUN)))).toBe('errored');

    await journal.reopen(RUN);
    const reports = KEYS.map((key, index) => ({
      id: `node-${key}`,
      title: TITLES[index] ?? key,
      status: 'applied' as const,
      attempts: 1,
    }));
    await journal.record(RUN, {
      ...base(9),
      type: 'build.completed',
      tasks: reports,
      applied: 7,
      skipped: 0,
      elapsedMs: 9,
      outcome: 'completed',
    });
    const done = stored(await journal.read(RUN));
    expect(runEnding(done)).toBe('completed');
    expect(isRecoverable(done)).toBe(false);
    // The early landings keep the labels the stream recorded.
    expect(done.units[0]).toMatchObject({
      transactionId: 'tx-1',
      label: 'Assistant: 1/7 — Header',
    });
  });

  it('is never offered again once kept, and is open again for a successor', async () => {
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 5_000 });
    await threeOfSeven(journal);
    await journal.keep(RUN);
    expect(isRecoverable(stored(await journal.read(RUN)))).toBe(false);

    await journal.reopen(RUN);
    const reopened = stored(await journal.read(RUN));
    expect(reopened).toMatchObject({ status: 'running', stage: 'planned' });
    expect(reopened.kept).toBeUndefined();
    expect(landedUnits(reopened)).toHaveLength(3);
  });

  it('keeps a landed section through a repeated plan, and forgets withdrawn regions', async () => {
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 6_000 });
    await threeOfSeven(journal);
    // The same regions named again: what landed is still on the page.
    await journal.record(RUN, planned(20));
    expect(landedUnits(stored(await journal.read(RUN)))).toHaveLength(3);

    // The plan path gave out: the provisional regions, early landings and all, went back.
    await journal.record(RUN, {
      ...base(21),
      type: 'build.scaffolding',
      fallback: {
        stage: 'plan',
        error: { source: 'plan', code: 'plan-rejected', message: 'refused', retryable: true },
        issues: ['refused'],
      },
    });
    const fallen = stored(await journal.read(RUN));
    expect(fallen.units).toEqual([]);
    expect(fallen.outline).toBeUndefined();
    expect(isRecoverable(fallen)).toBe(false);
  });

  it('does not offer a run that never reached its sections, or one already completed', async () => {
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 7_000 });
    await journal.start(START);
    await journal.record(RUN, outline(1, 3));
    expect(isRecoverable(stored(await journal.read(RUN)))).toBe(false);
  });
});
