import type { InlineEditSeam } from '@craftkit/builder-renderer';
import type { NodeId } from '@craftkit/builder-schema';

/** What a node renders in place of its inline-editable value while it is edited. */
export type InlineEditTarget = NonNullable<ReturnType<InlineEditSeam['getSnapshot']>>;
/** How the edit was entered (a pointer at a point, or the keyboard), keyed per entry. */
export type InlineEditEntryPoint = NonNullable<InlineEditTarget['entryPoint']>;
/** The entry a gesture asks for, before the canvas assigns its key. */
export type InlineEditEntryIntent =
  { kind: 'pointer'; clientX: number; clientY: number } | { kind: 'keyboard' };

export interface InlineEditBinding {
  nodeId: NodeId;
  target: InlineEditTarget;
}

export interface MutableInlineEditSeam extends InlineEditSeam {
  set: (binding: InlineEditBinding | null) => void;
}

/**
 * A node-keyed external store owned by the canvas. Its object identity never
 * changes, and an update notifies only the node losing or gaining the seam —
 * opening an edit therefore cannot fan a prop change through the whole tree.
 */
export function createMutableInlineEditSeam(): MutableInlineEditSeam {
  let current: InlineEditBinding | null = null;
  const listeners = new Map<NodeId, Set<() => void>>();

  const notify = (nodeId: NodeId) => {
    for (const listener of [...(listeners.get(nodeId) ?? [])]) {
      listener();
    }
  };

  return {
    subscribe: (nodeId, listener) => {
      const own = listeners.get(nodeId) ?? new Set<() => void>();
      own.add(listener);
      listeners.set(nodeId, own);
      return () => {
        own.delete(listener);
        if (own.size === 0) {
          listeners.delete(nodeId);
        }
      };
    },
    getSnapshot: (nodeId) => (current?.nodeId === nodeId ? current.target : null),
    set: (binding) => {
      if (Object.is(current, binding)) {
        return;
      }
      const previousId = current?.nodeId;
      current = binding;
      const nextId = binding?.nodeId;
      if (previousId !== undefined) {
        notify(previousId);
      }
      if (nextId !== undefined && nextId !== previousId) {
        notify(nextId);
      }
    },
  };
}
