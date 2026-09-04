/**
 * The character's mood as a pure function of the run log.
 *
 * `reduceAgentMood` is the ONLY place a mood is decided. It reads the agent's
 * own events (filtered by run id and sequence so a stale run can never move
 * the face), the composer's focus and draft, and a handful of deadlines —
 * dwell, hold, blur grace, typing, progress throttle — all expressed as a
 * single `wakeAt` timestamp so the hook that owns the timer only ever has one
 * alive. Every deadline is computed from a `now` the CALLER passes in, never
 * from `Date.now()` inside the reducer, so StrictMode's double invocation
 * yields the same state twice and the table tests below drive time explicitly.
 */
import { useCallback, useEffect, useReducer } from 'react';

import type { AiAgentEvent } from '@craftkit/builder';

import type { AgentFaceProps } from './AgentFace';

export type AgentLocale = 'ar' | 'en';
/** Structurally identical to AssistantPanel's `AssistantMode`; re-declared so this file owes the panel nothing. */
export type AgentMoodMode = 'ask' | 'auto' | 'plan';
export type AgentMood =
  'idle' | 'listening' | 'thinking' | 'planning' | 'working' | 'done' | 'failed' | 'stopped';
export type AgentMoodVariant = 'checking' | 'repairing';
export type AgentMoodOutcome = 'proposed' | 'applied' | 'planned' | 'discarded';
export type AgentLineKey =
  | 'idle'
  | 'thinking'
  | 'thinking.subject'
  | 'skills.resolving'
  | 'skills.resolved'
  | 'context.ready'
  | 'planning'
  | 'planning.planMode'
  | 'planning.progress'
  | 'checking.1'
  | 'checking.2'
  | 'repairing'
  | 'working'
  | 'done.proposed'
  | 'done.applied'
  | 'done.planned'
  | 'done.discarded'
  | 'failed.retryable'
  | 'failed.final'
  | 'stopped';

export interface AgentMoodLine {
  readonly key: AgentLineKey;
  readonly subject?: string;
  readonly n?: number;
  readonly text?: string;
}

export interface AgentMoodSnapshot {
  readonly mood: AgentMood;
  readonly variant?: AgentMoodVariant;
  readonly outcome?: AgentMoodOutcome;
  /** Resolved to a sentence by `agentMoodText(snapshot, locale)`. */
  readonly line: AgentMoodLine;
  readonly typing: boolean;
  /** When this mood (and variant/outcome) was entered. */
  readonly since: number;
}

export type AgentMoodPendingSnapshot = Omit<AgentMoodSnapshot, 'typing' | 'since'>;

export interface AgentMoodState {
  readonly snapshot: AgentMoodSnapshot;
  readonly mode: AgentMoodMode;
  readonly run: {
    readonly runId: string;
    readonly subject: string;
    readonly lastSeq: number;
    readonly settled: boolean;
    readonly announcedPlanMode: boolean;
  } | null;
  readonly composer: {
    readonly focused: boolean;
    readonly draftLength: number;
    readonly blurredAt: number | null;
    readonly editedAt: number | null;
  };
  /** done / stopped decay deadline. */
  readonly holdUntil: number | null;
  /** failed: held until a keystroke. */
  readonly pinned: boolean;
  /** Queued while a dwell or throttle runs; `tick` promotes it. */
  readonly pending: {
    readonly snapshot: AgentMoodPendingSnapshot;
    readonly minSince: number;
  } | null;
  /** Last line publish, for the progress throttle. */
  readonly progressAt: number;
  /** The ONE timer deadline. */
  readonly wakeAt: number | null;
}

export type AgentMoodInput =
  | { type: 'run.begin'; runId: string; subject: string }
  | { type: 'event'; event: AiAgentEvent }
  | {
      type: 'turn.outcome';
      runId: string;
      outcome: 'plan' | 'stopped' | 'refused';
      applied?: boolean;
      retryable?: boolean;
    }
  /** Apply / Discard pressed on a card while no run is in flight. */
  | { type: 'turn.note'; outcome: 'applied' | 'discarded' }
  | { type: 'composer'; focused?: boolean; draftLength?: number }
  | { type: 'mode'; mode: AgentMoodMode }
  | { type: 'reset' }
  | { type: 'tick' };

export const DWELL_INFLIGHT_MS = 400;
export const DWELL_REPAIRING_MS = 600;
export const HOLD_DONE_MS = 2500;
export const HOLD_STOPPED_MS = 1800;
export const BLUR_GRACE_MS = 300;
export const TYPING_MS = 600;
export const PROGRESS_THROTTLE_MS = 250;

const IDLE_LINE: AgentMoodLine = { key: 'idle' };
const PAGE_SUBJECT = 'the page';

export function createInitialAgentMoodState(mode: AgentMoodMode, now: number): AgentMoodState {
  return {
    snapshot: { mood: 'idle', line: IDLE_LINE, typing: false, since: now },
    mode,
    run: null,
    composer: { focused: false, draftLength: 0, blurredAt: null, editedAt: null },
    holdUntil: null,
    pinned: false,
    pending: null,
    progressAt: 0,
    wakeAt: null,
  };
}

/* ── Equality, so a no-op reduction hands back the SAME reference ────────── */

function sameLine(a: AgentMoodLine, b: AgentMoodLine): boolean {
  return a.key === b.key && a.subject === b.subject && a.n === b.n && a.text === b.text;
}

function samePose(a: AgentMoodPendingSnapshot, b: AgentMoodPendingSnapshot): boolean {
  return a.mood === b.mood && a.variant === b.variant && a.outcome === b.outcome;
}

function sameSnapshot(a: AgentMoodSnapshot, b: AgentMoodSnapshot): boolean {
  return samePose(a, b) && a.typing === b.typing && a.since === b.since && sameLine(a.line, b.line);
}

function sameState(a: AgentMoodState, b: AgentMoodState): boolean {
  if (a === b) return true;
  const runSame =
    a.run === b.run ||
    (a.run !== null &&
      b.run !== null &&
      a.run.runId === b.run.runId &&
      a.run.subject === b.run.subject &&
      a.run.lastSeq === b.run.lastSeq &&
      a.run.settled === b.run.settled &&
      a.run.announcedPlanMode === b.run.announcedPlanMode);
  const pendingSame =
    a.pending === b.pending ||
    (a.pending !== null &&
      b.pending !== null &&
      a.pending.minSince === b.pending.minSince &&
      samePose(a.pending.snapshot, b.pending.snapshot) &&
      sameLine(a.pending.snapshot.line, b.pending.snapshot.line));
  return (
    runSame &&
    pendingSame &&
    a.mode === b.mode &&
    a.holdUntil === b.holdUntil &&
    a.pinned === b.pinned &&
    a.progressAt === b.progressAt &&
    a.wakeAt === b.wakeAt &&
    a.composer.focused === b.composer.focused &&
    a.composer.draftLength === b.composer.draftLength &&
    a.composer.blurredAt === b.composer.blurredAt &&
    a.composer.editedAt === b.composer.editedAt &&
    sameSnapshot(a.snapshot, b.snapshot)
  );
}

/* ── Derivation helpers ──────────────────────────────────────────────────── */

function inFlight(state: AgentMoodState): boolean {
  return state.run !== null && !state.run.settled;
}

function dwellFor(snapshot: AgentMoodSnapshot): number {
  return snapshot.variant === 'repairing' ? DWELL_REPAIRING_MS : DWELL_INFLIGHT_MS;
}

function holdFor(mood: AgentMood): number | null {
  if (mood === 'done') return HOLD_DONE_MS;
  if (mood === 'stopped') return HOLD_STOPPED_MS;
  return null;
}

function listeningNow(composer: AgentMoodState['composer'], now: number): boolean {
  return (
    composer.focused ||
    composer.draftLength > 0 ||
    (composer.blurredAt !== null && now < composer.blurredAt + BLUR_GRACE_MS)
  );
}

function typingNow(composer: AgentMoodState['composer'], now: number): boolean {
  return composer.editedAt !== null && now < composer.editedAt + TYPING_MS;
}

/** Nothing owns the face: no run, no pin, no hold, nothing queued. */
function free(state: AgentMoodState): boolean {
  return !inFlight(state) && !state.pinned && state.holdUntil === null && state.pending === null;
}

/** Precedence (d): the composer decides between idle and listening. */
function deriveComposer(state: AgentMoodState, now: number): AgentMoodState {
  if (!free(state)) return state;
  const listening = listeningNow(state.composer, now);
  const mood: AgentMood = listening ? 'listening' : 'idle';
  const typing = listening && typingNow(state.composer, now);
  const current = state.snapshot;
  if (current.mood === mood && current.typing === typing && sameLine(current.line, IDLE_LINE)) {
    return state;
  }
  const since = current.mood === mood ? current.since : now;
  return {
    ...state,
    snapshot: { mood, line: IDLE_LINE, typing, since },
    progressAt: sameLine(current.line, IDLE_LINE) ? state.progressAt : now,
  };
}

/** Rule 8: the single timer deadline is the minimum live one. */
function withWakeAt(state: AgentMoodState, now: number): AgentMoodState {
  const deadlines: number[] = [];
  if (state.pending !== null) deadlines.push(state.pending.minSince);
  if (state.holdUntil !== null) deadlines.push(state.holdUntil);
  if (free(state)) {
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
  const wakeAt = deadlines.length === 0 ? null : Math.min(...deadlines);
  return wakeAt === state.wakeAt ? state : { ...state, wakeAt };
}

function finish(previous: AgentMoodState, next: AgentMoodState, now: number): AgentMoodState {
  const settled = withWakeAt(deriveComposer(next, now), now);
  return sameState(previous, settled) ? previous : settled;
}

/* ── Targets: what an input wants the face to become ─────────────────────── */

interface Target {
  readonly pose: AgentMoodPendingSnapshot;
  /** `null` keeps the current line (run.started, context.gathering, n=0 counts). */
  readonly line: AgentMoodLine | null;
}

function publish(
  state: AgentMoodState,
  pose: AgentMoodPendingSnapshot,
  now: number,
  since: number,
): AgentMoodState {
  const hold = holdFor(pose.mood);
  return {
    ...state,
    snapshot: { ...pose, typing: false, since },
    pending: null,
    holdUntil: hold === null ? null : now + hold,
    progressAt: sameLine(state.snapshot.line, pose.line) ? state.progressAt : now,
  };
}

/**
 * Rules 4 and 6. Terminal `failed`/`stopped` preempt; everything else respects
 * the dwell of the mood on screen, and a same-mood line respects the throttle.
 */
function applyTarget(state: AgentMoodState, target: Target, now: number): AgentMoodState {
  const current = state.snapshot;
  const line = target.line ?? current.line;
  const pose: AgentMoodPendingSnapshot = { ...target.pose, line };
  if (pose.mood === 'failed' || pose.mood === 'stopped') {
    return publish(state, pose, now, now);
  }
  if (samePose(current, pose)) {
    if (sameLine(current.line, line)) {
      // The same pose and the same words: the queue (if any) is not disturbed.
      return state;
    }
    const queuedMove = state.pending !== null && !samePose(state.pending.snapshot, pose);
    if (queuedMove) {
      // A mood change is already waiting and carries its own line; a late word
      // for the pose being left must not push it out of the single queue slot.
      return state;
    }
    const throttledUntil = state.progressAt + PROGRESS_THROTTLE_MS;
    if (now < throttledUntil) {
      return { ...state, pending: { snapshot: pose, minSince: throttledUntil } };
    }
    return publish(state, pose, now, current.since);
  }
  const dwellUntil = current.since + dwellFor(current);
  if (now < dwellUntil) {
    return { ...state, pending: { snapshot: pose, minSince: dwellUntil } };
  }
  return publish(state, pose, now, now);
}

function thinkingLine(subject: string): AgentMoodLine {
  return subject === PAGE_SUBJECT ? { key: 'thinking' } : { key: 'thinking.subject', subject };
}

function doneOutcome(applied: boolean, mode: AgentMoodMode): AgentMoodOutcome {
  if (applied) return 'applied';
  return mode === 'plan' ? 'planned' : 'proposed';
}

/** A pose that brings its own words. */
function own(pose: AgentMoodPendingSnapshot): Target {
  return { pose, line: pose.line };
}

function donePose(outcome: AgentMoodOutcome): Target {
  return own({ mood: 'done', outcome, line: { key: `done.${outcome}` } });
}

function failedPose(retryable: boolean): Target {
  const key: AgentLineKey = retryable ? 'failed.retryable' : 'failed.final';
  return own({ mood: 'failed', line: { key } });
}

const STOPPED: Target = own({ mood: 'stopped', line: { key: 'stopped' } });

/** Rule 2: an accepted event of the current run, to its target pose. `null` = no change. */
function targetForEvent(
  state: AgentMoodState & { readonly run: NonNullable<AgentMoodState['run']> },
  event: AiAgentEvent,
): { target: Target; announcedPlanMode?: true; settled?: true } | null {
  const keep = state.snapshot.line;
  const thinking = (line: AgentMoodLine | null) => ({
    target: { pose: { mood: 'thinking' as const, line: line ?? keep }, line },
  });
  const planning = (line: AgentMoodLine | null, variant?: AgentMoodVariant) => ({
    target: {
      pose:
        variant === undefined
          ? { mood: 'planning' as const, line: line ?? keep }
          : { mood: 'planning' as const, variant, line: line ?? keep },
      line,
    },
  });
  switch (event.type) {
    case 'run.started':
    case 'context.gathering':
      return thinking(null);
    case 'skills.resolving':
      return thinking({ key: 'skills.resolving' });
    case 'skills.resolved':
      return thinking(
        event.activations.length === 0
          ? null
          : { key: 'skills.resolved', n: event.activations.length },
      );
    case 'context.ready':
      return thinking(
        event.fragmentCount === 0 ? null : { key: 'context.ready', n: event.fragmentCount },
      );
    case 'plan.proposing': {
      if (state.mode === 'plan' && !state.run.announcedPlanMode) {
        return { ...planning({ key: 'planning.planMode' }), announcedPlanMode: true };
      }
      return planning({ key: 'planning' });
    }
    case 'plan.progress':
      return planning({ key: 'planning.progress', text: event.text });
    case 'plan.validating':
      return planning({ key: event.attempt === 1 ? 'checking.1' : 'checking.2' }, 'checking');
    case 'plan.repairing':
      return planning({ key: 'repairing', n: event.issues.length }, 'repairing');
    case 'plan.salvaged':
      /*
        Both attempts were refused and the run kept the part of the answer the
        door accepts. The face stays in its planning beat rather than reacting:
        the plan card names the dropped steps, and a mood change here would read
        as an outcome when the run has not finished yet.
      */
      return null;
    case 'plan.proposed':
      // The card announces the proposal; the face keeps its last planning beat
      // until run.completed so it never dips to idle between the two.
      return null;
    case 'plan.applying':
      return { target: own({ mood: 'working', line: { key: 'working' } }) };
    case 'run.completed':
      return {
        target: donePose(doneOutcome(event.status === 'applied', state.mode)),
        settled: true,
      };
    case 'run.failed':
      return { target: failedPose(event.error.retryable), settled: true };
    case 'run.cancelled':
      return { target: STOPPED, settled: true };
  }
}

/* ── The reducer ─────────────────────────────────────────────────────────── */

export function reduceAgentMood(
  state: AgentMoodState,
  input: AgentMoodInput,
  now: number,
): AgentMoodState {
  switch (input.type) {
    case 'run.begin': {
      const line = thinkingLine(input.subject);
      const next: AgentMoodState = {
        ...state,
        run: {
          runId: input.runId,
          subject: input.subject,
          lastSeq: -1,
          settled: false,
          announcedPlanMode: false,
        },
        // Chrome fires no blur when the focused textarea is disabled, so the
        // panel's focus flag would stay true for the whole run: clear it here.
        composer: { ...state.composer, focused: false, blurredAt: null },
        snapshot: { mood: 'thinking', line, typing: false, since: now },
        holdUntil: null,
        pinned: false,
        pending: null,
        progressAt: now,
      };
      return finish(state, next, now);
    }
    case 'event': {
      const { run } = state;
      const { event } = input;
      if (run?.runId !== event.runId || event.seq <= run.lastSeq) {
        return state;
      }
      const resolved = targetForEvent({ ...state, run }, event);
      if (resolved === null) return state;
      const withRun: AgentMoodState = {
        ...state,
        run: {
          ...run,
          lastSeq: event.seq,
          settled: resolved.settled === true ? true : run.settled,
          announcedPlanMode: resolved.announcedPlanMode === true ? true : run.announcedPlanMode,
        },
      };
      let next = applyTarget(withRun, resolved.target, now);
      if (resolved.target.pose.mood === 'failed') next = { ...next, pinned: true };
      return finish(state, next, now);
    }
    case 'turn.outcome': {
      const { run } = state;
      if (run?.runId !== input.runId || run.settled) return state;
      const target =
        input.outcome === 'plan'
          ? donePose(doneOutcome(input.applied === true, state.mode))
          : input.outcome === 'stopped'
            ? STOPPED
            : failedPose(input.retryable === true);
      let next = applyTarget({ ...state, run: { ...run, settled: true } }, target, now);
      if (target.pose.mood === 'failed') next = { ...next, pinned: true };
      return finish(state, next, now);
    }
    case 'turn.note': {
      if (inFlight(state)) return state;
      const target = donePose(input.outcome);
      // A person's own act on a card: no dwell, it lands at once.
      const next = publish({ ...state, pinned: false }, target.pose, now, now);
      return finish(state, next, now);
    }
    case 'composer': {
      let composer = state.composer;
      let pinned = state.pinned;
      if (input.focused !== undefined && input.focused !== composer.focused) {
        composer = {
          ...composer,
          focused: input.focused,
          blurredAt: input.focused ? composer.blurredAt : now,
        };
      }
      if (input.draftLength !== undefined && input.draftLength !== composer.draftLength) {
        composer = { ...composer, draftLength: input.draftLength, editedAt: now };
        // A keystroke, not a tab through, is what dismisses a pinned failure.
        pinned = false;
      }
      return finish(state, { ...state, composer, pinned }, now);
    }
    case 'mode':
      return input.mode === state.mode ? state : finish(state, { ...state, mode: input.mode }, now);
    case 'reset':
      return finish(
        state,
        { ...createInitialAgentMoodState(state.mode, now), composer: state.composer },
        now,
      );
    case 'tick': {
      let next = state;
      if (next.pending !== null && now >= next.pending.minSince) {
        const { snapshot: pose } = next.pending;
        const since = samePose(next.snapshot, pose) ? next.snapshot.since : now;
        next = publish(next, pose, now, since);
      }
      if (next.holdUntil !== null && now >= next.holdUntil) {
        next = { ...next, holdUntil: null };
      }
      return finish(state, next, now);
    }
  }
}

/* ── Historical turns ────────────────────────────────────────────────────── */

export type AgentMoodTurnSummary =
  | { kind: 'thinking' }
  | { kind: 'stopped' }
  | { kind: 'refused'; failure?: { retryable: boolean } | undefined }
  | { kind: 'discarded' }
  | { kind: 'plan'; applied: boolean; mode?: AgentMoodMode | undefined }
  /*
    A plan in prose, with nothing to apply. It ends the same way a discussed
    plan does — the work was thinking, and it finished — so it wears the
    'planned' outcome rather than borrowing 'applied', which would say something
    happened to the page.
  */
  | { kind: 'outline' };

/** The frozen mood a bubble earned. No loops, no one-shots, no dwell. */
export function moodForTurn(turn: AgentMoodTurnSummary): Pick<AgentFaceProps, 'mood' | 'outcome'> {
  switch (turn.kind) {
    case 'thinking':
      return { mood: 'thinking' };
    case 'stopped':
      return { mood: 'stopped' };
    case 'refused':
      return { mood: 'failed' };
    case 'discarded':
      return { mood: 'done', outcome: 'discarded' };
    case 'plan':
      return { mood: 'done', outcome: doneOutcome(turn.applied, turn.mode ?? 'ask') };
    case 'outline':
      return { mood: 'done', outcome: doneOutcome(false, 'plan') };
  }
}

/* ── Copy ────────────────────────────────────────────────────────────────── */

export type AgentMoodCopyEntry = string | { readonly one: string; readonly many: string };

export const AGENT_MOOD_COPY: Readonly<
  Record<AgentLocale, Readonly<Record<AgentLineKey, AgentMoodCopyEntry>>>
> = {
  ar: {
    idle: 'قول شو بدك. بدون مقدمات.',
    thinking: 'عم أقرا الصفحة.',
    'thinking.subject': 'عم أقرا بلوك {type}.',
    'skills.resolving': 'عم أختار الأدوات.',
    'skills.resolved': '{n} أدوات جاهزة.',
    'context.ready': 'قريت {n} مقاطع.',
    planning: 'عم أشتغل. لا تقاطعني.',
    'planning.planMode': 'عم أرسم خطة بس. ما رح أطبّق شي.',
    'planning.progress': '{text}',
    'checking.1': 'عم أراجع شغلي قبل ما تشوفه.',
    'checking.2': 'عم أراجع التصليح.',
    repairing: { one: 'لقيت غلطة. عم أصلّحها.', many: 'لقيت {n} غلطات. عم أصلّحها.' },
    working: 'عم أطبّقها هلق.',
    'done.proposed': 'هذا اقتراحي. اقراه قبل ما تضغط.',
    'done.applied': 'خلص. صار.',
    'done.planned': 'الخطة جاهزة. ما طبّقت شي.',
    'done.discarded': 'رميته؟ ماشي. كان تمام.',
    'failed.retryable': 'ما زبطت. جرّب كمان مرة.',
    'failed.final': 'مش رح أعملها. السبب تحت.',
    stopped: 'وقّفتني بنص الشغل. ماشي.',
  },
  en: {
    idle: 'Say what you want. Skip the preamble.',
    thinking: 'Reading the page.',
    'thinking.subject': 'Reading the {type} block.',
    'skills.resolving': 'Choosing skills.',
    'skills.resolved': '{n} skills ready.',
    'context.ready': 'Read {n} fragments.',
    planning: "Working. Don't interrupt.",
    'planning.planMode': 'Drafting a plan only. Nothing will be applied.',
    'planning.progress': '{text}',
    'checking.1': 'Checking my work before you see it.',
    'checking.2': 'Checking the repair.',
    repairing: { one: 'Found a flaw. Fixing it.', many: 'Found {n} flaws. Fixing them.' },
    working: 'Applying.',
    'done.proposed': "That's the plan. Read it before you click.",
    'done.applied': 'Applied as one change.',
    'done.planned': 'Planned. Nothing applied.',
    'done.discarded': 'Tossed it? Fine. It was good.',
    'failed.retryable': "Didn't go through. Try again.",
    'failed.final': "Not doing that. Reason's below.",
    stopped: 'Stopped.',
  },
};

/** `'the hero block'` → `'hero'`; anything else passes through verbatim. */
function subjectType(subject: string): string {
  const match = /^the (.+) block$/.exec(subject);
  return match?.[1] ?? subject;
}

export function agentMoodText(snapshot: AgentMoodSnapshot, locale: AgentLocale): string {
  const { line } = snapshot;
  const entry = AGENT_MOOD_COPY[locale][line.key];
  const n = line.n ?? 0;
  const template = typeof entry === 'string' ? entry : n === 1 ? entry.one : entry.many;
  return template
    .replaceAll('{type}', subjectType(line.subject ?? PAGE_SUBJECT))
    .replaceAll('{n}', String(n))
    .replaceAll('{text}', line.text ?? '');
}

/* ── The hook: a thin adapter that owns exactly one timer ────────────────── */

interface Action {
  readonly input: AgentMoodInput;
  readonly now: number;
}

function reducer(state: AgentMoodState, action: Action): AgentMoodState {
  return reduceAgentMood(state, action.input, action.now);
}

function initialise(mode: AgentMoodMode): AgentMoodState {
  return createInitialAgentMoodState(mode, Date.now());
}

export interface UseAgentMoodOptions {
  readonly mode: AgentMoodMode;
  readonly composerFocused: boolean;
  readonly draftLength: number;
}

export interface UseAgentMoodResult {
  readonly snapshot: AgentMoodSnapshot;
  readonly beginRun: (runId: string, subject: string) => void;
  readonly onEvent: (event: AiAgentEvent) => void;
  readonly settleTurn: (
    input: Omit<Extract<AgentMoodInput, { type: 'turn.outcome' }>, 'type'>,
  ) => void;
  readonly noteTurn: (outcome: 'applied' | 'discarded') => void;
  readonly reset: () => void;
}

export function useAgentMood(options: UseAgentMoodOptions): UseAgentMoodResult {
  const { mode, composerFocused, draftLength } = options;
  const [state, dispatch] = useReducer(reducer, mode, initialise);

  // `now` is captured at dispatch time, never inside the reducer, so a double
  // invocation under StrictMode reduces the same action to the same state.
  const send = useCallback((input: AgentMoodInput) => {
    dispatch({ input, now: Date.now() });
  }, []);

  useEffect(() => {
    send({ type: 'mode', mode });
  }, [mode, send]);
  useEffect(() => {
    send({ type: 'composer', focused: composerFocused });
  }, [composerFocused, send]);
  useEffect(() => {
    send({ type: 'composer', draftLength });
  }, [draftLength, send]);

  const { wakeAt } = state;
  useEffect(() => {
    if (wakeAt === null) return undefined;
    const id = setTimeout(
      () => {
        // A timer can land a hair early; clamping keeps the tick past its own
        // deadline so the reducer never bails out and strands the queue.
        dispatch({ input: { type: 'tick' }, now: Math.max(Date.now(), wakeAt) });
      },
      Math.max(0, wakeAt - Date.now()),
    );
    return () => {
      clearTimeout(id);
    };
  }, [wakeAt]);

  const beginRun = useCallback(
    (runId: string, subject: string) => {
      send({ type: 'run.begin', runId, subject });
    },
    [send],
  );
  const onEvent = useCallback(
    (event: AiAgentEvent) => {
      send({ type: 'event', event });
    },
    [send],
  );
  const settleTurn = useCallback(
    (input: Omit<Extract<AgentMoodInput, { type: 'turn.outcome' }>, 'type'>) => {
      send({ type: 'turn.outcome', ...input });
    },
    [send],
  );
  const noteTurn = useCallback(
    (outcome: 'applied' | 'discarded') => {
      send({ type: 'turn.note', outcome });
    },
    [send],
  );
  const reset = useCallback(() => {
    send({ type: 'reset' });
  }, [send]);

  return { snapshot: state.snapshot, beginRun, onEvent, settleTurn, noteTurn, reset };
}
