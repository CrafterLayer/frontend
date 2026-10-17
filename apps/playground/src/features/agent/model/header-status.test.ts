/**
 * The header's word-status (Studio Indigo redesign, 2026-10-12): stopping beats the run's
 * activity, a live run beats a waiting decision, and ready says when free code is on.
 */
import { describe, expect, it } from 'vitest';

import { headerStatusKey } from './header-status';
import type { RunActivity, RunBarView, TurnView } from './view-types';

function run(activity: RunActivity, stopping = false): RunBarView {
  return {
    turnId: 't1',
    activity,
    statusKey: 'run.understanding',
    params: {},
    startedAt: 0,
    stopping,
  };
}

const READY_PROPOSAL = {
  kind: 'proposal',
  view: { turnId: 't2', status: 'ready' },
} as unknown as TurnView;

describe('headerStatusKey', () => {
  it('names the kind of live work, stopping first', () => {
    const base = { turns: [], freeCode: null };
    expect(headerStatusKey({ ...base, run: run('build') })).toBe('header.status.building');
    expect(headerStatusKey({ ...base, run: run('edit') })).toBe('header.status.editing');
    for (const activity of ['routing', 'plan', 'proposal', 'answer'] as const) {
      expect(headerStatusKey({ ...base, run: run(activity) })).toBe('header.status.thinking');
    }
    expect(headerStatusKey({ ...base, run: run('build', true) })).toBe('header.status.stopping');
  });

  it('waits for the person while a plan or proposal is ready, unless a run is live', () => {
    expect(headerStatusKey({ run: null, turns: [READY_PROPOSAL], freeCode: null })).toBe(
      'header.status.review',
    );
    expect(headerStatusKey({ run: run('edit'), turns: [READY_PROPOSAL], freeCode: null })).toBe(
      'header.status.editing',
    );
  });

  it('is ready otherwise, and says when free code is on', () => {
    expect(headerStatusKey({ run: null, turns: [], freeCode: null })).toBe('header.status.ready');
    expect(headerStatusKey({ run: null, turns: [], freeCode: { enabled: false } })).toBe(
      'header.status.ready',
    );
    expect(headerStatusKey({ run: null, turns: [], freeCode: { enabled: true } })).toBe(
      'header.status.readyFreeCode',
    );
  });
});
