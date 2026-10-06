import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { CustomCodeNode } from '@craftkit/builder-schema';

import { readTreeTarget, type TreeTarget, type TreeWriteOptions } from '../../style-manager/tree-writes';

/**
 * The element a tree target addresses, as React state (document truth, i3):
 * subscribes to the host node only. The snapshot is the host node itself — an
 * immer-shared reference that moves only when that node changes — and the
 * element is derived from it, so a symbol instance (whose element is rebuilt
 * from the master plus overrides) never loops the store.
 */
export function useTreeElement(
  kernel: BuilderKernel,
  target: TreeTarget,
  options: TreeWriteOptions,
): CustomCodeNode | undefined {
  const store = kernel.context.store;
  const subscribe = useCallback(
    (onChange: () => void) => store.subscribeNode(target.nodeId, () => {
      onChange();
    }),
    [store, target.nodeId],
  );
  const getHost = useCallback(() => store.getState().doc.nodes[target.nodeId], [store, target.nodeId]);
  const host = useSyncExternalStore(subscribe, getHost, getHost);
  const nodeId = target.nodeId;
  const pathKey = target.path.join('.');
  const symbolTree = options.symbolTree;
  return useMemo(() => {
    // `host` is the real dependency: the element moves only when its node does.
    void host;
    const path = pathKey === '' ? [] : pathKey.split('.').map(Number);
    return readTreeTarget(kernel, { kind: 'tree', nodeId, path }, { symbolTree });
  }, [host, kernel, nodeId, pathKey, symbolTree]);
}
