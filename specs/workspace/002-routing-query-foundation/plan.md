# Implementation Plan: Routing and Query Foundation

**Spec**: [`spec.md`](spec.md)

**Status**: Approved

## Scope and Ownership

This is a workspace-scoped, cross-package change.

| Owner            | Paths                                                                               | Responsibility                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Query package    | `packages/query/**`                                                                 | SSR-safe client factory, provider, public TanStack exports, tests, build, docs      |
| Routing package  | `packages/routing/**`                                                               | React Router v8 exports, deferred patcher, lazy import recovery, tests, build, docs |
| Icon placeholder | `packages/icons/package.json`                                                       | Empty private package identity and metadata export only                             |
| Workspace        | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `scripts/**` | Exact catalogs, lock graph, aggregate bundle gates                                  |
| Agent governance | `.specify/agents/**`, `.specify/extensions/**`, generated integration skills        | One routed rule and Spec Kit-managed performance command                            |
| Architecture     | `docs/architecture/**`                                                              | Current frontend state and accepted ADR                                             |
| Feature truth    | `specs/workspace/002-routing-query-foundation/**`                                   | Requirements, decisions, work items, and verification evidence                      |

No application files, UI components, Releaseo files, or Storybook configuration are edited. The icon
placeholder contains no glyph implementation or dependency.

## Technical Context

- Node 24.19.0, pnpm 11.23.0, Turborepo 2.10.10.
- React and React DOM 19.2.8 from the root catalog.
- `react-router` 8.3.0. React Router v8 removes the `react-router-dom` package; DOM-only
  `RouterProvider` is imported from `react-router/dom` while shared APIs come from `react-router`.
- `@tanstack/react-query` 5.102.2. Version 5.102.3 was published inside the repository's 24-hour
  minimum release age, so 5.102.2 is the newest installable stable version at the verification time.
- TypeScript 6, Vite 8 library mode, Vitest 4, and the existing shared config packages.

## Architecture Decisions

### Query lifecycle

`@craftkit/query` exports `createQueryClient` and a `QueryProvider` that requires an explicit
client. Browser apps may keep one client per application root; SSR frameworks must create a client
per request. The package never creates or captures a singleton. Query and Mutation caches own error
callbacks so applications can integrate telemetry or notifications without coupling the package to a
UI library.

### Router contract

`@craftkit/routing` re-exports a curated React Router v8 surface and owns two helpers:

1. `createDeferredRoutePatcher` maintains a small stable initial tree, deduplicates branch imports,
   patches successful branches in declaration order, skips aborted navigations, and provides
   code-only `preload(path)`.
2. `lazyWithRetry` returns a typed lazy component with `preload()`, bounded exponential retries,
   recognized chunk-error recovery, and a one-time browser reload guard.

The package has no roles, authentication, widget, tenant, or application route ids. Apps own stable
parent ids, route error elements, data loaders, and user-intent event wiring.

### Bundle contract

Vite library builds externalize React plus their peer runtime. Each package declares a raw entry
budget through the shared `scripts/check-bundle-size.mjs` checker. Raw size is used because it is
deterministic and catches wrapper growth even when compression ratios change; applications still
measure their own production chunks separately.

### Empty icon placeholder

`@craftkit/icons` reserves a workspace package name only. It exposes its package metadata but has no
root runtime entry, source files, dependencies, build, test, or Storybook tasks. Adding an actual
icon contract requires a separate approved scope.

### Agent automation

The source rule lives at `.specify/agents/rules/routing-performance.md`. A local Spec Kit extension
source provides `speckit.routing-performance.optimize`; generated Claude/Codex/Cursor skills are
reconciled through the Spec Kit CLI and are never edited by hand.

## Dependency Direction

Before:

```text
apps -> @craftkit/ui
packages -> shared config packages
```

After:

```text
future apps -> @craftkit/query -> @tanstack/react-query + react
future apps -> @craftkit/routing -> react-router + react
@craftkit/icons -> metadata only, with no dependencies or runtime API
@craftkit/query/@craftkit/routing -> shared lint/type/test config (development only)
```

None of the new packages imports an app, `@craftkit/ui`, or another new foundation package. The
graph stays acyclic. External runtime dependencies are peers and exact root-catalog dev entries.

## Public API and Migration

- New APIs have no current CraftKit consumers and therefore no compatibility break.
- Releaseo's `RequireRole`, MUI error views, project route ids, and global QueryClient are
  intentionally excluded.
- Future consumers migrate DOM imports to `@craftkit/routing`; the wrapper itself targets React
  Router v8 and does not expose `react-router-dom`.
- Route modules return `RouteObject[]`; applications map their error boundary or other transforms
  before returning children to the patcher.
- `@craftkit/icons` intentionally has no root icon API or category subpaths in this scope.

## Build, Cache, and Deployment Effects

- Two private package build nodes and `check:size` tasks join the Turbo graph.
- Root verification runs bundle checks after package builds.
- There is no deployable application or runtime deployment change.
- The lockfile gains React Router and TanStack Query runtime graphs.

## Test Strategy

1. Pure unit tests for deferred route matching, order, concurrency, abort, preload, failure retry,
   and duplicate configuration.
2. Pure and jsdom tests for lazy import retries and browser-only reload safeguards.
3. React Testing Library tests for explicit QueryClient provider isolation.
4. Query cache callback tests for query and mutation errors.
5. Package lint, typecheck, tests with coverage, build, and bundle checks.
6. Workspace validators, boundaries, formatting, affected graph, and aggregate verification.
7. Independent read-only review against this plan and the constitution.

No Storybook or icon runtime test is required because the icon package is intentionally an empty
placeholder. The workspace validator checks its identity and metadata export.

## Rollout and Rollback

Rollout is atomic at the workspace level: manifests, lockfile, packages, governance, and docs land
together. Consumers adopt the packages later through their own scoped specs.

Rollback removes the two unconsumed runtime packages, the empty icon placeholder, their catalog/size
wiring, Spec Kit performance extension/rule, and ADR as one coherent change, then regenerates the
lockfile. No user data or deployed state is involved.

## Constitution Check

- Scope and package owners are explicit.
- Public APIs are narrow and the dependency graph stays acyclic.
- Query and routing modules are typed, pure where possible, and contain no hidden React component
  declarations.
- The icon package contains no components, libraries, or runtime behavior.
- Evidence expands from module tests to package and workspace gates.
- Spec Kit remains the only governance and generated-skill source.
- No commit or push is performed.
