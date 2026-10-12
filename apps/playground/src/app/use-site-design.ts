import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import {
  darkTheme,
  lightTheme,
  themeFromDesignSystem,
  type BuilderSiteKernel,
  type ColorRole,
} from '@craftkit/builder';

import type { ThemeName } from '../features/preview/components/ThemePicker';

/**
 * The site's design, subscribed: its palette (as the page theme, with the harness
 * picker and the colour control layered over it), its asset table and its design
 * library (palette, named styles, symbols, templates).
 */
export function useSiteDesign(siteKernel: BuilderSiteKernel | undefined, themeName: ThemeName) {
  /*
    The page theme, plus whatever the colour control has re-pointed.

    Overrides are kept BESIDE the named theme rather than replacing it, so
    switching light↔dark still lands on a complete theme and the edits a person
    made are not silently carried onto a palette they were never chosen for.
  */
  const [roleOverrides, setRoleOverrides] = useState<Partial<Record<ColorRole, string>>>({});
  /*
    The SITE's own palette, subscribed (FR-012).

    Read through the site kernel rather than from `lightTheme`, because a
    site's design system IS its palette: generated for that business and
    checked for contrast. Painting the canvas from a named module theme instead
    would mean the system a person sees in the panel and the colours actually on
    the page came from two different places, and only one of them was ever
    validated.

    It is one rule above every page, so a token change reaches all of them and
    rewrites no document — which is what keeps a palette edit one undo instead
    of one per page.
  */
  const siteTokens = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        siteKernel === undefined ? () => undefined : siteKernel.subscribe(onStoreChange),
      [siteKernel],
    ),
    useCallback(() => siteKernel?.getSite().designSystem, [siteKernel]),
  );
  /*
    Subscribed, not read at render time. A generation registers pictures in the
    same transaction that places them, and an unsubscribed read would leave the
    canvas holding the table from BEFORE the run — every new picture a labelled
    absence until something else happened to re-render the app.
  */
  const siteAssets = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        siteKernel === undefined ? () => undefined : siteKernel.subscribe(onStoreChange),
      [siteKernel],
    ),
    useCallback(() => siteKernel?.getSite().assets, [siteKernel]),
  );
  /* The site design library (palette, named styles, templates), subscribed like the tokens. */
  const siteLibrary = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        siteKernel === undefined ? () => undefined : siteKernel.subscribe(onStoreChange),
      [siteKernel],
    ),
    useCallback(() => siteKernel?.getSite().library, [siteKernel]),
  );
  const namedStyleChoices = useMemo(
    () =>
      Object.values(siteLibrary?.styles ?? {}).map((style) => ({
        id: style.id,
        name: style.name,
      })),
    [siteLibrary?.styles],
  );
  // Symbol masters by id: elements inside a symbol instance get their quick bar too.
  const symbols = siteLibrary?.symbols;
  const symbolTree = useCallback((symbolId: string) => symbols?.[symbolId]?.tree, [symbols]);
  const namedStyleClasses = useMemo(
    () =>
      Object.fromEntries(
        Object.values(siteLibrary?.styles ?? {}).map((style) => [style.id, style.className]),
      ) as Readonly<Record<string, string>>,
    [siteLibrary?.styles],
  );
  /*
    The site's palette is the DEFAULT; the harness picker is a layer over it.

    Both things have to stay true. FR-012 says a site's own design system paints
    its pages — so "light" is not a named module theme any more, it is whatever
    the site was generated with. And the harness's picker still has to recolour
    the frame in place, because that is a control a person uses to inspect a
    page in the dark, not a claim about the site's design.

    Layered rather than swapped, which is the whole reason
    `themeFromDesignSystem` takes overrides beside a system instead of merging
    them into it: a stored site never acquires colours nobody generated for it,
    however long someone leaves the picker on dark.
  */
  const theme = useMemo(() => {
    const overrides = themeName === 'dark' ? { ...darkTheme, ...roleOverrides } : roleOverrides;
    return siteTokens === undefined
      ? { ...(themeName === 'light' ? lightTheme : darkTheme), ...roleOverrides }
      : themeFromDesignSystem(siteTokens, overrides);
  }, [siteTokens, themeName, roleOverrides]);
  const retheme = useCallback((role: ColorRole, value: string) => {
    setRoleOverrides((current) => ({ ...current, [role]: value }));
  }, []);
  return {
    siteAssets,
    siteLibrary,
    namedStyleChoices,
    symbolTree,
    namedStyleClasses,
    theme,
    retheme,
  };
}

export type SiteDesign = ReturnType<typeof useSiteDesign>;
