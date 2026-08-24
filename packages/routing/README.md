# `@craftkit/routing`

Private React Router v8 foundation for CraftKit applications. It provides a curated router
surface, preloadable lazy components, and deterministic `patchRoutesOnNavigation` helpers.

React Router v8 no longer uses `react-router-dom`. Import application APIs from this package;
it exposes DOM `RouterProvider` from `react-router/dom` internally.

## Stable initial tree and deferred children

Keep layout/authentication shells in the initial tree, give every patch owner an explicit
route id, and dynamically import only its deferred children:

```tsx
import {
  RouterProvider,
  createBrowserRouter,
  createDeferredRoutePatcher,
  mapRouteTree,
} from '@craftkit/routing';

const dashboard = createDeferredRoutePatcher([
  {
    key: 'dashboard-settings',
    routeId: 'dashboard',
    pathPatterns: ['/dashboard/settings/*'],
    async loadChildren() {
      const { settingsRoutes } = await import('./routes/settings.routes');
      return mapRouteTree(settingsRoutes, (route) => ({
        ...route,
        errorElement: <RouteErrorBoundary />,
      }));
    },
  },
]);

const router = createBrowserRouter(stableRoutes, {
  patchRoutesOnNavigation: dashboard.patchRoutesOnNavigation,
});

root.render(<RouterProvider router={router} />);
```

Matching branch imports run concurrently but patches are applied in declaration order. An
in-flight load is shared, an aborted navigation cannot apply a stale patch, successful
branches patch once, and failed imports remain retryable.

## Intent prefetch

Warm code on mouse, touch, and keyboard intent. Call the same function from
`pointerenter`, `pointerdown`, and `focus`; do not patch the tree during preload:

```tsx
const prefetchSettings = () => dashboard.preload('/dashboard/settings/general');

<NavLink
  to="/dashboard/settings/general"
  onPointerEnter={prefetchSettings}
  onPointerDown={prefetchSettings}
  onFocus={prefetchSettings}
>
  Settings
</NavLink>;
```

Route code prefetch is only half of a fast transition. The owning app should also call its
query client's `prefetchQuery`/`prefetchInfiniteQuery` for first-paint data on the same
intent signals. Navigate directly to the real default child instead of paying for a parent
redirect.

## Preloadable lazy components

`lazyWithRetry` adds a typed `.preload()` method, retries transient import failures with
bounded backoff, and attempts one session-guarded reload only after a recognized stale
chunk failure exhausts retries. SSR never touches browser globals.

## Ownership

- The package owns generic route/lazy mechanics and React Router v8 exports.
- Apps own route ids, guards, loaders/actions, error UI, data prefetch, pending UI, and
  route-module boundaries.
- Product authorization, tenant, widget, or Releaseo route contracts do not belong here.

## Verification

```bash
pnpm --filter @craftkit/routing lint
pnpm --filter @craftkit/routing typecheck
pnpm --filter @craftkit/routing test:coverage
pnpm --filter @craftkit/routing build
pnpm --filter @craftkit/routing check:size
```
