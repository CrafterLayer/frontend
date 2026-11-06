import type { AiBuildOwnEvent, AiBuildRunResult, PersistenceAck } from '@craftkit/builder';

import { isResumable, type RunRecord } from './run-record';
import { reduceRunRecord } from './run-record-reduce';
import { vaultWriteAcknowledgement, type VaultStore } from './store';

/*
  The record itself — its shape, its reducer and its readers — lives in `run-record.ts`
  (split 2026-11-06). Re-exported here so every importer of the journal keeps one door.
*/
export {
  describeRun,
  isRecoverable,
  isResumable,
  landedUnits,
  pendingUnits,
  resumePoint,
  runEnding,
  type RunEnding,
  type RunOutlineEntry,
  type RunRecord,
  type RunStage,
  type RunStatus,
  type RunUnitRecord,
  type RunUnitStatus,
} from './run-record';

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
 * with `settle`, `halt` or `fail` from what the run actually returned or threw.
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
 * Several checkpoints' worth: a scene section may write for fifteen minutes
 * (2026-10-31), so a run that is merely slow must not be declared dead by a tab
 * that just booted.
 */
export const RUN_ORPHAN_AFTER_MS = 20 * 60 * 1000;

export interface StartRunOptions {
  readonly runId: string;
  readonly docId: string;
  readonly pageId: string;
  readonly request: string;
  /** The agent turn this run writes, when an agent panel started it. */
  readonly turnId?: string;
  readonly mode: string;
  readonly providerKind: string;
  readonly baseFingerprint: string;
  readonly snapshotId?: string;
  readonly limits?: RunRecord['limits'];
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
   * Close a record the person STOPPED before the run returned anything: Stop while the
   * plan was still being written rethrows the abort, so no result and no terminal event
   * exist — yet sections may already have landed early (the streamed build).
   */
  halt(runId: string): Promise<void>;
  /**
   * Record that the person answered `stop` at the approval prompt.
   *
   * Called by the caller holding that prompt, because the run cannot tell:
   * declining a plan and stopping a build both arrive as `outcome: 'signal'`
   * with every section `not-started`. Without this a plan somebody refused is
   * offered back to them as unfinished work.
   */
  decline(runId: string): Promise<void>;
  /** The person kept what was built: never offered for continuing again. */
  keep(runId: string): Promise<void>;
  /**
   * Open a settled (or orphaned) record again for a successor that writes the rest of its
   * sections into it ("Continue where it stopped"): it is `running` until the successor
   * settles it, so a crash during the successor leaves it interrupted again, with the
   * right sections pending. No-op for a record with no unit table.
   */
  reopen(runId: string): Promise<void>;
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

/**
 * The journal bound to the document its runs write: what a host hands the agent panel,
 * which knows its pages but not the vault's document id.
 */
export interface DocumentRunJournal {
  readonly docId: string;
  readonly journal: RunJournal;
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

/** A record without the fields a reopened run must not carry forward. */
function reopened(record: RunRecord): RunRecord {
  const { kept: _kept, failure: _failure, outcome: _outcome, ...rest } = record;
  void _kept;
  void _failure;
  void _outcome;
  return { ...rest, status: 'running', stage: 'planned', recovered: false };
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
        ...(startOptions.turnId === undefined ? {} : { turnId: startOptions.turnId }),
        mode: startOptions.mode,
        providerKind: startOptions.providerKind,
        baseFingerprint: startOptions.baseFingerprint,
        ...(startOptions.snapshotId === undefined ? {} : { snapshotId: startOptions.snapshotId }),
        ...(startOptions.limits === undefined ? {} : { limits: startOptions.limits }),
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
          const next = reduceRunRecord(current, event);
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

    async halt(runId) {
      /*
        The units are left exactly as the stream left them: a section that landed early
        is `applied` (it is on the page, in its own transaction), and the rest stay
        waiting — which is what a resume writes.
      */
      await serialise(() =>
        update(runId, (current) => ({
          ...current,
          status: 'stopped',
          stage: current.units.length === 0 ? current.stage : 'settled',
          outcome: 'signal',
          recovered: false,
        })),
      );
    },

    async decline(runId) {
      await serialise(() => update(runId, (current) => ({ ...current, declined: true })));
    },

    async keep(runId) {
      await serialise(() => update(runId, (current) => ({ ...current, kept: true })));
    },

    async reopen(runId) {
      await serialise(() => update(runId, reopened, (current) => current.units.length > 0));
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
