import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { SiteRunSeam } from '../../../preview/components/AssistantPanel/use-site-run';
import type { AgentController } from '../../model/view-types';

interface Held {
  readonly runId: string;
  readonly controller: AbortController;
}

/**
 * The run lease the Site destination borrows (`SiteRunSeam`), for the v2 panel.
 *
 * The v1 panel owned one lease for both its own runs and the site builder's, and handed it
 * up (`onSiteSeam`). Without a seam the site builder is lent `IDLE_SITE_RUN_SEAM`, which
 * refuses every claim: the Site destination could never build. This seam lends the lease
 * while the agent is not running and says `busy` while either one runs, so a site build
 * never starts over a page build. Stop aborts the site run that holds it, else the agent's.
 *
 * One direction is not guarded: the controller has no hook to refuse a request while a
 * site run holds the lease, so a request sent during a site build still runs.
 */
export function useSiteSeam(
  controller: Pick<AgentController, 'state' | 'stop'>,
  onSiteSeam: ((seam: SiteRunSeam) => void) | undefined,
): void {
  const agentBusy = controller.state.run !== null;
  const agentBusyNow = useRef(agentBusy);
  useLayoutEffect(() => {
    agentBusyNow.current = agentBusy;
  }, [agentBusy]);
  const held = useRef<Held | null>(null);
  const [siteBusy, setSiteBusy] = useState(false);
  const stopAgent = controller.stop;

  const seam = useMemo<SiteRunSeam>(
    () => ({
      busy: agentBusy || siteBusy,
      claim: (runId, abort) => {
        if (agentBusyNow.current || held.current !== null) return false;
        held.current = { runId, controller: abort };
        setSiteBusy(true);
        return true;
      },
      release: (runId) => {
        if (held.current?.runId !== runId) return;
        held.current = null;
        setSiteBusy(false);
      },
      stop: () => {
        if (held.current === null) stopAgent();
        else held.current.controller.abort();
      },
    }),
    [agentBusy, siteBusy, stopAgent],
  );

  useEffect(() => {
    onSiteSeam?.(seam);
  }, [onSiteSeam, seam]);
}
