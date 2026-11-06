/**
 * An interrupted build, met again (2026-11-06; docs/architecture/empty-canvas-first-build-
 * research.md §3: Dyad records why each turn ended and keeps the partial tree as an
 * "[Interrupted]" version; llamacoder keeps the completed parts and drops the unfinished one).
 *
 * The page build writes the vault's run journal as it goes (`page-build.ts`): the outline,
 * every landing with its transaction label, and why the run ended. A tab that died mid-build
 * leaves a record with no end mark — `runEnding` reads it as interrupted. When the panel
 * boots, each build turn it reads back is matched to its record (`withJournal`): sections
 * the journal saw land are inked even if the conversation's own write lagged the crash, and
 * the turn keeps the journal's word — why it ended and what it still had to write.
 *
 * The page's newest build then offers recovery (`recoveryOffer`): continue where it stopped
 * ("Finish the rest", with exactly `continueKeys`), or keep what was built. Never for a
 * build that completed, one the person undid or kept, or one with nothing left on the page
 * to write into.
 *
 * Pure: the records, the document and the views come in.
 */
import type { BuilderDocument } from '@craftkit/builder';

import {
  landedUnits,
  pendingUnits,
  runEnding,
  type RunEnding,
  type RunRecord,
} from '../../vault/run-journal';
import type { BuildProgress, BuildTask } from './build-progress';
import { unwrittenKeys } from './successor-fill';
import type { BuildTurn, Turn } from './turns';
import type { BuildRecordView } from './view-types';

/** What the run journal said about one build when the panel booted. Plain data. */
export interface BuildJournalNote {
  /** The journal record's key: the build's own run id. */
  readonly runId: string;
  /** Why the run ended; `interrupted` when the tab died and no end mark was written. */
  readonly ending: RunEnding;
  /** The sections it had still to write (region ids, page order): exactly what Continue writes. */
  readonly pending: readonly string[];
}

/** A record's word on its build. */
export function journalNote(record: RunRecord): BuildJournalNote {
  return {
    runId: record.runId,
    ending: runEnding(record),
    pending: pendingUnits(record).map((unit) => unit.id),
  };
}

/**
 * The rows with every section the journal saw land inked: the journal is written at the
 * landing, the conversation a render later, and a crash between the two must not cost the
 * person a section that is on their page. Same reference when nothing changes.
 */
export function withJournalLandings(progress: BuildProgress, record: RunRecord): BuildProgress {
  const landed = new Map(landedUnits(record).map((unit) => [unit.id, unit]));
  const tasks = progress.tasks.map((task): BuildTask => {
    const unit = landed.get(task.id);
    if (unit === undefined || task.status === 'landed') return task;
    return {
      ...task,
      status: 'landed',
      attempts: Math.max(task.attempts, unit.attempts),
      ...(unit.settledAt === undefined ? {} : { settledAt: unit.settledAt }),
    };
  });
  const changed = tasks.some((task, index) => task !== progress.tasks[index]);
  return changed ? { ...progress, tasks } : progress;
}

function sameNote(a: BuildJournalNote | undefined, b: BuildJournalNote): boolean {
  return (
    a?.runId === b.runId &&
    a.ending === b.ending &&
    a.pending.length === b.pending.length &&
    a.pending.every((id, index) => id === b.pending[index])
  );
}

/**
 * A build turn read back after a reload, with its journal record's word: the landings it
 * saw, why it ended, what is left, and whether the person kept it. A record written for
 * another turn, or with no unit table, changes nothing. Same reference when nothing changes.
 */
export function withJournal(turn: BuildTurn, record: RunRecord): BuildTurn {
  if (record.runId !== turn.progress.runId) return turn;
  if (record.turnId !== undefined && record.turnId !== turn.id) return turn;
  if (record.units.length === 0 || record.writeFailure !== undefined) return turn;
  const progress = withJournalLandings(turn.progress, record);
  const note = journalNote(record);
  const kept = record.kept === true && turn.kept !== true;
  if (progress === turn.progress && sameNote(turn.journal, note) && !kept) return turn;
  return {
    ...turn,
    progress,
    journal: note,
    ...(kept || turn.kept === true ? { kept: true } : {}),
  };
}

/**
 * Exactly the sections "Continue where it stopped" writes: the ones the record has not
 * written, narrowed to the ones the journal still had pending. A section the journal saw
 * land is never written twice, whatever the conversation saved.
 */
export function continueKeys(turn: BuildTurn): readonly string[] {
  const unwritten = unwrittenKeys(turn.progress);
  const note = turn.journal;
  if (note === undefined) return unwritten;
  const pending = new Set(note.pending);
  return unwritten.filter((id) => pending.has(id));
}

/** What the offer says: how many sections landed, of how many. */
export interface BuildRecoveryView {
  readonly landed: number;
  readonly total: number;
}

/**
 * Whether this build's record offers recovery, and with what count. Only a build read back
 * after a reload (in the session that stopped it, the record's own "Finish the rest" is the
 * way on), that ended interrupted or stopped, that the person neither undid (whole or one
 * section) nor kept, whose journal does not say it completed, and with at least one section
 * left to write whose region is on the page open now. Which turn may carry it — the page's
 * newest build — is `turnViewsOf`'s call (`latestBuildPerPage`).
 */
export function recoveryOffer(
  turn: BuildTurn,
  view: BuildRecordView,
  document: BuilderDocument,
): BuildRecoveryView | null {
  if (turn.revived !== true || turn.undone === true || turn.kept === true) return null;
  if (view.phase !== 'interrupted' && view.phase !== 'stopped') return null;
  if (turn.journal?.ending === 'completed' || turn.placeholdersRemoved === true) return null;
  if (view.rows.some((row) => row.state === 'undone')) return null;
  if (!continueKeys(turn).some((id) => document.nodes[id] !== undefined)) return null;
  return { landed: view.landed, total: view.total };
}

/**
 * The newest build turn of each page, by id: an older build of the same page is history,
 * and offering to continue it would write over what the newer build put there. A build
 * that knows no page (a record from before pages were recorded) counts as the open page's.
 */
export function latestBuildPerPage(turns: readonly Turn[]): ReadonlySet<string> {
  const latest = new Map<string, string>();
  for (const turn of turns) {
    if (turn.kind === 'build') latest.set(turn.pageId ?? turn.page ?? '', turn.id);
  }
  return new Set(latest.values());
}
