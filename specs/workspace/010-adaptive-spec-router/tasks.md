# Tasks: Adaptive Spec Router

**Input**: Design documents from `specs/workspace/010-adaptive-spec-router/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and
`contracts/local-demo-contract.md`

**Tests**: Mandatory. The feature is a local interaction product; pure policy and every UI component
require behavior evidence.

**Organization**: Tasks are grouped by user story, with full React component contracts represented
explicitly.

## Phase 1: Application and architecture setup

**Purpose**: Establish the isolated private app without disturbing the existing builder playground
or B3c work.

- [x] T001 Create `apps/adaptive-spec-router/package.json`, `tsconfig.json`, `vite.config.ts`,
      `vitest.config.ts`, `index.html`, `src/main.tsx`, and `src/styles.css` using only existing
      workspace catalog/tooling dependencies.
- [x] T002 Create `apps/adaptive-spec-router/README.md` with local start, test, build, boundary, and
      no-publication instructions.
- [x] T003 Create `docs/architecture/decisions/0005-adaptive-spec-router-local-demo.md` and update
      `docs/architecture/README.md` plus `docs/architecture/decisions/README.md` to record the
      private Vite React/no-deployment decision.

**Checkpoint**: The new app is independently addressable by the package manager and no existing
application is imported.

---

## Phase 2: Deterministic routing foundation

**Purpose**: Define the typed local model and pure policy that all product surfaces consume.

- [x] T004 Create `apps/adaptive-spec-router/src/features/adaptive-router/model/types.ts` for
      scenarios, route decisions, plan reviews, run stages, writer leases, and evidence records.
- [x] T005 Create `apps/adaptive-spec-router/src/features/adaptive-router/model/demo-data.ts` and
      `routing-policy.ts` with a deterministic initial scenario, explicit
      Codex-native/Claude-adaptive directionality, provider/model availability-aware fallback,
      single-writer route rule, and plan-review freshness derivation.
- [x] T006 Create
      `apps/adaptive-spec-router/src/features/adaptive-router/model/routing-policy.test.ts` covering
      normal, critical, unavailable-provider, and insufficient-context decisions plus stale plan
      reviews.
- [x] T007 Create `apps/adaptive-spec-router/src/features/adaptive-router/AdaptiveSpecRouter.css`
      with semantic command-center tokens, responsive grids, visible focus, reduced-motion support,
      and non-colour-only state styling.

**Checkpoint**: The local product has a testable policy seam and no model or network transport.

---

## Phase 3: User Story 1 - Explain a single-writer route (Priority: P1) 🎯 MVP

**Goal**: Let a developer create a local task scenario and understand the exact writer/reviewer
decision.

**Independent Test**: Submit normal and critical scenarios and inspect the changed route, safety
lane, fallback, and one-writer rule.

- [x] T008 [US1] Create the complete `ScenarioComposer` component contract under
      `apps/adaptive-spec-router/src/features/adaptive-router/components/ScenarioComposer/`
      (implementation, export, typed story, MDX docs, and behavior test) for
      entry-mode/brief/class/risk input, validation, and apply action.
- [x] T009 [US1] Create the complete `RouteDecisionPanel` component contract under
      `apps/adaptive-spec-router/src/features/adaptive-router/components/RouteDecisionPanel/`
      (implementation, export, typed story, MDX docs, and behavior test) for rationale, fallback,
      directional provider boundary, safety lane, and one-writer ownership.
- [x] T010 [US1] Create the complete `AdaptiveSpecRouter` composition-root contract under
      `apps/adaptive-spec-router/src/features/adaptive-router/components/AdaptiveSpecRouter/`
      (implementation, export, typed story, MDX docs, and behavior test) that connects local
      scenario state to the pure route policy and demo boundary.
- [x] T011 [US1] Create thin `apps/adaptive-spec-router/src/app/App.tsx` and `App.test.tsx`, and
      feature `index.ts`, composing the product root without business logic.

**Checkpoint**: A valid task produces exactly one explainable writer/reviewer route and an invalid
brief cannot pretend it has one.

---

## Phase 4: User Story 2 - Audit two independent plan reviews (Priority: P1)

**Goal**: Make revision-aligned dual review and invalidation visually and behaviorally explicit.

**Independent Test**: Mark a plan as materially revised and confirm that prior Claude/Codex review
records become stale and no ready verdict survives.

- [x] T012 [US2] Create the complete `PlanReviewAudit` component contract under
      `apps/adaptive-spec-router/src/features/adaptive-router/components/PlanReviewAudit/`
      (implementation, export, typed story, MDX docs, and behavior test) for two reviewer records,
      freshness, typed findings, blocked changes-requested state, and material-revision
      invalidation.
- [x] T013 [US2] Integrate `PlanReviewAudit` into `AdaptiveSpecRouter` and extend its behavior test
      to prove revision-gated readiness.

**Checkpoint**: Review identity, plan revision, freshness, and the next required review action are
all visible.

---

## Phase 5: User Story 3 - Make execution evidence inspectable (Priority: P2)

**Goal**: Show the illustrative run timeline, single-writer lease, evidence ledger, and release gate
without claiming live execution.

**Independent Test**: Open an example run and identify the active writer scope, a gate outcome, and
source/result of every evidence item.

- [x] T014 [US3] Create the complete `EvidenceConsole` component contract under
      `apps/adaptive-spec-router/src/features/adaptive-router/components/EvidenceConsole/`
      (implementation, export, typed story, MDX docs, and behavior test) for timeline, writer lease,
      evidence rows, and release-gate state.
- [x] T015 [US3] Integrate `EvidenceConsole` into `AdaptiveSpecRouter` with explicit
      illustrative-state copy and coverage for blocked or waiting gates.

**Checkpoint**: The dashboard exposes the execution safety model rather than hiding it in
documentation.

---

## Phase 6: User Story 4 - Run and reset locally (Priority: P2)

**Goal**: Make the product trial self-contained, safely resettable, and usable across viewport and
input modes.

**Independent Test**: Alter a scenario, simulate a plan revision, reset, and confirm the initial
example returns without a provider or repository action.

- [x] T016 [US4] Add a reset control and feature behavior coverage that restores the initial
      deterministic scenario, plan audit, and evidence state.
- [x] T017 [US4] Add component test coverage for keyboard-labelled controls and primary status text,
      including unavailable route and narrow-layout-safe state semantics.
- [x] T018 [US4] Add component story variants for critical route, unavailable fallback, stale
      reviews, blocked evidence, and responsive constraints where the public component API permits
      them.

**Checkpoint**: The whole product can be evaluated locally without credentials or side effects.

---

## Phase 7: Integration, validation, and product evidence

**Purpose**: Enforce the product boundary, component completeness, browser truth, and Spec Kit
delivery gates.

- [x] T019 Update `apps/storybook/.storybook/main.ts` to catalogue the new app's stories and MDX
      docs, then update `docs/architecture/overview.md` if needed to show the checked-in private
      product app; re-read all new documentation for no-publish/no-live-provider accuracy.
- [x] T020 Run focused app lint, typecheck, unit/component tests, build, workspace component
      validation, Storybook build, and `git diff --check`; record real results in this task file.
  - Evidence (2026-08-27): app lint and typecheck passed; Vitest passed 31 tests in 7 files; Vite
    production build passed (66.55 kB gzip JavaScript); direct Storybook build passed; component,
    workspace, and dependency-boundary validators passed; `git diff --check` passed.
- [ ] T021 Browser-smoke the local app at 375px and 1440px, covering route application, plan review
      invalidation, and reset; record the evidence in this task file.
  - Pending: the current in-app browser automation is unavailable. A local Vite HTTP smoke passed,
    but it is not a substitute for the required 375px and 1440px interaction check.
- [x] T022 Run `$speckit-analyze`, repair all material cross-artifact issues, then re-run analysis.
  - Outcome (2026-08-27): the 12 functional requirements and 6 success criteria map to the
    implemented model, components, tests, and verification gates. No material artifact conflict or
    unimplemented product gap remains; T021 is retained as an environment-limited visual check.
- [x] T023 Run `$speckit-workspace-review`, repair accepted findings with focused tests, and record
      the final review outcome.
  - Outcome (2026-08-27): independent routing and governance reviews confirmed the one-way topology
    and found no remaining functional defect after repairs. Accepted findings covered inactive
    writer leases, typed review findings, invalid-route/reset behavior, visible model fallback, and
    release gating; the final release-gate repair is covered by the 31-test focused suite.
- [x] T024 Run `$speckit-converge`; if it appends tasks, implement them and repeat convergence until
      no actionable gaps remain.
  - Outcome (2026-08-27): convergence found no actionable implementation work to append. The only
    outstanding item is the manual browser evidence in T021.
- [x] T025 Run `$speckit-workspace-handoff` with exact continuation state; do not generate a commit,
      push, deploy, or publish.
  - Outcome (2026-08-27): updated `.specify/agents/context.json` and `HANDOFF.md` to make T021 the
    exact next action and to preserve the separate B3c and Claude-to-Codex migration work as
    out-of-scope context. No commit, push, deployment, or publication was generated.

## Dependencies and execution order

```text
T001 -> T002 -> T003 -> T004 -> (T005 || T007) -> T006 ->
T008 -> T009 -> T010 -> T011 -> T012 -> T013 -> T014 -> T015 ->
T016 -> T017 -> T018 -> T019 -> T020 -> T021 -> T022 -> T023 -> T024 -> T025
```

`T005` and `T007` are independent after types exist. All other tasks are deliberately serial because
the composition root owns the shared local state. No task is delegated in this implementation: the
product is isolated but the dashboard, its model, and its validation share the same narrow app
scope.

## Implementation strategy

Deliver the P1 route decision and plan audit first, then add the evidence console and reset path.
The app has no deployment target or provider integration; a build or browser check validates a local
trial only. Every new UI component is complete only with its local export, typed Storybook story,
MDX docs, and behavior test.
