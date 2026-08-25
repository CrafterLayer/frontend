import { createMemoryRouter } from 'react-router';
import type { PatchRoutesOnNavigationFunctionArgs, RouteObject } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  createDeferredRoutePatcher,
  createPatchRoutesOnNavigation,
  mapRouteTree,
  type DeferredRoutePatch,
} from './patch-routes-on-navigation';

function createNavigationArgs(
  path: string,
  patch: PatchRoutesOnNavigationFunctionArgs['patch'],
  signal: AbortSignal = new AbortController().signal,
): PatchRoutesOnNavigationFunctionArgs {
  return {
    fetcherKey: undefined,
    matches: [],
    patch,
    path,
    signal,
  };
}

function route(id: string): RouteObject {
  return { id, path: id };
}

describe('mapRouteTree', () => {
  it('maps nested routes from children to parents', () => {
    const mapped = mapRouteTree(
      [{ id: 'root', path: '/', children: [{ id: 'child', path: 'child' }] }],
      (current) => ({ ...current, handle: { mapped: true } }),
    );

    expect(mapped[0]?.handle).toEqual({ mapped: true });
    expect(mapped[0]?.children?.[0]?.handle).toEqual({ mapped: true });
  });
});

describe('createDeferredRoutePatcher', () => {
  it('rejects duplicate keys and empty path patterns before navigation', () => {
    const duplicate: DeferredRoutePatch[] = [
      {
        key: 'settings',
        loadChildren: () => Promise.resolve([]),
        pathPatterns: ['/a'],
        routeId: 'root',
      },
      {
        key: 'settings',
        loadChildren: () => Promise.resolve([]),
        pathPatterns: ['/b'],
        routeId: 'root',
      },
    ];

    expect(() => createDeferredRoutePatcher(duplicate)).toThrow(/must be unique/);
    expect(() =>
      createDeferredRoutePatcher([
        {
          key: 'empty',
          loadChildren: () => Promise.resolve([]),
          pathPatterns: [],
          routeId: 'root',
        },
      ]),
    ).toThrow(/path pattern/);
  });

  it('loads matching patches concurrently and applies them in declaration order', async () => {
    const first = Promise.withResolvers<readonly RouteObject[]>();
    const second = Promise.withResolvers<readonly RouteObject[]>();
    const patch = vi.fn();
    const patcher = createDeferredRoutePatcher([
      {
        key: 'first',
        loadChildren: () => first.promise,
        pathPatterns: ['/area/*'],
        routeId: 'root',
      },
      {
        key: 'second',
        loadChildren: () => second.promise,
        pathPatterns: ['/area/*'],
        routeId: 'first',
      },
    ]);

    const navigation = patcher.patchRoutesOnNavigation(createNavigationArgs('/area/page', patch));
    second.resolve([route('second')]);
    first.resolve([route('first')]);
    await navigation;

    expect(patch.mock.calls).toEqual([
      ['root', [route('first')]],
      ['first', [route('second')]],
    ]);
  });

  it('deduplicates concurrent navigation loads and patches a branch once', async () => {
    const deferred = Promise.withResolvers<readonly RouteObject[]>();
    const loadChildren = vi.fn(() => deferred.promise);
    const patch = vi.fn();
    const patcher = createDeferredRoutePatcher([
      { key: 'ideas', loadChildren, pathPatterns: ['/ideas/*'], routeId: 'root' },
    ]);
    const args = createNavigationArgs('/ideas/new', patch);

    const first = patcher.patchRoutesOnNavigation(args);
    const second = patcher.patchRoutesOnNavigation(args);
    deferred.resolve([route('ideas')]);
    await Promise.all([first, second]);

    expect(loadChildren).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledOnce();
  });

  it('preloads code without patching and reuses it during navigation', async () => {
    const loadChildren = vi.fn(() => Promise.resolve([route('reports')]));
    const patch = vi.fn();
    const patcher = createDeferredRoutePatcher([
      { key: 'reports', loadChildren, pathPatterns: ['/reports/*'], routeId: 'root' },
    ]);

    await patcher.preload('/reports/weekly');
    expect(patch).not.toHaveBeenCalled();

    await patcher.patchRoutesOnNavigation(createNavigationArgs('/reports/weekly', patch));

    expect(loadChildren).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith('root', [route('reports')]);
  });

  it('does not patch an aborted navigation and keeps loaded code for the next navigation', async () => {
    const controller = new AbortController();
    const loadChildren = vi.fn(() => Promise.resolve([route('billing')]));
    const patch = vi.fn();
    const patcher = createDeferredRoutePatcher([
      { key: 'billing', loadChildren, pathPatterns: ['/billing'], routeId: 'root' },
    ]);
    controller.abort();

    await patcher.patchRoutesOnNavigation(
      createNavigationArgs('/billing', patch, controller.signal),
    );
    expect(patch).not.toHaveBeenCalled();

    await patcher.patchRoutesOnNavigation(createNavigationArgs('/billing', patch));
    expect(loadChildren).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledOnce();
  });

  it('retries a failed branch load on the next navigation', async () => {
    const loadChildren = vi
      .fn<() => Promise<readonly RouteObject[]>>()
      .mockRejectedValueOnce(new Error('temporary import failure'))
      .mockResolvedValueOnce([route('retry')]);
    const patch = vi.fn();
    const patchRoutes = createPatchRoutesOnNavigation([
      { key: 'retry', loadChildren, pathPatterns: ['/retry'], routeId: 'root' },
    ]);

    await expect(patchRoutes(createNavigationArgs('/retry', patch))).rejects.toThrow(
      'temporary import failure',
    );
    await patchRoutes(createNavigationArgs('/retry', patch));

    expect(loadChildren).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenCalledOnce();
  });

  it('skips non-matching or guarded branches', async () => {
    const loadChildren = vi.fn(() => Promise.resolve([route('private')]));
    const patch = vi.fn();
    const patchRoutes = createPatchRoutesOnNavigation([
      {
        key: 'private',
        loadChildren,
        pathPatterns: ['/private/*'],
        routeId: 'root',
        shouldPatch: () => false,
      },
    ]);

    await patchRoutes(createNavigationArgs('/public', patch));
    await patchRoutes(createNavigationArgs('/private/account', patch));

    expect(loadChildren).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('patches a deferred branch through the real React Router v8 navigation contract', async () => {
    const loadChildren = vi.fn(() =>
      Promise.resolve<readonly RouteObject[]>([{ id: 'reports', path: 'reports' }]),
    );
    const patcher = createDeferredRoutePatcher([
      { key: 'reports', loadChildren, pathPatterns: ['/reports'], routeId: 'root' },
    ]);
    const router = createMemoryRouter(
      [{ id: 'root', path: '/', children: [{ id: 'home', index: true }] }],
      {
        initialEntries: ['/'],
        patchRoutesOnNavigation: patcher.patchRoutesOnNavigation,
      },
    );

    try {
      await router.navigate('/reports');

      expect(router.state.location.pathname).toBe('/reports');
      expect(router.state.matches.map((match) => match.route.id)).toEqual(['root', 'reports']);
      expect(loadChildren).toHaveBeenCalledOnce();
    } finally {
      router.dispose();
    }
  });
});
