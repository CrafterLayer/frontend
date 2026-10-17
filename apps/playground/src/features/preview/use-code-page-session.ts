import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { BuilderSiteKernel } from '@craftkit/builder';

import { createCodePageSession, type CodePageSessionState } from './code-page-session';
import type { CodeRuntimeClient } from './code-runtime-client';

const EMPTY: CodePageSessionState = {
  source: undefined,
  compiled: undefined,
  status: 'unavailable',
  message: undefined,
  selection: undefined,
  text: '',
  exporting: false,
};
const subscribeEmpty = () => () => undefined;
const readEmpty = () => EMPTY;

export function useCodePageSession(
  kernel: BuilderSiteKernel | undefined,
  client: CodeRuntimeClient | undefined,
  editing: boolean,
  exporting: boolean,
  publishedOrigin?: string,
) {
  const controller = useMemo(
    () =>
      kernel === undefined
        ? undefined
        : createCodePageSession({
            kernel,
            client,
            editing,
            exporting,
            publishedOrigin,
          }),
    [kernel, client, editing, exporting, publishedOrigin],
  );
  useEffect(() => controller?.start(), [controller]);
  const state = useSyncExternalStore(
    controller?.subscribe ?? subscribeEmpty,
    controller?.getSnapshot ?? readEmpty,
    controller?.getSnapshot ?? readEmpty,
  );
  return { controller, ...state };
}
