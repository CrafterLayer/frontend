import { describe, expect, it } from 'vitest';

import type {
  AiAgentEvent,
  AiBuildEvent,
  AiBuildTask,
  AiBuildTaskReport,
  AiRunFailure,
} from '@craftkit/builder';

import { initialBuildProgress, reduceBuildProgress, type BuildProgress } from './build-progress';
import { initialRunProgress, reduceRunProgress, type RunProgress } from './run-progress';
import {
  answerRecordView,
  buildRecordInputOf,
  buildRecordView,
  editRecordView,
  errorRecordInputOf,
  errorRecordView,
  type BuildRecordInput,
  type RunViewContext,
} from './run-view';
import type { AgentCapabilities, BuildRecordView, RowState } from './view-types';

/* ── Fixtures ─────────────────────────────────────────────────────────────────── */

const BUILD = 'b1';
const TASKS: readonly AiBuildTask[] = [
  { id: 'n1', title: 'Header' },
  { id: 'n2', title: 'Hero' },
  { id: 'n3', title: 'Services' },
  { id: 'n4', title: 'Why us' },
];
const TOTAL = TASKS.length;
const TIMEOUT = 'Section "Services" exceeded its 240000ms budget.';

const EVERYTHING: AgentCapabilities = {
  rowUndo: true,
  undoBuild: true,
  restore: true,
  facts: true,
  failureClasses: true,
  editablePlan: true,
  structuredDirection: true,
  estimate: true,
  canvasStage: true,
};
const NOTHING: AgentCapabilities = {
  rowUndo: false,
  undoBuild: false,
  restore: false,
  facts: false,
  failureClasses: false,
  editablePlan: false,
  structuredDirection: false,
  estimate: false,
  canvasStage: false,
};
const CONTEXT: RunViewContext = { now: 500_000, capabilities: EVERYTHING, developer: false };

let seq = 0;
function event(at: number, payload: Record<string, unknown>, runId = BUILD): AiBuildEvent {
  seq += 1;
  return { runId, seq, at, ...payload } as unknown as AiBuildEvent;
}
const planned = (writers?: number) =>
  event(1_000, {
    type: 'build.planned',
    direction: 'Calm,\n clinical,   teal.',
    tasks: TASKS,
    ...(writers === undefined ? {} : { writers }),
  });
const task = (position: number) => TASKS[position - 1];
const started = (position: number, at: number, attempt: 1 | 2 = 1) =>
  event(at, { type: 'task.started', position, total: TOTAL, task: task(position), attempt });
const drafted = (position: number, at: number) =>
  event(at, { type: 'run.completed', status: 'proposed' }, `${BUILD}/fill-${String(position)}`);
const completed = (position: number, at: number) =>
  event(at, { type: 'task.completed', position, total: TOTAL, task: task(position), attempts: 1 });
const skipped = (position: number, at: number, reason: string) =>
  event(at, {
    type: 'task.skipped',
    position,
    total: TOTAL,
    task: task(position),
    attempts: 2,
    reason,
  });
const stoppedBy = (reason: 'signal' | 'budget' | 'max-tasks', at: number) =>
  event(at, { type: 'build.stopped', reason });

function report(status: AiBuildTaskReport['status'], index: number, reason?: string) {
  const entry = TASKS[index];
  return {
    id: entry?.id ?? '',
    title: entry?.title ?? '',
    status,
    attempts: status === 'not-started' ? 0 : 1,
    ...(reason === undefined ? {} : { reason }),
    ...(status === 'applied'
      ? {
          landing: {
            transactionId: `tx-${String(index + 1)}`,
            label: 'x',
            before: {},
            after: {},
          },
        }
      : {}),
  } satisfies AiBuildTaskReport;
}

function completion(
  at: number,
  tasks: readonly AiBuildTaskReport[],
  outcome: 'completed' | 'signal' | 'budget' | 'max-tasks' = 'completed',
) {
  return event(at, {
    type: 'build.completed',
    tasks,
    applied: tasks.filter((entry) => entry.status === 'applied').length,
    skipped: tasks.filter((entry) => entry.status === 'skipped').length,
    elapsedMs: 141_000,
    outcome,
  });
}

function progressOf(events: readonly AiBuildEvent[]): BuildProgress {
  return events.reduce(reduceBuildProgress, initialBuildProgress(BUILD, 0));
}

/** Four sections landed in order, reported, with landing records. */
function builtAll(): BuildProgress {
  return progressOf([
    planned(),
    ...TASKS.flatMap((_entry, index) => [
      started(index + 1, 2_000 * (index + 1)),
      drafted(index + 1, 2_000 * (index + 1) + 1_500),
      completed(index + 1, 2_000 * (index + 1) + 1_600),
    ]),
    completion(
      20_000,
      TASKS.map((_entry, index) => report('applied', index)),
    ),
  ]);
}

function input(progress: BuildProgress, extra: Partial<BuildRecordInput> = {}): BuildRecordInput {
  return { turnId: 't1', progress, revived: false, stopping: false, ...extra };
}

function view(progress: BuildProgress, extra: Partial<BuildRecordInput> = {}, context = CONTEXT) {
  const result = buildRecordView(input(progress, extra), context);
  if (result === null) throw new Error('expected a build record');
  return result;
}

const states = (record: BuildRecordView): RowState[] => record.rows.map((row) => row.state);

/* ── Phases (SPEC §4.8 phase table) ───────────────────────────────────────────── */

describe('buildRecordView: phases', () => {
  it('skeleton: no rows, no count, no clock, no footer', () => {
    const record = view(initialBuildProgress(BUILD, 0));

    expect(record.phase).toBe('skeleton');
    expect(record.rows).toEqual([]);
    expect(record.total).toBe(0);
    expect(record.elapsedMs).toBeUndefined();
    expect(record.menu).toEqual([]);
    expect(record.direction).toBeUndefined();
  });

  it('a Stop during the skeleton stays the skeleton: no sections, so never a 0/0 count', () => {
    // `stopping` shows the count in its head (SPEC §4.8), and before build.planned there is
    // no list to count. The RunBar carries "Stopping"; the record waits for the end.
    const record = view(initialBuildProgress(BUILD, 0), { stopping: true });
    expect(record.phase).toBe('skeleton');
    expect(record.total).toBe(0);

    const confirmed = progressOf([stoppedBy('signal', 900)]);
    expect(view(confirmed).phase).toBe('skeleton');
  });

  it('building: every live row state, and the count is landed sections only', () => {
    const record = view(
      progressOf([
        planned(),
        started(1, 2_000),
        started(2, 2_000),
        started(3, 2_000),
        drafted(1, 3_000),
        completed(1, 3_100),
        drafted(3, 3_200),
        started(2, 3_300, 2),
      ]),
    );

    expect(record.phase).toBe('building');
    expect(states(record)).toEqual(['landed', 'retrying', 'drafted', 'waiting']);
    expect(record.landed).toBe(1);
    expect(record.total).toBe(4);
    // One clock per run: the RunBar owns it while live.
    expect(record.elapsedMs).toBeUndefined();
    expect(record.actions).toEqual({
      undoBuild: false,
      redoBuild: false,
      finishRest: 0,
      removeEmpty: 0,
      retryFailed: 0,
    });
    expect(record.menu).toEqual([]);
  });

  it('never counts a drafted section as landed (SPEC §6.5)', () => {
    const record = view(
      progressOf([planned(), started(1, 2_000), started(2, 2_000), drafted(2, 2_500)]),
    );

    expect(states(record)).toEqual(['writing', 'drafted', 'waiting', 'waiting']);
    expect(record.landed).toBe(0);
  });

  it('done only when build.completed.applied === total (SPEC §6.5)', () => {
    const record = view(builtAll(), { history: { undone: false, canUndo: true, canRedo: false } });

    expect(record.phase).toBe('done');
    expect(record.landed).toBe(4);
    expect(record.elapsedMs).toBe(141_000);
    expect(record.actions.undoBuild).toBe(true);
    expect(record.menu).toEqual(['reuse', 'copySummary']);
  });

  it('partial when anything short of every section landed, with Retry on each failed row', () => {
    const record = view(
      progressOf([
        planned(),
        started(1, 2_000),
        started(2, 2_000),
        started(3, 2_000),
        started(4, 2_000),
        completed(1, 3_000),
        completed(2, 3_100),
        skipped(3, 3_200, TIMEOUT),
        completed(4, 3_300),
        completion(4_000, [
          report('applied', 0),
          report('applied', 1),
          report('skipped', 2, TIMEOUT),
          report('applied', 3),
        ]),
      ]),
      { history: { undone: false, canUndo: true, canRedo: false } },
    );

    expect(record.phase).toBe('partial');
    expect(record.landed).toBe(3);
    const failed = record.rows[2];
    expect(failed?.state).toBe('failed');
    expect(failed?.reason).toBe('timeout');
    expect(failed?.canRetry).toBe(true);
    expect(record.actions).toMatchObject({ retryFailed: 1, undoBuild: true, finishRest: 0 });
  });

  it('failed when every section failed: one ErrorRecord body, the skeleton still on the page', () => {
    const reason = 'The assistant server answered with status 429.';
    const record = view(
      progressOf([
        planned(),
        ...TASKS.map((_entry, index) => skipped(index + 1, 3_000 + index, reason)),
        completion(
          5_000,
          TASKS.map((_entry, index) => report('skipped', index, reason)),
        ),
      ]),
    );

    expect(record.phase).toBe('failed');
    expect(record.landed).toBe(0);
    expect(record.error).toMatchObject({
      failure: 'busy',
      pageState: { kind: 'skeleton' },
      retryable: true,
    });
    expect(record.error?.details).toContain('status 429');
    expect(record.menu).toEqual(['reuse', 'copyError']);
  });

  it('failed when the run itself threw: the page state names what landed first', () => {
    const failure: AiRunFailure = {
      source: 'provider',
      code: 'network',
      message: 'The assistant server could not be reached: Failed to fetch',
      retryable: true,
    };
    const beforeList = view(initialBuildProgress(BUILD, 0), { failure: { failure, at: 31_000 } });
    expect(beforeList.phase).toBe('failed');
    expect(beforeList.error).toMatchObject({
      failure: 'unreachable',
      pageState: { kind: 'unchanged' },
      retryable: true,
    });
    expect(beforeList.elapsedMs).toBe(31_000);

    const offline = view(initialBuildProgress(BUILD, 0), {
      failure: { failure, at: 1_000, offline: true },
    });
    expect(offline.error?.failure).toBe('offline');

    const afterOne = view(
      progressOf([planned(), started(1, 2_000), completed(1, 3_000), started(2, 3_000)]),
      { failure: { failure, at: 9_000 } },
    );
    expect(afterOne.error?.pageState).toEqual({ kind: 'kept', landed: 1 });
    expect(states(afterOne)).toEqual(['landed', 'notWritten', 'notWritten', 'notWritten']);
  });

  it('stopping holds until the build reports its end, then stopped by its reason', () => {
    const live = progressOf([planned(), started(1, 2_000), completed(1, 3_000), started(2, 3_000)]);
    expect(view(live, { stopping: true }).phase).toBe('stopping');
    // build.stopped {signal} arrives before build.completed: still stopping.
    const confirmed = reduceBuildProgress(live, stoppedBy('signal', 3_500));
    expect(view(confirmed).phase).toBe('stopping');

    const ended = reduceBuildProgress(
      confirmed,
      completion(
        4_000,
        [
          report('applied', 0),
          report('not-started', 1),
          report('not-started', 2),
          report('not-started', 3),
        ],
        'signal',
      ),
    );
    const record = view(ended);
    expect(record.phase).toBe('stopped');
    expect(record.stopReason).toBe('signal');
    expect(states(record)).toEqual(['landed', 'notWritten', 'notWritten', 'notWritten']);
    expect(record.actions).toMatchObject({ finishRest: 3, removeEmpty: 3, undoBuild: false });
  });

  it('names the stop: budget and the section limit', () => {
    const reports = [
      report('applied', 0),
      report('applied', 1),
      report('not-started', 2),
      report('not-started', 3),
    ];
    const byBudget = view(
      progressOf([planned(), stoppedBy('budget', 2_000), completion(3_000, reports, 'budget')]),
    );
    const byLimit = view(
      progressOf([
        planned(),
        stoppedBy('max-tasks', 2_000),
        completion(3_000, reports, 'max-tasks'),
      ]),
    );

    expect([byBudget.phase, byBudget.stopReason]).toEqual(['stopped', 'budget']);
    expect([byLimit.phase, byLimit.stopReason]).toEqual(['stopped', 'maxTasks']);
  });

  it('keeps writing during a budget stop: sections in flight still land', () => {
    const record = view(progressOf([planned(), started(1, 2_000), stoppedBy('budget', 2_500)]));

    expect(record.phase).toBe('building');
    expect(states(record)).toEqual(['writing', 'waiting', 'waiting', 'waiting']);
  });

  it('interrupted by a reload: no clock, not-written rows, finishRest only when resumable', () => {
    const progress = progressOf([
      planned(),
      started(1, 2_000),
      completed(1, 3_000),
      started(2, 3_000),
    ]);

    const resumable = view(progress, { revived: true, resumable: true });
    expect(resumable.phase).toBe('interrupted');
    expect(resumable.revived).toBe(true);
    expect(resumable.elapsedMs).toBeUndefined();
    expect(states(resumable)).toEqual(['landed', 'notWritten', 'notWritten', 'notWritten']);
    expect(resumable.actions).toMatchObject({ finishRest: 3, removeEmpty: 3 });
    // Never a working Undo before build.completed.
    expect(resumable.rows[0]?.undo).toBeUndefined();

    const lost = view(progress, { revived: true, resumable: false });
    expect(lost.actions.finishRest).toBe(0);
    expect(lost.landed).toBeLessThan(lost.total);
  });

  it('undone: rows read undone, no node to reveal, Redo only while it is valid', () => {
    const record = view(builtAll(), { history: { undone: true, canUndo: false, canRedo: true } });

    expect(record.phase).toBe('undone');
    expect(record.landed).toBe(0);
    expect(states(record)).toEqual(['undone', 'undone', 'undone', 'undone']);
    expect(record.rows.every((row) => row.nodeId === undefined && row.undo === undefined)).toBe(
      true,
    );
    expect(record.actions).toMatchObject({ redoBuild: true, undoBuild: false });

    const stale = view(builtAll(), { history: { undone: true, canUndo: false, canRedo: false } });
    expect(stale.actions.redoBuild).toBe(false);
  });

  it('is not a build record after a fallback, or when it stopped before any section existed', () => {
    const fallback = progressOf([event(900, { type: 'build.skipped', reason: 'one section' })]);
    expect(buildRecordView(input(fallback), CONTEXT)).toBeNull();

    // Ask mode: the person said no to the list; nothing was ever written.
    const refused = progressOf([stoppedBy('signal', 900), completion(901, [], 'signal')]);
    expect(buildRecordView(input(refused), CONTEXT)).toBeNull();

    // Stop during the skeleton ends the run without a single build event after it.
    expect(
      buildRecordView(input(initialBuildProgress(BUILD, 0), { settled: true }), CONTEXT),
    ).toBeNull();
    expect(
      buildRecordView(input(initialBuildProgress(BUILD, 0), { revived: true }), CONTEXT),
    ).toBeNull();
  });
});

/* ── Rows: Undo, revived, reasons ─────────────────────────────────────────────── */

describe('buildRecordView: row actions', () => {
  it('offers row Undo only after build.completed, keyed by the landing transaction', () => {
    const beforeReport = view(
      progressOf([planned(), started(1, 2_000), completed(1, 3_000), started(2, 3_000)]),
    );
    expect(beforeReport.rows[0]?.undo).toBeUndefined();

    const record = view(builtAll());
    expect(record.rows.map((row) => row.undo)).toEqual([
      { kind: 'undo', transactionId: 'tx-1' },
      { kind: 'undo', transactionId: 'tx-2' },
      { kind: 'undo', transactionId: 'tx-3' },
      { kind: 'undo', transactionId: 'tx-4' },
    ]);
  });

  it('reads a v1 section’s outcome by the key it is stored under, and offers no dead Redo', () => {
    // v1 recorded no landing, so `outcomeKeyOf` keys the section by its id.
    const progress = progressOf([
      planned(),
      ...TASKS.flatMap((_entry, index) => [
        started(index + 1, 2_000 * (index + 1)),
        completed(index + 1, 2_000 * (index + 1) + 1_600),
      ]),
      completion(
        20_000,
        // v1 kept no landing record: the reports carry none.
        TASKS.map((entry) => ({
          id: entry.id,
          title: entry.title,
          status: 'applied' as const,
          attempts: 1,
        })),
      ),
    ]);
    const record = view(progress, {
      revived: true,
      outcomes: { 'v1-section:n2': { kind: 'undone' } },
    });
    expect(states(record)).toEqual(['landed', 'undone', 'landed', 'landed']);
    expect(record.rows[1]?.undo).toEqual({ kind: 'unavailable', why: 'revived' });
  });

  it('follows each section outcome by transaction id: undone, redone, refused', () => {
    const record = view(builtAll(), {
      outcomes: {
        'tx-2': { kind: 'undone', transactionId: 'tx-revert-2' },
        'tx-3': { kind: 'refused', why: 'changedSince' },
        'tx-4': { kind: 'redone', transactionId: 'tx-redo-4' },
      },
    });

    expect(states(record)).toEqual(['landed', 'undone', 'landed', 'landed']);
    expect(record.landed).toBe(3);
    expect(record.rows[1]?.undo).toEqual({ kind: 'redo', transactionId: 'tx-revert-2' });
    expect(record.rows[2]?.undo).toEqual({ kind: 'unavailable', why: 'changedSince' });
    expect(record.rows[3]?.undo).toEqual({ kind: 'undo', transactionId: 'tx-redo-4' });
  });

  it('never offers a working Undo on a revived record (SPEC §6.5)', () => {
    const record = view(builtAll(), {
      revived: true,
      history: { undone: false, canUndo: true, canRedo: false },
    });

    expect(record.revived).toBe(true);
    expect(record.phase).toBe('done');
    expect(record.rows.every((row) => row.undo?.kind === 'unavailable')).toBe(true);
    expect(record.rows[0]?.undo).toEqual({ kind: 'unavailable', why: 'revived' });
    expect(record.actions.undoBuild).toBe(false);
  });

  it('hides row Undo entirely without the engine support (capabilities.rowUndo = false)', () => {
    const record = view(
      builtAll(),
      {},
      { ...CONTEXT, capabilities: { ...EVERYTHING, rowUndo: false } },
    );

    expect(record.rows.every((row) => row.undo === undefined)).toBe(true);
  });

  it('classifies a refusal on landing and an out-of-scope writer, and never carries the raw text', () => {
    const outOfScope =
      'Section "Hero" wrote nothing inside its own region; 2 steps outside it were dropped.';
    const landing = 'The grouped plan was rejected by the kernel door: Node "n3" does not exist.';
    const record = view(
      progressOf([
        planned(),
        started(1, 2_000),
        started(2, 2_000),
        started(3, 2_000),
        completed(1, 3_000),
        skipped(2, 3_100, outOfScope),
        drafted(3, 3_200),
        skipped(3, 3_300, landing),
      ]),
    );

    expect(record.rows[1]?.reason).toBe('outOfScope');
    expect(record.rows[2]?.reason).toBe('pageChanged');
    expect(JSON.stringify(record)).not.toContain('kernel door');
    expect(JSON.stringify(record)).not.toContain('wrote nothing');
  });

  it('turns a section into text, not a button, once its placeholder was removed', () => {
    const stopped = progressOf([
      planned(),
      stoppedBy('signal', 2_000),
      completion(
        2_100,
        [
          report('applied', 0),
          report('not-started', 1),
          report('not-started', 2),
          report('not-started', 3),
        ],
        'signal',
      ),
    ]);
    const record = view(stopped, { placeholdersRemoved: true });

    expect(record.rows.map((row) => row.nodeId)).toEqual(['n1', undefined, undefined, undefined]);
    expect(record.actions).toMatchObject({ finishRest: 0, removeEmpty: 0 });
  });
});

/* ── Estimate, direction, facts, menu ─────────────────────────────────────────── */

describe('buildRecordView: the lines under the head', () => {
  const measured = () =>
    progressOf([
      planned(3),
      started(1, 0),
      drafted(1, 60_000),
      completed(1, 60_000),
      started(2, 60_000),
      drafted(2, 120_000),
      completed(2, 120_000),
      started(3, 120_000),
    ]);

  it('shows the estimate only with the capability and while building', () => {
    // d = 60s, 3 writers, read at the newest event (120s): section 3 owes 60s, section 4
    // takes a free writer for 60s.
    expect(view(measured(), {}, { ...CONTEXT, now: 130_000 }).remainingMs).toBe(60_000);
    expect(
      view(measured(), {}, { ...CONTEXT, now: 130_000, capabilities: NOTHING }).remainingMs,
    ).toBeNull();
    expect(view(builtAll()).remainingMs).toBeNull();
  });

  it('recomputes the estimate on build events only, never on the clock (SPEC §4.8)', () => {
    // Sections 3 and 4 both started at 120s. Read at the caller's clock, the same rows
    // said 50s, then 40s, then nothing as time passed: a line that moves on every
    // re-render (a clock tick, a keystroke in the composer) is a flicker, not a forecast.
    const writing = reduceBuildProgress(measured(), started(4, 120_000));
    const at = (now: number) => view(writing, {}, { ...CONTEXT, now }).remainingMs;
    expect(at(130_000)).toBe(60_000);
    expect(at(140_000)).toBe(60_000);
    expect(at(400_000)).toBe(60_000);

    // A build event moves it: section 3's draft at 150s leaves section 4 owing 30s.
    const draft = reduceBuildProgress(writing, drafted(3, 150_000));
    expect(view(draft, {}, { ...CONTEXT, now: 150_000 }).remainingMs).toBe(30_000);
    expect(view(draft, {}, { ...CONTEXT, now: 170_000 }).remainingMs).toBe(30_000);
  });

  it('falls back to the direction prose on one line without structured direction (E7)', () => {
    expect(view(measured()).direction).toEqual({ mood: 'Calm, clinical, teal.' });
    const structured = { mood: 'Calm', fonts: 'Reem Kufi / IBM Plex Sans' };
    expect(view(measured(), { direction: structured }).direction).toEqual(structured);
    expect(
      view(measured(), { direction: structured }, { ...CONTEXT, capabilities: NOTHING }).direction,
    ).toEqual({ mood: 'Calm, clinical, teal.' });
  });

  it('carries facts only with the capability (E4)', () => {
    const facts = [{ sample: '25 JD', section: 'Pricing', nodeId: 'n4' }];
    expect(view(builtAll(), { facts }).facts).toEqual(facts);
    expect(view(builtAll(), { facts }, { ...CONTEXT, capabilities: NOTHING }).facts).toEqual([]);
  });

  it('reads the facts from the build’s own reports when the caller passes none (E4)', () => {
    const progress = progressOf([
      planned(),
      ...TASKS.flatMap((_entry, index) => [
        started(index + 1, 2_000 * (index + 1)),
        completed(index + 1, 2_000 * (index + 1) + 1_600),
      ]),
      completion(
        20_000,
        TASKS.map((_entry, index) => ({
          ...report('applied', index),
          ...(index === 3 ? { facts: [{ key: 'price', sample: '25 JD' }] } : {}),
        })),
      ),
    ]);
    expect(view(progress).facts).toEqual([{ sample: '25 JD', section: 'Why us', nodeId: 'n4' }]);
    expect(view(progress, {}, { ...CONTEXT, capabilities: NOTHING }).facts).toEqual([]);
  });

  it('builds the menu in order: restore only with E3 and later changes, technical only for developers', () => {
    const record = view(builtAll(), { laterPageChanges: true }, { ...CONTEXT, developer: true });
    expect(record.menu).toEqual(['restore', 'reuse', 'copySummary', 'technical']);
    expect(
      view(builtAll(), { laterPageChanges: true }, { ...CONTEXT, capabilities: NOTHING }).menu,
    ).toEqual(['reuse', 'copySummary']);
    expect(view(builtAll(), { laterPageChanges: false }).menu).toEqual(['reuse', 'copySummary']);
  });

  it('passes collapse through and defaults to open', () => {
    expect(view(builtAll()).collapsed).toBe(false);
    expect(view(builtAll(), { collapsed: true }).collapsed).toBe(true);
  });
});

/* ── Edits, errors, answers ───────────────────────────────────────────────────── */

type StepPayload = AiAgentEvent extends infer Event
  ? Event extends AiAgentEvent
    ? Omit<Event, 'runId' | 'seq'>
    : never
  : never;

function runOf(events: readonly StepPayload[]): RunProgress {
  return events.reduce(
    (progress, payload, index) =>
      reduceRunProgress(progress, { ...payload, runId: 'e1', seq: index }),
    initialRunProgress('auto', 1_000),
  );
}

describe('editRecordView', () => {
  const CHANGES = [
    { kind: 'changed' as const, label: 'Background', before: 'light', after: 'deep navy' },
  ];

  it('running: the live line is the mapped stage key, never narration', () => {
    const record = editRecordView(
      {
        turnId: 'e',
        origin: 'request',
        target: 'Hero',
        run: runOf([
          { type: 'context.ready', fragmentCount: 1, totalTokens: 1, at: 2_000 },
          { type: 'plan.validating', attempt: 1, at: 3_000 },
        ]),
        revived: false,
      },
      CONTEXT,
    );

    expect(record).toMatchObject({ phase: 'running', stage: 'edit.checking', target: 'Hero' });
    expect(record.elapsedMs).toBeUndefined();
    expect(record.undo).toBeUndefined();
    expect(record.menu).toEqual([]);
  });

  it('done: changes, reveal, Undo by transaction, final time', () => {
    const record = editRecordView(
      {
        turnId: 'e',
        origin: 'request',
        run: runOf([]),
        revived: false,
        applied: { changes: CHANGES, transactionId: 'tx-9', revealNodeId: 'n2', at: 17_000 },
      },
      CONTEXT,
    );

    expect(record).toMatchObject({
      phase: 'done',
      changes: CHANGES,
      revealNodeId: 'n2',
      undo: { kind: 'undo', transactionId: 'tx-9' },
      elapsedMs: 16_000,
    });
    expect(record.menu).toEqual(['reuse', 'copySummary']);
  });

  it('no change: nothing landed, so nothing to undo', () => {
    const record = editRecordView(
      {
        turnId: 'e',
        origin: 'proposal',
        run: runOf([]),
        revived: false,
        applied: { changes: [], at: 2_000 },
      },
      CONTEXT,
    );

    expect(record.phase).toBe('noChange');
    expect(record.undo).toBeUndefined();
  });

  it('a landed edit no line describes: done with Undo, never "no change"', () => {
    // `impactLines` reads a style change or a move as a line of its own now, but a change
    // it has no line for (a prop no schema names in words) still landed and the page moved:
    // "It already matched what you asked for" would be a lie, and it would hide Undo.
    const record = editRecordView(
      {
        turnId: 'e',
        origin: 'request',
        target: 'Hero',
        run: runOf([]),
        revived: false,
        applied: { changes: [], transactionId: 'tx-style', revealNodeId: 'n2', at: 3_000 },
      },
      CONTEXT,
    );

    expect(record).toMatchObject({
      phase: 'done',
      changes: [],
      unlisted: true,
      revealNodeId: 'n2',
      undo: { kind: 'undo', transactionId: 'tx-style' },
      elapsedMs: 2_000,
    });
    expect(record.menu).toEqual(['reuse', 'copySummary']);
  });

  it('says a landed change with no line in words, and only then (edit.unlisted)', () => {
    const base = {
      turnId: 'e',
      origin: 'request',
      run: runOf([]),
      revived: false,
    } as const;
    const lined = editRecordView(
      {
        ...base,
        applied: {
          changes: [{ kind: 'restyled', label: 'Section', value: 'Hero' }],
          transactionId: 'tx-1',
          at: 3_000,
        },
      },
      CONTEXT,
    );
    expect(lined).not.toHaveProperty('unlisted');
    expect(lined.changes).toEqual([{ kind: 'restyled', label: 'Section', value: 'Hero' }]);
    const nothing = editRecordView({ ...base, applied: { changes: [], at: 3_000 } }, CONTEXT);
    expect(nothing.phase).toBe('noChange');
    expect(nothing).not.toHaveProperty('unlisted');
  });

  it("trusts planImpact's empty flag over the transaction: a landed no-op is no change", () => {
    const applied = (empty: boolean) =>
      editRecordView(
        {
          turnId: 'e',
          origin: 'request',
          run: runOf([]),
          revived: false,
          applied: { changes: [], transactionId: 'tx-0', empty, at: 2_000 },
        },
        CONTEXT,
      );

    expect(applied(true).phase).toBe('noChange');
    expect(applied(true).undo).toBeUndefined();
    expect(applied(false)).toMatchObject({
      phase: 'done',
      undo: { kind: 'undo', transactionId: 'tx-0' },
    });
  });

  it('undone offers Redo; a revived edit offers neither', () => {
    const undone = editRecordView(
      {
        turnId: 'e',
        origin: 'request',
        run: runOf([]),
        revived: false,
        applied: { changes: CHANGES, transactionId: 'tx-9', at: 2_000 },
        undone: { transactionId: 'tx-10' },
      },
      CONTEXT,
    );
    expect(undone.phase).toBe('undone');
    expect(undone.undo).toEqual({ kind: 'redo', transactionId: 'tx-10' });

    const revived = editRecordView(
      {
        turnId: 'e',
        origin: 'request',
        run: runOf([]),
        revived: true,
        applied: { changes: CHANGES, transactionId: 'tx-9', at: 2_000 },
      },
      CONTEXT,
    );
    expect(revived.undo).toEqual({ kind: 'unavailable', why: 'revived' });
  });

  it('stopped: the page was not changed, no Undo, measured to the stop', () => {
    const record = editRecordView(
      { turnId: 'e', origin: 'request', run: runOf([]), revived: false, stopped: { at: 4_000 } },
      CONTEXT,
    );

    expect(record).toMatchObject({ phase: 'stopped', elapsedMs: 3_000 });
    expect(record.undo).toBeUndefined();
    expect(record.menu).toEqual(['reuse']);
  });
});

describe('stored turns as record inputs (the controller hands them over unchanged)', () => {
  it('reads an error turn’s stored page state as it is, "unknown" included', () => {
    const failure: AiRunFailure = {
      source: 'provider',
      code: 'http-status',
      message: 'The assistant server answered with status 500.',
      retryable: true,
      status: 500,
    };
    const record = errorRecordView(
      errorRecordInputOf({ id: 'e', kind: 'error', failure, pageState: { kind: 'unknown' } }),
      CONTEXT,
    );
    expect(record).toMatchObject({
      turnId: 'e',
      failure: 'unreachable',
      pageState: { kind: 'unknown' },
      retryable: true,
    });
  });

  it('reads a settled build turn as settled, and its outcomes as they are stored', () => {
    const progress = builtAll();
    const input = buildRecordInputOf({
      id: 't9',
      kind: 'build',
      request: 'A clinic',
      progress,
      status: 'settled',
      outcomes: { 'tx-2': { kind: 'undone', transactionId: 'tx-revert-2' } },
    });
    expect(input).toMatchObject({ turnId: 't9', revived: false, stopping: false, settled: true });
    expect(buildRecordView(input, CONTEXT)?.rows[1]?.state).toBe('undone');
  });
});

describe('errorRecordView and answerRecordView', () => {
  it('classifies the failure, keeps the details for the clipboard only, and gates Try again', () => {
    const declined = errorRecordView(
      {
        turnId: 'x',
        failure: { source: 'provider', code: 'refusal', message: 'No.', retryable: false },
      },
      CONTEXT,
    );
    expect(declined).toMatchObject({
      turnId: 'x',
      failure: 'declined',
      retryable: false,
      pageState: { kind: 'unchanged' },
      menu: ['reuse', 'copyError'],
    });
    expect(declined.details).toContain('refusal');

    const tooLarge = errorRecordView(
      {
        turnId: 'x',
        failure: {
          source: 'context',
          code: 'context-budget',
          message: 'AI context budget exceeded: estimated 9 tokens, maximum 8.',
          retryable: false,
        },
        landed: 2,
      },
      { ...CONTEXT, developer: true },
    );
    expect(tooLarge).toMatchObject({
      failure: 'tooLarge',
      retryable: true,
      pageState: { kind: 'kept', landed: 2 },
      menu: ['reuse', 'copyError', 'technical'],
    });
  });

  it('answers carry their text and a Copy', () => {
    expect(answerRecordView('a', 'The hero uses the accent colour.', CONTEXT)).toEqual({
      turnId: 'a',
      text: 'The hero uses the accent colour.',
      menu: ['reuse', 'copyAnswer'],
    });
  });
});
