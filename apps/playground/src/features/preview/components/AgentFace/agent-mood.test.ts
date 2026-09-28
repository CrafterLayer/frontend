import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  AiAgentEvent,
  AiBuildEvent,
  AiBuildOwnEvent,
  AiBuildTaskReport,
  AiRunFailure,
  AiSkillActivationPin,
} from '@craftkit/builder';

import {
  AGENT_MOOD_COPY,
  agentMoodText,
  BLUR_GRACE_MS,
  createInitialAgentMoodState,
  DWELL_INFLIGHT_MS,
  DWELL_REPAIRING_MS,
  HOLD_DONE_MS,
  HOLD_STOPPED_MS,
  moodForTurn,
  PROGRESS_THROTTLE_MS,
  reduceAgentMood,
  TYPING_MS,
  useAgentMood,
  type AgentLineKey,
  type AgentLocale,
  type AgentMoodInput,
  type AgentMoodMode,
  type AgentMoodSnapshot,
  type AgentMoodState,
} from './agent-mood';

/* ── Fixtures ────────────────────────────────────────────────────────────── */

type Distribute<T> = T extends unknown ? Omit<T, 'runId' | 'seq' | 'at'> : never;
type EventBody = Distribute<AiAgentEvent>;

let nextSeq = 0;

/** An event of run `run-1` (by default) with an auto-incrementing sequence number. */
function ev(body: EventBody, runId = 'run-1'): AiAgentEvent {
  const event = { ...body, runId, seq: nextSeq, at: 0 };
  nextSeq += 1;
  return event;
}

function failure(retryable: boolean): AiRunFailure {
  return { source: 'provider', code: 'http-status', message: 'busy', retryable };
}

function activations(n: number): readonly AiSkillActivationPin[] {
  return Array.from({ length: n }, () => ({}) as unknown as AiSkillActivationPin);
}

const E = {
  started: () => ev({ type: 'run.started', apply: 'never' }),
  resolving: () => ev({ type: 'skills.resolving' }),
  resolved: (n: number) =>
    ev({ type: 'skills.resolved', activations: activations(n), omitted: [], totalTokens: 0 }),
  gathering: () => ev({ type: 'context.gathering' }),
  ready: (n: number) => ev({ type: 'context.ready', fragmentCount: n, totalTokens: 0 }),
  proposing: () => ev({ type: 'plan.proposing' }),
  progress: (text: string) => ev({ type: 'plan.progress', text }),
  validating: (attempt: 1 | 2) => ev({ type: 'plan.validating', attempt }),
  repairing: (issues: readonly string[]) => ev({ type: 'plan.repairing', issues }),
  proposed: () => ev({ type: 'plan.proposed', plan: {} as never, proposal: {} as never }),
  salvaged: (kept: number, dropped: number) =>
    ev({
      type: 'plan.salvaged',
      kept,
      dropped: Array.from({ length: dropped }, (_unused, index) => ({
        step: index + 1,
        command: 'setProp',
        reason: 'The door refused this step.',
      })),
    }),
  applying: () => ev({ type: 'plan.applying' }),
  completed: (status: 'proposed' | 'applied') => ev({ type: 'run.completed', status }),
  failed: (retryable: boolean) => ev({ type: 'run.failed', error: failure(retryable) }),
  cancelled: () => ev({ type: 'run.cancelled', error: failure(false) }),
};

type BuildBody = Distribute<AiBuildOwnEvent>;

/** A build's own event, on the build's run id and the same sequence counter. */
function bev(body: BuildBody, runId = 'run-1'): AiBuildEvent {
  const built: AiBuildOwnEvent = { ...body, runId, seq: nextSeq, at: 0 };
  nextSeq += 1;
  return built;
}

const SECTION = { id: 'n1', title: 'Hero' };

function buildReport(
  statuses: readonly ('applied' | 'skipped' | 'not-started')[],
): readonly AiBuildTaskReport[] {
  return statuses.map((status, index) => ({
    id: `n${String(index + 1)}`,
    title: `Section ${String(index + 1)}`,
    status,
    attempts: status === 'not-started' ? 0 : 1,
  }));
}

const B = {
  scaffolding: () => bev({ type: 'build.scaffolding' }),
  skipped: () => bev({ type: 'build.skipped', reason: 'The page skeleton produced 1 section.' }),
  planned: () => bev({ type: 'build.planned', direction: 'd', tasks: [SECTION] }),
  taskStarted: (position = 1) =>
    bev({ type: 'task.started', position, total: 3, task: SECTION, attempt: 1 }),
  taskCompleted: (position = 1) =>
    bev({ type: 'task.completed', position, total: 3, task: SECTION, attempts: 1 }),
  taskSkipped: (position = 1) =>
    bev({
      type: 'task.skipped',
      position,
      total: 3,
      task: SECTION,
      attempts: 2,
      reason: 'Section "Hero" exceeded its 240000ms budget.',
    }),
  stopped: (reason: 'signal' | 'budget' | 'max-tasks') => bev({ type: 'build.stopped', reason }),
  completed: (
    statuses: readonly ('applied' | 'skipped' | 'not-started')[],
    outcome: 'completed' | 'signal' | 'budget' | 'max-tasks' = 'completed',
  ) => {
    const tasks = buildReport(statuses);
    return bev({
      type: 'build.completed',
      tasks,
      applied: tasks.filter((task) => task.status === 'applied').length,
      skipped: tasks.filter((task) => task.status === 'skipped').length,
      elapsedMs: 1_000,
      outcome,
    });
  },
};

const event = (e: AiBuildEvent): AgentMoodInput => ({ type: 'event', event: e });
const begin = (runId = 'run-1', subject = 'the hero block'): AgentMoodInput => ({
  type: 'run.begin',
  runId,
  subject,
});
const tick: AgentMoodInput = { type: 'tick' };

type Step = readonly [now: number, input: AgentMoodInput];

/** Fold the reducer over a script and return every state, in order. */
function drive(steps: readonly Step[], mode: AgentMoodMode = 'ask'): AgentMoodState[] {
  nextSeq = 0;
  const states: AgentMoodState[] = [];
  let state = createInitialAgentMoodState(mode, 0);
  for (const [now, input] of steps) {
    state = reduceAgentMood(state, input, now);
    states.push(state);
  }
  return states;
}

function last(states: readonly AgentMoodState[]): AgentMoodState {
  const state = states.at(-1);
  if (state === undefined) throw new Error('no states');
  return state;
}

/**
 * Rule 8, restated independently of the reducer so the test is not a tautology:
 * the deadline is the minimum of everything that can wake the face.
 */
function expectedWakeAt(state: AgentMoodState, now: number): number | null {
  const owned =
    (state.run !== null && !state.run.settled) ||
    state.pinned ||
    state.holdUntil !== null ||
    state.pending !== null;
  const deadlines: number[] = [];
  if (state.pending !== null) deadlines.push(state.pending.minSince);
  if (state.holdUntil !== null) deadlines.push(state.holdUntil);
  if (!owned) {
    const { composer } = state;
    if (
      !composer.focused &&
      composer.draftLength === 0 &&
      composer.blurredAt !== null &&
      now < composer.blurredAt + BLUR_GRACE_MS
    ) {
      deadlines.push(composer.blurredAt + BLUR_GRACE_MS);
    }
    if (state.snapshot.typing && composer.editedAt !== null) {
      deadlines.push(composer.editedAt + TYPING_MS);
    }
  }
  return deadlines.length === 0 ? null : Math.min(...deadlines);
}

/* ── The reducer ─────────────────────────────────────────────────────────── */

describe('reduceAgentMood', () => {
  it('walks an Ask run: thinking, a dwell, planning, a dwell, done, a hold, idle', () => {
    const states = drive([
      [0, begin()],
      [5, event(E.started())],
      [8, event(E.resolving())],
      [10, event(E.resolved(2))],
      [12, event(E.gathering())],
      [15, event(E.ready(5))],
      [20, event(E.proposing())],
      [30, event(E.proposed())],
      [DWELL_INFLIGHT_MS, tick],
      [410, event(E.completed('proposed'))],
      [800, tick],
      [3300, tick],
    ]);
    const moods = states.map((s) => s.snapshot.mood);
    expect(moods).toEqual([
      'thinking',
      'thinking',
      'thinking',
      'thinking',
      'thinking',
      'thinking',
      'thinking',
      'thinking',
      'planning',
      'planning',
      'done',
      'idle',
    ]);
    expect(states[0]?.snapshot.line).toEqual({
      key: 'thinking.subject',
      subject: 'the hero block',
    });
    // plan.proposing is queued behind the 400 ms dwell, not painted at once.
    expect(states[6]?.pending?.snapshot.mood).toBe('planning');
    expect(states[6]?.wakeAt).toBe(DWELL_INFLIGHT_MS);
    expect(states[8]?.snapshot.since).toBe(DWELL_INFLIGHT_MS);
    // run.completed at 410 lands inside planning's dwell: queued as well.
    expect(states[9]?.pending?.snapshot.mood).toBe('done');
    expect(states[9]?.run?.settled).toBe(true);
    expect(states[10]?.snapshot.outcome).toBe('proposed');
    expect(states[10]?.snapshot.line).toEqual({ key: 'done.proposed' });
    expect(states[10]?.holdUntil).toBe(800 + HOLD_DONE_MS);
    expect(states[11]?.snapshot.line).toEqual({ key: 'idle' });
  });

  it('resolves done by mode: planned in Plan mode, applied after plan.applying in Auto', () => {
    const planned = drive(
      [
        [0, begin()],
        [500, event(E.proposing())],
        [1000, event(E.proposing())],
        [1500, event(E.completed('proposed'))],
      ],
      'plan',
    );
    expect(planned[1]?.snapshot.line).toEqual({ key: 'planning.planMode' });
    // Announced once: a second plan.proposing falls back to the plain line.
    expect(planned[2]?.snapshot.line).toEqual({ key: 'planning' });
    expect(last(planned).snapshot).toMatchObject({ mood: 'done', outcome: 'planned' });

    const auto = drive(
      [
        [0, begin()],
        [500, event(E.proposing())],
        [1000, event(E.applying())],
        [1500, event(E.completed('applied'))],
      ],
      'auto',
    );
    expect(auto[2]?.snapshot).toMatchObject({ mood: 'working', line: { key: 'working' } });
    expect(last(auto).snapshot).toMatchObject({
      mood: 'done',
      outcome: 'applied',
      line: { key: 'done.applied' },
    });
  });

  it('pins a failure: it preempts the queue, ignores focus, and lifts on a keystroke', () => {
    for (const retryable of [true, false]) {
      const states = drive([
        [0, begin()],
        [20, event(E.proposing())],
        [50, event(E.failed(retryable))],
        [60, { type: 'composer', focused: true }],
        [5000, tick],
        [5010, { type: 'composer', draftLength: 1 }],
      ]);
      expect(states[2]?.snapshot).toMatchObject({
        mood: 'failed',
        since: 50,
        line: { key: retryable ? 'failed.retryable' : 'failed.final' },
      });
      expect(states[2]?.pending).toBeNull();
      expect(states[2]?.pinned).toBe(true);
      expect(states[3]?.snapshot.mood).toBe('failed');
      expect(states[4]?.snapshot.mood).toBe('failed');
      expect(states[5]?.pinned).toBe(false);
      expect(states[5]?.snapshot.mood).toBe('listening');
    }
  });

  it('stops at once, holds 1800 ms, then follows the composer', () => {
    const states = drive([
      [0, begin()],
      [20, event(E.proposing())],
      [50, event(E.cancelled())],
      [50 + HOLD_STOPPED_MS, tick],
      [2000, { type: 'composer', focused: true }],
    ]);
    expect(states[2]?.snapshot).toMatchObject({ mood: 'stopped', since: 50 });
    expect(states[2]?.holdUntil).toBe(50 + HOLD_STOPPED_MS);
    expect(states[2]?.pinned).toBe(false);
    expect(states[3]?.snapshot.mood).toBe('idle');
    expect(states[4]?.snapshot.mood).toBe('listening');
  });

  it('returns the same reference for a foreign run id or a stale sequence number', () => {
    nextSeq = 0;
    let state = createInitialAgentMoodState('ask', 0);
    state = reduceAgentMood(state, begin(), 0);
    state = reduceAgentMood(state, event(E.started()), 5);
    expect(reduceAgentMood(state, event(ev({ type: 'skills.resolving' }, 'run-0')), 10)).toBe(
      state,
    );
    const stale: AiAgentEvent = { type: 'skills.resolving', runId: 'run-1', seq: 0, at: 0 };
    expect(reduceAgentMood(state, event(stale), 10)).toBe(state);
    // No run at all: every event is a stranger.
    const fresh = createInitialAgentMoodState('ask', 0);
    expect(reduceAgentMood(fresh, event(E.started()), 1)).toBe(fresh);
  });

  it('treats turn.outcome as a fallback: a no-op after the event, a settlement without it', () => {
    const settledByEvent = drive([
      [0, begin()],
      [500, event(E.completed('proposed'))],
      [600, { type: 'turn.outcome', runId: 'run-1', outcome: 'stopped' }],
    ]);
    expect(settledByEvent[2]).toBe(settledByEvent[1]);

    const settledByOutcome = drive([
      [0, begin()],
      [500, { type: 'turn.outcome', runId: 'run-1', outcome: 'refused', retryable: true }],
    ]);
    expect(last(settledByOutcome).snapshot).toMatchObject({
      mood: 'failed',
      line: { key: 'failed.retryable' },
    });
    expect(last(settledByOutcome).run?.settled).toBe(true);

    const applied = drive([
      [0, begin()],
      [500, { type: 'turn.outcome', runId: 'run-1', outcome: 'plan', applied: true }],
    ]);
    expect(last(applied).snapshot).toMatchObject({ mood: 'done', outcome: 'applied' });

    const foreign = drive([
      [0, begin()],
      [500, { type: 'turn.outcome', runId: 'run-9', outcome: 'stopped' }],
    ]);
    expect(foreign[1]).toBe(foreign[0]);
  });

  it('flags typing for 600 ms after a draft change and never changes the line', () => {
    const states = drive([
      [0, { type: 'composer', focused: true }],
      [10, { type: 'composer', draftLength: 1 }],
      [10 + TYPING_MS, tick],
    ]);
    expect(states[0]?.snapshot).toMatchObject({ mood: 'listening', typing: false });
    expect(states[1]?.snapshot).toMatchObject({ mood: 'listening', typing: true });
    expect(states[1]?.wakeAt).toBe(10 + TYPING_MS);
    expect(states[2]?.snapshot).toMatchObject({ mood: 'listening', typing: false });
    for (const state of states) expect(state.snapshot.line).toEqual({ key: 'idle' });
  });

  it('keeps listening through the blur grace so a mouse click on Send never flashes idle', () => {
    const states = drive([
      [-100, { type: 'composer', focused: true }],
      [0, { type: 'composer', focused: false }],
      [100, begin()],
    ]);
    expect(states.map((s) => s.snapshot.mood)).toEqual(['listening', 'listening', 'thinking']);
    expect(states[1]?.wakeAt).toBe(BLUR_GRACE_MS);
    // The grace alone decays to idle when nothing follows it.
    const decayed = drive([
      [-100, { type: 'composer', focused: true }],
      [0, { type: 'composer', focused: false }],
      [BLUR_GRACE_MS, tick],
    ]);
    expect(last(decayed).snapshot.mood).toBe('idle');
  });

  it('throttles streamed progress to one publish per 250 ms, latest wins', () => {
    const states = drive([
      [0, begin()],
      [500, event(E.proposing())],
      [1000, event(E.progress('a'))],
      [1050, event(E.progress('b'))],
      [1100, event(E.progress('c'))],
      [1000 + PROGRESS_THROTTLE_MS, tick],
    ]);
    expect(states[2]?.snapshot.line).toEqual({ key: 'planning.progress', text: 'a' });
    expect(states[3]?.snapshot.line.text).toBe('a');
    expect(states[3]?.wakeAt).toBe(1000 + PROGRESS_THROTTLE_MS);
    expect(states[4]?.snapshot.line.text).toBe('a');
    expect(states[4]?.pending?.snapshot.line.text).toBe('c');
    expect(states[5]?.snapshot.line).toEqual({ key: 'planning.progress', text: 'c' });
    expect(states[5]?.snapshot.mood).toBe('planning');
    // The mood did not restart: `since` still marks planning's entry.
    expect(states[5]?.snapshot.since).toBe(500);
  });

  it('ignores plan.salvaged entirely (reference-equal)', () => {
    /*
      A salvage means both attempts were refused and the run kept the part the
      door accepts. The face must not react: the plan card names the dropped
      steps, and a mood change here would read as an OUTCOME while the run is
      still going. Reference equality is the assertion because "no change" and
      "changed to the same values" are different facts to a memoised view.

      This branch arrived with the event itself and had no test — the same gap
      that let `plan.salvaged` break this file's exhaustive switch and the
      playground typecheck with it.
    */
    const states = drive([
      [0, begin()],
      [500, event(E.proposing())],
      [600, event(E.salvaged(2, 1))],
    ]);
    expect(states[2]).toBe(states[1]);
  });

  it('ignores plan.proposed entirely (reference-equal)', () => {
    const states = drive([
      [0, begin()],
      [500, event(E.proposing())],
      [600, event(E.proposed())],
    ]);
    expect(states[2]).toBe(states[1]);
  });

  it('dwells 600 ms on repairing before the second check', () => {
    const states = drive([
      [0, begin()],
      [500, event(E.proposing())],
      [1000, event(E.validating(1))],
      [1500, event(E.repairing(['a', 'b']))],
      [1550, event(E.validating(2))],
      [1500 + DWELL_REPAIRING_MS, tick],
    ]);
    expect(states[2]?.snapshot).toMatchObject({
      mood: 'planning',
      variant: 'checking',
      line: { key: 'checking.1' },
    });
    expect(states[3]?.snapshot).toMatchObject({
      mood: 'planning',
      variant: 'repairing',
      line: { key: 'repairing', n: 2 },
    });
    expect(states[4]?.snapshot.variant).toBe('repairing');
    expect(states[4]?.pending?.snapshot.variant).toBe('checking');
    expect(states[4]?.wakeAt).toBe(1500 + DWELL_REPAIRING_MS);
    expect(states[5]?.snapshot).toMatchObject({ variant: 'checking', line: { key: 'checking.2' } });
  });

  it('survives New chat during a run: reset wins and the late cancel is dropped', () => {
    const states = drive([
      [0, { type: 'composer', focused: true }],
      [100, begin()],
      [200, { type: 'reset' }],
      [300, event(E.cancelled())],
    ]);
    // reset carries the composer over; run.begin had cleared focus, so this is idle.
    expect(states[2]?.snapshot.mood).toBe('idle');
    expect(states[2]?.run).toBeNull();
    expect(states[3]).toBe(states[2]);
  });

  it('clears composer focus on run.begin so a done hold decays to idle, not listening', () => {
    const states = drive([
      [0, { type: 'composer', focused: true }],
      [100, begin()],
      [600, event(E.completed('proposed'))],
      [600 + HOLD_DONE_MS, tick],
    ]);
    expect(states[1]?.composer.focused).toBe(false);
    expect(states[2]?.snapshot.mood).toBe('done');
    expect(states[3]?.snapshot.mood).toBe('idle');
  });

  it('notes Apply and Discard on a card as done with a 2500 ms hold', () => {
    for (const outcome of ['applied', 'discarded'] as const) {
      const states = drive([
        [0, { type: 'turn.note', outcome }],
        [HOLD_DONE_MS, tick],
      ]);
      expect(states[0]?.snapshot).toMatchObject({
        mood: 'done',
        outcome,
        line: { key: `done.${outcome}` },
      });
      expect(states[0]?.holdUntil).toBe(HOLD_DONE_MS);
      expect(states[1]?.snapshot.mood).toBe('idle');
    }
    // Never while a run is in flight.
    const busy = drive([
      [0, begin()],
      [10, { type: 'turn.note', outcome: 'applied' }],
    ]);
    expect(busy[1]).toBe(busy[0]);
  });

  it('keeps wakeAt equal to the minimum live deadline after every step', () => {
    const script: readonly Step[] = [
      [0, { type: 'composer', focused: true }],
      [10, { type: 'composer', draftLength: 3 }],
      [20, { type: 'composer', focused: false }],
      [100, begin()],
      [120, event(E.resolved(1))],
      [130, event(E.proposing())],
      [500, tick],
      [520, event(E.progress('a'))],
      [530, event(E.progress('b'))],
      [900, tick],
      [910, event(E.repairing(['x']))],
      [920, event(E.validating(2))],
      [1600, tick],
      [1610, event(E.completed('proposed'))],
      [2100, tick],
      [4700, tick],
      [4800, { type: 'composer', focused: true }],
      [4810, { type: 'composer', draftLength: 0 }],
      [5500, tick],
      [5600, { type: 'turn.note', outcome: 'discarded' }],
      [5700, { type: 'reset' }],
    ];
    nextSeq = 0;
    let state = createInitialAgentMoodState('ask', 0);
    for (const [now, input] of script) {
      state = reduceAgentMood(state, input, now);
      expect(state.wakeAt, `after ${input.type} at ${String(now)}`).toBe(
        expectedWakeAt(state, now),
      );
    }
  });
});

/* ── A whole build (SPEC §7.4, P2-18) ────────────────────────────────────── */

describe('reduceAgentMood over a page build', () => {
  it('plans the skeleton, works while sections land, and ends done: never "thinking" throughout', () => {
    const states = drive(
      [
        [0, begin('run-1', 'the page')],
        [5, event(B.scaffolding())],
        [DWELL_INFLIGHT_MS, tick],
        // The skeleton's own step events carry `run-1/scaffold`: not the face's.
        [450, event(ev({ type: 'plan.proposing' }, 'run-1/scaffold'))],
        [1_000, event(B.planned())],
        [1_010, event(B.taskStarted(1))],
        [1_020, event(B.taskStarted(2))],
        [2_000, event(B.taskCompleted(1))],
        [3_000, event(B.taskCompleted(2))],
        [3_500, event(B.completed(['applied', 'applied']))],
      ],
      'auto',
    );
    const moods = states.map((s) => s.snapshot.mood);

    expect(moods).toEqual([
      'thinking',
      'thinking',
      'planning',
      'planning',
      'working',
      'working',
      'working',
      'working',
      'working',
      'done',
    ]);
    // A step event of the build is a stranger: the same reference comes back.
    expect(states[3]).toBe(states[2]);
    expect(states[4]?.snapshot.line).toEqual({ key: 'working' });
    expect(last(states).snapshot).toMatchObject({ mood: 'done', outcome: 'applied' });
    expect(last(states).run?.settled).toBe(true);
    expect(last(states).holdUntil).toBe(3_500 + HOLD_DONE_MS);
  });

  it('task.completed moves a face still on thinking straight to working', () => {
    const states = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.taskCompleted(1))],
    ]);

    expect(last(states).snapshot).toMatchObject({ mood: 'working', line: { key: 'working' } });
    expect(last(states).run?.settled).toBe(false);
  });

  it("ignores every writer's own events: a fill's run.completed never settles the build", () => {
    const states = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.planned())],
      [500, event(ev({ type: 'run.completed', status: 'proposed' }, 'run-1/fill-1'))],
      [600, event(ev({ type: 'run.failed', error: failure(false) }, 'run-1/fill-2'))],
      [700, event(ev({ type: 'run.cancelled', error: failure(false) }, 'run-1/fill-3'))],
    ]);

    expect(states[2]).toBe(states[1]);
    expect(states[3]).toBe(states[1]);
    expect(states[4]).toBe(states[1]);
    expect(last(states).snapshot.mood).toBe('working');
  });

  it('task.skipped is one section failing, not the build: the face keeps working', () => {
    const states = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.planned())],
      [900, event(B.taskSkipped(1))],
      [1_000, event(B.taskCompleted(2))],
    ]);

    expect(states[2]?.snapshot.mood).toBe('working');
    expect(states[2]?.pinned).toBe(false);
    expect(states[2]?.run?.settled).toBe(false);
    expect(last(states).snapshot.mood).toBe('working');
  });

  it('build.stopped {signal} stops at once; the report after it changes nothing', () => {
    const states = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.planned())],
      // Inside working's dwell: a stop still preempts.
      [450, event(B.stopped('signal'))],
      [460, event(B.completed(['applied', 'not-started'], 'signal'))],
    ]);

    expect(states[2]?.snapshot).toMatchObject({ mood: 'stopped', since: 450 });
    expect(states[2]?.run?.settled).toBe(true);
    expect(states[2]?.holdUntil).toBe(450 + HOLD_STOPPED_MS);
    expect(states[3]).toBe(states[2]);
  });

  it('a budget or section-limit stop lets sections in flight land, then ends stopped', () => {
    for (const reason of ['budget', 'max-tasks'] as const) {
      const states = drive([
        [0, begin()],
        [DWELL_INFLIGHT_MS, event(B.planned())],
        [900, event(B.stopped(reason))],
        [1_000, event(B.taskCompleted(1))],
        [1_100, event(B.completed(['applied', 'not-started'], reason))],
      ]);

      expect(states[2], reason).toBe(states[1]);
      expect(states[3]?.snapshot.mood, reason).toBe('working');
      expect(last(states).snapshot.mood, reason).toBe('stopped');
      expect(last(states).run?.settled, reason).toBe(true);
    }
  });

  it('build.completed: done when anything landed, failed (retryable) when nothing did', () => {
    const partial = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.planned())],
      [900, event(B.completed(['applied', 'skipped']))],
    ]);
    expect(last(partial).snapshot).toMatchObject({ mood: 'done', outcome: 'applied' });

    const failed = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.planned())],
      [900, event(B.completed(['skipped', 'skipped']))],
    ]);
    expect(last(failed).snapshot).toMatchObject({
      mood: 'failed',
      line: { key: 'failed.retryable' },
    });
    expect(last(failed).pinned).toBe(true);
    expect(last(failed).run?.settled).toBe(true);
  });

  it('Ask mode refused the list: stopped, whatever the empty report says', () => {
    const states = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.scaffolding())],
      [900, event(B.stopped('signal'))],
      [910, event(B.completed([], 'signal'))],
    ]);

    expect(last(states).snapshot.mood).toBe('stopped');
  });

  it('build.skipped hands the face to the ordinary run that replaced the build', () => {
    const states = drive([
      [0, begin()],
      [DWELL_INFLIGHT_MS, event(B.skipped())],
      [900, { type: 'turn.outcome', runId: 'run-1', outcome: 'plan', applied: true }],
    ]);

    expect(states[1]?.snapshot).toMatchObject({ mood: 'planning', line: { key: 'planning' } });
    expect(states[1]?.run?.settled).toBe(false);
    expect(last(states).snapshot).toMatchObject({ mood: 'done', outcome: 'applied' });
  });

  it('drops a build event from another run or with a stale sequence number', () => {
    nextSeq = 0;
    let state = createInitialAgentMoodState('ask', 0);
    state = reduceAgentMood(state, begin(), 0);
    state = reduceAgentMood(state, event(B.planned()), DWELL_INFLIGHT_MS);
    expect(
      reduceAgentMood(state, event(bev({ type: 'build.stopped', reason: 'signal' }, 'run-0')), 500),
    ).toBe(state);
    const stale = { ...B.completed(['applied']), seq: 0 };
    expect(reduceAgentMood(state, event(stale), 500)).toBe(state);
  });
});

/* ── Historical turns and copy ───────────────────────────────────────────── */

describe('moodForTurn', () => {
  it('freezes every turn kind at the mood it earned', () => {
    expect(moodForTurn({ kind: 'thinking' })).toEqual({ mood: 'thinking' });
    expect(moodForTurn({ kind: 'stopped' })).toEqual({ mood: 'stopped' });
    expect(moodForTurn({ kind: 'refused' })).toEqual({ mood: 'failed' });
    expect(moodForTurn({ kind: 'refused', failure: { retryable: true } })).toEqual({
      mood: 'failed',
    });
    expect(moodForTurn({ kind: 'discarded' })).toEqual({ mood: 'done', outcome: 'discarded' });
    expect(moodForTurn({ kind: 'plan', applied: true })).toEqual({
      mood: 'done',
      outcome: 'applied',
    });
    expect(moodForTurn({ kind: 'plan', applied: false })).toEqual({
      mood: 'done',
      outcome: 'proposed',
    });
    expect(moodForTurn({ kind: 'plan', applied: false, mode: 'plan' })).toEqual({
      mood: 'done',
      outcome: 'planned',
    });
    expect(moodForTurn({ kind: 'plan', applied: true, mode: 'plan' })).toEqual({
      mood: 'done',
      outcome: 'applied',
    });
  });
});

const LINE_KEYS: readonly AgentLineKey[] = [
  'idle',
  'thinking',
  'thinking.subject',
  'skills.resolving',
  'skills.resolved',
  'context.ready',
  'planning',
  'planning.planMode',
  'planning.progress',
  'checking.1',
  'checking.2',
  'repairing',
  'working',
  'done.proposed',
  'done.applied',
  'done.planned',
  'done.discarded',
  'failed.retryable',
  'failed.final',
  'stopped',
];

function snap(line: AgentMoodSnapshot['line']): AgentMoodSnapshot {
  return { mood: 'thinking', line, typing: false, since: 0 };
}

describe('agentMoodText', () => {
  it('has every line in both locales', () => {
    for (const locale of ['ar', 'en'] as const satisfies readonly AgentLocale[]) {
      for (const key of LINE_KEYS) {
        expect(AGENT_MOOD_COPY[locale][key], `${locale}/${key}`).toBeDefined();
        expect(agentMoodText(snap({ key, n: 2, text: 't' }), locale)).not.toBe('');
      }
    }
  });

  it('substitutes the block type, the count and the streamed text', () => {
    const subject = snap({ key: 'thinking.subject', subject: 'the hero block' });
    expect(agentMoodText(subject, 'en')).toBe('Reading the hero block.');
    expect(agentMoodText(subject, 'ar')).toBe('عم أقرا بلوك hero.');
    expect(agentMoodText(snap({ key: 'skills.resolved', n: 3 }), 'en')).toBe('3 skills ready.');
    expect(agentMoodText(snap({ key: 'context.ready', n: 5 }), 'ar')).toBe('قريت 5 مقاطع.');
    expect(agentMoodText(snap({ key: 'planning.progress', text: 'Reading hero…' }), 'en')).toBe(
      'Reading hero…',
    );
    expect(agentMoodText(snap({ key: 'planning.progress', text: 'Reading hero…' }), 'ar')).toBe(
      'Reading hero…',
    );
  });

  it('picks the singular and plural repair forms', () => {
    expect(agentMoodText(snap({ key: 'repairing', n: 1 }), 'en')).toBe('Found a flaw. Fixing it.');
    expect(agentMoodText(snap({ key: 'repairing', n: 3 }), 'en')).toBe(
      'Found 3 flaws. Fixing them.',
    );
    expect(agentMoodText(snap({ key: 'repairing', n: 1 }), 'ar')).toBe('لقيت غلطة. عم أصلّحها.');
    expect(agentMoodText(snap({ key: 'repairing', n: 3 }), 'ar')).toBe('لقيت 3 غلطات. عم أصلّحها.');
  });
});

/* ── The hook ────────────────────────────────────────────────────────────── */

describe('useAgentMood', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function mount(initial?: { composerFocused?: boolean; draftLength?: number; strict?: boolean }) {
    const wrapper =
      initial?.strict === true
        ? ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
        : undefined;
    return renderHook(
      (props: { composerFocused: boolean; draftLength: number; mode: AgentMoodMode }) =>
        useAgentMood(props),
      {
        initialProps: {
          mode: 'ask',
          composerFocused: initial?.composerFocused ?? false,
          draftLength: initial?.draftLength ?? 0,
        },
        ...(wrapper === undefined ? {} : { wrapper }),
      },
    );
  }

  it('owns exactly one timer and promotes the queue through it', () => {
    vi.useFakeTimers();
    nextSeq = 0;
    const hook = mount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      hook.result.current.beginRun('run-1', 'the page');
    });
    expect(hook.result.current.snapshot).toMatchObject({
      mood: 'thinking',
      line: { key: 'thinking' },
    });
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      hook.result.current.onEvent(E.proposing());
    });
    expect(hook.result.current.snapshot.mood).toBe('thinking');
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(DWELL_INFLIGHT_MS);
    });
    expect(hook.result.current.snapshot.mood).toBe('planning');
    act(() => {
      vi.advanceTimersByTime(DWELL_INFLIGHT_MS);
    });
    act(() => {
      hook.result.current.onEvent(E.completed('proposed'));
    });
    expect(hook.result.current.snapshot).toMatchObject({ mood: 'done', outcome: 'proposed' });
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(HOLD_DONE_MS);
    });
    expect(hook.result.current.snapshot.mood).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('feeds composer props into the reducer', () => {
    vi.useFakeTimers();
    const hook = mount();
    expect(hook.result.current.snapshot.mood).toBe('idle');
    hook.rerender({ mode: 'ask', composerFocused: true, draftLength: 0 });
    expect(hook.result.current.snapshot).toMatchObject({ mood: 'listening', typing: false });
    hook.rerender({ mode: 'ask', composerFocused: true, draftLength: 4 });
    expect(hook.result.current.snapshot).toMatchObject({ mood: 'listening', typing: true });
    act(() => {
      vi.advanceTimersByTime(TYPING_MS);
    });
    expect(hook.result.current.snapshot.typing).toBe(false);
    hook.rerender({ mode: 'ask', composerFocused: false, draftLength: 0 });
    act(() => {
      vi.advanceTimersByTime(BLUR_GRACE_MS);
    });
    expect(hook.result.current.snapshot.mood).toBe('idle');
  });

  it('clears its timer on unmount', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    nextSeq = 0;
    const hook = mount();
    act(() => {
      hook.result.current.beginRun('run-1', 'the page');
      hook.result.current.onEvent(E.proposing());
    });
    expect(vi.getTimerCount()).toBe(1);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(HOLD_DONE_MS);
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('plays a scripted run to the expected snapshot sequence, StrictMode included', () => {
    vi.useFakeTimers();
    nextSeq = 0;
    const hook = mount({ strict: true });
    const moods: string[] = [];
    const note = () => {
      const { mood, variant, outcome } = hook.result.current.snapshot;
      moods.push([mood, variant, outcome].filter((part) => part !== undefined).join('/'));
    };
    act(() => {
      hook.result.current.beginRun('run-1', 'the hero block');
    });
    note();
    act(() => {
      hook.result.current.onEvent(E.resolved(2));
      hook.result.current.onEvent(E.proposing());
    });
    act(() => {
      vi.advanceTimersByTime(DWELL_INFLIGHT_MS);
    });
    note();
    act(() => {
      hook.result.current.onEvent(E.validating(1));
    });
    act(() => {
      vi.advanceTimersByTime(DWELL_INFLIGHT_MS);
    });
    note();
    act(() => {
      hook.result.current.onEvent(E.repairing(['x']));
    });
    act(() => {
      vi.advanceTimersByTime(DWELL_INFLIGHT_MS);
    });
    note();
    act(() => {
      hook.result.current.onEvent(E.validating(2));
    });
    act(() => {
      vi.advanceTimersByTime(DWELL_REPAIRING_MS);
    });
    note();
    act(() => {
      hook.result.current.onEvent(E.completed('proposed'));
    });
    act(() => {
      vi.advanceTimersByTime(DWELL_INFLIGHT_MS);
    });
    note();
    act(() => {
      vi.advanceTimersByTime(HOLD_DONE_MS);
    });
    note();
    expect(moods).toEqual([
      'thinking',
      'planning',
      'planning/checking',
      'planning/repairing',
      'planning/checking',
      'done/proposed',
      'idle',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
