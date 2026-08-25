# Routing, Lazy Loading, and Bundle Performance

Load this rule for React Router route trees, `patchRoutesOnNavigation`, TanStack Query
prefetching, lazy component boundaries, or production bundle analysis.

## Measure Before Changing

- Reproduce the slow navigation or bundle regression in the owning app's production
  build whenever an app exists. Development HMR timing is supporting evidence, not the
  production verdict.
- Record the initial route chunk, the deferred chunk being targeted, and raw or compressed
  sizes before and after the change. Package wrappers additionally run their declared
  `check:size` task.
- Attribute delay separately to code loading, data loading, render work, and intentional
  transition UI. Do not label all navigation latency as a router problem.
- Keep peer runtimes external in library builds. A small wrapper must not rebundle React,
  React Router, TanStack Query, or other host-owned runtimes.

## Route Tree Contract

- Keep the initial route tree to stable parents, default routes, and small universal
  branches. Give every deferred patch owner a stable explicit route id.
- Use `createDeferredRoutePatcher` from `@craftkit/routing` for route-tree lazy loading.
  Each patch has a unique key, an owner id, a deterministic path matcher, and a dynamic
  child-module import.
- Preserve patcher guarantees: share concurrent imports, apply matching branches in
  declaration order, patch a successful branch once, skip stale aborted navigations, and
  leave failed loads retryable.
- Apply app-owned route transforms, such as error elements, authorization wrappers, or
  handles, to the loaded child tree before returning it to the patcher.
- Use `lazyWithRetry` for lazy React components that need bounded chunk recovery and an
  explicit `.preload()` hook. Do not add reload loops or reload for ordinary render errors.
- Keep a visible shell-level pending state for route navigation and local `Suspense`
  fallbacks around slower page sections. A blank screen is not an optimization.

## Prefetch Contract

Navigation performance has two independent warm-up layers:

1. **Code prefetch:** call the route patcher's `preload(path)` or a lazy component's
   `.preload()` on user intent.
2. **Data prefetch:** use the application-owned QueryClient to prefetch the first stable
   query set required by the destination.

Wire heavy menu and tab destinations on `pointerenter`, `pointerdown`, and keyboard
`focus`. Prefetch must be safe to repeat, must not patch the router early, and must not
start low-value downloads for every possible route at application boot.

Create QueryClient instances at the owning browser-root or server-request boundary with
`createQueryClient` from `@craftkit/query`. Never introduce a module-global client in SSR
code, and never mirror TanStack Query server state into a client store.

## Chunk Boundaries

- Split the route first, then defer heavy internals that are absent from first paint:
  editors, large tables, date pickers, visual builders, previews, and closed drawers or
  dialogs.
- Avoid broad barrels on a performance-sensitive path when they make unrelated modules
  eager. Verify the actual emitted graph instead of assuming a dynamic import created a
  useful chunk.

## Completion Evidence

For a package-only change, run the owning lint, typecheck, tests with coverage, build, and
`check:size`. For an application change, also build the app and record the relevant route
chunks before and after. Cross-package changes finish with workspace validators,
`pnpm check:bundles`, `pnpm verify`, and `git diff --check`.

Report code-load, data-load, and render findings separately. State exact checks that ran,
measured artifacts, residual unmeasured behavior, and whether a hosted CI run exists.
