import { createContext, useContext } from 'react';

import type { RegisteredBlock } from '@craftkit/builder-schema';

/**
 * How a BLOCK reaches the registry.
 *
 * Blocks are handed props and nothing else — that isolation is what makes a
 * block a pure function of its node, and it is not being relaxed here. But a
 * custom-code tree may REFERENCE another registered block by name, and a name
 * is only useful next to the lookup that resolves it.
 *
 * A context is the narrowest thing that works. The alternatives were worse:
 * threading a lookup through `BlockRenderProps` would change the contract every
 * block in the workspace implements, for one block's benefit; a module-level
 * registry would be global state and would break the "two kernels in one
 * process" property the tests rely on.
 *
 * The value is a lookup FUNCTION, not a kernel — the same `RegistryRead.block`
 * shape `StaticDocument` already accepts. That is what lets the static export
 * path resolve references with no kernel present, and it keeps this package
 * from importing one.
 */
export type CustomCodeBlockLookup = (type: string) => RegisteredBlock | undefined;

/**
 * Absent by default. A tree rendered outside a provider still renders its
 * markup — only component references degrade, and they degrade visibly rather
 * than silently.
 */
export const CustomCodeRegistryContext = createContext<CustomCodeBlockLookup | undefined>(
  undefined,
);

export function useCustomCodeBlockLookup(): CustomCodeBlockLookup | undefined {
  return useContext(CustomCodeRegistryContext);
}
