import type { BuilderDocument, NodeId } from '@craftkit/builder';

import type { SentContext } from './turns';
import type { PromptSkillSnapshot } from './prompt-skills';
import type { ContextChipView, QueueStatus, QueueView } from './view-types';

/**
 * The ONE queued request (SPEC §3.9, §4.17 QueueHeader, FR-025 / FR-026 / FR-054).
 *
 * While a run is live the queued request IS the composer's own text (there is no second
 * field), so the controller keeps the text in the draft and this record in step with it;
 * after Stop it pauses with its own text while the composer empties (SPEC §3.10).
 *
 * Before it runs it is revalidated against the page (FR-026): each block it pointed at
 * when it was queued is looked up again. Gone, or turned into another kind of block, it is
 * `missing` and cannot run until the person picks another target; still there but changed
 * (the build it waited on rewrote it), it is `stale` and runs, rechecked, as SPEC's
 * `queue.stale` copy promises. Pure: the document comes in.
 */

/** One block the request pointed at, as it stood when the request was queued. */
export interface QueuedTarget {
  readonly id: NodeId;
  readonly type: string;
  /** The node object itself: kernel documents are immutable, so identity means unchanged. */
  readonly node: unknown;
}

export interface QueuedRequest {
  readonly text: string;
  readonly context: readonly SentContext[];
  readonly targets: readonly QueuedTarget[];
  /** Stop was pressed while it waited: it runs only on Continue (FR-054). */
  readonly paused: boolean;
  /** A revalidation found a target gone; sticky until the queue is removed or re-queued. */
  readonly missing: boolean;
  readonly skillSnapshot?: PromptSkillSnapshot | undefined;
}

/** A request queued now, against `document`. */
export function queueRequest(
  text: string,
  context: readonly SentContext[],
  document: BuilderDocument,
  skillSnapshot?: PromptSkillSnapshot,
): QueuedRequest {
  const targets = context.flatMap((entry): QueuedTarget[] => {
    if (entry.kind === 'page') return [];
    const node = document.nodes[entry.id];
    return node === undefined ? [] : [{ id: entry.id, type: node.type, node }];
  });
  return {
    text,
    context,
    targets,
    paused: false,
    missing: false,
    ...(skillSnapshot === undefined ? {} : { skillSnapshot }),
  };
}

/** What revalidation finds (FR-026): run it, run it rechecked, or it cannot run. */
export type QueueCheck = 'ready' | 'stale' | 'missing';

export function revalidateQueue(queue: QueuedRequest, document: BuilderDocument): QueueCheck {
  if (queue.missing) return 'missing';
  let stale = false;
  for (const target of queue.targets) {
    const node = document.nodes[target.id];
    if (node?.type !== target.type) return 'missing';
    if (node !== target.node) stale = true;
  }
  return stale ? 'stale' : 'ready';
}

/** The QueueHeader's state: paused wins, then what revalidation would find now. */
export function queueStatus(queue: QueuedRequest, document: BuilderDocument): QueueStatus {
  if (queue.paused) return 'paused';
  switch (revalidateQueue(queue, document)) {
    case 'missing':
      return 'missing';
    case 'stale':
      return 'stale';
    case 'ready':
      return 'editable';
  }
}

/** The request's context as chips (SPEC §4.17 ContextChip): a gone block is struck through. */
export function contextChips(
  context: readonly SentContext[],
  document: BuilderDocument,
): readonly ContextChipView[] {
  if (context.length === 0) return [{ kind: 'page', id: 'page' }];
  return context.map((entry): ContextChipView =>
    entry.kind === 'page'
      ? { kind: 'page', id: 'page' }
      : {
          kind: entry.kind,
          id: entry.id,
          label: entry.label,
          stale: document.nodes[entry.id] === undefined,
        },
  );
}

export function queueView(queue: QueuedRequest, document: BuilderDocument): QueueView {
  return {
    text: queue.text,
    chips: contextChips(queue.context, document),
    status: queueStatus(queue, document),
  };
}
