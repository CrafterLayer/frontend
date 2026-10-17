import { useCallback, useSyncExternalStore } from 'react';

import { useBuilder } from './use-builder';

/**
 * Bumps whenever an extension registers or disposes — views that read catalogs
 * re-render, which is what makes runtime registration visible without a reload
 * (FR-013). The snapshot is the kernel-INTRINSIC catalog version (not a value
 * derived inside the event listener): a registration that fires before this
 * hook's subscription attaches is still caught by `useSyncExternalStore`'s
 * post-subscribe snapshot re-check, so no mount-order race can drop it.
 */
export function useRegistryVersion(): number {
  const kernel = useBuilder();
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
