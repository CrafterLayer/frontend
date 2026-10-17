import { useEffect, useMemo } from 'react';
import type { BuilderSiteKernel } from '@craftkit/builder';
import type { VaultSession } from '../vault/use-vault';
import type { CodePageSession } from './code-page-session';
import type { CodeRuntimeClient } from './code-runtime-client';
import type { SourceAgentClient } from './source-agent-client';
import { createSourceAgentSession } from './source-agent-session';

export function useSourceAgent(kernel: BuilderSiteKernel | undefined, runtime: CodePageSession | undefined, compiler: CodeRuntimeClient | undefined, client: SourceAgentClient | undefined, vault: VaultSession | undefined, siteId: string, enabled: boolean, onReview: (files: readonly string[]) => void) {
  const journal = vault?.sourceRunJournal;
  const store = vault?.store;
  const session = useMemo(() => kernel === undefined || runtime === undefined || journal === undefined || store === undefined ? undefined : createSourceAgentSession({ kernel, runtime, compiler, client, journal, store, siteId, enabled, onReview }), [kernel, runtime, compiler, client, journal, store, siteId, enabled, onReview]);
  useEffect(() => session?.start(), [session]);
  return session?.port;
}
