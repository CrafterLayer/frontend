import { useCallback, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { Node, NodeId } from '@craftkit/builder-schema';

/**
 * Per-node subscription over the kernel's sealed StateFacade — the layer-law-clean
 * wiring (this package never imports builder-react; the kernel arrives by prop).
 * One node change notifies exactly this hook's component (FR-003).
 */
export function useKernelNode(kernel: BuilderKernel, id: NodeId): Node | undefined {
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

/**
 * Bumps when extensions register/dispose so views re-read catalogs (FR-013).
 * This is the renderer's own wiring — the layer law forbids importing the
 * builder-react hook. The snapshot is the kernel-INTRINSIC catalog version:
 * a registration that fires before a view's subscription attaches (a sibling
 * mount effect, tree-order earlier) is still caught by `useSyncExternalStore`'s
 * post-subscribe snapshot re-check, so no mount-order race can drop it.
 */
export function useRegistryEpoch(kernel: BuilderKernel): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const offRegistered = kernel.context.events.on('extension.registered', onStoreChange);
      const offDisposed = kernel.context.events.on('extension.disposed', onStoreChange);
      return () => {
        offRegistered();
        offDisposed();
      };
    },
    [kernel],
  );
  const getSnapshot = useCallback(() => kernel.extensions.version(), [kernel]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Reference-stable selector subscription (document root id, selection array, …).
 * The selector MUST return a stable reference for unchanged state.
 */
export function useKernelSelector<T>(
  kernel: BuilderKernel,
  selector: (state: ReturnType<BuilderKernel['context']['store']['getState']>) => T,
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      kernel.context.store.subscribe(() => {
        onStoreChange();
      }),
    [kernel],
  );
  const getSnapshot = useCallback(
    () => selector(kernel.context.store.getState()),
    [kernel, selector],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
