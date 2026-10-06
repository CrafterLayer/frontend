import { expandNamedStyles, type SiteLibrary } from '@craftkit/builder-schema';

/**
 * The named-style expansion as a className transform (style-manager
 * DESIGN.md D6): `ck-s-<id>` markers become the style's utilities merged
 * under the element's own (`ckTwMerge(...styleUtilities, ownUtilities)`, via
 * the class-patch engine's `expandNamedStyles`).
 *
 * ONE function serves both readers — the canvas host and `exportStaticSite`
 * pass the result as `SiteDesignContext.classTransform` and as
 * `CustomCodeClassTransformContext` — so "edit the style once, every element
 * updates" holds identically on the canvas and in the published page.
 *
 * It runs for every element of every region on every render, so it is cheap:
 * a class list without a marker is returned untouched, and expansions are
 * memoised per transform (a transform is made per library value; a new
 * library makes a new transform and a fresh cache).
 */
export type NamedStyleTransform = (className: string) => string;

/** `{ id: utilities }` for the engine, from the library's stored styles. */
export function namedStyleMap(library: SiteLibrary | undefined): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const [id, style] of Object.entries(library?.styles ?? {})) {
    if (typeof style.className === 'string') map[id] = style.className;
  }
  return map;
}

const CACHE_LIMIT = 4000;

export function createNamedStyleTransform(library: SiteLibrary | undefined): NamedStyleTransform {
  const styles = namedStyleMap(library);
  const cache = new Map<string, string>();
  return function expandNamedStyleMarkers(className: string): string {
    if (!className.includes('ck-s-')) return className;
    const cached = cache.get(className);
    if (cached !== undefined) return cached;
    const expanded = expandNamedStyles(className, styles);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(className, expanded);
    return expanded;
  };
}
