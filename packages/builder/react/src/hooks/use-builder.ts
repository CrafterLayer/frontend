import { useContext } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';

import { KernelContext } from '../kernel-context';

/** The mounted kernel; throws outside <BuilderProvider> (a wiring bug, not a state). */
export function useBuilder(): BuilderKernel {
  const kernel = useContext(KernelContext);
  if (kernel === null) {
    throw new Error('useBuilder must be used inside <BuilderProvider>.');
  }
  return kernel;
}
