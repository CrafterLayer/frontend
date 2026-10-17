/**
 * What the hook reads its view from: the RunBar's status input, and stable snapshot
 * readers for the kernel (WP-20 fix) and for an absent selection source.
 */
import type { BuilderKernel, NodeId } from '@craftkit/builder';

import type { RunStatusInput } from '../../model/agent-status';
import type { TurnView } from '../../model/view-types';

import { type LiveRun, NO_SELECTION } from './controller-state';

/* ── The RunBar's input ──────────────────────────────────────────────────────── */

export function runStatusInput(run: LiveRun, record: TurnView | null): RunStatusInput {
  const { stopping } = run;
  if (record?.kind === 'build') {
    return {
      activity: 'build',
      phase: record.view.phase,
      rows: record.view.rows.map((row) => ({ title: row.title, state: row.state })),
      lastLanding: run.lastLanding,
      stopping,
    };
  }
  if (record?.kind === 'edit') {
    return { activity: 'edit', stage: record.view.stage ?? 'edit.started', stopping };
  }
  switch (run.activity) {
    case 'edit':
      return { activity: 'edit', stage: 'edit.started', stopping };
    case 'build':
      return { activity: 'build', phase: 'skeleton', rows: [], stopping };
    case 'routing':
    case 'plan':
    case 'proposal':
    case 'answer':
      return { activity: run.activity, stopping };
  }
}

const noop = (): void => undefined;
export const subscribeNothing = (): (() => void) => noop;
export const noSelection = (): readonly NodeId[] => NO_SELECTION;

type KernelSnapshot = ReturnType<BuilderKernel['context']['store']['getState']>;

function sameKernelState(last: KernelSnapshot, next: KernelSnapshot): boolean {
  return (
    last.doc === next.doc &&
    last.seq === next.seq &&
    last.elementFocus === next.elementFocus &&
    last.selection.length === next.selection.length &&
    last.selection.every((id, index) => id === next.selection[index])
  );
}

/**
 * (WP-20 fix) The kernel's state as a `useSyncExternalStore` snapshot. A page lens
 * (`siteKernel.page(id)`, the kernel the app hands the panel) builds a new state object on
 * every `getState()`, so a snapshot read straight from it never compared equal and the
 * panel re-rendered until React gave up ("Maximum update depth exceeded"). The last
 * snapshot is kept while its document, selection, focus and sequence are the same.
 */
export function stableKernelReader(store: BuilderKernel['context']['store']): () => KernelSnapshot {
  let last: KernelSnapshot | undefined;
  return () => {
    const next = store.getState();
    if (last !== undefined && sameKernelState(last, next)) return last;
    last = next;
    return next;
  };
}
