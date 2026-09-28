import { describe, expect, it } from 'vitest';

import type { AiBuildEvent, AiBuildTask, AiBuildTaskReport, AiRunFailure } from '@craftkit/builder';

import {
  blockingTask,
  buildReceipt,
  initialBuildProgress,
  landedCount,
  lastEvidenceAt,
  reduceBuildProgress,
  withWriters,
  writingCount,
  type BuildProgress,
} from './build-progress';

const BUILD = 'b1';
const TASKS: readonly AiBuildTask[] = [
  { id: 'r1', title: 'Header' },
  { id: 'r2', title: 'Hero' },
  { id: 'r3', title: 'Services' },
  { id: 'r4', title: 'Why us' },
];
const DIRECTION = 'Calm, clinical, teal.';
const LANDING = (index: number) => ({
  transactionId: `tx-${String(index + 1)}`,
  label: `Assistant: ${String(index + 1)}/${String(TASKS.length)} — ${TASKS[index]?.title ?? ''}`,
  before: { tree: null },
  after: { tree: { type: 'section' } },
});

let seq = 0;

/** One event, stamped the way the orchestrator (or a step) stamps its own. */
function event(at: number, payload: Record<string, unknown>, runId = BUILD): AiBuildEvent {
  seq += 1;
  return { runId, seq, at, ...payload } as unknown as AiBuildEvent;
}

function feed(progress: BuildProgress, events: readonly AiBuildEvent[]): BuildProgress {
  return events.reduce(reduceBuildProgress, progress);
}

const planned = (at = 1_000, extra: Record<string, unknown> = {}) =>
  event(at, { type: 'build.planned', direction: DIRECTION, tasks: TASKS, ...extra });
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
const skipped = (position: number, at: number, reason: string, attempts = 2) =>
  event(at, {
    type: 'task.skipped',
    position,
    total: TASKS.length,
    task: TASKS[position - 1],
    attempts,
    reason,
  });
/** A writer finished its draft: `fill-N` proposes, it does not land (run-agent.ts:292). */
const drafted = (position: number, at: number) =>
  event(at, { type: 'run.completed', status: 'proposed' }, `${BUILD}/fill-${String(position)}`);
const writerFailed = (position: number, at: number, error: AiRunFailure) =>
  event(at, { type: 'run.failed', error }, `${BUILD}/fill-${String(position)}`);

function report(
  status: AiBuildTaskReport['status'],
  index: number,
  extra: Partial<AiBuildTaskReport> = {},
): AiBuildTaskReport {
  const task = TASKS[index];
  return {
    id: task?.id ?? '',
    title: task?.title ?? '',
    status,
    attempts: status === 'not-started' ? 0 : 1,
    ...(status === 'applied' ? { landing: LANDING(index) } : {}),
    ...extra,
  };
}

const statuses = (progress: BuildProgress) => progress.tasks.map((task) => task.status);

describe('reduceBuildProgress: the skeleton and the list', () => {
  it('opens on the skeleton, with no tasks, no report and no pool size', () => {
    const progress = initialBuildProgress(BUILD, 500);

    expect(progress.phase).toBe('scaffolding');
    expect(progress.tasks).toEqual([]);
    expect(progress.report).toBeNull();
    expect(progress.writers).toBeNull();
    expect(progress.skeleton?.startedAt).toBe(500);
  });

  it('feeds the skeleton step its own rows, attributed by run id', () => {
    const progress = initialBuildProgress(BUILD, 500);
    const moved = reduceBuildProgress(
      progress,
      event(700, { type: 'context.ready', fragmentCount: 2, totalTokens: 10 }, `${BUILD}/scaffold`),
    );

    expect(moved.skeleton?.stages[0]?.status).toBe('done');
    // A step of another build, or the build's fallback run, never moves this record.
    for (const foreign of [
      event(710, { type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 'b2/scaffold'),
      event(720, { type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, `${BUILD}/fallback`),
      event(730, { type: 'plan.progress', text: 'narration' }, `${BUILD}/scaffold`),
    ]) {
      expect(reduceBuildProgress(moved, foreign)).toBe(moved);
    }
  });

  it('lists the sections in page order once the skeleton is down', () => {
    const progress = feed(initialBuildProgress(BUILD, 500), [planned()]);

    expect(progress.phase).toBe('planned');
    expect(progress.direction).toBe(DIRECTION);
    expect(progress.tasks.map((task) => [task.position, task.id, task.title, task.status])).toEqual(
      [
        [1, 'r1', 'Header', 'waiting'],
        [2, 'r2', 'Hero', 'waiting'],
        [3, 'r3', 'Services', 'waiting'],
        [4, 'r4', 'Why us', 'waiting'],
      ],
    );
  });

  it('reads the writer pool size from build.planned when the engine sends it (E1)', () => {
    expect(feed(initialBuildProgress(BUILD, 0), [planned(0)]).writers).toBeNull();
    expect(feed(initialBuildProgress(BUILD, 0), [planned(0, { writers: 3 })]).writers).toBe(3);
    expect(feed(initialBuildProgress(BUILD, 0), [planned(0, { writers: 'x' })]).writers).toBeNull();
    const known = withWriters(feed(initialBuildProgress(BUILD, 0), [planned(0)]), 5);
    expect(known.writers).toBe(5);
    expect(withWriters(known, 5)).toBe(known);
  });

  it('records the fallback and shows nothing build-shaped after it', () => {
    const progress = feed(initialBuildProgress(BUILD, 500), [
      event(900, { type: 'build.skipped', reason: 'The page skeleton produced 1 section.' }),
    ]);

    expect(progress.phase).toBe('fallback');
    expect(progress.fallbackReason).toBe('The page skeleton produced 1 section.');
    expect(progress.skeleton).toBeNull();
    expect(
      reduceBuildProgress(progress, event(950, { type: 'plan.proposing' }, `${BUILD}/fallback`)),
    ).toBe(progress);
  });
});

describe('reduceBuildProgress: parallel writers', () => {
  it('runs several writers at once; the count is landed sections only', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 10),
      started(2, 10),
      started(3, 10),
      drafted(1, 40),
      completed(1, 41),
      started(4, 41),
    ]);

    expect(statuses(progress)).toEqual(['landed', 'writing', 'writing', 'writing']);
    expect(landedCount(progress)).toBe(1);
    expect(writingCount(progress)).toBe(3);
    expect(progress.phase).toBe('building');
  });

  it("marks a writer's finished draft as drafted, and never counts it as landed", () => {
    // SPEC §6.5: run.completed {proposed} arrives before task.completed.
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 10),
      started(2, 10),
      drafted(2, 30),
    ]);

    expect(statuses(progress)).toEqual(['writing', 'drafted', 'waiting', 'waiting']);
    expect(landedCount(progress)).toBe(0);
    expect(progress.tasks[1]?.draftedAt).toBe(30);
  });

  it('keeps the first attempt as the section clock and the latest as the write clock', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 100),
      drafted(1, 900),
      // The target guard refused that draft: the same writer starts again.
      started(1, 900, 2),
    ]);
    const task = progress.tasks[0];

    expect(task?.status).toBe('writing');
    expect(task?.attempts).toBe(2);
    expect(task?.startedAt).toBe(100);
    expect(task?.attemptStartedAt).toBe(900);
    expect(task?.draftedAt).toBeUndefined();

    const landed = feed(progress, [drafted(1, 1_400), completed(1, 1_500, 2)]);
    expect(landed.tasks[0]?.elapsedMs).toBe(1_400);
    expect(landed.tasks[0]?.draftedAt).toBe(1_400);
  });

  it("keeps the writer's own failure as evidence and records the skip reason", () => {
    const busy: AiRunFailure = {
      source: 'provider',
      code: 'http-status',
      message: 'The assistant server answered with status 429.',
      retryable: true,
      status: 429,
    };
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 10),
      writerFailed(1, 20, busy),
      started(1, 20, 2),
      writerFailed(1, 30, busy),
      skipped(1, 31, busy.message),
    ]);

    expect(progress.tasks[0]?.status).toBe('failed');
    expect(progress.tasks[0]?.reason).toBe(busy.message);
    expect(progress.tasks[0]?.failure?.status).toBe(429);
    expect(landedCount(progress)).toBe(0);
  });

  it('ignores a draft for a section that is not being written', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [planned(0), started(1, 10)]);

    expect(reduceBuildProgress(progress, drafted(2, 20))).toBe(progress);
    expect(reduceBuildProgress(progress, drafted(9, 20))).toBe(progress);
    expect(
      reduceBuildProgress(
        progress,
        event(20, { type: 'run.completed', status: 'proposed' }, `${BUILD}/fill-x`),
      ),
    ).toBe(progress);
  });

  it('names the one section the drafted ones below are waiting on', () => {
    const blocked = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 0),
      completed(1, 10),
      started(2, 10),
      started(3, 10),
      started(4, 10),
      drafted(3, 20),
      drafted(4, 30),
    ]);
    expect(blockingTask(blocked)?.title).toBe('Hero');

    // Two writers still going is progress, not a block.
    const twoWriting = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 0),
      started(2, 0),
      started(3, 0),
      drafted(3, 5),
    ]);
    expect(blockingTask(twoWriting)).toBeNull();
    // A draft ABOVE the writer is not waiting on it.
    const above = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      started(1, 0),
      started(2, 0),
      drafted(1, 5),
    ]);
    expect(blockingTask(above)).toBeNull();
  });
});

describe('reduceBuildProgress: endings', () => {
  it('marks a stop and leaves the unreached sections waiting until the report', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(1_000),
      started(1, 1_100),
      completed(1, 2_100),
      event(2_200, { type: 'build.stopped', reason: 'signal' }),
    ]);

    expect(progress.phase).toBe('stopped');
    expect(progress.stopReason).toBe('signal');
    expect(progress.report).toBeNull();
    expect(statuses(progress)).toEqual(['landed', 'waiting', 'waiting', 'waiting']);
  });

  it('reconciles every row against build.completed and keeps each landing record', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(1_000),
      started(1, 1_100),
      started(2, 1_100),
      completed(1, 2_100),
      skipped(2, 2_200, 'Section "Hero" exceeded its 240000ms budget.'),
      event(2_300, { type: 'build.stopped', reason: 'budget' }),
      event(6_100, {
        type: 'build.completed',
        tasks: [
          report('applied', 0),
          report('skipped', 1, {
            reason: 'Section "Hero" exceeded its 240000ms budget.',
            outOfScope: [{ command: 'setProp', reason: 'x' }],
          }),
          report('not-started', 2, {
            reason: 'The build budget ran out before this section started.',
          }),
          report('not-started', 3, {
            reason: 'The build budget ran out before this section started.',
          }),
        ],
        applied: 1,
        skipped: 1,
        elapsedMs: 5_600,
        outcome: 'budget',
      }),
    ]);

    expect(progress.phase).toBe('stopped');
    expect(progress.report).toEqual({
      applied: 1,
      skipped: 1,
      elapsedMs: 5_600,
      outcome: 'budget',
    });
    expect(statuses(progress)).toEqual(['landed', 'failed', 'notWritten', 'notWritten']);
    expect(progress.tasks[0]?.landing?.transactionId).toBe('tx-1');
    expect(progress.tasks[1]?.outOfScope).toBe(1);
    expect(progress.tasks[1]?.landing).toBeUndefined();
  });

  it('keeps the engine’s reason code and the plan’s facts for each section (E4, E5)', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(1_000),
      started(1, 1_100),
      started(2, 1_100),
      completed(1, 2_100),
      event(2_200, {
        type: 'task.skipped',
        position: 2,
        total: TASKS.length,
        task: TASKS[1],
        attempts: 2,
        reason: 'Section "Hero" exceeded its 240000ms budget.',
        reasonCode: 'timeout',
      }),
    ]);
    // The live skip already carries its code, before the report.
    expect(progress.tasks[1]?.reasonCode).toBe('timeout');

    const settled = feed(progress, [
      event(6_100, {
        type: 'build.completed',
        tasks: [
          report('applied', 0, {
            sectionKey: 'header',
            facts: [{ key: 'phone', sample: '+962 79 000 0000' }],
          }),
          report('skipped', 1, {
            reason: 'Section "Hero" exceeded its 240000ms budget.',
            reasonCode: 'timeout',
          }),
          report('not-started', 2, {
            reason: 'The build was stopped before this section started.',
            reasonCode: 'stopped',
          }),
          report('not-started', 3, {
            reason: 'The build was stopped before this section started.',
            reasonCode: 'stopped',
          }),
        ],
        applied: 1,
        skipped: 1,
        elapsedMs: 5_000,
        outcome: 'signal',
      }),
    ]);
    expect(settled.tasks[0]).toMatchObject({
      sectionKey: 'header',
      facts: [{ key: 'phone', sample: '+962 79 000 0000' }],
    });
    expect(settled.tasks.map((task) => task.reasonCode)).toEqual([
      undefined,
      'timeout',
      'stopped',
      'stopped',
    ]);
    // The receipt classifies by the code, the engine's own words for why.
    expect(buildReceipt(settled, 6_100)?.failed).toEqual([
      { position: 2, title: 'Hero', failure: 'timeout' },
    ]);
  });

  it('completes an unstopped build', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(0),
      event(10, {
        type: 'build.completed',
        tasks: TASKS.map((_task, index) => report('applied', index)),
        applied: 4,
        skipped: 0,
        elapsedMs: 10,
        outcome: 'completed',
      }),
    ]);

    expect(progress.phase).toBe('completed');
    expect(landedCount(progress)).toBe(4);
  });
});

describe('lastEvidenceAt and buildReceipt', () => {
  it('measures a revived build to the last moment there is evidence for', () => {
    const progress = feed(initialBuildProgress(BUILD, 1_000), [
      planned(1_500),
      started(1, 9_000),
      drafted(1, 12_000),
    ]);

    expect(lastEvidenceAt(progress)).toBe(12_000);
  });

  it('counts landed sections, never settled ones, and classifies the failures', () => {
    const progress = feed(initialBuildProgress(BUILD, 0), [
      planned(1_000),
      started(1, 1_100),
      started(2, 1_100),
      completed(1, 2_100),
      skipped(2, 3_200, 'Section "Hero" exceeded its 240000ms budget.'),
      event(3_300, {
        type: 'build.completed',
        tasks: [
          report('applied', 0),
          report('skipped', 1, { reason: 'Section "Hero" exceeded its 240000ms budget.' }),
          report('not-started', 2),
          report('not-started', 3),
        ],
        applied: 1,
        skipped: 1,
        elapsedMs: 141_000,
        outcome: 'completed',
      }),
    ]);

    expect(buildReceipt(progress, 999_999)).toEqual({
      landed: 1,
      total: 4,
      elapsedMs: 141_000,
      stopped: false,
      failed: [{ position: 2, title: 'Hero', failure: 'timeout' }],
      notWritten: 2,
    });
  });

  it('falls back to the caller ending, and says nothing without a usable clock', () => {
    const progress = feed(initialBuildProgress(BUILD, 1_000), [planned(1_500), started(1, 2_000)]);

    expect(buildReceipt(progress, 4_000)?.elapsedMs).toBe(3_000);
    expect(buildReceipt(progress, Number.NaN)).toBeNull();
  });
});

/* ── Property: engine-consistent event orders (SPEC §6.5) ───────────────────── */

/** mulberry32: a tiny seeded PRNG, so every failing seed replays exactly. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Stamped {
  readonly at: number;
  readonly order: number;
  readonly payload: Record<string, unknown>;
  readonly runId: string;
}

/**
 * A build the way `runAiBuild` runs it: W writers take sections in page order, each
 * attempt drafts or fails (a drafted attempt may still be refused by the target guard
 * and retried), and the lander settles sections strictly in page order, each only once
 * the one above has settled. Events come out in time order, causes before effects.
 */
function simulate(seed: number): { tasks: AiBuildTask[]; events: AiBuildEvent[] } {
  const next = random(seed);
  const count = 2 + Math.floor(next() * 11);
  const writers = 1 + Math.floor(next() * Math.min(6, count));
  const tasks = Array.from({ length: count }, (_unused, index) => ({
    id: `n${String(index + 1)}`,
    title: `Section ${String(index + 1)}`,
  }));
  const out: Stamped[] = [];
  let order = 0;
  const push = (at: number, payload: Record<string, unknown>, runId = BUILD) => {
    out.push({ at, order, payload, runId });
    order += 1;
  };
  push(0, { type: 'build.planned', direction: 'd', tasks });

  const free = Array.from({ length: writers }, () => 0);
  const ready: { at: number; ok: boolean; attempts: number }[] = [];
  for (const [index, task] of tasks.entries()) {
    const position = index + 1;
    const writer = free.indexOf(Math.min(...free));
    let at = free[writer] ?? 0;
    let ok = false;
    let attempts = 0;
    for (const attempt of [1, 2] as const) {
      attempts = attempt;
      push(at, { type: 'task.started', position, total: count, task, attempt });
      at += 1 + Math.floor(next() * 50);
      const roll = next();
      const fill = `${BUILD}/fill-${String(position)}`;
      if (roll < 0.7) {
        push(at, { type: 'run.completed', status: 'proposed' }, fill);
        ok = true;
        break;
      }
      if (roll < 0.85) {
        // Drafted, then the guard found nothing inside the region: a failed attempt.
        push(at, { type: 'run.completed', status: 'proposed' }, fill);
      } else {
        push(
          at,
          {
            type: 'run.failed',
            error: { source: 'provider', code: 'timeout', message: 't', retryable: true },
          },
          fill,
        );
      }
    }
    free[writer] = at;
    ready.push({ at, ok, attempts });
  }

  let landedAt = 0;
  const reports: AiBuildTaskReport[] = [];
  for (const [index, task] of tasks.entries()) {
    const slot = ready[index];
    if (slot === undefined) continue;
    landedAt = Math.max(landedAt, slot.at);
    const common = { position: index + 1, total: count, task, attempts: slot.attempts };
    if (slot.ok && next() < 0.9) {
      push(landedAt, { type: 'task.completed', ...common });
      reports.push({ ...task, status: 'applied', attempts: slot.attempts });
    } else {
      push(landedAt, { type: 'task.skipped', ...common, reason: 'refused' });
      reports.push({ ...task, status: 'skipped', attempts: slot.attempts, reason: 'refused' });
    }
  }
  push(landedAt, {
    type: 'build.completed',
    tasks: reports,
    applied: reports.filter((entry) => entry.status === 'applied').length,
    skipped: reports.filter((entry) => entry.status === 'skipped').length,
    elapsedMs: landedAt,
    outcome: 'completed',
  });

  out.sort((a, b) => a.at - b.at || a.order - b.order);
  let stamp = 0;
  return {
    tasks,
    events: out.map(({ at, payload, runId }) => {
      stamp += 1;
      return { runId, seq: stamp, at, ...payload } as unknown as AiBuildEvent;
    }),
  };
}

describe('reduceBuildProgress over engine-consistent orders (property)', () => {
  it('inks only after task.completed, as a page-order prefix, and never counts a draft', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { events } = simulate(seed);
      let progress = initialBuildProgress(BUILD, 0);
      const landedIds = new Set<string>();
      for (const next of events) {
        if (next.type === 'task.completed') landedIds.add(next.task.id);
        progress = reduceBuildProgress(progress, next);

        const context = `seed ${String(seed)}, after ${next.type}#${String(next.seq)}`;
        // "On the page" only after task.completed, and every task.completed is ink.
        for (const task of progress.tasks) {
          expect(task.status === 'landed', context).toBe(landedIds.has(task.id));
        }
        expect(landedCount(progress), context).toBe(landedIds.size);
        // Settled rows (landed or failed) are always a prefix of the list.
        const settled = progress.tasks.map(
          (task) => task.status === 'landed' || task.status === 'failed',
        );
        const firstOpen = settled.indexOf(false);
        if (firstOpen !== -1) {
          expect(settled.slice(firstOpen).includes(true), context).toBe(false);
        }
      }
      expect(progress.report, `seed ${String(seed)}`).not.toBeNull();
    }
  });
});
