import type { AiBuildOwnEvent, AiBuildRunResult, PersistenceAck } from '@craftkit/builder';

import { vaultWriteAcknowledgement, type VaultStore } from './store';

/**
 * What a run DID, durable enough to survive the tab that was doing it.
 *
 * ## What it is for
 *
 * A build is minutes long. A person reloads in the middle of one — because they
 * think it hung, because a phone rang, because a tab crashed — and without a
 * record there is nothing to come back to: the draft is still in the vault, but
 * nothing knows which sections were written, which were refused and why, or
 * where a resume would have to start. This is that record.
 *
 * ## Why it is written from EVENTS but closed from the RESULT
 *
 * The event stream is the only thing that exists while a run is in flight, and
 * three of its shapes never reach a terminal build event at all:
 *
 *   - `apply: 'never'` (Plan mode) emits `build.scaffolding` and nothing else;
 *   - the fallback path emits `build.skipped` and runs an ordinary agent;
 *   - an aborted scaffold RETHROWS, so the run rejects after one event.
 *
 * A journal that waited for `build.completed` would leave all three `running`
 * forever. So the stream moves the record forward, and the caller closes it
 * with `settle` or `fail` from what the run actually returned or threw.
 *
 * ## Why it never throws
 *
 * A checkpoint is written from inside the orchestrator's `onEvent`, which wraps
 * the callback in `try { … } catch {}` — a synchronous throw there is swallowed
 * with no trace, and an async rejection escapes as an unhandled rejection
 * nobody observes. Either way the build stays green over a frozen record. So
 * every write here is caught, and a failure is REPORTED on the record itself
 * (`writeFailure`) rather than raised at a caller who cannot hear it.
 *
 * For the same reason nothing stored here is anything but plain JSON: reasons
 * are strings, never `Error` objects. The memory store clones on both sides and
 * a non-cloneable value throws SYNCHRONOUSLY, inside the emitter, where it
 * would be eaten.
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
   * be captured once, at the start, by the caller that knows.
   */
  readonly pageId: string;
  readonly request: string;
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
  /** What the live document was when the draft was seeded. */
  readonly baseFingerprint: string;
  /** The pre-run restore point, when the caller took one. */
  readonly snapshotId?: string;
  /**
   * The three limits that can be read honestly.
   *
   * `fillConcurrency` is deliberately absent: it is computed inside the
   * orchestrator by a formula that is not exported, is not on the run result,
   * and is not on the options the panel passes. Recording a re-derived guess
   * would be a second answer to a question this record cannot actually ask.
   */
  readonly limits: {
    readonly maxTasks: number;
    readonly taskTimeoutMs: number;
    readonly buildBudgetMs: number;
  };
  readonly status: RunStatus;
  readonly stage: RunStage;
  /** The scaffold's rationale — every fill obeyed this text. */
  readonly direction?: string;
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

const RUN_PREFIX = 'vault/run/';

const runKey = (runId: string): string => `${RUN_PREFIX}${runId}`;

/**
 * How long a record is kept. Deliberately no shorter than the draft's own TTL:
 * a journal that outlived its draft would offer Resume against a document that
 * is gone, and one that died first would strand a draft nothing points at.
 */
export const RUN_JOURNAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How stale a heartbeat must be before a `running` record is called an orphan.
 *
 * Several checkpoints' worth: a section takes up to four minutes, so a run that
 * is merely slow must not be declared dead by a tab that just booted.
 */
export const RUN_ORPHAN_AFTER_MS = 15 * 60 * 1000;

export interface StartRunOptions {
  readonly runId: string;
  readonly docId: string;
  readonly pageId: string;
  readonly request: string;
  readonly mode: string;
  readonly providerKind: string;
  readonly baseFingerprint: string;
  readonly snapshotId?: string;
  readonly limits: RunRecord['limits'];
}

export interface RunJournal {
  /** Storage result for the latest checkpoint of this run. */
  acknowledgement(runId: string): PersistenceAck;
  /** Open a record. Returns what was written, so a caller can hold the shape. */
  start(options: StartRunOptions): Promise<RunRecord>;
  /**
   * Move the record on one build event. Never throws, never rejects — it is
   * called from inside an emitter that would swallow either.
   */
  record(runId: string, event: AiBuildOwnEvent): Promise<void>;
  /** Close a record from what the run RETURNED. The three silent shapes need this. */
  settle(runId: string, result: AiBuildRunResult): Promise<void>;
  /** Close a record that threw. `reason` is a string; an Error would not clone. */
  fail(runId: string, reason: string): Promise<void>;
  /**
   * Record that the person answered `stop` at the approval prompt.
   *
   * Called by the caller holding that prompt, because the run cannot tell:
   * declining a plan and stopping a build both arrive as `outcome: 'signal'`
   * with every section `not-started`. Without this a plan somebody refused is
   * offered back to them as unfinished work.
   */
  decline(runId: string): Promise<void>;
  /** Atomically reserve a resumable predecessor for one new run identity. */
  claimResume(runId: string, successorRunId: string): Promise<RunRecord | undefined>;
  read(runId: string): Promise<RunRecord | undefined>;
  /** Every record, newest first. Filtered to one document when asked. */
  list(docId?: string): Promise<readonly RunRecord[]>;
  discard(runId: string): Promise<void>;
  /** Flip stale `running` records to `stopped`, and report which. */
  recover(): Promise<readonly string[]>;
  /** Drop what has aged out, and report which. */
  sweep(): Promise<readonly string[]>;
}

export interface RunJournalOptions {
  /**
   * The store, and NOTHING else.
   *
   * Not a persistence adapter and not a `Drafts` handle: the document adapter
   * has no caller in the product today, so a journal that required one would
   * inherit a dependency the app cannot satisfy.
   */
  readonly store: VaultStore;
  readonly now: () => number;
}

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

function unitsFromPlanned(tasks: readonly { id: string; title: string }[]): RunUnitRecord[] {
  return tasks.map((task, index) => ({
    position: index + 1,
    id: task.id,
    title: task.title,
    status: 'waiting' as const,
    attempts: 0,
  }));
}

/** Replace one unit by POSITION, leaving the rest exactly as they were. */
function withUnit(
  units: readonly RunUnitRecord[],
  position: number,
  change: (unit: RunUnitRecord) => RunUnitRecord,
): readonly RunUnitRecord[] {
  return units.map((unit) => (unit.position === position ? change(unit) : unit));
}

/** Apply one event to a record. Pure: the caller owns storage and the clock. */
function reduce(record: RunRecord, event: AiBuildOwnEvent): RunRecord {
  switch (event.type) {
    case 'build.scaffolding':
      return { ...record, stage: 'scaffolding' };

    case 'build.skipped':
      /*
        NOT terminal, and not a failure — both of which this arm got wrong.

        `build.skipped` is emitted BEFORE the fallback run starts, and that run
        is a SUCCESS path: one ordinary agent writes the whole page. Marking the
        record `stopped` here froze it minutes before the work finished, and
        every later checkpoint then described a run the journal had already
        buried. And the skeleton's explanation is not a failure — it went into
        `failure`, a field documented as set only by `fail`, leaving a
        successful build carrying a failure sentence forever.

        So: keep the reason as the OUTCOME, stay running, and let the caller
        close it from the result like every other silent shape.
      */
      return { ...record, outcome: 'fallback', fallbackReason: event.reason };

    case 'build.planned':
      /*
        The mandatory first checkpoint that has a unit table at all, and the
        only event carrying real node ids. It also proves the skeleton landed,
        which is why the stage passes through `scaffolded` conceptually and
        arrives here.
      */
      return {
        ...record,
        stage: 'planned',
        direction: event.direction,
        units: unitsFromPlanned(event.tasks),
      };

    case 'task.started':
      /*
        Fires once per ATTEMPT, not once per unit — the writer loops over two
        attempts and emits inside the loop. So `startedAt` is set once and kept:
        resetting it on a retry would report the unit as younger than it is.
      */
      return {
        ...record,
        units: withUnit(record.units, event.position, (unit) => ({
          ...unit,
          status: 'running',
          attempts: event.attempt,
          startedAt: unit.startedAt ?? event.at,
        })),
      };

    case 'task.completed':
      return {
        ...record,
        units: withUnit(record.units, event.position, (unit) => ({
          ...unit,
          status: 'applied',
          attempts: event.attempts,
          settledAt: event.at,
        })),
      };

    case 'task.skipped':
      return {
        ...record,
        units: withUnit(record.units, event.position, (unit) => ({
          ...unit,
          status: 'skipped',
          attempts: event.attempts,
          reason: event.reason,
          settledAt: event.at,
        })),
      };

    case 'build.stopped':
      /*
        NOT terminal, and the unit table is NOT frozen here. `halt()` settles
        only the unclaimed slots; sections already being written keep landing,
        so up to `fillConcurrency` more `task.completed` events arrive after
        this one. Freezing here would lose them, and a resume computed at this
        moment would re-fill units that are about to succeed.
      */
      return { ...record, outcome: event.reason };

    case 'build.completed':
      /*
        The one place a `not-started` verdict exists. The lander pushes that
        report and continues without emitting anything, so a unit the run never
        reached has no event of its own — its reason lives only here.
      */
      return {
        ...record,
        status: event.outcome === 'completed' ? 'completed' : 'stopped',
        stage: 'settled',
        outcome: event.outcome,
        elapsedMs: event.elapsedMs,
        /*
          A run that reaches here is alive, whatever a sweep decided while it was
          quiet. Taking the verdict back is the point of keeping it in its own
          field: a record cannot be both finished and abandoned.
        */
        recovered: false,
        units: event.tasks.map((report, index) => {
          /*
            The verdicts are the report's; the TIMES are the stream's.

            An earlier version stamped `settledAt: event.at` on every unit, which
            replaced each section's real landing time with the build's own last
            moment and invented one for sections that never started. The report
            says WHAT happened; only `task.completed` / `task.skipped` know when.
          */
          const known = record.units[index];
          const settledAt =
            known?.settledAt ?? (report.status === 'not-started' ? undefined : event.at);
          return {
            position: index + 1,
            id: report.id,
            title: report.title,
            status: report.status,
            attempts: report.attempts,
            ...(report.reason === undefined ? {} : { reason: report.reason }),
            ...(known?.startedAt === undefined ? {} : { startedAt: known.startedAt }),
            ...(settledAt === undefined ? {} : { settledAt }),
          };
        }),
      };

    /* v8 ignore next 2 -- every event type above is handled; this is the guard. */
    default:
      return record;
  }
}

export function createRunJournal(options: RunJournalOptions): RunJournal {
  const { store, now } = options;

  /*
    Every write goes through ONE chain.

    Two writes racing on the same key is a lost update, and this module is
    written to from an event emitter that fires many times a second during a
    build. Serialising is cheaper than any merge, and it also makes the
    single-instance requirement visible: a second journal over the same store
    would have its own chain and lose to this one.
  */
  let chain: Promise<unknown> = Promise.resolve();

  const serialise = async <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next.catch(() => undefined);
    return next;
  };

  /*
    Write failures REMEMBERED in memory, and merged into every later write.

    Marking the record at the moment of failure does not work, and the reason is
    obvious once seen: the write that would carry the mark uses the same store
    that just refused. The mark is lost exactly when it matters most, and the
    record silently becomes trustworthy again the moment the store recovers.

    Holding it here inverts that. A run that lost one checkpoint carries the
    fact for the rest of its life, and the fact lands as soon as the store will
    take anything at all — which is precisely when someone might act on it.
  */
  const writeFailures = new Map<string, string>();
  const writeAcknowledgements = new Map<string, PersistenceAck>();

  const readRecord = async (runId: string): Promise<RunRecord | undefined> =>
    store.get<RunRecord>(runKey(runId));

  const writeRecord = async (record: RunRecord): Promise<void> => {
    const remembered = writeFailures.get(record.runId);
    const acknowledgement: PersistenceAck = vaultWriteAcknowledgement(
      store,
      await store.set(
        runKey(record.runId),
        {
          ...record,
          ...(remembered === undefined ? {} : { writeFailure: remembered }),
        },
        record.updatedAt,
      ),
      record.updatedAt,
    );
    writeAcknowledgements.set(record.runId, acknowledgement);
    if (acknowledgement.kind === 'failed') throw new Error(acknowledgement.reason);
  };

  /**
   * Read, change, write — and on failure, remember rather than throw.
   *
   * `guard` is re-checked against the record as it stands INSIDE the chain, and
   * it is not optional politeness. `recover` and `sweep` both decide from a
   * listing taken outside the chain: without a re-check, a run that settled or
   * checkpointed in that window was overwritten as an abandoned orphan, or had
   * its record deleted seconds after it was refreshed. The decision has to be
   * made twice — once to choose the candidates, once against the record it is
   * about to write.
   *
   * Returns whether the write actually landed, so a caller can report what it
   * DID rather than what it intended.
   */
  const update = async (
    runId: string,
    change: (record: RunRecord) => RunRecord,
    guard?: (record: RunRecord) => boolean,
  ): Promise<boolean> => {
    try {
      const record = await readRecord(runId);
      if (record === undefined) return false;
      if (guard !== undefined && !guard(record)) return false;
      const at = now();
      await writeRecord({ ...change(record), updatedAt: at, heartbeatAt: at });
      return true;
    } catch (cause: unknown) {
      /*
        The FIRST failure is the one kept. A store that is refusing will refuse
        the next twenty writes too, and the twentieth message says nothing the
        first did not.
      */
      const reason = cause instanceof Error ? cause.message : String(cause);
      if (!writeFailures.has(runId)) writeFailures.set(runId, reason);
      /*
        Best effort, immediately: the Map only reaches storage on a LATER
        successful write by this same tab, and the case this module exists for
        is a tab that does not get one. Trying now costs a call that is probably
        about to fail too, and buys the mark whenever the refusal was momentary.
      */
      try {
        const record = await readRecord(runId);
        if (record !== undefined)
          await store.set(runKey(runId), { ...record, writeFailure: reason });
      } catch {
        // The store is not answering at all. The Map is the only copy left.
      }
      return false;
    }
  };

  const journal: RunJournal = {
    acknowledgement(runId) {
      return (
        writeAcknowledgements.get(runId) ??
        store.persistence?.(0) ?? { kind: 'durable', sequence: 0 }
      );
    },

    async start(startOptions) {
      const at = now();
      const record: RunRecord = {
        runId: startOptions.runId,
        docId: startOptions.docId,
        pageId: startOptions.pageId,
        request: startOptions.request,
        mode: startOptions.mode,
        providerKind: startOptions.providerKind,
        baseFingerprint: startOptions.baseFingerprint,
        ...(startOptions.snapshotId === undefined ? {} : { snapshotId: startOptions.snapshotId }),
        limits: startOptions.limits,
        status: 'running',
        stage: 'scaffolding',
        units: [],
        spent: { elapsedMs: 0, tasksStarted: 0 },
        createdAt: at,
        updatedAt: at,
        heartbeatAt: at,
      };
      await serialise(async () => {
        await writeRecord(record);
      });
      return record;
    },

    async record(runId, event) {
      await serialise(() =>
        update(runId, (current) => {
          const next = reduce(current, event);
          return {
            ...next,
            spent: {
              elapsedMs: Math.max(0, event.at - current.createdAt),
              tasksStarted: next.units.filter((unit) => unit.startedAt !== undefined).length,
            },
          };
        }),
      );
    },

    async settle(runId, result) {
      /*
        Closed from the RESULT, because three shapes of run never emit a
        terminal event: a plan-only run stops after `build.scaffolding`, the
        fallback path emits `build.skipped` and runs an ordinary agent, and an
        aborted scaffold rethrows. All three would otherwise sit `running`
        until an orphan sweep found them fifteen minutes later.
      */
      await serialise(() =>
        update(runId, (current) => ({
          ...current,
          status: result.outcome === 'completed' ? 'completed' : 'stopped',
          stage: 'settled',
          outcome: result.outcome,
          elapsedMs: result.elapsedMs,
          /* Alive after all — a record cannot be both finished and abandoned. */
          recovered: false,
          ...(result.direction === '' ? {} : { direction: result.direction }),
        })),
      );
    },

    async fail(runId, reason) {
      await serialise(() =>
        update(runId, (current) => ({
          ...current,
          status: 'failed',
          stage: 'settled',
          failure: reason,
        })),
      );
    },

    async decline(runId) {
      await serialise(() => update(runId, (current) => ({ ...current, declined: true })));
    },

    async claimResume(runId, successorRunId) {
      if (successorRunId.length === 0 || successorRunId === runId) return undefined;
      let claimed: RunRecord | undefined;
      const landed = await serialise(() =>
        update(
          runId,
          (current) => {
            claimed = { ...current, resumedByRunId: successorRunId };
            return claimed;
          },
          isResumable,
        ),
      );
      return landed ? claimed : undefined;
    },

    async read(runId) {
      return readRecord(runId);
    },

    async list(docId) {
      const keys = await store.keys(RUN_PREFIX);
      const records = await Promise.all(keys.map((key) => store.get<RunRecord>(key)));
      return records
        .filter((record): record is RunRecord => record !== undefined)
        .filter((record) => docId === undefined || record.docId === docId)
        .sort((left, right) => right.createdAt - left.createdAt);
    },

    async discard(runId) {
      await serialise(async () => {
        writeFailures.delete(runId);
        try {
          await store.remove(runKey(runId));
        } catch {
          /*
            Swallowed like every other write in this file. `remove` was the one
            store call left unwrapped, and a rejection from it took `sweep` down
            mid-loop — abandoning every record after the one that failed, and
            reporting none of the ones already removed.
          */
        }
      });
    },

    async recover() {
      const isOrphan = (record: RunRecord): boolean =>
        record.status === 'running' && now() - record.heartbeatAt > RUN_ORPHAN_AFTER_MS;

      const candidates = (await journal.list()).filter(isOrphan);
      const claimed: string[] = [];
      for (const candidate of candidates) {
        /*
          The orphan test is applied TWICE — once to choose the candidate, once
          against the record as it stands inside the chain. The listing was read
          outside it, and a run that settled or checkpointed in between is not an
          orphan any more; without the second test it was overwritten as one, and
          a live build was told its tab had gone away.
        */
        const landed = await serialise(() =>
          update(
            candidate.runId,
            (current) => ({ ...current, status: 'stopped', recovered: true }),
            isOrphan,
          ),
        );
        /*
          Reported only when the write LANDED. `update` swallows a store failure
          by design, so returning the candidate list unconditionally claimed
          recoveries that never reached storage.
        */
        if (landed) claimed.push(candidate.runId);
      }
      return claimed;
    },

    async sweep() {
      const isStale = (record: RunRecord): boolean => record.updatedAt < now() - RUN_JOURNAL_TTL_MS;
      const candidates = (await journal.list()).filter(isStale);
      const dropped: string[] = [];
      for (const candidate of candidates) {
        /*
          Re-read inside the chain before deleting. The listing is a snapshot,
          and a checkpoint landing between the two refreshes `updatedAt` — a
          sweep that deleted anyway destroyed the record of a run that was
          demonstrably alive, and every later checkpoint then silently no-opped
          because there was nothing left to update.
        */
        const still = await serialise(() => readRecord(candidate.runId));
        if (still === undefined || !isStale(still)) continue;
        await journal.discard(candidate.runId);
        dropped.push(candidate.runId);
      }
      return dropped;
    },
  };

  return journal;
}
