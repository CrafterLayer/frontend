# Feature Specification: Routing and Query Foundation

**Feature Branch**: `main`

**Created**: 2026-08-24

**Status**: Approved

**Input**: Move the proven routing and query package patterns from the Releaseo frontend
into CraftKit, upgrade React Router and TanStack Query to the newest versions allowed by
the workspace security policy, preserve professional `patchRoutesOnNavigation` behavior,
and add reusable lazy-loading and bundle-size guidance through Spec Kit.

## User Scenarios & Testing

### User Story 1 - Shared Query Runtime (Priority: P1)

As an application owner, I can create an isolated TanStack Query client and mount it
through one shared provider without leaking cache or configuration between browser roots
or server requests.

**Independent Test**: Create two clients with different defaults and prove each provider
uses only the client supplied by its caller.

**Acceptance Scenarios**:

1. **Given** application-owned query defaults, **When** a client is created, **Then** the
   defaults and query/mutation error callbacks are installed on that client.
2. **Given** two render or request boundaries, **When** each creates its own client,
   **Then** neither cache nor options are shared through module-global state.
3. **Given** an application imports query primitives, **When** it uses the package public
   entrypoint, **Then** supported TanStack Query APIs and types remain available without a
   deep import.

---

### User Story 2 - Deferred Route Patching (Priority: P1)

As an application owner, I can keep the initial route tree small and load deferred route
branches only when navigation or user intent reaches them.

**Independent Test**: Navigate concurrently to matching deferred paths and prove the
module loads once, patches in declaration order, respects aborts, and retries after a
failed load.

**Acceptance Scenarios**:

1. **Given** stable parent routes with explicit ids, **When** navigation matches a deferred
   branch, **Then** the branch module is dynamically imported and patched below its owner.
2. **Given** concurrent matching navigations, **When** both request the same branch,
   **Then** one in-flight import is shared and a successful branch is patched only once.
3. **Given** an aborted navigation, **When** its import completes, **Then** no stale patch is
   applied for that aborted request.
4. **Given** a failed import, **When** a later matching navigation occurs, **Then** the
   branch can load again instead of remaining permanently poisoned.
5. **Given** pointer, touch, or keyboard intent, **When** an application calls preload,
   **Then** route code is warmed without mutating the router before navigation.

---

### User Story 3 - Controlled Bundle Growth (Priority: P2)

As a maintainer, I receive deterministic guidance and automated limits that keep shared
routing/query wrappers small and stop heavy route code from returning to the initial
bundle unnoticed.

**Independent Test**: Build both packages, run their size checks, and deliberately set a
budget below the emitted artifact to prove the checker fails with actual and allowed
byte counts.

**Acceptance Scenarios**:

1. **Given** a production library build, **When** it completes, **Then** React, React Router,
   and TanStack Query stay external and do not get bundled into the wrappers.
2. **Given** an emitted entry larger than its declared budget, **When** `check:size` runs,
   **Then** verification fails with an actionable message.
3. **Given** an agent changes routes, queries, or lazy boundaries, **When** it follows the
   Spec Kit rule/command, **Then** it checks code prefetch, data prefetch, chunk ownership,
   and measured bundle output.

### Edge Cases

- Two deferred route definitions accidentally reuse the same patch key.
- A path matches more than one deferred branch.
- A loader succeeds after its initiating navigation has been aborted.
- A chunk failure occurs during SSR where browser reload APIs are unavailable.
- Storage is unavailable or throws while recording a one-time chunk reload.
- A package build emits a missing, empty, or renamed entry file.

## Requirements

### Functional Requirements

- **FR-001**: The workspace MUST provide private `@craftkit/query` and
  `@craftkit/routing` packages with explicit public exports.
- **FR-002**: Shared external dependency versions MUST use exact root catalog entries.
- **FR-003**: TanStack Query MUST use the newest stable version older than the configured
  24-hour minimum release age at installation time.
- **FR-004**: React Router MUST use the newest stable v8 version compatible with the
  pinned Node and React baselines.
- **FR-005**: Query clients MUST be caller-owned; the package MUST NOT export or retain a
  module-global client singleton.
- **FR-006**: The query factory MUST support query and mutation error callbacks and caller
  default options.
- **FR-007**: Deferred route patches MUST have unique keys, explicit owner route ids,
  match predicates, dynamic child loaders, and optional navigation guards.
- **FR-008**: Matching imports MUST deduplicate while in flight, patch at most once after
  success, remain retryable after failure, and never patch an aborted navigation.
- **FR-009**: The routing package MUST provide preloadable lazy components and deferred
  route code preloading for user-intent hooks.
- **FR-010**: Chunk-load recovery MUST be browser-safe, retry transient failures, reload
  only recognized chunk failures, and prevent reload loops.
- **FR-011**: Package builds MUST externalize peer runtimes and emit ESM plus declarations.
- **FR-012**: Each new package MUST enforce a raw entry-size budget through an executable
  workspace check.
- **FR-013**: Spec Kit MUST own one task-routed performance rule and one generated command
  source covering lazy routes, query prefetch, and bundle measurement.
- **FR-014**: Architecture documentation MUST record the accepted package boundaries,
  version policy, migration from `react-router-dom`, and SSR isolation contract.

### Key Entities

- **Query client factory**: Creates one caller-owned QueryClient with defaults and cache
  callbacks.
- **Deferred route patch**: A unique key, owning route id, path match, optional guard, and
  asynchronous child-route loader.
- **Deferred route patcher**: Coordinates load deduplication, preloading, ordered patching,
  abort safety, and once-only application.
- **Preloadable lazy component**: A React lazy component whose module import can be warmed
  from user intent.
- **Bundle budget**: The maximum raw bytes accepted for one built package entry.

## Success Criteria

- **SC-001**: Both package test suites, typechecks, lint tasks, and builds pass.
- **SC-002**: Route-patching tests cover matching, ordering, concurrency, abort, retry,
  duplicate keys, and preload reuse without a duplicate import.
- **SC-003**: Query tests prove explicit client ownership and isolated defaults/caches.
- **SC-004**: Production package entries pass declared budgets and omit peer-runtime code.
- **SC-005**: Workspace validation, boundaries, format, and diff checks pass for the
  affected graph.
- **SC-006**: Claude, Codex, and Cursor receive the same generated routing-performance
  command after Spec Kit reconciliation.

## Assumptions and Scope

- This is workspace infrastructure, not a product-application framework selection.
- No CraftKit application currently consumes these packages, so there is no app migration
  in this feature.
- Releaseo remains a read-only reference; product-specific guards, route ids, error UI,
  MUI, notifications, and application routes are not copied.
- The package APIs are private workspace contracts and can evolve through explicit plans.

