import { useEffect } from 'react';

import {
  createLiveUtilities,
  setUtilityClassOracle,
  type BuilderSiteKernel,
} from '@craftkit/builder';

import { liveUtilityClasses } from './live-utility-classes';

/**
 * Run Tailwind's compiler in the page for the site's custom-code trees.
 *
 * Once it is ready, any class Tailwind can generate renders on the canvas, in
 * preview, and in a proposal previewed before Apply — scoped to AI regions, so
 * built-in blocks keep the static sheet's cascade untouched. The same
 * compiler becomes the door's oracle, so the plan
 * validator, the plan normalizer and the prompt all judge a class by the
 * engine that styles it. Until it is ready, or if it cannot start, nothing
 * changes: the static vocabulary keeps answering, exactly as before.
 */
export function useLiveUtilities(siteKernel: BuilderSiteKernel | undefined): void {
  useEffect(() => {
    if (siteKernel === undefined) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    // Tailwind's scale and palette as text, loaded with the compiler and only then.
    import('tailwindcss/theme.css?raw')
      .then((theme) => createLiveUtilities({ document, tailwindThemeCss: theme.default }))
      .then((live) => {
        if (disposed) {
          live.dispose();
          return;
        }
        setUtilityClassOracle(live.isUtilityClass);
        let seen: unknown;
        const sync = (): void => {
          const site = siteKernel.getSite();
          if (site === seen) return;
          seen = site;
          live.ensure(liveUtilityClasses(site));
        };
        sync();
        const unsubscribe = siteKernel.subscribe(sync);
        /*
          The store is not everything that renders: a proposal previewed before
          Apply (Plan preview, Ask) is a scratch document the store never sees,
          and the oracle admitted its classes on the promise that they render.
          So whatever renders inside an AI region of this page, or of the canvas
          frame in it, gets its CSS as it appears.
        */
        const unwatch = live.watch(document);
        stop = () => {
          unwatch();
          unsubscribe();
          setUtilityClassOracle(undefined);
          live.dispose();
        };
      })
      .catch((cause: unknown) => {
        // The static vocabulary still answers; say why the live one does not.
        console.warn('[playground] live Tailwind utilities are unavailable:', cause);
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [siteKernel]);
}
