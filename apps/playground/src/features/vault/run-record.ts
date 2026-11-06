/**
 * The run journal's RECORD: its shape and the readers that say what it means. Split from
 * `run-journal.ts` (2026-11-06), which keeps the storage, the write chain and the clock;
 * the pure reducer that moves a record one build event at a time is `run-record-reduce.ts`.
 *
 * Page builds write it too (the agent panel, 2026-11-06): the streamed outline, every
 * landing with its transaction label, and why the run ended — so a reload, or a tab that
 * crashed mid-build, still knows what landed and what is left to write.
 */

/** Where the run is as a whole. `running` is the one an orphan sweep recovers. */
export type RunStatus = 'running' | 'stopped' | 'completed' | 'failed';

/**
 * How far a run got structurally, which is a different question from `status`.
 *
 * There is deliberately NO `scaffolded` state, and its absence is a finding
 * rather than an oversight. The skeleton is applied to the live document
 * minutes before the unit table exists, so a crash in that window leaves a
 * record at `scaffolding` and a page that already carries a skeleton — and a
 * Restart that did not know would lay down a second one. The state that would
 * say so cannot be reached: the engine emits nothing between `build.scaffolding`
 * and `build.planned`, so there is no moment at which this file could honestly
 * write it. Declaring it anyway would put a value in the type that no record
 * ever holds, and a consumer would branch on a state that cannot occur.
 *
 * Until run-build emits a scaffold-applied event, `stage === 'scaffolding'` on a
 * settled record IS the "a skeleton may be on the page" signal, and it is the
 * one a Restart must read.
 */
export type RunStage = 'scaffolding' | 'planned' | 'settled';

/**
 * A unit's state, with `running` — which the engine's own `AiBuildTaskStatus`
 * does not have.
 *
 * The engine reports three verdicts (`applied`, `skipped`, `not-started`) and
 * emits nothing at all for a unit killed mid-write. But this task is named
 * after recovering an orphaned `running`, and a record that cannot express
 * `running` has nothing to recover. `waiting` is the fifth: a unit the lander
 * never reached, which is exactly where a resume begins.
 */
export type RunUnitStatus = 'waiting' | 'running' | 'applied' | 'skipped' | 'not-started';

export interface RunUnitRecord {
  /**
   * The 1-based index into the planned list, and the ONLY correlation key.
   *
   * Not the node id: `task.*` events carry `position`, and a retry reuses the
   * step's run id so `(runId, seq)` is not unique either.
   */
  readonly position: number;
  readonly id: string;
  readonly title: string;
  readonly status: RunUnitStatus;
  /** Attempts actually made. A unit may be started twice; it is one unit. */
  readonly attempts: number;
  /** Why it was skipped or never started. A STRING, so the record stays cloneable. */
  readonly reason?: string;
  readonly startedAt?: number;
  readonly settledAt?: number;
  /** The plan's section key (`SectionContract.key`), once the build's report named it. */
  readonly sectionKey?: string;
  /**
   * The one transaction this unit landed in, and its history label
   * (`Assistant: 2/7 — Menu`), from `task.completed` — written the moment it landed,
   * before the plan was in on a streamed build (the early lander).
   */
  readonly transactionId?: string;
  readonly label?: string;
}

/** One section the STREAMED plan named (`build.outline`): its key and its title. */
export interface RunOutlineEntry {
  readonly key: string;
  readonly title: string;
}

export interface RunRecord {
  readonly runId: string;
  /** The document this run was started against. A record for another one is not ours. */
  readonly docId: string;
  /**
   * The page this run was started on.
   *
   * Required, not defaulted. The page lens exposes no page id, and the site's
   * "current page" moves the moment a person navigates — so it cannot be read
   * at checkpoint time without recording wherever they wandered to. It has to
   * be captured once, at the start, by the caller that knows. Empty when the
   * caller has no site to name the page by.
   */
  readonly pageId: string;
  readonly request: string;
  /** The agent turn whose record this run writes: what a reloaded panel matches it to. */
  readonly turnId?: string;
  /**
   * Which mode the run carried, which decides what stream it produces at all.
   *
   * `plan` emits one event and returns; `ask` waits on an approval; `auto` runs
   * straight through. Without it the orphan sweep cannot tell a legitimately
   * unclosed plan-only run from a torn writing one.
   */
  readonly mode: string;
  /** `offline` or `remote`. Recorded for the tier comparison, and for triage. */
  readonly providerKind: string;
  /** What the live document was when the draft was seeded (a page build: when it began). */
  readonly baseFingerprint: string;
  /** The pre-run restore point, when the caller took one. */
  readonly snapshotId?: string;
  /**
   * The three limits that can be read honestly; absent when the caller set none and the
   * engine chose its own (a page build from the agent panel).
   *
   * `fillConcurrency` is deliberately absent: it is computed inside the
   * orchestrator by a formula that is not exported, is not on the run result,
   * and is not on the options the panel passes. Recording a re-derived guess
   * would be a second answer to a question this record cannot actually ask.
   */
  readonly limits?: {
    readonly maxTasks: number;
    readonly taskTimeoutMs: number;
    readonly buildBudgetMs: number;
  };
  readonly status: RunStatus;
  readonly stage: RunStage;
  /** The scaffold's rationale — every fill obeyed this text. */
  readonly direction?: string;
  /**
   * The plan's sections as the streamed plan named them (`build.outline`), in page order:
   * the newest outline, which is the whole list. Absent on a build whose plan did not
   * stream; its units still name every section by region and title.
   */
  readonly outline?: readonly RunOutlineEntry[];
  readonly units: readonly RunUnitRecord[];
  /** The engine's own outcome word, once the run settled. */
  readonly outcome?: string;
  /**
   * Why the split build stood down in favour of one ordinary run.
   *
   * Its own field, not `failure`: the fallback is a success path. The scaffold
   * produced fewer than two regions, so a build would have been worse than the
   * single call it replaces — that is a routing decision worth recording and
   * not an error worth reporting.
   */
  readonly fallbackReason?: string;
  readonly elapsedMs?: number;
  /**
   * What the run has SPENT so far, against the limits above.
   *
   * Written at every checkpoint rather than only at the end, because the whole
   * point of a durable record is to describe a run that never reached its end.
   *
   * Two of the three budgets can be tracked and one cannot. Wall clock comes
   * from the events' own `at`, and started units count against `maxTasks`.
   * TOKENS cannot: no token counter reaches `AiBuildEvent` at all — the numbers
   * on `context.ready` and `skills.resolved` are per-step context budgets, not
   * spend — so a token field here would be a number nobody could fill. It
   * arrives when the wire carries `usage` (T305), and not before.
   */
  readonly spent: {
    /** Wall clock from the first event to the last checkpoint. */
    readonly elapsedMs: number;
    /** Units that reached `running` at least once, against `limits.maxTasks`. */
    readonly tasksStarted: number;
  };
  /** Why the run failed, as a string. Set only by `fail`, and cleared by nothing. */
  readonly failure?: string;
  /**
   * True when an orphan sweep closed this record because nobody else did.
   *
   * Its OWN field rather than a sentence in `failure`, for two reasons. The
   * record must be able to say "the tab went away" without claiming the run
   * failed — it may have finished perfectly and simply never been closed. And a
   * run that turns out to be alive after all must be able to take the verdict
   * back, which `settle` and a terminal `build.completed` both do; a sentence
   * merged into a shared field could not be withdrawn without guessing which
   * sentence to remove.
   */
  readonly recovered?: boolean;
  /**
   * True when the person answered `stop` at the approval prompt.
   *
   * Set by the caller, because nothing in the run can tell it apart from a mid-
   * build Stop: `onPlanned` returning `'stop'` produces the same
   * `outcome: 'signal'` an `AbortSignal` does, and the same all-`not-started`
   * report. Without it a plan somebody refused would be offered back to them
   * as unfinished work.
   */
  readonly declined?: boolean;
  /**
   * True when the person chose to keep what was built rather than continue it ("Keep
   * what was built"): what landed stays, and the run is never offered for continuing again.
   */
  readonly kept?: boolean;
  /** Successor that claimed this stopped record; prevents applying completed units twice. */
  readonly resumedByRunId?: string;
  /**
   * Set when a checkpoint could not be written.
   *
   * Reported rather than thrown, because the only caller is inside an emitter
   * that swallows throws. A record carrying this is stale by definition and
   * must not be offered for Resume.
   */
  readonly writeFailure?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /**
   * Bumped on every checkpoint, and the ONLY thing separating an orphan from a
   * run that is alive in another tab.
   *
   * A sweep that recovered every `running` record it found would flip a live
   * build to `stopped` the moment a second tab booted, and the live tab would
   * then keep checkpointing into a record marked dead.
   */
  readonly heartbeatAt: number;
}

/* ── Reading a record ──────────────────────────────────────────────────────── */

/**
 * The first unit a resume would have to start from, or nothing when there is
 * none.
 *
 * `not-started` counts, and leaving it out was a real bug rather than a
 * borderline call. Two words describe one physical state — a section the lander
 * never reached — and which one is stored depends only on HOW the run ended.
 * A torn tab leaves `waiting`, because no terminal event ever arrived. A clean
 * stop at `max-tasks`, at the budget, or on Stop emits `build.completed`, whose
 * report calls exactly the same untouched sections `not-started`, because that
 * is the engine's whole vocabulary (`AiBuildTaskStatus` has no `waiting`).
 *
 * Matching only `waiting` therefore made the journal able to resume a CRASH and
 * unable to resume a clean stop — the exact opposite of the useful case, and
 * the canonical one: a ten-section page under a task limit.
 */
export function resumePoint(record: RunRecord): RunUnitRecord | undefined {
  return record.units.find(
    (unit) =>
      unit.status === 'waiting' || unit.status === 'running' || unit.status === 'not-started',
  );
}

/**
 * Whether this record can be continued at all.
 *
 * Four kinds of run cannot, and each for its own reason: a plan-only run wrote
 * nothing and its units have no addressable region; a run that never reached
 * `planned` has no unit table; a record whose last checkpoint failed is stale by
 * definition, so its unit states are not to be trusted; and a plan the person
 * DECLINED is not unfinished work, it is work they said no to.
 *
 * That last one needs a field because it cannot be read from the run. Answering
 * `'stop'` at the approval prompt and pressing Stop mid-build both arrive as
 * `outcome: 'signal'` with every remaining section `not-started` — identical
 * records for opposite intentions. Only the caller holding the prompt knows
 * which happened, which is why `decline` exists rather than a heuristic here.
 */
export function isResumable(record: RunRecord): boolean {
  if (record.status === 'running' || record.status === 'completed') return false;
  if (record.declined === true) return false;
  if (record.resumedByRunId !== undefined) return false;
  if (record.writeFailure !== undefined) return false;
  if (record.stage !== 'planned' && record.stage !== 'settled') return false;
  return resumePoint(record) !== undefined;
}

/** Why a run ended, in the four words a person is told. */
export type RunEnding = 'completed' | 'stopped' | 'errored' | 'interrupted';

/**
 * Why the run ended. `running` reads as `interrupted`: the tab that was writing it went
 * away, so no end mark was ever written — and that is the only way a record with no end
 * mark can be read by a caller that owns no live run (a panel that just booted owns none).
 * A sweep's `recovered` is the same verdict, made later by somebody else.
 */
export function runEnding(record: RunRecord): RunEnding {
  if (record.status === 'completed') return 'completed';
  if (record.status === 'failed') return 'errored';
  if (record.status === 'running' || record.recovered === true) return 'interrupted';
  return 'stopped';
}

const PENDING: ReadonlySet<RunUnitStatus> = new Set(['waiting', 'running', 'not-started']);

/** The units still to write, in page order: what a resume writes, and only these. */
export function pendingUnits(record: RunRecord): readonly RunUnitRecord[] {
  return record.units.filter((unit) => PENDING.has(unit.status));
}

/** The units on the page: each landed in its own labelled transaction. */
export function landedUnits(record: RunRecord): readonly RunUnitRecord[] {
  return record.units.filter((unit) => unit.status === 'applied');
}

/**
 * The record in one line, for triage and logs (never the person's copy, which is the
 * panel's): "interrupted after 3 of 7 sections".
 */
export function describeRun(record: RunRecord): string {
  const landed = landedUnits(record).length;
  const total = record.units.length;
  return `${runEnding(record)} after ${String(landed)} of ${String(total)} sections`;
}

/**
 * Whether a person can be offered to continue this run where it stopped: it did not
 * complete, they neither declined nor kept it, nobody resumed it already, its checkpoints
 * are trustworthy, and something is left to write.
 *
 * Unlike `isResumable` it reads a `running` record as interrupted (`runEnding`), so ask it
 * only about a run no live tab is writing.
 */
export function isRecoverable(record: RunRecord): boolean {
  if (runEnding(record) === 'completed') return false;
  if (record.declined === true || record.kept === true) return false;
  if (record.resumedByRunId !== undefined || record.writeFailure !== undefined) return false;
  if (record.stage === 'scaffolding') return false;
  return pendingUnits(record).length > 0;
}
