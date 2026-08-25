# ADR 0002: Select Routing and Query Foundations

- **Status:** Accepted
- **Date:** 2026-08-25
- **Scope:** Workspace frontend packages
- **Spec:**
  [`specs/workspace/002-routing-query-foundation`](../../../specs/workspace/002-routing-query-foundation/spec.md)

## Context

Future CraftKit applications need consistent server-state ownership, route-level code splitting, and
recoverable lazy imports before their product frameworks and route trees are chosen. Copying
application-specific Releaseo implementations would also copy hidden singleton state, product route
ids, roles, error UI, and unrelated dependencies. The workspace needs small contracts that preserve
the proven mechanics without owning application behavior.

Navigation performance is not one concern: route code, destination data, render work, and pending UI
can each dominate a transition. Source-level dynamic imports alone are not evidence that a useful
production chunk exists, so the foundation also needs measured package budgets and a durable agent
workflow.

## Decision

Create two private runtime packages:

1. `@craftkit/query` targets TanStack Query 5.102.2 and exports a caller-owned `createQueryClient`,
   an explicit-client `QueryProvider`, and a curated TanStack surface. Browser roots may retain one
   client; server-rendered integrations create one per request. The package never owns a global
   client or domain query keys.
2. `@craftkit/routing` targets React Router 8.3.0. Shared APIs come from `react-router` and DOM
   `RouterProvider` comes from `react-router/dom`; `react-router-dom` is not used.
   `createDeferredRoutePatcher` owns import deduplication, declaration-order patching, abort safety,
   retryability, and code-only preload. `lazyWithRetry` owns bounded retry and one guarded reload
   for recognized browser chunk failures.

Both packages emit declarations and externalize host runtimes. Each declares a raw entry-size
budget, and the root `pnpm check:bundles` gate runs them after production library builds. The Spec
Kit `routing-performance` rule and extension own the shared code-prefetch, data-prefetch,
chunk-inspection, and measurement workflow.

Separately, `@craftkit/icons` reserves only an empty private package identity. It exposes metadata
but has no root runtime entry and adds no source, dependency, glyph, build, test, or Storybook
contract. Choosing an icon system is explicitly outside this decision.

This is a package-level decision. It does not select an application framework, app bundler, concrete
route tree, data transport, deployment runtime, or server rendering model.

## Consequences

### Positive

- Applications share one tested deferred-route contract without inheriting product ids or
  authorization logic.
- Concurrent navigation and intent prefetch reuse imports without mutating the router before
  navigation.
- Query cache ownership is explicit and safe for multiple roots and request-scoped SSR.
- Bundle growth fails with actual and allowed byte counts instead of relying on visual inspection.
- Claude, Codex, and Cursor receive the same performance workflow from Spec Kit source.

### Costs and risks

- Applications must wire both route-code and destination-data prefetch; the packages do not infer
  product queries.
- Raw package budgets do not replace application chunk analysis or runtime profiling.
- React Router or TanStack behavior changes require contract tests before catalog upgrades.
- The empty icon placeholder is intentionally unusable until a later approved scope.

## Alternatives considered

- **Copy Releaseo packages unchanged:** rejected because its QueryClient singleton, product guards,
  route ids, UI dependencies, and namespace are not CraftKit contracts.
- **Use only route-level `lazy`:** rejected because it does not provide deferred child-tree
  patching, code-only preload, or explicit concurrent/abort behavior.
- **Eagerly declare the complete route tree:** rejected because large future apps would pull branch
  discovery and imports into startup without measured benefit.
- **Rely on compressed size informally:** rejected because a deterministic raw-byte gate is easier
  to run in every local and CI verification; apps can add compressed budgets.

## Follow-up decisions

Each product app still requires a scoped plan for framework, router construction, rendering mode,
data transport, route pending UI, and deployment. App plans must identify their first route/query
prefetch sets and validate production chunks. An actual icon system or public package release
requires a separate decision.

## Staleness condition

Revisit this decision when React Router or TanStack Query changes the relevant public contracts, an
app proves the helper API cannot express its route tree, measured bundle output invalidates the
budgets, or the workspace adopts a framework whose native route/data lifecycle supersedes these
packages.
