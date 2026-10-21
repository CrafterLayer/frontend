# Tasks: Professional Builder and Agent

## Screen design freedom — 2026-10-21

Acceptance: [SF1–SF5](screen-design-freedom-2026-10-21.md).

- [x] T326 Audit active fixed-style guidance and remove contradictory design recipes/quotas.
- [x] T327 Let explicit redesign change composition while keeping narrow edits targeted.
- [x] T328 Align planner/writer/source guidance and descriptions around task-led varied screens.
- [x] T329 Admit verified additional fonts for bespoke composition with focused validation tests.
- [x] T330 Verify, independently review, repair, converge and refresh shared continuity.

## Researched page design libraries — 2026-10-21

Acceptance: [DL1–DL5](design-libraries-2026-10-21.md).

- [x] T321 Research official libraries, compatibility, license and existing runtime fit.
- [x] T322 Install exact owned dependencies and admit bounded Base UI modules to managed pages.
- [x] T323 Wire semantic Radix palette selection into measured theme tooling.
- [x] T324 Teach actual APIs and verify real generated-page/export behavior and consumer gates.
- [x] T325 Review independently, repair, converge and refresh shared continuity.

## Design freedom and failed-request recovery — 2026-10-21

Acceptance: [DR1–DR5](design-recovery-2026-10-21.md).

- [x] T316 Repair demonstrated planner output recovery; verify sequential controller recovery and
      record the unconfirmed original Stop trace.
- [x] T317 Remove fixed chrome/composition authority from ordinary edit skills.
- [x] T318 Preserve custom report design instructions through deterministic routing.
- [x] T319 Install and wire bounded Open Props design material into real agent contexts.
- [x] T320 Verify, independently review, repair, converge and refresh continuity.

## Professional free page design — 2026-10-20

Acceptance: [FD1–FD5](free-design-2026-10-20.md). Local completion on 2026-10-21:
[verification](verification-free-design-2026-10-21.md).

- [x] T310 Research comparable agents and verify design/skill bottlenecks.
- [x] T311 Preserve explicit skills, resolve Pro Max aliases and modernize CV guidance.
- [x] T312 Add persisted free-design contracts, validation and streamed writer propagation.
- [x] T313 Align server structured output and page-design instructions with the real contract.
- [x] T314 Verify focused regressions, consumers, builds and browser-visible varied compositions.
- [x] T315 Review independently, repair, converge and refresh handoff.

## Professional reports and charts — 2026-10-20

Acceptance and ownership: [RP1–RP7](report-capabilities-2026-10-20.md).

- [x] T303 Research primary chart/report patterns and establish deterministic contracts.
- [x] T304 Implement nine additional chart families with schema, rendering and complete UI
      artifacts.
- [x] T305 Strengthen Stats/Report cards with trends, comparisons, targets and summary measures.
- [x] T306 Connect every chart family to validated data tools and agent skills/request routing.
- [x] T307 Add detailed report presentations/chart selection and compact report updates by ID.
- [x] T308 Verify owners/consumers, Storybook, app builds and browser-visible examples across
      domains.
- [x] T309 Review independently, repair, converge and update shared handoff.

## Second-prompt execution and reports — 2026-10-20

Acceptance and scope: [Q1–Q5](second-prompt-reports-2026-10-20.md).

- [x] T298 Research primary GitHub patterns and reproduce second-request/report failures.
- [x] T299 Repair queued request ownership and active-predecessor continuation.
- [x] T300 Ground conversation history in actual execution outcomes.
- [x] T301 Repair chronological, unit-compatible and paired report calculations and quality notes.
- [x] T302 Verify affected owners/consumers, review independently, repair and hand off.

## Creative follow-up editing — 2026-10-20

Acceptance and scope: [F1–F5](creative-followup-2026-10-20.md).

- [x] T293 Reproduce edit/create and existing-target continuity failures.
- [x] T294 Repair grounded follow-up routing/target selection without breaking explicit creation.
- [x] T295 Ensure current source reaches the edit writer and repair demonstrated replacement paths.
- [x] T296 Verify actual same-target updates, preserved content/undo and owner/consumer checks.
- [x] T297 Independent review, convergence, evidence and final handoff.

## Scroll mural and build follow-up — 2026-10-20

Acceptance and scope: [S1–S5](mural-scroll-2026-10-20.md).

- [x] T288 Reproduce scroll mural visibility failure and implement bounded narrative scroll
      layout/progress with native page scrolling, nested containers and lifecycle cleanup.
- [x] T289 Connect compact mural composition/presets and creative guidance to the supported scroll
      contract; preserve ordinary scenes, editor and reduced-motion behavior.
- [x] T290 Audit adjacent agent/build paths and repair concrete reproducible gaps.
- [x] T291 Verify first/final scene visibility, reverse scrolling, phone/RTL, resize and cleanup
      with real runtime browser fixtures; run owner/consumer checks and regenerate affected assets.
- [x] T292 Review independently, converge against S1–S5, record evidence and refresh handoff.

## Current incident continuation — 2026-10-20

Acceptance and ownership: [creative agent reliability](reliability-2026-10-20.md).

- [x] T282 Research official implementations and record evidence-backed recommendations and limits.
- [x] T283 Apply independent validated sections as ready, preserving ordered reports and Stop.
- [x] T284 Bound repeated work and prevent terminal provider refusals from triggering futile
      retries.
- [x] T285 Route short creative requests and choose skills automatically, including `اصنع لعبه`;
      initialize existing game/story kits locally within the owned build region (R3/R5).
- [x] T286 Preserve bounded actionable server errors across the remote provider boundary.
- [x] T287 Verify reproductions, owner/consumer contracts, review independently and update handoff.

Local evidence and limits: [verification](verification-reliability-2026-10-20.md).

Current scoped speed tasks SP-T1..5:
[scene initialization and server latency](scene-speed-2026-10-13.md#tasks).

**Input**: Design documents from `specs/workspace/014-professional-builder-agent/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Tests are mandatory for this workspace. Each new UI component has implementation/export,
Storybook, MDX, behavior/accessibility test, and owner/consumer verification tasks.

## Phase 1: Setup

- [ ] T001 Register `@craftkit/builder-code-runtime` as a layer-2 member in
      `packages/workspace-tools/src/workspace/validate-builder-boundaries.mjs`
- [ ] T002 Add workspace-boundary fixtures for the runtime browser/compiler split in
      `packages/workspace-tools/test/builder-boundaries.test.mjs`
- [ ] T003 Add approved compiler/editor dependency versions and create the runtime package manifest
      and export map in `pnpm-workspace.yaml` and `packages/builder/code-runtime/package.json`
- [ ] T004 [P] Create runtime TypeScript, Vitest, and lint configuration in
      `packages/builder/code-runtime/tsconfig.json`,
      `packages/builder/code-runtime/vitest.config.ts`, and
      `packages/builder/code-runtime/eslint.config.mjs`
- [ ] T005 Create the isolated preview application manifest, HTML entry, and scripts in
      `apps/code-preview/package.json` and `apps/code-preview/index.html`
- [ ] T006 [P] Create preview application TypeScript and Vite configuration in
      `apps/code-preview/tsconfig.json` and `apps/code-preview/vite.config.ts`

---

## Phase 2: Foundational contracts and transactions

**Goal**: Establish the versioned project, source identity, preview bridge, transaction, and
persistence contracts that every story uses.

- [ ] T007 Add v2 code project, code page, runtime profile, dependency lock, and file schemas in
      `packages/builder/schema/src/code/types.ts`
- [ ] T008 [P] Add source handle, selection target, insertion anchor, and capability schemas in
      `packages/builder/schema/src/editing/types.ts`
- [ ] T009 [P] Add managed catalog, build artifact, export manifest, and compile diagnostic schemas
      in `packages/builder/schema/src/runtime/types.ts`
- [ ] T010 [P] Add run record, usage, model policy, cancellation, and persistence acknowledgement
      schemas in `packages/builder/schema/src/agent/types.ts`
- [ ] T011 Add v1-to-v2 site migration with empty `codeProjects` and future-version rejection in
      `packages/builder/schema/src/site/migrations.ts`
- [ ] T012 Add structural validators for code projects, page references, unique addresses, one home
      page, file paths, and managed dependencies in `packages/builder/schema/src/site/validate.ts`
- [ ] T013 Export the new contracts through `packages/builder/schema/src/code/index.ts`,
      `packages/builder/schema/src/editing/index.ts`,
      `packages/builder/schema/src/runtime/index.ts`, `packages/builder/schema/src/agent/index.ts`,
      and `packages/builder/schema/src/index.ts`
- [ ] T014 [P] Add migration, validation, and serialization tests in
      `packages/builder/schema/src/site/migrations.test.ts` and
      `packages/builder/schema/src/site/validate.test.ts`
- [ ] T015 Add CAS-protected code-file and multi-file transaction commands in
      `packages/builder/core/src/commands/code-project-commands.ts`
- [ ] T016 Add atomic page create, rename, address, duplicate, reorder, make-home, clear, delete,
      and stable-link commands in `packages/builder/core/src/commands/page-commands.ts`
- [ ] T017 Route new writes through the single site dispatcher and one undo boundary in
      `packages/builder/core/src/site/site-dispatcher.ts`
- [ ] T018 Export new commands and transaction results in `packages/builder/core/src/index.ts`
- [ ] T019 [P] Add conflict, expected-absence, disjoint-merge, page invariant, and undo tests in
      `packages/builder/core/src/commands/code-project-commands.test.ts` and
      `packages/builder/core/src/commands/page-commands.test.ts`
- [x] T020 Add feature flags for v2 authoring, source-aware editing, remote generation, and export
      in `apps/playground/src/features/preview/feature-flags.ts`

**Checkpoint**: Schema, migration, and kernel writes are stable enough for independent story work.

---

## Phase 3: User Story 1 — Free-form page vertical slice (P1)

**Goal**: Generate or create one TSX page, preview it, select and edit one nested element, undo,
save, reload, and export a revision-matching standalone page.

**Independent Test**: Follow the M0 flow in `quickstart.md`; source, selected target, preview,
restored project, and export must remain revision-aligned.

- [ ] T021 [P] [US1] Define runtime snapshot, compiler, browser, export, catalog, cache, and
      cancellation ports in `packages/builder/code-runtime/src/contracts.ts`
- [ ] T022 [P] [US1] Implement canonical project and artifact fingerprints in
      `packages/builder/code-runtime/src/fingerprint.ts`
- [ ] T023 [US1] Implement managed virtual-module resolution with path and dependency rejection in
      `packages/builder/code-runtime/src/compiler/resolve-project.ts`
- [ ] T024 [US1] Implement source instrumentation and stable AST element metadata in
      `packages/builder/code-runtime/src/compiler/instrument-source.ts`
- [ ] T025 [US1] Implement cancellable project compilation and diagnostic/source-map output in
      `packages/builder/code-runtime/src/compiler/compile-project.ts`
- [ ] T026 [P] [US1] Implement content-addressed build cache behavior in
      `packages/builder/code-runtime/src/cache/build-cache.ts`
- [ ] T027 [US1] Implement revision-pinned single-page export with indexable HTML, CSS, assets, and
      hydration entry in `packages/builder/code-runtime/src/export/export-site.ts`
- [ ] T028 [US1] Implement validated preview protocol and session lifecycle in
      `packages/builder/code-runtime/src/browser/mount-preview.ts`
- [ ] T029 [US1] Publish root, compiler, browser, and export public entrypoints in
      `packages/builder/code-runtime/src/index.ts`, `packages/builder/code-runtime/src/compiler.ts`,
      `packages/builder/code-runtime/src/browser.ts`, and
      `packages/builder/code-runtime/src/export.ts`
- [ ] T030 [P] [US1] Add runtime resolver, cancellation, fingerprint, stale-artifact,
      bridge-forgery, and export contract tests in
      `packages/builder/code-runtime/src/runtime.test.ts`
- [ ] T031 [US1] Build the dedicated preview bootstrap and strict message validator in
      `apps/code-preview/src/main.tsx` and `apps/code-preview/src/bridge.ts`
- [ ] T032 [P] [US1] Add preview CSP, loading, invalid-artifact, and cleanup tests in
      `apps/code-preview/src/bridge.test.ts`
- [ ] T033 [US1] Expose managed catalog composition and runtime subpaths through
      `packages/builder/editor/src/code-runtime.ts` and `packages/builder/editor/package.json`
- [ ] T034 [US1] Add a reference TSX project fixture and create-page flow in
      `apps/playground/src/features/preview/code-page-fixture.ts`
- [ ] T035 [US1] Connect code project save, restore, revision, and artifact metadata to the vault in
      `apps/playground/src/features/vault/site-persistence.ts`
- [ ] T036 [US1] Implement `CodePreviewFrame` and its local export in
      `packages/builder/shell/src/components/CodePreviewFrame/CodePreviewFrame.tsx` and
      `packages/builder/shell/src/components/CodePreviewFrame/index.ts`
- [ ] T037 [P] [US1] Document `CodePreviewFrame` purpose, API, states, accessibility, RTL,
      responsive, and theme behavior in
      `packages/builder/shell/src/components/CodePreviewFrame/CodePreviewFrame.docs.mdx`
- [ ] T038 [P] [US1] Add typed matching, older, loading, error, and unavailable stories for
      `CodePreviewFrame` in
      `packages/builder/shell/src/components/CodePreviewFrame/CodePreviewFrame.stories.tsx`
- [ ] T039 [P] [US1] Add behavior and accessibility coverage for `CodePreviewFrame` in
      `packages/builder/shell/src/components/CodePreviewFrame/CodePreviewFrame.test.tsx`
- [ ] T040 [US1] Verify `CodePreviewFrame` in its shell owner and playground consumer via
      `packages/builder/shell/package.json` and `apps/playground/package.json`
- [ ] T041 [US1] Add the complete TSX create-to-export integration test in
      `apps/playground/src/features/preview/code-page-vertical-slice.test.tsx`
- [ ] T042 [US1] Wire the reference authored page, preview frame, selection edit, undo, save/reload,
      and export controls in `apps/playground/src/app/App.tsx`

**Checkpoint**: M0 is demonstrable and independently shippable behind the v2 authoring flag.

---

## Phase 4: User Story 2 — Compact target-aware Agent (P1)

**Goal**: Keep a compact persistent conversation with Ask/Plan/Auto, captured scope, one editable
queued request, cancellable work, recoverable drafts, and one-change/one-undo results.

**Independent Test**: Run, queue, switch panels/pages, stop, reload, resume, and prove that each
change uses its captured and revalidated target.

- [ ] T043 [P] [US2] Implement versioned run coordinator, queued-request state, cancellation tree,
      and completed-unit journal in `packages/builder/ai/src/agent/run-coordinator.ts`
- [ ] T044 [P] [US2] Implement project index and selection-context retrieval without whole-project
      prompting in `packages/builder/ai/src/context/context-index.ts`
- [ ] T045 [US2] Define and register `get_project_index`, `get_selection_context`,
      `resolve_component`, `edit_element`, `apply_module_patch`, `insert_section`,
      `page_operations`, `compile_preview`, `inspect_preview`, and `commit_draft` in
      `packages/builder/ai/src/tools/site-tools.ts`
- [ ] T046 [P] [US2] Add target revalidation, stop, late-result rejection, resume-without-repeat,
      and one-queued-request tests in `packages/builder/ai/src/agent/run-coordinator.test.ts`
- [ ] T047 [US2] Implement `AgentDockHeader` and local export in
      `apps/playground/src/features/preview/components/AgentDockHeader/AgentDockHeader.tsx` and
      `apps/playground/src/features/preview/components/AgentDockHeader/index.ts`
- [ ] T048 [P] [US2] Add typed compact/default/RTL stories with interaction coverage for
      `AgentDockHeader` in
      `apps/playground/src/features/preview/components/AgentDockHeader/AgentDockHeader.stories.tsx`
- [ ] T049 [P] [US2] Document `AgentDockHeader` usage, API, accessibility, RTL, responsive, and
      theme constraints in
      `apps/playground/src/features/preview/components/AgentDockHeader/AgentDockHeader.docs.mdx`
- [ ] T050 [P] [US2] Add behavior and accessibility tests for `AgentDockHeader` in
      `apps/playground/src/features/preview/components/AgentDockHeader/AgentDockHeader.test.tsx`
- [ ] T051 [US2] Verify `AgentDockHeader` through the playground package and Assistant panel
      consumer in `apps/playground/package.json`
- [ ] T052 [US2] Implement `AgentContextBar` and local export in
      `apps/playground/src/features/preview/components/AgentContextBar/AgentContextBar.tsx` and
      `apps/playground/src/features/preview/components/AgentContextBar/index.ts`
- [ ] T053 [P] [US2] Add typed site/page/instance/shared/stale stories for `AgentContextBar` in
      `apps/playground/src/features/preview/components/AgentContextBar/AgentContextBar.stories.tsx`
- [ ] T054 [P] [US2] Document `AgentContextBar` scope language and accessibility in
      `apps/playground/src/features/preview/components/AgentContextBar/AgentContextBar.docs.mdx`
- [ ] T055 [P] [US2] Add scope and stale-target behavior tests for `AgentContextBar` in
      `apps/playground/src/features/preview/components/AgentContextBar/AgentContextBar.test.tsx`
- [ ] T056 [US2] Verify `AgentContextBar` in the playground panel consumer through
      `apps/playground/package.json`
- [ ] T057 [US2] Implement `AgentRunCard` and local export in
      `apps/playground/src/features/preview/components/AgentRunCard/AgentRunCard.tsx` and
      `apps/playground/src/features/preview/components/AgentRunCard/index.ts`
- [ ] T058 [P] [US2] Add queued/running/stopped/failed/done stories for `AgentRunCard` in
      `apps/playground/src/features/preview/components/AgentRunCard/AgentRunCard.stories.tsx`
- [ ] T059 [P] [US2] Document `AgentRunCard` summary, collapsed detail, diff, and undo behavior in
      `apps/playground/src/features/preview/components/AgentRunCard/AgentRunCard.docs.mdx`
- [ ] T060 [P] [US2] Add progress, disclosure, stop, diff, and undo tests for `AgentRunCard` in
      `apps/playground/src/features/preview/components/AgentRunCard/AgentRunCard.test.tsx`
- [ ] T061 [US2] Verify `AgentRunCard` in the playground run-journal consumer through
      `apps/playground/package.json`
- [ ] T062 [US2] Implement `QueuedRequestCard` and local export in
      `apps/playground/src/features/preview/components/QueuedRequestCard/QueuedRequestCard.tsx` and
      `apps/playground/src/features/preview/components/QueuedRequestCard/index.ts`
- [ ] T063 [P] [US2] Add editable/stale/missing-target stories for `QueuedRequestCard` in
      `apps/playground/src/features/preview/components/QueuedRequestCard/QueuedRequestCard.stories.tsx`
- [ ] T064 [P] [US2] Document `QueuedRequestCard` capture, edit, remove, and revalidation semantics
      in
      `apps/playground/src/features/preview/components/QueuedRequestCard/QueuedRequestCard.docs.mdx`
- [ ] T065 [P] [US2] Add queue edit, remove, and missing-target behavior tests in
      `apps/playground/src/features/preview/components/QueuedRequestCard/QueuedRequestCard.test.tsx`
- [ ] T066 [US2] Verify `QueuedRequestCard` in the playground coordinator consumer through
      `apps/playground/package.json`
- [ ] T067 [US2] Refactor the Assistant panel into 44px header, context row, persistent thread,
      2–6-line composer, mode/model strip, empty-only suggestions, and single queue in
      `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.tsx`
- [ ] T068 [US2] Add compact-layout, panel-switch persistence, 720px conversation-share,
      Ask/Plan/Auto, queue, stop, reload, and RTL tests in
      `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.test.tsx`

---

## Phase 5: User Story 3 — Exact selection and insertion (P1)

**Goal**: Unify selection across all surfaces, separate text/popup/drag behavior, show exact scope
and capabilities, and insert only at a still-valid source or document anchor.

**Independent Test**: Exercise nested text selection, Escape ordering, 8px handle drag,
multi-select, stale source identity, shared impact, and reordered insertion neighbors.

- [ ] T069 [P] [US3] Implement source-aware selection reconciliation and capability intersection in
      `packages/builder/shell/src/selection/selection-controller.ts`
- [ ] T070 [P] [US3] Implement source/document insertion anchor creation and revalidation in
      `packages/builder/shell/src/insertion/insertion-anchor.ts`
- [ ] T071 [US3] Update frame hit testing and source metadata exchange in
      `packages/builder/shell/src/overlay/frame-bridge.ts`
- [ ] T072 [US3] Enforce popup, text edit, parent, clear Escape order and handle-only 8px drag
      threshold in `packages/builder/shell/src/overlay/inline-session.ts` and
      `packages/builder/shell/src/overlay/drag-session.ts`
- [ ] T073 [P] [US3] Add selection, multi-selection, stale identity, Escape, text popup, drag, and
      insertion race tests in `packages/builder/shell/src/selection/selection-controller.test.ts`
      and `packages/builder/shell/src/insertion/insertion-anchor.test.ts`
- [ ] T074 [US3] Implement `SelectionToolbar` and local export in
      `packages/builder/shell/src/components/SelectionToolbar/SelectionToolbar.tsx` and
      `packages/builder/shell/src/components/SelectionToolbar/index.ts`
- [ ] T075 [P] [US3] Add native/source/instance/multi/limited stories for `SelectionToolbar` in
      `packages/builder/shell/src/components/SelectionToolbar/SelectionToolbar.stories.tsx`
- [ ] T076 [P] [US3] Document `SelectionToolbar` capabilities, keyboard behavior, RTL, and shared
      scope in `packages/builder/shell/src/components/SelectionToolbar/SelectionToolbar.docs.mdx`
- [ ] T077 [P] [US3] Add target-command and accessibility tests for `SelectionToolbar` in
      `packages/builder/shell/src/components/SelectionToolbar/SelectionToolbar.test.tsx`
- [ ] T078 [US3] Verify `SelectionToolbar` in shell and playground consumers through
      `packages/builder/shell/package.json` and `apps/playground/package.json`
- [ ] T079 [US3] Implement `InsertionPicker` and local export in
      `packages/builder/shell/src/components/InsertionPicker/InsertionPicker.tsx` and
      `packages/builder/shell/src/components/InsertionPicker/index.ts`
- [ ] T080 [P] [US3] Add before/after/inside/stale/generating stories for `InsertionPicker` in
      `packages/builder/shell/src/components/InsertionPicker/InsertionPicker.stories.tsx`
- [ ] T081 [P] [US3] Document `InsertionPicker` modes, preview, focus, accessibility, and
      stale-anchor recovery in
      `packages/builder/shell/src/components/InsertionPicker/InsertionPicker.docs.mdx`
- [ ] T082 [P] [US3] Add placement, stale-anchor, focus, and accessibility tests in
      `packages/builder/shell/src/components/InsertionPicker/InsertionPicker.test.tsx`
- [ ] T083 [US3] Verify `InsertionPicker` in shell and playground consumers through
      `packages/builder/shell/package.json` and `apps/playground/package.json`
- [ ] T084 [US3] Connect canvas, layers, inspector, breadcrumbs, toolbar, Agent, and post-insert
      reveal to one selection store in `apps/playground/src/features/preview/selection-store.ts`

---

## Phase 6: User Story 4 — Coherent multi-page site (P2)

**Goal**: Give list and sitemap one page state and command set with stable internal links, atomic
home, safe deletion, independent duplication, shared-reference impact, SEO, share data, and
direction.

**Independent Test**: Create three linked pages, rename, duplicate, reorder, make home, remove,
clear, and undo while list, map, preview, and export remain coherent.

- [ ] T085 [P] [US4] Implement page-id link resolution for preview and export in
      `packages/builder/transforms/src/site/resolve-page-links.ts`
- [ ] T086 [P] [US4] Implement page thumbnail and shared-reference projection in
      `packages/builder/transforms/src/site/project-sitemap.ts`
- [ ] T087 [P] [US4] Add link rename, duplicate independence, shared reference, home invariant,
      delete/clear, and undo tests in `packages/builder/core/src/commands/page-commands.test.ts`
- [ ] T088 [US4] Implement `PageActionsMenu` and local export in
      `apps/playground/src/features/preview/components/PageActionsMenu/PageActionsMenu.tsx` and
      `apps/playground/src/features/preview/components/PageActionsMenu/index.ts`
- [ ] T089 [P] [US4] Add normal/home/last/linked stories for `PageActionsMenu` in
      `apps/playground/src/features/preview/components/PageActionsMenu/PageActionsMenu.stories.tsx`
- [ ] T090 [P] [US4] Document `PageActionsMenu` command scopes, destructive impact, keyboard, RTL,
      and accessibility in
      `apps/playground/src/features/preview/components/PageActionsMenu/PageActionsMenu.docs.mdx`
- [ ] T091 [P] [US4] Add page-command, last-page, linked-delete, and accessibility tests in
      `apps/playground/src/features/preview/components/PageActionsMenu/PageActionsMenu.test.tsx`
- [ ] T092 [US4] Verify `PageActionsMenu` in playground list/map consumers through
      `apps/playground/package.json`
- [ ] T093 [US4] Implement `SiteMap` and local export in
      `apps/playground/src/features/preview/components/SiteMap/SiteMap.tsx` and
      `apps/playground/src/features/preview/components/SiteMap/index.ts`
- [ ] T094 [P] [US4] Add empty/selected/shared-impact/RTL stories with interactions for `SiteMap` in
      `apps/playground/src/features/preview/components/SiteMap/SiteMap.stories.tsx`
- [ ] T095 [P] [US4] Document `SiteMap` information hierarchy, keyboard ordering, thumbnail
      fallback, RTL, and responsive behavior in
      `apps/playground/src/features/preview/components/SiteMap/SiteMap.docs.mdx`
- [ ] T096 [P] [US4] Add selection, reorder, shared-impact, keyboard, and accessibility tests in
      `apps/playground/src/features/preview/components/SiteMap/SiteMap.test.tsx`
- [ ] T097 [US4] Verify `SiteMap` in the playground page store consumer through
      `apps/playground/package.json`
- [ ] T098 [US4] Connect page list, sitemap, route settings, SEO/share fields, direction, and atomic
      page commands in `apps/playground/src/features/preview/page-workspace.tsx`

---

## Phase 7: User Story 5 — Trustworthy recovery, source editing, and revisions (P2)

**Goal**: Preserve valid and invalid source, identify durable/session-only state, keep last-good
preview, reject stale publication, and offer a capable lazily loaded code editor.

**Independent Test**: Disable IndexedDB, save invalid TSX, reload, overlap builds, undo, and attempt
stale export; no acknowledged work is lost and only matching artifacts publish.

- [ ] T099 [P] [US5] Return durable/session-only/error acknowledgements from
      `apps/playground/src/features/vault/store.ts` and
      `apps/playground/src/features/vault/persistence.ts`
- [ ] T100 [P] [US5] Persist invalid source, completed run units, last-good artifact identity, and
      source-download fallback in `apps/playground/src/features/vault/run-journal.ts` and
      `apps/playground/src/features/vault/site-persistence.ts`
- [ ] T101 [P] [US5] Add reload, quota, session-only, invalid-source, stale-build, cancel,
      resume-once, and undo-artifact tests in
      `apps/playground/src/features/vault/recovery-v2.test.ts`
- [ ] T102 [US5] Implement `PersistenceStatus` and local export in
      `apps/playground/src/features/vault/components/PersistenceStatus/PersistenceStatus.tsx` and
      `apps/playground/src/features/vault/components/PersistenceStatus/index.ts`
- [ ] T103 [P] [US5] Add saving/durable/session-only/error stories for `PersistenceStatus` in
      `apps/playground/src/features/vault/components/PersistenceStatus/PersistenceStatus.stories.tsx`
- [ ] T104 [P] [US5] Document `PersistenceStatus` messages, recovery action, accessibility, RTL,
      responsive, and theme behavior in
      `apps/playground/src/features/vault/components/PersistenceStatus/PersistenceStatus.docs.mdx`
- [ ] T105 [P] [US5] Add acknowledgement, download action, live-region, and accessibility tests in
      `apps/playground/src/features/vault/components/PersistenceStatus/PersistenceStatus.test.tsx`
- [ ] T106 [US5] Verify `PersistenceStatus` in vault and playground shell consumers through
      `apps/playground/package.json`
- [ ] T107 [US5] Add approved CodeMirror dependencies and replace the pay-per-use textarea with a
      lazily loaded CodeMirror 6 editor supporting TSX, JS, CSS, JSON, search, diagnostics,
      completion, and diffs in `pnpm-workspace.yaml`,
      `packages/builder/extensions/code-view/package.json`, and
      `packages/builder/extensions/code-view/src/components/CodeEditor/CodeEditor.tsx`
- [ ] T108 [US5] Export `CodeEditor` locally and through the code-view extension in
      `packages/builder/extensions/code-view/src/components/CodeEditor/index.ts` and
      `packages/builder/extensions/code-view/src/index.ts`
- [ ] T109 [P] [US5] Add loading/valid/invalid/read-only stories and interactions for `CodeEditor`
      in `packages/builder/extensions/code-view/src/components/CodeEditor/CodeEditor.stories.tsx`
- [ ] T110 [P] [US5] Document `CodeEditor` languages, diagnostics, completion, diffs, accessibility,
      RTL, responsive, and theme behavior in
      `packages/builder/extensions/code-view/src/components/CodeEditor/CodeEditor.docs.mdx`
- [ ] T111 [P] [US5] Add edit, invalid-save, diagnostic-navigation, completion, diff, and
      accessibility tests in
      `packages/builder/extensions/code-view/src/components/CodeEditor/CodeEditor.test.tsx`
- [ ] T112 [US5] Verify `CodeEditor` in code-view and playground consumers through
      `packages/builder/extensions/code-view/package.json` and `apps/playground/package.json`
- [ ] T113 [US5] Implement `SourceImpactBar` and local export in
      `packages/builder/extensions/code-view/src/components/SourceImpactBar/SourceImpactBar.tsx` and
      `packages/builder/extensions/code-view/src/components/SourceImpactBar/index.ts`
- [ ] T114 [P] [US5] Add local/shared/stale stories for `SourceImpactBar` in
      `packages/builder/extensions/code-view/src/components/SourceImpactBar/SourceImpactBar.stories.tsx`
- [ ] T115 [P] [US5] Document `SourceImpactBar` scope, changed-impact invalidation, accessibility,
      RTL, responsive, and theme behavior in
      `packages/builder/extensions/code-view/src/components/SourceImpactBar/SourceImpactBar.docs.mdx`
- [ ] T116 [P] [US5] Add instance/shared/stale-impact behavior tests in
      `packages/builder/extensions/code-view/src/components/SourceImpactBar/SourceImpactBar.test.tsx`
- [ ] T117 [US5] Verify `SourceImpactBar` in code-view and playground consumers through
      `packages/builder/extensions/code-view/package.json` and `apps/playground/package.json`
- [ ] T118 [US5] Connect selected source, diagnostics, completion catalog, diff approval, impact
      bar, and source navigation in `apps/playground/src/features/preview/code-workspace.tsx`

---

## Phase 8: User Story 6 — Fast, distinctive, measured Agent output (P2)

**Goal**: Use bounded orchestration, managed React libraries, measured model routing, four cache
layers, and a reproducible visual/function/cost evaluation before promoting defaults.

**Independent Test**: Run the six-case policy screen and then the full fixed corpus for finalists;
record every attempt and compare blind visual quality, follow-up success, latency, and accepted
cost.

- [ ] T119 [P] [US6] Generate pinned managed catalog manifests and React adapters from extension
      packages in `packages/builder/editor/src/catalog/managed-catalog.ts`
- [ ] T120 [P] [US6] Add catalog version, CSS, license, prop, and unavailable-component contract
      tests in `packages/builder/editor/src/catalog/managed-catalog.test.ts`
- [ ] T121 [US6] Implement capability probing and versioned Luna/Terra/Sol/Astra role routing with
      lowest-qualified selection in `apps/ai-server/src/model-policy.ts`
- [ ] T122 [US6] Implement one coordinator, default-three/max-six scheduler, one writer per file,
      two technical repairs, one visual repair, and one escalation in
      `apps/ai-server/src/run-scheduler.ts`
- [ ] T123 [P] [US6] Implement explicit stable-prefix prompt cache metrics and context/component
      caches in `apps/ai-server/src/context-cache.ts`
- [ ] T124 [US6] Implement killable compile/prerender worker supervision, cancellation propagation,
      timeouts, cleanup, and late-result rejection in `apps/ai-server/src/runtime-workers.ts`
- [ ] T125 [P] [US6] Implement usage and accepted-output-cost accounting including failures,
      repairs, review, escalation, cache writes/reads, and unknown values in
      `apps/ai-server/src/usage.ts`
- [ ] T126 [P] [US6] Add capability, scheduler, file ownership, retry, escalation, cancellation,
      cache, and usage tests in `apps/ai-server/src/model-policy.test.ts`,
      `apps/ai-server/src/run-scheduler.test.ts`, `apps/ai-server/src/runtime-workers.test.ts`, and
      `apps/ai-server/src/usage.test.ts`
- [ ] T127 [US6] Wire the real provider and progressive authored-file units through the new
      coordinator in `apps/ai-server/src/handler.ts`
- [ ] T128 [P] [US6] Define the fixed 20-brief, follow-up edit, language, viewport, asset, and
      reproducibility corpus in `apps/evals/corpus/professional-builder/manifest.json`
- [ ] T129 [US6] Add policy, first-authored-preview, accepted-output-cost, cache, and follow-up
      success recording in `apps/evals/src/harness/professional-builder.ts`
- [ ] T130 [P] [US6] Add functional rejection and blinded three-rater visual-score aggregation in
      `apps/evals/src/graders/professional-builder.ts`
- [ ] T131 [P] [US6] Add deterministic tests for denominators, repeated runs, rejection gates, and
      model anonymity in `apps/evals/src/graders/professional-builder.test.ts`
- [ ] T132 [US6] Add staged six-case then finalist/full-corpus scripts and evidence schema in
      `apps/evals/package.json` and `apps/evals/evidence/professional-builder/README.md`

---

## Phase 9: Polish, verification, rollout, and handoff

- [ ] T133 [P] Add cross-origin, forged/stale message, cross-project, unmanaged import, path,
      infinite-loop, CSP, and cleanup coverage in `apps/evals/src/security/code-runtime.test.ts`
- [ ] T134 [P] Add Chromium, Firefox, and WebKit flows at 390/768/1024/1280/1440 with keyboard,
      LTR/RTL, light/dark, reduced motion, and panel geometry in
      `apps/evals/src/browser/professional-builder.spec.ts`
- [ ] T135 [P] Add direct-route, refresh, indexable HTML, assets, hydration, interactions,
      forms-without-destination, and SEO export coverage in
      `apps/evals/src/export/professional-builder.test.ts`
- [ ] T136 Add preview-origin, CSP, runtime worker, catalog release, cache invalidation, and
      rollback operations documentation in `docs/operations/professional-builder-runtime.md`
- [ ] T137 Add the next architecture decision for trusted authored code and the cross-origin runtime
      in `docs/architecture/decisions/0007-authored-code-runtime.md`
- [ ] T138 Update the human documentation index and feature flags in `docs/README.md` and
      `apps/playground/.env.example`
- [ ] T139 Run owning-package tests and build checks for schema, core, runtime, shell, code-view,
      AI, playground, code-preview, ai-server, evals, and workspace-tools and record results in
      `specs/workspace/014-professional-builder-agent/verification.md`
- [ ] T140 Run `pnpm check:workspace`, `pnpm check:components`, `pnpm check:boundaries`,
      `pnpm check:graph`, and `pnpm verify`, then rerun Turbo-backed critical tests with `--force`
      and record exact evidence in `specs/workspace/014-professional-builder-agent/verification.md`
- [ ] T141 Perform an independent real-diff review against `spec.md`, `plan.md`, and `tasks.md`,
      recording accepted findings in `specs/workspace/014-professional-builder-agent/review.md`
- [ ] T142 Fix all accepted review findings in their owning files and record each resolution in
      `specs/workspace/014-professional-builder-agent/review.md`
- [ ] T143 Rerun affected checks after review repairs and append exact results to
      `specs/workspace/014-professional-builder-agent/verification.md`
- [ ] T144 Run `speckit.converge` and append every remaining unbuilt requirement as a new
      checked-format task in `specs/workspace/014-professional-builder-agent/tasks.md`
- [ ] T145 Complete any tasks appended by converge and repeat independent review plus affected
      verification in `specs/workspace/014-professional-builder-agent/review.md`
- [ ] T146 Refresh shared continuation state and exact validation evidence in
      `.specify/agents/HANDOFF.md`
- [ ] T147 Review the final real diff and propose a Conventional Commit message without committing
      in `specs/workspace/014-professional-builder-agent/verification.md`

---

## Dependencies and execution order

- Phase 1 blocks Phase 2. Phase 2 blocks all user stories.
- US1 is the MVP and blocks the final integration of US2, US3, US5, and US6.
- US2 and US3 may proceed in parallel after the foundational contracts, with path-disjoint
  ownership.
- US4 depends on foundational page commands but can proceed independently of Agent UI.
- US5 depends on US1 artifact revisions; CodeMirror component artifacts can proceed in parallel.
- US6 depends on runtime/compiler contracts and Agent tools; corpus authoring can proceed in
  parallel.
- Phase 9 starts after all owning user-story checkpoints pass.

## Parallel execution examples

- **US1**: runtime fingerprints/cache, preview app bridge, and `CodePreviewFrame` artifacts own
  disjoint paths.
- **US2**: Agent coordinator/context/tools can proceed alongside the four playground component
  folders.
- **US3**: selection controller, insertion anchor, and toolbar/picker artifact folders are
  path-disjoint.
- **US4**: transforms, page command tests, and `PageActionsMenu`/`SiteMap` folders are
  path-disjoint.
- **US5**: vault recovery, `PersistenceStatus`, `CodeEditor`, and `SourceImpactBar` own separate
  paths.
- **US6**: catalog, server orchestration, corpus, and grader work can proceed independently until
  wiring.

## Implementation strategy

1. Deliver and prove US1 as the smallest complete vertical slice behind a feature flag.
2. Add US2 and US3 control/safety surfaces before enabling remote source mutations.
3. Add US4 and US5 to establish multi-page correctness and trustworthy persistence.
4. Add US6 routing and evaluation only after deterministic local tooling is stable.
5. Promote flags only after Phase 9 evidence meets the release gates; keep v2 readers enabled during
   rollback.

## Approved quality and Frontend increment — 2026-10-10

These tasks implement QF-001..005 only; they do not finish the remaining production rollout above.

- [x] T148 Pin verified axe/Embla dependencies in the workspace catalog and owning manifests.
- [x] T149 Add bounded axe evaluation and positive/negative real-browser tests in
      `apps/evals/src/accessibility/`.
- [x] T150 Add licensed, budgeted Embla asset build and interactive carousel integration with native
      editor fallback, keyboard/RTL/dispose tests.
- [x] T151 Admit Embla in the versioned managed React catalog with compiler and lock rejection
      coverage.
- [x] T152 Wire authored design/application teaching through the public wire facade into real
      authored model requests, with request-capture coverage.
- [x] T153 Update architecture/component docs, run scoped checks and independent review, fix
      accepted findings and record evidence/remaining gates.

Evidence:
[verification-quality-frontend-2026-10-10.md](verification-quality-frontend-2026-10-10.md). Full
feature release/review/convergence remains open; the historical task ledger above was not
bulk-checked from this increment's local evidence.

## Approved Agent conversation and parallel tasks — 2026-10-10

- [x] T154 Diagnose and repair live panel/composer height and stream scrolling; add focused tests
      and document viewport/hidden behavior.
- [x] T155 [P] Refine existing Agent panel, header, composer, toolbar and record design; update
      affected stories/docs/tests and preserve keyboard/RTL behavior.
- [x] T156 Add captured one/three/six worker choice to the live build controller and real engine
      calls with no parallel claim for single edits; cover locks and queue/retry behavior.
- [x] T157 Add actual task-level execution summary with full component export/story/MDX/test
      artifacts; preserve ordered validation/application and expose failures honestly.
- [x] T158 Verify concurrent execution/cancellation and isolated browser scrolling/geometry at
      short/narrow/LTR/RTL/theme variants without paid providers.
- [x] T159 Independently review the real increment diff, repair accepted findings, rerun scoped
      checks and record evidence/handoff without claiming the whole release complete.

Evidence: [verification-agent-chat-2026-10-10.md](verification-agent-chat-2026-10-10.md).
CHAT-001..005 is locally verified; full feature 014 release and live model quality remain open.

## Approved baseline quality repair — 2026-10-10

- [x] T160 Reproduce and fix InspectorPartPanel's literal-tag MDX indexing failure without changing
      Storybook's configured scope or weakening checks.
- [x] T161 Complete existing ScriptParamsForm's local export, missing stylesheet, typed stories and
      attached MDX, preserving its production composition and dependencies.
- [x] T162 Add native-control/draft/commit/reset/disabled/empty/Arabic behavioral coverage and
      repair only runtime gaps proven by scoped tests.
- [x] T163 Run owning-package static/tests, component/workspace/boundary contracts, full Storybook
      static build and focused Chromium stories; record exact outcomes and remaining gates.
- [x] T164 Independently review the real repair diff, resolve accepted findings, rerun checks and
      refresh the canonical handoff without claiming all of feature 014 complete.

Evidence:
[verification-baseline-quality-2026-10-10.md](verification-baseline-quality-2026-10-10.md).
BQ-001..003 is locally verified; prior chat/catalog blockers are resolved, not the full feature 014
release or live model quality gates.

## Approved live telemetry and Pixi creative increment — 2026-10-11

- [x] T165 Record PX contracts, inspect official library compatibility and assign disjoint scopes.
- [x] T166 Carry measured provider usage and public progress into live Agent runs with attribution,
      bounded retention, unknown/cached distinctions and regression coverage.
- [x] T167 Add scoped scene input, bounded fixed-step simulation and manual chapter navigation with
      lifecycle/editor/reduced-motion tests; update the CK reference and regenerate lazy assets.
- [x] T168 Register targeted Arabic/English game/story/mural project AI skills with runnable
      examples and activation/budget/API regression tests.
- [x] T169 Verify real generated-runtime creative examples and live chat geometry/telemetry locally;
      run static/owner/consumer/workspace checks and document limits.
- [x] T170 Fresh independent review, repair findings, final scoped convergence and canonical
      handoff.

Evidence: [verification-pixi-telemetry-2026-10-11.md](verification-pixi-telemetry-2026-10-11.md).
PX-001..005 is locally verified; full feature 014 release and live provider quality/cost gates
remain open. No new package, paid provider call or external release was made.

## Deferred Pixi package roadmap — next session, 2026-10-12

Planning backlog only, recorded 2026-10-11. These tasks are **not started or approved for execution
today**; completed PX work and historical release tasks stay unchanged. Follow the
[roadmap in plan.md](plan.md#deferred-pixi-package-roadmap--next-session-2026-10-12).

- [x] T171 On an authorized continuation, amend scoped spec/acceptance scenarios, clarify the first
      slice and approve plan/tasks; recheck official versions/licenses, package ownership, catalog
      pins, provenance and budgets before installing anything. (2026-10-12: CE-001..007 in spec;
      @pixi/tilemap 5.0.2 MIT peer pixi.js >=8.5, inkjs 2.4.0 MIT, catalog-pinned.)
- [x] T172 Integrate Tilemap in the media-engine owner with bounded schema/API, a lazy
      single-Pixi-namespace asset, shared preview/export loader and a playable admitted-tileset
      fixture; cover camera/input, limits and disposal. (Procedural tile styles stand in for
      licensed tilesets; licensed textures are accepted through `tiles`.)
- [x] T173 Integrate Inkjs with bounded narrative execution, accessible choices, variables/outcomes
      and validated versioned save/restore; preserve manual chapters and verify preview/export plus
      malformed-data and step-limit behavior. Deviation: compilation runs in the lazy `ink` asset,
      because agent-authored scenes have no tool step (see plan).
- [ ] T174 AssetPack deferred: its image pipeline requires the native `sharp` build that
      `allowBuilds` disallows; revisit with an approved build-time owner and approved assets.
- [x] T175 For each admitted slice, extend real Agent planning/writer/Retry/Finish teaching and
      Arabic/English activation tests; extend deterministic and generated-runtime preview browser
      fixtures, owner/consumer checks. (Live usage/quality evidence still needs authorized paid
      evals.)
- [ ] T176 Layout assessed and deferred: no demonstrated in-canvas HUD need; the dialogue box and
      game controls stay accessible DOM.
- [ ] T177 Spine assessed and deferred: runtime licence and licensed skeleton/atlas assets remain
      unavailable; procedural rigs and sprite states cover character motion meanwhile.
- [x] T178 Review the actual increment, resolve findings, run scoped checks and update
      evidence/handoff; record deferrals and remaining live-eval/release gates.

### Creative engines and creative agent — 2026-10-12

- [x] T179 First-party `anim`, `fx` and `dialogue` Studio libraries with unit tests, generated
      assets and budgets; schema `CK_LIBRARY_REFERENCE`; allowlists in kit/schema/renderer/AI.
- [x] T180 Creative planner, story bible memory (validate/merge/learn/render), context providers and
      build-lane brief injection with tests.
- [x] T181 Skills `pixi-director`, `pixi-animation`, `pixi-effects`, `pixi-dialogue`,
      `pixi-tile-worlds`, companion selection, budgets, executable examples; move Pixi skills to
      `skills/creative/`.
- [x] T182 Playground story bible store/hook, controller wiring, StoryBiblePanel with story, MDX,
      CSS and behaviour tests; Arabic/English copy.
- [x] T183 Real-Chromium fixture `test:creative-engines:browser` for the taught examples.

Evidence:
[verification-creative-engines-2026-10-12.md](verification-creative-engines-2026-10-12.md).

### Studio Indigo chat redesign in code — 2026-10-12

- [x] T184 AgentHeader word-status subtitle from `headerStatusKey`, inside the 44px header, never a
      live region; copy `header.status.*` in both locales.
- [x] T185 Free code as a labelled switch chip in ComposerToolbar's choices, described by on/off.
- [x] T186 `CreativeStarters` in the empty thread with the free-code note and Turn on action;
      `AgentIcon` glyphs `game`, `dialogue`, `moon`, `book`.
- [x] T187 `CreativeBriefCard` in a creative build's lead (`BuildTurn.creative`,
      `model/creative-brief.ts`), planner cast fix for «بطلها X اسمه Y», role ids as catalog words.
- [x] T188 Fake controller free code and creative scenarios; AgentPanel stories; tests, component
      contract and Storybook build.

### Studio Indigo platform UX, command palette and feedback — 2026-10-12

- [x] T189 Shell chrome: captioned dark rail, one primary Publish site, segmented workspace view,
      icon-only pane toggles, shared rail measure for the phone overlay.
- [x] T190 Arabic labels for the Pages workspace, site map, page menus, History and code panels.
- [x] T191 `check:file-sizes` guard (source ≤ 500, tests ≤ 800, shrink-only baseline) in `verify`;
      split App.css, App.tsx, the agent controller hook, the fake controller and large modules.
- [x] T192 Add `cmdk` and `sonner` through the catalog (MIT, React 19 peers); Storybook pre-bundles.
- [x] T193 `CommandPalette` (Ctrl/⌘ K, top-bar trigger, EN/AR, RTL) with the live editor command
      list in `app/use-editor-commands.ts`.
- [x] T194 `FeedbackToaster` + `notifyPublish`: publish narrated in one toast, Try again on failure.
- [x] T195 Tests, stories, docs, component contract, file sizes, LTR/RTL screenshots.

### Agent knowledge: skills, memory, checkpoints; canvas chrome; Table and Chart — 2026-10-12

- [x] T196 Engine: `RunAiAgentOptions.hostSkillIds` (`agent/host-skills.ts`): a build's steps and a
      page plan offer the host's skills first among their optional skills (never mandatory).
- [x] T197 The person's own skills (`model/user-skills*.ts`, `skill-markdown.ts`): always-on or
      word-triggered, SKILL.md import/export, an always-on budget, persisted per viewer.
- [x] T198 Project memory (`model/project-memory.ts`): preferences and site facts sent to every run,
      answers and plans included, as one reviewed `data` fragment.
- [x] T199 Checkpoints (`model/checkpoints.ts`, `app/agent-checkpoints.ts`): the page is kept on the
      vault shelf before every build and edit; Restore to before a request now works.
- [x] T200 "Skills & memory" in the agent header: KnowledgePopover with Skills, Memory and
      Checkpoints tabs (SkillsTab, SkillRow, SkillEditor, MemoryTab, CheckpointsTab), EN/AR, RTL.
- [x] T201 Canvas floating chrome keeps its size under zoom (quick bar, action bar, text bubble).
- [x] T202 Table and Chart blocks (accessible SVG charts, no new dependency).
- [x] T203 The composer's `/` lists skills (own, then built-in) and pins up to three to the next
      message as explicit skills; SKILL.md / SKILL.mdx upload and paste; starter templates; Arabic
      accusative keywords in the engine matcher.

### Agent tools, data, four blocks, Studio game libraries — 2026-10-12

- [x] T204 Composer commands `/remember`, `/checkpoint`, `/skill` on the words before the slash
      (`model/skill-slash.ts` `slashCommands`, `hooks/use-knowledge-ui.ts`), EN/AR, status line.
- [x] T205 `data.show` agent tool (`ai/src/data-tools/`): CSV/TSV/markdown/rows → Chart or Table,
      number reading, form choice, refill by id; lane catalog lines; skill `craftkit.data-viz`.
- [x] T206 Zero-token data path: an instruction line over pasted rows is one `data.show` call.
- [x] T207 Drop a data file on the agent panel (`hooks/use-data-drop.ts`); import a skill from a
      link (`model/skill-link.ts`), fetched into the Import box to read before adding.
- [x] T208 Blocks Timeline, MenuSection, Location, Countdown (+ `countdown-clock` pack); Arabic
      names and property words; palette tiles; publish-through-Tailwind proof.
- [x] T209 Block-parts gate for Chart, Timeline, Menu, Countdown; dark-section card ink fix.
- [x] T210 Studio libraries `audio`, `gameai`, `hud` end to end, with skills and browser fixtures.
- [x] T211 Context cost: `jsMeta` summarised by declaration, template `blockTypes` with the full
      catalog only; none mode 13,183 → 11,794 wire tokens.
- [x] T212 Repairs: AI vocabulary generator and its two missing utilities; stale test pins.
- [x] T213 Inspector "Scene settings" for customCode `jsParams` from the `jsMeta.params` spec;
      `jsMeta` hidden (field-kinds gate).
- [x] T214 Default skills for every person (`CRAFTKIT_DEFAULT_SKILLS`): design intelligence from UI
      UX Pro Max's data (29 kinds of business), landing patterns, UX rules, type and colour, forms,
      natural Arabic, honest proof; Skills tab "Default skills" (switch, read, make my own), `/`
      listing, host skills for builds.

Order: T171 → T172 → T173 → T174, with T175/T178 applied to each admitted slice. T176/T177 are
conditional assessments, not permission to automatically install Layout or Spine. No task above
requires a paid provider call, commit, push or deployment without separate authorization.

## Increment 2026-10-12 (b) — agent power, batches, creative production

Requested (Arabic): Arabic and English everywhere; a modern compact agent chat; cache reads that are
not 0; context handled like Claude's own agent chat; background batches AND smarter live workers;
"high power" for stories, murals, games and websites; any package needed; 10/10.

- [x] T215 `page.translate` registered (edit lane cap 2290 → 2460, measured); natural-copy default
      skill teaches it. One language for the whole editor: the panel follows the editor locale
      (VITE_AGENT_LOCALE pins), the editor defaults to the browser's Arabic/English preference.
- [x] T216 Agent panel: one-row compact composer (workers/effort/mode/model chips, free code),
      Skills & memory as a centred settings modal, telemetry only when reported, the shared column
      pinned while Assistant shows; compact 44px rail tiles (the rail fits 760px).
- [x] T217 Speed: entry chunk 1,520 → 870 kB gzip; Add page paints in ~30 ms at any page count (site
      validation reuses untouched frozen pages; `isAssetRef` prefilter; memoised page list); page
      ids skip every id the site holds (Add page after a reload was refused).
- [x] T218 Prompt cache: one-hour breakpoints on rules, catalog, skills and the conversation;
      same-prefix calls staggered behind the first stream (`cache-gate.ts`); the routing client
      forwards the API's stream start.
- [x] T219 Thinking off in the form each model takes (Opus/Sonnet 5.5 refuse `disabled`: every build
      and «Improve» failed on `api:claude-*-5-5`); a failure after the stream began reaches the
      client as its status (`error` frame), not as an invalid answer.
- [x] T220 Context: history opens on a user turn; over budget the oldest exchanges go, then entries
      are capped, before failing; Arabic counted at 2 chars/token; a context meter; the chip names
      the sections the engine focused on.
- [x] T221 Stories/games scale and stack the same in canvas, Preview and published (`--ck-vh`,
      `ck.stage` follows its region); the free-code card teaches width-sized stages and `ck.scene`.
- [x] T222 Message Batches: `/batch` routes (Messages API only), shared `plan-params` /
      `plan-answer` / `plan-request` / `plan-errors`, `createRemoteBatchClient`,
      `createAiBatchRunner` (one Undo per page, resumable apply).
- [x] T223 Creative activation from GENRES (bedtime, picture book, fairy tale… AR/EN, business
      negatives kept); every scene section gets the page's cast and setting; playbooks
      `craftkit.pixi-physics`, `pixi-scroll-murals`, `pixi-page-shapes`; bedtime read-aloud; scene
      writers keep thinking at medium with a 48k output budget.
- [x] T224 Scene code checked before it lands (`check-scene.ts`: syntax, libs, DOM lookups, height,
      lifecycle, guards, forbidden), one repair with "js line N"; the door refuses unparseable js;
      scene writers start first and get 420 s.
- [x] T225 The 30 curated scene presets: frozen catalogue, unit + Chromium tests, seven fixed;
      `s.shader` promotes vertex-stage uniforms to highp; rough's reference corrected.
- [x] T226 Single-run edits of a scene get its playbooks, the director and a creative brief.
- [x] T227 Background jobs panel (start, list, poll, apply, retry live; EN/AR); `/batch` command.
- [x] T228 Run-check-fix: probe each scene in an off-screen frame (errors, blank, coverage, hidden
      controls; 1280 and 390, reduced motion, RTL) → one runtime repair; wired for free-code builds.
      Its first finds fixed: the card's stage gets `width:100%`; the aurora shader links.
- [x] T229 `scene.preset` agent tool over the catalogue; lane caps measured; server copy.
- [x] T230 Real multi-page sites (up to 8 pages): `planAiSite` (server `task:'site-plan'`, else the
      words), every page built at once under one run, one writers' pool (`createAiWriterPool`)
      shared across pages, a record per page, per-page Undo.
- [x] T230b Site pages linked in each page's header/footer menu (`nav.pages`, one transaction per
      page, aria-current), slug addresses from Latin titles.
- [x] T230c Language versions of a whole site: every built page (never the person's own) gets its
      versions, each language's pages link each other under their translated names.
- [ ] T230d Translations through the batch queue (half price, background) — not started.
- [x] T239 Full regression sweep (builder-ai by area, schema, renderer, media-engines, editor, core,
      shell, ai-server, playground: all green). Fixed on the way: the Pixi containment guard read a
      test fixture as an import; core's site-door list lacked the script/sound commands; the history
      merged two array-splicing steps, so Undo after a quick move out and back duplicated a node
      (property suite seed -928950502, red on builder-core too).
- [x] T231a Scene text translatable and editable: `s.lib.dialogue.fromDom` (lines in the tree, five
      `data-ck-*` dialogue markers at the door); `page.translate` covers text jsParams.
- [x] T231b The door admits the hooks scene code finds (21 playbook hooks + `data-scene-*`); it
      dropped them all before, so written games lost their controls. check-scene names them.
- [x] T231c Every scene writer sees the page's arc (craftkit:story-arc); a literal tile level whose
      exit or pickups are walled off is sent back (`scene-level`, column and row).
- [x] T237 Smarter live workers: the writers' pool halves on 429/503/529 and grows back one at a
      time (AIMD), live in every page and site build (`congestionAwareProvider`).
- [x] T238 Preset art: reaction-diffusion, coral, particle text, Mondrian, domain-warp, calligraphy,
      aurora, girih, arabesque, magnetic grid and confetti look finished within seconds.
- [x] T232 The agent looks at its scenes: the scene probe photographs each scene section (desktop
      640×360 and the 390 px phone, SVG foreignObject, canvases as their current frame), and one
      review per scene section (`POST /v1/scene/review`, the fastest model of the route, Messages
      API only) turns up to five visible failures into `scene-visual` findings for its one repair.
- [x] T242 Build lessons: a kept repair records what it fixed (one line each, at most six), and
      every later writer of the same build reads them (`build-lessons.ts`); a scripted writer
      repeating one mistake needed four repairs without lessons, one with.
- [x] T233 People for stories and games: `s.lib.peeps` (Open Peeps, design CC0, through DiceBear
      9.4.3, MIT), lazy `ck-lib-peeps.js` 111.3 kB gzip, no network; a name fixes the look, a mood
      the face; dialogue portraits per mood; taught by the director, dialogue, story and game
      playbooks and the planner. Kenney packs: not fetched (kenney.nl is outside this environment's
      network policy) — allow it in the environment to add them.
- [x] T241 Responsive scenes: `ck.scene({design})` draws in `s.world` at a design size the kit fits
      to every region (letterbox in the theme surface, pointer in design units, `s.compact`,
      `s.portrait`, `s.ui`); `zoom` with `libs:['viewport']` makes `s.world` a clamped pixi-viewport
      camera that never traps the page. Game and story playbooks compose at 1280×720.
- [ ] T234 CI: the workflow's root `playwright install` step and ~875 files failing
      `prettier --check` (both pre-existing on builder-core) — owner's decision.
- [x] T235 Page plans fit a long history with `fitAiPlanWireHistory` instead of failing on context
      overflow.
- [x] T236 The agent panel keeps one live region: `/` command answers speak through LiveStatus;
      agent stories brought up to the compact chat (workers chip, cards, radius 16).
- [x] T240 The cache doctor (ai-server `cache-doctor.ts`): every call that wrote the prompt cache
      instead of reading it is named — first of its kind, expired, another model, thinking/effort
      changed, rules/catalog/skills block changed, history changed — by comparing it with the
      previous call of the same kind, and on `api:` slugs by the Messages API's own diagnosis
      (`cache-diagnosis-2026-04-07`, previous_message_id; a refused beta is retried without it). The
      reason reaches the server log and the run telemetry (EN/AR). A reproduction through the real
      client, handler and prompt keeps the prefix byte-stable (`cache-prefix.integration`). Every
      route reads the cache now: OpenRouter's `anthropic/` slugs keep the hour and the conversation
      breakpoint (`openrouter-cache.ts`, back to five minutes for good only when OpenRouter refuses
      the hour and accepts the old form); other vendors cache a stable prefix by themselves; the
      prompt enhancer's rules are cached; batches and authored runs already were. The site plan's
      rules (~450 tokens) stay under the API's 512-token floor.

## Increment 2026-10-13 (b) — design round: templates, elements, Tailwind, builder UX, performance

The owner asked (Arabic) for better designs and template designs, more elements, Tailwind packages
that raise design quality, the whole builder's design and UX fixed, and better performance and code
separation. Five bounded helpers, each verified in a clean worktree and committed on its own.

- [x] T243 Six new templates (education, fitness, law firm, nonprofit, hotel and travel, personal
      brand; EN + AR) and a rhythm pass on the nine (a dark section each, no three same tones in a
      row, a distinct closing CTA), held by `design.test.ts`; every template file under 500 lines.
      The agent is offered only the templates in the page's direction (`CompositionDef.dir`,
      `template-context.ts`), so the list it pays for halved (30 → 15).
- [x] T244 Eight new elements: beforeAfter, pullQuote, reviewSummary, caseStudy, jobsList,
      downloadList, appDownload, fundraiser — full contract, tokens only, RTL, every word a part.
- [x] T245 Tailwind plugins: @tailwindcss/typography, @tailwindcss/forms (class strategy) and
      tw-animate-css, themed through the --t-* tokens and calm under reduced motion, on the canvas,
      in preview, the export and the AI door; the design skills teach them within their ceilings.
- [x] T246 Builder design pass: one panel system (spacing, surface, titles, search fields), Layers
      that fit, the Inspector brought forward at narrow widths, guidance on an empty page and in
      Help, translated Settings, undo/redo feedback, tooltips with shortcuts, a preview toolbar.
- [x] T247 Code separation and first load: EditorCanvas.tsx 3,136 → 491 and AssistantPanel.tsx 1,942
      → 446 lines (tests split with every assertion kept); vendor chunks; entry 913.6 → 625.7 KB
      gzip. The theme gate is green again (two runtime-written tokens declared).
- [x] T248 First-load JS back under its 1,151 KB budget: the page templates load on demand
      (`@craftkit/builder-blocks-marketing/templates`, `loadMarketingTemplates`,
      playground-templates.ts — idle preload once the canvas is live, at once when the Templates tab
      or "Start from a template" asks); initial JS 1,181 → 1,080 KB gzip, entry 544 KB.
- [x] T249 The agent remembers its conversation and the cache reads it (conversation-memory.ts): up
      to 40 messages whole, a window that steps 16 at once with a digest of what it left behind,
      builds and plans named by their sections, and the skills a conversation woke carried into its
      next runs (`carriedSkillIds`). Measured over 48 turns through the real client and server: the
      full prefix read on 39 turns instead of 3.
- [x] T250 Particle presets on `s.lib.emitter` (fire, smoke, sparkles, snow, rain, confetti, magic,
      bubbles, leaves, petals, fireworks, dust, embers; `spawn`/`burst`, procedural atlas,
      palette-aware, RTL wind, reduced motion as a still frame) and `s.lib.physics.world(s)`
      (Matter.js: walls, linked displays, pointer drag in design units, calm settle, dispose).
      Emitter budget 12,000 → 17,400 B gzip (measured 16,545 + 5%); physics 29,424 of 29,500.

## Increment 2026-10-13 (c) — ready scripts and Pixi packages, to lower the agent's cost

The owner asked (Arabic) for the packages that strengthen PixiJS results, and for ready-made scripts
for the things the agent does often, so each costs it less. What the agent used to write as code it
now names: a preset id and params, a `data-ck-behavior` value, a library call.

- [x] T251 Two lazy Studio libraries: `s.lib.procgen` (rot-js 2.2.1, BSD-3-Clause; 11,745 of 12,400
      B gzip — seeded dungeon, cave and maze maps, every one connected, RTL-mirrored start, path,
      fov, scatter, tilemap rows) and `s.lib.gif` (gifuct-js 2.1.2, MIT; 7,480 of 7,900 B — bounded
      GIF sprites on the scene's tick, still under reduced motion). Rejected with reasons in the
      media-engines README: @pixi/gif, @pixi/layout + yoga-layout, poisson-disk-sampling.
- [x] T252 Six ready website behaviours (back-to-top, read-more, scroll-spy, typed-words, filter,
      dismiss): audited renderer packs shipped only to the pages that name them, a vocabulary the
      door owns (`site-behavior-vocabulary.ts`), a site-behaviors playbook, and a Chromium test of a
      published page by keyboard, LTR/RTL, with and without motion, under a strict CSP. All-packs
      budget 23,000 → 27,000 B gzip.
- [x] T253 The free-code card names the ready behaviours instead of teaching a hand-written count-up
      (the card is 193 characters shorter on every free-code request, and the model no longer writes
      ~400 characters of script for a counter); a test holds each name to the enum.
- [x] T254 Fixes the new tests found: a stored `hidden` attribute rendered visible (React drops a
      falsy `hidden`; it is now a boolean attribute); a sticky header could not stick on a published
      page (its region now sticks with it, proven by the Chromium test failing without the rule);
      `copy-text` now says "Copied" / «تم النسخ» politely to screen readers.
- [x] T255 Eleven ready kits on `scene.preset` (game: arcade, platformer, runner, breakout, memory,
      quiz, snake, catch; story: picture-book, visual-novel, scroll-story): a kit lands as its own
      section in the page's language, its words in the tree, palette/seed/speed/density and its own
      params; keyboard only with focus, on-screen controls, pause, polite status, reduced motion as
      manual steps, RTL. One call costs ~24–84 tokens against ~3k–7k written (58,234 → 394 typical
      over the eleven). Played in Chromium (15 kit tests, 42 preset tests).

## Increment 2026-10-13 (d) — murals that land, cheaper reviews and batches, ready repairs

The owner reported (Arabic) that murals failed on time and no PixiJS mural landed, and asked for
strong cost work: Batches with prompt caching, the visual review, mural libraries, free art packs
and ready scripts for what the agent does again and again.

- [x] T256 Murals no longer time out (b1b3da8, 3a1a5ed): a mural writer wrote its whole scene by
      hand and a write still running at its 420 s deadline was thrown away, the retry repeating it.
      Scene writers are now shown the ready backdrops that fit their brief and place one with
      `@preset:<id>` (the build puts the tested code in, a repair round sees the name); a writer
      whose first attempt failed places one; own code is asked to stay under 9,000 characters. A new
      mural in an edit gets the same short list for one `scene.preset` step. Games and stories keep
      their kits.
- [x] T257 Review and batch economy (0a396d7): tested scene code (a preset or kit byte for byte)
      skips the model's review; a verdict is reused by a hash of what the pictures were drawn from
      (9 paid reviews → 2 in the fixture); the review's pretend breakpoint is gone (its shared
      prefix is ~360 tokens, under every model's minimum; `minCacheableTokens`); reviews can ride
      `/batch`; batch items keep their live one-hour breakpoints, and a batch whose 3+ items share a
      cacheable prefix is warmed by one live `max_tokens: 0` call first.
- [x] T258 Ready repairs and scripts (a75fb33): `tidySection` repairs 30 of the checker's 62 kinds
      of slip in code before the check (headings, anchors, action links, raw colours, contrast,
      scene height, libs, params, motion guard, cleanup), each kept only when the check finds
      strictly fewer issues — four of five repair rounds avoided in a scripted page; `section.ops`
      tone and space with zero-token readings in English and Arabic.
- [x] T259 Mural libraries and art (1fc0518): `s.lib.noise` (simplex-noise), `s.lib.geom`
      (d3-contour, polybooljs), `s.lib.hex` (Kenney's Hexagon Pack, CC0, from npm — kenney.nl is
      blocked here); six one-call murals (set-d); PRESETS FIRST in the mural playbook. Rejected with
      reasons: d3-delaunay and clippers (Unlicense dependency), fastnoise-lite, bezier-js, Game
      Icons (CC BY), palettes.

## Phase 10: Convergence — scene speed increment, 2026-10-13

- [x] T260 Resolve the final independent review of SP-001..004, repair accepted findings, and record
      the verdict for SP-T5. Local independent review and repairs are complete. After automatic
      approval review rejected the external CLI action, the user explicitly instructed “لا، اكتفِ
      بالمراجعة المحلية” on 2026-10-13. The enforced external runtime review is waived for this
      increment under the scoped exception in plan.md; it was not executed and no CLI pass is
      claimed. Do not retry the declined action without new user authorization. Native independent
      review and local implementation checks passed; see `verification-scene-speed-2026-10-13.md`.

## Authorized reliability and visual follow-up — 2026-10-13

User selected speed/reliability plus open visual repairs (“1+2”). Requirements and plan:
[SP-005..007](scene-speed-2026-10-13.md#authorized-reliability-and-visual-follow-up--2026-10-13).

- [x] T261 [P] Enforce section deadline settlement for non-cooperative providers in Builder AI;
      preserve cancellation/timeout semantics and add helper plus real-build regressions.
- [x] T262 [P] Forward CLI output caps and per-call effort to cold/warm processes in AI server;
      separate warm generation shapes, remove avoidable cache waits/retries, retain known legacy API
      compatibility, and verify using fake CLI children/providers.
- [x] T263 [P] Export the marketing owner stylesheet through public marketing/Builder entries and
      compose it into Playground static publishing; verify dark slabs and comparison rules.
- [x] T264 Integrate T261..263, perform independent local review, repair findings, run focused
      owner/consumer checks and record results/limits in the shared handoff. The user's local-only
      review instruction remains in effect; do not launch the declined external reviewer.

Evidence: [follow-up verification](verification-reliability-visual-2026-10-13.md), including final
Chromium probes and current-catalog offline JSON measurement. Existing release tasks remain
separate.

## Empty-canvas incident and request-skills repair — 2026-10-13

Requirements and bounded plan:
[SP-008..011](scene-speed-2026-10-13.md#authorized-empty-canvas-and-request-skills-repair--2026-10-13).

- [x] T265 [P] Bound complete edit/page-planning lifetimes and reject metadata-only scene creation
      through ordinary validation, the existing one repair, and salvage; preserve metadata edits.
- [x] T266 [P] Bound full server generation/streams/fallback and avoid stacked provider retries.
- [x] T267 [P] Bind optional skill selection inline to each prompt, remove persistent chips and the
      three-selection limit, disclose Auto salvage and advance real application progress.
- [x] T268 Route explicit creative creation on empty pages through builds despite later modifiers;
      integrate enabled automatic creative skills without weakening token/trust/ownership limits.
- [x] T269 Review independently, repair findings, verify exact failures plus scoped consumer/gates,
      and record local results and limits in shared continuity.

## Phase 11: Convergence — request-skills continuation, 2026-10-14

- [x] T270 Preserve the captured prior semantic brief when revising a pending page plan after a
      skill rename/name collision, while keeping explicit choices limited to the current request;
      add a real-controller regression, independent review and affected checks per SP-011 (partial).

Evidence:
[empty-canvas and request-skills verification](verification-empty-canvas-skills-2026-10-13.md),
including final convergence, independent review, browser checks and live-provider limits.

## Increment 2026-10-13 (f, libraries) — more mural libraries

Merge reconciliation (2026-10-14): upstream library tasks `T261` (`7cf96bd`) and `T262` (`e0b682d`)
are recorded as `T271` and `T272` here. `T261..T270` above retain their existing scene-plan and
verification references. Both library tasks retain their completed status and original commit
history.

- [x] T271 FastNoiseLite 1.1.1 and Bezier.js 6.1.4 (7cf96bd), on the owner's word: neither npm
      tarball carries a LICENSE file, so both are COPIED verbatim under `media-engines/vendor/` with
      their upstream MIT licences and PROVENANCE.md (sha256 pinned by tests) and listed as
      `vendored`, like webgl-noise and zzfx — the licence audit is unchanged. `s.lib.noise` 1.1.0
      gains perlin / value / value-cubic / opensimplex2 / opensimplex2s; `s.lib.geom` 1.1.0 gains
      `curve()` with offsets and tapered outlines.
- [x] T272 culori, lindenmayer, d3-shape and simplify-js (e0b682d), installed through the catalog:
      `s.lib.color` (OKLCH ramps, harmonies, contrast, readable ink), `s.lib.lsys` (seeded L-system
      growth, capped), `s.lib.geom` 1.2.0 (splines, arcs, pie, simplify), and four set-E murals
      (botanical-garden, gradient-waves, arc-rings, arabesque-scroll), offered to build writers as
      ready scenes. 7b7614b aligns one stale ai-server assertion with efea3b7's always-on `text`
      listener.

## Increment 2026-10-14 (h) — analytical report pages

- [x] T273 Excel and JSON on the agent panel (dc41055): a dropped `.xlsx` is read in the tab by
      `model/xlsx-rows.ts` (fflate unzip, MIT, lazy chunk; the browser's XML parser) — first sheet,
      shared/inline strings, numbers without float noise, percentages, ISO dates (1900 and 1904) —
      and goes into the draft as CSV under the instruction line. Bounded: each inflated part capped,
      5,000 rows x 40 columns, 2 MB file, 20 KB of rows; a damaged workbook gets an "unreadable"
      refusal (EN/AR). `.json` files are taken as they are.
- [x] T274 `report.page` and the deterministic analysis engine (6b7e7d3): `data-tools/analysis/`
      computes every figure (totals, averages, median/spread, change, growth, CAGR, shares, trend
      with R² and a worded projection, outliers, correlations, group-by, pivot, profit/margin,
      attainment, budget remaining) and ranks EN/AR findings. One call (~47 tokens) appends a stats
      header with up to four key-stat cards, charts chosen from the analysis, a findings list, and
      interactive summary and data tables (sortable by column kind, sticky header, search and pages
      past ten rows). `readDataText` reads JSON; the zero-token path routes "detailed report /
      dashboard page / analyse" and the Arabic wording to it; data-viz 1.2.0 teaches it. ai-server
      `handler.test.ts` "answers a unary page plan…" fails on dc41055 with or without this change
      (it expects a `restart` subscription the handler no longer makes); left for the owner.
- [x] T275 Brand logos, cartoon characters and illustrations (d0272af): verified catalogs generated
      by `scripts/build-art-catalog.mjs` into `packages/builder/ai/src/art-catalog/` — Simple Icons
      16.33.0 (3,335 brands, trademark note), DiceBear 9.x styles needing no credit (CC0 or free for
      commercial use; CC BY styles refused), Fluent Emoji Flat (MIT) — hotlinked https like the
      photo catalog, loaded lazily (62 KB gzip chunk; +640 B first load). The model writes `logo:` /
      `character:` / `illustration:` specs in media.add, kit slots, part.image and image.set;
      LogoCloud items take a logo; testimonials kits an avatar; the section check admits verified
      art. Open: the Testimonials block has no image field; the edit lane sees the ART teaching only
      when the host selects photo-direction (playground `features/agent` skill code);
      cdn.simpleicons.org serves the latest release, not the pin.
- [x] T276 A mural ships no explanation card or Next/Restart buttons unless asked (696a1a6): the
      creative brief gave every kind the game/story accessibility lines (controls and story text in
      the DOM, manual navigation, dialogue choices); a scene now gets its own
      (`creative/creative-accessibility.ts`), a request naming a mural stays a mural even when it
      tells a story (no dialogue box), and the mural playbook says no UI unless asked.
- [x] T277 Mural scale on every screen (e58ce1c), on the owner's word "use pixi-viewport": measured
      in Chromium, the region was right everywhere; the picture was laid out in CSS pixels (3.3x
      zoomed in on a phone). All set-A/D/E murals compose once at 1280x720 in `s.world` with
      `design:{…,fit:'cover',zoom:true}` + `libs:['viewport']`; playbook, core SIZE line and the
      free-code card (and server copy) teach it. Saved pages keep their stored code. Open: the
      phone's 3:4 init region crops to the middle; `scene-initializer.ts` could keep 16:9 with copy
      below (proposed diff in the session, not applied).
- [x] T278 Skills chosen from the request in every lane (67c6be6, 4c12b89; owner-approved wiring):
      `skills/request-skills.ts` (host, page-plan, section, edit lanes), new auto skills
      `craftkit.art-names` (logo/character/illustration specs) and `craftkit.logo-design` (an
      original SVG mark + wordmark), dialect folding («سويلي», «اعمل لي»), keyword fixes,
      `excludedSkillIds`; the page plan sheds the request's skills before its own; writers get their
      own section's skills instead of the page's matched defaults. Open: the kit header/footer
      `brand` slot is text-only (no SVG mark); «صمم لي شعار لمقهى» on a blank page routes as a page
      build; per-person switches for built-ins need a UI.
- [x] T279 Built-in skill switches (ce010ba): a "Built-in skills" group in the Skills tab (grouped,
      filter, reset, EN/AR, RTL, stories), stored per viewer as `ck-agent-builtin-skills:v1`, and
      `excludedSkillIds` respected in the edit lane, host ids, page plan, scaffold, writers and
      scene pins; engine-required skills stay on; a /skill pick wins. Open: `ALWAYS_ON_SKILL_IDS` in
      the playground mirrors the engine's `ENGINE_REQUIRED_SKILL_IDS`.
- [x] T280 Illustrated mural stories (e82d670): `s.lib.anim` timelines gain from/fromTo, stagger,
      labels, relative positions, seek/progress/time (scroll scrub); GSAP stays out (licence). Set
      F: desert-caravan, fishing-village, seed-to-forest, souq-morning — painted panoramas on one
      labelled timeline, no UI, loop or scrub; playbooks and planner teach the mural-story form.
- [x] T281 Any mural on demand (818758a, 37961b6): `s.lib.mural` composes a mural from a 1-3k
      character spec (moods, time arc, five parallax layers, 61 illustrated items, a cast and 3-5
      beats on one anim timeline; loop/scrub/still; never throws, warns). Nine bespoke fixtures
      (reef, space, Ramadan night, Japanese garden, winter village, Amman skyline, fairy forest,
      farm, harbour) run in a browser suite. Playbooks teach COMPOSE FIRST; the planner and the
      writer's ready-scene lines send a pictured mural no preset closely matches to the kit (owner
      approved the scene-ready.ts / check-scene.ts lines). Open: a retry still falls back to ready
      scenes; thin people/animals; one tint for every layer; the kit is 24.7 kB gzip.
