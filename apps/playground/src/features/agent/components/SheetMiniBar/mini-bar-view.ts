/**
 * What the phone's mini row says and offers (SPEC §3.16, §3.17, §4.19), derived from the
 * thread and the live run. Pure, beside SheetMiniBar the way RunGlyph keeps
 * `run-glyph-state.ts`: the component renders a `MiniBarView` and decides nothing.
 *
 * The rule of the row: glyph, status, then "the most relevant action for the moment", and
 * always Back to the chat. While a run is live that action is Stop; once it settles it is
 * the record's own next step, the one its footer leads with:
 *
 * | moment                          | status                          | action              |
 * | ------------------------------- | ------------------------------- | ------------------- |
 * | skeleton pass                   | the RunBar's line               | Stop                |
 * | building                        | "1 of 8 on the page"            | Stop                |
 * | any other live run              | the RunBar's line               | Stop                |
 * | build done                      | "Page built: 8 sections"        | Undo build          |
 * | build partial                   | "Page built, 1 failed"          | Retry               |
 * | build stopped / interrupted     | its title                       | Finish the rest (n) |
 * | build undone                    | "Build undone"                  | Redo build          |
 * | build failed                    | "Couldn't build the page"       | Try again           |
 * | edit done                       | "Hero updated"                  | Undo                |
 * | edit undone                     | "This change was undone"        | Redo                |
 * | proposal waiting                | "Proposed change: Hero"         | Apply, Discard      |
 * | error                           | its class's title               | Try again           |
 * | answer, plan, step plan, ending | its title                       | none                |
 * | nothing yet                     | the agent's name                | none                |
 *
 * The count while building is the landed count, never the drafted or writing ones (SPEC
 * §1 "ink means landed"): it comes from `BuildRecordView.landed`, which counts only
 * `task.completed` sections.
 */
import { buildTitleKey, type CopyRef } from '../../copy';
import type {
  AgentViewState,
  BuildRecordView,
  EditRecordView,
  RunBarView,
  SpineRowView,
  TurnView,
} from '../../model/view-types';
import { glyphForBuildPhase, type RunGlyphState } from '../RunGlyph';

/** One action the mini row offers. Each names the turn it acts on. */
export type MiniBarAction =
  | { readonly kind: 'stop'; readonly stopping: boolean }
  | { readonly kind: 'undoBuild'; readonly turnId: string }
  | { readonly kind: 'redoBuild'; readonly turnId: string }
  | { readonly kind: 'finishRest'; readonly turnId: string; readonly count: number }
  | { readonly kind: 'retryFailed'; readonly turnId: string; readonly keys: readonly string[] }
  | { readonly kind: 'undoEdit'; readonly turnId: string }
  | { readonly kind: 'redoEdit'; readonly turnId: string }
  | { readonly kind: 'apply'; readonly turnId: string }
  | { readonly kind: 'discard'; readonly turnId: string }
  | { readonly kind: 'tryAgain'; readonly turnId: string };

/** The horizontal spine above the row: the build's sections, or the skeleton's one track. */
export type MiniBarSpine =
  | { readonly kind: 'rows'; readonly rows: readonly SpineRowView[]; readonly live: boolean }
  | { readonly kind: 'indeterminate' };

/** Everything the mini row draws. */
export interface MiniBarView {
  /** The status node; `null` before anything has happened in the conversation. */
  readonly glyph: RunGlyphState | null;
  /** The status line, as a catalog string. */
  readonly status: CopyRef;
  readonly spine: MiniBarSpine | null;
  /** The moment's actions, in the order drawn; Back to the chat is always added after. */
  readonly actions: readonly MiniBarAction[];
}

/** What `miniBarView` reads. */
export type MiniBarSource = Pick<AgentViewState, 'turns' | 'run'>;

function turnIdOf(turn: TurnView): string {
  return turn.view.turnId;
}

function rowsSpine(rows: readonly SpineRowView[], live: boolean): MiniBarSpine | null {
  return rows.length === 0 ? null : { kind: 'rows', rows, live };
}

/* ── A live run ──────────────────────────────────────────────────────────── */

function liveView(run: RunBarView, turn: TurnView | undefined): MiniBarView {
  const actions: readonly MiniBarAction[] = [{ kind: 'stop', stopping: run.stopping }];
  const line: CopyRef = { key: run.statusKey, params: run.params };
  if (turn?.kind !== 'build') {
    return { glyph: 'working', status: line, spine: null, actions };
  }
  const build = turn.view;
  // No section exists yet: the RunBar's line, over one indeterminate track (SPEC §3.3).
  if (build.phase === 'skeleton' || build.total === 0) {
    return { glyph: 'working', status: line, spine: { kind: 'indeterminate' }, actions };
  }
  // Stopping says so; otherwise the count, which only landed sections move (SPEC §3.16).
  const status: CopyRef = run.stopping
    ? line
    : { key: 'mini.progress', params: { done: build.landed, total: build.total } };
  return { glyph: 'working', status, spine: rowsSpine(build.rows, true), actions };
}

/* ── A settled record ────────────────────────────────────────────────────── */

function buildView(build: BuildRecordView): MiniBarView {
  const glyph = glyphForBuildPhase(build.phase);
  const spine = rowsSpine(build.rows, false);
  const { turnId } = build;
  const undo: readonly MiniBarAction[] = build.actions.undoBuild
    ? [{ kind: 'undoBuild', turnId }]
    : [];
  switch (build.phase) {
    case 'done':
      return {
        glyph,
        status: { key: 'pill.done', params: { n: build.total } },
        spine,
        actions: undo,
      };
    case 'partial': {
      const failed = build.rows.filter((row) => row.state === 'failed');
      const retryable = failed.filter((row) => row.canRetry).map((row) => row.key);
      const actions: readonly MiniBarAction[] =
        build.actions.retryFailed > 0 && retryable.length > 0
          ? [{ kind: 'retryFailed', turnId, keys: retryable }]
          : undo;
      return {
        glyph,
        status: { key: 'build.title.partial', params: { n: failed.length } },
        spine,
        actions,
      };
    }
    case 'stopped':
    case 'interrupted':
      return {
        glyph,
        status: { key: buildTitleKey(build.phase, build.stopReason) },
        spine,
        actions:
          build.actions.finishRest > 0
            ? [{ kind: 'finishRest', turnId, count: build.actions.finishRest }]
            : [],
      };
    case 'undone':
      return {
        glyph,
        status: { key: 'build.title.undone' },
        spine,
        actions: build.actions.redoBuild ? [{ kind: 'redoBuild', turnId }] : [],
      };
    case 'failed':
      return {
        glyph,
        status: { key: 'build.title.failed' },
        spine,
        actions: build.error?.retryable === true ? [{ kind: 'tryAgain', turnId }] : [],
      };
    case 'skeleton':
    case 'building':
    case 'stopping':
      // A live phase with no live run: the thread is behind the run by one render. Say
      // what the record says, and offer nothing until the run is known again.
      return { glyph, status: { key: buildTitleKey(build.phase) }, spine, actions: [] };
  }
}

function editTitle(edit: EditRecordView): CopyRef {
  const { target } = edit;
  switch (edit.phase) {
    case 'running':
      return target === undefined
        ? { key: 'edit.title.runningPage' }
        : { key: 'edit.title.running', params: { target } };
    case 'done':
      if (edit.origin === 'proposal') {
        return target === undefined
          ? { key: 'proposal.appliedPage' }
          : { key: 'proposal.applied', params: { target } };
      }
      return target === undefined
        ? { key: 'edit.title.donePage' }
        : { key: 'edit.title.done', params: { target } };
    case 'noChange':
      return target === undefined
        ? { key: 'edit.title.noChangePage' }
        : { key: 'edit.title.noChange', params: { target } };
    case 'stopped':
      return { key: 'edit.title.stopped' };
    case 'undone':
      return { key: 'edit.undone' };
  }
}

const EDIT_GLYPH = {
  running: 'working',
  done: 'landed',
  noChange: 'absent',
  stopped: 'absent',
  undone: 'absent',
} as const satisfies Readonly<Record<EditRecordView['phase'], RunGlyphState>>;

function editView(edit: EditRecordView): MiniBarView {
  const { turnId, undo } = edit;
  const actions: readonly MiniBarAction[] =
    undo?.kind === 'undo'
      ? [{ kind: 'undoEdit', turnId }]
      : undo?.kind === 'redo'
        ? [{ kind: 'redoEdit', turnId }]
        : [];
  return { glyph: EDIT_GLYPH[edit.phase], status: editTitle(edit), spine: null, actions };
}

/** Nothing has happened in this conversation yet: the agent's name, and the way back. */
const IDLE: MiniBarView = { glyph: null, status: { key: 'header.name' }, spine: null, actions: [] };

function settledView(turn: TurnView): MiniBarView {
  switch (turn.kind) {
    case 'build':
      return buildView(turn.view);
    case 'edit':
      return editView(turn.view);
    case 'proposal': {
      const { turnId, target, status } = turn.view;
      if (status === 'drafting') {
        return { glyph: 'working', status: { key: 'proposal.drafting' }, spine: null, actions: [] };
      }
      return {
        glyph: 'decision',
        status:
          target === undefined
            ? { key: 'proposal.title.page' }
            : { key: 'proposal.title', params: { target } },
        spine: null,
        actions: [
          { kind: 'apply', turnId },
          { kind: 'discard', turnId },
        ],
      };
    }
    case 'error': {
      const { turnId, failure, retryable } = turn.view;
      return {
        glyph: 'failed',
        status: { key: `error.${failure}.title` },
        spine: null,
        actions: retryable ? [{ kind: 'tryAgain', turnId }] : [],
      };
    }
    case 'answer':
      return { glyph: 'note', status: { key: 'answer.title' }, spine: null, actions: [] };
    case 'page-plan':
      return turn.view.status === 'ready'
        ? { glyph: 'decision', status: { key: 'plan.title' }, spine: null, actions: [] }
        : { glyph: 'working', status: { key: 'plan.drafting' }, spine: null, actions: [] };
    case 'step-plan':
      return turn.view.status === 'ready'
        ? { glyph: 'decision', status: { key: 'steps.title' }, spine: null, actions: [] }
        : { glyph: 'working', status: { key: 'plan.drafting' }, spine: null, actions: [] };
    case 'end':
      return {
        glyph: 'absent',
        status: { key: `end.${turn.view.key}` },
        spine: null,
        actions: [],
      };
    case 'user':
      return IDLE;
  }
}

/**
 * The mini row for the conversation as it stands: the live run when there is one,
 * otherwise the newest record (the person's own message is not a record, so it is
 * skipped), otherwise the agent's name alone.
 */
export function miniBarView({ turns, run }: MiniBarSource): MiniBarView {
  if (run !== null) {
    return liveView(
      run,
      turns.find((turn) => turnIdOf(turn) === run.turnId),
    );
  }
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn !== undefined && turn.kind !== 'user') return settledView(turn);
  }
  return IDLE;
}
