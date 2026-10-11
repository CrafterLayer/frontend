import type {
  AiBuildSectionValues,
  AiChatTurn,
  AiPlan,
  AiRunFailure,
  AiSkillActivationPin,
  AiValidatedProposal,
  DroppedAiPlanStep,
  PagePlan,
} from '@craftkit/builder';

import type { BuildProgress } from './build-progress';
import type { RunProgress } from './run-progress';
import type { RunTelemetryState } from './run-telemetry';
import { readRunTelemetry } from './run-telemetry';
import type { SectionOutcome } from './run-view';
import {
  TURN_KINDS,
  type AssistantMode,
  type ChangeLineView,
  type EditOrigin,
  type EndNoteKey,
  type ErrorPageState,
  type PlanDirectionView,
  type PlanNote,
  type SessionSummary,
  type TurnKind,
} from './view-types';

/**
 * The conversation, as it is kept and saved (SPEC §7.4 `AssistantPanel.turns.ts` row).
 *
 * Copied from the v1 module, then changed where SPEC §7.4 says:
 * - The union is v2: one kind per thing a person can see in the thread (`user`, `build`,
 *   `edit`, `answer`, `page-plan`, `step-plan`, `proposal`, `error`, `end`), the same nine
 *   kinds `TurnView` renders. v1 had kinds for moments of a run (`thinking`, `building`,
 *   `built`, `stopped`, `refused`, `discarded`) and each card re-derived what it was.
 * - History actions are keyed by TRANSACTION ID. v1 kept `undoneFrom` (a position) and
 *   `undoneSteps` (a count of kernel undos) and undid by looping `kernel.undo()`, which
 *   reached whatever was newest, including a later build's sections. A section's
 *   outcome is now stored under the id of the one transaction that landed it.
 * - `ThinkingTurn.progressLog` (the provider's narration, never shown: SPEC §4.9) and
 *   `PlanTurn.costTokens` (telemetry, not UI) are gone.
 * - Stored under `pg-agent-sessions-v2`; `migrate-sessions.ts` reads the v1 key.
 *
 * Kept: `Session`, `historyOf`, `withUniqueTurnIds`, `highestIdSuffix`, and the revive
 * rule behind all of them: storage can be missing, blocked or stale, and a reload ends
 * every run and every runtime authority. A spinner nothing will resolve, an Undo whose
 * kernel history died with the tab, an Apply with no validated proposal behind it: each
 * is a lie, and `reviveTurn` is where each one is closed.
 *
 * Pure data and pure functions: no React, no kernel, no clock.
 */

/** The v2 storage key. The v1 key is read by `migrate-sessions.ts` and never written. */
export const SESSIONS_KEY = 'pg-agent-sessions-v2';

/* ── Turns ───────────────────────────────────────────────────────────────── */

/**
 * The context a request was sent with (SPEC §4.5, FR-024): the page scope, or the blocks
 * it named, with the label they had when it was sent. `UserMessageView.chips` adds
 * `stale` at render time; a sent message never changes its own words.
 */
export type SentContext =
  | { readonly kind: 'page' }
  | { readonly kind: 'selection' | 'mention'; readonly id: string; readonly label: string };

/** The person's own turn (SPEC §4.5). */
export interface UserTurn {
  readonly id: string;
  readonly kind: 'user';
  readonly text: string;
  readonly context: readonly SentContext[];
  /** Its run was stopped before any output (SPEC §4.5 `message.notRun`). */
  readonly notRun?: true | undefined;
}

/**
 * What became of a landed change after it landed: a build section's row Undo, or an
 * edit's Undo (SPEC §4.8, §4.9). Stored under `outcomeKeyOf(section)`: the id of the
 * transaction that LANDED it. It IS `run-view.ts`'s `SectionOutcome`, one type and not two
 * copies (a copy drifted once: `undone` lost its optional id here and kept a required one
 * there, and `BuildTurn.outcomes` stopped compiling as `BuildRecordInput['outcomes']`), so
 * the controller hands `BuildTurn.outcomes` over as it is (`turns.test.ts` compiles that).
 */
export type LandingOutcome = SectionOutcome;

/** What the model left behind when validation salvaged part of a plan (SPEC §4.13 partial). */
export interface Salvage {
  readonly kept: number;
  readonly dropped: readonly DroppedAiPlanStep[];
}

/**
 * A page build (SPEC §4.8). `progress` is the build reducer's own state
 * (`build-progress.ts`); this turn adds what happened AROUND the run:
 * - `status`: `running` while live; `settled` once the engine ended it (done, partial or
 *   stopped: `progress.phase` and `progress.report` say which); `failed` when the whole
 *   run threw (`failure`); `interrupted` when a reload killed it mid-build.
 * - `stopping`: Stop was pressed and the engine has not settled yet.
 * - `outcomes`: row Undo / Redo after `build.completed`, by landing transaction id.
 * - `undone`: Undo build ran (SPEC §4.8 phase `undone`).
 * - `revived`: read back from storage, so the kernel history its Undo needs is gone.
 */
export interface BuildTurn {
  readonly telemetry?: RunTelemetryState;
  readonly id: string;
  readonly kind: 'build';
  readonly request: string;
  readonly progress: BuildProgress;
  readonly status: 'running' | 'settled' | 'failed' | 'interrupted';
  readonly stopping?: true | undefined;
  readonly failure?: AiRunFailure | undefined;
  readonly outcomes: Readonly<Record<string, LandingOutcome>>;
  readonly undone?: true | undefined;
  readonly revived?: true | undefined;
  readonly followUp?: string | undefined;
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
  /*
    WP-16 additions, all plain data so they survive a reload:
  */
  /**
   * Each region's writer-owned props as the skeleton laid them, read at `build.planned`.
   * What "Remove empty sections" compares against (`removeUnfilledSections` removes only a
   * region that still holds its placeholder), so the action works after a reload too: the
   * engine's own `result.unfilled` dies with the run.
   */
  readonly placeholders?: Readonly<Record<string, AiBuildSectionValues>> | undefined;
  /** `removeUnfilledSections` ran: every unfilled region is gone from the page. */
  readonly placeholdersRemoved?: true | undefined;
  /** The page plan this build was built from: successor runs read each section's contract. */
  readonly pagePlan?: PagePlan | undefined;
  /**
   * Every transaction this build landed, oldest first (skeleton, sections, the page's
   * direction). Undo build walks exactly these back while they are the newest history
   * entries (SPEC §7.6 E3 fallback).
   */
  readonly transactionIds?: readonly string[] | undefined;
}

/**
 * One edit run (SPEC §4.9): a request run directly, the `build.skipped` fallback, a step
 * plan that ran, or an Ask proposal that was applied (`origin: 'proposal'`).
 * `changes` is computed once, when the plan arrives (`impactLines`), because the honest
 * source is a rehearsal on a scratch kernel: the right price once per plan, the wrong one
 * per render. `transactionId` is the one transaction that applied it; `outcome` is its
 * Undo / Redo since. `summary` is the plan's rationale, the assistant's words for
 * `historyOf`, never rendered.
 */
export interface EditTurn {
  readonly id: string;
  readonly kind: 'edit';
  readonly request?: string | undefined;
  readonly origin: EditOrigin;
  readonly status: 'running' | 'done' | 'noChange' | 'stopped';
  readonly stopping?: true | undefined;
  readonly mode?: AssistantMode | undefined;
  /** The target block's label when it was sent; absent: "Editing the page". */
  readonly target?: string | undefined;
  readonly targetNodeId?: string | undefined;
  /** The live rows (`run-progress.ts`); the RunBar reads the stage key from them. */
  readonly run?: RunProgress | undefined;
  /** The final time, once settled. */
  readonly elapsedMs?: number | undefined;
  readonly changes: readonly ChangeLineView[];
  readonly summary?: string | undefined;
  readonly followUp?: string | undefined;
  readonly salvaged?: Salvage | undefined;
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
  readonly transactionId?: string | undefined;
  readonly outcome?: LandingOutcome | undefined;
  readonly revived?: true | undefined;
}

/** A words-only answer to a `question` intent; the page did not change (SPEC §4.10). */
export interface AnswerTurn {
  readonly id: string;
  readonly kind: 'answer';
  readonly text: string;
  readonly request?: string | undefined;
  readonly followUp?: string | undefined;
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
}

/** One section of a page plan (SPEC §4.11); `key` is stable across rename and move. */
export interface PlanSection {
  readonly key: string;
  readonly title: string;
  readonly purpose?: string | undefined;
}

/**
 * The page plan, a decision surface (SPEC §4.11): Plan mode's answer to a page request,
 * and Ask mode's one approval. On Build the same turn id becomes a `build` turn, so the
 * list inks in place (SPEC §5 moment 4); on Discard or a newer plan, an `end` turn.
 * - `approval`: Ask mode. The build is paused at the engine's `onPlanned` question and
 *   `heldBuild` is its progress so far, so Build answers that question and exactly these
 *   sections land (`note: 'exact'`). Both are runtime-only: a reload ends the run that
 *   asked, so revival drops them and Build re-plans (`note: 'mayDiffer'`).
 * - `editable`: false for the read-only fallback (SPEC §7.6 E6) and for v1 outlines.
 * - `pageTouched`: the run wrote before approval (SPEC §7.6 E0c): the honesty line goes.
 * - `enginePlan`: the engine's validated `PagePlan` the card was drawn from (SPEC §7.6 E6).
 *   `subject`, `sections` and `direction` are the person's edits of it, and Build hands
 *   `toEnginePagePlan` of the two to `runAiBuild({ pagePlan })`, so exactly these sections
 *   are built. Plain frozen data, so it survives a reload: a revived plan that carries it
 *   still builds as shown (`note` stays `exact`).
 * - `unsure`: planned instead of built because the router was unsure it was a page at all
 *   and the clarify check failed (`isUnsureBuild`). The card is the question: a newer
 *   request is its own request, routed and checked on its own words, never merged into
 *   this plan as a change to it (which would build a page from a misreading).
 */
export interface PagePlanTurn {
  readonly id: string;
  readonly kind: 'page-plan';
  readonly request?: string | undefined;
  readonly status: 'drafting' | 'ready';
  readonly subject: string;
  readonly direction?: PlanDirectionView | undefined;
  readonly sections: readonly PlanSection[];
  readonly enginePlan?: PagePlan | undefined;
  readonly note: PlanNote;
  readonly editable: boolean;
  readonly edited?: true | undefined;
  readonly approval?: true | undefined;
  readonly heldBuild?: BuildProgress | undefined;
  readonly pageTouched?: true | undefined;
  readonly unsure?: true | undefined;
  readonly followUp?: string | undefined;
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
}

/** One read-only step of a change plan (SPEC §4.12), naming its target block when known. */
export interface PlanStep {
  readonly key: string;
  readonly text: string;
  readonly target?: string | undefined;
}

/**
 * Plan mode's answer to an edit request (SPEC §4.12): steps, then "Run this plan".
 * `text` is the plan as the model wrote it, kept whole for `historyOf`; `dropped` counts
 * the commands it proposed anyway and this run refused to keep.
 */
export interface StepPlanTurn {
  readonly id: string;
  readonly kind: 'step-plan';
  readonly request?: string | undefined;
  readonly status: 'drafting' | 'ready';
  readonly steps: readonly PlanStep[];
  readonly text: string;
  readonly dropped: number;
  readonly followUp?: string | undefined;
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
}

/**
 * Ask mode's proposed edit (SPEC §4.13). `plan` is plain data (View as code, history);
 * `proposal` is the runtime authority that Apply spends, and it deliberately cannot
 * survive JSON: revival drops it, so a revived proposal is readable and inert
 * (`revived`). On Apply the turn becomes an `edit` with `origin: 'proposal'`.
 */
export interface ProposalTurn {
  readonly id: string;
  readonly kind: 'proposal';
  readonly request?: string | undefined;
  readonly status: 'drafting' | 'ready';
  readonly mode?: AssistantMode | undefined;
  readonly target?: string | undefined;
  readonly targetNodeId?: string | undefined;
  readonly plan?: AiPlan | undefined;
  readonly proposal?: AiValidatedProposal | undefined;
  readonly changes: readonly ChangeLineView[];
  readonly salvaged?: Salvage | undefined;
  readonly run?: RunProgress | undefined;
  readonly elapsedMs?: number | undefined;
  readonly pageTouched?: true | undefined;
  readonly followUp?: string | undefined;
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
  readonly revived?: true | undefined;
}

/**
 * What an error turn knows about the page: exactly the view's `ErrorPageState`, `unknown`
 * included (one v1 shape: its build path replaced a failed build's turn, progress and all,
 * with the error, so what landed first was never kept). One type, so the stored state
 * reaches `errorRecordView` as it is.
 */
export type ErrorTurnPageState = ErrorPageState;

/**
 * A run that failed as a whole (SPEC §4.14). `failure` is the engine's classified data;
 * its text reaches only the clipboard and Technical details, never the screen. The
 * record's class is always READ from it (`failure-class.ts`), never stored beside it: a
 * stored class once pinned "declined" on a v1 "could not be reached", and a 429, which
 * then offered no Try again. `offline` is `navigator.onLine === false` when it failed.
 */
export interface ErrorTurn {
  readonly id: string;
  readonly kind: 'error';
  readonly request?: string | undefined;
  readonly failure: AiRunFailure;
  readonly offline?: true | undefined;
  readonly pageState: ErrorTurnPageState;
  readonly elapsedMs?: number | undefined;
}

/** A turn that ended in one line (SPEC §4.10 EndNote). */
export interface EndTurn {
  readonly id: string;
  readonly kind: 'end';
  readonly key: EndNoteKey;
}

export type Turn = (
  | UserTurn
  | BuildTurn
  | EditTurn
  | AnswerTurn
  | PagePlanTurn
  | StepPlanTurn
  | ProposalTurn
  | ErrorTurn
  | EndTurn
) & { readonly telemetry?: RunTelemetryState };

/**
 * One conversation. `title` is its first request, whole (HistoryRow ellipsizes it);
 * `updatedAt` is epoch ms of the last change, null for a conversation migrated from v1,
 * which never recorded one (SPEC §4.18 `SessionSummary`).
 */
export interface Session {
  readonly id: string;
  readonly title: string;
  readonly turns: readonly Turn[];
  readonly updatedAt: number | null;
}

/**
 * What `pg-agent-sessions-v2` holds.
 * - `mode`: the mode the person last used. It is saved because a reload that silently
 *   returned to a mode that writes, after the person chose Plan, changed what the panel
 *   may do without telling them.
 * - `modeChosen`: the person CHOSE `mode`, rather than it being the default the panel
 *   happened to save; only a chosen mode outlives a change of default.
 */
export interface PersistedAgentState {
  readonly version: 2;
  readonly sessions: readonly Session[];
  readonly activeId: string;
  readonly mode?: AssistantMode | undefined;
  readonly modeChosen?: true | undefined;
}

/* ── Kept helpers ────────────────────────────────────────────────────────── */

/** The highest `-N` suffix of any session or turn id, so new ids continue after it. */
export function highestIdSuffix(sessions: readonly Session[]): number {
  let highest = 1;
  const consider = (id: string): void => {
    const match = /-(\d+)$/u.exec(id);
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]));
  };
  for (const session of sessions) {
    consider(session.id);
    for (const turn of session.turns) consider(turn.id);
  }
  return highest;
}

/** The assistant's own words for one turn, or null when it said nothing the model needs. */
function assistantWords(turn: Exclude<Turn, UserTurn>): string | null {
  switch (turn.kind) {
    case 'build':
      return turn.progress.direction;
    case 'edit':
      return turn.summary ?? null;
    case 'proposal':
      return turn.plan?.rationale ?? null;
    case 'page-plan':
      return turn.direction?.mood ?? null;
    case 'step-plan':
      /*
        The plan the assistant just wrote IS the answer, so it belongs in the history.
        Dropping it meant a person could say "do option two" and the next request arrived
        without the answer that had the options in it.
      */
      return turn.text;
    case 'answer':
      return turn.text;
    case 'error':
      return turn.failure.message;
    case 'end':
      return null;
  }
}

/**
 * A run whose plan proposed no command but has words (its rationale, or a follow-up to
 * send next) is the model answering, most often asking what was meant. It is recorded as
 * an answer, never as an edit that "already matched what you asked for": that line
 * (`edit.noChange`) is for commands that landed and moved nothing, a verified no-op, and
 * said of words alone it is a false claim. Null when the plan acts, or says nothing.
 */
export function answerFromPlan(input: {
  readonly id: string;
  readonly request?: string | undefined;
  readonly plan: {
    readonly rationale: string;
    readonly commands: readonly unknown[];
    readonly followUp?: string | undefined;
  };
  readonly skills?: readonly AiSkillActivationPin[] | undefined;
}): AnswerTurn | null {
  const { plan } = input;
  if (plan.commands.length > 0) return null;
  const rationale = plan.rationale.trim();
  const followUp = plan.followUp?.trim() ?? '';
  if (rationale === '' && followUp === '') return null;
  return {
    id: input.id,
    kind: 'answer',
    text: rationale === '' ? followUp : rationale,
    ...(input.request === undefined ? {} : { request: input.request }),
    ...(followUp === '' ? {} : { followUp }),
    ...(input.skills === undefined ? {} : { skills: input.skills }),
  };
}

/** The newest 12 exchanges, for the next request's context. Empty lines are never sent. */
export function historyOf(turns: readonly Turn[]): AiChatTurn[] {
  return turns
    .flatMap<AiChatTurn>((turn) => {
      if (turn.kind === 'user') return [{ role: 'user', text: turn.text }];
      const text = assistantWords(turn);
      return text === null || text.trim() === '' ? [] : [{ role: 'assistant', text }];
    })
    .slice(-12);
}

/**
 * Saved conversations from before ids continued across reloads can hold two turns with
 * one id. React keys must be unique, so the later twin is re-keyed once, on revival;
 * nothing else refers to a settled turn by id.
 */
export function withUniqueTurnIds(sessions: readonly Session[]): readonly Session[] {
  const seen = new Set<string>();
  let repaired = highestIdSuffix(sessions);
  return sessions.map((session) => ({
    ...session,
    turns: session.turns.map((turn) => {
      if (!seen.has(turn.id)) {
        seen.add(turn.id);
        return turn;
      }
      repaired += 1;
      const id = `turn-${String(repaired)}`;
      seen.add(id);
      return { ...turn, id };
    }),
  }));
}

/**
 * A conversation's title: its first request, whole (SPEC §4.18 HistoryRow ellipsizes
 * it). v1 cut titles at 32 characters and called an empty one "New chat" in English; an
 * empty conversation has no title here, and the row says so in the UI's own language.
 */
export function titleOf(turns: readonly Turn[]): string {
  return turns.find((turn): turn is UserTurn => turn.kind === 'user')?.text.trim() ?? '';
}

/** The conversations list for HistoryPopover (SPEC §4.18), in saved order. */
export function sessionSummaries(
  sessions: readonly Session[],
  activeId: string,
): readonly SessionSummary[] {
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    current: session.id === activeId,
  }));
}

/**
 * The key a section's outcome is stored under in `BuildTurn.outcomes`: the id of the
 * transaction that landed it. A v1 section never recorded one, so the migration keys it
 * by its section id under a prefix no kernel transaction id can collide with.
 */
export function outcomeKeyOf(section: {
  readonly id: string;
  readonly landing?: { readonly transactionId: string } | undefined;
}): string {
  return section.landing?.transactionId ?? `v1-section:${section.id}`;
}

/* ── Revival ─────────────────────────────────────────────────────────────── */

const interrupted = (id: string): EndTurn => ({ id, kind: 'end', key: 'interrupted' });

/** A copy of `value` without `keys`: the fields a reload must not carry forward. */
function without<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const dropped: ReadonlySet<PropertyKey> = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !dropped.has(key))) as Omit<
    T,
    K
  >;
}

/**
 * One saved turn, revived. A reload ends every run and every runtime authority:
 * - a run still going (a build before its list, an edit, a draft) becomes "Interrupted by
 *   a page reload", because a spinner nothing will ever resolve is a lie;
 * - a build that had its list becomes `interrupted` and keeps its rows: what landed was a
 *   real transaction and is on the page, and the rest can be finished;
 * - every build and edit is `revived`, because the kernel history its Undo walks belongs
 *   to the session that made it, and this one has none;
 * - a proposal loses its authority and an Ask plan its held question: nothing can answer
 *   a question a dead run asked.
 * Idempotent: reviving a revived turn changes nothing.
 */
export function reviveTurn(turn: Turn): Turn {
  if (turn.telemetry === undefined) return reviveTurnRecord(turn);
  const telemetry = readRunTelemetry(turn.telemetry);
  // Removing an optional field preserves each turn's discriminated variant.
  const revived = reviveTurnRecord(without(turn, ['telemetry']) as Turn);
  return telemetry === undefined ? revived : { ...revived, telemetry };
}

function reviveTurnRecord(turn: Turn): Turn {
  switch (turn.kind) {
    case 'build': {
      const rest = without(turn, ['stopping']);
      if (turn.status !== 'running') return { ...rest, revived: true };
      /*
        A build that never got a section list is an ordinary interruption and reads as
        one: a record saying "0/0" would be a record about nothing.
      */
      if (turn.progress.tasks.length === 0) return interrupted(turn.id);
      return { ...rest, status: 'interrupted', revived: true };
    }
    case 'edit': {
      if (turn.status === 'running') return interrupted(turn.id);
      return { ...without(turn, ['stopping']), revived: true };
    }
    case 'proposal': {
      if (turn.status === 'drafting') return interrupted(turn.id);
      // A JSON clone does not carry the module-private authentication of a live proposal.
      return { ...without(turn, ['proposal']), revived: true };
    }
    case 'page-plan': {
      if (turn.status === 'drafting') return interrupted(turn.id);
      if (turn.approval === undefined && turn.heldBuild === undefined) return turn;
      /*
        The held question died with its run. A plan that carries the engine's structured
        plan is built from it verbatim by a new run, so it still builds as shown; one that
        does not can only be re-planned, and says the page may differ.
      */
      return {
        ...without(turn, ['approval', 'heldBuild']),
        note: turn.enginePlan === undefined ? 'mayDiffer' : 'exact',
      };
    }
    case 'step-plan':
      return turn.status === 'drafting' ? interrupted(turn.id) : turn;
    case 'user':
    case 'answer':
    case 'error':
    case 'end':
      return turn;
  }
}

const KNOWN_KINDS: ReadonlySet<string> = new Set<TurnKind>(TURN_KINDS);
const MODES: ReadonlySet<string> = new Set<AssistantMode>(['ask', 'auto', 'plan']);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What each kind's record cannot render without. Not a full schema: the data is ours, and
 * this only has to stop one hand-edited or half-written turn from throwing while the whole
 * store is revived, or later while its record renders.
 */
const REQUIRED: Readonly<
  Record<TurnKind, readonly (readonly [string, 'string' | 'array' | 'object'])[]>
> = {
  user: [
    ['text', 'string'],
    ['context', 'array'],
  ],
  build: [
    ['request', 'string'],
    ['status', 'string'],
    ['progress', 'object'],
    ['outcomes', 'object'],
  ],
  edit: [
    ['origin', 'string'],
    ['status', 'string'],
    ['changes', 'array'],
  ],
  answer: [['text', 'string']],
  'page-plan': [
    ['status', 'string'],
    ['subject', 'string'],
    ['sections', 'array'],
    ['note', 'string'],
  ],
  'step-plan': [
    ['status', 'string'],
    ['steps', 'array'],
    ['text', 'string'],
  ],
  proposal: [
    ['status', 'string'],
    ['changes', 'array'],
  ],
  error: [
    ['failure', 'object'],
    ['pageState', 'object'],
  ],
  end: [['key', 'string']],
};

const recordField = (value: unknown, field: string): unknown =>
  isRecord(value) ? value[field] : undefined;

function fieldIs(value: unknown, type: 'string' | 'array' | 'object'): boolean {
  if (type === 'array') return Array.isArray(value);
  return type === 'object' ? isRecord(value) : typeof value === type;
}

/** A saved turn this version can read: an id, a kind it knows, and what that kind needs. */
function isTurn(value: unknown): value is Turn {
  if (!isRecord(value) || typeof value['id'] !== 'string') return false;
  const kind = String(value['kind']);
  if (!KNOWN_KINDS.has(kind)) return false;
  const needs = REQUIRED[kind as TurnKind];
  if (!needs.every(([field, type]) => fieldIs(value[field], type))) return false;
  // A build's rows are its record; without a list there is nothing to revive or render.
  return kind !== 'build' || Array.isArray(recordField(value['progress'], 'tasks'));
}

/** An assistant mode, or undefined for anything else: the caller owns the default. */
export function modeOf(value: unknown): AssistantMode | undefined {
  return typeof value === 'string' && MODES.has(value) ? (value as AssistantMode) : undefined;
}

function sessionOf(value: unknown): Session | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  // Checked through `unknown`: Array.isArray on a typed field would widen it to any[].
  const turns: unknown = value['turns'];
  if (!Array.isArray(turns)) return null;
  const updatedAt: unknown = value['updatedAt'];
  return {
    id: value['id'],
    title: typeof value['title'] === 'string' ? value['title'] : '',
    // A turn this version cannot read is dropped, not rendered: one unknown shape must
    // not take the whole thread down with it.
    turns: (turns as readonly unknown[]).filter(isTurn).map(reviveTurn),
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null,
  };
}

/**
 * Revive `pg-agent-sessions-v2`, defensively: storage can be missing, blocked, stale or
 * hand-edited. Null means "nothing usable", and the panel starts a fresh conversation.
 * The active conversation falls back to the first when the saved one is gone; only a
 * literal `true` marks a chosen mode.
 */
export function reviveState(raw: unknown): PersistedAgentState | null {
  if (!isRecord(raw) || typeof raw['activeId'] !== 'string') return null;
  const listed: unknown = raw['sessions'];
  if (!Array.isArray(listed)) return null;
  const sessions = withUniqueTurnIds(
    (listed as readonly unknown[]).map(sessionOf).filter((session) => session !== null),
  );
  const first = sessions[0];
  if (first === undefined) return null;
  const activeId = sessions.some((session) => session.id === raw['activeId'])
    ? raw['activeId']
    : first.id;
  const mode = modeOf(raw['mode']);
  return {
    version: 2,
    sessions,
    activeId,
    ...(mode === undefined ? {} : { mode }),
    ...(raw['modeChosen'] === true ? { modeChosen: true } : {}),
  };
}
