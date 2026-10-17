import { createContext } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';

/** Internal context object; consumed through the hooks and BuilderProvider only. */
export const KernelContext = createContext<BuilderKernel | null>(null);
