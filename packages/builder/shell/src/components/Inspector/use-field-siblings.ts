import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BlockSchema, FieldSibling, NodeId } from '@craftkit/builder-schema';

import { fieldSiblingsOf } from '../../fields/field-visibility';
import { propsShapeOf } from '../../fields/resolve-field';

const NO_SUBSCRIPTION = () => () => undefined;

/**
 * A row's sibling props, for a field type that declared `siblings: true`
 * (the scene settings read the param spec beside their values).
 *
 * Opt-in on purpose: a row that does not ask subscribes to nothing here, so
 * the per-property render model holds for every other row. A row that asks
 * re-renders when its node's `props` object moves (immer keeps it stable
 * across writes to other nodes). Base values: a sibling is context, not the
 * thing being edited under an override bucket.
 */
export function useFieldSiblings(
  kernel: BuilderKernel,
  nodeId: NodeId,
  propKey: string,
  blockSchema: BlockSchema | undefined,
  enabled: boolean,
): readonly FieldSibling[] | undefined {
  const store = kernel.context.store;
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      enabled
        ? store.subscribeNode(nodeId, () => {
            onStoreChange();
          })
        : NO_SUBSCRIPTION(),
    [store, nodeId, enabled],
  );
  const read = useCallback(
    () => (enabled ? store.getState().doc.nodes[nodeId]?.props : undefined),
    [store, nodeId, enabled],
  );
  const props = useSyncExternalStore(subscribe, read, read);
  return useMemo(
    () =>
      enabled && blockSchema !== undefined
        ? fieldSiblingsOf(propsShapeOf(blockSchema.props), props, propKey)
        : undefined,
    [enabled, blockSchema, props, propKey],
  );
}
