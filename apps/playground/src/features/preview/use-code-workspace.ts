import { useEffect, useMemo } from 'react';
import type { BuilderSiteKernel } from '@craftkit/builder';
import type { VaultStore } from '../vault/store';
import type { CodePageSession } from './code-page-session';
import { createCodeWorkspaceSession } from './code-workspace-session';

export function useCodeWorkspace(
  kernel: BuilderSiteKernel | undefined,
  runtime: CodePageSession | undefined,
  store: VaultStore | undefined,
  siteId: string,
) {
  const session = useMemo(
    () =>
      kernel === undefined || runtime === undefined || store === undefined
        ? undefined
        : createCodeWorkspaceSession(kernel, runtime, store, siteId),
    [kernel, runtime, store, siteId],
  );
  useEffect(() => session?.start(), [session]);
  return session?.port;
}
