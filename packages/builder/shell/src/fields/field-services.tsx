import type { ReactNode } from 'react';

import { FieldServicesContext, type FieldServices } from './field-services-context';

export type { FieldPage, FieldServices } from './field-services-context';

export interface FieldServicesProviderProps {
  readonly value: FieldServices;
  readonly children: ReactNode;
}

/**
 * Mounted once by the Inspector (block-parts P6, from its `assetLibrary`
 * prop) so every row, however deeply nested inside repeaters and object
 * groups, reaches the same services without threading props through each
 * recursion level. Fields read them with `useFieldServices()` /
 * `useFieldLabels()` from `field-services-context.ts` — kept in a separate
 * module so this file exports only a component (react-refresh).
 */
export function FieldServicesProvider({ value, children }: FieldServicesProviderProps) {
  return <FieldServicesContext.Provider value={value}>{children}</FieldServicesContext.Provider>;
}
