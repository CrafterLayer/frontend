import { describe, expect, it } from 'vitest';

import type { AiBuildEvent, AiBuildTask, AiBuildTaskReport } from '@craftkit/builder';

import {
  buildEta,
  buildReceipt,
  initialBuildProgress,
  lastEvidenceAt,
  reduceBuildProgress,
  taskTransactionLabel,
  type BuildProgress,
} from './AssistantPanel.build';

const TASKS: readonly AiBuildTask[] = [
  { id: 'r1', title: 'Hero' },
  { id: 'r2', title: 'Proof' },
  { id: 'r3', title: 'Pricing' },
];

const DIRECTION = 'A calm studio page. 1 Hero · 2 Proof · 3 Pricing.';

let seq = 0;

/** One build event, stamped the way the orchestrator stamps its own. */
function event(at: number, payload: Record<string, unknown>): AiBuildEvent {
  seq += 1;
  return { runId: 'run-1', seq, at, ...payload } as unknown as AiBuildEvent;
}

function feed(progress: BuildProgress, events: readonly AiBuildEvent[]): BuildProgress {
  return events.reduce(reduceBuildProgress, progress);
}

const planned = (at = 1_000) =>
  event(at, { type: 'build.planned', direction: DIRECTION, tasks: TASKS });

const started = (position: number, at: number, attempt: 1 | 2 = 1) =>
  event(at, {
    type: 'task.started',
    position,
    total: TASKS.length,
    task: TASKS[position - 1],
    attempt,
  });

const completed = (position: number, at: number, attempts = 1) =>
  event(at, {
    type: 'task.completed',
    position,
    total: TASKS.length,
    task: TASKS[position - 1],
    attempts,
  });

const skippedTask = (position: number, at: number, reason: string) =>
  event(at, {
    type: 'task.skipped',
    position,
    total: TASKS.length,
    task: TASKS[position - 1],
    attempts: 2,
    reason,
  });

function report(status: AiBuildTaskReport['status'], index: number, reason?: string) {
  const task = TASKS[index];
  return {
    id: task?.id ?? '',
    title: task?.title ?? '',
    status,
    attempts: status === 'not-started' ? 0 : 1,
    ...(reason === undefined ? {} : { reason }),
  } satisfies AiBuildTaskReport;
}

describe('reduceBuildProgress', () => {
  it('opens on the skeleton, with no tasks and the scaffold run already ticking', () => {
    const progress = initialBuildProgress('run-1', 500);

    expect(progress.phase).toBe('scaffolding');
    expect(progress.tasks).toEqual([]);
    expect(progress.direction).toBe('');
    expect(progress.startedAt).toBe(500);
    expect(progress.run?.startedAt).toBe(500);
  });

  it('is a no-op on build.scaffolding and on any event it does not know', () => {
    const progress = initialBuildProgress('run-1', 500);

    expect(reduceBuildProgress(progress, event(600, { type: 'build.scaffolding' }))).toBe(progress);
    expect(reduceBuildProgress(progress, event(600, { type: 'skills.resolving' }))).toBe(progress);
  });

  it('feeds the running step its own rows and keeps the reference when nothing moves', () => {
    const progress = initialBuildProgress('run-1', 500);
    const moved = reduceBuildProgress(
      progress,
      event(700, { type: 'context.ready', fragmentCount: 2, totalTokens: 10 }),
    );

    expect(moved).not.toBe(progress);
    expect(moved.run?.stages[0]?.status).toBe('done');
    // plan.proposing never moves a row: the same reference comes back.
    expect(reduceBuildProgress(moved, event(800, { type: 'plan.proposing' }))).toBe(moved);
  });

  it('lists the sections in order once the skeleton is down', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [planned()]);

    expect(progress.phase).toBe('planned');
    expect(progress.direction).toBe(DIRECTION);
    expect(progress.run).toBeNull();
    expect(progress.tasks.map((task) => [task.position, task.title, task.status])).toEqual([
      [1, 'Hero', 'waiting'],
      [2, 'Proof', 'waiting'],
      [3, 'Pricing', 'waiting'],
    ]);
  });

  it('advances one row at a time, measuring each section from the events', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      planned(1_000),
      started(1, 1_100),
      completed(1, 4_100),
      started(2, 4_200),
    ]);

    expect(progress.phase).toBe('building');
    expect(progress.applied).toBe(1);
    expect(progress.tasks[0]?.status).toBe('applied');
    expect(progress.tasks[0]?.elapsedMs).toBe(3_000);
    expect(progress.tasks[1]?.status).toBe('running');
    expect(progress.tasks[2]?.status).toBe('waiting');
    expect(progress.run?.startedAt).toBe(4_200);
  });

  it('keeps the first attempt as the section clock when the retry starts', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      planned(1_000),
      started(1, 1_100),
      started(1, 2_100, 2),
      completed(1, 3_100, 2),
    ]);

    expect(progress.tasks[0]?.attempts).toBe(2);
    expect(progress.tasks[0]?.elapsedMs).toBe(2_000);
  });

  it('records a skipped section with its reason and lets the next one run', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      planned(1_000),
      started(1, 1_100),
      skippedTask(1, 2_100, 'The provider refused twice.'),
      started(2, 2_200),
      completed(2, 3_200),
    ]);

    expect(progress.skipped).toBe(1);
    expect(progress.applied).toBe(1);
    expect(progress.tasks[0]?.status).toBe('skipped');
    expect(progress.tasks[0]?.reason).toBe('The provider refused twice.');
    expect(progress.tasks[1]?.status).toBe('applied');
  });

  it('marks a stop and leaves the sections it never reached waiting', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      planned(1_000),
      started(1, 1_100),
      completed(1, 2_100),
      event(2_200, { type: 'build.stopped', reason: 'signal' }),
    ]);

    expect(progress.phase).toBe('stopped');
    expect(progress.stopReason).toBe('signal');
    expect(progress.run).toBeNull();
    expect(progress.tasks.map((task) => task.status)).toEqual(['applied', 'waiting', 'waiting']);
  });

  it('reconciles every row against the final report', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      planned(1_000),
      started(1, 1_100),
      completed(1, 2_100),
      event(6_100, {
        type: 'build.completed',
        tasks: [
          report('applied', 0),
          report('skipped', 1, 'Twice refused.'),
          report('not-started', 2, 'The build was stopped before this section started.'),
        ],
        applied: 1,
        skipped: 1,
        elapsedMs: 5_600,
        outcome: 'completed',
      }),
    ]);

    expect(progress.phase).toBe('completed');
    expect(progress.applied).toBe(1);
    expect(progress.skipped).toBe(1);
    expect(progress.elapsedMs).toBe(5_600);
    expect(progress.run).toBeNull();
    expect(progress.tasks.map((task) => task.status)).toEqual(['applied', 'skipped', 'waiting']);
    expect(progress.tasks[1]?.reason).toBe('Twice refused.');
  });

  it('keeps a stopped build stopped when its completion arrives', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      planned(1_000),
      event(1_100, { type: 'build.stopped', reason: 'signal' }),
      event(1_200, {
        type: 'build.completed',
        tasks: [report('not-started', 0), report('not-started', 1), report('not-started', 2)],
        applied: 0,
        skipped: 0,
        elapsedMs: 700,
        outcome: 'signal',
      }),
    ]);

    expect(progress.phase).toBe('stopped');
  });

  it('records the fallback and shows nothing build-shaped after it', () => {
    const progress = feed(initialBuildProgress('run-1', 500), [
      event(900, { type: 'build.skipped', reason: 'The page skeleton produced 1 section.' }),
    ]);

    expect(progress.phase).toBe('fallback');
    expect(progress.fallbackReason).toBe('The page skeleton produced 1 section.');
    expect(progress.tasks).toEqual([]);
    expect(progress.run).toBeNull();
    // The fallback's own run must not reopen a build row.
    expect(reduceBuildProgress(progress, event(950, { type: 'plan.proposing' }))).toBe(progress);
  });
});

describe('buildReceipt', () => {
  it('says how many sections landed, in how long, and which were skipped', () => {
    const progress = feed(initialBuildProgress('run-1', 0), [
      planned(1_000),
      started(1, 1_100),
      completed(1, 2_100),
      started(2, 2_200),
      skippedTask(2, 3_200, 'Twice refused.'),
      event(3_300, {
        type: 'build.completed',
        tasks: [
          report('applied', 0),
          report('skipped', 1, 'Twice refused.'),
          report('not-started', 2, 'stopped'),
        ],
        applied: 1,
        skipped: 1,
        elapsedMs: 372_000,
        outcome: 'completed',
      }),
    ]);

    const receipt = buildReceipt(progress, 400_000);

    expect(receipt).not.toBeNull();
    expect(receipt?.applied).toBe(1);
    expect(receipt?.total).toBe(3);
    expect(receipt?.elapsed).toBe('06:12');
    expect(receipt?.notStarted).toBe(1);
    expect(receipt?.skipped).toEqual([{ position: 2, title: 'Proof', reason: 'Twice refused.' }]);
  });

  it('falls back to the caller-supplied ending when the build never completed', () => {
    const progress = feed(initialBuildProgress('run-1', 1_000), [
      planned(1_500),
      started(1, 2_000),
    ]);

    expect(buildReceipt(progress, 4_000)?.elapsed).toBe('00:03');
    expect(buildReceipt(progress, Number.NaN)).toBeNull();
  });

  it('measures a revived build to the last moment there is evidence for', () => {
    const progress = feed(initialBuildProgress('run-1', 1_000), [
      planned(1_500),
      started(1, 9_000),
    ]);

    expect(lastEvidenceAt(progress)).toBe(9_000);
    expect(buildReceipt(progress, lastEvidenceAt(progress))?.elapsed).toBe('00:08');
  });
});

describe('buildEta', () => {
  it('estimates from the sections already measured', () => {
    const progress = feed(initialBuildProgress('run-1', 0), [
      planned(0),
      started(1, 0),
      completed(1, 60_000),
      started(2, 60_000),
    ]);

    // One minute measured, two sections left.
    expect(buildEta(progress)).toBe('~2 min left');
  });

  it('says nothing before the first section lands, or once none are left', () => {
    const opened = feed(initialBuildProgress('run-1', 0), [planned(0), started(1, 0)]);
    expect(buildEta(opened)).toBeNull();

    const finished = feed(initialBuildProgress('run-1', 0), [
      planned(0),
      started(1, 0),
      completed(1, 1_000),
      started(2, 1_000),
      completed(2, 2_000),
      started(3, 2_000),
      completed(3, 3_000),
    ]);
    expect(buildEta(finished)).toBeNull();
  });

  it('counts in seconds while the remainder is short', () => {
    const progress = feed(initialBuildProgress('run-1', 0), [
      planned(0),
      started(1, 0),
      completed(1, 10_000),
      started(2, 10_000),
    ]);

    expect(buildEta(progress)).toBe('~20s left');
  });
});

describe('taskTransactionLabel', () => {
  it('reproduces the orchestrator label a person can undo by', () => {
    expect(taskTransactionLabel(3, 10, 'Pricing')).toBe('Assistant: 3/10 — Pricing');
    expect(taskTransactionLabel(1, 2, 'x'.repeat(400))).toHaveLength(160);
  });
});
