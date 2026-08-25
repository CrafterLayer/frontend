# Tasks: Routing and Query Foundation

## Phase 1: Feature and dependency baseline

- [x] T001 Declare workspace scope, package ownership, contracts, rollback, and verification in
      `spec.md` and `plan.md`
- [x] T002 Verify React Router and TanStack Query stable releases against the 24-hour pnpm
      release-age policy
- [x] T003 Add exact `react-router` and `@tanstack/react-query` entries to `pnpm-workspace.yaml`

## Phase 2: Query package

- [x] T004 Create `packages/query/package.json`, TypeScript, ESLint, Vitest, and Vite library
      configuration
- [x] T005 Implement caller-owned `createQueryClient` cache/default/error-callback behavior in
      `packages/query/src`
- [x] T006 Implement explicit-client `QueryProvider` and the curated public entrypoint in
      `packages/query/src`
- [x] T007 Add provider isolation, defaults, query error, and mutation error tests in
      `packages/query/src`
- [x] T008 Document browser-root and per-request SSR lifecycle in `packages/query/README.md`

## Phase 3: Routing package

- [x] T009 Create `packages/routing/package.json`, TypeScript, ESLint, Vitest, and Vite library
      configuration
- [x] T010 Implement React Router v8 curated exports in `packages/routing/src/index.ts`
- [x] T011 Implement the typed deferred route patcher with unique keys, ordered patches, concurrent
      load deduplication, abort safety, retry, and preload
- [x] T012 Implement preloadable `lazyWithRetry` with bounded retries and one-time chunk reload
      recovery
- [x] T013 Add real helper tests covering the routing acceptance and edge cases
- [x] T014 Document stable tree, route ids, error mapping, intent prefetch, and migration from
      `react-router-dom` in `packages/routing/README.md`

## Phase 4: Empty icon placeholder

- [x] T015 Create only the private, metadata-only `@craftkit/icons` package identity, with no root
      entry, source, dependencies, glyphs, build/test tasks, or Storybook wiring

## Phase 5: Bundle enforcement and governance

- [x] T016 Add `scripts/check-bundle-size.mjs`, per-package budgets, Turbo task wiring, and the root
      aggregate command
- [x] T017 Add `.specify/agents/rules/routing-performance.md` and route it from
      `.specify/agents/README.md`
- [x] T018 Package `speckit.routing-performance.optimize` under
      `.specify/agents/extensions/routing-performance`
- [x] T019 Reconcile the extension and Claude/Codex/Cursor generated skills through Spec Kit

## Phase 6: Architecture and continuity

- [x] T020 Record the accepted decision in
      `docs/architecture/decisions/0002-select-routing-query-foundations.md`
- [x] T021 Update architecture indexes and `docs/architecture/frontend.md` to describe the
      implemented package-level baseline
- [x] T022 Refresh `.specify/agents/context.json`, `HANDOFF.md`, and durable `MEMORY.md` with
      verified current state

## Phase 7: Verification and review

- [ ] T023 Install with the security policy and update `pnpm-lock.yaml`
- [x] T024 Run query and routing lint, typecheck, tests, coverage, builds, and bundle checks
- [ ] T025 Run workspace format, validators, boundaries, affected graph, aggregate verification, and
      `git diff --check`
- [x] T026 Perform the required independent read-only review against the spec, plan, tasks,
      constitution, and package contracts
- [x] T027 Fix every accepted finding, rerun affected checks, and mark all completed work accurately

## Dependencies

- T003 blocks both package manifests and lockfile generation.
- T004-T008 and T009-T014 are path-disjoint after the catalog versions are fixed.
- T015 is path-disjoint from query/routing source and introduces no dependency graph.
- T016 depends on emitted package entry filenames.
- T019 depends on T017-T018 and must use the Spec Kit CLI.
- T020-T022 follow the final public contracts.
- T023-T027 are convergence gates and cannot be claimed from inspection.

## Open convergence blocker

T023 and the aggregate part of T025 remain open because ordinary pnpm/Turbo commands are rejected by
the existing `trustPolicy: no-downgrade` rule for transitive `semver@6.3.1`. Persisting the exact
exception requires explicit approval. After that, unchanged baseline Storybook/UI lint, coverage,
and indexing failures still require a separately authorized stabilization scope. The
package-specific checks in T024 and the accepted-finding reruns in T027 passed directly.
