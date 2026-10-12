import type { BuilderDocument } from '@craftkit/builder';

import type { BuildTask } from './build-progress';
import { creativeBriefView } from './creative-brief';
import { draftFromEnginePagePlan, planDraftOf, planFields } from './page-plan-draft';
import { initialRunProgress } from './run-progress';
import {
  answerRecordView,
  buildRecordInputOf,
  buildRecordView,
  editRecordView,
  errorRecordInputOf,
  errorRecordView,
  type BuildHistoryInput,
  type EditRecordInput,
  type RunViewContext,
} from './run-view';
import type {
  BuildTurn,
  EditTurn,
  PagePlanTurn,
  ProposalTurn,
  SentContext,
  Turn,
  UserTurn,
} from './turns';
import type {
  BuildRecordView,
  ContextChipView,
  EditRecordView,
  PlanView,
  ProposalView,
  RecordMenuItem,
  TurnView,
  UserMessageView,
} from './view-types';

/**
 * Stored turns → the views TurnView renders (SPEC §7.3), every kind of SPEC §7.4's union.
 *
 * `run-view.ts` owns the records (build, edit, error, answer) and every honesty rule about
 * what a record says; this module adds the turns it does not draw (the person's bubble,
 * the plan cards, the proposal, the endings) and the facts only the live session knows,
 * which `turns.ts` deliberately does not store: where each build and edit sits in the
 * kernel's history right now, which proposal is being previewed, and which turn is the
 * newest (older builds fold, SPEC §4.4).
 *
 * Three readings are decided here, once:
 * - A section the skeleton wrote in full (a page-plan header or footer) has a landing
 *   with nothing recorded from before it; `revertBuildSection` refuses it as `not-landed`.
 *   Its row offers no Undo at all, rather than one that says "never landed" about a
 *   section on the page (the v1 panel did, `AssistantPanel.test.tsx` "a page-plan build").
 * - A proposal read back from storage has no authority behind its Apply (`reviveTurn`
 *   drops it), so it is not a decision any more: it reads as "Interrupted by a page
 *   reload", and suggestions return, instead of an Apply that can do nothing.
 * - An edit's Undo is a kernel undo of its one transaction, offered only while that
 *   transaction is the newest history entry. After a later change it is not offered at
 *   all (nor its Redo), rather than undoing the later change: the only reason the copy
 *   has, `revert.changedSince` ("this section changed after it was built"), is a build
 *   row's, and said under an edit it was false (a row Undo on section 3 put it under an
 *   unrelated title edit on section 2).
 *
 * Pure: the document and the history answers come in through the context.
 */

export interface TurnViewContext extends RunViewContext {
  /** The live document: a sent chip whose block is gone is struck through. */
  readonly document: BuilderDocument;
  /** Where a settled build sits in kernel history now (Undo build / Redo build). */
  readonly buildHistory?: ((turn: BuildTurn) => BuildHistoryInput | undefined) | undefined;
  /** Whether an applied edit's one transaction can be undone (or redone) right now. */
  readonly editHistory?:
    | ((turn: EditTurn) => { readonly canUndo: boolean; readonly canRedo: boolean } | undefined)
    | undefined;
  /** The proposal shown on the canvas now, by turn id. */
  readonly previewing?: string | null | undefined;
}

/* ── The person's turn ───────────────────────────────────────────────────────── */

function chipOf(entry: SentContext, document: BuilderDocument): ContextChipView {
  return entry.kind === 'page'
    ? { kind: 'page', id: 'page' }
    : {
        kind: entry.kind,
        id: entry.id,
        label: entry.label,
        stale: document.nodes[entry.id] === undefined,
      };
}

export function userMessageView(turn: UserTurn, document: BuilderDocument): UserMessageView {
  return {
    turnId: turn.id,
    text: turn.text,
    // The page scope is the default a bubble need not repeat; its blocks are the context.
    chips: turn.context
      .filter((entry) => entry.kind !== 'page')
      .map((entry) => chipOf(entry, document)),
    notRun: turn.notRun === true,
  };
}

/* ── Builds ─────────────────────────────────────────────────────────────────── */

/** A task without a landing it cannot be put back from (nothing recorded from before). */
function honestTask(task: BuildTask): BuildTask {
  const landing = task.landing;
  if (landing === undefined || Object.keys(landing.before).length > 0) return task;
  const { landing: _landing, ...rest } = task;
  void _landing;
  return rest;
}

function buildInput(turn: BuildTurn, collapsed: boolean, context: TurnViewContext) {
  const tasks = turn.progress.tasks;
  const honest = tasks.some((task) => honestTask(task) !== task)
    ? { ...turn, progress: { ...turn.progress, tasks: tasks.map(honestTask) } }
    : turn;
  const history = context.buildHistory?.(turn);
  return {
    ...buildRecordInputOf(honest),
    ...(history === undefined ? {} : { history }),
    // The list was saved, so the rest can be finished (SPEC §4.8 interrupted).
    resumable: tasks.length > 0,
    placeholdersRemoved: turn.placeholdersRemoved === true,
    collapsed: collapsed && turn.status !== 'running',
    laterPageChanges: false,
  };
}

/**
 * A build turn's view. A build that never got its section list is an ending, not a
 * record; a build the skeleton could not split (`build.skipped`) is an edit while its one
 * run goes on (the controller turns it into an edit or a proposal when it settles).
 * `collapsed`: a newer exchange exists, so the record folds to its head (SPEC §4.4).
 */
export function buildTurnView(
  turn: BuildTurn,
  collapsed: boolean,
  context: TurnViewContext,
): TurnView {
  if (turn.progress.phase === 'fallback') {
    const edit: EditRecordView = {
      turnId: turn.id,
      phase: turn.status === 'running' ? 'running' : 'stopped',
      origin: 'request',
      changes: [],
      menu: [],
      ...(turn.status === 'running' ? { stage: 'edit.writing' as const } : {}),
    };
    return { kind: 'edit', view: edit };
  }
  const view: BuildRecordView | null = buildRecordView(
    buildInput(turn, collapsed, context),
    context,
  );
  if (view === null) {
    return {
      kind: 'end',
      view: {
        turnId: turn.id,
        key:
          turn.revived === true || turn.status === 'interrupted'
            ? 'interrupted'
            : 'stoppedBeforeChange',
      },
    };
  }
  // Remove empty needs the placeholders the skeleton laid; a build that never recorded
  // them (v1 data) cannot tell an empty region from one written by hand, so it offers none.
  const canRemove = turn.placeholders !== undefined;
  const removable = canRemove ? view : { ...view, actions: { ...view.actions, removeEmpty: 0 } };
  // T230: one page of a site build names its page in the record's head.
  const paged = turn.page === undefined ? removable : { ...removable, page: turn.page };
  return {
    kind: 'build',
    // creative agent (2026-10-12): a game or story build shows the brief its writers read.
    view: turn.creative === true ? { ...paged, brief: creativeBriefView(turn.request) } : paged,
  };
}

/* ── Edits ──────────────────────────────────────────────────────────────────── */

export function editTurnView(turn: EditTurn, context: TurnViewContext): EditRecordView {
  const run = turn.run ?? initialRunProgress('auto', 0);
  const endedAt = run.startedAt + (turn.elapsedMs ?? 0);
  const outcome = turn.outcome;
  const settled = turn.status === 'done' || turn.status === 'noChange';
  const transactionId = outcome?.kind === 'redone' ? outcome.transactionId : turn.transactionId;
  const history = context.editHistory?.(turn);
  const undone =
    outcome?.kind === 'undone' && outcome.transactionId !== undefined
      ? { transactionId: outcome.transactionId }
      : undefined;
  /*
    The refusal reasons (`revert.changedSince` / `revert.regionMissing`) are a build
    row's, about a section. An edit is never refused live (its Undo is simply not offered
    once buried), so a refused outcome here is stored data: it reads as buried, with no
    Undo and no build-row reason under the edit (see the header).
  */
  const refused = outcome?.kind === 'refused';
  // Something landed on top since: a kernel undo would take it too (see the header).
  const buried =
    refused ||
    (turn.status === 'done' &&
      undone === undefined &&
      turn.revived !== true &&
      history !== undefined &&
      !history.canUndo);
  const input: EditRecordInput = {
    turnId: turn.id,
    origin: turn.origin,
    ...(turn.target === undefined ? {} : { target: turn.target }),
    run,
    revived: turn.revived === true,
    ...(settled
      ? {
          applied: {
            changes: turn.changes,
            ...(transactionId === undefined ? {} : { transactionId }),
            ...(turn.status === 'noChange' ? { empty: true } : {}),
            ...(turn.targetNodeId === undefined ? {} : { revealNodeId: turn.targetNodeId }),
            at: endedAt,
          },
        }
      : {}),
    ...(turn.status === 'stopped' ? { stopped: { at: endedAt } } : {}),
    ...(undone === undefined ? {} : { undone }),
    laterPageChanges: false,
  };
  const view = editRecordView(input, context);
  // Redo is a kernel redo too: once something else landed, it would redo nothing true.
  const redoGone = view.undo?.kind === 'redo' && history !== undefined && !history.canRedo;
  if ((buried && view.undo?.kind === 'undo') || redoGone) {
    const { undo: _undo, ...rest } = view;
    void _undo;
    return rest;
  }
  return view;
}

/* ── Decisions ──────────────────────────────────────────────────────────────── */

export function planTurnView(turn: PagePlanTurn, context: TurnViewContext): PlanView {
  const editable =
    turn.editable && context.capabilities.editablePlan && turn.enginePlan !== undefined;
  const common = {
    turnId: turn.id,
    status: turn.status,
    approval: turn.approval === true,
    editable,
    note: turn.note,
  } as const;
  if (turn.status === 'drafting') {
    return { ...common, edited: false, subject: turn.subject, sections: [], problems: [] };
  }
  const draft = planDraftOf(turn);
  const original = turn.enginePlan === undefined ? draft : draftFromEnginePagePlan(turn.enginePlan);
  return { ...common, ...planFields(original, draft) };
}

function technical(context: RunViewContext): readonly RecordMenuItem[] {
  return context.developer ? ['technical'] : [];
}

export function proposalTurnView(turn: ProposalTurn, context: TurnViewContext): ProposalView {
  const ready = turn.status === 'ready';
  const dropped = turn.salvaged?.dropped.length ?? 0;
  return {
    turnId: turn.id,
    status: turn.status,
    ...(turn.target === undefined ? {} : { target: turn.target }),
    changes: turn.changes,
    // The honesty line: only while unapplied and the run wrote nothing (SPEC §6.5).
    pageUnchanged: ready && turn.pageTouched !== true,
    previewing: context.previewing === turn.id,
    ...(turn.salvaged !== undefined && dropped > 0
      ? { partial: { kept: turn.salvaged.kept, total: turn.salvaged.kept + dropped } }
      : {}),
    menu: ready ? ['viewAsCode', 'reuse', ...technical(context)] : [],
  };
}

/* ── Every turn ─────────────────────────────────────────────────────────────── */

/**
 * One turn's view. `collapsed` is true when a newer exchange follows it: only the newest
 * build shows its whole spine (SPEC §3.12), and an end note after a build is part of that
 * build's exchange, never a reason to fold it.
 */
function recordViewOf(turn: Turn, collapsed: boolean, context: TurnViewContext): TurnView {
  switch (turn.kind) {
    case 'user':
      return { kind: 'user', view: userMessageView(turn, context.document) };
    case 'build':
      return buildTurnView(turn, collapsed, context);
    case 'edit':
      return { kind: 'edit', view: editTurnView(turn, context) };
    case 'answer':
      return { kind: 'answer', view: answerRecordView(turn.id, turn.text, context) };
    case 'page-plan':
      return { kind: 'page-plan', view: planTurnView(turn, context) };
    case 'step-plan':
      return {
        kind: 'step-plan',
        view: { turnId: turn.id, status: turn.status, steps: turn.steps },
      };
    case 'proposal':
      // No authority behind Apply (read back after a reload): not a decision any more.
      if (turn.status === 'ready' && turn.proposal === undefined) {
        return { kind: 'end', view: { turnId: turn.id, key: 'interrupted' } };
      }
      return { kind: 'proposal', view: proposalTurnView(turn, context) };
    case 'error':
      return { kind: 'error', view: errorRecordView(errorRecordInputOf(turn), context) };
    case 'end':
      return { kind: 'end', view: { turnId: turn.id, key: turn.key } };
  }
}

export function turnViewOf(turn: Turn, collapsed: boolean, context: TurnViewContext): TurnView {
  const view = recordViewOf(turn, collapsed, context);
  return turn.telemetry === undefined ? view : { ...view, telemetry: turn.telemetry };
}

/** A conversation's turns as the thread renders them, newest last. */
export function turnViewsOf(turns: readonly Turn[], context: TurnViewContext): readonly TurnView[] {
  // The person's newest request opens the newest exchange; everything before it folds.
  const newestRequest = turns.findLastIndex((turn) => turn.kind === 'user');
  return turns.map((turn, index) => turnViewOf(turn, index < newestRequest, context));
}

/** The turn id of a request the clarify panel holds: stable while the panel asks. */
export const PENDING_REQUEST_ID = 'clarify-pending';

/**
 * The thread with the request the clarify panel is asking about, as the person's own
 * bubble (SPEC §4.5): it has left the box but no exchange opened yet, and without it the
 * person's words appear only as the model's paraphrase above an empty-state greeting.
 * The bubble goes when the panel closes; an answered request opens its real exchange.
 */
export function withPendingRequest(
  views: readonly TurnView[],
  pending: { readonly request: string; readonly context: readonly SentContext[] } | null,
  document: BuilderDocument,
): readonly TurnView[] {
  if (pending === null || pending.request.trim() === '') return views;
  const turn: UserTurn = {
    id: PENDING_REQUEST_ID,
    kind: 'user',
    text: pending.request,
    context: pending.context,
  };
  return [...views, { kind: 'user', view: userMessageView(turn, document) }];
}
