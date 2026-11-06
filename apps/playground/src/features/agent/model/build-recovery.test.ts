/**
 * An interrupted build met again: the journal's word on the turn, exactly what Continue
 * writes, and when the record offers recovery at all (2026-11-06).
 */
import type { AiBuildOwnEvent, BuilderDocument } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import type { RunRecord } from '../../vault/run-journal';
import { initialBuildProgress, reduceBuildProgress, type BuildProgress } from './build-progress';
import { continueKeys, latestBuildPerPage, recoveryOffer, withJournal } from './build-recovery';
import { turnViewsOf, type TurnViewContext } from './turn-views';
import type { BuildTurn, Turn } from './turns';
import type { AgentCapabilities, BuildRecordView } from './view-types';

const IDS = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'] as const;

const CAPABILITIES: AgentCapabilities = {
  rowUndo: true,
  undoBuild: false,
  restore: false,
  facts: true,
  failureClasses: true,
  editablePlan: true,
  structuredDirection: true,
  estimate: true,
  canvasStage: false,
};

/** A page holding the build's regions (only `nodes[id]` is read). */
function pageWith(ids: readonly string[]): BuilderDocument {
  return {
    rootId: 'root',
    nodes: Object.fromEntries(ids.map((id) => [id, { id, type: 'region', props: {} }])),
  } as unknown as BuilderDocument;
}

function context(document = pageWith(IDS)): TurnViewContext {
  return { capabilities: CAPABILITIES, developer: false, document };
}

/** Seven sections planned, the first `landed` of them on the page. */
function progressOf(landed: number): BuildProgress {
  const events: AiBuildOwnEvent[] = [
    {
      type: 'build.planned',
      runId: 'run-1',
      seq: 0,
      at: 1,
      direction: 'Warm.',
      tasks: IDS.map((id) => ({ id, title: `Section ${id}` })),
    },
    ...IDS.slice(0, landed).map((id, index): AiBuildOwnEvent => ({
      type: 'task.completed',
      runId: 'run-1',
      seq: index + 1,
      at: index + 2,
      position: index + 1,
      total: IDS.length,
      task: { id, title: `Section ${id}` },
      attempts: 1,
    })),
  ];
  return events.reduce(reduceBuildProgress, initialBuildProgress('run-1', 0));
}

/** A build read back after a reload, cut off after `landed` sections. */
function interrupted(landed = 3, patch: Partial<BuildTurn> = {}): BuildTurn {
  return {
    id: 'turn-2',
    kind: 'build',
    request: 'A page for Northlight Coffee',
    progress: progressOf(landed),
    status: 'interrupted',
    outcomes: {},
    revived: true,
    ...patch,
  };
}

function record(patch: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: 'run-1',
    docId: 'playground/empty',
    pageId: '',
    request: 'A page for Northlight Coffee',
    turnId: 'turn-2',
    mode: 'auto',
    providerKind: 'remote',
    baseFingerprint: 'doc-v1-sha256-empty',
    status: 'running',
    stage: 'planned',
    units: IDS.map((id, index) => ({
      position: index + 1,
      id,
      title: `Section ${id}`,
      status: index < 4 ? ('applied' as const) : ('waiting' as const),
      attempts: index < 4 ? 1 : 0,
      ...(index < 4
        ? { transactionId: `tx-${id}`, label: `Assistant: ${String(index + 1)}/7` }
        : {}),
    })),
    spent: { elapsedMs: 0, tasksStarted: 4 },
    createdAt: 0,
    updatedAt: 0,
    heartbeatAt: 0,
    ...patch,
  };
}

function buildView(turns: readonly Turn[], ctx = context()): BuildRecordView | undefined {
  const view = turnViewsOf(turns, ctx).findLast((each) => each.kind === 'build');
  return view?.kind === 'build' ? view.view : undefined;
}

describe('the journal’s word on a build read back', () => {
  it('inks what the journal saw land, and keeps why it ended and what is left', () => {
    // The conversation saved three landings; the journal saw a fourth before the tab died.
    const turn = withJournal(interrupted(3), record());
    expect(turn.progress.tasks.map((task) => task.status)).toEqual([
      'landed',
      'landed',
      'landed',
      'landed',
      'waiting',
      'waiting',
      'waiting',
    ]);
    expect(turn.journal).toEqual({
      runId: 'run-1',
      ending: 'interrupted',
      pending: ['n5', 'n6', 'n7'],
    });
    expect(continueKeys(turn)).toEqual(['n5', 'n6', 'n7']);
  });

  it('changes nothing for another turn’s record, and nothing twice', () => {
    const turn = interrupted(3);
    expect(withJournal(turn, record({ turnId: 'turn-9' }))).toBe(turn);
    expect(withJournal(turn, record({ runId: 'run-other' }))).toBe(turn);
    const once = withJournal(turn, record());
    expect(withJournal(once, record())).toBe(once);
  });

  it('never writes a section twice: Continue is the unwritten rows the journal had pending', () => {
    const turn = interrupted(3, {
      journal: { runId: 'run-1', ending: 'interrupted', pending: ['n4', 'n6'] },
    });
    expect(continueKeys(turn)).toEqual(['n4', 'n6']);
    expect(continueKeys(interrupted(3))).toEqual(['n4', 'n5', 'n6', 'n7']);
  });

  it('carries a Keep made in the journal over to the turn', () => {
    expect(withJournal(interrupted(3), record({ kept: true })).kept).toBe(true);
  });
});

describe('when a build read back offers recovery', () => {
  it('offers it on an interrupted build: the count of what landed, of how many', () => {
    expect(buildView([interrupted(3)])?.recovery).toEqual({ landed: 3, total: 7 });
  });

  it('never offers it for a build that completed, was undone or was kept', () => {
    const done = withJournal(interrupted(3), record({ status: 'completed' }));
    expect(buildView([done])?.recovery).toBeUndefined();
    expect(buildView([interrupted(3, { undone: true })])?.recovery).toBeUndefined();
    expect(buildView([interrupted(3, { kept: true })])?.recovery).toBeUndefined();
    // One section undone by its row: the person is taking the build back, not continuing it.
    const turn = interrupted(3);
    const view = buildView([turn]);
    if (view === undefined) throw new Error('No build record.');
    const rowUndone: BuildRecordView = {
      ...view,
      rows: view.rows.map((row, index) => (index === 0 ? { ...row, state: 'undone' } : row)),
    };
    expect(recoveryOffer(turn, rowUndone, pageWith(IDS))).toBeNull();
  });

  it('never offers it in the session that stopped it, or with nowhere left to write', () => {
    expect(
      buildView([interrupted(3, { revived: undefined, status: 'settled' })])?.recovery,
    ).toBeUndefined();
    // The regions are gone (the page was restored to before the build).
    expect(buildView([interrupted(3)], context(pageWith([])))?.recovery).toBeUndefined();
    expect(buildView([interrupted(3, { placeholdersRemoved: true })])?.recovery).toBeUndefined();
  });

  it('offers it on the page’s newest build only', () => {
    const older: BuildTurn = { ...interrupted(3), id: 'turn-1' };
    const newer: BuildTurn = { ...interrupted(5), id: 'turn-4' };
    const elsewhere: BuildTurn = { ...interrupted(2), id: 'turn-5', pageId: 'about' };
    expect([...latestBuildPerPage([older, newer, elsewhere])]).toEqual(['turn-4', 'turn-5']);
    const views = turnViewsOf([older, newer], context());
    const offers = views.map((view) => (view.kind === 'build' ? view.view.recovery : undefined));
    expect(offers).toEqual([undefined, { landed: 5, total: 7 }]);
  });
});
