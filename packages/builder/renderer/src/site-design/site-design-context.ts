import { createContext, useContext } from 'react';

import type { SiteLibrary } from '@craftkit/builder-schema';

/**
 * What a render knows about the SITE'S design library (style-manager
 * DESIGN.md §2, D6).
 *
 * Blocks receive props and nothing else, and a customCode tree is rendered
 * from one node's props — but a named-style marker (`ck-s-card`) and a symbol
 * instance only mean something next to the library that defines them. A
 * context is the narrowest way to hand that over, for the same reasons the
 * block registry travels as one (see `CustomCodeRegistryContext`): no change
 * to the contract every block implements, and no module-level state that two
 * kernels in one process would share.
 *
 * - `library` — the site's library, for symbol instances and the panels.
 * - `classTransform` — applied by the tree renderer to every class list before
 *   it reaches the DOM. The named-style expansion (P4,
 *   `named-style-transform.ts`) is supplied through here, so the canvas and
 *   the static export expand markers through ONE function.
 *
 * The canvas host (App) and `exportStaticSite` both provide it.
 */
export interface SiteDesign {
  library?: SiteLibrary | undefined;
  classTransform?: ((className: string) => string) | undefined;
}

/** Empty by default: outside a provider, markers render as plain hook classes. */
const EMPTY_SITE_DESIGN: SiteDesign = Object.freeze({});

export const SiteDesignContext = createContext<SiteDesign>(EMPTY_SITE_DESIGN);

export function useSiteDesign(): SiteDesign {
  return useContext(SiteDesignContext);
}
