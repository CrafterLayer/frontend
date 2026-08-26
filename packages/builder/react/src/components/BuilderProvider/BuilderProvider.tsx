import type { ReactNode } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';

import { KernelContext } from '../../kernel-context';

export interface BuilderProviderProps {
  /** One kernel instance per builder surface; created by the application. */
  kernel: BuilderKernel;
  children: ReactNode;
}

/**
 * Wires a kernel into React context so the hooks (`useBuilder`, `useNode`,
 * `useSelection`, `useDispatch`, `useRegistryVersion`) work anywhere beneath it.
 * Rendering itself lives in the renderer package; this component owns ONLY the
 * context boundary (FR-001/FR-004).
 */
export function BuilderProvider({ kernel, children }: BuilderProviderProps) {
  return <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>;
}
