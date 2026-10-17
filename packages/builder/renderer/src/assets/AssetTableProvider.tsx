import type { ReactNode } from 'react';

import { AssetTableContext, type AssetTable } from './asset-table';

export interface AssetTableProviderProps {
  readonly assets: AssetTable;
  readonly children: ReactNode;
}

/**
 * Puts the site's asset table where a block can reach it.
 *
 * Alone in its own file because the fast-refresh rule is right: a module that
 * exports a component AND the functions around it cannot be hot-replaced
 * without remounting whatever the functions are wired into. The context, the
 * hook and the resolver live in `asset-table.ts` beside it.
 */
export function AssetTableProvider({ assets, children }: AssetTableProviderProps) {
  return <AssetTableContext.Provider value={assets}>{children}</AssetTableContext.Provider>;
}
