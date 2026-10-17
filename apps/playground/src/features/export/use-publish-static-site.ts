import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import {
  createLiveUtilities,
  type ArtifactFile,
  type BuilderSiteKernel,
  type LiveUtilities,
} from '@craftkit/builder';

import { exportCompilers, type ExportClassCompiler } from './export-compilers';
import { hasStaticPages, LIVE_UTILITIES_STYLE_SELECTOR, publishStaticSite } from './publish-static-site';

export interface PublishStaticSiteState {
  /** The site has at least one non-code page. */
  readonly canPublish: boolean;
  readonly publishing: boolean;
  readonly error: string | undefined;
  /** Resolves with the files to download, or undefined when nothing was published. */
  readonly publish: () => Promise<readonly ArtifactFile[] | undefined>;
}

const noop = () => () => undefined;

/**
 * A compiler for the export when the page's live one is not running: a fresh,
 * generate-only instance (no document, no canvas variants). Undefined when
 * Tailwind cannot start here either — `exportCompilers` then refuses.
 */
async function freshCompiler(): Promise<ExportClassCompiler | undefined> {
  try {
    const theme = await import('tailwindcss/theme.css?raw');
    return await createLiveUtilities({ tailwindThemeCss: theme.default });
  } catch (cause) {
    console.warn('[playground] the export could not start a Tailwind compiler:', cause);
    return undefined;
  }
}

/** The "Publish site" action: the live site kernel in, the static site's files out. */
export function usePublishStaticSite(
  siteKernel: BuilderSiteKernel | undefined,
  origin: string | undefined,
  live?: LiveUtilities,
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
      const site = siteKernel.getSite();
      const lens = siteKernel.page(siteKernel.currentPage());
      const liveSheet = document.querySelector(LIVE_UTILITIES_STYLE_SELECTOR)?.textContent ?? '';
      const compiler = live ?? (await freshCompiler());
      const { compileCss, compileClasses } = exportCompilers({ site, liveSheet, compiler });
      return await publishStaticSite(site, {
        blocks: lens.context.registry.block,
        compileCss,
        ...(compileClasses === undefined ? {} : { compileClasses }),
        origin,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Publishing the site failed.');
      return undefined;
    } finally {
      setPublishing(false);
    }
  }, [siteKernel, origin, publishing, live]);
  return { canPublish, publishing, error, publish };
}
