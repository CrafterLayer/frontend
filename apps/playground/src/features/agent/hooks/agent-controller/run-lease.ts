/**
 * The one run lease: claim it for a run, check it before every write, give it back
 * (and let the queue run), and track the flow that holds it.
 */
import { ownsRun } from '../../model/runs';
import type { RunActivity } from '../../model/view-types';

import type { Flow, LiveRun } from './controller-state';

/* ── The lease ───────────────────────────────────────────────────────────────── */

export interface Slot {
  readonly sessionId: string;
  readonly turnId: string;
  readonly runId: string;
  readonly controller: AbortController;
}

/**
 * Take the one lease for a run writing `turnId`. Null when a run already holds it: the
 * send path queues instead, so this only refuses a second action racing the first.
 */
export function claim(
  flow: Flow,
  sessionId: string,
  turnId: string,
  activity: RunActivity,
): Slot | null {
  if (flow.runtime.lease !== null) return null;
  const runId = flow.env().sessions.nextId('run');
  const controller = new AbortController();
  flow.runtime.lease = { runId, controller };
  flow.runtime.collect = { runId, ids: [] };
  flow.ui.setState((ui) => ({
    ...ui,
    run: {
      runId,
      turnId,
      sessionId,
      activity,
      startedAt: flow.clock.now(),
      stopping: false,
      awaiting: false,
    },
  }));
  return { sessionId, turnId, runId, controller };
}

/** The run still owns the lease and was not stopped: it may write. */
export function holds(flow: Flow, slot: Slot): boolean {
  return ownsRun(flow.runtime.lease, slot.runId) && !slot.controller.signal.aborted;
}

export function setRun(flow: Flow, slot: Slot, patch: Partial<LiveRun>): void {
  flow.ui.setState((ui) =>
    ui.run?.runId === slot.runId ? { ...ui, run: { ...ui.run, ...patch } } : ui,
  );
}

/** The AI transactions this run landed so far, oldest first. */
export function collected(flow: Flow, slot: Slot): readonly string[] {
  return flow.runtime.collect?.runId === slot.runId ? [...flow.runtime.collect.ids] : [];
}

/** Give the lease back and let the queue run. */
export function release(flow: Flow, slot: Slot): void {
  if (!ownsRun(flow.runtime.lease, slot.runId)) return;
  flow.runtime.lease = null;
  flow.runtime.collect = null;
  const stopped = slot.controller.signal.aborted;
  flow.ui.setState((ui) => ({
    ...ui,
    run: null,
    queue: ui.queue === null ? null : stopped ? { ...ui.queue, paused: true } : ui.queue,
    // After a Stop the queue keeps its own text and the composer empties (SPEC §3.10).
    draft: stopped && ui.queue !== null ? '' : ui.draft,
  }));
  if (!stopped) {
    queueMicrotask(() => {
      flow.drainQueue(flow);
    });
  }
}

/** Run `work` as the flow holding the lease; `done` settles when it wrote its turns. */
export function track(flow: Flow, work: Promise<void>): Promise<void> {
  const done = work.catch(() => undefined);
  flow.runtime.done = done;
  void done.then(() => {
    if (flow.runtime.done === done) flow.runtime.done = null;
  });
  return done;
}
