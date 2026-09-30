import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import type { ArtifactFile, BuilderSiteKernel } from '@craftkit/builder';

import { hasStaticPages, liveUtilitiesCompileCss, publishStaticSite } from './publish-static-site';

export interface PublishStaticSiteState {
  /** The site has at least one non-code page. */
  readonly canPublish: boolean;
  readonly publishing: boolean;
  readonly error: string | undefined;
  /** Resolves with the files to download, or undefined when nothing was published. */
  readonly publish: () => Promise<readonly ArtifactFile[] | undefined>;
}

const noop = () => () => undefined;

/** The "Publish site" action: the live site kernel in, the static site's files out. */
export function usePublishStaticSite(
  siteKernel: BuilderSiteKernel | undefined,
  origin: string | undefined,
): PublishStaticSiteState {
  const subscribe = useMemo(
    () => (siteKernel === undefined ? noop : (listener: () => void) => siteKernel.subscribe(listener)),
    [siteKernel],
  );
  const canPublish = useSyncExternalStore(
    subscribe,
    () => (siteKernel === undefined ? false : hasStaticPages(siteKernel.getSite())),
  );
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const publish = useCallback(async () => {
    if (siteKernel === undefined || publishing) return undefined;
    setPublishing(true);
    setError(undefined);
    try {
      const lens = siteKernel.page(siteKernel.currentPage());
      return await publishStaticSite(siteKernel.getSite(), {
        blocks: lens.context.registry.block,
        compileCss: liveUtilitiesCompileCss(),
        origin,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Publishing the site failed.');
      return undefined;
    } finally {
      setPublishing(false);
    }
  }, [siteKernel, origin, publishing]);
  return { canPublish, publishing, error, publish };
}
