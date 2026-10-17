/**
 * Kernel history the controller follows (Undo build, an edit's Undo): a history shadow
 * per kernel, and the AI transactions the run holding the lease landed.
 */
import type { BuilderKernel } from '@craftkit/builder';

import {
  EMPTY_HISTORY,
  type HistoryShadow,
  recordApplied,
  recordRedone,
  recordUndone,
} from '../../model/kernel-history';

import type { Flow } from './controller-state';

/* ── Kernel history (Undo build, an edit's Undo) ─────────────────────────────── */

export function followKernel(flow: Flow, kernel: BuilderKernel): void {
  const { runtime } = flow;
  if (runtime.unsubscribe.has(kernel)) return;
  runtime.shadows.set(kernel, runtime.shadows.get(kernel) ?? EMPTY_HISTORY);
  const set = (next: (shadow: HistoryShadow) => HistoryShadow): void => {
    runtime.shadows.set(kernel, next(runtime.shadows.get(kernel) ?? EMPTY_HISTORY));
    runtime.bump();
  };
  const events = kernel.context.events;
  const offs = [
    events.on('tx.applied', ({ tx }) => {
      set((shadow) => recordApplied(shadow, tx));
      const collect = runtime.collect;
      if (collect !== null && tx.author === 'ai' && runtime.lease?.runId === collect.runId) {
        collect.ids.push(tx.id);
      }
    }),
    events.on('history.undone', ({ tx }) => {
      set((shadow) => recordUndone(shadow, tx));
    }),
    events.on('history.redone', ({ tx }) => {
      set((shadow) => recordRedone(shadow, tx));
    }),
  ];
  runtime.unsubscribe.set(kernel, () => {
    for (const off of offs) off();
  });
}

export function shadowOf(flow: Flow, kernel: BuilderKernel): HistoryShadow {
  return flow.runtime.shadows.get(kernel) ?? EMPTY_HISTORY;
}

export function kernelOfBuild(flow: Flow, turnId: string): BuilderKernel {
  return flow.runtime.builds.get(turnId)?.kernel ?? flow.env().options.kernel;
}
