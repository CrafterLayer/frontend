import { useMemo } from 'react';

import type { SiteLibrary } from '@craftkit/builder-schema';

import { buildLibraryCss } from '../build-library-css';
import { useSiteDesign } from '../site-design-context';

export interface SiteLibraryStyleProps {
  /** The library to publish; defaults to the one `SiteDesignContext` provides. */
  library?: SiteLibrary | undefined;
}

/**
 * The site design library's stylesheet on the canvas: palette variables,
 * font imports and uploaded faces, as one `<style data-ck-library>`.
 *
 * Renders nothing when the library contributes nothing, so a site without a
 * library adds no element to the page.
 */
export function SiteLibraryStyle({ library }: SiteLibraryStyleProps) {
  const fromContext = useSiteDesign().library;
  const source = library ?? fromContext;
  const css = useMemo(() => buildLibraryCss(source), [source]);
  if (css === '') return null;
  return <style data-ck-library="">{css}</style>;
}
