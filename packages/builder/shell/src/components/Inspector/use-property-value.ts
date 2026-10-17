import { useCallback, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import { EMPTY_OVERRIDES } from './constants';
import type { PropertyValueSnapshot } from './types';

/**
 * One row's subscription to ONE property of ONE node.
 *
 * The kernel notifies node listeners only for ids named in a transaction's
 * patches, so a write to another node never reaches this hook; a write to
 * another key of the same node runs the three getSnapshots (cheap reads) and
 * bails because each returns a primitive or an immer-shared reference that did
 * not move. Never an object literal inside a getSnapshot: a fresh object per
 * read is the tearing loop `useSyncExternalStore` guards against.
 *
 * A missing node (removed while its rows are still mounted for one render)
 * simply reads as `undefined` everywhere.
 */
export function usePropertyValue(
  kernel: BuilderKernel,
  nodeId: NodeId,
  propKey: string,
  bucket: EditingBucket,
): PropertyValueSnapshot {
  const store = kernel.context.store;
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store.subscribeNode(nodeId, () => {
        onStoreChange();
      }),
    [store, nodeId],
  );
  const getStored = useCallback(
    () => store.getState().doc.nodes[nodeId]?.props[propKey],
    [store, nodeId, propKey],
  );
  const getOverride = useCallback(
    () =>
      bucket === 'base'
        ? undefined
        : store.getState().doc.nodes[nodeId]?.responsive?.[bucket]?.[propKey],
    [store, nodeId, propKey, bucket],
  );
  const getHasOverride = useCallback(
    () =>
      bucket !== 'base' &&
      Object.hasOwn(
        store.getState().doc.nodes[nodeId]?.responsive?.[bucket] ?? EMPTY_OVERRIDES,
        propKey,
      ),
    [store, nodeId, propKey, bucket],
  );

  const stored = useSyncExternalStore(subscribe, getStored, getStored);
  const override = useSyncExternalStore(subscribe, getOverride, getOverride);
  const hasOverride = useSyncExternalStore(subscribe, getHasOverride, getHasOverride);

  return { stored, override, hasOverride };
}
