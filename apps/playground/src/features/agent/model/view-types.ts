/**
 * The agent panel's view contracts: SPEC §7.3, plus every view a §4 component reads.
 *
 * One file of types, merged before anything else in wave 1, because wave 2 builds some
 * fifty components while the model (WP-05 to WP-08) and the controller (WP-16) are being
 * written at the same time. A shape kept beside its producer would not exist yet when its
 * consumer is written; a shape copied into each consumer drifts the first time a field
 * moves, which is how the v1 panel ended up with three different ideas of a "turn".
 *
 * Rules every view here follows:
 * - Snapshots, not models. Every field is `readonly` and every list is `readonly T[]`: a
 *   component renders a view and calls the controller; it never writes to a view.
 * - Keys and values, not sentences. A view carries catalog keys (WP-04) and raw values
 *   (counts, titles, hex codes), never a rendered string, so Arabic and English stay one
 *   catalog and no engine text reaches the screen (SPEC §6.5 "No internals on screen").
 *   `ErrorBodyView.details` is the one raw string, and it only ever reaches the clipboard.
 * - Optional means "the engine may not know it". Each optional field is declared
 *   `?: T | undefined` so a mapper can forward a maybe-absent engine value under
 *   `exactOptionalPropertyTypes` without a conditional spread per field.
 * - Titles are the page's words. Every `title`, `target` and `label` is interpolated
 *   inside `<bdi>` by the component (SPEC §4.0), so a view never pre-wraps one.
 *
 * Only two small guards ship as code; everything else is erased at build time.
 */

import type { StoryBibleView } from './story-bible';
import type { RunTelemetryState } from './run-telemetry';

/* ── Primitives ──────────────────────────────────────────────────────────────── */

/** The UI locale; Arabic is the default (SPEC §7.3, §4.0). */
export type Locale = 'ar' | 'en';

/**
 * How eagerly a request may touch the page (SPEC §4.17 ModeMenu, §7.4 `modes.ts`).
 * Default `auto`. `model/modes.ts` (WP-08) re-exports this union instead of redeclaring it.
 */
export type AssistantMode = 'ask' | 'auto' | 'plan';

/**
 * One section's state on the spine (SPEC §7.3, §4.7, §4.8). Ink means landed: only
 * `landed` may draw solid Indigo or count toward `landed/total`, and only after the
 * section's `task.completed`. `drafted` is a finished writer whose section waits its turn.
 */
export type RowState =
  | 'planned'
  | 'waiting'
  | 'writing'
  | 'retrying'
  | 'drafted'
  | 'landed'
  | 'failed'
  | 'notWritten'
  | 'undone';

/**
 * Why one section failed (SPEC §7.3, §4.8 `reason.*`), classified by `model/failure-class.ts`.
 * Raw engine text is never rendered; an unrecognised message is `unknown` (SPEC §7.6 E5).
 */
export type FailureClass =
  | 'timeout'
  | 'invalid'
  | 'outOfScope'
  | 'pageChanged'
  | 'unreachable'
  | 'busy'
  | 'declined'
  | 'unknown';

/**
 * A history action on a row or a record, keyed by the transaction that landed it
 * (SPEC §7.3, §4.8, §4.9). `unavailable` says why, so the control can be `aria-disabled`
 * and described instead of hidden: `revived` (after a reload), `changedSince` and
 * `regionMissing` (`revert.*` copy, from `revertBuildSection`).
 */
export type UndoView =
  | { readonly kind: 'undo'; readonly transactionId: string }
  | { readonly kind: 'redo'; readonly transactionId: string }
  | { readonly kind: 'unavailable'; readonly why: 'revived' | 'changedSince' | 'regionMissing' };

/**
 * Items a record's `[⋯]` RecordMenu may offer, in the order given (SPEC §4.15, §4.10,
 * §4.13, §4.14). The producer (`model/run-view.ts`) decides which apply: `restore` only
 * with `capabilities.restore` and later page changes; `technical` only with the developer
 * flag. The component renders exactly the list and never adds its own.
 */
export type RecordMenuItem =
  'restore' | 'reuse' | 'copySummary' | 'copyAnswer' | 'copyError' | 'viewAsCode' | 'technical';

/** What a copy action puts on the clipboard (SPEC §4.10, §4.14, §4.15). */
export type CopyTarget = 'summary' | 'answer' | 'error';

/* ── Status and the live region (SPEC §4.3) ─────────────────────────────────── */

/**
 * Every status key with a **visible** RunBar line in SPEC §4.3. Announced-only keys
 * (`build.progress`, `build.done`, `stopped`, …) are deliberately absent, so a RunBar
 * cannot be asked to show a line that has no visible copy.
 */
export type StatusKey =
  | 'run.understanding'
  | 'build.started'
  | 'build.planned'
  | 'build.writing'
  | 'build.blocked'
  | 'build.landed'
  | 'stopping'
  | 'edit.started'
  | 'edit.writing'
  | 'edit.checking'
  | 'edit.repairing'
  | 'edit.applying'
  | 'plan.drafting'
  | 'proposal.drafting';

/**
 * Every key the one live region may speak (SPEC §4.3 "Announced" column, §6.1).
 * Edit sub-stages, `run.understanding` and `build.landed` (coalesced into
 * `build.progress`) are visible only; the clock and the estimate are never announced.
 *
 * Five keys the §4.3 table does not print, each for a moment it has no true sentence for:
 * `edit.startedPage` / `edit.donePage` / `edit.noChangePage` (a page-wide edit has no
 * `{target}` to name), `stopped.budget.none` (the budget ran out before the skeleton
 * reached the page, so nothing changed) and `failed.skeleton` (a build failed after its
 * empty layout landed and before any section did: the page is not unchanged).
 */
export type AnnouncementKey =
  | 'build.started'
  | 'build.planned'
  | 'build.blocked'
  | 'build.progress'
  | 'build.done'
  | 'build.partial'
  | 'stopping'
  | 'stopped'
  | 'stopped.none'
  | 'stopped.budget'
  | 'stopped.budget.none'
  | 'stopped.maxTasks'
  | 'edit.started'
  | 'edit.startedPage'
  | 'edit.done'
  | 'edit.donePage'
  | 'edit.noChange'
  | 'edit.noChangePage'
  | 'plan.drafting'
  | 'plan.ready'
  | 'proposal.drafting'
  | 'proposal.ready'
  | 'answer.ready'
  | 'failed'
  | 'failed.kept'
  | 'failed.skeleton'
  | 'undone'
  | 'redone'
  | 'queue.queued'
  | 'queue.already'
  | 'queue.started'
  | 'plan.moved'
  | 'plan.removed'
  | 'copied'
  /*
    Controller additions (WP-16), for the owner's "read my request and fix it" tools:
    `enhance.ready` when ✨ Improve has rewritten the draft ("Request improved"), and
    `clarify.ready` when a request was too unclear to run and questions are docked above
    the composer instead. Both are replies to the person's own action, so they are spoken
    at once (`ANNOUNCE_POLICY`).
  */
  | 'enhance.ready'
  | 'clarify.ready';

/** Interpolation values for a catalog key: counts stay numbers so plurals can pick a form. */
export type CopyParams = Readonly<Record<string, string | number>>;

/**
 * The newest announcement for LiveStatus (SPEC §4.3, §6.1), already throttled and
 * coalesced by `hooks/use-live-status.ts`. `seq` rises on every announcement, so the same
 * sentence twice in a row ("Request queued", then again) is still spoken twice.
 */
export interface AnnouncementView {
  readonly key: AnnouncementKey;
  readonly params: CopyParams;
  readonly seq: number;
}

/**
 * What the live run is, independent of its current line (SPEC §4.4 JumpToLatest labels,
 * §4.19 SheetMiniBar, §4.20 AgentStatusPill). `routing` is the moment before the intent
 * is known (`run.understanding`); the others follow the routed intent.
 */
export type RunActivity = 'routing' | 'build' | 'edit' | 'plan' | 'proposal' | 'answer';

/**
 * The RunBar, mounted only while a run is live or stopping (SPEC §7.3, §4.17). `startedAt`
 * is epoch ms for RunClock; `params` fill `statusKey`. SPEC §7.3's four fields, plus
 * `turnId` (the running turn, so the pill and the mini bar can read its record) and
 * `activity` (`stopping` has no activity prefix, yet the jump pill still needs one).
 */
export interface RunBarView {
  readonly turnId: string;
  readonly activity: RunActivity;
  readonly statusKey: StatusKey;
  readonly params: CopyParams;
  readonly startedAt: number;
  readonly stopping: boolean;
}

/**
 * The Send slot's machine (SPEC §7.3, §4.17, `model/send-state.ts`). Stop is never one of
 * its states (SPEC §6.5); while stopping the slot stays `running-ready` / `running-queued`.
 */
export type SendState =
  'idle-empty' | 'idle-ready' | 'running-empty' | 'running-ready' | 'running-queued';

/* ── Direction and facts ─────────────────────────────────────────────────────── */

/** The five design-system roles a swatch shows, in display order (SPEC §4.8, §4.11 `role.*`). */
export type SwatchRole = 'background' | 'surface' | 'text' | 'accent' | 'onAccent';

/** One swatch of the page's direction (SPEC §7.3 `DirectionView.swatches`). */
export interface SwatchView {
  readonly role: SwatchRole;
  readonly hex: string;
}

/**
 * The read-only direction line (SPEC §7.3, §4.8 DirectionLine). Without structured
 * direction (SPEC §7.6 E7) only `mood` is set, holding the plan's prose on one line;
 * `fonts` is the pair's display names ("Reem Kufi / IBM Plex Sans").
 */
export interface DirectionView {
  readonly mood: string;
  readonly fonts?: string | undefined;
  readonly swatches?: readonly SwatchView[] | undefined;
}

/**
 * One sample detail to replace before publishing (SPEC §7.3 `BuildRecordView.facts`,
 * §4.8 FactsDisclosure). Activating it reveals `nodeId`. Empty until engine E4 lands.
 */
export interface FactView {
  readonly sample: string;
  readonly section: string;
  readonly nodeId: string;
}

/* ── The build record and its spine (SPEC §4.8) ──────────────────────────────── */

/**
 * One section row on the spine (SPEC §7.3, §4.8 SpineRow). `position` is 1-based and
 * `total` is the spine's length, so the accessible name reads "Section 3 of 8".
 * `nodeId` is absent until the section exists on the page: such a row is text, not a
 * button. `undo` is set only after `build.completed` with a landing record.
 */
export interface SpineRowView {
  readonly key: string;
  readonly nodeId?: string | undefined;
  readonly position: number;
  readonly total: number;
  readonly title: string;
  readonly state: RowState;
  readonly reason?: FailureClass | undefined;
  readonly undo?: UndoView | undefined;
  readonly canRetry: boolean;
}

/** Every phase of a build record (SPEC §7.3, §4.8 phase table). */
export type BuildPhase =
  | 'skeleton'
  | 'building'
  | 'done'
  | 'partial'
  | 'stopping'
  | 'stopped'
  | 'interrupted'
  | 'failed'
  | 'undone';

/** Why a build stopped: the person, its time budget, or the section limit (SPEC §4.8 titles). */
export type BuildStopReason = 'signal' | 'budget' | 'maxTasks';

/**
 * The build record's footer actions (SPEC §7.3, §4.8). A flag is shown only when true and
 * a count only when above 0; the counts fill the plural button labels. In phase
 * `interrupted`, `finishRest === 0` with `landed < total` means the list was not saved:
 * the caption is `build.caption.notResumable`.
 */
export interface BuildActionsView {
  readonly undoBuild: boolean;
  readonly redoBuild: boolean;
  readonly finishRest: number;
  readonly removeEmpty: number;
  readonly retryFailed: number;
}

/** A whole run's failure (SPEC §4.14 class table): not the same set as a section's `FailureClass`. */
export type ErrorClass =
  'unreachable' | 'timeout' | 'busy' | 'declined' | 'invalid' | 'tooLarge' | 'offline' | 'unknown';

/**
 * The one page-state sentence every error carries (SPEC §4.14 `error.page.*`). `kept`
 * counts landed sections; `skeleton` also offers `error.removeSkeleton`, which calls
 * `AgentController.removeEmpty`. `unknown` is for one stored shape only: v1's build path
 * replaced a failed build's turn, progress and all, with its error, so whether the
 * skeleton or any section landed first was never kept. "The page wasn't changed" may be
 * false there, and "kept" or "skeleton" would invent a count or a layout
 * (`error.page.unknown` says what is true: work before the error may still be there).
 */
export type ErrorPageState =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'kept'; readonly landed: number }
  | { readonly kind: 'skeleton' }
  | { readonly kind: 'unknown' };

/**
 * The body of an ErrorRecord (SPEC §4.14), shared by a failed build (§4.8 phase `failed`).
 * `details` is the technical text for "Copy error details" and Technical details only;
 * it is never rendered.
 */
export interface ErrorBodyView {
  readonly failure: ErrorClass;
  readonly pageState: ErrorPageState;
  readonly retryable: boolean;
  readonly details: string;
}

/**
 * A page build, in every phase (SPEC §7.3, §4.8). `landed/total` counts landed sections
 * only. While live the clock is the RunBar's; once settled `elapsedMs` is the final time,
 * measured to `lastEvidenceAt` for a revived record. `remainingMs` is the §4.8 pool
 * estimate, `null` when it may not be shown. SPEC §7.3's fields, plus `menu` (§4.15) and
 * `error` (the ErrorRecord body of phase `failed`).
 */
export interface BuildRecordView {
  readonly turnId: string;
  readonly phase: BuildPhase;
  readonly stopReason?: BuildStopReason | undefined;
  readonly landed: number;
  readonly total: number;
  /** Actual engine pool capacity; omitted/null on historical records with no evidence. */
  readonly writers?: number | null | undefined;
  readonly elapsedMs?: number | undefined;
  readonly remainingMs: number | null;
  readonly direction?: DirectionView | undefined;
  readonly rows: readonly SpineRowView[];
  readonly facts: readonly FactView[];
  readonly collapsed: boolean;
  readonly revived: boolean;
  readonly actions: BuildActionsView;
  readonly menu: readonly RecordMenuItem[];
  readonly error?: ErrorBodyView | undefined;
  /**
   * creative agent (2026-10-12): the planner's creative brief, present only on a build that
   * writes a game or story scene (free code on, a creative request). CreativeBriefCard.
   */
  readonly brief?: CreativeBriefView | undefined;
  /** T230: the site page this record built, one record per page of a site build. */
  readonly page?: string | undefined;
}

/** The planner's genres (`CreativeGenre` in `@craftkit/builder`), each a `brief.genre.*` key. */
export type CreativeBriefGenre =
  | 'platformer'
  | 'maze-adventure'
  | 'arcade'
  | 'puzzle'
  | 'physics-toy'
  | 'visual-novel'
  | 'picture-book'
  | 'chapter-story'
  | 'mural';

/** One character the brief casts: a name the person wrote, and the bible's colour if any. */
export interface CreativeCastView {
  readonly id: string;
  readonly name: string;
  readonly role?: string | undefined;
  /** A CSS colour from the story bible; drawn as a dot, never as text. */
  readonly color?: string | undefined;
}

/**
 * creative agent (2026-10-12): the creative brief as CreativeBriefCard draws it. Library and
 * effect names are API ids (`tilemap`, `dust`), shown as code because that is what the
 * scene calls; the genre is catalog copy.
 */
export interface CreativeBriefView {
  readonly genre: CreativeBriefGenre;
  readonly libs: readonly string[];
  readonly effects: readonly string[];
  readonly cast: readonly CreativeCastView[];
}

/* ── Edits, answers, endings (SPEC §4.9, §4.10, §4.14) ───────────────────────── */

/**
 * One before → after line (SPEC §4.9 ChangeLines), in schema labels, never command names.
 * Values are the page's words, quoted by the component.
 *
 * `restyled` and `moved` hold the two changes that have no words to put before and after
 * an arrow: a block whose look changed (a class, its CSS, an inline style, an icon) and a
 * block that stands somewhere else (reordered, or moved into another block). Without them
 * "make the hero darker", the commonest edit there is, showed an empty ChangeLines while
 * `describeImpact` counted one change. Both read like an added line: `label` is the block's
 * kind ("Section"), `value` its own title; the catalog says what happened
 * (`change.restyled` / `change.moved`, and their `.aria` sentences).
 */
export type ChangeLineView =
  | {
      readonly kind: 'changed';
      readonly label: string;
      readonly before: string;
      readonly after: string;
    }
  | { readonly kind: 'added'; readonly label: string; readonly value: string }
  | { readonly kind: 'removed'; readonly label: string; readonly value: string }
  | { readonly kind: 'restyled'; readonly label: string; readonly value: string }
  | { readonly kind: 'moved'; readonly label: string; readonly value: string };

/** The phases of one edit run (SPEC §4.9 `edit.title.*`, WP-12 stories). */
export type EditPhase = 'running' | 'done' | 'noChange' | 'stopped' | 'undone';

/** The live line of a running edit: the mapped stage phrase, never the provider's narration. */
export type EditStageKey = Extract<StatusKey, 'run.understanding' | `edit.${string}`>;

/**
 * Where an edit record came from: a request run directly (also a step plan that ran, and
 * the `build.skipped` fallback), or an Ask proposal that was applied, titled
 * `proposal.applied` (SPEC §4.13).
 */
export type EditOrigin = 'request' | 'proposal';

/**
 * One edit run (SPEC §4.9). Without `target` the title is `edit.title.runningPage`.
 * `changes` holds every line; the component shows three and "Show all changes (n)".
 * `undo` is a history action, available in every mode.
 */
export interface EditRecordView {
  readonly turnId: string;
  readonly phase: EditPhase;
  readonly origin: EditOrigin;
  readonly target?: string | undefined;
  readonly stage?: EditStageKey | undefined;
  readonly changes: readonly ChangeLineView[];
  /**
   * `done` with no line to show: a transaction landed that no line describes. The record
   * says `edit.unlisted` in ChangeLines' place and keeps Undo; it is never `noChange`, which
   * would tell the person the page did not move when it did.
   */
  readonly unlisted?: true | undefined;
  readonly elapsedMs?: number | undefined;
  readonly revealNodeId?: string | undefined;
  readonly undo?: UndoView | undefined;
  readonly menu: readonly RecordMenuItem[];
}

/** A words-only answer to a `question` intent; nothing on the page changed (SPEC §4.10). */
export interface AnswerView {
  readonly turnId: string;
  readonly text: string;
  readonly menu: readonly RecordMenuItem[];
}

/**
 * The one-line endings (SPEC §4.10 `end.*`). The last three (WP-16) are said after a build
 * that could not land where the words asked: `siteAsOnePage` and `newPageAppended` when the
 * host offers no `addPage` (a site built as one page, T230; a new page built below this
 * one), `appendedNotReplaced` when a scaffold build cannot start over, so it appended.
 */
export type EndNoteKey =
  | 'proposalDiscarded'
  | 'planDiscarded'
  | 'planSuperseded'
  | 'stoppedBeforeChange'
  | 'interrupted'
  | 'siteAsOnePage'
  | 'newPageAppended'
  | 'appendedNotReplaced';

/** A turn that ended in one Slate line and no footer (SPEC §4.10 EndNote). */
export interface EndNoteView {
  readonly turnId: string;
  readonly key: EndNoteKey;
}

/** A run that failed as a whole (SPEC §4.14 ErrorRecord). */
export interface ErrorView extends ErrorBodyView {
  readonly turnId: string;
  readonly menu: readonly RecordMenuItem[];
}

/* ── Context, the person's turn (SPEC §4.5, §4.17) ───────────────────────────── */

/** The fixed "Whole page" scope chip: label from `scope.page`, no remove button (SPEC §3.2, FR-024). */
export interface ScopeChipView {
  readonly kind: 'page';
  readonly id: string;
}

/**
 * A block the request is about: the canvas selection or an `@` mention (SPEC §4.17
 * ContextChip). `id` is the block's node id, which `removeChip` takes. `stale` means the
 * block is no longer on the page: struck through with `chip.stale` below it.
 */
export interface BlockChipView {
  readonly kind: 'selection' | 'mention';
  readonly id: string;
  readonly label: string;
  readonly stale: boolean;
}

/** A context chip in the composer, the queue header or a sent message (SPEC §4.17, §4.5). */
export type ContextChipView = ScopeChipView | BlockChipView;

/**
 * The person's own turn (SPEC §4.5 UserMessage). `chips` is the context sent with it,
 * shown as its first line and not interactive. `notRun` is a request stopped before any
 * output: 60% opacity and `message.notRun`.
 */
export interface UserMessageView {
  readonly turnId: string;
  readonly text: string;
  readonly chips: readonly ContextChipView[];
  readonly notRun: boolean;
}

/* ── Decision surfaces (SPEC §4.11 to §4.13) ─────────────────────────────────── */

/** One section in a page plan (SPEC §4.11 PlanSectionRow). `purpose` shows inline at ≥400. */
export interface PlanSectionView {
  readonly key: string;
  readonly title: string;
  readonly purpose?: string | undefined;
}

/**
 * A plan's editable direction (SPEC §4.11 DirectionEditor): the direction line plus the
 * curated font pair's id, so FontPairMenu can mark the selected radio item.
 */
export interface PlanDirectionView extends DirectionView {
  readonly fontPairId?: string | undefined;
}

/**
 * One curated Arabic-capable font pair for FontPairMenu (SPEC §4.11): `FONT_PAIRS` in
 * `model/page-plan-draft.ts`, each face one the engine's validator accepts.
 */
export interface FontPairOption {
  readonly id: string;
  readonly heading: string;
  readonly body: string;
}

/**
 * Why Build is disabled (SPEC §4.11 limits, `model/page-plan-draft.ts` validity): fewer
 * than 2 sections (`plan.min`), more than 12 (`plan.max`), a failing contrast pair
 * (`plan.contrast`, measured by the engine's own `validatePagePlan` on a structured plan),
 * or two sections sharing a title and so an anchor (`duplicateTitle`, `plan.duplicate`:
 * §4.11 prints no copy for it, the catalog authors one).
 */
export type PlanProblem = 'min' | 'max' | 'contrast' | 'duplicateTitle';

/**
 * The note under a plan's Build button (SPEC §4.11, §7.6 E6): `exact` builds the listed
 * sections verbatim (`plan.note`); `mayDiffer` re-plans at Build (`plan.note.mayDiffer`).
 */
export type PlanNote = 'exact' | 'mayDiffer';

/**
 * The page plan, a decision surface (SPEC §4.11). `drafting` renders as a working record
 * until the plan arrives. On Build the same turn id becomes a `build` turn, so the list
 * inks in place (§5 moment 4); on Discard or a newer plan it becomes an `end` turn.
 * `approval` is Ask mode's "Waiting for your approval" tag; `editable` is false for the
 * read-only fallback (`capabilities.editablePlan`, or a plan migrated from v1).
 */
export interface PlanView {
  readonly turnId: string;
  readonly status: 'drafting' | 'ready';
  readonly approval: boolean;
  readonly edited: boolean;
  readonly editable: boolean;
  readonly note: PlanNote;
  readonly subject: string;
  readonly direction?: PlanDirectionView | undefined;
  readonly sections: readonly PlanSectionView[];
  readonly problems: readonly PlanProblem[];
}

/**
 * One edit to a page plan draft (SPEC §4.11, `model/page-plan-draft.ts`). `move.to` is the
 * section's 0-based index after the move, so drag, Alt+arrows and the menu share one op.
 * `add` appends, as AddSectionRow sits at the end of the list.
 */
export type PlanOp =
  | { readonly kind: 'rename'; readonly key: string; readonly title: string }
  | { readonly kind: 'move'; readonly key: string; readonly to: number }
  | { readonly kind: 'remove'; readonly key: string }
  | { readonly kind: 'add'; readonly title: string }
  | { readonly kind: 'setToken'; readonly role: SwatchRole; readonly hex: string }
  | { readonly kind: 'setFonts'; readonly pairId: string }
  | { readonly kind: 'setMood'; readonly mood: string };

/** One read-only step of a change plan, naming its target block when known (SPEC §4.12). */
export interface StepView {
  readonly key: string;
  readonly text: string;
  readonly target?: string | undefined;
}

/** Plan mode's answer to an edit request: steps and "Run this plan" (SPEC §4.12 StepPlanCard). */
export interface StepPlanView {
  readonly turnId: string;
  readonly status: 'drafting' | 'ready';
  readonly steps: readonly StepView[];
}

/**
 * Ask mode's proposed edit (SPEC §4.13 ProposalCard). `pageUnchanged` gates the honesty
 * line: true only while unapplied and the run wrote nothing (SPEC §6.5). `partial` is set
 * when validation dropped changes. On Apply the turn becomes an `edit` turn with
 * `origin: 'proposal'`; on Discard an `end` turn.
 */
export interface ProposalView {
  readonly turnId: string;
  readonly status: 'drafting' | 'ready';
  readonly target?: string | undefined;
  readonly changes: readonly ChangeLineView[];
  readonly pageUnchanged: boolean;
  readonly previewing: boolean;
  readonly partial?: { readonly kept: number; readonly total: number } | undefined;
  readonly menu: readonly RecordMenuItem[];
}

/* ── Turns (SPEC §7.4 v2 union) ──────────────────────────────────────────────── */

/**
 * One turn of the thread as TurnView (SPEC §7.2 #50) renders it, discriminated by the v2
 * turn kinds of SPEC §7.4. A turn keeps its `turnId` across kinds (plan → build,
 * proposal → edit or end), so its `<li>` and focus target survive the change.
 */
export type TurnView = (
  | { readonly kind: 'user'; readonly view: UserMessageView }
  | { readonly kind: 'build'; readonly view: BuildRecordView }
  | { readonly kind: 'edit'; readonly view: EditRecordView }
  | { readonly kind: 'answer'; readonly view: AnswerView }
  | { readonly kind: 'page-plan'; readonly view: PlanView }
  | { readonly kind: 'step-plan'; readonly view: StepPlanView }
  | { readonly kind: 'proposal'; readonly view: ProposalView }
  | { readonly kind: 'error'; readonly view: ErrorView }
  | { readonly kind: 'end'; readonly view: EndNoteView }
) & {
  readonly telemetry?: RunTelemetryState;
};

/** The v2 turn kinds (SPEC §7.4). */
export type TurnKind = TurnView['kind'];

/** Every v2 turn kind once, in SPEC §7.4's order: for exhaustive tables, stories and tests. */
export const TURN_KINDS = [
  'user',
  'build',
  'edit',
  'answer',
  'page-plan',
  'step-plan',
  'proposal',
  'error',
  'end',
] as const satisfies readonly TurnKind[];

/** Narrows a turn to one kind, so `turn.view` is that kind's view. */
export function isTurnOfKind<K extends TurnKind>(
  turn: TurnView,
  kind: K,
): turn is Extract<TurnView, { readonly kind: K }> {
  return turn.kind === kind;
}

/**
 * Whether a turn is an unanswered decision (SPEC §4.1 `awaiting-decision`): a ready page
 * plan, step plan or proposal. Suggestions hide while any turn is (SPEC §4.16).
 * Deliberately a plain boolean, not a type guard: a drafting proposal is the same kind,
 * so a `false` must not narrow the proposal kinds away.
 */
export function isAwaitingDecision(turn: TurnView): boolean {
  switch (turn.kind) {
    case 'page-plan':
    case 'step-plan':
    case 'proposal':
      return turn.view.status === 'ready';
    default:
      return false;
  }
}

/* ── Composer family (SPEC §4.17, §3.9) ──────────────────────────────────────── */

/**
 * The one queued request's header state (SPEC §4.17 QueueHeader, §3.9, FR-025/026/054):
 * `editable` while it waits, `stale` (Amber) or `missing` (Alarm, cannot run) after
 * revalidation against the page, `paused` after Stop until Continue.
 */
export type QueueStatus = 'editable' | 'stale' | 'missing' | 'paused';

/**
 * The one queued request (SPEC §3.9, §4.17). While running, `text` is the composer's own
 * draft: there is no second field. After Stop it pauses with its own text while the
 * composer empties (SPEC §3.10), so the header shows `text` itself.
 */
export interface QueueView {
  readonly text: string;
  readonly chips: readonly ContextChipView[];
  readonly status: QueueStatus;
}

/**
 * One row of the `@` mention listbox (SPEC §4.17 MentionMenu, §3.2), by human name.
 * `section` is set for a top-level section and reads `mention.position` ("2 of 8").
 */
export interface MentionCandidateView {
  readonly id: string;
  readonly label: string;
  readonly section?: { readonly position: number; readonly total: number } | undefined;
}

/**
 * The open mention list, derived from the draft's trailing `@fragment` (SPEC §4.17; the
 * pattern `model/mentions.ts` uses adds `\p{M}`, so tashkeel keep the list open). `null`
 * when the draft has no fragment.
 */
export interface MentionView {
  readonly query: string;
  readonly candidates: readonly MentionCandidateView[];
}

/** The model families ModelMenu offers (SPEC §4.17 `model.*`). */
export type ModelTier = 'fast' | 'careful' | 'free';

/**
 * One ModelMenu item (SPEC §4.17), from `model/model-label.ts`. The raw `id` is only ever
 * passed to `setModel`, never shown; `product` is the vendor's name, shown in `<bdi>`, and
 * `''` for an id that carries no name at all: the item then reads by its tier's word alone
 * (`model.${tier}`), never an English stand-in.
 */
export interface ModelOption {
  readonly id: string;
  readonly tier: ModelTier;
  readonly product: string;
}

/** The model picker's state; `null` in AgentViewState when the provider offers no choice. */
export interface ModelSelectionView {
  readonly selected: ModelOption;
  readonly options: readonly ModelOption[];
}

/**
 * How hard the model may think: the five budgets the server takes (`apps/ai-server`
 * `CALL_EFFORT_LEVELS`), listed in `model/effort.ts` in the order the menu shows them.
 */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** User-selected limit for independent build tasks, not model reasoning effort. */
export type BuildWorkerCount = 1 | 3 | 6;

/** The effort picker's state; `null` in AgentViewState when the provider takes no budget. */
export interface EffortSelectionView {
  readonly selected: EffortLevel;
  readonly options: readonly EffortLevel[];
}

/**
 * The free-code switch's state; `null` in AgentViewState when the host cannot carry it.
 * On, the agent may write JavaScript and full PixiJS scenes into a custom-code block;
 * off, it stays inside the blocks and the closed motion scenes.
 */
export interface FreeCodeView {
  readonly enabled: boolean;
}

/* ── Empty state, suggestions, conversations (SPEC §4.16, §4.18) ─────────────── */

/**
 * Which greeting the empty thread shows (SPEC §4.16 `empty.*`): the page is empty, it has
 * sections, or a block is selected.
 */
export type EmptyStateView =
  | { readonly kind: 'greeting' }
  | { readonly kind: 'hasContent'; readonly sections: number }
  | { readonly kind: 'selection'; readonly title: string };

/** Where a suggestion came from, in `panelSuggestions`' priority order (SPEC §4.16). */
export type SuggestionSource =
  'starter' | 'salvage' | 'followUp' | 'selection' | 'page' | 'catalog';

/** One suggestion row: choosing it fills the composer with `text` and never sends (SPEC §4.16). */
export interface SuggestionView {
  readonly key: string;
  readonly text: string;
  readonly source: SuggestionSource;
}

/**
 * One conversation in HistoryPopover (SPEC §4.18 HistoryRow). `title` is the first
 * request. `updatedAt` is epoch ms, `null` for a conversation migrated from v1 storage,
 * which never recorded one (the row then shows no time).
 */
export interface SessionSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: number | null;
  readonly current: boolean;
}

/* ── Improve my request, and asking before guessing (owner request, 2026-09-28) ── */

/*
  The owner asked (2026-09-28, looking at a request the panel had taken literally —
  «هل يمكنك تربط ال صفحه هاي داخل عليها») for a tool that READS the request and fixes it
  before it runs. Two surfaces, both docked above the composer like QueueHeader, so the
  turn list keeps SPEC §7.4's nine kinds:
  - EnhancementView: the ✨ Improve action rewrites the draft in the request's own
    language (bolt.diy's "enhance prompt" pattern), with a visible Restore.
  - ClarifyView: when a sent request is too unclear to act on, the agent asks one to three
    short questions with answer chips instead of guessing; "Send as written" skips them.
*/

/**
 * The composer's Improve state. `unavailable`: the provider cannot rewrite requests (an
 * offline provider, or a server without the enhance route), so the Improve action is not
 * shown at all. `idle`: nothing to show. `enhancing`: the draft is locked
 * and the Improve button shows progress. `enhanced`: the draft now holds the rewrite;
 * `understood` restates the request in one line, `changes` lists what was fixed (short,
 * in the UI locale), and `canRestore` offers the person's own text back. `failed`: the
 * draft is unchanged and `reason` picks the one-line note.
 */
export type EnhancementView =
  | { readonly status: 'unavailable' }
  | { readonly status: 'idle' }
  | { readonly status: 'enhancing' }
  | {
      readonly status: 'enhanced';
      readonly understood: string;
      readonly changes: readonly string[];
      readonly canRestore: boolean;
    }
  | { readonly status: 'failed'; readonly reason: FailureClass };

/** One clarifying question; choosing a chip answers it (`answer` holds the choice). */
export interface ClarifyQuestionView {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly string[];
  readonly answer?: string | undefined;
}

/**
 * The questions docked above the composer for the request just sent (`request`), shown
 * instead of running it when the request is too unclear (router confidence below 0.6, or
 * the enhancer returned questions). Answering every question rewrites and runs it;
 * `sendAsWritten` runs it untouched; `dismissClarify` puts the text back in the composer.
 */
export interface ClarifyView {
  readonly request: string;
  readonly understood: string;
  readonly questions: readonly ClarifyQuestionView[];
  readonly status: 'asking' | 'rewriting';
}

/* ── The controller (SPEC §7.3, WP-16) ───────────────────────────────────────── */

/**
 * Which engine prerequisites are present (SPEC §7.3, §7.6). Every fallback is one flag,
 * so each honest degradation has a story and a test. `model/capabilities.ts`
 * (`capabilitiesFromEngine`) reads them off the engine; nothing sets one by hand.
 */
export interface AgentCapabilities {
  readonly rowUndo: boolean;
  readonly undoBuild: boolean;
  readonly restore: boolean;
  readonly facts: boolean;
  readonly failureClasses: boolean;
  readonly editablePlan: boolean;
  readonly structuredDirection: boolean;
  readonly estimate: boolean;
  readonly canvasStage: boolean;
}

/**
 * Everything the panel renders (SPEC §7.3 "turns as views, draft, chips, mode, model, run,
 * queue, sessions"), plus what the frame leaves read: the locale, the Send slot, the open
 * mention list, suggestions, the empty greeting and the newest announcement.
 * `run` is `null` whenever the RunBar is unmounted.
 */
export interface AgentViewState {
  readonly locale: Locale;
  readonly turns: readonly TurnView[];
  readonly draft: string;
  readonly chips: readonly ContextChipView[];
  readonly mention: MentionView | null;
  readonly mode: AssistantMode;
  /** Build-only pool selection. Single-target edits still use one worker. */
  readonly workers?: BuildWorkerCount | undefined;
  readonly model: ModelSelectionView | null;
  /** Absent or `null`: the provider takes no reasoning budget, and no effort menu is drawn. */
  readonly effort?: EffortSelectionView | null;
  /** Absent or `null`: the host keeps no free-code switch, and none is drawn. */
  readonly freeCode?: FreeCodeView | null;
  readonly send: SendState;
  readonly run: RunBarView | null;
  readonly queue: QueueView | null;
  readonly sessions: readonly SessionSummary[];
  readonly suggestions: readonly SuggestionView[];
  readonly empty: EmptyStateView;
  readonly announcement: AnnouncementView | null;
  /** The ✨ Improve state for the current draft. */
  readonly enhancement: EnhancementView;
  /** Questions docked above the composer before an unclear request runs; `null` when none. */
  readonly clarify: ClarifyView | null;
  /**
   * (WP-16 addition) The header face's mood, driven by the live run's events (SPEC §4.2
   * "mood from `useAgentMood`"). Optional so a hand-built state without it still types; the
   * controller always sets it.
   */
  readonly face?: FaceView | undefined;
}

/**
 * (WP-16 addition) AgentFace's mood as a view: exactly the props `AgentFace` takes
 * (`mood`, `variant`, `outcome`, `typing`), so AgentHeader passes it through untouched.
 */
export interface FaceView {
  readonly mood:
    'idle' | 'listening' | 'thinking' | 'planning' | 'working' | 'done' | 'failed' | 'stopped';
  readonly variant?: 'checking' | 'repairing' | undefined;
  readonly outcome?: 'proposed' | 'applied' | 'planned' | 'discarded' | undefined;
  readonly typing: boolean;
}

/** The outcome RestoreDialog shows in place (SPEC §4.15 `restore.conflict`). */
export type RestoreResult = 'restored' | 'conflict';

/**
 * The panel's one door to behaviour (SPEC §7.3). Actions are readonly function
 * properties, not methods, so a component can pass `controller.stop` straight to
 * `onClick` without a bound-method bug (typescript-eslint `unbound-method`). No action
 * posts text as the person's turn: retries and "Finish the rest" start successor runs.
 *
 * SPEC §7.3's actions come first. The rest are the ones §4 components need that §7.3 did
 * not list: `redoBuild` (§4.8 undone footer), `undoEdit`/`redoEdit` (§4.9, and an applied
 * proposal), `togglePreview`/`viewAsCode` (§4.13), `copy`/`restore`/`showTechnicalDetails`
 * (§4.15 RecordMenu, RestoreDialog), `openPageHistory` (§4.8 revived caption),
 * `removeChip`/`addMention` (§4.17 ContextChip, MentionMenu).
 */
export interface AgentController {
  readonly state: AgentViewState;
  readonly capabilities: AgentCapabilities;
  /**
   * The project's story bible (creative agent, 2026-10-12): characters, assets, locations and
   * canon the Agent keeps consistent. Optional: a host without one renders no bible panel.
   */
  readonly storyBible?: StoryBibleView | undefined;

  readonly send: () => void;
  readonly stop: () => void;
  readonly removeQueued: () => void;
  readonly continueQueued: () => void;
  readonly apply: (turnId: string) => void;
  readonly discard: (turnId: string) => void;
  readonly build: (turnId: string) => void;
  readonly runSteps: (turnId: string) => void;
  readonly editPlan: (turnId: string, op: PlanOp) => void;
  readonly undoSection: (turnId: string, key: string) => void;
  readonly redoSection: (turnId: string, key: string) => void;
  readonly undoBuild: (turnId: string) => void;
  readonly retrySections: (turnId: string, keys: readonly string[]) => void;
  readonly finishRest: (turnId: string) => void;
  /** Removes a build's unfilled placeholders; also ErrorRecord's "Remove the empty layout". */
  readonly removeEmpty: (turnId: string) => void;
  readonly tryAgain: (turnId: string) => void;
  readonly reveal: (nodeId: string) => void;
  readonly peek: (nodeId: string | null) => void;
  readonly reuse: (turnId: string) => void;
  readonly setDraft: (text: string) => void;
  readonly setMode: (mode: AssistantMode) => void;
  readonly setModel: (id: string) => void;
  /** Locked while a run or request check owns the panel. */
  readonly setWorkers?: ((workers: BuildWorkerCount) => void) | undefined;
  /** Optional like `setComposerFocused`: a host with no budget to set leaves it out. */
  readonly setEffort?: (level: EffortLevel) => void;
  /** Optional like `setEffort`: a host with nowhere to keep the switch leaves it out. */
  readonly setFreeCode?: (enabled: boolean) => void;
  readonly newConversation: () => void;
  readonly openConversation: (id: string) => void;
  readonly deleteConversation: (id: string) => void;

  readonly redoBuild: (turnId: string) => void;
  readonly undoEdit: (turnId: string) => void;
  readonly redoEdit: (turnId: string) => void;
  readonly togglePreview: (turnId: string) => void;
  readonly viewAsCode: (turnId: string) => void;
  readonly copy: (turnId: string, what: CopyTarget) => void;
  readonly restore: (turnId: string) => Promise<RestoreResult>;
  readonly showTechnicalDetails: (turnId: string) => void;
  readonly openPageHistory: () => void;
  /** Removes a block chip by its node id; the scope chip has no remove. */
  readonly removeChip: (id: string) => void;
  /** Adds a mention chip and removes the draft's trailing `@fragment`. */
  readonly addMention: (nodeId: string) => void;

  /** Rewrites the draft professionally (EnhancementView). A no-op on an empty draft. */
  readonly enhanceDraft: () => void;
  /** Puts back the text the person typed before the last Improve. */
  readonly restoreDraft: () => void;
  /** Answers one docked clarifying question with the chosen (or typed) answer. */
  readonly answerClarify: (questionId: string, answer: string) => void;
  /** Runs the docked request exactly as the person wrote it, skipping the questions. */
  readonly sendAsWritten: () => void;
  /** Closes the questions and puts the request back in the composer, unsent. */
  readonly dismissClarify: () => void;

  /**
   * (WP-16 addition) The composer's focus, which the face listens to (`listening`). Optional
   * so a fake controller may leave it out; the Composer calls it when present.
   */
  readonly setComposerFocused?: ((focused: boolean) => void) | undefined;
}
