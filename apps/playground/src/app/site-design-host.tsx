import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  buildLibraryCss,
  createNamedStyleTransform,
  CustomCodeClassTransformContext,
  SiteDesignContext,
  type BuilderSiteKernel,
  type SiteDesign,
} from '@craftkit/builder';

export interface SiteDesignHostProps {
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly children: ReactNode;
}

const noop = () => () => undefined;

/** A short, stable fingerprint of a stylesheet (djb2), used as the style element's key. */
function fingerprint(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return `${String(text.length)}-${(hash >>> 0).toString(36)}`;
}

/**
 * The site design library around everything that renders the page
 * (style-manager DESIGN.md §2, D6): the canvas, the proposal preview and
 * Preview all read named styles, symbols and palette variables from here.
 *
 * - `SiteDesignContext` carries the library and the named-style transform;
 * - `CustomCodeClassTransformContext` hands the same transform to the tree
 *   renderer, so `ck-s-<id>` markers expand on the canvas exactly as in the
 *   export (`exportStaticSite` builds the same transform);
 * - the library stylesheet (palette variables, font imports, uploaded faces)
 *   goes into the host page's head. The canvas iframe mirrors host styles as
 *   they are ADDED, so the element is keyed by its CSS: a palette edit swaps
 *   the element rather than its text, and the frame sees the new one.
 */
export function SiteDesignHost({ siteKernel, children }: SiteDesignHostProps) {
  const subscribe = useMemo(
    () => (siteKernel === undefined ? noop : (listener: () => void) => siteKernel.subscribe(listener)),
    [siteKernel],
  );
  const library = useSyncExternalStore(
    subscribe,
    useCallback(() => siteKernel?.getSite().library, [siteKernel]),
  );
  const design = useMemo<SiteDesign>(
    () => ({ library, classTransform: createNamedStyleTransform(library) }),
    [library],
  );
  const css = useMemo(() => buildLibraryCss(library), [library]);
  const transform = design.classTransform ?? ((className: string) => className);
  return (
    <SiteDesignContext.Provider value={design}>
      <CustomCodeClassTransformContext.Provider value={transform}>
        {children}
        {css === '' || typeof document === 'undefined'
          ? null
          : createPortal(
              <style key={fingerprint(css)} data-ck-library="">
                {css}
              </style>,
              document.head,
            )}
      </CustomCodeClassTransformContext.Provider>
    </SiteDesignContext.Provider>
  );
}
