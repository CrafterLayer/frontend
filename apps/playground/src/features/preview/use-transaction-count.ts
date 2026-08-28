import { useCallback, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder';

/** The visible side of Law S: every committed edit appends one transaction. */
export function useTransactionCount(kernel: BuilderKernel): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => kernel.context.store.subscribe(onStoreChange),
    [kernel],
  );
  const getSnapshot = useCallback(() => kernel.transactions().length, [kernel]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
