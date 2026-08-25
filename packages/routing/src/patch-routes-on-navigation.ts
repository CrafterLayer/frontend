import { matchPath, type PathPattern, type RouteObject } from 'react-router';
import type {
  PatchRoutesOnNavigationFunction,
  PatchRoutesOnNavigationFunctionArgs,
} from 'react-router';

export type DeferredRoutePatchPath = PathPattern | string;

export interface DeferredRoutePatch {
  key: string;
  loadChildren: () => Promise<readonly RouteObject[]>;
  pathPatterns: readonly DeferredRoutePatchPath[];
  routeId: string | null;
  shouldPatch?: (args: PatchRoutesOnNavigationFunctionArgs) => boolean;
}

export interface DeferredRoutePatcher {
  patchRoutesOnNavigation: PatchRoutesOnNavigationFunction;
  preload: (path: string) => Promise<void>;
}

export type RouteTreeMapper = (route: RouteObject) => RouteObject;

export function mapRouteTree(
  routes: readonly RouteObject[],
  mapper: RouteTreeMapper,
): RouteObject[] {
  return routes.map((route) => {
    const routeWithMappedChildren: RouteObject = route.children
      ? { ...route, children: mapRouteTree(route.children, mapper) }
      : { ...route };

    return mapper(routeWithMappedChildren);
  });
}

function matchesPatchPath(pathPatterns: readonly DeferredRoutePatchPath[], path: string): boolean {
  return pathPatterns.some((pattern) => Boolean(matchPath(pattern, path)));
}

function assertUniquePatchKeys(patches: readonly DeferredRoutePatch[]): void {
  const keys = new Set<string>();

  for (const patch of patches) {
    if (keys.has(patch.key)) {
      throw new Error(`Deferred route patch key must be unique: ${patch.key}`);
    }

    if (patch.pathPatterns.length === 0) {
      throw new Error(`Deferred route patch must declare a path pattern: ${patch.key}`);
    }

    keys.add(patch.key);
  }
}

export function createDeferredRoutePatcher(
  patches: readonly DeferredRoutePatch[],
): DeferredRoutePatcher {
  assertUniquePatchKeys(patches);

  const appliedPatchKeys = new Set<string>();
  const loadedChildren = new Map<string, readonly RouteObject[]>();
  const pendingLoads = new Map<string, Promise<readonly RouteObject[]>>();

  const loadPatchChildren = (patch: DeferredRoutePatch): Promise<readonly RouteObject[]> => {
    const loaded = loadedChildren.get(patch.key);

    if (loaded) {
      return Promise.resolve(loaded);
    }

    const pending = pendingLoads.get(patch.key);

    if (pending) {
      return pending;
    }

    const nextLoad = patch
      .loadChildren()
      .then((children) => {
        const stableChildren = [...children];
        loadedChildren.set(patch.key, stableChildren);
        return stableChildren;
      })
      .finally(() => {
        pendingLoads.delete(patch.key);
      });

    pendingLoads.set(patch.key, nextLoad);
    return nextLoad;
  };

  const preload = async (path: string): Promise<void> => {
    const matchingPatches = patches.filter(
      (patch) => !appliedPatchKeys.has(patch.key) && matchesPatchPath(patch.pathPatterns, path),
    );

    await Promise.all(matchingPatches.map(loadPatchChildren));
  };

  const patchRoutesOnNavigation: PatchRoutesOnNavigationFunction = async (args) => {
    const matchingPatches = patches.filter(
      (patch) =>
        !appliedPatchKeys.has(patch.key) &&
        matchesPatchPath(patch.pathPatterns, args.path) &&
        (patch.shouldPatch ? patch.shouldPatch(args) : true),
    );

    const loadedPatches = await Promise.all(
      matchingPatches.map(async (patch) => ({
        children: await loadPatchChildren(patch),
        patch,
      })),
    );

    for (const loadedPatch of loadedPatches) {
      if (args.signal.aborted) {
        return;
      }

      if (appliedPatchKeys.has(loadedPatch.patch.key)) {
        continue;
      }

      args.patch(loadedPatch.patch.routeId, [...loadedPatch.children]);
      appliedPatchKeys.add(loadedPatch.patch.key);
      loadedChildren.delete(loadedPatch.patch.key);
    }
  };

  return { patchRoutesOnNavigation, preload };
}

export function createPatchRoutesOnNavigation(
  patches: readonly DeferredRoutePatch[],
): PatchRoutesOnNavigationFunction {
  return createDeferredRoutePatcher(patches).patchRoutesOnNavigation;
}
