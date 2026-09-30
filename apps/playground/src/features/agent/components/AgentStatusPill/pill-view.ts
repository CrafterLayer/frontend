/**
 * What the status-bar pill says (SPEC §4.20 AgentStatusPill, `pill.*`), from the panel's
 * own state. Pure, so every line it can say is a table row in a test.
 *
 * - A live build: «أبو غضب يبني الصفحة، 3 من 8», counting LANDED sections only (SPEC §1:
 *   ink means landed, and the pill is ink's shorthand). Before the skeleton names the
 *   sections there is no count to give, so it says it is working.
 * - A live edit with a target: «أبو غضب يعدّل «الواجهة»». A page-wide edit names no block.
 * - Any other live run (routing, a plan, a proposal, an answer): working.
 * - A build that finished while the panel was hidden, every section on the page:
 *   «بُنيت الصفحة: 8 أقسام», until the panel is shown again. A partial, stopped or failed
 *   build has no pill line: "built" would be a claim the record does not make, and the
 *   thread says what happened the moment the panel opens.
 */
import type { AgentViewState, TurnView } from '../../model/view-types';

export type PillView =
  | { readonly kind: 'building'; readonly done: number; readonly total: number }
  | { readonly kind: 'editing'; readonly target: string }
  | { readonly kind: 'working' }
  | { readonly kind: 'done'; readonly sections: number };

function recordOf(turns: readonly TurnView[], turnId: string): TurnView | undefined {
  return turns.find((turn) => turn.view.turnId === turnId);
}

/**
 * The pill's line, or `null` when it has nothing to say. `finished` is the turn of a run
 * that ended while the panel was hidden (the host remembers it until the panel shows).
 */
export function pillView(
  state: Pick<AgentViewState, 'turns' | 'run'>,
  finished: string | null = null,
): PillView | null {
  const { run, turns } = state;
  if (run !== null) {
    const record = recordOf(turns, run.turnId);
    if (record?.kind === 'build' && record.view.total > 0) {
      return { kind: 'building', done: record.view.landed, total: record.view.total };
    }
    if (record?.kind === 'edit' && record.view.target !== undefined && record.view.target !== '') {
      return { kind: 'editing', target: record.view.target };
    }
    return { kind: 'working' };
  }
  if (finished === null) return null;
  const record = recordOf(turns, finished);
  if (
    record?.kind === 'build' &&
    record.view.phase === 'done' &&
    record.view.total > 0 &&
    record.view.landed === record.view.total
  ) {
    return { kind: 'done', sections: record.view.total };
  }
  return null;
}
