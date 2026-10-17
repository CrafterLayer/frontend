import type { BuilderKernel } from '@craftkit/builder';

import { useTransactionCount } from '../features/preview/use-transaction-count';

/**
 * The sealed-store counter, split out for one reason: `useTransactionCount`
 * needs a kernel, and the app now has a state that has none. A hook cannot be
 * called conditionally, so the conditional is a component instead.
 */
export function TransactionCount({ kernel }: { kernel: BuilderKernel }) {
  return <>{useTransactionCount(kernel)}</>;
}
