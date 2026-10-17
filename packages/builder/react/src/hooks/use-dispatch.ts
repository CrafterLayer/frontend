import type { BuilderKernel } from '@craftkit/builder-core';

import { useBuilder } from './use-builder';

/** The kernel's single validated door, typed for core commands (Law V/FR-004). */
export function useDispatch(): BuilderKernel['dispatch'] {
  return useBuilder().dispatch;
}
