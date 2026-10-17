import type { Key } from '../copy';

import { isAwaitingDecision, type AgentViewState } from './view-types';

/**
 * The header's word-status (Studio Indigo redesign, 2026-10-12): what the Agent is doing,
 * in a word or three under its name. It reads the same state the RunBar does and never
 * says more: no count, no clock, no section title. Those stay the RunBar's, where they
 * move; this line changes only when the kind of work does.
 *
 * Priority: a live run (stopping first), then a decision waiting on the person (a plan or a
 * proposal is ready), then ready, saying so when free code is on, because that changes
 * what the next request may write.
 */
export function headerStatusKey(state: Pick<AgentViewState, 'run' | 'turns' | 'freeCode'>): Key {
  const { run } = state;
  if (run !== null) {
    if (run.stopping) return 'header.status.stopping';
    switch (run.activity) {
      case 'build':
        return 'header.status.building';
      case 'edit':
        return 'header.status.editing';
      default:
        return 'header.status.thinking';
    }
  }
  if (state.turns.some(isAwaitingDecision)) return 'header.status.review';
  return state.freeCode?.enabled === true ? 'header.status.readyFreeCode' : 'header.status.ready';
}
