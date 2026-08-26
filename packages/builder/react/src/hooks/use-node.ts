import { useCallback, useSyncExternalStore } from 'react';

import type { Node, NodeId } from '@craftkit/builder-schema';

import { useBuilder } from './use-builder';

/**
 * Subscribe to exactly one node: a keystroke on node X re-renders only X's
 * consumers (FR-003). Deleted nodes yield `undefined`.
 */
export function useNode(id: NodeId): Node | undefined {
  const kernel = useBuilder();
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      kernel.context.store.subscribeNode(id, () => {
        onStoreChange();
      }),
    [kernel, id],
  );
  const getSnapshot = useCallback(
    () => kernel.context.store.getState().doc.nodes[id],
    [kernel, id],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
