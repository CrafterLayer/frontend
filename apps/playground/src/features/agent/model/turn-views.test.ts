/**
 * Stored turns → the thread's views: the readings this module decides once (SPEC §6.5).
 */
import { describe, expect, it } from 'vitest';

import { createEditKernel } from '../testing/scripted-engine';
import { initialBuildProgress, reduceBuildProgress } from './build-progress';
import type { BuildTurn, EditTurn, Turn } from './turns';
import { turnViewsOf, type TurnViewContext } from './turn-views';
import type { AgentCapabilities } from './view-types';

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

function context(patch: Partial<TurnViewContext> = {}): TurnViewContext {
  return {
    capabilities: CAPABILITIES,
    developer: false,
    document: createEditKernel().getDocument(),
    ...patch,
  };
}

function builtWith(before: Record<string, string>): BuildTurn {
  const progress = [
    { type: 'build.planned', runId: 'run-1', seq: 0, at: 0, direction: 'd', tasks: [{ id: 'selected-hero', title: 'Hero' }, { id: 'footer', title: 'Footer' }] },
    {
      type: 'build.completed',
      runId: 'run-1',
      seq: 1,
      at: 1,
      tasks: [
        { id: 'selected-hero', title: 'Hero', status: 'applied', attempts: 1, landing: { transactionId: 'tx-1', label: 'Assistant: 1/2 — Hero', before, after: { tree: 'H' } } },
        // Written in full by the skeleton: nothing recorded from before it.
        { id: 'footer', title: 'Footer', status: 'applied', attempts: 0, landing: { transactionId: 'tx-0', label: 'Assistant: page skeleton', before: {}, after: { tree: 'F' } } },
      ],
      applied: 2,
      skipped: 0,
      elapsedMs: 1,
      outcome: 'completed',
    },
  ] as const;
  return {
    id: 'turn-2',
    kind: 'build',
    request: 'a page',
    progress: progress.reduce(reduceBuildProgress, initialBuildProgress('run-1', 0)),
    status: 'settled',
    outcomes: {},
    placeholders: {},
  };
}

describe('turnViewsOf', () => {
  it('offers row Undo only where there is an earlier version to put back', () => {
    const [view] = turnViewsOf([builtWith({ tree: '' })], context());
    expect(view?.kind).toBe('build');
    if (view?.kind !== 'build') return;
    expect(view.view.rows.map((row) => row.undo?.kind)).toEqual(['undo', undefined]);
  });

  it('folds a build once a newer exchange starts, never for its own end note', () => {
    const turns: Turn[] = [
      { id: 'turn-1', kind: 'user', text: 'a page', context: [{ kind: 'page' }] },
      builtWith({ tree: '' }),
      { id: 'turn-3', kind: 'end', key: 'siteAsOnePage' },
    ];
    const open = turnViewsOf(turns, context())[1];
    expect(open?.kind === 'build' && open.view.collapsed).toBe(false);
    const folded = turnViewsOf(
      [...turns, { id: 'turn-4', kind: 'user', text: 'next', context: [{ kind: 'page' }] }],
      context(),
    )[1];
    expect(folded?.kind === 'build' && folded.view.collapsed).toBe(true);
  });

  it('strikes a sent chip whose block is gone, and keeps the page scope off the bubble', () => {
    const [view] = turnViewsOf(
      [
        {
          id: 'turn-1',
          kind: 'user',
          text: 'darker',
          context: [{ kind: 'selection', id: 'gone', label: 'Old hero' }],
        },
      ],
      context(),
    );
    expect(view).toEqual({
      kind: 'user',
      view: {
        turnId: 'turn-1',
        text: 'darker',
        chips: [{ kind: 'selection', id: 'gone', label: 'Old hero', stale: true }],
        notRun: false,
      },
    });
  });

  it('reads a proposal with no authority behind it (after a reload) as interrupted', () => {
    const [view] = turnViewsOf(
      [{ id: 'turn-2', kind: 'proposal', status: 'ready', changes: [], revived: true }],
      context(),
    );
    expect(view).toEqual({ kind: 'end', view: { turnId: 'turn-2', key: 'interrupted' } });
  });

  it('says why an edit cannot be undone once a later change sits on top', () => {
    const edit: EditTurn = {
      id: 'turn-2',
      kind: 'edit',
      origin: 'request',
      status: 'done',
      changes: [{ kind: 'changed', label: 'Heading', before: 'A', after: 'B' }],
      transactionId: 'tx-9',
      elapsedMs: 1_000,
    };
    const live = turnViewsOf([edit], context({ editHistory: () => ({ canUndo: true, canRedo: false }) }))[0];
    expect(live?.kind === 'edit' && live.view.undo).toEqual({ kind: 'undo', transactionId: 'tx-9' });
    const buried = turnViewsOf([edit], context({ editHistory: () => ({ canUndo: false, canRedo: false }) }))[0];
    expect(buried?.kind === 'edit' && buried.view.undo).toEqual({ kind: 'unavailable', why: 'changedSince' });
  });
});
