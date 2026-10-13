import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { BuilderKernel, NodeId } from '@craftkit/builder';

import { ownsRun, type ActiveRunLease } from './AssistantPanel.runs';
import type { AskOrigin, QueuedAssistantRequest } from './AssistantPanel.types';
import type { SiteRunSeam } from './use-site-run';

export interface RunQueueInputs {
  kernel: BuilderKernel;
  ask: (
    request: string,
    origin?: AskOrigin,
    capturedSelection?: readonly NodeId[],
  ) => Promise<void>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  queuedRequest: QueuedAssistantRequest | null;
  setQueuedRequest: Dispatch<SetStateAction<QueuedAssistantRequest | null>>;
  queuePaused: boolean;
  setQueuePaused: Dispatch<SetStateAction<boolean>>;
  /** A lease and controller for the one run allowed to own this panel. */
  activeRunRef: RefObject<ActiveRunLease | null>;
  onSiteSeam: ((seam: SiteRunSeam) => void) | undefined;
}

/**
 * The panel's ONE run at a time: the queued request runs when the panel is
 * free (unless its target is gone, or the person paused it), Stop aborts
 * whatever owns the lease, and the same lease is handed to the site run.
 */
export function useRunQueue({
  kernel,
  ask,
  busy,
  setBusy,
  queuedRequest,
  setQueuedRequest,
  queuePaused,
  setQueuePaused,
  activeRunRef,
  onSiteSeam,
}: RunQueueInputs): () => void {
  useEffect(() => {
    if (busy || queuePaused || queuedRequest === null || queuedRequest.state === 'missing-target') {
      return;
    }
    const nodes = kernel.getDocument().nodes;
    const missingTarget = queuedRequest.selection.some(
      (id, index) => nodes[id]?.type !== queuedRequest.targetTypes[index],
    );
    if (missingTarget) {
      setQueuedRequest((current) =>
        current === null ? null : { ...current, state: 'missing-target' },
      );
      return;
    }
    const next = queuedRequest;
    setQueuedRequest(null);
    void ask(next.request, 'typed', next.selection);
  }, [ask, busy, kernel, queuePaused, queuedRequest, setQueuedRequest]);

  const stop = useCallback(() => {
    if (queuedRequest !== null) setQueuePaused(true);
    activeRunRef.current?.controller.abort();
  }, [queuedRequest, setQueuePaused, activeRunRef]);

  /**
   * The panel's ONE lease, handed to the site run rather than duplicated.
   *
   * Load-bearing: a site run and a page run take the same lease, so two runs
   * can never both believe they own `busy`, and `stop` aborts whichever is
   * going without knowing which kind it is.
   */
  const siteSeam = useMemo<SiteRunSeam>(
    () => ({
      busy,
      claim: (runId, controller) => {
        if (activeRunRef.current !== null) return false;
        activeRunRef.current = { runId, controller };
        setBusy(true);
        return true;
      },
      release: (runId) => {
        if (ownsRun(activeRunRef.current, runId)) {
          activeRunRef.current = null;
          setBusy(false);
        }
      },
      stop: () => {
        activeRunRef.current?.controller.abort();
      },
    }),
    [busy, activeRunRef, setBusy],
  );
  /*
    Handed UP, not consumed here. The site builder lives on its own rail
    destination now, and the two share this one lease so a site build and a page
    request can never both believe they own the editor.
  */
  useEffect(() => {
    onSiteSeam?.(siteSeam);
  }, [onSiteSeam, siteSeam]);

  return stop;
}
