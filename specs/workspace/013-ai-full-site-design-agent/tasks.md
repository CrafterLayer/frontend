---
description: 'Task list for the AI Full-Site Design Agent'
---

# Tasks: AI Full-Site Design Agent

**Input**: Design documents from `specs/workspace/013-ai-full-site-design-agent/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: MANDATORY. The `react-monorepo-quality` preset supersedes the core command's
optional-test language for this repository. Every UI component additionally requires its typed
Storybook story and MDX documentation as explicit tasks — never a final cleanup note.

**Organization**: Grouped by user story so each is independently implementable and testable. Plan
phases A–C are blocking substrate and become Phase 2 (Foundational); plan phases E–H map onto the
story phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — path-disjoint, no dependency on an incomplete task
- **[Story]**: US1–US7 from [spec.md](./spec.md); Setup, Foundational, and Polish carry no label
- Every task names an exact path or deliverable

## Path Conventions

Layers per ADR 0003, enforced by `pnpm check:workspace`: schema=0, core=1, engines=2, shell=3,
extensions=4, preset=5. Storybook stories are **colocated in packages**; `apps/storybook` only
aggregates them (precedent: `packages/builder/theme/src/contrast.stories.tsx`).

Prefix every shell command with `PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`,
and add `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` when pnpm attempts a forbidden auto-install.

---

## Phase 1: Setup

**Purpose**: Establish an attributable baseline and the shared test fixtures every later phase
reads.

- [ ] T001 Capture a green pre-change baseline: run
      `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify`, record pnpm's OWN exit code and the
      `check:components` count (measured: 58) in
      `specs/workspace/013-ai-full-site-design-agent/baseline.md`
- [ ] T002 [P] Create the deterministic site fixtures used across packages in
      `packages/builder/schema/src/testing/site-fixtures.ts` (a one-page site, a five-page site, a
      site with shared regions)
- [ ] T003 [P] Extend the codec generators with a site arbitrary in
      `packages/builder/transforms/src/testing/site-arbitraries.ts` (page order, shared regions,
      design system, asset table)

**Checkpoint**: baseline recorded; fixtures available to every later phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story can begin until this phase completes. This is plan phases A, B, and
C.

### 2a — Site model, `@craftkit/builder-schema` (layer 0)

- [ ] T004 Define `BuilderSite`, `SitePage`, `SharedRegion`, `PageId`, `SharedRegionId`,
      `SharedRegionKind`, `LATEST_SITE_VERSION` in `packages/builder/schema/src/site/types.ts` per
      [data-model.md](./data-model.md) §1 — `SitePage.document` nests `BuilderDocument` verbatim at
      `schemaVersion` 1
- [ ] T005 Implement `validateSite()` and `SiteValidationIssue` in
      `packages/builder/schema/src/site/validate.ts`, CALLING the existing `document/validate.ts`
      for each page rather than reimplementing it
- [ ] T006 Write the site validator tests in `packages/builder/schema/src/site/validate.test.ts`
      covering all nine rules in [data-model.md](./data-model.md) §1 (missing home page, duplicate
      address, duplicate id, unknown region, invalid page document, direction mismatch, unresolved
      asset reference, contrast failure, unknown version)
- [ ] T007 Implement `migrateSite()` and `siteFromDocument()` in
      `packages/builder/schema/src/site/migrations.ts`, mirroring the existing
      `document/migrations.ts` pattern
- [ ] T008 Write the migration tests in `packages/builder/schema/src/site/migrations.test.ts`
      proving a bare `BuilderDocument` upgrades to a one-page site and round-trips back
      byte-identically (FR-007)
- [ ] T009 [P] Write the property test proving every page lifted out of a generated site validates
      alone in `packages/builder/schema/src/site/page-independence.property.test.ts` (SC-014)

### 2b — Design tokens move to layer 0 (plan phase B, research R1)

- [ ] T010 Move `ColorToken`, `MeasurementToken`, `TokenName`, and `Theme` from
      `packages/builder/renderer/src/resolve/theme.ts` into
      `packages/builder/schema/src/theme/tokens.ts`, preserving the vocabulary and its explanatory
      comments exactly
- [ ] T011 Re-export all four moved types from `packages/builder/renderer/src/resolve/theme.ts` so
      no existing consumer import breaks (contracts/site-model.md §1)
- [ ] T012 Define `DesignSystem` (name, tokens, typography, pairings, seed) in
      `packages/builder/schema/src/theme/design-system.ts` per [data-model.md](./data-model.md) §2
- [ ] T013 Implement `contrastRatio()` as a pure function in
      `packages/builder/schema/src/theme/contrast.ts`
- [ ] T014 Implement `validateDesignSystem()` in `packages/builder/schema/src/theme/validate.ts` —
      rejects an unknown token key and any authorized pairing below 4.5:1 normal / 3:1 large
      (FR-014)
- [ ] T015 [P] Write design-system validator tests in
      `packages/builder/schema/src/theme/validate.test.ts`, including a system that passes and one
      that fails on exactly one pairing
- [ ] T016 Resolve `--t-*` from site design-system data instead of the module constant in
      `packages/builder/renderer/src/resolve/theme.ts` and
      `packages/builder/renderer/src/components/DocumentView.tsx`
- [ ] T017 Write the renderer resolution tests in
      `packages/builder/renderer/src/resolve/theme.test.ts` proving a site token change reaches
      every page with no page regeneration (FR-012)

### 2c — Asset contract, `@craftkit/builder-schema` (layer 0)

- [ ] T018 [P] Define `AssetId`, `AssetEntry`, `AssetRef`, `AssetLibraryPort`, and the `ImageProp`
      union in `packages/builder/schema/src/assets/types.ts` per
      [contracts/asset-library.md](./contracts/asset-library.md)
- [ ] T019 [P] Implement the reference-resolution law in
      `packages/builder/schema/src/assets/validate.ts` — every `AssetRef` in every page and region
      must resolve in `site.assets` (FR-045)
- [ ] T020 [P] Write asset validation tests in `packages/builder/schema/src/assets/validate.test.ts`
      including an unresolvable reference and a valid deliberate absence

### 2d — Schema public API

- [ ] T021 Export the site, theme, and asset surfaces from `packages/builder/schema/src/index.ts`
      (contracts/site-model.md §1)
- [ ] T022 Run the schema gate: `pnpm --filter @craftkit/builder-schema lint typecheck test` and
      `pnpm check:workspace`

### 2e — Site commands and grouped dispatch, `@craftkit/builder-core` (layer 1)

- [ ] T023 Implement `addPage`, `removePage`, `renamePage`, `reorderPage` with their zod arg schemas
      in `packages/builder/core/src/commands/site-commands.ts`
- [ ] T024 Implement `setSharedRegion`, `setPageRegions`, `setDesignToken`, `setDesignSystem`,
      `registerAsset` in `packages/builder/core/src/commands/site-commands.ts`
- [ ] T025 Register the site commands and widen `CoreCommandName` in
      `packages/builder/core/src/commands/core-commands.ts`
- [ ] T026 Write the refusal tests in `packages/builder/core/src/commands/site-commands.test.ts` for
      all six refusals in [contracts/site-model.md](./contracts/site-model.md) §2 — each must be a
      validation failure with NO partial write
- [ ] T027 Implement `dispatchGroup()` in `packages/builder/core/src/commands/dispatch-group.ts` —
      all-or-nothing, one history entry, one `author`, a human label. This closes the
      `mode: 'sequence'` gap that FR-034 and FR-037 require (research R5)
- [ ] T028 Write `dispatchGroup` tests in
      `packages/builder/core/src/commands/dispatch-group.test.ts` proving one undo step reverses the
      whole group, and that a mid-group failure applies nothing
- [ ] T029 Verify the log/history-before-`store.write` ordering still holds for grouped dispatch in
      `packages/builder/core/src/commands/dispatch-group.test.ts` (003 contract §15 — uSES snapshots
      are read synchronously inside the notification)
- [ ] T030 Export `dispatchGroup` and the site commands from `packages/builder/core/src/index.ts`
- [ ] T031 Run the core gate: `pnpm --filter @craftkit/builder-core lint typecheck test`

### 2f — Site codec and the composed round-trip law, `@craftkit/builder-transforms` (layer 2)

- [ ] T032 Implement `projectSite()`, `parseSite()`, `SiteProjectionText`, and
      `SITE_MANIFEST_PROJECTION_ID` in `packages/builder/transforms/src/codec/site-codec.ts`,
      reusing `projectDocument`/`parseDocument` per page and region
- [ ] T033 Write the manifest law in
      `packages/builder/transforms/src/codec/site-codec.property.test.ts` —
      `parseManifest(projectManifest(m)) ≡ m`, 1,000 `fast-check` cases, fixed seeds, merge-blocking
- [ ] T034 Write the composition law in
      `packages/builder/transforms/src/codec/site-codec.property.test.ts` — a site projection
      decomposes into exactly its manifest plus one text per page and region, losslessly and
      order-independently
- [ ] T035 Extend the non-vacuity gate to `parseSite` in
      `packages/builder/transforms/src/codec/site-codec.property.test.ts` — a parser returning `[]`
      forever must FAIL the gate
- [ ] T036 Confirm the existing per-page law is reused verbatim and NOT re-derived; assert that in a
      comment and a test reference in
      `packages/builder/transforms/src/codec/site-codec.property.test.ts`
- [ ] T037 Export the site codec from `packages/builder/transforms/src/index.ts`
- [ ] T038 Run the transforms gate: `pnpm exec vitest run packages/builder/transforms/src/codec`

### 2g — Code-view scopes, `@craftkit/builder-code-view` (layer 4)

- [ ] T039 Add `{ kind: 'site' }` and `{ kind: 'page'; pageId }` to `TransformScope` in
      `packages/builder/extensions/code-view/src/worker/protocol.ts` and extend its runtime guards
- [ ] T040 Handle the new scopes in
      `packages/builder/extensions/code-view/src/worker/transform-worker.ts`, carrying the site on
      the existing base-artifact channel for site scope
- [ ] T041 Handle the new scopes in `packages/builder/extensions/code-view/src/worker/client.ts` and
      `loopback.ts`
- [ ] T042 Extend the protocol tests in
      `packages/builder/extensions/code-view/src/worker/protocol.test.ts` for both new scopes,
      including staleness detection under a site-sized payload
- [ ] T043 Re-prove SC-005 STATICALLY at site scope in
      `packages/builder/extensions/code-view/src/containment.test.ts` — main-thread modules still
      cannot import the codec
- [ ] T044 Re-prove SC-005 DYNAMICALLY at site scope in
      `packages/builder/extensions/code-view/src/worker/off-thread.test.ts` — a typing burst invokes
      the codec ZERO times in the render realm, counted not timed
- [ ] T045 Prove per-page editing does not re-serialize the whole site in
      `packages/builder/extensions/code-view/src/worker/off-thread.test.ts` (the D6 mitigation)

### 2h — Preset surface and foundational gate

- [ ] T046 Re-export the site, design-system, asset, and `dispatchGroup` surfaces from
      `packages/builder/editor/src/index.ts` so apps keep importing only `@craftkit/builder`
- [ ] T047 Run the foundational gate: `pnpm check:workspace`, `pnpm check:boundaries`, `pnpm lint`,
      `pnpm typecheck`, `pnpm test` — record pnpm's own exit code

**Checkpoint**: the site exists, validates, round-trips, and is writable only through the door. User
story work can begin.

---

## Phase 2i: User Story 8 — Trusted Skills and Bounded Agent Core (P1, foundational)

**Goal**: Let a host give the agent versioned reusable skills without turning prompt text into
authority; make one run deterministic, bounded, observable, cache-correct, and convergent on the
same grouped kernel door used for live application.

**Why this phase is numbered 2i**: US8 was added after the original 158-task plan, so its task ids
continue at T159. It is nevertheless foundational and may complete before the site substrate; it
depends only on the existing single-page command planner and grouped core dispatch.

- [x] T159 [US8] Record the three-project source audit, requirements, decision, and public contract
      in `research.md` R11, `spec.md` FR-065–FR-076, `plan.md` D10, and `contracts/agent-skills.md`
- [x] T160 [US8] Write definition/registry red tests in
      `packages/builder/ai/src/skills/skill-registry.test.ts` for runtime validation, canonical
      fingerprints, metadata-only discovery, explicit reads, duplicate ids, size/path limits, and
      caller-mutation isolation
- [x] T161 [US8] Implement the v1 types, constants, runtime validator, canonicalizer, fingerprint,
      and immutable progressive registry in
      `packages/builder/ai/src/skills/{types,define-skill,registry}.ts`
- [x] T162 [US8] Write resolution red/property tests in
      `packages/builder/ai/src/skills/resolve-skills.property.test.ts` — 1,000 shuffled inputs,
      explicit/always/auto/dependency activation, cycles, conflicts, trust, count/token budgets, and
      observable auto omissions
- [x] T163 [US8] Implement deterministic request-local resolution in
      `packages/builder/ai/src/skills/resolve-skills.ts`
- [x] T164 [US8] Add reviewed, instruction-only first-party skills in
      `packages/builder/ai/src/skills/builtins.ts` for safe Builder editing, professional page
      composition, and precise refinement; no script, URL, or ambient runtime capability
- [x] T165 [US8] Write context red tests proving catalog metadata and active bodies are separate,
      active bodies appear exactly once, prompt-looking delimiters remain data, and the skill
      fingerprints reach the provider in `packages/builder/ai/src/context/assemble-context.test.ts`
- [x] T166 [US8] Integrate prepared Skills into `AssembledAiContext`, context assembly, and
      `generateAiPlan()` through additive options in
      `packages/builder/ai/src/{types.ts,context/assemble-context.ts,plan/generate-plan.ts}`
- [x] T167 [US8] Write cache red tests for memory/fragment/block/template/skill changes and an
      already-aborted cache hit in `packages/builder/ai/src/provider/caching-provider.test.ts`
- [x] T168 [US8] Make cache identity cover the complete canonical assembled context and check
      cancellation before lookup/return in `packages/builder/ai/src/provider/caching-provider.ts`
- [x] T169 [US8] Write command-policy red tests in
      `packages/builder/ai/src/plan/skill-command-policy.test.ts` proving host/skill intersection,
      deny precedence, command cap, unknown command refusal, and zero scratch/live writes
- [x] T170 [US8] Implement command-policy composition and enforce it in plan parse/validation/repair
      through `packages/builder/ai/src/skills/command-policy.ts` and
      `packages/builder/ai/src/plan/{generate-plan,validate-plan,apply-plan}.ts`
- [x] T171 [US8] Restore the approved one-repair default in
      `packages/builder/ai/src/plan/generate-plan.ts` and update its tests; a third provider attempt
      must be impossible unless a later versioned contract explicitly changes the budget
- [x] T172 [US8] Extend grouped dispatch with the backward-compatible `{ author, label }` options,
      use the plan rationale as the AI history label, and make scratch preflight execute the same
      grouped door in `packages/builder/core/src/commands/dispatch.ts`,
      `packages/builder/core/src/kernel/create-builder.ts`, and AI plan tests
- [x] T173 [US8] Define `AiAgentRunState`, typed sequenced `AiAgentEvent`, bounded policy, and typed
      outcomes in `packages/builder/ai/src/agent/types.ts`
- [x] T174 [US8] Write runner red tests in `packages/builder/ai/src/agent/run-agent.test.ts` for
      event order, injected time/run id, explicit Skills, propose-only, auto apply, one transaction
      and undo, failure, pre-abort, mid-run cancellation, and no post-terminal event/write
- [x] T175 [US8] Implement the UI-independent bounded coordinator in
      `packages/builder/ai/src/agent/run-agent.ts`
- [x] T176 [US8] Export the skills/agent surfaces from `packages/builder/ai/src/index.ts`, update
      `packages/builder/ai/README.md` with the progressive-disclosure and capability-intersection
      invariants, and add an integration example that supplies a host Skill
- [x] T177 [US8] Run named mutation checks for cache context identity, skill dependency/conflict
      resolution, policy intersection, cancellation-before-apply, and exactly-one-terminal-event;
      observe each failing test before restoring the source
- [ ] T178 [US8] Run the US8 gate: focused Skills/agent/core tests, `builder-ai` lint/typecheck/test
      and coverage, `builder-core` lint/typecheck/test, `pnpm check:workspace`,
      `pnpm check:boundaries`, and `git diff --check`; record unavailable or unrelated failures
      separately

**Checkpoint**: a host can give the agent validated Skills; the run discloses and pins them,
enforces their restrictive policy, emits a complete typed trace, and either returns a validated
proposal or applies one atomic AI-authored change.

---

## Phase 3: User Story 1 — Describe a business, receive a whole site (P1) 🎯 MVP

**Goal**: A one-paragraph brief becomes a complete, valid, multi-page site through five observable
stages.

**Independent Test**: Submit a brief for a business the block vocabulary has never seen named.
Confirm >1 page, every page validated before render, a defensible page set, and named progress per
stage.

### Stage contracts and providers — `@craftkit/builder-ai` (layer 2)

- [ ] T048 [US1] Define `SITE_STAGE_WIRE_VERSION`, `StageEnvelope`, and the five request/response
      pairs in `packages/builder/ai/src/pipeline/wire.ts`, each self-contained and carrying the seed
      (FR-027)
- [ ] T049 [US1] Define the `SiteStageProvider` port and `StageOptions` in
      `packages/builder/ai/src/pipeline/stage-provider.ts`, matching the existing `AiProposeOptions`
      shape for signal and progress
- [ ] T050 [P] [US1] Implement the sitemap stage in
      `packages/builder/ai/src/pipeline/stages/sitemap.ts` with intermediate validation
- [ ] T051 [P] [US1] Implement the structure stage in
      `packages/builder/ai/src/pipeline/stages/structure.ts` — a section naming an unregistered
      block type is a stage failure, never an invention (FR-019)
- [ ] T052 [P] [US1] Implement the content stage in
      `packages/builder/ai/src/pipeline/stages/content.ts` with the filler-text refusal (FR-020)
- [ ] T053 [P] [US1] Implement the design-system stage in
      `packages/builder/ai/src/pipeline/stages/design-system.ts`, emitting a `DesignSystem` that
      passes `validateDesignSystem()`
- [ ] T054 [US1] Implement the assembly stage in
      `packages/builder/ai/src/pipeline/stages/assembly.ts` — emits COMMANDS only, never a document
      or site object (FR-030)
- [ ] T055 [US1] Implement the deterministic offline provider for all five stages in
      `packages/builder/ai/src/pipeline/offline/offline-stage-provider.ts` (FR-028 — every scenario
      in the spec must run through it)
- [ ] T056 [US1] Implement `createRemoteSiteStageProvider()` in
      `packages/builder/ai/src/pipeline/remote-stage-provider.ts`, reusing the existing SSE
      `status`-frame progress channel and injectable `fetch`
- [ ] T057 [US1] Implement `createScriptedSiteStageProvider()` in
      `packages/builder/ai/src/testing/scripted-stage-provider.ts` for forced refusals and stage-N
      failures

### Orchestration

- [ ] T058 [US1] Implement `generateSite()` in `packages/builder/ai/src/pipeline/generate-site.ts` —
      stage ordering, per-stage validation before the next begins, `onStage` start/done,
      cancellation, seed, bounds, and application through `dispatchGroup`
- [ ] T059 [US1] Write stage-ordering and intermediate-validation tests in
      `packages/builder/ai/src/pipeline/generate-site.test.ts` (FR-016, FR-017)
- [ ] T060 [US1] Write the atomicity tests in
      `packages/builder/ai/src/pipeline/generate-site.test.ts` — a scripted failure at stage 4 and a
      mid-run cancellation each leave the workspace byte-identical to a captured prior state
      (SC-010)
- [ ] T061 [US1] Write the seed-determinism property test in
      `packages/builder/ai/src/pipeline/generate-site.property.test.ts` (FR-024, SC-013)
- [ ] T062 [US1] Write the bounds test in `packages/builder/ai/src/pipeline/generate-site.test.ts` —
      exceeding `limits` is REPORTED, never silently truncated (FR-025)
- [ ] T063 [US1] Write the door test in `packages/builder/ai/src/pipeline/generate-site.test.ts` — a
      provider returning a site object is rejected, and a spy proves every write passed validation
      (SC-002)
- [ ] T064 [US1] Write the one-undo-step test in
      `packages/builder/ai/src/pipeline/generate-site.test.ts` — a whole generation reverses in one
      undo (SC-011)
- [ ] T065 [US1] Write the copy-relevance test in
      `packages/builder/ai/src/pipeline/stages/content.test.ts` — ≥95% of spans carry brief terms,
      zero filler (SC-005)
- [ ] T066 [US1] Export the pipeline surface from `packages/builder/ai/src/index.ts` and the
      scripted provider from `packages/builder/ai/src/testing/index.ts`

### `GenerationProgress` component — `@craftkit/builder-shell` (layer 3)

- [ ] T067 [US1] Implement `GenerationProgress` in
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.tsx` — named
      stages, `aria-live` polite announcements, a keyboard-reachable cancel, no focus steal
- [ ] T068 [US1] Add the local export in
      `packages/builder/shell/src/components/GenerationProgress/index.ts`
- [ ] T069 [US1] Write typed CSF stories in
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.stories.tsx` —
      idle, each running stage, complete, failed, cancelled, RTL, plus a `play` interaction for
      cancel
- [ ] T070 [US1] Write
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.docs.mdx` —
      purpose, stage vocabulary, cancel contract, accessibility, limitations
- [ ] T071 [US1] Write behavioural tests in
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.test.tsx` — stage
      announcement, cancel callback, failure text, via accessible queries

### `SitePages` component — `@craftkit/builder-shell` (layer 3)

- [ ] T072 [US1] Implement `SitePages` in
      `packages/builder/shell/src/components/SitePages/SitePages.tsx` — listbox semantics, roving
      focus, Home/End, RTL mirror, a NAMED focus destination after delete
- [ ] T073 [US1] Add the local export in `packages/builder/shell/src/components/SitePages/index.ts`
- [ ] T074 [US1] Write typed CSF stories in
      `packages/builder/shell/src/components/SitePages/SitePages.stories.tsx` — default, single
      page, many pages, reordering, empty, RTL, with a `play` interaction for keyboard reorder
- [ ] T075 [US1] Write `packages/builder/shell/src/components/SitePages/SitePages.docs.mdx`
- [ ] T076 [US1] Write behavioural tests in
      `packages/builder/shell/src/components/SitePages/SitePages.test.tsx` — add, remove, rename,
      reorder, and the focus destination after delete asserted by NAME, not by `not.toHaveFocus()`
- [ ] T077 [US1] Export both components from `packages/builder/shell/src/index.ts` and re-export
      from `packages/builder/editor/src/index.ts`

### `SiteBriefForm` component — `apps/playground`

- [ ] T078 [US1] Implement `SiteBriefForm` in
      `apps/playground/src/features/preview/components/SiteBriefForm/SiteBriefForm.tsx` using an
      Action and `useActionState` for pending/error state
- [ ] T079 [US1] Add the local export in
      `apps/playground/src/features/preview/components/SiteBriefForm/index.ts`
- [ ] T080 [US1] Write typed CSF stories in
      `apps/playground/src/features/preview/components/SiteBriefForm/SiteBriefForm.stories.tsx` —
      empty, typing, submitting, refused, error, RTL
- [ ] T081 [US1] Write
      `apps/playground/src/features/preview/components/SiteBriefForm/SiteBriefForm.docs.mdx`
- [ ] T082 [US1] Write behavioural tests in
      `apps/playground/src/features/preview/components/SiteBriefForm/SiteBriefForm.test.tsx` —
      submit, refusal path, disabled-while-running announced, error tied by `aria-describedby`

### Composition and gate

- [ ] T083 [US1] Compose the brief form, progress, and page navigator into
      `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.tsx`, keeping
      it a thin composition shell
- [ ] T084 [US1] Update
      `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.test.tsx` for
      the staged flow
- [ ] T085 [US1] Run the US1 gate: `pnpm exec vitest run packages/builder/ai/src/pipeline`,
      `pnpm check:components`, and the owning-package lint/typecheck/test for `builder-ai`,
      `builder-shell`, and `@craftkit/playground`

**Checkpoint**: a brief produces a complete, valid, navigable multi-page site. MVP is real.

---

## Phase 4: User Story 2 — One design language across the whole site (P1)

**Goal**: The generated design system is addressable data, applied everywhere, adjustable in one
place, and provably accessible.

**Independent Test**: Change one design-system value; every page changes with it. Regenerate only
the design system; structure and copy survive.

- [ ] T086 [US2] Wire `setDesignToken` and `setDesignSystem` through the editor surface in
      `packages/builder/editor/src/index.ts` and verify a single dispatch per commit
- [ ] T087 [US2] Write the site-wide propagation test in
      `packages/builder/renderer/src/resolve/theme.test.ts` — one token change reaches every page,
      zero pages regenerated (FR-012)
- [ ] T088 [US2] Write the replaceability test in
      `packages/builder/ai/src/pipeline/stages/design-system.test.ts` — replacing the design system
      leaves page structure and copy unchanged (FR-013)
- [ ] T089 [US2] Write the no-literals test in
      `packages/builder/extensions/blocks-marketing/src/section-color.test.ts` — no generated
      section carries a literal colour, font, or raw size (FR-011)
- [ ] T090 [US2] Implement the Chromium contrast gate in
      `packages/builder/renderer/src/resolve/generated-contrast.stories.tsx`, computing real ratios
      over every authorized `--t-*` pairing, following the precedent in
      `packages/builder/theme/src/contrast.stories.tsx` (SC-009)
- [ ] T091 [US2] Verify the editor theme and the site design system stay independent in
      `packages/builder/editor/src/components/BuilderTheme/BuilderTheme.test.tsx` — changing one
      never changes the other (FR-015)

### `DesignSystemPanel` component — `@craftkit/builder-shell` (layer 3)

- [ ] T092 [US2] Implement `DesignSystemPanel` in
      `packages/builder/shell/src/components/DesignSystemPanel/DesignSystemPanel.tsx` — grouped
      labelled fields, draft discipline where external writes always win, announced contrast
      failures
- [ ] T093 [US2] Add the local export in
      `packages/builder/shell/src/components/DesignSystemPanel/index.ts`
- [ ] T094 [US2] Write typed CSF stories in
      `packages/builder/shell/src/components/DesignSystemPanel/DesignSystemPanel.stories.tsx` —
      default, editing, regenerating, contrast warning, RTL
- [ ] T095 [US2] Write
      `packages/builder/shell/src/components/DesignSystemPanel/DesignSystemPanel.docs.mdx`
- [ ] T096 [US2] Write behavioural tests in
      `packages/builder/shell/src/components/DesignSystemPanel/DesignSystemPanel.test.tsx` — one
      edit is one dispatch; an external write beats an open draft

### `TokenSwatchGrid` subcomponent — its own folder (Constitution III)

- [ ] T097 [US2] Implement `TokenSwatchGrid` in
      `packages/builder/shell/src/components/DesignSystemPanel/TokenSwatchGrid/TokenSwatchGrid.tsx`
      — grid semantics, swatches named in text and never by colour alone
- [ ] T098 [US2] Add the local export in
      `packages/builder/shell/src/components/DesignSystemPanel/TokenSwatchGrid/index.ts`
- [ ] T099 [US2] Write typed CSF stories in
      `packages/builder/shell/src/components/DesignSystemPanel/TokenSwatchGrid/TokenSwatchGrid.stories.tsx`
      — colour roles, measurements, overflow
- [ ] T100 [US2] Write
      `packages/builder/shell/src/components/DesignSystemPanel/TokenSwatchGrid/TokenSwatchGrid.docs.mdx`,
      including why it is a separate component
- [ ] T101 [US2] Write behavioural tests in
      `packages/builder/shell/src/components/DesignSystemPanel/TokenSwatchGrid/TokenSwatchGrid.test.tsx`
      — selection callback and keyboard grid navigation
- [ ] T102 [US2] Export the panel from `packages/builder/shell/src/index.ts` and re-export from
      `packages/builder/editor/src/index.ts`
- [ ] T103 [US2] Run the US2 gate: the Chromium contrast story plus `pnpm check:components`
      (expected 54 at this point)

**Checkpoint**: one design language, applied site-wide, measurably accessible, adjustable in one
place.

---

## Phase 5: User Story 3 — Keep talking instead of starting over (P1)

**Goal**: Follow-up prompts patch the existing site; everything unnamed survives, including hand
edits.

**Independent Test**: Generate, hand-edit an untouched page, issue three follow-ups, confirm each
changed only its target and undoes in one step.

- [ ] T104 [US3] Implement `refineSite()` in `packages/builder/ai/src/refine/refine-site.ts` —
      resolve the target FIRST, refuse an unresolvable one before proposing anything, then propose,
      validate through the scratch kernel, and apply via `dispatchGroup`
- [ ] T105 [US3] Implement target resolution in `packages/builder/ai/src/refine/resolve-target.ts`
      for site, design-system, page, and node targets
- [ ] T106 [US3] Write the isolation test in `packages/builder/ai/src/refine/refine-site.test.ts` —
      ≥99% of nodes outside the target byte-identical, and a post-generation hand edit survives
      (FR-036, SC-007)
- [ ] T107 [US3] Write the refusal test in `packages/builder/ai/src/refine/refine-site.test.ts` — a
      request naming a nonexistent page changes nothing (FR-038)
- [ ] T108 [US3] Write the one-undo-step test in
      `packages/builder/ai/src/refine/refine-site.test.ts` (FR-037)
- [ ] T109 [US3] Write the contrast-safe adjustment test in
      `packages/builder/ai/src/refine/refine-site.test.ts` — "make the hero darker" resolves to a
      compliant value and REPORTS the adjustment (FR-039)
- [ ] T110 [US3] Write the speed comparison in `packages/builder/ai/src/refine/refine-site.test.ts`
      — a refinement is ≥3× faster than a full regeneration, measured on uncontended runs only
      (SC-007)
- [ ] T111 [US3] Prove no second write path exists in
      `packages/builder/ai/src/refine/refine-site.test.ts` — refinement reuses the same
      validate/apply machinery as generation (FR-040)
- [ ] T112 [US3] Add the refinement conversation to
      `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.tsx` and its
      test
- [ ] T113 [US3] Export the refinement surface from `packages/builder/ai/src/index.ts` and re-export
      from `packages/builder/editor/src/index.ts`
- [ ] T114 [US3] Run the US3 gate: `pnpm exec vitest run packages/builder/ai/src/refine` plus the
      owning-package checks

**Checkpoint**: 🎯 **All three P1 stories are true together.** This is the delivery milestone.

---

## Phase 6: User Story 4 — Shared navigation and footer, decided once (P2)

**Goal**: Header and footer belong to the site; adding a page updates navigation everywhere.

**Independent Test**: Edit the shared footer once and see it on every page; add a page and see its
navigation entry appear without editing any other page.

- [ ] T115 [US4] Implement shared-region composition in
      `packages/builder/renderer/src/components/DocumentView.tsx` so a page renders its referenced
      regions
- [ ] T116 [US4] Implement navigation derivation from the page set in
      `packages/builder/extensions/blocks-marketing/src/components/NavLinks/NavLinks.tsx`
- [ ] T117 [US4] Write the propagation test in
      `packages/builder/renderer/src/components/DocumentView.test.tsx` — one footer edit reaches
      every page without modifying any page (FR-004)
- [ ] T118 [US4] Write the navigation-consistency test in
      `packages/builder/core/src/commands/site-commands.test.ts` — add, remove, and rename each
      change exactly one navigation entry (FR-005)
- [ ] T119 [US4] Write the opt-out test in
      `packages/builder/renderer/src/components/DocumentView.test.tsx` — a page opting out loses the
      region on that page only (FR-004)
- [ ] T120 [US4] Add shared-region editing to
      `packages/builder/shell/src/components/SitePages/SitePages.tsx` and extend its story and test
- [ ] T121 [US4] Run the US4 gate: the owning-package lint/typecheck/test for `builder-renderer`,
      `builder-core`, and `blocks-marketing`

---

## Phase 7: User Story 5 — Correct at every width, by construction (P2)

**Goal**: Every generated section carries deliberate narrow and medium behaviour. Nothing needs a
manual mobile pass.

**Independent Test**: Inspect every generated page at phone, tablet, and desktop. No horizontal
scroll, no overlap, no unreadable text.

- [ ] T122 [US5] Audit all twelve existing sections in
      `packages/builder/extensions/blocks-marketing/src/components/` and record which lack
      deliberate narrow behaviour in
      `specs/workspace/013-ai-full-site-design-agent/responsive-audit.md`
- [ ] T123 [US5] Add per-breakpoint prop defaults to every section identified by T122, using the
      existing `responsive` mechanism — no schema change (research R2)
- [ ] T124 [US5] Update each amended section's story with responsive states and its `.docs.mdx` with
      the responsive constraints
- [ ] T125 [US5] Make the structure stage emit `setResponsive` for every generated section in
      `packages/builder/ai/src/pipeline/stages/structure.ts` (FR-041)
- [ ] T126 [US5] Implement the Chromium overflow gate in
      `packages/builder/extensions/blocks-marketing/src/responsive.stories.tsx` — zero horizontal
      overflow and zero overlaps at 360, 768, 1024, and 1440 (SC-008)
- [ ] T127 [US5] Write the direction test in
      `packages/builder/ai/src/pipeline/generate-site.test.ts` — an Arabic brief sets the site
      direction and every generated layout follows it (FR-043)
- [ ] T128 [US5] Run the US5 gate: the Chromium responsive story plus
      `pnpm --filter @craftkit/builder-blocks-marketing lint typecheck test`

---

## Phase 8: User Story 6 — Real imagery, chosen from the project's library (P2)

**Goal**: Imagery is selected from the project library. The agent can never invent an address.

**Independent Test**: Populate a library, generate, and confirm every image position holds a library
asset or a labelled deliberate absence — and that zero references fail to resolve.

- [ ] T129 [US6] Implement the local library in
      `apps/playground/src/features/preview/local-asset-library.ts` with real `description`, `mood`,
      `palette`, and `alt` metadata
- [ ] T130 [US6] Implement the deterministic double in
      `packages/builder/ai/src/testing/fixed-asset-library.ts`
- [ ] T131 [US6] Implement selection in `packages/builder/ai/src/assets/select-assets.ts` — directed
      by the brief, consistent with the design system's palette and mood (FR-046)
- [ ] T132 [US6] Make the assembly stage reject any `AssetRef` absent from the site asset table in
      `packages/builder/ai/src/pipeline/stages/assembly.ts` (FR-045)
- [ ] T133 [US6] Write the property test proving zero unresolvable references and zero invented
      addresses in `packages/builder/ai/src/assets/select-assets.property.test.ts` (SC-012)
- [ ] T134 [US6] Write the degradation test in
      `packages/builder/ai/src/assets/select-assets.test.ts` — an empty, unavailable, or unsuitable
      library still completes the site with labelled absences (FR-051)
- [ ] T135 [US6] Implement asset resolution and the labelled-absence rendering in
      `packages/builder/extensions/blocks-marketing/src/components/Image/Image.tsx`, and update its
      story, docs, and test
- [ ] T136 [US6] Write the vanished-asset test in
      `packages/builder/schema/src/site/validate.test.ts` — a removed asset degrades one image and
      the site STAYS valid

### `AssetPicker` component — `@craftkit/builder-shell` (layer 3)

- [ ] T137 [US6] Implement `AssetPicker` in
      `packages/builder/shell/src/components/AssetPicker/AssetPicker.tsx` — every image has alt
      text, the empty state is text and not a blank box
- [ ] T138 [US6] Add the local export in
      `packages/builder/shell/src/components/AssetPicker/index.ts`
- [ ] T139 [US6] Write typed CSF stories in
      `packages/builder/shell/src/components/AssetPicker/AssetPicker.stories.tsx` — populated, empty
      library, unavailable, filtered, RTL
- [ ] T140 [US6] Write `packages/builder/shell/src/components/AssetPicker/AssetPicker.docs.mdx`,
      documenting the port contract and the empty behaviour
- [ ] T141 [US6] Write behavioural tests in
      `packages/builder/shell/src/components/AssetPicker/AssetPicker.test.tsx` — selection callback
      and the empty-library labelled absence
- [ ] T142 [US6] Export the picker from `packages/builder/shell/src/index.ts` and re-export from
      `packages/builder/editor/src/index.ts`
- [ ] T143 [US6] Run the US6 gate: `pnpm exec vitest run packages/builder/ai/src/assets` and
      `pnpm check:components` (expected 64)

---

## Phase 9: User Story 7 — Prove it competes, and prove it is not a template (P3)

**Goal**: The competitive claim is measured, by people, with durable evidence.

**Independent Test**: Run the recorded protocol end to end and produce its scored record.

- [ ] T144 [US7] Write the fixed brief set — ten briefs across ten unrelated industries — in
      `specs/workspace/013-ai-full-site-design-agent/evaluation/briefs.md`
- [ ] T145 [US7] Implement the distinctiveness measurement in
      `packages/builder/ai/src/pipeline/distinctiveness.test.ts` — across the ten briefs, no two
      sites share a design system and ≥8 of 10 pairs differ measurably in primary colour, type
      pairing, page set, and section order (SC-004). Imagery is EXCLUDED while the library is small;
      state that in the test
- [ ] T146 [US7] Write the blind comparison protocol in
      `specs/workspace/013-ai-full-site-design-agent/evaluation/protocol.md` — source concealment,
      the three scoring axes, and the rater instructions
- [ ] T147 [US7] Define the durable evidence format in
      `specs/workspace/013-ai-full-site-design-agent/evaluation/evidence-format.md` — briefs,
      outputs, raters, scores, thresholds (FR-054)
- [ ] T148 [US7] Record the completed evaluation results in
      `specs/workspace/013-ai-full-site-design-agent/evaluation/results.md`. **BLOCKED on the
      user**: needs ≥3 human raters and a reference-competitor account. No automated substitute
      counts

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T149 [P] Write the ADR for the site model and the layer-0 token relocation in
      `docs/architecture/decisions/0006-builder-site-model-and-design-tokens.md`, linking this
      feature's approved artifacts
- [ ] T150 [P] Update `docs/architecture/frontend.md` and `docs/architecture/overview.md` for the
      site model
- [ ] T151 [P] Update the package READMEs for `packages/builder/{schema,core,transforms,ai,shell}`
      with their new public surface
- [ ] T152 Update `packages/builder/ai/README.md` — the invariant now reads "AI proposes kernel
      commands; it never writes a document OR a site", and the `mode: 'sequence'` limitation is
      resolved by `dispatchGroup`
- [ ] T153 Review the real diff against `.specify/agents/rules/code-review.md`, reporting findings
      in severity order
- [ ] T154 Fix every accepted review finding and re-run the narrow checks for each touched package
- [ ] T155 Run the full cross-cutting gate: `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify` —
      read pnpm's OWN exit code, not a wrapper's, and confirm `check:components` reports 64
- [ ] T156 Run `/speckit-converge` and append any remaining artifact gaps to this file
- [ ] T157 Refresh `.specify/agents/HANDOFF.md` and `.specify/agents/context.json` for the delivered
      state
- [ ] T158 Generate a Conventional Commit message proposal from the verified diff, TEXT ONLY — no
      `git add`, no `git commit`. Commit authorization remains withheld

---

## Dependencies

**Story completion order**: US1 → US2 → US3 (all P1, must ship together) → US4, US5, US6 (P2,
mutually independent) → US7 (P3, depends on US1 and US2 existing).

**Blocking chain**:

- Phase 1 (Setup) → Phase 2 (Foundational) → every story phase
- Within Phase 2: 2a → 2b → 2d → 2e → 2f → 2g → 2h. Sub-phase 2c is parallel with 2b
- T010 (token move) blocks T012, T016, T053, T090
- T027 (`dispatchGroup`) blocks T058, T064, T104, T108
- T032 (site codec) blocks T039–T045
- T048–T049 (stage contracts) block T050–T058
- T058 (`generateSite`) blocks T104 (refinement reuses its machinery)
- T144 (brief set) blocks T145 and T148
- T160 → T161; T162 → T163; T165 → T166; T167 → T168; T169 → T170; T173–T174 → T175; T160–T175 block
  T176–T178
- US8's Skills runtime is independent of the site schema substrate, but T170/T172 serialize on the
  already-dirty AI/core integration files and MUST NOT run beside another writer on those paths

**Deliberately deferred**: per [plan.md](./plan.md)'s open item, Phase 7's block-vocabulary breadth
is scoped from the structure stage's real needs — T122 runs AFTER T051 exists, so the block list is
derived rather than guessed.

## Parallel Opportunities

- **Phase 1**: T002, T003
- **Phase 2**: sub-phase 2c (T018–T020) runs alongside 2b (T010–T017) — disjoint paths
- **Phase 3**: T050, T051, T052, T053 are four separate stage files
- **Phase 2i**: T160/T162/T167/T169/T174 are test-first tasks over disjoint new or test files until
  their paired implementations begin; all shared barrels and plan/core integration remain serial
- **Phase 3 UI**: `GenerationProgress` (T067–T071), `SitePages` (T072–T076), and `SiteBriefForm`
  (T078–T082) are three disjoint component folders in two packages
- **Phase 10**: T149, T150, T151

**Never parallel**: any two tasks touching `packages/builder/schema/src/index.ts`,
`packages/builder/shell/src/index.ts`, or `packages/builder/editor/src/index.ts`. Those are shared
barrels and every export task serializes on them.

## Implementation Strategy

**MVP** is Phase 1 + Phase 2 + Phase 3 (US1) — a brief becomes a complete, valid, navigable site.

**Delivery milestone** is the end of Phase 5: US1, US2, and US3 true together, which is the point at
which the product is competitive rather than merely functional.

**Incremental after that**: US4, US5, and US6 are independent and may be delivered in any order or
in parallel by path-disjoint agents. US7 measures the rest and cannot be self-certified — it is the
one phase whose completion is not in an implementing agent's gift.

**Agent-core prerequisite added 2026-09-01**: US8 (T159–T178) precedes the competitive P1 milestone
and may land independently of the site model because it only widens the existing command planner.

**Total**: 178 tasks. Setup 3 · Foundational 44 · US8 20 · US1 38 · US2 18 · US3 11 · US4 7 · US5 7
· US6 15 · US7 5 · Polish 10.
