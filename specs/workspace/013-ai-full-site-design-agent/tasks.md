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
- [x] T012 Define `DesignSystem` (name, tokens, typography, pairings, seed) in
      `packages/builder/schema/src/theme/design-system.ts` per [data-model.md](./data-model.md) §2
- [x] T013 Implement `contrastRatio()` as a pure function in
      `packages/builder/schema/src/theme/contrast.ts`
- [x] T014 Implement `validateDesignSystem()` in `packages/builder/schema/src/theme/validate.ts` —
      rejects an unknown token key and any authorized pairing below 4.5:1 normal / 3:1 large
      (FR-014)
- [x] T015 [P] Write design-system validator tests in
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
- [x] T027 Implement `dispatchGroup()` in `packages/builder/core/src/commands/dispatch-group.ts` —
      all-or-nothing, one history entry, one `author`, a human label. This closes the
      `mode: 'sequence'` gap that FR-034 and FR-037 require (research R5)
- [x] T028 Write `dispatchGroup` tests in
      `packages/builder/core/src/commands/dispatch-group.test.ts` proving one undo step reverses the
      whole group, and that a mid-group failure applies nothing
- [x] T029 Verify the log/history-before-`store.write` ordering still holds for grouped dispatch in
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
      fingerprints reach the provider in `packages/builder/ai/src/context/skill-context.test.ts`
- [x] T166 [US8] Integrate prepared Skills into `AssembledAiContext`, context assembly, and
      `generateAiPlan()` through additive options in
      `packages/builder/ai/src/{types.ts,context/assemble-context.ts,plan/generate-plan.ts}`
- [x] T167 [US8] Write cache red tests for memory/fragment/block/template/skill changes and an
      already-aborted cache hit in `packages/builder/ai/src/provider/caching-provider.test.ts`
- [x] T168 [US8] Make cache identity cover the complete canonical assembled context and check
      cancellation before lookup/return in `packages/builder/ai/src/provider/caching-provider.ts`
- [x] T169 [US8] Write command-policy red tests in
      `packages/builder/ai/src/skills/command-policy.test.ts` proving host/skill intersection, deny
      precedence, command cap, unknown command refusal, and zero scratch/live writes
- [x] T170 [US8] Implement command-policy composition and enforce it in plan parse/validation/repair
      through `packages/builder/ai/src/skills/command-policy.ts` and
      `packages/builder/ai/src/plan/{generate-plan,validate-plan,apply-plan}.ts`
- [x] T171 [US8] Restore the approved one-repair default in
      `packages/builder/ai/src/plan/generate-plan.ts` and update its tests; a third provider attempt
      must be impossible unless a later versioned contract explicitly changes the budget
- [x] T172 [US8] Extend grouped dispatch with the backward-compatible `{ author, label }` options,
      use the plan rationale as the AI history label, and make scratch preflight execute the same
      grouped door in `packages/builder/core/src/commands/dispatch.ts`,
      `packages/builder/core/src/kernel/create-builder.ts`, and AI plan tests; reject invalid
      runtime authors before any state/provenance change
- [x] T173 [US8] Define `AiAgentRunState`, typed sequenced `AiAgentEvent`, bounded policy, and typed
      outcomes in `packages/builder/ai/src/agent/types.ts`
- [x] T174 [US8] Write runner red tests in `packages/builder/ai/src/agent/run-agent.test.ts` for
      event order, injected time/run id, explicit Skills, propose-only, auto apply, one transaction
      and undo, failure, pre-abort, mid-run cancellation, host-owned run supersession, fail-closed
      runtime modes, and no stale/post-terminal event/write
- [x] T175 [US8] Implement the UI-independent bounded coordinator in
      `packages/builder/ai/src/agent/run-agent.ts`
- [x] T176 [US8] Export the skills/agent surfaces from `packages/builder/ai/src/index.ts`, update
      `packages/builder/ai/README.md` with the progressive-disclosure and capability-intersection
      invariants, and add an integration example that supplies a host Skill
- [x] T177 [US8] Run named mutation checks for cache context identity, skill dependency/conflict
      resolution, policy intersection, cancellation-before-apply, and exactly-one-terminal-event;
      observe each failing test before restoring the source
- [x] T178 [US8] Run the US8 gate: focused Skills/agent/core tests, `builder-ai` lint/typecheck/test
      and coverage, `builder-core` lint/typecheck/test, `builder-schema` lint/typecheck/test,
      `pnpm check:workspace`, `pnpm check:boundaries`, and `git diff --check`; record unavailable or
      unrelated failures separately in `verification-agent-skills.md`

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

- [x] T067 [US1] Implement `GenerationProgress` in
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.tsx` — named
      stages, `aria-live` polite announcements, a keyboard-reachable cancel, no focus steal
- [x] T068 [US1] Add the local export in
      `packages/builder/shell/src/components/GenerationProgress/index.ts`
- [x] T069 [US1] Write typed CSF stories in
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.stories.tsx` —
      idle, each running stage, complete, failed, cancelled, RTL, plus a `play` interaction for
      cancel
- [x] T070 [US1] Write
      `packages/builder/shell/src/components/GenerationProgress/GenerationProgress.docs.mdx` —
      purpose, stage vocabulary, cancel contract, accessibility, limitations
- [x] T071 [US1] Write behavioural tests in
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

**Total before the production-readiness audit**: 178 tasks. Setup 3 · Foundational 44 · US8 20 · US1
38 · US2 18 · US3 11 · US4 7 · US5 7 · US6 15 · US7 5 · Polish 10.

---

## Phase 11: User Story 9 — Production Agent Readiness (P0, executes before Phase 3)

**Goal**: Make the already-built Skills/runner core the only Assistant execution path, fit the real
Playground request inside its complete-wire budget, and close the authority/resource/trust gaps
found by the 2026-09-01 audit before the full-site pipeline builds on them.

**Scope lease**: `packages/builder/ai/**`, the narrow ContextFragment/JSON-schema additions in
`packages/builder/schema/**`, `apps/playground/src/features/preview/components/AssistantPanel/**`,
the Playground readiness test, `scripts/ai-plan-bridge.mjs`, and this feature's artifacts. Custom
CSS is explicitly deferred. `.mcp.json`, `CLAUDE.md`, unrelated blocks, and unrelated UI are
excluded.

### 11a — Reproduce and remove the real-context outage

- [x] T179 [US9] Record the reproduced readiness baseline (54 blocks, 4 templates, 27 landing nodes,
      121,291/114,321 estimated wire tokens, 64,000 budget, provider call count zero) and the exact
      read-only probe command in
      `specs/workspace/013-ai-full-site-design-agent/verification-agent-readiness.md`
- [x] T180 [US9] Write the real-Playground red gate in
      `apps/playground/src/features/preview/assistant-agent-readiness.test.ts` for landing and empty
      fixtures: the complete request stays below 64,000, calls the provider exactly once, and no
      built-in catalog/document datum is serialized twice (FR-077, FR-078, SC-020)
- [x] T181 [US9] Write context-contract red tests in
      `packages/builder/ai/src/context/assemble-context.test.ts` and
      `assemble-context.contract.test.ts` for one canonical built-in representation, additive
      extension providers, explicit omission metadata, command-policy filtering, property intent,
      and versioned output-contract presence
- [x] T182 [US9] Extract one canonical JSON serializer/token estimator under
      `packages/builder/ai/src/internal/canonical-json.ts` and replace the copies in context, wire,
      and caching code; add equality/cache/budget tests (FR-088)
- [x] T183 [US9] Extend `ContextFragment` and the least-authority context catalog in
      `packages/builder/schema/src/extensions/contribution-points.ts` with validated/frozen
      `source`, `kind`, and `trust` data plus command/property-intent summaries; expose only JSON
      data, never registered implementations (FR-080, FR-085)
- [x] T184 [US9] Refactor `packages/builder/ai/src/context/assemble-context.ts` so structured
      block/template/document/selection fields are the sole built-in wire representation,
      `fragments` contains only additive provider/Skill/memory data, and an
      `additionalContextProviders` option composes without silently replacing registry defaults
- [x] T185 [US9] Add a deterministic command catalog and plan-output contract to
      `AssembledAiContext`, generated from live registered command schemas and filtered by the
      effective policy before serialization; remove every hand-maintained command vocabulary from
      `scripts/ai-plan-bridge.mjs` (FR-079)
- [x] T186 [US9] Preserve block `propertyGroups`/intent in AI context while rejecting any AI plan
      that authors a property declared `utility-classes`; remove the bridge instruction that asks
      the model to write `className` (FR-058, FR-080)
- [x] T187 [US9] Run the canonical-context gate: focused schema/AI context/wire/cache tests plus the
      real Playground readiness test, and record exact before/after wire sizes in
      `verification-agent-readiness.md`

### 11b — Pin authority and bound nested work

- [x] T188 [US9] Write red tests in `packages/builder/ai/src/skills/command-policy.test.ts` and
      `plan/validate-plan.test.ts` proving `applyPatches` is denied by default, explicit permission
      still charges every nested patch, and 5,000 patches fail before scratch/live work (FR-082,
      SC-021)
- [x] T189 [US9] Add an exported `maxOperations` run bound and pre-materialization command-cost
      accounting in `packages/builder/ai/src/skills/command-policy.ts`; keep intentional
      `restrictToCommands: []` as deny-all and add a specific Skill-resolution diagnostic
- [x] T190 [US9] Write red tests across `plan/{generate-plan,preview-plan,apply-plan}.test.ts`
      proving preview/manual apply/auto apply cannot omit or broaden the policy under which a
      proposal was validated (FR-081, SC-022)
- [x] T191 [US9] Introduce a detached, deeply frozen validated-proposal value that pins plan,
      effective policy, active Skill fingerprints, and context identity; make preview/apply consume
      it, retaining only an explicit-policy compatibility path that fails closed at runtime
- [x] T192 [US9] Return the pinned proposal from `runAiAgent`, recheck it immediately before grouped
      apply, and update all package consumers/tests so no policy-less public application remains
- [x] T193 [US9] Run named mutation checks that remove apply-time policy, re-enable default
      `applyPatches`, and undercount nested patches; observe the readiness tests fail before
      restoring each source (SC-026)

### 11c — Provider, memory, and diagnostic hardening

- [x] T194 [US9] Write local-provider red tests for own-property number-word lookup and exported
      collection limits, including `constructor`, `2025`, and a maximum-safe-integer request
- [x] T195 [US9] Clamp every request-derived local-provider collection before allocation in
      `packages/builder/ai/src/provider/local-provider.ts`, use `Object.hasOwn`, and report a
      bounded refusal/omission rather than allocating past the cap (FR-083)
- [x] T196 [US9] Write remote-provider red tests for endpoint scheme policy, redirect refusal,
      `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, response-version mismatch, reader
      cancellation on handler failure, and throwing-progress isolation
- [x] T197 [US9] Implement the remote fetch/stream hardening in
      `packages/builder/ai/src/provider/remote-provider.ts`, allowing insecure HTTP only through an
      explicit development option while preserving injected-fetch testability (FR-084)
- [x] T198 [US9] Define stable provider/run error codes, refusal and retryability semantics, and a
      versioned invalid-output response that can enter the one existing repair round without
      loosening command validation (FR-087)
- [x] T199 [US9] Reuse that taxonomy through JSON/SSE/cache/runner/UI paths, cancel readers in
      `finally`, and isolate provider progress/event observers so observer failures cannot become
      transport failures (SC-024)
- [x] T200 [US9] Write provenance/memory red tests proving prompt-looking extension/Skill bodies
      remain typed data and model-authored rationale is never replayed as durable instruction
      context (FR-085, FR-086, SC-023)
- [x] T201 [US9] Replace raw Markdown rationale memory in
      `packages/builder/ai/src/context/memory-provider.ts` and Assistant integration with bounded,
      host-authored structured outcome records carrying source/kind/trust
- [x] T202 [US9] Run provider/local/memory/runner focused gates and named mutations for allocation
      caps, stream cleanup, typed errors, and memory-role separation

### 11d — Make the Playground use the agent that was built

- [x] T203 [US9] Write Assistant integration red tests proving Ask and Auto enter `runAiAgent`, pin
      Built-in/host Custom Skills, expose activation/event data, preserve cancellation/supersession,
      and never call the direct generate/apply pair (FR-089, SC-025)
- [x] T204 [US9] Refactor
      `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.tsx` to use
      `runAiAgent` for both modes, accept an optional host `AiSkillRegistry` and selected Skill ids,
      show activated versions/fingerprints, and apply only the runner's pinned proposal
- [x] T205 [US9] Update the existing AssistantPanel story, MDX, and behavioural tests for Skill
      activation, typed refusal/retry, context-budget failure, stop/supersession, and Ask/Auto
      outcomes without redesigning the visual surface in this phase
- [x] T206 [US9] Update `packages/builder/ai/README.md` and the Playground integration docs with the
      canonical context, pinned proposal, Custom Skill, error taxonomy, and unsafe-command rules;
      document why `p-limit` is deferred until a measured multi-page fan-out exists

### 11e — Release gate and evidence

- [x] T207 [US9] Run `@craftkit/builder-schema`, `@craftkit/builder-ai`, and `@craftkit/playground`
      lint/typecheck/test/coverage plus `pnpm check:workspace`, `pnpm check:boundaries`, and
      `git diff --check`
- [x] T208 [US9] Run two fresh independent reviews with different lenses: command/context
      correctness and security/resource/trust boundaries; fix every accepted Critical/High/Medium
      finding and rerun its narrow gate
- [x] T209 [US9] Run the real landing/empty readiness proof and all SC-020–SC-026 mutation evidence
      again after integration; append exact results to `verification-agent-readiness.md`
- [x] T210 [US9] Run the affected cross-cutting verification gate, distinguishing unavailable
      Chromium evidence from passing package/jsdom evidence; do not claim browser proof from jsdom
- [x] T211 [US9] Refresh `.specify/agents/HANDOFF.md` and `.specify/agents/context.json` with exact
      changed files, commands, outcomes, residual risks, and the next uncompleted 013 task; propose
      no commit unless separately authorized

**Checkpoint**: The real Assistant reaches its provider, carries Custom Skills through the bounded
runner, and has one canonical, policy-pinned, resource-bounded path from request to grouped command
application. Phase 3 may build the full-site pipeline on this foundation.

**Total after the production-readiness audit**: 211 tasks.

---

## Phase 12 — Catalog economy and free composition (US10)

**Why this phase exists.** The assembled context was measured at 61,578 tokens against a hard budget
of 64,000 (`DEFAULT_AI_CONTEXT_TOKEN_BUDGET`) — 96% consumed before the user's first character, and
94% of it the block catalog, shipped whole on every request whether or not the request touched a
block. The same measurement exposed the ceiling on design: a request the 54-block catalog had no
shape for had no answer but "the nearest section that already exists".

Both are one problem. The catalog is expensive BECAUSE every shape must be pre-registered; make the
assistant able to compose, and the catalog no longer has to be exhaustive on the wire.

### 12a — Catalog modes

- [x] T212 [US10] Split `collectBlocks` in `packages/builder/ai/src/context/assemble-context.ts`
      into index/detail entry builders behind an `AiCatalogMode` (`index` | `scoped` | `full`); keep
      the type sort outside the mode branch so an unchanged registry still serializes to identical
      bytes (the precondition for prompt caching)
- [x] T213 [US10] Add `AiCompositionPolicy`
      (`packages/builder/ai/src/context/composition-policy.ts`) as the single per-run dial, every
      key optional and every `undefined` resolving to the freest behaviour that works; resolve once
      at the assembly boundary so no downstream code re-derives a default
- [x] T214 [US10] Make `AiBlockContext.propsSchema`/`examples`/`slots` optional and guard the one
      consumer (`local-provider.ts`), degrading to "not a candidate" rather than proposing an
      insertion the door would reject
- [x] T215 [US10] Thread the policy through `generateAiPlan`, deriving `scoped` types from the
      existing `selectedBlockTypes` so the host cannot disagree with the selection the same request
      was assembled against
- [x] T216 [US10] Keep `full` as the default: a cheaper default is correct only once the assistant
      can build without per-block schemas, and trading cost for a broken proposal is not a trade the
      library may make on a caller's behalf

### 12b — The composition block

- [x] T217 [US10] Add the custom-code tree contract
      (`packages/builder/schema/src/custom-code/custom-code-tree.ts`): 33-tag vocabulary,
      8-attribute allowlist, depth AND node ceilings enforced by an ITERATIVE pre-check piped ahead
      of shape validation (a recursive guard overflows before zod runs)
- [x] T218 [US10] Add `CustomCode` to the renderer, following the `RichText` precedent exactly —
      tolerant read, allowlisted tags, `safeHref`-style `src` policy, and no
      `dangerouslySetInnerHTML` on any path
- [x] T219 [US10] Resolve component references through a renderer-owned React context carrying a
      `RegistryRead.block` LOOKUP (not a kernel), provided by both `DocumentView` and
      `StaticDocument`, so publishing resolves references with no kernel present
- [x] T220 [US10] Validate a reference's props against the referenced block's OWN schema before
      rendering; fail to `UnknownBlock` rather than render a half-configured component
- [x] T221 [US10] Ship `@craftkit/builder-custom-code` (block, scoped-CSS door, Inspector fields)
      and register `customCode` in the page root vocabulary
- [x] T222 [US10] Exempt the escape hatch from the economy that makes it necessary
      (`alwaysDetailedBlockTypes`): in `index` mode every other block loses its schema, and a
      `customCode` without one would tell the model an escape hatch exists and give it no way to
      write one

### 12c — Styling freedom, and the two laws that bound it

- [x] T223 [US10] State the runtime utility vocabulary as DATA
      (`packages/builder/schema/src/custom-code/utility-vocabulary.ts`, 57 patterns → 2,697
      utilities) and GENERATE the application's `@source inline(...)` directives from it; a drift
      gate in `apps/playground` fails if the two stop matching
- [x] T224 [US10] Refuse, at the AI door, a tree class with no generated CSS — the failure that
      otherwise works in dev, vanishes in the production build, and reports nothing either way
- [x] T225 [US10] Reserve the `ck-` namespace for classes styled by a region's own stylesheet;
      without it the `css` prop existed and was unusable, since no selector could match a class the
      door admitted. Bracketed names are refused even under the prefix
- [x] T226 [US10] Run BOTH class laws over a tree — `findRejectedUtilities` (theming: no arbitrary
      values, no default palette) and `unknownUtilityClasses` (generation) — and prove by test that
      no vocabulary entry can ever contradict the theming law
- [x] T227 [US10] Add `pageCss` to the page root and `css` to each region, sanitised by a shared
      refusal list (7 constructs) and scoped by selector rewriting, with `@keyframes`/`@font-face`
      passing through untouched
- [x] T228 [US10] Declare both stylesheet props with a `customCss()` marker so the Inspector matches
      on a DECLARATION, never a property name

### 12d — Editing and identity

- [x] T229 [US10] Contribute lazy Inspector controls for the tree and the stylesheet; both parse
      before committing, refuse rather than strip, and dispatch once per edit session rather than
      per keystroke (one undo entry per character makes undo useless for exactly the edit it matters
      on)
- [x] T230 [US10] Read a node's own `label` in `blockDisplayName` — the single place a node is
      named, so the layers tree and screen-reader announcements improve together, and any block
      declaring a `label` prop gets the behaviour without a second declaration

### 12e — Evidence

- [x] T231 [US10] Cost gate against the REAL registry (`apps/playground`): `full` 63,782 · `index`
      8,330 · `scoped` 9,484 tokens, with the index figure decomposed in the test so a regression
      names its own cause
- [x] T232 [US10] Canvas/static parity suite: identical markup from `DocumentView` and
      `renderStaticMarkup`, scoped CSS present in published output, refused CSS absent from it
- [x] T233 [US10] Example-validity suite: the shipped catalog example — the model's only instruction
      manual, and present in every mode — passes every gate a real proposal passes
- [x] T234 [US10] `pnpm lint` (28/28), `pnpm typecheck` (27/27), and per-package tests across
      schema/renderer/ai/custom-code/shell/core/playground, green across two consecutive full runs

**Checkpoint**: The catalog is a per-run decision rather than a constant, the assistant can compose
what no registered block expresses, and every class and stylesheet it writes passes a door that
names what it refused.

### Deliberately NOT done, and why

- **The default is still `full`.** Flipping it to `index` now saves ~87% for every host without them
  asking; that is a product decision, not a library one, and it is one value change away.
- **`remote-provider` still has no server.** The wire contract is complete and tested; nothing
  behind it exists, so every measurement here is of the request that WOULD be sent.
- **`kernel-laws.test.ts` flakes under parallel load.** Measured in isolation, `validate()` costs
  32ms at a 1.19 ratio — unchanged by this work. The flake is its final wall-clock assertion
  (`bigBest < 2000`), which the test's own comment argues wall-clock assertions should not be. Left
  alone: it is an unrelated guard test, and its fix is one line someone should make deliberately.

**Total after the catalog-economy phase**: 234 tasks.

---

## Phase 13 — The Claude server, and the review that followed (US10)

**Why this phase exists.** Every measurement in Phase 12 was of a request that WOULD be sent:
`remote-provider` was a tested wire contract with nothing behind it. This phase puts a server there,
then reviews the whole of Phases 12–13 for anything green-but-broken — and finds one.

### 13a — `@craftkit/ai-server`

- [x] T235 [US10] `apps/ai-server`: one POST, three answers (plan / refusal / versioned
      invalid-output), platform `Request`/`Response` so the handler is framework-free and testable
      without a socket
- [x] T236 [US10] Prompt layout as the cost design: frozen rules → catalog (cache breakpoint) →
      document/history/request in `messages`; breakpoint written only when the segment clears the
      ~1024-token cache floor
- [x] T237 [US10] `output_config.format` = the JSON Schema the request CARRIES
      (`context.outputContract.schema`) — the shape the model is constrained to and the shape the
      door accepts have one source
- [x] T238 [US10] Failure translation with the client's taxonomy intact: refusal is `200`,
      rate-limit `429`, bad upstream `400`, missing key `500` + plain sentence, disconnect `499`; no
      SDK message or stack ever crosses
- [x] T239 [US10] SSE: `status` frames from Claude's own thinking summary, exactly one `result`;
      client disconnect aborts the SDK call
- [x] T240 [US10] SDK pinned to the newest release inside the repo's `minimumReleaseAge` (0.122.0);
      0.72 lacked adaptive thinking and `stop_details`
- [x] T241 [US10] `catalogPolicyFor`: catalog mode is a property of the PROVIDER — offline scores on
      schemas and needs `full`; a model needs names and gets `index`/`scoped`. `runAiAgent` gained
      `composition` so the canonical path can carry it at all

### 13b — What the review found

- [x] T242 [US10] **The server did not start.** Lint, typecheck, 29 tests: green.
      `node     --experimental-strip-types src/main.ts`: `ERR_MODULE_NOT_FOUND` on the first
      extensionless import inside `@craftkit/builder-ai`. Fixed by building (Vite SSR,
      `noExternal: @craftkit/*`, ~20 kB `dist/main.js`) and by splitting the untested Node adapter
      into `server.ts` with socket-level tests (port 0, real fetch, abort-on-disconnect)
- [x] T243 [US10] The cost gate measured the CONTEXT while the budget charges the WIRE request;
      re-pointed at `estimateAiPlanWireRequestTokens`. Measured: `full` fits a bare request with
      ~200 tokens of headroom and overflows on the **twelfth** short follow-up
- [x] T244 [US10] `kernel-laws` wall-clock backstop raised 2 s → 20 s with the measurement written
      in (32 ms isolated, >2 s under `pnpm test` contention, ratio 1.19 throughout)
- [x] T245 [US10] Storybook indexing: 29 stories files carried `tags: ['autodocs']` beside an
      attached `*.docs.mdx`; Storybook 10 refuses the pair. Tag removed where an attached page
      exists (2 kept), rule recorded in `.storybook/main.ts`. Result: 461/463 stories run in
      Chromium where none ran before
- [x] T246 [US10] Regenerated Tailwind vocabulary verified a strict superset of the previous one
      (1,293 → 2,697, 0 lost) — the check the regeneration should have shipped with
- [x] T247 [US10] `apps/playground/.env.example` documenting the two endpoint variables
- [x] T248 [US10] **Found by the first Chromium run that ever got past indexing**:
      `catalogPolicyFor` inferred `remote` from `planProvider !== undefined`, so every story double
      that wraps `createLocalAiPlanProvider()` (fail-then-succeed, answer-late) was handed an
      `index` catalog and proposed nothing — two stories failed with "no Apply button". Replaced
      inference with a declared `providerKind` prop on `AssistantPanel`; `App.tsx`, the one place
      that knows it wired a remote provider, says `'remote'`; every other caller defaults to
      `'offline'`. Six unit tests pin the decision table

**Checkpoint**: A request from the playground reaches Claude and comes back as a validated plan. The
one gate that never existed — "does the process start" — now does.

- [x] T249 [US10] Catalog mode `'none'`: the escape hatch plus the selected/mentioned blocks in
      full, and no other block at all — not even by name. The playground's remote path runs under
      it; `generate-plan` derives the added blocks from the selection. The server now ships the
      exact utility vocabulary (57 patterns, ~750 cached tokens) in the prompt's stable segment, and
      its rules forbid inventing a component type: a reference is valid only for a type in the
      catalog given

- [x] T250 [US10] Icons: `lucide@1.38.0` (mature per `minimumReleaseAge`) as a renderer dependency;
      an `icon` LEAF node kind in the tree (name/size/strokeWidth/className/label) instead of an
      `svg` tag, so no drawing surface is ever opened; 1,791 kebab names generated into layer 0 from
      lucide's per-icon FILES (PascalCase keys are ambiguous: `ArrowDown01`) with a renderer drift
      test; the door refuses an unknown icon by name; synchronous drawing keeps canvas/static
      parity. Found by the first test run: Lucide has no brand logos, and the prompt's own examples
      used `github` — examples and rules corrected, and a door test pins the `github` refusal

- [x] T251 [US10] `page-independence.property.test.ts` (schema) timed out at the 5 s default under
      `pnpm test` contention (8,032 ms; passes alone) and took 17 dependent packages down with it.
      Given a 30 s timeout with the measurement in the comment — the same treatment as
      `kernel-laws`, for the same reason: fixed seed, constant work, variable spare CPU

- [x] T252 [US10] **Found by the first LIVE run** (the owner, a real key, Arabic request "a farewell
      banner over a travel photo from the internet"): the plan was refused for raw colour codes and
      the assistant had to retreat to tokens and a panel. Three laws had been applied to composed
      regions that the product's owner never wanted there: the AI door's theming law on tree
      classes, the kernel door's raw-literal scan on `css`/`tree` props, and the CSS sanitizer's
      refusal of every external `url()`. Now: `colourPolicy` defaults to `'free'` (Tailwind's
      palette generated into the vocabulary, +2,178 utilities); `customCss()`/`customCodeTree()`
      props are exempt from the raw-literal scan; `url(https://…)` is allowed (http and `//` still
      refused); the prompt says colours and images are free and where exact values go. The theming
      law is one policy value away, and untouched for registered blocks
- [x] T253 [US10] `manager.test.ts` SC-005 (core) timed out under `pnpm test` load like the two
      before it; 30 s timeout with the measurement, same rationale. `apps/playground` gained
      `generate:vocabulary` so the Tailwind block is regenerated by a script, not by hand

- [x] T254 [US10] **From the owner's screenshot**: a refused stylesheet was dropped whole and the
      canvas said nothing — an unstyled panel with no reason. `CustomCodeBlock` and the page root
      now render a `role="note"` naming the refused construct on the canvas only; the published page
      never carries it. Four tests, including the https background image that used to vanish

- [x] T255 [US10] CSS sanitizer hardening: the refusal list is matched against a normalised copy
      (comments stripped, hex and character escapes decoded) so `@\69mport`, `u\72l(`, and
      `@/**/import` are refused as the browser would read them; rendered text is untouched. Web-font
      `@import` from `fonts.googleapis.com` / `fonts.bunny.net` (https only, exact host) is allowed
      and lifted in front of the scoped rules; look-alike hosts and a second import behind a font
      import are still refused. 12 new tests
- [x] T256 [US10] `a` and `button` join the tag vocabulary (35): `href` through `safeHref` (which
      now also admits `tel:` — a contact section links a phone number, and the scheme has no script
      surface), `rel="noopener noreferrer"` on external links, only `target="_blank"`, clicks
      swallowed on the canvas; `button` is always `type="button"` with no handler. 9 new tests. A CV
      page without a link was the argument

- [x] T257 [US10] The last two Chromium failures, diagnosed by running them (a temporary
      `console.log` of computed styles, then removed): both were STALE STORIES, not product defects.
      `Hero > Unthemed Publish Contract` read `rowGap` off the outer column, which holds one child
      and never had a gap — the rhythm lives on the copy stack (`gap-6`); it now measures there.
      `VideoSection > Split` quoted example copy that had been rewritten; it now asserts against the
      rendered example's own heading and video label. Filtered Chromium run: 7 passed (the two
      included). Storybook is expected at 463/463 on the next full run

- [x] T258 [US10] **Port 8787 was not this server.** `scripts/ai-plan-bridge.mjs` — an older
      CLI-spawning dev bridge with its own prompt — had held the playground's endpoint for hours;
      every "live run" went there, and its wording is the "invalid plan response" in the owner's
      screenshot. The bridge is now marked DEPRECATED in its header and warns at startup; the server
      README and `.env.example` say how to check the port. `DEFAULT_MAX_TOKENS` raised 16k → 32k: a
      six-region landing page as a JSON tree runs to 15–25k output tokens, and a cut-off plan is no
      plan. The verification record's "first live run" section corrected

- [x] T259 [US10] **Skills activate by script, not by verb.** The activation verifier showed the
      Arabic/RTL Skill firing only on four listed imperatives ("صمم لي" …) and staying silent on
      "اعمل معرض أعمال" and "بانر وداع سامر ووسيم" — the same page, laid out differently by the
      verb. `activation.scripts: ['arabic' | 'latin']` is a third auto trigger (any character of the
      writing system, presentation forms and Persian/Urdu letters included), validated in
      `define-skill` like the other two and matched in `resolve-skills`. New
      `craftkit.occasion-page` archetype (invitation, wedding, farewell, greeting, condolence;
      priority 85, conflicts with the landing and CV archetypes, depends on copywriting) with Arabic
      and English keywords; design-direction gains darker/lighter/background asks and accessibility
      gains readability asks in both languages. Matrix now ten requests (5 ar / 5 en), every Arabic
      row carries the RTL Skill, all rows within three auto Skills and the 2,400-token row ceiling.
      `script-activation.test.ts` pins the trigger, its canonical form, the refusal of unknown
      scripts, and the duplicate rule. README documents the three triggers and the floor-plus-three
      budget. Gates: builder-ai 372/372, playground 102/102, typecheck and lint clean.

- [x] T260 [US10] **"Failed to fetch" was CORS, and the port was split.** The browser resolves
      `localhost` to `::1` first, which reached this server (bound `*:8787`) while the deprecated
      bridge held `127.0.0.1:8787` — both listening, neither failing. The server answered the
      preflight OPTIONS with 405 and no `Access-Control-Allow-Origin`; a browser reports that as a
      network error before any body is sent, and every gate was green because none of them was a
      browser. `cors.ts`: preflight (204, origin echoed, requested headers granted, max-age 600,
      `Vary: Origin`), origin stamped on every real response including the SSE stream, browser
      requests from a non-allowed origin refused 403 BEFORE the model is called, requests without
      `Origin` untouched. Policy `CRAFTKIT_AI_ALLOWED_ORIGINS` (loopback on any port by default; an
      explicit list replaces it; malformed entries refuse startup). Scripts load a git-ignored
      `apps/ai-server/.env` via `node     --env-file-if-exists`; `.env.example` added. README
      records the IPv4/IPv6 split-port trap. 27 CORS tests incl. one through a real socket;
      ai-server 78/78, typecheck, lint clean; verified live: preflight on `[::1]:8787` → 204 with
      the origin echoed.

- [x] T261 [US10] **"invalid-output · provider" was a server with no key.** Reproduced by driving
      the real panel in Chromium after T260: the request now reaches the server (200, SSE) and the
      result frame said "The assistant server failed unexpectedly." A server started with no
      credentials makes the SDK throw a plain
      `Error("Could not resolve authentication     method…")` at request time — not an
      `AuthenticationError`, which is the API's 401 for a WRONG key — so `describeFailure` fell
      through to its generic sentence. Matched by message now: "The assistant server has no
      credentials: set ANTHROPIC_API_KEY (apps/ai-server/.env) and restart it." on both the unary
      (500) and streaming paths; `main.ts` warns at boot when the client has neither `apiKey` nor
      `authToken`. Two handler tests pin both paths; ai-server 80/80, typecheck, lint clean.

- [x] T262 [US10] **Clearing a selection has a door.** The owner: "when I select blocks there is no
      option to clear the selection." Investigation: no `clearSelection()` existed; Escape cleared
      only when the canvas host itself had focus; the gutter around the frame did nothing; no
      control in the Inspector, the block action bar, or the Layers panel. Now:
      `kernel.clearSelection()` (same ephemeral law as `setSelection`, never a transaction); Escape
      clears from any non-editable element inside the canvas and returns focus to the host (inputs,
      textareas, selects, contenteditable and consumed events are left alone); a click on the gutter
      or the host clears; the block action bar ends with **Deselect (Esc)**, never disabled, root
      included; the Inspector title row shows a quiet **Clear selection** button while a block is
      selected. Every path announces "Selection cleared". 17 files; core 126/126, shell 738/738,
      playground 149/149, Storybook 486/486; theme gate red only for foreign literals
      (GenerationProgress.css — being fixed by the panel workflow — and a pre-existing 1px/3px in
      PreviewMode.css, follow-up).

- [x] T263 [US10] **أبو غضب's panel: one name, a face that notices you, the run as rows.** The
      design-lead spec (three angles, two judges) was implemented across three disjoint tracks.
      Face: hover arches the outer brow 6° and lifts it, widens the eyes 12 %, leans the disc 5 %,
      widens the halo; busy moods answer with halo and lean only; stopped never lifts a brow; a
      press boops the disc; the eyes follow the pointer across the header through two custom
      properties the seat writes once per frame (`useFaceLook`, no React state, no re-render,
      reduced motion zeroes it). Progress: `GenerationProgress` gains `announce` and exported stage
      labels, its CSS obeys the token law (theme 26/26), and the thinking turn shows the run as
      honest rows — Plan, Structure and (Auto only) Apply — driven by the run's events
      (`AssistantPanel.progress.ts`, pure, same reference on no-ops); the refusal card says where it
      broke ("· at Structure"); settled cards keep a timing receipt. Panel: exactly one name by
      locale in the header; article turn wrappers; card head row and state stripes; steps well with
      logical padding and dividers; Discard at the inline end; failure meta with a code pill;
      composer with body-size text, visible mode hint, solid accent Send with an aurora halo on
      hover/focus, red Stop while busy, tokenised aura; accent-family dots and beacon; RTL mirroring
      for Undo/Code; `unicode-bidi: plaintext` on provider-authored runs. Fixed on the way: turn ids
      restarted at 1 after a reload and collided with saved turns (React duplicate keys) — ids now
      continue from the revived conversation. Verified live in Chromium: single name, hover pose
      values, the credentials failure "at Structure". Gates: panel suite 45/45 plus progress 24 and
      face-look 12; playground typecheck and lint clean for the panel; theme 26/26; Storybook
      (Chromium) 114 files, 495/495 including EnglishName, InFlightProgress, DarkChrome,
      RightToLeft, Hover, Busy, LooksAtThePointer, Pressed and SilentInsideAChat.

- [x] T264 [US10] **The Inspector is split, and one edit renders one row.** The owner asked for the
      593-line component to be divided "for performance". Structure lane of the design-lead spec:
      pure partition module (`partition-properties.ts`), schema facts cached per schema in WeakMaps,
      an announcer store with one live-region subscriber, four primitive kernel selectors at the
      shell, `InspectorPropertyRow` as the single memo boundary subscribing per property, controlled
      sections, lazy-once tab panels keeping the tablist/tabpanel pattern, a source-keyed pending
      draft, `dir` subscribed once — 14 sub-components and 12 hooks/modules, each with its own test;
      `InspectorRow.tsx` gone, its CSS split into `InspectorRow.css` and `RepeaterField.css`;
      `index.ts`/`InspectorProps` unchanged; Clear-selection preserved. Measured by
      `Inspector.render-count.test.tsx` (baseline recorded in its header): mount 20 rows → 9 bodies;
      one external prop edit 21 renders → 1; tab round trip 41 → 0; collapse a section 20 → 1; undo
      21 → 1. Shell tests 859/859 (Inspector folder 140/140), shell typecheck, theme 26/26,
      playground 183/183, Inspector stories 24/24 in Chromium. Deviations recorded in the docs:
      `controlFor` stays inline (react-hooks/static-components), the focus lock is a closure holder
      (react-hooks/refs). NOT done yet: the design lane (CSS polish, header hierarchy, stories/docs
      pass) — deferred because a peer session is layering element-focus work on the same folder.

- [x] T265 [US10] **The first real plan failed on a prop that does not exist.** Driven live through
      the CLI-backed server: "كبّر عنوان الهيرو" came back as a refusal — "Type hero declares no
      prop **unknown_hero_heading_size_prop**" — because `none` mode told the model nothing about
      the hero already on the page, not even its prop names, and it invented one. Now every block
      type PRESENT in the document rides along in `none` mode as a presence entry (`type`,
      `description`, `propKeys`; no schema, no examples, no slots); blocks not on the page stay
      absent. Measured: ~19 tokens per block on the fixture, ~150 on the real registry (hero has 34
      keys); the landing page's 22 types add ~4,500 tokens, `none` ≈ 9,000 vs `full` ≈ 64,000, and
      the list is stable so the cached prefix pays for it once. Invariants rewritten: `none` <
      2×`index` and < `full`/4 in the library test, < 12,000 and < `full`/5 on the wire.

- [x] T266 [US10] **The Inspector's design lane.** On top of the split (T264) and a peer session's
      element-focus work (preserved verbatim: "Back to region", "in <region>", the ElementFocus
      story, its tests): the panel no longer draws its own seam or width (the aside frames it; the
      story decorator `withInspectorFrame` stands in); "INSPECTOR" becomes a muted eyebrow and the
      block's display name the sticky title with the bucket pill beside it; tabs are a segmented
      control whose selected tab lifts onto the panel colour; one hairline between sections, rows
      breathe through grid gap, one chevron glyph rotates; empty state as a dashed card with an
      accent pointer, unknown type as a warning strip; override pill matches the header badge and
      its clear button goes danger-on-danger-soft; inputs at `--bldr-control-height`, tabs/toggles
      at `--bldr-control-height-sm`; hairline/thick edge tokens everywhere; reduced-motion block per
      sheet; logical properties only; no theme-keyed rule. `Inspector.design.test.tsx` pins 42
      text-level laws on the three sheets. New stories UnknownBlockType, DarkChrome, CompactDensity,
      TabletOverrideMarker. Gates: shell 901/901 (Inspector folder 182), lint/typecheck clean, theme
      26/26, playground 184/184, Inspector stories 29/29 in Chromium.

- [x] T267 [US10] **Two published Skills, adapted rather than copied.** The owner asked for
      agenticskills.io's `frontend-design` (Anthropic, Apache-2.0) and `tailwind-design-system`
      (wshobson, MIT). Both were read from source and rewritten for this agent, because a verbatim
      copy instructs work it cannot do (`@theme`, `tailwind.config.ts`, `@apply`, writing app.css,
      taking screenshots). `craftkit.visual-direction` carries the transferable part: subject-first
      grounding, the three AI-default looks to avoid, hero-as-thesis, deliberate type pairing with
      the REAL font mechanism, structure-encodes-information, one signature element, complexity
      matched to the vision, remove-one-accessory, and the quality floor. It is a dependency of
      page-composition, cv-page and occasion-page, and conflicts with precise-edit.
      `craftkit.design-tokens` carries the token hierarchy (role → palette → `ck-` class) and the
      component ladder (base → variant → size → state), and names the v4 features that do not exist
      here as refusals. Fixed on the way: design-direction claimed "@import is refused" — the
      sanitizer has allowed Google Fonts and bunny.net since T255, so the agent had been told it
      could not load a web font when it can; and the vocabulary guard caught an invented role class
      (`text-inverse` → `text-text-inverse`). Budget pins raised deliberately: at most four auto
      skills per request (one of each kind — words, look, structure, language) and 3,200 tokens per
      row, measured widest at 3,052 against a 16,000 budget. builder-ai 376/376, typecheck and lint
      clean.

- [x] T268 [US10] **A run died on a block it was never allowed to insert — a regression from T265.**
      The owner's build came back "Slot default of root accepts [hero, …, customCode], not page"
      after minutes of work. Cause: T265 advertises every block type PRESENT in the document under
      `none` mode, and the document's root is itself a `page` node — so `page` appeared in the block
      list with prop keys and the model wrote `insertNode {type:'page'}`. Two rules now travel in
      the data instead of being learned from the door: the document's root type carries
      `insertable: false` in EVERY catalog mode (a page cannot be inserted into a page), and a
      presence entry — prop names without a schema — carries `insertable: false` too, because
      authoring one would mean inventing its props. Editing them is untouched: the document fragment
      still ships every node's full props, and `setProp` on the root (pageCss, contentWidth) is
      exactly as before. Pinned in `catalog-none.test.ts` and in the serialized-catalog contract
      test. builder-ai 381/381, lint and typecheck clean.

- [x] T269 [US10] **Phase 1 of the build plan: no ending without a receipt, no silent run, no dead
      stylesheet.** (a) `receiptOf(run, endedAt, lastLine)` — pure, no clock import — and a new
      `startedAt` on `RunProgress`, because rows measure themselves from `stageSince` and no row
      remembers when the RUN began. Every ending carries it: a stop, a failure, a timeout, and a
      turn revived after a reload (read through the storage shape, so sessions saved before receipts
      existed yield none rather than an invented one). Rendered as one quiet mono line: "Stopped
      after 00:41.637 at Structure — Thinking — about 200 tokens so far (00:39)". (b)
      `LiveStageClock` ticks the ACTIVE row once a second and nothing else: GenerationProgress stays
      presentational and the reducer stays pure, so the timer lives in the smallest component that
      shows the number, clears on settle and unmount, and a settled row keeps the reducer's exact
      detail. A row open for 90s adds a muted "taking longer than usual" line, never a warning
      colour. (c) The validation door now refuses a stylesheet the renderer would throw away. The
      old behaviour was the worst kind: a refused at-rule passed validation, was applied, and then
      the renderer dropped the WHOLE sheet with no message anywhere. Detection is by the owning
      block's schema (`isCustomCssSchema`), not by the prop NAME — `css` is a stylesheet on a region
      and a caption on a block that declared a plain string — and the helper moved to
      `packages/builder/schema/src/custom-code/custom-css.ts` with its old home re-exporting it, so
      the extension and the editor import paths are unchanged. Refusals come back as repairable
      issues that name the sheet and what to do instead. Verified live in Chromium: the clock ticked
      to 00:31 on Structure, the narration reached the panel, and Stop produced the receipt above.
      Gates: builder-ai 398/398, builder-schema 287/287, custom-code 67/67, builder 115/115,
      playground 195/195, theme 26/26, lint and typecheck clean everywhere.

- [x] T270 [US10] **A per-region run stops re-shipping every other region.** Groundwork for the
      split build, and a real cost bug on its own: the document context carries every node's full
      props, so a page of ten composed regions sent ten whole trees on EVERY step — filling the last
      section cost several times what filling the first did, for body copy the run was explicitly
      told not to touch. `AiCompositionPolicy` gains `documentTreeMode: 'full' | 'scoped'` (default
      `'full'` = today's behaviour, so no caller changes) and `treeScopeNodeIds`. Under `'scoped'` a
      tree that is neither selected nor named is replaced by a shape summary — its node count and
      its first heading, never its body — and everything else about the node survives: id, type,
      slots, ordinary props. Trees are recognised by SHAPE (`{kind:'root', children}`), the same way
      the validation door finds them, so a prop that merely happens to be called `tree` is never
      touched and a tree stored under another name still is. Pinned by five tests including the one
      that matters: whichever region is in hand, the request is the same size. builder-ai 403/403,
      playground 195/195, lint and typecheck clean.

- [x] T271 [US10] **The split build: skeleton first, then one section at a time.** `runAiBuild` is a
      thin orchestrator OVER `runAiAgent` — planning, validation and application all still happen
      inside the existing runner, once per step, through the same grouped kernel door. One scaffold
      run inserts every section as an empty labelled region and fixes the direction for the whole
      page in its rationale; the region ids are discovered from the applied transaction's `add`
      patches and correlated by LABEL, never by patch order (pinned by a scaffold whose patches
      arrive out of document order); then one small run per section fills exactly its own tree,
      scoped by `selection` and `documentTreeMode: 'scoped'` (T270) so the last fill costs what the
      first did. Each step is its own transaction with its own name: "Assistant: page skeleton",
      "Assistant: 1/3 — Hero", … so a person can undo one section. **Never interrupts**: a failed
      fill is retried once with a SHORTER brief, then skipped with the reason recorded, and the
      build continues — no modal, no waiting. **Never worse than the single call it replaces**: a
      scaffold that yields fewer than two regions falls back to one ordinary run, and — added after
      review — a scaffold that THROWS does too, since the skeleton is an extra request this path
      invented and its failure must cost the person nothing (only an abort is re-thrown, because
      that is the person stopping). Budget, per-task timeout and outer-signal stop all end with a
      report rather than an exception. Two build skills back it, both explicit-only and both relying
      on the caller's `policy.allowedCommands` rather than `restrictToCommands`, because skill
      restrictions INTERSECT and a second active skill would collapse the run to nothing. builder-ai
      421/421, lint and typecheck clean, mutation-checked (dropping the scoped tree mode and using
      patch order failed 7 of 13 tests).

- [x] T272 [US10] **"Node \"missing-subject\" does not exist" — a mistake no retry could fix.** A
      run died after 2m48s and its one repair attempt died with it. The door was right and the model
      was not guessing at random: it wrote `setProp` against a node it was INSERTING in the same
      plan. That id cannot be known — the kernel mints ids from its own port AFTER the plan is
      written — so the repair was sent looking for a better guess at something that has no right
      answer. Two changes, prevention and cure. PREVENTION: the always-on craft manual states the
      rule on every request — name only a node the document already lists; a node this plan inserts
      gets its id from the kernel, so no later step can name it, and its props belong inside its own
      insertNode. The floor's byte cap was raised 1,200 → 1,450 and the single-skill ceiling 2,500 →
      2,650, both with the reason recorded: a rule that must arrive BEFORE the plan cannot live in a
      conditionally activated skill. CURE: a door rejection whose message says "does not exist" now
      carries the ids that DO exist (id and type, capped at 40) and the sentence explaining why the
      guess could never have worked — so the repair attempt has somewhere to go instead of guessing
      again. A rejection about anything else is left exactly as it was. Three tests built from the
      real failure. builder-ai 424/424, lint and typecheck clean.

- [x] T273 [US10] **Why the same request kept failing the same way — four causes, all removed.** A
      peer session's investigation (verified here before acting) found three, and a fourth came from
      the owner's own report. (a) **The catalog taught the failure.** Selecting the page root puts
      its type in `scopedBlockTypes`, which promotes it to a FULL entry — and the page block's
      few-shots literally map "ابدأ صفحة فارغة" to `insertNode {type:'page'}`. A worked example of
      the one command the door refuses, shipped to a model just asked in Arabic for a page.
      `insertable: false` was added on top and stripped nothing. Now the root's AUTHORING examples
      are removed; its schema stays, because the root is edited constantly (pageCss, contentWidth).
      (b) **Persuasion replaced by enforcement.** The door refuses `insertNode` of the document's
      root type before the dry run, with the edit that was meant: "…the page already exists…use
      setProp on \"root\"". It no longer depends on any prompt's wording. (c) **A rejected plan was
      cached and replayed.** `createCachingAiPlanProvider` stored every answer, so retrying a
      failing request returned the same dead plan in milliseconds with no model call — which is why
      a second attempt was far faster than the first. `AiPlanProvider` gained an optional
      `forget()`, the cache implements it, and `generateAiPlan` calls it the moment validation
      rejects. (d) **Switching rail tabs aborted the run.** The assistant was one arm of the section
      ternary, so opening Blocks unmounted it and its unmount cleanup aborted the run in flight — a
      person who glanced at their layers lost the page being built. It now stays mounted and is
      hidden instead; every other section still mounts on demand. Nine new tests across the three AI
      causes. builder-ai 430/430, playground 232/232, lint and typecheck clean.

- [x] T274 [US10] **The split build reaches the product.** The orchestrator had been finished and
      tested for hours while the app called it zero times, so a ten-section request was still one
      giant call. Now `ask()` routes to `runAiBuild` when the request activates one of the three page
      archetypes and the mode is Ask or Auto; **Plan never builds** (the skeleton applies, and Plan's
      whole promise is that nothing does), and a small request keeps the single call byte for byte.
      Added to the orchestrator first: `onPlanned`, the ONE approval point — asked after the skeleton
      is down and before any section is filled, because the approval a person wants is on the LIST,
      not on each of eight sections; refusing keeps the skeleton, which is an ordinary undoable
      transaction. The panel gained a pure `AssistantPanel.build.ts` reducer (18 tests), a `building`
      turn rendering the task list with the existing live clock nested in the open row and an ETA
      from that build's own measured durations, the approval card, and the report with per-task Undo
      (undo-through by transaction label, since the kernel exposes only a linear stack) and Retry
      skipped. A revived `building` turn becomes stopped-with-receipt like `thinking` already did.
      One existing test legitimately changed: it asked "ابني صفحة كاملة", which now correctly routes
      to a build. Gates: playground 268/268, typecheck and lint clean, theme 26/26, Storybook 17/17
      in Chromium including BuildAwaitingApproval, BuildInFlight and BuildReportWithSkips. Verified
      live as far as time allowed: the request routed to the build path ("Working on the page
      skeleton") and Stop produced "Stopped after 03:51.983 at Structure". CORRECTION: that stop was
      first recorded here as a credentials failure. It was not. The log tailed was this session's own
      scratchpad log, last written at 18:02, while the live server had started at 23:55 — a stale file
      read as current. The server was credentialed and the run was simply slow (the CLI backend
      writes ~80 output tokens/second, and one of its runs that day took 6m40s for an 8,805-character
      plan). The cancellation cut off a working run.

- [x] T275 [US10] **The vault: nothing is lost.** The playground never persisted anything — the
      kernel was rebuilt from the fixture on every load, so a refresh erased whatever had been
      built; the only saved thing was the chat. Instead of inventing storage, this implements the
      kernel's OWN `PersistenceAdapter` port (`load`/`append`/`snapshot`), which was present and
      unused, and boots through `openDocument` — so schema migration, validate-before-open,
      transaction-log replay, seq-conflict detection and coalesced flushing all come for free. Four
      modules in `apps/playground/src/features/vault/`: an IndexedDB key/value store that NEVER
      throws (an unavailable or blocked database degrades to memory with one warning, because losing
      persistence must not take the app down); the adapter, whose writes are serialised per document
      so two rapid transactions cannot interleave a read-modify-write, and whose conflict rejection
      does not poison later writes; a snapshot shelf (index stored apart from bodies so `list()` is
      one read, eviction by count then bytes, deterministic ids, and a snapshot bigger than the whole
      cap is still stored); and the revert, which is the only legal one — project → parse →
      `kernel.dispatch('applyPatches')`, ONE transaction that one undo reverses. The inverse-patch
      approach the plan originally proposed was rejected during investigation: array indices in
      stored inverses are position-dependent and were recorded against intermediate states.
      **Verified live, which is the only proof that counts here**: the hero heading was changed to
      "VAULT PROOF 12345", the page was reloaded, and it came back identical with a "Picked up where
      you left off" notice and a Start over button. Two notice defects found and fixed in the same
      pass: `\u2014`/`\u00d7` written as JSX text render literally (six characters, not a dash), and
      a 208px max width turned one sentence into a nine-line column covering the Inspector. Gates:
      playground 268/268, typecheck and lint clean, theme 26/26. NOTE: the workflow's two adversarial
      verifiers stalled and never ran; the durability claim rests on the live reload above and on the
      31 vault tests, not on their review.

- [x] T276 [US10] **A headless door on the umbrella, so a Node service stops reaching past it.**
      `pnpm check:workspace` failed with two violations: `apps/ai-server` depends on
      `@craftkit/builder-ai` and `@craftkit/builder-schema` directly, while the contract says a
      non-builder member reaches the family only through the preset. The prescribed fix does not
      work and was tried: `@craftkit/builder` re-exports the editor surface, so importing it drags
      in `packages/builder/shell`, whose code calls `querySelector` on an `HTMLElement` — and a Node
      service's tsconfig has no `lib: dom`, nor should it acquire one to satisfy a package boundary.
      So the answer is a second, narrow door on the SAME package rather than an exemption for a
      whole class of members: `@craftkit/builder/wire` re-exports the plan wire contract and the
      class vocabulary a prompt must state, and nothing else. `wire.node.test.ts` guards the
      contract rather than hand-walking an import graph (the first attempt did, and flagged a
      type-only React import that is erased at compile time and already tolerated): the door may
      re-export from `builder-ai` and `builder-schema` only, and neither manifest may carry a
      browser runtime dependency. Umbrella 118/118, lint and typecheck clean. The two violations
      stand until the server switches its two imports — that file is another session's.

- [x] T277 [US10] **Sections are written at once and land in order.** A ten-section build made ten
      round trips end to end, and a round trip is dominated by waiting on the model, not by the
      kernel: the wall clock was almost entirely idle. Writing them concurrently is only safe if
      LANDING stays ordered, so the two were separated. `runFill` now generates with
      `apply: 'never'` and hands the proposal back; a pool of writers (`fillConcurrency`, default 3)
      claims sections off a shared cursor while the lander awaits each section's slot in page order
      and calls `applyAiPlan` itself. Ordering is preserved because apply re-validates against the
      LIVE kernel at the moment it lands, so a proposal written against an older document is refused
      rather than applied blind — the same door that already protected the sequential build.
      A stop settles every unclaimed slot as `not-started` so nothing waits on a section that will
      never be written, and work already in flight still lands: `build.stopped` therefore precedes
      the completion of the section it interrupted, which is honest — it means "no further section
      will be STARTED". The proof is a latch no single section can open: three fills must be inside
      the provider simultaneously or the test times out, and they are released last-first to prove
      the transactions still read 1/3, 2/3, 3/3. Mutation-checked — forcing the default to 1 hangs
      that test. `fillConcurrency: 1` restores the old behaviour exactly. builder-ai 435/435, lint
      and typecheck clean.

**Total after the concurrency phase**: 277 tasks.
