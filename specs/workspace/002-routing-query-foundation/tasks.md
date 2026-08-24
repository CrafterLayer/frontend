# Tasks: Routing and Query Foundation

## Phase 1: Feature and dependency baseline

- [x] T001 Declare workspace scope, package ownership, contracts, rollback, and verification in `spec.md` and `plan.md`
- [x] T002 Verify React Router and TanStack Query stable releases against the 24-hour pnpm release-age policy
- [ ] T003 Add exact `react-router` and `@tanstack/react-query` entries to `pnpm-workspace.yaml`

## Phase 2: Query package

- [ ] T004 Create `packages/query/package.json`, TypeScript, ESLint, Vitest, and Vite library configuration
- [ ] T005 Implement caller-owned `createQueryClient` cache/default/error-callback behavior in `packages/query/src`
- [ ] T006 Implement explicit-client `QueryProvider` and the curated public entrypoint in `packages/query/src`
- [ ] T007 Add provider isolation, defaults, query error, and mutation error tests in `packages/query/src`
- [ ] T008 Document browser-root and per-request SSR lifecycle in `packages/query/README.md`

## Phase 3: Routing package

- [ ] T009 Create `packages/routing/package.json`, TypeScript, ESLint, Vitest, and Vite library configuration
- [ ] T010 Implement React Router v8 curated exports in `packages/routing/src/index.ts`
- [ ] T011 Implement the typed deferred route patcher with unique keys, ordered patches, concurrent load deduplication, abort safety, retry, and preload
- [ ] T012 Implement preloadable `lazyWithRetry` with bounded retries and one-time chunk reload recovery
- [ ] T013 Add real helper tests covering the routing acceptance and edge cases
- [ ] T014 Document stable tree, route ids, error mapping, intent prefetch, and migration from `react-router-dom` in `packages/routing/README.md`

## Phase 4: Bundle enforcement and governance

- [ ] T015 Add `scripts/check-bundle-size.mjs`, per-package budgets, Turbo task wiring, and the root aggregate command
- [ ] T016 Add `.specify/agents/rules/routing-performance.md` and route it from `.specify/agents/README.md`
- [ ] T017 Package `speckit.routing-performance` under `.specify/agents/extensions/routing-performance`
- [ ] T018 Reconcile the extension and Claude/Codex/Cursor generated skills through Spec Kit

## Phase 5: Architecture and continuity

- [ ] T019 Record the accepted decision in `docs/architecture/decisions/0002-select-routing-query-foundations.md`
- [ ] T020 Update architecture indexes and `docs/architecture/frontend.md` to describe the implemented package-level baseline
- [ ] T021 Refresh `.specify/agents/context.json`, `HANDOFF.md`, and durable `MEMORY.md` with verified current state

## Phase 6: Verification and review

- [ ] T022 Install with the security policy and update `pnpm-lock.yaml`
- [ ] T023 Run query and routing lint, typecheck, tests, coverage, builds, and bundle checks
- [ ] T024 Run workspace format, validators, boundaries, affected graph, aggregate verification, and `git diff --check`
- [ ] T025 Perform the required independent read-only review against the spec, plan, tasks, constitution, and package contracts
- [ ] T026 Fix every accepted finding, rerun affected checks, and mark all completed work accurately

## Dependencies

- T003 blocks both package manifests and lockfile generation.
- T004-T008 and T009-T014 are path-disjoint after the catalog versions are fixed.
- T015 depends on emitted package entry filenames.
- T018 depends on T016-T017 and must use the Spec Kit CLI.
- T019-T021 follow the final public contracts.
- T022-T026 are convergence gates and cannot be claimed from inspection.

