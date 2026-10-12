import { useState } from 'react';

import type { AgentViewState } from '../../model/view-types';
import { pillView, type PillView } from '../AgentStatusPill';

/**
 * The status-bar pill while the panel is hidden (SPEC §4.20), or `null` while it shows. A run
 * that ended while hidden keeps its line until the panel shows again, so the person learns
 * how it ended; showing the panel clears it.
 */
export function useHiddenPill(
  state: Pick<AgentViewState, 'turns' | 'run'>,
  visible: boolean,
): PillView | null {
  const runTurn = state.run?.turnId ?? null;
  const [lastRun, setLastRun] = useState<string | null>(runTurn);
  const [finished, setFinished] = useState<string | null>(null);
  if (lastRun !== runTurn) {
    setLastRun(runTurn);
    setFinished(runTurn === null && !visible ? lastRun : null);
  }
  if (visible && finished !== null) setFinished(null);
  return visible ? null : pillView(state, finished);
}
