import { useMemo, useState } from 'react';

import {
  createOfflineSiteStageProvider,
  createSiteBuilder,
  type BuilderSite,
  type BuilderSiteKernel,
} from '@craftkit/builder';

import { createLocalAssetLibrary } from '../features/preview/local-asset-library';
import {
  IDLE_SITE_RUN_SEAM,
  type SiteRunSeam,
} from '../features/preview/components/AssistantPanel/use-site-run';
import { usePhoneLayout, type ProposalPreview } from '../features/agent';
import {
  playgroundExtensions,
  type PlaygroundFixture,
} from '../features/preview/create-playground-kernel';
import { pageOpener } from './agent-host';
import { AGENT_PANEL } from './app-env';

export interface AgentHostOptions {
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly fixture: PlaygroundFixture;
  readonly railSection: string;
}

/**
 * The assistant's seams into this host: the run lease it lends the Site destination,
 * its pill's place in the status bar, a proposal previewed on the canvas, the phone
 * sheet, the "new page" opener, and the site host it builds whole sites through.
 */
export function useAgentHost({ siteKernel, fixture, railSection }: AgentHostOptions) {
  /**
   * What the assistant needs to build a whole site, in one object.
   *
   * The DRAFT factory is the load-bearing part. A run writes command by command
   * into a throwaway and lands the result as one transaction, and that
   * throwaway has to share the live site's vocabulary — otherwise every stage
   * validates against one registry and the commit is judged by another. Only
   * the host knows the fixture that decides it.
   *
   * The provider is offline until a stage server exists: an offline site is a
   * template, and the day a person is shown one it must be because the host
   * chose it here, not because a fallback quietly took over.
   */
  /*
    The assistant panel owns the ONE run lease and lends it here. Held in state
    rather than derived, because the panel hands it up after it mounts and the
    site destination may be the first thing a person opens.
  */
  const [siteSeam, setSiteSeam] = useState<SiteRunSeam>(IDLE_SITE_RUN_SEAM);
  /*
    The v2 agent panel's place in the status bar: while the panel is hidden it draws its
    one-line pill here (a portal), in place of the stacked "Assistant: …" change chips.
  */
  const [agentPillHost, setAgentPillHost] = useState<HTMLElement | null>(null);
  /*
    An Ask proposal shown on the canvas before it is applied (the proposal card's
    Preview): the would-be page, drawn by the static renderer from the controller's
    scratch rehearsal. Looking is not applying; nothing here reaches the kernel.
  */
  const [agentPreview, setAgentPreview] = useState<ProposalPreview | null>(null);
  /*
    On a phone (<600px, coarse pointer) the v2 panel is a sheet over the editor, portalled
    to the page; the shell's own panel column then stays closed so it never covers the
    canvas the sheet's mini detent shows. The panel stays mounted in it all the same.
  */
  const phone = usePhoneLayout();
  const agentAsSheet = AGENT_PANEL === 'v2' && phone && railSection === 'assistant';
  /* A "new page" request opens a real page on the site, as Pages → Add page does. */
  const openAgentPage = useMemo(
    () => (siteKernel === undefined ? undefined : pageOpener(siteKernel)),
    [siteKernel],
  );
  const assetLibrary = useMemo(() => createLocalAssetLibrary(), []);
  const siteHost = useMemo(
    () =>
      siteKernel === undefined
        ? undefined
        : {
            kernel: siteKernel,
            createDraft: (site: BuilderSite) =>
              createSiteBuilder({
                site,
                extensions: playgroundExtensions(fixture),
              }),
            provider: createOfflineSiteStageProvider(),
            /*
              Built once with the host, not per render: `AssetPicker` lists per
              `library` identity, and a fresh port object every render would
              list on every render.
            */
            library: assetLibrary,
          },
    [siteKernel, fixture, assetLibrary],
  );
  return {
    siteSeam,
    setSiteSeam,
    agentPillHost,
    setAgentPillHost,
    agentPreview,
    setAgentPreview,
    agentAsSheet,
    openAgentPage,
    assetLibrary,
    siteHost,
  };
}

export type AgentHost = ReturnType<typeof useAgentHost>;
