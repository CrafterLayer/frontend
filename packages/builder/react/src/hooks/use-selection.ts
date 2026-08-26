import { useCallback, useSyncExternalStore } from 'react';

import type { NodeId } from '@craftkit/builder-schema';

import { useBuilder } from './use-builder';

/** Live selection ids (reference-stable between selection changes). */
export function useSelection(): readonly NodeId[] {
  const kernel = useBuilder();
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      kernel.context.store.subscribe(() => {
        onStoreChange();
      }),
    [kernel],
  );
  const getSnapshot = useCallback(() => kernel.context.store.getState().selection, [kernel]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
