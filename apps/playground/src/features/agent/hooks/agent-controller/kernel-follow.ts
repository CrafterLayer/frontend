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
import { agentScriptSiteFor } from '../../model/script-site';

import type { Flow } from './controller-state';
import { locateTurn } from './turn-plumbing';

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

/** The id of the site page `kernel` is a lens of, or undefined without a known site. */
export function pageIdOfKernel(kernel: BuilderKernel): string | undefined {
  return agentScriptSiteFor(kernel)?.currentPage();
}

/**
 * The kernel a successor writes a build's sections into (P5, 2026-11-01): the build's own
 * while this session still holds it; after a reload, the lens of the page the build
 * recorded (`BuildTurn.pageId`), open or not. A record saved before pages were recorded
 * falls back to the page on screen, as before. Null: the recorded page is gone, or no site
 * is known to open it through.
 */
export function successorKernelOf(flow: Flow, turnId: string): BuilderKernel | null {
  const live = flow.runtime.builds.get(turnId)?.kernel;
  if (live !== undefined) return live;
  const onScreen = flow.env().options.kernel;
  const turn = locateTurn(flow, turnId)?.turn;
  const pageId = turn?.kind === 'build' ? turn.pageId : undefined;
  if (pageId === undefined) return onScreen;
  if (pageIdOfKernel(onScreen) === pageId) return onScreen;
  try {
    return agentScriptSiteFor(onScreen)?.page(pageId) ?? null;
  } catch {
    // The site no longer has that page.
    return null;
  }
}
