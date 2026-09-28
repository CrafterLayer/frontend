import type {
  AnnouncementKey,
  AnnouncementView,
  BuildPhase,
  BuildStopReason,
  CopyParams,
  EditStageKey,
  RowState,
  RunActivity,
  StatusKey,
} from './view-types';

/**
 * What the RunBar says, and what the one live region says (SPEC §4.3, §6.1).
 *
 * Two audiences, two speeds. The visible line may change several times a second: it is
 * plain text a sighted person glances at. The live region is heard, so every sentence it
 * speaks costs the listener seconds of attention and interrupts whatever they were
 * reading. The old panel had several live regions and announced its clock; a build of 8
 * sections with 5 writers produced a sentence roughly every second. This module decides
 * both lines, and it is pure: time is always passed in, so the rules are table-tested and
 * `hooks/use-live-status.ts` (WP-16) only owns the timer around `nextWakeAt`.
 */

/** "{title} is on the page" holds the RunBar this long after a landing (SPEC §4.3 build.landed). */
export const LANDED_LINE_MS = 2_400;

/**
 * No deferred announcement (a coalesced count, the blocked line) follows ANY announcement
 * by less than this. SPEC §4.3 asks for "at most one progress announcement per 4s"; the
 * window counts every announcement, not only counts, so the first landing can never cut
 * off "Page laid out: 8 sections" while a screen reader is still speaking it.
 */
export const MIN_ANNOUNCE_GAP_MS = 4_000;

/** "Blocked" is announced once per episode, after it has lasted this long (SPEC §4.3). */
export const BLOCKED_ANNOUNCE_AFTER_MS = 10_000;

/* ── The visible line ────────────────────────────────────────────────────── */

/** One spine row as the status needs it: its title and its state, in page order. */
export interface StatusRow {
  readonly title: string;
  readonly state: RowState;
}

/**
 * The live run, as the status reads it. Built from the same views the thread renders
 * (`BuildRecordView.rows`, `EditRecordView.stage`), so the RunBar can never disagree with
 * the record above it. `lastLanding` is the newest `task.completed`: its title and when.
 */
export type RunStatusInput =
  | { readonly activity: 'routing' | 'plan' | 'proposal' | 'answer'; readonly stopping: boolean }
  | { readonly activity: 'edit'; readonly stage: EditStageKey; readonly stopping: boolean }
  | {
      readonly activity: 'build';
      readonly phase: BuildPhase;
      readonly rows: readonly StatusRow[];
      readonly lastLanding?: { readonly title: string; readonly at: number } | undefined;
      readonly stopping: boolean;
    };

/** A RunBar line: a catalog key and its values (`RunBarView.statusKey` / `params`). */
export interface VisibleStatus {
  readonly statusKey: StatusKey;
  readonly params: CopyParams;
}

const isWriting = (state: RowState): boolean => state === 'writing' || state === 'retrying';

/** Not settled yet: it may still reach the page in this run. */
const isInFlight = (state: RowState): boolean =>
  state === 'planned' || state === 'waiting' || state === 'drafted' || isWriting(state);

/** No writer has touched it yet. */
const isUnstarted = (state: RowState): boolean => state === 'planned' || state === 'waiting';

/**
 * The one section the whole build is waiting on, or null (SPEC §3.4 "Blocked"): exactly
 * one section is still being written and a section below it is already drafted. Sections
 * land in page order, so that finished draft cannot reach the page until this one does.
 */
export function blockedOn(rows: readonly StatusRow[]): string | null {
  const writing = rows.filter((row) => isWriting(row.state));
  const only = writing.length === 1 ? writing[0] : undefined;
  if (only === undefined) return null;
  const at = rows.indexOf(only);
  return rows.slice(at + 1).some((row) => row.state === 'drafted') ? only.title : null;
}

function buildLine(
  run: Extract<RunStatusInput, { readonly activity: 'build' }>,
  now: number,
): VisibleStatus {
  if (run.phase === 'skeleton') return { statusKey: 'build.started', params: {} };
  const { rows, lastLanding } = run;
  // The fresh event first: a landing is news for 2.4s, then the line returns to the work.
  if (lastLanding !== undefined && now - lastLanding.at < LANDED_LINE_MS) {
    return { statusKey: 'build.landed', params: { title: lastLanding.title } };
  }
  const blocked = blockedOn(rows);
  if (blocked !== null) return { statusKey: 'build.blocked', params: { title: blocked } };
  // §3.4 and §3.9 count writers only: a drafted section is written, and it is not ink.
  const writing = rows.filter((row) => isWriting(row.state)).length;
  if (writing > 0) return { statusKey: 'build.writing', params: { n: writing } };
  if (rows.length > 0 && rows.every((row) => isUnstarted(row.state))) {
    return { statusKey: 'build.planned', params: { n: rows.length } };
  }
  /*
    No writer, yet sections still in flight: drafted ones landing in order, or waiting
    ones a free writer is about to pick up. Both are milliseconds long in the engine; the
    count of what is still to come is the honest line for them.
  */
  const inFlight = rows.filter((row) => isInFlight(row.state)).length;
  if (inFlight > 0) return { statusKey: 'build.writing', params: { n: inFlight } };
  // Nothing left in flight and `build.completed` not yet in: the last landing is still true.
  if (lastLanding !== undefined) {
    return { statusKey: 'build.landed', params: { title: lastLanding.title } };
  }
  return { statusKey: 'build.planned', params: { n: Math.max(rows.length, 1) } };
}

/**
 * The RunBar's line (SPEC §4.3 "Visible" column). Stopping wins over everything: once
 * Stop is pressed the line says "Stopping…" until the engine settles (SPEC §7.6 E0a).
 * An edit shows its mapped stage phrase, never the provider's narration (SPEC §4.9); an
 * answer has no line of its own and reads the request until it arrives.
 */
export function visibleStatus(run: RunStatusInput, now: number): VisibleStatus {
  if (run.stopping) return { statusKey: 'stopping', params: {} };
  switch (run.activity) {
    case 'routing':
    case 'answer':
      return { statusKey: 'run.understanding', params: {} };
    case 'plan':
      return { statusKey: 'plan.drafting', params: {} };
    case 'proposal':
      return { statusKey: 'proposal.drafting', params: {} };
    case 'edit':
      return { statusKey: run.stage, params: {} };
    case 'build':
      return run.phase === 'stopping' ? { statusKey: 'stopping', params: {} } : buildLine(run, now);
  }
}

/* ── The announcement policy ─────────────────────────────────────────────── */

/**
 * How each announced key reaches the live region. A `Record` over the whole
 * `AnnouncementKey` union, so a key added to the catalog cannot compile until someone
 * decides how loudly it speaks.
 * - `immediate`: at once (SPEC §4.3 "Always announced, at once", plus the replies to the
 *   person's own actions: moved, removed, copied, redone, already queued).
 * - `coalesced`: section landings, at most one per window, always the newest count.
 * - `afterEpisode`: the blocked line, once, after the episode has lasted 10s.
 */
export const ANNOUNCE_POLICY: Readonly<
  Record<AnnouncementKey, 'immediate' | 'coalesced' | 'afterEpisode'>
> = {
  'build.started': 'immediate',
  'build.planned': 'immediate',
  'build.blocked': 'afterEpisode',
  'build.progress': 'coalesced',
  'build.done': 'immediate',
  'build.partial': 'immediate',
  stopping: 'immediate',
  stopped: 'immediate',
  'stopped.none': 'immediate',
  'stopped.budget': 'immediate',
  'stopped.budget.none': 'immediate',
  'stopped.maxTasks': 'immediate',
  'edit.started': 'immediate',
  'edit.startedPage': 'immediate',
  'edit.done': 'immediate',
  'edit.donePage': 'immediate',
  'edit.noChange': 'immediate',
  'edit.noChangePage': 'immediate',
  'plan.drafting': 'immediate',
  'plan.ready': 'immediate',
  'proposal.drafting': 'immediate',
  'proposal.ready': 'immediate',
  'answer.ready': 'immediate',
  failed: 'immediate',
  'failed.kept': 'immediate',
  'failed.skeleton': 'immediate',
  undone: 'immediate',
  redone: 'immediate',
  'queue.queued': 'immediate',
  'queue.already': 'immediate',
  'queue.started': 'immediate',
  'plan.moved': 'immediate',
  'plan.removed': 'immediate',
  copied: 'immediate',
};

/** The keys a caller may `say` directly; the two deferred keys have their own inputs. */
export type ImmediateAnnouncementKey = Exclude<AnnouncementKey, 'build.progress' | 'build.blocked'>;

/**
 * A run's settlement or a new run: a count still held from the old run would be stale
 * ("3 of 8" after "Page built: 8 sections"), and a blocked episode has ended with it.
 */
const CLEARS_DEFERRED: ReadonlySet<AnnouncementKey> = new Set<AnnouncementKey>([
  'build.started',
  'edit.started',
  'edit.startedPage',
  'plan.drafting',
  'proposal.drafting',
  'queue.started',
  'build.done',
  'build.partial',
  'stopped',
  'stopped.none',
  'stopped.budget',
  'stopped.budget.none',
  'stopped.maxTasks',
  'failed',
  'failed.kept',
  'failed.skeleton',
]);

export interface AnnouncerState {
  /** Raised on every announcement, so the same sentence twice is spoken twice. */
  readonly seq: number;
  /** When anything was last spoken, or null before the first announcement. */
  readonly lastAt: number | null;
  /** The newest landing count held back by the window. */
  readonly pending: { readonly done: number; readonly total: number } | null;
  /** The current blocked episode: which section, since when, and whether it was said. */
  readonly blocked: {
    readonly title: string;
    readonly since: number;
    readonly spoken: boolean;
  } | null;
}

export const INITIAL_ANNOUNCER: AnnouncerState = {
  seq: 0,
  lastAt: null,
  pending: null,
  blocked: null,
};

/**
 * What the controller tells the announcer, as it happens:
 * - `say`: a moment on the always-announced list;
 * - `landed`: a section's `task.completed`, with the new landed count;
 * - `status`: the RunBar line changed (`null` when the RunBar unmounts), which is how a
 *   blocked episode starts and ends;
 * - `tick`: the hook's timer fired at `nextWakeAt`.
 * There is no input for the clock or the estimate: they cannot be announced.
 */
export type AnnouncerInput =
  | {
      readonly type: 'say';
      readonly key: ImmediateAnnouncementKey;
      readonly params?: CopyParams | undefined;
    }
  | { readonly type: 'landed'; readonly done: number; readonly total: number }
  | { readonly type: 'status'; readonly status: VisibleStatus | null }
  | { readonly type: 'tick' };

/** One step: the next state, and the announcement to speak now (null: stay quiet). */
export interface AnnouncerStep {
  readonly state: AnnouncerState;
  readonly speak: AnnouncementView | null;
}

function spoken(
  state: AnnouncerState,
  key: AnnouncementKey,
  params: CopyParams,
  now: number,
): AnnouncerStep {
  const seq = state.seq + 1;
  return { state: { ...state, seq, lastAt: now }, speak: { key, params, seq } };
}

const gapOpen = (state: AnnouncerState, now: number): boolean =>
  state.lastAt === null || now - state.lastAt >= MIN_ANNOUNCE_GAP_MS;

/** Speak at most one deferred announcement that is due; the count before the blocked line. */
function flush(state: AnnouncerState, now: number): AnnouncerStep {
  if (!gapOpen(state, now)) return { state, speak: null };
  if (state.pending !== null) {
    const { done, total } = state.pending;
    return spoken({ ...state, pending: null }, 'build.progress', { done, total }, now);
  }
  const { blocked } = state;
  if (blocked !== null && !blocked.spoken && now - blocked.since >= BLOCKED_ANNOUNCE_AFTER_MS) {
    return spoken(
      { ...state, blocked: { ...blocked, spoken: true } },
      'build.blocked',
      { title: blocked.title },
      now,
    );
  }
  return { state, speak: null };
}

/** The episode after a RunBar line: kept while it blocks on the same section, else new or none. */
function episodeAfter(
  current: AnnouncerState['blocked'],
  status: VisibleStatus | null,
  now: number,
): AnnouncerState['blocked'] {
  if (status?.statusKey !== 'build.blocked') return null;
  const title = String(status.params['title'] ?? '');
  // A different section is a different cause, so the listener is owed the new name.
  return current?.title === title ? current : { title, since: now, spoken: false };
}

export function reduceAnnouncer(
  state: AnnouncerState,
  input: AnnouncerInput,
  now: number,
): AnnouncerStep {
  switch (input.type) {
    case 'say': {
      const cleared = CLEARS_DEFERRED.has(input.key)
        ? { ...state, pending: null, blocked: null }
        : state;
      return spoken(cleared, input.key, input.params ?? {}, now);
    }
    case 'landed':
      return flush({ ...state, pending: { done: input.done, total: input.total } }, now);
    case 'status': {
      const blocked = episodeAfter(state.blocked, input.status, now);
      return flush(blocked === state.blocked ? state : { ...state, blocked }, now);
    }
    case 'tick':
      return flush(state, now);
  }
}

/**
 * When the hook should call `reduceAnnouncer(state, { type: 'tick' }, now)` next, or null
 * when nothing is deferred. The only timer the live region needs.
 */
export function nextWakeAt(state: AnnouncerState): number | null {
  const gapAt =
    state.lastAt === null ? Number.NEGATIVE_INFINITY : state.lastAt + MIN_ANNOUNCE_GAP_MS;
  const due: number[] = [];
  if (state.pending !== null) due.push(gapAt);
  const { blocked } = state;
  if (blocked !== null && !blocked.spoken) {
    due.push(Math.max(blocked.since + BLOCKED_ANNOUNCE_AFTER_MS, gapAt));
  }
  if (due.length === 0) return null;
  const at = Math.min(...due);
  // A pending count with the window already open is due now; there is no "minus infinity".
  return Number.isFinite(at) ? at : (state.lastAt ?? 0);
}

/* ── Which key a moment speaks ───────────────────────────────────────────── */

/** An announcement a caller passes to `say`: a catalog key and the values it needs. */
export interface ImmediateAnnouncement {
  readonly key: ImmediateAnnouncementKey;
  readonly params: CopyParams;
}

/**
 * A target is a name only when it has one: `''` is the page-wide edit, as `null` is.
 * Read defensively, because an untyped caller can still pass nothing at all.
 */
const named = (target: string | null | undefined): string | null =>
  typeof target !== 'string' || target.trim() === '' ? null : target;

/**
 * A run that just started. An edit says what it edits: `target` is the block's label, or
 * `null` for a page-wide edit (`EditTurn.target` absent). It is required, not optional, so
 * the caller cannot forget the page-wide case: "Started editing {target}" with no target
 * threw in development and read "Started editing " in production.
 */
export type RunStart =
  | { readonly activity: Exclude<RunActivity, 'edit'> }
  | { readonly activity: 'edit'; readonly target: string | null };

/**
 * The "run start" announcement for a routed activity (SPEC §4.3). Routing has no
 * announcement (`run.understanding` is visible only), and an answer is announced when it
 * is ready, not when it starts. A page-wide edit says `edit.startedPage` ("Started editing
 * the page"): `edit.started` needs a `{target}`, and without one it threw in development
 * and read "Started editing " in production.
 */
export function runStartAnnouncement(start: RunStart): ImmediateAnnouncement | null {
  switch (start.activity) {
    case 'build':
      return { key: 'build.started', params: {} };
    case 'edit': {
      const target = named(start.target);
      return target === null
        ? { key: 'edit.startedPage', params: {} }
        : { key: 'edit.started', params: { target } };
    }
    case 'plan':
      return { key: 'plan.drafting', params: {} };
    case 'proposal':
      return { key: 'proposal.drafting', params: {} };
    case 'routing':
    case 'answer':
      return null;
  }
}

/** An edit that just settled (`EditTurn.status`), and its target as `RunStart` takes it. */
export interface EditEnd {
  readonly status: 'done' | 'noChange' | 'stopped';
  readonly target: string | null;
}

/**
 * The announcement that ends an edit (SPEC §4.3). An edit lands in one transaction, so a
 * stopped edit changed nothing (SPEC §4.9 `edit.pageUnchanged`) and says so, target or
 * not. "{target} updated" and "Nothing changed in {target}" need their target; a
 * page-wide edit says the page's own sentences (`edit.donePage`, `edit.noChangePage`).
 */
export function editEndAnnouncement(end: EditEnd): ImmediateAnnouncement {
  if (end.status === 'stopped') return { key: 'stopped.none', params: {} };
  const target = named(end.target);
  if (target === null) {
    return { key: end.status === 'done' ? 'edit.donePage' : 'edit.noChangePage', params: {} };
  }
  return { key: end.status === 'done' ? 'edit.done' : 'edit.noChange', params: { target } };
}

/**
 * A build that just settled, as its record shows it (`BuildRecordView`): `landed` and
 * `total` count sections; `skeleton` is true while an empty layout the skeleton pass placed
 * is still on the page (`actions.removeEmpty > 0`, or `error.pageState.kind === 'skeleton'`).
 * Required, because `landed === 0` alone does not mean the page is untouched.
 */
export interface BuildEnd {
  readonly phase: BuildPhase;
  readonly stopReason?: BuildStopReason | undefined;
  readonly landed: number;
  readonly total: number;
  readonly skeleton: boolean;
}

/**
 * The announcement that ends a build (SPEC §4.3), or null for a phase that is not an
 * ending. "Page built" is decided from the counts, not trusted from the phase: it is said
 * only when every section landed (SPEC §6.5), so a mislabelled phase cannot overclaim.
 *
 * "The page wasn't changed" (`stopped.none`, `stopped.budget.none`, `failed`) is said only
 * when it is true: no section landed AND no empty layout is left. After the skeleton pass
 * the page has empty sections on it (SPEC §4.8 offers "Remove empty sections"; the
 * ErrorRecord says "The empty layout is still on the page"), so with nothing landed the
 * live region names the layout, never "unchanged":
 * - stopped, by the person or the budget: `stopped` / `stopped.budget` at 0, whose zero
 *   sentence says the empty layout is still on the page;
 * - failed: `failed.skeleton`, "Couldn't finish. The empty layout is still on the page."
 */
export function buildEndAnnouncement(end: BuildEnd): ImmediateAnnouncement | null {
  const { phase, landed, total } = end;
  const touched = landed > 0 || end.skeleton;
  switch (phase) {
    case 'done':
    case 'partial':
      return landed === total && total > 0
        ? { key: 'build.done', params: { n: landed } }
        : { key: 'build.partial', params: { n: Math.max(total - landed, 0) } };
    case 'stopped':
      if (end.stopReason === 'maxTasks') return { key: 'stopped.maxTasks', params: {} };
      if (end.stopReason === 'budget') {
        return touched
          ? { key: 'stopped.budget', params: { n: landed } }
          : { key: 'stopped.budget.none', params: {} };
      }
      return touched
        ? { key: 'stopped', params: { n: landed } }
        : { key: 'stopped.none', params: {} };
    case 'failed':
      if (landed > 0) return { key: 'failed.kept', params: {} };
      return end.skeleton ? { key: 'failed.skeleton', params: {} } : { key: 'failed', params: {} };
    case 'skeleton':
    case 'building':
    case 'stopping':
    case 'interrupted':
    case 'undone':
      return null;
  }
}
