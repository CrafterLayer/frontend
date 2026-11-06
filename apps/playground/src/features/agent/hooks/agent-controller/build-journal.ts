/**
 * The vault's run journal, as the panel's page builds write it and a booted panel reads it
 * back (2026-11-06; the record and its readers: `vault/run-record.ts`; the offer they make:
 * `model/build-recovery.ts`).
 *
 * Written as things happen, never at the end only: the record opens before the first event,
 * every build event of the run moves it (the streamed outline, each landing with its
 * transaction label, the report), and the run's result or its throw closes it — completed,
 * stopped, or errored. A tab that dies writes no end mark, and that absence IS the record of
 * an interruption. A successor ("Continue where it stopped") opens the same record again and
 * writes into it, so a crash during the successor leaves it interrupted with the right
 * sections pending.
 *
 * Every write is fire-and-forget: the journal never throws (a failed write is marked on the
 * record), and a build never waits on storage.
 */
import type {
  AiBuildEvent,
  AiBuildOwnEvent,
  AiBuildRunResult,
  BuilderDocument,
} from '@craftkit/builder';

import { fingerprintDocument } from '../../../vault/drafts';
import type { DocumentRunJournal } from '../../../vault/run-journal';
import { withJournal } from '../../model/build-recovery';

import type { Flow } from './controller-state';
import { patchKind } from './turn-plumbing';

/** One build's writes to its record. */
export interface BuildJournalWriter {
  /** Any event the build observer sees; only this run's own build events are kept. */
  readonly event: (event: AiBuildEvent) => void;
  /** The run returned: completed, or stopped with its report. */
  readonly settled: (result: AiBuildRunResult) => void;
  /** The run threw: `stopped` when the person's Stop aborted it, else it errored. */
  readonly ended: (cause: unknown, stopped: boolean) => void;
  /** The person answered Discard at the plan card: not unfinished work, work they refused. */
  readonly declined: () => void;
}

const SILENT: BuildJournalWriter = {
  event: () => undefined,
  settled: () => undefined,
  ended: () => undefined,
  declined: () => undefined,
};

function isOwnEvent(event: AiBuildEvent): event is AiBuildOwnEvent {
  return event.type.startsWith('build.') || event.type.startsWith('task.');
}

function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function portOf(flow: Flow): DocumentRunJournal | undefined {
  return flow.env().options.runJournal;
}

/** Open the record of one page build, before its first event. A host without a journal: none. */
export function openBuildJournal(
  flow: Flow,
  start: {
    readonly runId: string;
    readonly turnId: string;
    readonly pageId: string | undefined;
    readonly request: string;
    /** The page before the build wrote anything: fingerprinted as the record's base. */
    readonly before: BuilderDocument;
  },
): BuildJournalWriter {
  const port = portOf(flow);
  if (port === undefined) return SILENT;
  const { journal, docId } = port;
  const { runId } = start;
  const env = flow.env();
  journal
    .start({
      runId,
      docId,
      // Empty when the host has no site to name the page by (the record still names its turn).
      pageId: start.pageId ?? '',
      request: start.request,
      turnId: start.turnId,
      mode: env.sessions.state.mode,
      providerKind: env.options.providerKind ?? 'offline',
      baseFingerprint: fingerprintDocument(start.before),
    })
    .catch(() => undefined);
  return {
    event: (event) => {
      if (isOwnEvent(event) && event.runId === runId) void journal.record(runId, event);
    },
    settled: (result) => {
      void journal.settle(runId, result);
    },
    ended: (cause, stopped) => {
      void (stopped ? journal.halt(runId) : journal.fail(runId, reasonOf(cause)));
    },
    declined: () => {
      void journal.decline(runId);
    },
  };
}

/**
 * A successor writing the rest of a build into the build's own record: the record is open
 * again (`running`) until the successor's own `build.completed` closes it.
 */
export function resumeBuildJournal(flow: Flow, runId: string): (event: AiBuildEvent) => void {
  const port = portOf(flow);
  if (port === undefined) return () => undefined;
  const { journal } = port;
  void journal.reopen(runId);
  return (event) => {
    if (isOwnEvent(event) && event.runId === runId) void journal.record(runId, event);
  };
}

/** "Keep what was built": the record is never offered for continuing again. */
export function keepInJournal(flow: Flow, runId: string): void {
  const port = portOf(flow);
  if (port !== undefined) void port.journal.keep(runId);
}

/**
 * When the panel boots: every build turn it read back (`revived`) meets its journal record,
 * which inks the sections the journal saw land and leaves its word on the turn — why the
 * run ended, and what it had still to write (`withJournal`). Answers the cleanup: a panel
 * that unmounted before the journal answered changes nothing.
 */
export function attachBuildJournal(flow: Flow, port: DocumentRunJournal | undefined): () => void {
  if (port === undefined) return () => undefined;
  let live = true;
  port.journal.list(port.docId).then(
    (records) => {
      if (!live) return;
      const byRun = new Map(records.map((record) => [record.runId, record]));
      for (const session of flow.env().sessions.store.getState().sessions) {
        for (const turn of session.turns) {
          if (turn.kind !== 'build' || turn.revived !== true) continue;
          const record = byRun.get(turn.progress.runId);
          if (record === undefined) continue;
          patchKind(flow, session.id, turn.id, 'build', (current) => withJournal(current, record));
        }
      }
      // Records past the journal's TTL go (each build leaves one); the turns keep their word.
      port.journal.sweep().catch(() => undefined);
    },
    () => undefined,
  );
  return () => {
    live = false;
  };
}
