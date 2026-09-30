/**
 * The copy catalog's keys: the one union every string in the panel is addressed by
 * (SPEC §4.0, §7.1, WP-04). `en.ts` and `ar.ts` are `satisfies Record<Key, …>`, so a key
 * missing from either catalog, or present in only one, is a type error before it is a
 * test failure (`catalog.test.ts` checks the same at runtime).
 *
 * Keys follow the SPEC §4 tables verbatim, so a component author reading a table finds
 * the key under the name printed there. A table row written `row.undo / aria` is two keys,
 * `row.undo` and `row.undo.aria`; `answer.more / less` is `answer.more` and `answer.less`.
 *
 * Two namespaces the tables leave implicit:
 * - A **visible** status line is keyed by its bare §4.3 name (`build.writing`), so every
 *   `StatusKey` in `model/view-types.ts` is itself a catalog key and a RunBar renders
 *   `t(locale, run.statusKey, run.params)` with no mapping.
 * - An **announcement** lives under `announce.` (`announce.build.done`), because §4.3
 *   gives one name two sentences (visible «جارٍ الإيقاف…», announced «جارٍ الإيقاف»),
 *   and §4.3 and §4.9 both define `edit.noChange` with different copy.
 *
 * Keys the SPEC's components need but its tables do not print are marked `(added)` in
 * the catalogs, with the reason.
 */
import type {
  AnnouncementKey,
  BuildPhase,
  BuildStopReason,
  ErrorClass,
  ErrorPageState,
  PlanProblem,
  QueueStatus,
  RecordMenuItem,
  RunActivity,
  StatusKey,
  UndoView,
} from '../model/view-types';

import type { PluralCategory } from './format';

/** Every catalog key, grouped by the SPEC section that owns it. */
export const KEYS = [
  // §4.2 AgentHeader and the phone sheet's header
  'header.name',
  'header.conversations',
  'header.new',
  'header.new.busy',
  'sheet.close',
  'sheet.showPage',
  'sheet.backToChat',
  'panel.resize',

  // §4.3 the visible status line (exactly `StatusKey`)
  'run.understanding',
  'build.started',
  'build.planned',
  'build.writing',
  'build.blocked',
  'build.landed',
  'stopping',
  'edit.started',
  'edit.writing',
  'edit.checking',
  'edit.repairing',
  'edit.applying',
  'plan.drafting',
  'proposal.drafting',

  // §4.3 announcements (exactly `announce.${AnnouncementKey}`)
  'announce.build.started',
  'announce.build.planned',
  'announce.build.blocked',
  'announce.build.progress',
  'announce.build.done',
  'announce.build.partial',
  'announce.stopping',
  'announce.stopped',
  'announce.stopped.none',
  'announce.stopped.budget',
  'announce.stopped.budget.none',
  'announce.stopped.maxTasks',
  'announce.edit.started',
  'announce.edit.startedPage',
  'announce.edit.done',
  'announce.edit.donePage',
  'announce.edit.noChange',
  'announce.edit.noChangePage',
  'announce.plan.drafting',
  'announce.plan.ready',
  'announce.proposal.drafting',
  'announce.proposal.ready',
  'announce.answer.ready',
  'announce.failed',
  'announce.failed.kept',
  'announce.failed.skeleton',
  'announce.undone',
  'announce.redone',
  'announce.queue.queued',
  'announce.queue.already',
  'announce.queue.started',
  'announce.plan.moved',
  'announce.plan.removed',
  'announce.copied',

  // §4.4 AgentThread and JumpToLatest
  'thread.label',
  'jump.idle',
  'jump.building',
  'jump.editing',
  'jump.working',
  'jump.aria',

  // §4.5 UserMessage
  'message.notRun',

  // §4.8 BuildRecord, SpineList, SpineRow, DirectionLine, FactsDisclosure
  'build.title.skeleton',
  'build.live.skeleton',
  'build.title.running',
  'build.title.done',
  'build.title.partial',
  'build.title.stopped',
  'build.title.budget',
  'build.title.maxTasks',
  'build.title.interrupted',
  'build.title.failed',
  'build.title.undone',
  'build.caption.done',
  'build.caption.stopped',
  'build.caption.interrupted',
  'build.caption.notResumable',
  'build.caption.revived',
  'build.pageHistory',
  'build.remaining.minutes',
  'build.remaining.underMinute',
  'build.showSections',
  'build.hideSections',
  'spine.label',
  'row.planned',
  'row.waiting',
  'row.writing',
  'row.retrying',
  'row.drafted',
  'row.landed',
  'row.undone',
  'row.failed',
  'row.notWritten',
  'row.aria',
  'row.undo',
  'row.undo.aria',
  'row.redo',
  'row.redo.aria',
  'row.retry',
  'row.retry.aria',
  'revert.changedSince',
  'revert.regionMissing',
  'reason.timeout',
  'reason.invalid',
  'reason.outOfScope',
  'reason.pageChanged',
  'reason.unreachable',
  'reason.busy',
  'reason.declined',
  'reason.unknown',
  'facts.toggle',
  'facts.intro',
  'facts.item',
  'footer.undoBuild',
  'footer.redoBuild',
  'footer.finishRest',
  'footer.removeEmpty',
  'footer.retryFailed',
  'direction.aria',
  'direction.aria.mood',

  // §4.9 EditRecord and ChangeLines
  'edit.title.running',
  'edit.title.runningPage',
  'edit.title.done',
  'edit.title.noChange',
  'edit.noChange',
  'edit.title.stopped',
  'edit.pageUnchanged',
  'edit.unlisted',
  'edit.showAll',
  'edit.showOnPage',
  'edit.undo',
  'edit.redo',
  'edit.undone',
  'change.changed.aria',
  'change.added.aria',
  'change.removed.aria',
  'change.restyled',
  'change.restyled.aria',
  'change.moved',
  'change.moved.aria',
  // The words `impactLines` names things with (exactly `ImpactWordKey` in model/impact.ts):
  // an element's role inside a region, a document field, and the values those fields take.
  'change.label.section',
  'change.label.heading',
  'change.label.link',
  'change.label.button',
  'change.label.listItem',
  'change.label.quote',
  'change.label.caption',
  'change.label.label',
  'change.label.tableHeading',
  'change.label.tableCell',
  'change.label.text',
  'change.label.pageDirection',
  'change.label.pageSurface',
  'change.value.ltr',
  'change.value.rtl',
  'change.value.on',
  'change.value.off',

  // §4.10 AnswerRecord and EndNote
  'answer.title',
  'answer.more',
  'answer.less',
  'end.proposalDiscarded',
  'end.planDiscarded',
  'end.planSuperseded',
  'end.stoppedBeforeChange',
  'end.interrupted',

  // §4.11 PagePlanCard and its parts
  'plan.title',
  'plan.tag.edited',
  'plan.tag.approval',
  'plan.mood.aria',
  'plan.swatch.aria',
  'role.background',
  'role.surface',
  'role.text',
  'role.accent',
  'role.onAccent',
  'swatch.hex',
  'swatch.ok',
  'swatch.low',
  'plan.contrast',
  'plan.fonts.aria',
  'plan.sections',
  'plan.row.drag',
  'plan.row.rename',
  'plan.row.moveUp',
  'plan.row.moveDown',
  'plan.row.remove',
  'plan.add',
  'plan.add.placeholder',
  'plan.min',
  'plan.max',
  'plan.duplicate',
  'plan.build',
  'plan.discard',
  'plan.note',
  'plan.note.mayDiffer',
  'plan.layoutPrepared',

  // §4.12 StepPlanCard
  'steps.title',
  'steps.run',
  'steps.discard',
  'steps.note',

  // §4.13 ProposalCard
  'proposal.title',
  'proposal.unchanged',
  'proposal.partial',
  'proposal.apply',
  'proposal.discard',
  'proposal.preview',
  'proposal.preview.end',
  'proposal.viewCode',
  'proposal.applied',

  // §4.14 ErrorRecord (titles and causes by failure class)
  'error.unreachable.title',
  'error.unreachable.cause',
  'error.timeout.title',
  'error.timeout.cause',
  'error.busy.title',
  'error.busy.cause',
  'error.declined.title',
  'error.declined.cause',
  'error.invalid.title',
  'error.invalid.cause',
  'error.tooLarge.title',
  'error.tooLarge.cause',
  'error.offline.title',
  'error.offline.cause',
  'error.unknown.title',
  'error.page.unchanged',
  'error.page.kept',
  'error.page.skeleton',
  'error.page.unknown',
  'error.removeSkeleton',
  'error.retry',
  'error.copy',

  // §4.15 RecordMenu, InlineConfirm, RestoreDialog
  'menu.label',
  'menu.restore',
  'menu.reuse',
  'menu.copySummary',
  'menu.copyAnswer',
  'menu.technical',
  'confirm.undoBuild',
  'confirm.undo',
  'confirm.cancel',
  'restore.title',
  'restore.body',
  'restore.confirm',
  'restore.conflict',

  // §4.16 EmptyState and SuggestionList. The starters are catalog copy like every other
  // string the panel shows; `model/suggestions.ts` only picks which to offer (`STARTER_KEYS`
  // below, rotated there). 1 to 4 are the SPEC's four rows; 5 to 8 the pool a new
  // conversation rotates into. The `suggest.*` sentences are what the other sources write
  // into the composer, in the person's own voice.
  'empty.greeting',
  'empty.hasContent',
  'empty.selection',
  'suggestions.label',
  'suggestions.description',
  'starter.1',
  'starter.2',
  'starter.3',
  'starter.4',
  'starter.5',
  'starter.6',
  'starter.7',
  'starter.8',
  'suggest.rewrite',
  'suggest.addInside',
  'suggest.tighten',
  'suggest.relayout',
  'suggest.rework',
  'suggest.salvage',
  'suggest.page.pricing',
  'suggest.page.faq',
  'suggest.page.contact',
  'suggest.page.testimonials',
  'suggest.page.warmer',
  'suggest.page.otherLanguage',

  // §4.17 the composer family
  'input.aria',
  'placeholder.auto',
  'placeholder.ask',
  'placeholder.plan',
  'placeholder.running',
  'placeholder.afterPlan',
  'scope.page',
  'chip.remove',
  'chip.stale',
  'mention.button',
  'mention.label',
  'mention.position',
  'mention.empty',
  'mode.aria',
  'mode.auto',
  'mode.auto.desc',
  'mode.ask',
  'mode.ask.desc',
  'mode.plan',
  'mode.plan.desc',
  'mode.running',
  'model.aria',
  'model.fast',
  'model.fast.trait',
  'model.careful',
  'model.careful.trait',
  'model.free',
  'model.free.trait',
  'send',
  'queue',
  'queued',
  'stop',
  'stop.tooltip',
  'keys.hint',
  'queue.label',
  'queue.caption',
  'queue.stale',
  'queue.missing',
  'queue.paused',
  'queue.continue',
  'queue.remove',

  // §4.18 HistoryPopover and HistoryRow
  'history.title',
  'history.search',
  'history.current',
  'history.delete',
  'history.confirm',
  'history.confirm.yes',
  'history.confirm.no',
  'history.empty',
  'history.noMatch',
  'history.back',

  // §4.19 SheetMiniBar
  'mini.progress',

  // §4.20 canvas stage, status pill, empty canvas (phase 2 copy, authored now)
  'pill.building',
  'pill.editing',
  'pill.working',
  'pill.done',
  'edge.landed',
  'canvas.empty',
  'stage.overture',
  'stage.waiting',
  'stage.writing',
  'stage.drafted',
  'stage.landed',
  'stage.failed',
  'stage.changed',

  // §7.4 `describeImpact`: its strings move here "with Arabic plurals" (exactly
  // `ImpactKey` in model/impact.ts; `tList` joins the parts into one line)
  'impact.none',
  'impact.added',
  'impact.changed',
  'impact.removed',
  'impact.dir',
  'impact.surface',

  // controller additions (WP-16): the two new announcements (`AnnouncementKey`
  // 'enhance.ready' and 'clarify.ready') and the three new build endings (`EndNoteKey`
  // 'siteAsOnePage', 'newPageAppended', 'appendedNotReplaced').
  'announce.enhance.ready',
  'announce.clarify.ready',
  'end.siteAsOnePage',
  'end.newPageAppended',
  'end.appendedNotReplaced',

  // WP-14-composer additions: the owner's ✨ Improve action (EnhanceButton, EnhanceNote)
  // and the questions docked above the composer before an unclear request runs
  // (ClarifyPanel). No SPEC table prints them; each value says why in the catalogs.
  'enhance.button',
  'enhance.working',
  'enhance.empty',
  'enhance.busy',
  'enhance.done',
  'enhance.understood',
  'enhance.changes.show',
  'enhance.changes.hide',
  'enhance.restore',
  'enhance.failed',
  'enhance.failed.busy',
  'enhance.failed.unreachable',
  'enhance.failed.timeout',
  'enhance.failed.other',
  'clarify.title',
  'clarify.progress',
  'clarify.progress.aria',
  'clarify.other',
  'clarify.other.placeholder',
  'clarify.other.send',
  'clarify.edit',
  'clarify.sendAsWritten',
  'clarify.cancel',
  'clarify.rewriting',

  // WP-11-frame additions: JumpToLatest's accessible name while a run is live
  // (`jump.aria` stays the idle one).
  'jump.aria.live',

  // WP-12-records additions: what the records need that no SPEC table prints (each value
  // says why in the catalogs).
  'message.aria',
  'direction.aria.colors',
  'direction.aria.fonts',
  'edit.title.donePage',
  'edit.title.noChangePage',
  'proposal.appliedPage',

  // WP-13-decisions additions: what the decision cards need that no SPEC table prints
  // (each value says why in the catalogs).
  'plan.row.reorder',
  'plan.row.menu',
  'plan.row.rename.aria',
  'plan.colors',
  'plan.fonts.menu',
  'plan.fonts.specimen',
  'swatch.pick',
  'swatch.ok.surface',
  'swatch.low.surface',
  'swatch.ok.accent',
  'swatch.low.accent',
  'swatch.refused',
  'swatch.hex.invalid',
  'proposal.title.page',
  'steps.label',
  'steps.target',
  'restore.close',
  'restore.working',

  // WP-15-history-phone additions: a conversation row's accessible name, and why a row
  // cannot be opened or deleted while a run is live (each value says why in the catalogs).
  'history.row',
  'history.busy',
  'history.delete.busy',
] as const;

/** A catalog key. */
export type Key = (typeof KEYS)[number];

/* ── Catalog entries ─────────────────────────────────────────────────────── */

/**
 * An Arabic entry whose words change with a count. All six CLDR categories are required,
 * so no Arabic count can silently fall back to a form written for another category.
 * `by` names the count param (default `n`).
 */
export type ArPlural = Readonly<Record<PluralCategory, string>> & { readonly by?: string };

/**
 * An English entry whose words change with a count: `one` and `other` (CLDR `en`), and
 * optionally `zero`, said for exactly 0 (ICU's `=0`; CLDR `en` has no zero category). It
 * matches Arabic's `zero`, which CLDR also selects for exactly 0, so a key whose Arabic
 * needs its own zero sentence says the same thing in English ("Every section was written").
 */
export interface EnPlural {
  readonly by?: string;
  readonly zero?: string;
  readonly one: string;
  readonly other: string;
}

/**
 * One Arabic value: a template, or plural forms. Templates hold `{slot}`s: a param
 * (`{title}`, `{n}`), or a counted noun (`{sections}`, `{minutes}`: see `nouns.ts`).
 */
export type ArEntry = string | ArPlural;

/** One English value: a template, or plural forms. */
export type EnEntry = string | EnPlural;

/** Whether an entry has plural forms rather than one template. */
export function isPluralEntry<E extends ArEntry | EnEntry>(entry: E): entry is Exclude<E, string> {
  return typeof entry !== 'string';
}

const CATEGORIES = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
] as const satisfies readonly PluralCategory[];

/** Every template an entry can render, in CLDR category order: what a copy rule must read. */
export function entryForms(entry: ArEntry | EnEntry): readonly string[] {
  if (!isPluralEntry(entry)) return [entry];
  const forms: Readonly<Partial<Record<PluralCategory, string>>> = entry;
  return CATEGORIES.flatMap((category) => forms[category] ?? []);
}

/* ── The typed doors ─────────────────────────────────────────────────────── */

/**
 * Every visible status key (SPEC §4.3), as a list the length-budget rule iterates.
 * `catalog.test.ts` asserts its element type equals `StatusKey`, so a status added to
 * `view-types.ts` without copy fails the typecheck.
 */
export const STATUS_KEYS = [
  'run.understanding',
  'build.started',
  'build.planned',
  'build.writing',
  'build.blocked',
  'build.landed',
  'stopping',
  'edit.started',
  'edit.writing',
  'edit.checking',
  'edit.repairing',
  'edit.applying',
  'plan.drafting',
  'proposal.drafting',
] as const satisfies readonly StatusKey[];

/** Every announcement the live region may speak (SPEC §4.3), as a list. */
export const ANNOUNCEMENT_KEYS = [
  'build.started',
  'build.planned',
  'build.blocked',
  'build.progress',
  'build.done',
  'build.partial',
  'stopping',
  'stopped',
  'stopped.none',
  'stopped.budget',
  'stopped.budget.none',
  'stopped.maxTasks',
  'edit.started',
  'edit.startedPage',
  'edit.done',
  'edit.donePage',
  'edit.noChange',
  'edit.noChangePage',
  'plan.drafting',
  'plan.ready',
  'proposal.drafting',
  'proposal.ready',
  'answer.ready',
  'failed',
  'failed.kept',
  'failed.skeleton',
  'undone',
  'redone',
  'queue.queued',
  'queue.already',
  'queue.started',
  'plan.moved',
  'plan.removed',
  'copied',
  // controller additions (WP-16)
  'enhance.ready',
  'clarify.ready',
] as const satisfies readonly AnnouncementKey[];

/** The catalog key of an announcement. */
export type AnnounceKey = `announce.${AnnouncementKey}`;

/** The catalog key LiveStatus renders for an `AnnouncementView.key`. */
export function announceKey(key: AnnouncementKey): AnnounceKey {
  return `announce.${key}`;
}

/**
 * Every button, menu item and toggle whose label names an action. SPEC §4.0: these are
 * verbal nouns (masdar) in Arabic, which keeps them gender-neutral; `catalog.test.ts`
 * snapshots their Arabic for review and checks each opens with a masdar.
 */
export const ACTION_KEYS = [
  'sheet.close',
  'sheet.showPage',
  'sheet.backToChat',
  'panel.resize',
  'jump.aria',
  'build.showSections',
  'build.hideSections',
  'row.undo',
  'row.undo.aria',
  'row.redo',
  'row.redo.aria',
  'row.retry',
  'row.retry.aria',
  'footer.undoBuild',
  'footer.redoBuild',
  'footer.finishRest',
  'footer.removeEmpty',
  'footer.retryFailed',
  'edit.showAll',
  'edit.showOnPage',
  'edit.undo',
  'edit.redo',
  'answer.more',
  'answer.less',
  'plan.row.drag',
  'plan.row.rename',
  'plan.row.moveUp',
  'plan.row.moveDown',
  'plan.row.remove',
  'plan.add',
  'plan.build',
  'plan.discard',
  'steps.run',
  'steps.discard',
  'proposal.apply',
  'proposal.discard',
  'proposal.preview',
  'proposal.preview.end',
  'proposal.viewCode',
  'error.removeSkeleton',
  'error.retry',
  'error.copy',
  'menu.restore',
  'menu.reuse',
  'menu.copySummary',
  'menu.copyAnswer',
  'confirm.undo',
  'confirm.cancel',
  'restore.confirm',
  'mention.button',
  'send',
  'queue',
  'stop',
  'stop.tooltip',
  'queue.continue',
  'queue.remove',
  'chip.remove',
  'history.delete',
  'history.confirm.yes',
  'history.confirm.no',
  'history.back',
] as const satisfies readonly Key[];

/**
 * The authored starters, in the order `starterSuggestions` rotates through them (SPEC
 * §4.16): the first four are the SPEC's rows, shown on an empty page as they are.
 */
export const STARTER_KEYS = [
  'starter.1',
  'starter.2',
  'starter.3',
  'starter.4',
  'starter.5',
  'starter.6',
  'starter.7',
  'starter.8',
] as const satisfies readonly Key[];

/** RecordMenu item → its label (SPEC §4.15; `copyError` and `viewAsCode` reuse §4.14 and §4.13). */
export const MENU_ITEM_KEY = {
  restore: 'menu.restore',
  reuse: 'menu.reuse',
  copySummary: 'menu.copySummary',
  copyAnswer: 'menu.copyAnswer',
  copyError: 'error.copy',
  viewAsCode: 'proposal.viewCode',
  technical: 'menu.technical',
} as const satisfies Readonly<Record<RecordMenuItem, Key>>;

/** QueueHeader caption by queue state (SPEC §4.17). */
export const QUEUE_CAPTION_KEY = {
  editable: 'queue.caption',
  stale: 'queue.stale',
  missing: 'queue.missing',
  paused: 'queue.paused',
} as const satisfies Readonly<Record<QueueStatus, Key>>;

/** Why Build is disabled, as the line under it (SPEC §4.11). */
export const PLAN_PROBLEM_KEY = {
  min: 'plan.min',
  max: 'plan.max',
  contrast: 'plan.contrast',
  duplicateTitle: 'plan.duplicate',
} as const satisfies Readonly<Record<PlanProblem, Key>>;

/** Why an Undo is `aria-disabled`: the text its `aria-describedby` points at (SPEC §4.8). */
export const UNDO_UNAVAILABLE_KEY = {
  revived: 'build.caption.revived',
  changedSince: 'revert.changedSince',
  regionMissing: 'revert.regionMissing',
} as const satisfies Readonly<Record<Extract<UndoView, { kind: 'unavailable' }>['why'], Key>>;

/**
 * The jump pill's label while a run is live, by what the run is doing (SPEC §3.12:
 * "Building" or "Editing"; a run still routing, drafting a plan or a proposal, or
 * answering reads "Working"). With no run the pill reads `jump.idle`.
 */
export const JUMP_LABEL_KEY = {
  routing: 'jump.working',
  build: 'jump.building',
  edit: 'jump.editing',
  plan: 'jump.working',
  proposal: 'jump.working',
  answer: 'jump.working',
} as const satisfies Readonly<Record<RunActivity, Key>>;

/** ErrorRecord's cause line by class; `unknown` has none (SPEC §4.14). */
export const ERROR_CAUSE_KEY = {
  unreachable: 'error.unreachable.cause',
  timeout: 'error.timeout.cause',
  busy: 'error.busy.cause',
  declined: 'error.declined.cause',
  invalid: 'error.invalid.cause',
  tooLarge: 'error.tooLarge.cause',
  offline: 'error.offline.cause',
  unknown: null,
} as const satisfies Readonly<Record<ErrorClass, Key | null>>;

/**
 * ErrorRecord's page-state line by what the error left on the page (SPEC §4.14): `kept`
 * reads its count in parentheses (`{n}` is `landed`).
 */
export const ERROR_PAGE_KEY = {
  unchanged: 'error.page.unchanged',
  kept: 'error.page.kept',
  skeleton: 'error.page.skeleton',
  unknown: 'error.page.unknown',
} as const satisfies Readonly<Record<ErrorPageState['kind'], Key>>;

/**
 * A build record's title (SPEC §4.8 phase table). A stopping build keeps its running
 * title (the RunBar says "Stopping…"); a stopped one is titled by why it stopped.
 */
export function buildTitleKey(phase: BuildPhase, stopReason?: BuildStopReason): Key {
  switch (phase) {
    case 'skeleton':
      return 'build.title.skeleton';
    case 'building':
    case 'stopping':
      return 'build.title.running';
    case 'done':
      return 'build.title.done';
    case 'partial':
      return 'build.title.partial';
    case 'stopped':
      if (stopReason === 'budget') return 'build.title.budget';
      if (stopReason === 'maxTasks') return 'build.title.maxTasks';
      return 'build.title.stopped';
    case 'interrupted':
      return 'build.title.interrupted';
    case 'failed':
      return 'build.title.failed';
    case 'undone':
      return 'build.title.undone';
  }
}
