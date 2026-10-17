import { afterEach, describe, expect, it } from 'vitest';

import { initialBuildProgress, planForApproval, type BuildProgress } from './AssistantPanel.build';
import { reviveSessions, type BuiltTurn, type Session, type Turn } from './AssistantPanel.turns';

const KEY = 'assistant-turns-test';

function save(turns: readonly Turn[]): void {
  const sessions: readonly Session[] = [{ id: 'session-1', title: 'Build', turns }];
  window.localStorage.setItem(KEY, JSON.stringify({ sessions, activeId: 'session-1' }));
}

function revived(): readonly Turn[] {
  return reviveSessions(KEY)?.sessions[0]?.turns ?? [];
}

const DIRECTION = 'A calm studio page.';

function landed(): BuildProgress {
  return {
    ...initialBuildProgress('run-1', 1_000),
    phase: 'completed',
    direction: DIRECTION,
    tasks: [
      { id: 'r1', title: 'Hero', position: 1, status: 'applied', attempts: 1 },
      { id: 'r2', title: 'Proof', position: 2, status: 'applied', attempts: 1 },
    ],
    applied: 2,
    run: null,
  };
}

afterEach(() => {
  window.localStorage.removeItem(KEY);
});

describe('reviveSessions — builds', () => {
  it('revives a build still waiting on its ONE question as a stop that wrote nothing', () => {
    /*
      Since 2026-09-28 the question is asked BEFORE the skeleton lands (P0-4).
      A reload while it was open killed a build that had written nothing — so it
      must not come back as a "Stopped 0/3" build report with rows to undo.
    */
    const asking = planForApproval(
      initialBuildProgress('run-1', 1_000),
      [{ title: 'Hero' }, { title: 'Proof' }, { title: 'Pricing' }],
      DIRECTION,
    );
    save([
      { id: 'turn-1', from: 'you', text: 'build me a page' },
      {
        id: 'turn-2',
        from: 'assistant',
        kind: 'building',
        request: 'build me a page',
        progress: asking,
        awaiting: true,
      },
    ]);

    const turn = revived()[1];
    expect(turn).toMatchObject({ id: 'turn-2', from: 'assistant', kind: 'stopped' });
  });

  it('keeps a build’s notices and the sections it put back, but never its authority', () => {
    const built: BuiltTurn = {
      id: 'turn-2',
      from: 'assistant',
      kind: 'built',
      progress: landed(),
      request: 'build me a page',
      undoable: true,
      notices: ['new-page-appended'],
      reverted: [2],
      revertRefused: [{ position: 1, code: 'changed-since' }],
      unfilled: 3,
      unfilledRemoval: { removed: 2, kept: 1 },
    };
    save([built]);

    const turn = revived()[0];
    expect(turn).toMatchObject({
      kind: 'built',
      notices: ['new-page-appended'],
      reverted: [2],
      unfilledRemoval: { removed: 2, kept: 1 },
    });
    // Runtime-only: the result a revert or a removal needs belongs to the session
    // that ran the build, and a refusal was an answer to a click in it.
    expect(turn).not.toHaveProperty('undoable');
    expect(turn).not.toHaveProperty('revertRefused');
    expect(turn).not.toHaveProperty('unfilled');
    expect(turn).not.toHaveProperty('request');
  });

  it('carries an interrupted build’s notices onto the stopped report it becomes', () => {
    save([
      {
        id: 'turn-2',
        from: 'assistant',
        kind: 'building',
        request: 'build me a site',
        progress: { ...landed(), phase: 'building' },
        notices: ['site-as-one-page'],
      },
    ]);

    expect(revived()[0]).toMatchObject({
      kind: 'built',
      stopped: true,
      notices: ['site-as-one-page'],
    });
  });
});
