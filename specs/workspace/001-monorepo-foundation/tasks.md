# Tasks: Production Monorepo Foundation

**Input**: Design documents from `specs/workspace/001-monorepo-foundation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Mandatory. Workspace validators require positive and negative fixture tests; the UI
component requires behavior, interaction, browser, and accessibility evidence.

**Organization**: Tasks are grouped by user story and package ownership. Every task uses an exact
path or named verification deliverable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish deterministic root ownership before member implementation.

- [x] T001 Create the private root manifest, exact Node/pnpm/Turbo pins, and aggregate command
      surface in `package.json`, `.node-version`, and `.nvmrc`
- [x] T002 Configure direct member discovery, shared catalogs, dependency security, and cycle policy
      in `pnpm-workspace.yaml`
- [x] T003 Configure the framework-neutral build/test/lint/typecheck/Storybook task graph and cache
      contracts in `turbo.json`
- [x] T004 [P] Create repository-wide formatting and text policies in `prettier.config.mjs`,
      `.prettierignore`, `.editorconfig`, and `.gitattributes`
- [x] T005 [P] Add ownership/readme placeholders that are not workspace members in `apps/README.md`
      and `packages/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide real shared configuration APIs consumed by all later members.

**⚠️ CRITICAL**: No user-story implementation starts until these config contracts exist.

- [ ] T006 [P] Create and contract-test reusable JSON entrypoints in
      `packages/typescript-config/package.json`, `packages/typescript-config/*.json`, and
      `packages/typescript-config/test/exports.test.mjs`
- [ ] T007 [P] Create and contract-test ESLint flat-config entrypoints in
      `packages/eslint-config/package.json`, `packages/eslint-config/src/*.mjs`, and
      `packages/eslint-config/test/exports.test.mjs`
- [ ] T008 [P] Create and contract-test React/Vitest setup entrypoints in
      `packages/test-config/package.json`, `packages/test-config/src/`, and
      `packages/test-config/test/exports.test.mjs`
- [ ] T009 Wire the shared TypeScript and ESLint packages into root entrypoints in `tsconfig.json`
      and `eslint.config.mjs`
- [ ] T010 Add package ownership, supported entrypoints, and extension rules to
      `packages/typescript-config/README.md`, `packages/eslint-config/README.md`, and
      `packages/test-config/README.md`

**Checkpoint**: Reusable configuration has an intentional owner and importable public API.

---

## Phase 3: User Story 1 - Reproducible Workspace Bootstrap (Priority: P1) 🎯 MVP

**Goal**: A clean supported environment installs and runs one trustworthy root verification command
without hidden local setup.

**Independent Test**: Install using Node 24.19.0 and pnpm 11.23.0, run `pnpm verify`, then repeat
`pnpm install --frozen-lockfile` with no lockfile change.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add root manifest and toolchain contract tests in
      `packages/workspace-tools/test/root-contract.test.mjs`
- [ ] T012 [P] [US1] Add shared-config import smoke tests to
      `packages/typescript-config/test/exports.test.mjs`,
      `packages/eslint-config/test/exports.test.mjs`, and
      `packages/test-config/test/exports.test.mjs`

### Implementation for User Story 1

- [ ] T013 [US1] Implement root aggregate and package-scoped scripts in `package.json` and member
      `package.json` manifests
- [ ] T014 [US1] Generate and retain the deterministic dependency graph in `pnpm-lock.yaml` without
      creating a Git commit
- [ ] T015 [US1] Document exact prerequisites, installation, common root commands, and clean/frozen
      setup in `docs/development/workspace.md`
- [ ] T016 [US1] Validate clean installation and the root verification path from
      `specs/workspace/001-monorepo-foundation/quickstart.md`

**Checkpoint**: A contributor can bootstrap and invoke the complete root quality contract.

---

## Phase 4: User Story 2 - Safe App and Package Growth (Priority: P2)

**Goal**: Invalid package identities, workspace ranges, dependency direction, cycles, and public
surfaces fail through a stable repository-owned CLI.

**Independent Test**: Run the validator fixtures, then run the same validator against the real
repository and observe actionable negative failures plus a clean real-workspace pass.

### Tests for User Story 2

- [ ] T017 [P] [US2] Create positive and duplicate/missing-range fixture tests in
      `packages/workspace-tools/test/workspace-validation.test.mjs`
- [ ] T018 [US2] Create app-to-app, package-to-app, cycle, private-member, and export-surface
      fixture tests in `packages/workspace-tools/test/workspace-validation.test.mjs`

### Implementation for User Story 2

- [ ] T019 [US2] Implement direct workspace-member discovery and normalized manifest parsing in
      `packages/workspace-tools/src/workspace/discover-workspace.mjs`
- [ ] T020 [US2] Implement identity, privacy, workspace-range, direction, export, and cycle
      validation in `packages/workspace-tools/src/workspace/validate-workspace.mjs`
- [ ] T021 [US2] Expose the non-mutating workspace CLI and public module API in
      `packages/workspace-tools/src/cli/check-workspace.mjs`,
      `packages/workspace-tools/src/index.mjs`, and `packages/workspace-tools/package.json`
- [ ] T022 [US2] Add validator ownership, failure contract, member-creation checklist, and
      troubleshooting in `packages/workspace-tools/README.md`
- [ ] T023 [US2] Wire `check:workspace` and defense-in-depth Turbo Boundaries commands into
      `package.json` and verify both against the real graph

**Checkpoint**: Valid members pass and every prohibited dependency state has automated negative
evidence.

---

## Phase 5: User Story 3 - Complete Shared UI Contract (Priority: P2)

**Goal**: One real shared primitive proves implementation, public export, typed story, authored MDX,
behavior testing, browser interaction, and accessibility as one delivery unit.

**Independent Test**: Run UI tests/build and Storybook browser/static-build tasks, then run the
component validator against complete and incomplete fixtures.

### Tests for User Story 3

- [ ] T024 [P] [US3] Write accessible click, keyboard, disabled, loading, and ref behavior tests in
      `packages/ui/src/components/Button/Button.test.tsx`
- [ ] T025 [P] [US3] Add complete and missing-artifact component fixture tests in
      `packages/workspace-tools/test/component-validation.test.mjs`
- [ ] T026 [P] [US3] Define Storybook interaction and axe failure evidence in
      `packages/ui/src/components/Button/Button.stories.tsx` and
      `apps/storybook/.storybook/preview.ts`

### Implementation for User Story 3

- [ ] T027 [US3] Implement the single accessible component and local export in
      `packages/ui/src/components/Button/Button.tsx` and
      `packages/ui/src/components/Button/index.ts`
- [ ] T028 [US3] Implement component-owned styles with focus, variant, size, loading, full-width,
      reduced-motion, and logical-property behavior in
      `packages/ui/src/components/Button/Button.css`
- [ ] T029 [US3] Publish only intentional package entrypoints and configure build/types/tests in
      `packages/ui/package.json`, `packages/ui/src/index.ts`, `packages/ui/vite.config.ts`,
      `packages/ui/vitest.config.ts`, and `packages/ui/tsconfig*.json`
- [ ] T030 [US3] Complete typed CSF states and click play coverage in
      `packages/ui/src/components/Button/Button.stories.tsx`
- [ ] T031 [US3] Author purpose, usage, API, variants, accessibility, keyboard, responsive, RTL,
      theme, and limitation guidance in `packages/ui/src/components/Button/Button.docs.mdx`
- [ ] T032 [US3] Implement component-root discovery and five-artifact validation in
      `packages/workspace-tools/src/components/validate-components.mjs` and
      `packages/workspace-tools/src/cli/check-components.mjs`
- [ ] T033 [US3] Create the central React-Vite catalog and browser test project in
      `apps/storybook/package.json`, `apps/storybook/.storybook/`,
      `apps/storybook/vitest.config.ts`, and `apps/storybook/tsconfig.json`
- [ ] T034 [US3] Document the UI package API and Storybook catalog workflows in
      `packages/ui/README.md` and `apps/storybook/README.md`
- [ ] T035 [US3] Run UI lint/types/unit/build plus Storybook browser/static-build checks and verify
      the initial component is discoverable

**Checkpoint**: The initial component satisfies all five required artifacts and both fast and
real-browser evidence pass.

---

## Phase 6: User Story 4 - CI and Cache Confidence (Priority: P3)

**Goal**: Pull requests and main use the same aggregate gates while unchanged eligible work is
restored from cache and persistent tasks remain uncached.

**Independent Test**: Run the full graph twice and inspect Turbo results; validate the workflow
syntax and confirm it invokes the same frozen install plus `pnpm verify`.

### Tests for User Story 4

- [ ] T036 [P] [US4] Add task-graph contract assertions for outputs, persistence, and cache policy
      in `packages/workspace-tools/test/turbo-contract.test.mjs`
- [ ] T037 [P] [US4] Add dependency update grouping and pinned-toolchain policy in
      `.github/dependabot.yml`

### Implementation for User Story 4

- [ ] T038 [US4] Add least-privilege, concurrency-safe, frozen-install CI with Playwright Chromium
      and aggregate verification in `.github/workflows/ci.yml`
- [ ] T039 [US4] Document unit, component, story interaction, accessibility, integration, and build
      layers in `docs/testing/strategy.md`
- [ ] T040 [US4] Run `pnpm verify` twice and capture cache-hit and uncached-persistent-task evidence
      in the feature verification section of `specs/workspace/001-monorepo-foundation/quickstart.md`

**Checkpoint**: CI configuration and local execution share one command contract, and cache behavior
is measured rather than assumed.

---

## Phase 7: Polish and Delivery Gates

**Purpose**: Align governance and documentation, then independently review and converge.

- [ ] T041 [P] Replace undecided workspace-tooling language with the implemented pnpm/Turbo graph,
      boundaries, cache, and member rules in `docs/architecture/README.md` and
      `docs/architecture/monorepo.md`
- [ ] T042 [P] Link the accepted ADR and new workspace/testing guides from
      `docs/architecture/decisions/README.md`, `docs/development/README.md`,
      `docs/testing/README.md`, and `docs/README.md`
- [ ] T043 Update the enforceable monorepo commands and selected-tool status in
      `.specify/agents/rules/monorepo.md` and `.specify/agents/context.json`
- [ ] T044 Run `pnpm install --frozen-lockfile`, `pnpm verify`, `git diff --check`, and the
      quickstart scenarios, reporting any unavailable hosted CI evidence
- [ ] T045 Perform an independent read-only implementation review against `spec.md`, `plan.md`,
      `tasks.md`, the constitution, and component/workspace contracts
- [ ] T046 Fix every accepted review finding in its owning path and rerun the narrow plus aggregate
      checks
- [ ] T047 Run `speckit.converge`, append any genuine remaining work to this file, implement it, and
      repeat the final review when needed
- [ ] T048 Refresh `.specify/agents/context.json`, `.specify/agents/HANDOFF.md`, and durable
      decisions in `.specify/agents/MEMORY.md` through the workspace handoff workflow
- [ ] T049 Generate (without committing) a Conventional Commit proposal from the verified relevant
      diff using `.specify/agents/templates/commit-message.txt`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundational (Phase 2)** depends on Setup and blocks user-story implementation.
- **US1 (Phase 3)** depends on Foundational and establishes install/command ownership.
- **US2 (Phase 4)** depends on the root member model from US1.
- **US3 (Phase 5)** depends on config packages plus the component validator surface from US2, but
  its UI and Storybook files are path-disjoint from validator implementation.
- **US4 (Phase 6)** depends on all real member tasks and outputs being present.
- **Delivery (Phase 7)** depends on all selected stories and verification paths.

### User Story Dependencies

- **US1**: No story dependency after Foundational.
- **US2**: Uses the root workspace shape from US1.
- **US3**: Uses shared configs from Foundational and CLI packaging from US2; its component artifacts
  can be developed in parallel with the component validator fixtures.
- **US4**: Requires the completed real graph from US1-US3 to make cache evidence meaningful.

### Parallel Opportunities

- T004-T008 are path-disjoint.
- T017 and T018 share one test file and therefore must be assigned to one owner despite their
  conceptual independence; UI tasks T024/T026 can run in parallel with T025.
- Root/CI/docs ownership, `packages/workspace-tools`, and `packages/ui` plus `apps/storybook` are
  safe separate implementation scopes after interfaces are fixed.
- T041 and T042 are path-disjoint; review (T045) remains read-only.

## Parallel Example: User Story 3

```text
Owner A: T024, T026-T031, T033-T035 in packages/ui and apps/storybook
Owner B: T025 and T032 in packages/workspace-tools
Primary agent: integrate package manifests, run both narrow suites, then run Storybook
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundational configuration.
2. Complete US1 and prove clean root bootstrap.
3. Stop if the workspace cannot install deterministically; later members must not mask a
   package-manager or task-graph failure.

### Incremental delivery

1. Add the stable workspace validator and prove invalid graphs fail.
2. Add the real UI package and catalog as one complete component contract.
3. Add hosted CI configuration only after every local task exists.
4. Review, repair, converge, refresh handoff, and only then propose a commit message.

## Format Validation

All 49 tasks use the required checkbox, sequential `T###` ID, optional `[P]`, user-story label only
inside story phases, and an exact path or named verification deliverable.
