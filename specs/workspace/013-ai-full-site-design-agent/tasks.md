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

- [x] T010 Move `ColorToken`, `MeasurementToken`, `TokenName`, and `Theme` from
      `packages/builder/renderer/src/resolve/theme.ts` into
      `packages/builder/schema/src/theme/tokens.ts`, preserving the vocabulary and its explanatory
      comments exactly
- [x] T011 Re-export all four moved types from `packages/builder/renderer/src/resolve/theme.ts` so
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
      `packages/builder/renderer/src/components/DocumentView/DocumentView.tsx`
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

- [x] T021 Export the site, theme, and asset surfaces from `packages/builder/schema/src/index.ts`
      (contracts/site-model.md §1)
- [x] T022 Run the schema gate: `pnpm --filter @craftkit/builder-schema lint typecheck test` and
      `pnpm check:workspace`

### 2e — Site commands and grouped dispatch, `@craftkit/builder-core` (layer 1)

- [x] T023 Implement `addPage`, `removePage`, `renamePage`, `reorderPage` with their zod arg schemas
      in `packages/builder/core/src/commands/site-commands.ts`
- [x] T024 Implement `setSharedRegion`, `setPageRegions`, `setDesignToken`, `setDesignSystem`,
      `registerAsset` in `packages/builder/core/src/commands/site-commands.ts`
- [x] T025 Register the site commands and widen `CoreCommandName` in
      `packages/builder/core/src/commands/core-commands.ts`
- [x] T026 Write the refusal tests in `packages/builder/core/src/commands/site-commands.test.ts` for
      all six refusals in [contracts/site-model.md](./contracts/site-model.md) §2 — each must be a
      validation failure with NO partial write
- [x] T027 Implement `dispatchGroup()` in `packages/builder/core/src/commands/dispatch.ts` —
      all-or-nothing, one history entry, one `author`, a human label. This closes the
      `mode: 'sequence'` gap that FR-034 and FR-037 require (research R5)
- [x] T028 Write `dispatchGroup` tests in
      `packages/builder/core/src/commands/group-dispatch.test.ts` proving one undo step reverses the
      whole group, and that a mid-group failure applies nothing
- [x] T029 Verify the log/history-before-`store.write` ordering still holds for grouped dispatch in
      `packages/builder/core/src/commands/group-dispatch.test.ts` (003 contract §15 — uSES snapshots
      are read synchronously inside the notification)
- [x] T030 Export `dispatchGroup` and the site commands from `packages/builder/core/src/index.ts`
- [x] T031 Run the core gate: `pnpm --filter @craftkit/builder-core lint typecheck test`

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

- [x] T046 Re-export the site, design-system, asset, and `dispatchGroup` surfaces from
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

- [x] T072 [US1] Implement `SitePages` in
      `packages/builder/shell/src/components/SitePages/SitePages.tsx` — listbox semantics, roving
      focus, Home/End, RTL mirror, a NAMED focus destination after delete
- [x] T073 [US1] Add the local export in `packages/builder/shell/src/components/SitePages/index.ts`
- [x] T074 [US1] Write typed CSF stories in
      `packages/builder/shell/src/components/SitePages/SitePages.stories.tsx` — default, single
      page, many pages, reordering, empty, RTL, with a `play` interaction for keyboard reorder
- [x] T075 [US1] Write `packages/builder/shell/src/components/SitePages/SitePages.docs.mdx`
- [x] T076 [US1] Write behavioural tests in
      `packages/builder/shell/src/components/SitePages/SitePages.test.tsx` — add, remove, rename,
      reorder, and the focus destination after delete asserted by NAME, not by `not.toHaveFocus()`
- [x] T077 [US1] Export both components from `packages/builder/shell/src/index.ts` and re-export
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
      `packages/builder/renderer/src/components/DocumentView/DocumentView.tsx` so a page renders its referenced
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
      giant call. Now `ask()` routes to `runAiBuild` when the request activates one of the three
      page archetypes and the mode is Ask or Auto; **Plan never builds** (the skeleton applies, and
      Plan's whole promise is that nothing does), and a small request keeps the single call byte for
      byte. Added to the orchestrator first: `onPlanned`, the ONE approval point — asked after the
      skeleton is down and before any section is filled, because the approval a person wants is on
      the LIST, not on each of eight sections; refusing keeps the skeleton, which is an ordinary
      undoable transaction. The panel gained a pure `AssistantPanel.build.ts` reducer (18 tests), a
      `building` turn rendering the task list with the existing live clock nested in the open row
      and an ETA from that build's own measured durations, the approval card, and the report with
      per-task Undo (undo-through by transaction label, since the kernel exposes only a linear
      stack) and Retry skipped. A revived `building` turn becomes stopped-with-receipt like
      `thinking` already did. One existing test legitimately changed: it asked "ابني صفحة كاملة",
      which now correctly routes to a build. Gates: playground 268/268, typecheck and lint clean,
      theme 26/26, Storybook 17/17 in Chromium including BuildAwaitingApproval, BuildInFlight and
      BuildReportWithSkips. Verified live as far as time allowed: the request routed to the build
      path ("Working on the page skeleton") and Stop produced "Stopped after 03:51.983 at
      Structure". CORRECTION: that stop was first recorded here as a credentials failure. It was
      not. The log tailed was this session's own scratchpad log, last written at 18:02, while the
      live server had started at 23:55 — a stale file read as current. The server was credentialed
      and the run was simply slow (the CLI backend writes ~80 output tokens/second, and one of its
      runs that day took 6m40s for an 8,805-character plan). The cancellation cut off a working run.

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
      one read, eviction by count then bytes, deterministic ids, and a snapshot bigger than the
      whole cap is still stored); and the revert, which is the only legal one — project → parse →
      `kernel.dispatch('applyPatches')`, ONE transaction that one undo reverses. The inverse-patch
      approach the plan originally proposed was rejected during investigation: array indices in
      stored inverses are position-dependent and were recorded against intermediate states.
      **Verified live, which is the only proof that counts here**: the hero heading was changed to
      "VAULT PROOF 12345", the page was reloaded, and it came back identical with a "Picked up where
      you left off" notice and a Start over button. Two notice defects found and fixed in the same
      pass: `\u2014`/`\u00d7` written as JSX text render literally (six characters, not a dash), and
      a 208px max width turned one sentence into a nine-line column covering the Inspector. Gates:
      playground 268/268, typecheck and lint clean, theme 26/26. NOTE: the workflow's two
      adversarial verifiers stalled and never ran; the durability claim rests on the live reload
      above and on the 31 vault tests, not on their review.

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
      rather than applied blind — the same door that already protected the sequential build. A stop
      settles every unclaimed slot as `not-started` so nothing waits on a section that will never be
      written, and work already in flight still lands: `build.stopped` therefore precedes the
      completion of the section it interrupted, which is honest — it means "no further section will
      be STARTED". The proof is a latch no single section can open: three fills must be inside the
      provider simultaneously or the test times out, and they are released last-first to prove the
      transactions still read 1/3, 2/3, 3/3. Mutation-checked — forcing the default to 1 hangs that
      test. `fillConcurrency: 1` restores the old behaviour exactly. builder-ai 435/435, lint and
      typecheck clean.

- [x] T278 [US10] **Five libraries, chosen against the gaps rather than the hype.** The owner asked
      which external tooling would strengthen the agent. Four were adopted and wired, one is blocked
      on another session: `promptfoo` (plan quality was measured by nothing — 435 unit tests, none
      of which ever called a model), `p-retry` (a ten-section build is eleven calls and one dropped
      connection killed a section outright), `pixelmatch` (the product GENERATES pages and nothing
      looked at them), `@modelcontextprotocol/sdk` (the builder was reachable only from its own UI),
      and `jsonrepair` for `apps/ai-server`, whose files belong to another session and were dirty —
      the patch was written and sent instead of applied. Rejected with reasons: the AutoGen family
      (Python/.NET, and in maintenance since Microsoft folded it into Agent Framework), `p-queue`,
      `idb`, and Yjs until multiplayer is real. Seven catalog entries, two scoped
      `peerDependencyRules` for promptfoo's mongodb/nunjucks transitives, and five explicit
      `allowBuilds: false` decisions pnpm 11 demanded once promptfoo pulled in onnxruntime-node,
      sharp, protobufjs and @swc/core — declining keeps the status quo, and the four untouched
      builder packages were re-run to prove it: 1010 tests still green.

- [x] T279 [US10] **A schema-only door on the block pack, which is what made the rest worth
      having.** Both new Node members could reach the kernel but not the vocabulary: every pack
      pairs each schema with the component that draws it, so its entry reaches
      `@craftkit/builder-renderer` and DOM globals. The MCP server therefore offered clients a page
      root with nothing to put inside it, and the eval harness scored the assistant against the
      kernel's six test fixtures while documenting that the number "is a statement about this
      catalog, not about the assistant". The schemas were already separate files importing zod and
      `@craftkit/builder-schema` and nothing else, so `blocks-marketing/src/schemas.ts` exports all
      32 in the manifest's own order behind a new `./schemas` entry. One real edge blocked it —
      `section-motion.ts` mixed the motion vocabulary with a render helper that called into the
      renderer — so the helper moved to `section-motion-attributes.ts` and 32 components had their
      import rewritten; the pack's 310 tests confirm nothing moved but the import.
      `schemas.node.test.ts` walks the barrel's REAL import graph (stripping type-only statements,
      which is the false positive that pushed the other doors to read manifests instead) and pins
      the whole external surface to two packages; it also asserts the barrel matches
      `contributes.blocks` exactly, because two hand-maintained lists of the same thing drift.
      `headless.node.test.ts` learned the one rule it could not express before: a subpath carrying
      its own graph proof is judged by that proof, and importing the pack's main entry still fails.

- [x] T280 [US10] **The agent can now be measured, and it is measured against the real catalog.**
      `apps/evals` runs 24 corpus cases through the actual pipeline — context assembly, the real
      provider, the real validator, a real kernel — and scores them with deterministic TypeScript
      graders plus one rubric. `pnpm eval` runs offline with no key: 24 cases in 2 seconds, 19 pass,
      5 fail, 0 errors. The five are honest signal, not noise: the deterministic local provider
      cannot edit an existing page (cases 05, 20, 24) and does not refuse the two impossible
      requests (07, 08). Four defects were found and fixed on the way. The coverage grader gave
      REFUSAL free credit — half its clauses are negative ("at most six commands", "does not insert
      another hero") and inaction satisfies them vacuously, so a refusal scored 0.2 for covering
      nothing, which would quietly train the prompt toward refusing. The starter fixture's node ids
      were literals that silently became wrong under the real catalog, where `hero` mints an id of
      its own; they are computed from the built fixture now, because a case whose
      `requiredTargetNodeIds` names a node that does not exist is an eval measuring nothing. A
      `contextFragments > 0` assertion was true of the fixture catalog and false of a schema-only
      one. And the build shipped broken while every test passed: Rollup reads immer's
      `sideEffects: false` as licence to delete `enablePatches()`, so the harness died on its first
      document with "[Immer] The plugin for 'Patches' has not been loaded" — `treeshake: false`, the
      same fix and the same comment the MCP server already carried.

- [x] T281 [US10] **The builder is now something other agents can build in.** `apps/mcp-server`
      exposes six tools over stdio — catalog, open, read, apply_plan, history, undo — and
      `apply_plan` is the one that matters: it runs a proposal through the same validator and lands
      it as ONE transaction, so a client gets the kernel's refusal reasons verbatim instead of a
      corrupted document. Registered in `.mcp.json`; smoke-tested as a built artifact over real
      stdio, not just through the in-memory transport. Its default vocabulary is the page root plus
      the 32 marketing schemas, guarded by a test that fails when the default reverts to the root
      alone — mutation-checked both ways. Also wired: `p-retry` in the playground, retrying only
      what a retry can fix (network, timeout, 408/429/5xx) and never a refusal or invalid output,
      with full jitter and an abort that stops mid-backoff rather than sleeping it out;
      `pixelmatch`/`pngjs` behind a comparator that distinguishes "the edit did nothing" from "the
      edit moved something it should not have", with PNG fixtures generated in the tests rather than
      committed. Gates: evals 137, playground 286, mcp-server 13, blocks-marketing 310, headless
      door 6; lint and typecheck clean on all five; workspace contract 33 members.

---

## Phase Zero — four falsifiable spikes before any delivery (plan v3)

The approved plan asks one question of itself: what turns a 9/10 plan into a 3/10 delivery? In this
repository the answer is documented — an earlier plan promised seven things and delivered three, and
`flush()` would have passed every unit test while never storing a draft. So four architecture
questions were answered by throwaway code with pass/fail criteria written BEFORE the code, and the
plan changes on a failure rather than the implementation being forced to fit.

- [x] T282 [US10] **S1 — a page lens over ONE site kernel.** Question: can a lens satisfy the whole
      `BuilderKernel` surface over a single site kernel, so a group touching several pages is one
      immer produce, one transaction and one undo, while node subscriptions stay page-scoped? The
      rejected alternative is N page kernels with a coordinator: N histories make an undo of an older
      group wrong once any page is hand-edited after it, and N append logs turn a conflict on page 3
      into a torn write `persist/seq-conflict` cannot express. **Answer: yes**, in
      `packages/builder/core/src/site/site-kernel.spike.{ts,test.ts}`, 13 tests.
      Three findings the plan did not have. (a) `applyPatchSet` (`patches/apply.ts`) is typed to
      `BuilderDocument`, so a site cannot use it — it is a thin wrapper over immer's generic
      `applyPatches`, so D2 adds a sibling, not a mechanism. (b) The first NINE tests all passed
      against a deliberately wrong implementation (one produce per step): atomicity survives because
      the write happens once, but the inverses are then recorded against intermediate states and
      undo breaks on ARRAYS. A tenth test — two inserts into one slot, then undo — is what catches
      it, and every future atomicity claim needs an array case rather than a `setProp` case.
      (c) An adversarial review found `changedPageNodes` returned an EMPTY key set for any
      structural change to `pages`: immer coalesces an insert or reorder into whole-element patches
      and the node path disappears, so every subscriber stayed silent while the document under it
      moved. Structural changes are now declared as such and wake everyone. Also fixed: `write` threw
      AFTER the commit and before `tx.applied` when a group renamed a page id, tearing a transaction
      that had succeeded.

- [x] T283 [US10] **S2 — how a draft is seeded and resumed.** Question: does
      `takeOver(draft:<runId>, live.getDocument(), 0)` then `openDocument` produce a draft a SECOND
      reader sees byte-identically before any transaction, and resume after a reboot? **Answer:
      yes**, `apps/playground/src/features/vault/drafts.spike.test.ts`, 7 tests.
      The value is in the two tests that reproduce the route it replaces. `createBuilder({document,
      persistence})` + `flush()` never stores the SEED, because `flush()` returns early with no
      pending transactions (`create-builder.ts:215`) — and the consequence is worse than "nothing is
      stored": after the first dispatch the transaction IS stored on top of the adapter's own
      fixture, and the replay then throws `path doesn't resolve`, so the draft cannot be opened at
      all. Whether one gets a hard failure or a plausible-looking wrong document depends only on
      whether the fixture happens to contain the nodes the run touched. A third test finally pins
      what `takeOver` is FOR — truncating a stale tail — which nothing in this repo asserted.

- [x] T284 [US10] **S3 — the commit door.** Question: can a draft land as ONE transaction attributed
      to the AI, with a label, reversed by ONE undo, refused with zero writes when the live document
      moved? **Answer: yes**, `apps/playground/src/features/vault/commit-draft.spike.test.ts`,
      7 tests. `restoreDocument` hardcodes `author: 'codeview'` (`restore.ts:68`) while the spec
      requires agent attribution; the same projection route carries `'ai'` and a label without
      changing shipped code. Proved additionally: a REMOVAL commits (the deletion half of the diff),
      and the node ids the DRAFT minted survive the crossing — which is the reason the plan commits
      patches rather than replaying the run's steps, since a replay would re-mint every id through
      the live port. An empty `catch` that swallowed its own assertion failure was removed.

- [x] T285 [US10] **S4 — the evidence driver.** Earlier verification notes in this repo cite "live
      Playwright proof", but there is no Playwright project: those runs were a person driving an MCP
      browser by hand — unrepeatable, ungateable, nothing to diff. `apps/evals/src/live/
      drive-playground.ts` is a written Node driver (Playwright + Node builtins only, no workspace
      imports) that drives the real playground and writes `evidence/live/<stamp>-<name>.json`.
      It witnesses; it never judges, so it cannot be gamed into passing.
      Four field findings. `fill` does not send in this panel — the text appears, the control takes
      focus, nothing is sent — so it types and presses Enter and waits for the thread ECHO, not a
      click. The transaction counter is a LOG length that undo does not decrease, so undo is
      witnessed through the editor's Undo/Redo controls. TWO buttons are named "Undo" once a plan is
      applied, which is a real accessibility ambiguity for D8. And from the review: the settle signal
      hung forever on an approval-gated build (`busy` stays true while waiting for a human), and the
      exit code was inverted — the driver's own blindness exited 0 while a product refusal exited 1.
      Both fixed; `observed` is now the single fact the exit code reads.
      Live proof: `evidence/live/2026-09-04T14-12-36-phase-zero.json` — `outcome: undone`,
      `observed: true`, zero console errors.

- [x] T286 [US10] **Phase Zero's exit gate: two independent reviews, not the author's own.** An
      adversarial pass over S1–S4 (four lenses, each judged by a second agent that had to reproduce
      every objection) returned **34 confirmed findings**, and three of them contradicted what the
      author had reported. (1) "The compiler proves the eighteen members" was FALSE: an
      `as unknown as` cast on `extensions` dropped `has` and `version`, both called by shipped code
      in the renderer, `use-registry-version` and the shell's Palette — the count was disabled
      exactly where it mattered. (2) "The gates are green" was incomplete: `test:coverage` is part of
      root `verify`, was never run, and was RED with the spike as the sole cause (measured: 94.3 /
      85.3 / 97.9 without it). (3) The S2 trap description was wrong in the direction of kindness.
      Every high and medium finding is fixed; the low ones are fixed or recorded.
      Gates after: builder-core 146 with coverage 94.3/85.3/97.9, playground 301, evals 141,
      workspace 33 members, repository typecheck 30/30, lint clean in every touched package.
      **Recorded, not fixed**: `pnpm check:components` is RED with 11 missing artifacts in
      `custom-code` and `renderer/CustomCode` — committed code, untouched by this work and not under
      edit. It blocks `verify` and needs its own delivery.

- [x] T287 [US10] **An audit of T001–T047 against the code, by clause and not by name.** The rule was
      that a similarly-named symbol is not evidence. Result: **16 done, 5 partial, 26 absent**, and
      four corrections to the plan's own guesses. The asset contract (T018–T020) is real and complete
      — deep-scanning including `responsive` overrides, cycle-guarded, wired into `validateSite` —
      so the assets delivery shrinks. T012–T015 are genuinely done, with the token vocabulary
      compiler-locked by `satisfies` and the validator failing CLOSED on an unparseable colour.
      T027–T029 are done despite the task naming a file that does not exist: the implementation is
      `dispatch.ts:99` and the tests are `group-dispatch.test.ts`; amend the path, do not move
      working code.
      The four partials, by their unmet clause, which is what D2 starts from:
      **T004** `BuilderSite.designSystem` is `SiteDesignSystem` (`site/types.ts:19`), a
      `Record<string,string>` bridge, not the `DesignSystem` that already exists at
      `theme/design-system.ts:137`. **T005** rule 9 (`design-system-contrast-failure`, FR-014) is
      unimplemented — `site/validate.ts:124-128` is a comment declaring the check a deliberate
      no-op. **T006** the contrast test asserts only that the string constant exists and that a
      VALID site does not emit it; no failing pairing is ever constructed. **T007**
      `siteFromDocument` returns `{ name: 'Default', tokens: {} }` where data-model §1 requires the
      current `lightTheme` values.
      Two further path corrections for this file: T016 names
      `renderer/src/components/DocumentView.tsx` where the real file is
      `components/DocumentView/DocumentView.tsx`, and T002's target
      `packages/builder/schema/src/testing/` does not exist.

- [x] T288 [US10] **The eval harness can now compute the two headline gates.** "Success without
      repair ≥ 90%" and "success after repair ≥ 97%" were uncomputable: the harness recorded the
      outcome and nothing else, so a run that got it right first time and a run that needed a
      correction were the same number. `EvalRunOutput.metrics` gains `attempts`, `repaired` and
      `salvaged` (kept/dropped), read off events the runner already emits. A salvage is reported
      BESIDE the outcome, never folded into it: counting a partial result as a pass would let the
      success rate rise while the product delivered less. Three mutations checked — removing any one
      of the three recordings fails a test. Also raised: the live eval timeout was 300s against the
      playground's 660s, so a live run would have aborted healthy work and recorded it as a provider
      failure — precisely at the cases that take longest. Pinned by a test. And the endpoint-path
      question the plan carried is answered more strongly than a `curl` could: `apps/ai-server`
      does not route by path AT ALL (no `request.url`, no `pathname`), so `/ai/plan` and `/plan`
      reach the same handler.

---

## The 146 unfinished tasks, each with the delivery that owns it

No task is deleted. Deliveries are from the approved plan v3 (`~/.claude/plans/`); the audit in T287
is what decides which are already done rather than which look done.

| Tasks | Count | Delivery | Note |
|---|---|---|---|
| T001–T003 | 3 | D-1 | T001 re-recorded with today's numbers |
| T004–T009 | 6 | D-1 verify → D2 finish | 3 done, 3 partial with their exact unmet clause (T287) |
| T010–T011, T021–T026, T030–T031 | 10 | D2 | site substrate in the kernel |
| T016–T017 | 2 | D9 | tokens resolved from site data |
| T018–T020 | 3 | — | **already done** (T287); the assets delivery shrinks accordingly |
| T032–T047 | 16 | D6 | site codec, transform scopes, preset surface, foundational gate |
| T048–T055, T057–T066 | 18 | D6 | the five-stage pipeline; absent by construction, no `pipeline/` dir |
| T056 | 1 | D7 | the remote stage provider, which needs the server handoff |
| T072–T077 | 6 | D3 | `SitePages` |
| T078–T085 | 8 | D8 | `SiteBriefForm`, composition, US1 gate |
| T086–T103 | 18 | D9 | design system, its panel, the swatch grid |
| T104–T114 | 11 | D10 | refinement |
| T115–T121 | 7 | D11 | shared regions |
| T122–T128 | 7 | D12 | responsiveness |
| T129–T143 | 15 | D13 | asset selection, rendering, picker |
| T144–T148 | 5 | D14 | evaluation; blocked on three independent raters (SC-006) |
| T149–T158 | 10 | D15 | ADR, docs, review, full gate, converge, handoff |

## The promise ledger

The rule this table exists to enforce: **a promise is closed by an evidence file, never by a green
test alone.** It is what stopped "four of seven promises missing" from being discovered months late.

| The promise, as the owner sees it | Delivery | Closed by |
|---|---|---|
| Plan mode plans, writes nothing, and shows the plan with ONE Apply | D1 | a negative test ("no Apply anywhere in the tree") + a live evidence file |
| Ready examples before the first message, in both languages, from the real catalog, returning after a conversation | D1 | derivation test against `registry.blocks()` + screenshot |
| Follow-ups after every reply, working with no server | D1 | `followUp` emitted by the local provider, under test |
| Suggestions for whatever is selected | D1 | derivation test from the selected block's schema |
| A half-built page never reaches the live document | D4 | the door spy counting writes + `evidence/live/*.json` |
| One undo reverses a whole generation | D4 | S3's proof, re-run live |
| Nothing is written after Stop | D4 | spy count after `run.cancelled` |
| A refresh mid-run loses nothing, and Resume continues | D4 | S2's proof + a reload scenario in the driver |
| "Keep what succeeded" names what it did not apply | D4 | `keep-succeeded` test + screenshot |
| A real token counter on every card | D7 | `plan.usage` in a live evidence file; until the server ships it, labelled "estimate" |
| Undo of one task touches only that section | D4 | a test that asserts the neighbours are untouched |
| Jump to section, and a summary of what changed | D4 | test + screenshot |
| A cost estimate before approving | D4 | screenshot of the approval card |
| One brief becomes a four-page site | D6 | `evidence/live/*.json` for a site run |
| Faster, by a measured tier decision | D7 | `evaluation/tier-comparison-<date>.md` |
| Zero overflow, overlap, contrast or critical accessibility failures | D5, D12 | Chromium stories + runtime gate results in the evidence |
| Header and footer across pages; a palette that moves the whole site; real images or a named absence; an edit that stays local | D11, D9, D13, D10 | the user-story gates |
| "10/10" | D14 | the human evaluation report, three independent raters |

---

## Phase Zero+ — the deliveries that implement FR-090 … FR-102

`/speckit-analyze` found the gap this section closes: thirteen requirements were encoded with ZERO
tasks behind them. Requirements without tasks are how a plan quietly becomes a wish, which is the
failure this whole phase exists to prevent — so each one below names its requirement, its delivery,
and the evidence that closes it.

### D1 — Plan mode and suggestions

- [ ] T289 [P] [US10] Add the `craftkit.plan-mode` skill (GOAL · OUTLINE · ALTERNATIVES · RISK; a
      `title` per step; a `followUp` naming the next stage) and register it through the existing
      `createCraftkitAiSkillRegistry(additional)` door — no wire change, and the mode shows as a
      pinned activation on the card. **FR-096.**
- [ ] T290 [US10] Remove the `mode !== 'plan'` gate in `AssistantPanel.tsx` so a page-sized request
      in Plan mode reaches the multi-section orchestrator instead of becoming one oversized call,
      and pass `onPlanned` in Plan as well as Ask. **FR-096.**
- [x] T291 [US10] Close the write path: `PreviewDialog` takes `canApply`, `accept()` refuses a
      Plan-mode application that did not originate on the card, and a NEGATIVE test asserts no Apply
      control exists anywhere in the tree in Plan mode. **FR-096.**
- [x] T292 [US10] The plan card shows each step in the requester's language, what it would change
      (from `previewAiPlan` plus a node diff — no second model call), a cost estimate from
      `estimateAiPlanWireRequestTokens`, and ONE Apply. **FR-097, FR-099.**
- [ ] T293 [P] [US10] Suggestions in four forms from one `Suggestion` type and one `SuggestionChips`
      component: starters derived from `registry.blocks()` and the locale and returning after a
      conversation; follow-ups from the applied plan, from `followUp`, and from `plan.salvaged`'s
      dropped steps; selection-scoped suggestions from the selected block's schema; and the plan
      itself. Direct plans run through `createDirectPlanProvider` so they pass the ordinary
      validation door. Model-only suggestions are hidden, not shown dead, when no server is
      configured. **FR-098.**
- [ ] T294 [P] [US10] Persist the assistant mode in `PersistedPanelState`, and replace the vacuous
      `followUp` assertion at `assemble-context.contract.test.ts:337` (it asserts a property that
      lives one level deeper, and contradicts the `toMatchObject` three lines above it). **FR-098.**

### D4 — Draft, journal, commit

- [ ] T295 [US10] `vault/drafts.ts`: seed a draft through `takeOver` then `openDocument` (never
      `createBuilder` + `flush()`, which stores no seed), list drafts, sweep by age, and capture the
      live fingerprint at run start. **FR-090, FR-092.**
- [ ] T296 [US10] `vault/run-journal.ts`: the durable record — request, seed, limits, per-unit
      outcomes with reasons, budgets consumed, and the pre-run snapshot id — written at every
      checkpoint, swept by TTL, with an orphaned `running` record recovered as `stopped`. **FR-093.**
- [ ] T297 [US10] `commitDraft`: refuse a changed fingerprint with a readable reason and zero
      writes; otherwise land the diff as ONE `dispatchGroup` attributed `ai` with a human label.
      Untouched pages produce no patches. **FR-091, FR-092.**
- [ ] T298 [US10] `keepSucceeded` → `KeepPlan`: a page is kept only if its unit completed AND its
      document validates; a failed page is REMOVED rather than committed as an empty shell; shared
      regions are recompiled locally so navigation never targets a dropped page; every unit not
      applied is named with its reason; and a commit carrying any partial requires an explicit
      acknowledgement. **FR-094.**
- [ ] T299 [US10] A pre-run snapshot of kind `auto` with its own cap, so "undo the whole generation"
      restores it in one transaction; and per-task undo that removes or restores only that section
      rather than looping the history stack. **FR-095.**
- [ ] T300 [US10] The `interrupted` turn with Resume, Restart, Discard and Keep, reading the run
      journal so Resume continues from the first unit still waiting. **FR-093.**
- [ ] T301 [P] [US10] Jump to section, a change summary computed from the commit's patches, a cost
      estimate on the approval card, a token budget in `stopReason()`, and the promised stories
      `StoppedWithReceipt`, `SlowRun`, `Interrupted`. **FR-097, FR-099.**

### D5 — Quality gates, in both places

- [ ] T302 [US10] One implementation of the deterministic checks — contrast, overflow, overlap,
      heading order, internal links, duplicate ids, empty sections, placeholder text, direction —
      split between a DOM-free module in `builder-ai/src/quality/` and a layout module in the
      playground. **FR-102.**
- [ ] T303 [US10] Runtime: run them against the draft in a hidden iframe at 360/768/1024/1440; a
      hard failure disables the commit for that page and names the page, the check and the element.
      **FR-102.**
- [ ] T304 [US10] CI: `generated-sites.stories.tsx` built from the offline provider with fixed
      seeds, inheriting the existing `a11y: { test: 'error' }` gate; plus a screenshot producer that
      finally feeds the visual comparator, which has no caller today. **FR-102.**

### D7 — Usage and tiers

- [ ] T305 [US10] `WireUsage` on the response and `tier`/`stage`/`intent` on the request, all
      optional and backward-compatible; `onUsage` → `plan.usage`/`stage.usage` → a usage ledger that
      totals a run by stage, by tier and by cached share. **FR-099, FR-100.**
- [ ] T306 [US10] The tier comparison: both tiers over the corpus, comparing validator pass rate,
      first-attempt rate, refusal and injection safety at parity, copy relevance, the deterministic
      visual gates and latency; the default flips only when every one of them holds, and the
      decision is written to `evaluation/tier-comparison-<date>.md`. **FR-100.**
- [ ] T307 [US10] The server handoff, written as a contract test the other session can run
      unchanged: read `stage`/`tier`/`intent`, map stage to model server-side, refuse a client-sent
      model, and put `usage` on the result frame. **FR-100.**

### D14 — Thresholds derived, not declared

- [ ] T308 [US10] Keep the model critic advisory at weight zero until the blind comparison
      (≥ 3 independent raters, ≥ 5 briefs — SC-006) yields inter-rater agreement, then correlate the
      critic against the human medians and derive each threshold from that curve. Deterministic
      gates remain the blocking ones throughout. **FR-101.**

---

## D2 begins — the four partials the audit named, closed

- [x] T309 [US10] **The site's design system is the validated one (T004).** `BuilderSite.designSystem`
      was `SiteDesignSystem`, a `Record<string, string>` self-labelled a "Wave 2 bridge", while the
      real `DesignSystem` had existed at `theme/design-system.ts:137` since T012. The bridge accepted
      a token name the renderer has no custom property for — a value that resolves to nothing at
      paint time and reports no error anywhere. Replaced, with a new `designSystemSchema` closing the
      key set against `TOKEN_NAMES`. The bridge was DELETED rather than deprecated: it had no
      consumer left, no site was ever stored against it (v1 is the only version and nothing shipped),
      and the lint rule against re-exporting a deprecated symbol turned "keep it for one release"
      into eight errors across the package's public surface.

- [x] T310 [US10] **Rule 9 stopped being a comment (T005, T006, FR-014).** `site/validate.ts` carried
      a written no-op saying the contrast check "intentionally remains a no-op" — so a site whose
      body text was invisible against its own background validated cleanly, and everything downstream
      is entitled to believe the validator. Now delegated in full to `validateDesignSystem`; no
      contrast logic is computed here, because a second implementation is a second answer.
      The old test asserted only that the issue code existed as a string and that a VALID site did
      not emit it — true of a no-op. The new tests construct a failing pairing and an invented token.
      Mutation-checked: restoring the no-op fails them.
      One honesty note recorded in the code: the site contract publishes ONE code for this rule while
      the validator raises five kinds of fault, so the CODE stays the contract's and the MESSAGE
      carries the real reason. Widening the union is a spec revision, not a validator change.

- [x] T311 [US10] **A lifted page arrives renderable (T007) — and the starter theme moved to layer 0
      (T010/T011's precedent, extended to the values).** `siteFromDocument` returned
      `{ name: 'Default', tokens: {} }`: a design system that resolves to no colour at all, and one
      that would have made every migrated site INVALID the moment T310 landed. The two fixes would
      have silently fought.
      `lightTheme`/`darkTheme` and the shared measurements moved from `renderer/src/themes.ts` into
      `schema/src/theme/default-theme.ts`; the renderer re-exports them, exactly as `resolve/theme.ts`
      already does for the token TYPES, so every existing import keeps working and one set of starter
      values exists in the repository.
      `defaultDesignSystem()`'s pairings were MEASURED, not assumed. Six clear 4.5:1 — `text` on
      `surface` 17.74, `textInverse` on `surfaceInverse` 16.98, `accentText` on `accent` 6.29,
      `accent` on `surface` 6.29, `successText` on `success` 5.48, `textMuted` on `surface` 4.83.
      Three are deliberately NOT declared, and not because they fail: `text` on `surfaceInverse`
      measures exactly 1.00 because they are the same hex — the dark panel IS the dark ink, and
      declaring the pair would be declaring a mistake in order to forbid it.
      The validator also caught a claim in the first draft: it required a non-empty seed, and the
      default had `seed: ''` with a comment arguing that a system nobody generated has no history.
      Wrong — a seed makes a system reproducible, and a fixed starter is the most reproducible kind
      there is. It is `'starter-light'`.
      Gates: schema 290 tests, renderer 155, core 146, transforms 106; repository typecheck 30/30;
      lint clean in every touched package.

- [x] T312 [US10] **Eight corpus cases for what nothing could see.** The harness measured which
      blocks a plan inserted and never whether the page's own references resolve, whether three of
      one section are three or one repeated, whether a whole Arabic page stays Arabic, whether an
      edit stays where it was asked, whether a count is honoured, or whether an over-sized request is
      REPORTED rather than quietly truncated (FR-025). Corpus 24 → 32, still offline in 2 seconds:
      26 pass, 6 fail, 0 errors.
      Seven of the eight passed immediately. The eighth found a root cause, and it is not the model:
      the block EXAMPLES carry unsplash URLs — `Gallery`, `Image`, `ProductGrid`, `PortfolioGrid`,
      `BlogGrid`, `ContentSection` and `templates.ts` — and those examples are what the assistant is
      SHOWN as few-shots. The catalog is teaching the behaviour FR-045 forbids, so no prompt change
      could fix it; replacing the examples' image props with asset references will, in the asset
      delivery. The case stays red with its cause written into it, because a red case with a known
      cause is a measurement and relaxing it would delete the only thing that noticed.

- [x] T313 [US10] **The default design system, corrected against an independent analysis.** A read-only
      Codex analyze pass (`gpt-5.6-sol`, high) was pointed at the live T311 draft and found four real
      defects in it. All four are fixed, each with a test that fails when the fix is removed:
      (1) `tokens: lightTheme` handed every caller the SAME object, so one site's colour edit would
      have repainted every other site built from the default — invisible to any test that builds one
      site; now `{ ...lightTheme }`.
      (2) The typography stacks were hand-retyped and had silently dropped `Noto Sans Arabic`, the
      fallback that decides whether Arabic body text renders in the intended face in a bilingual
      product; they now read `tokens.fontFamilySans`.
      (3) `accentText` on `surfaceInverse` measures 17.74 and IS rendered — `Hero.test.tsx:104` and
      `PageHeader` — so omitting it from `pairings` under-declared a real, safe combination. Seven
      pairings now, not six.
      (4) The starter was renamed to "Starter Light"; T007 asks for real tokens, not a new name. It
      is `'Default'` again — the name the migration has always produced.
      Also recorded, from the same analysis: changing `designSystem`'s persisted shape without
      bumping `LATEST_SITE_VERSION` is safe ONLY because nothing has ever persisted a site
      (`siteVersion` appears in `schema/src/site/` and one spike test, nowhere else). That reasoning
      is now a comment on the constant, so the next reader sees the condition rather than the
      conclusion.
      Gates: schema 294 tests (4 new), renderer 155, core 146.

- [x] T314 [US10] **`emptyDocument` moved to layer 0.** `addPage` has to mint a page's document, it
      lives in `core/src/commands/`, and `create-builder.ts` imports that directory — so calling the
      kernel's `emptyDocument` from a site command would have closed an import cycle, and declaring a
      second one beside the site commands would have been two answers to what a new page starts as.
      Moved to `schema/src/document/empty-document.ts`; `create-builder.ts` re-exports it, so every
      existing import kept working. Same pattern as T010/T011.

- [x] T315 [US10] **`applyOnePatch` extracted (`core/src/patches/apply-one-patch.ts`).**
      `applySitePatches` needs the identical walk over a `BuilderSite` that `applyPatches` performs
      over a document, including the own-property guard that stops `["nodes", "__proto__"]` from
      reaching the prototype. Duplicating it would have meant the guard gets fixed in one copy and
      not the other. The root is `unknown` and the caller passes its own error code, so a thrown
      error still names the document or the site. Behaviour-preserving: core stayed at 146 tests
      through the extraction.

- [x] T316 [US10] **The eleven site commands are the site's single door (T023–T026, T030, T031).**
      `core/src/commands/site-commands.ts`, authored through a new `defineSiteCommand` whose
      `apply` parses args before any handler runs — Law V, stated separately from `defineCommand`
      because a site command's producer takes a `BuilderSite` and a page command's takes a
      `BuilderDocument`, and a shared generic would let one be registered in the other's map with the
      mistake surfacing only inside a producer.
      **T025's literal instruction is unbuildable and was superseded, not skipped.** It asked for the
      site commands to be registered in `coreCommands` with `CoreCommandName` widened; that map's
      value type is `RegisteredCommand`, whose producer signature takes a document. The plan's ق١
      (informed by S1) already replaced it with a site kernel over which page lenses are views. What
      the dispatcher actually needs from T025 — one namespace, so `dispatchGroup([{addPage},
      {setProp}])` routes each step to the draft it belongs to inside ONE production — is
      `isSiteCommandName`, exported alongside the map.
      **The refusals are the contract.** All six from `contracts/site-model.md` §2 are enforced and
      tested, each asserting the throw AND that the draft is byte-identical afterwards: a duplicate
      address; the home page (which is also the last remaining page in any valid site); an unheld
      shared region; a token outside `TOKEN_NAMES`; a design system whose pairings fail contrast; and
      an asset reference the site does not hold. Two more the contract implies: `setSharedRegion`
      refuses a region document whose direction disagrees with the site or that `validateDocument`
      rejects, and it refuses to DELETE a region a page still points at.
      Three refusals go beyond validation into honesty: `renamePage` with neither field, and
      `setSiteDirection` to the direction the site already has, both refuse rather than open a
      transaction that changes nothing and costs the user an undo step; `registerAsset` refuses a
      duplicate id rather than overwriting, because an id is a content identity documents already
      reference by name.
      `setSiteDirection` turns the site, every page, and every shared region in ONE production —
      otherwise the site is invalid by `page-direction-mismatch` on every page, and an undo could
      land on the broken half.
      `applySitePatches` mirrors `applyPatches`: it refuses a `siteVersion` change (Law M) and
      validates the WHOLE site, because its input comes from a diff rather than from a handler that
      preserves invariants by construction. It is host-owned — added to
      `EXPLICIT_HOST_ALLOW_COMMANDS` in `ai/src/skills/command-policy.ts`, so the agent commits a
      fingerprinted draft through it but can never name it in a plan of its own.
      Mutation-checked, five separate runs: removing the FR-014 contrast guard, the page-direction
      sweep, the site-direction birth of a new page, the asset-reference guard, or the host gate each
      fails exactly one named test and nothing else.
      One defect the tests found in their own scaffolding, worth recording: `registry.block(type)`
      returns the REGISTERED block (schema plus renderer), not the schema. Passing it straight into
      `CommandRuntime.blocks` typechecks and then crashes inside `validatePropsAgainstSchema`; the
      kernel builds it as `registry.read.block(type)?.schema` (`create-builder.ts:148`).
      Gates: core 191 tests (146 → 191), typecheck and lint clean; `@craftkit/builder-ai` 446;
      `@craftkit/builder` typecheck and lint clean with the site door published.

- [x] T317 [US10] **The site kernel: S1 promoted to shipped code.** `core/src/site/` gains
      `site-store.ts`, `site-dispatcher.ts`, `page-view.ts` and `create-site-builder.ts`, plus the
      site-typed `applySitePatchSet` the spike said the delivery would need. `createSiteBuilder`
      exports through `@craftkit/builder-core` and `@craftkit/builder`; the store and its write path
      stay unexported, exactly as the page kernel's do (Law S).
      **What the spike had and the delivery keeps**: one store, one log, one history; a group across
      two pages as one production, one transaction, one undo; page-scoped `subscribeNode` so an edit
      to page A's `p1` never wakes page B's `p1`; the `structural` branch that wakes everyone when
      immer coalesces a page insert and the node path disappears.
      **What the spike deliberately lacked and this adds**: site commands mixed with page commands in
      one group (`isSiteCommandName` routes each step to the draft it writes, resolved BEFORE the
      production so an unknown command refuses without touching anything); a real
      `createExtensionManager` whose `context` is a getter onto the CURRENT page, so switching pages
      moves every extension rather than stranding it; whole-site validation at construction (Law M) —
      a kernel refuses to open on an invalid site rather than pushing the failure to whichever caller
      reads the bad field; and view-state pruning.
      **Two defects the mutation checks found, both in my own work.** First, the test "drops the
      selection when the selected PAGE is removed" was VACUOUS: it read the selection through the
      `home` lens, which reports `[]` for any non-current page whatever the store holds, so it passed
      with the pruning removed. Rewriting it to read through the lens of the page the kernel is NOW
      on exposed a real bug the vacuous test had hidden — `pageId` kept naming the removed page, so
      `currentPage()` returned a dead id, every lens reported an empty selection because none of them
      was "current", and the site's own `context.dir` would throw. `pruneViewState` now moves the
      kernel to whichever page took the removed one's index — the neighbour, as an editor does when
      you close a tab — and clears the selection with it.
      Second, the log/history-before-`store.write` ordering (003 §15, the rule T029 pins for the page
      door) was UNTESTED for the site door: a mutation moving both after the write passed all 215
      tests. `useSyncExternalStore` reads snapshots synchronously inside the notification, so a
      subscriber deriving from `transactions().length` must already see the transaction or the view
      lags one event behind forever. There is now a test that observes exactly that, and it fails
      when the ordering is reversed.
      Mutation-checked, eight runs in total: page-scoped keys, construction validation, lens routing,
      empty-patch suppression, current-page move, selection clearing on that move, log ordering, and
      the neighbour choice each fail exactly the tests that name them.
      Gates: core 216 tests (191 → 216), typecheck and lint clean; repository typecheck 30/30;
      `check:boundaries` 1327 files in 33 packages, no issues; `check:workspace` 33 members.

- [x] T318 [US10] **The site's load path and its one log (`site/open-site.ts`, T046).**
      `SitePersistenceAdapter` and `PersistedSiteSession` join the ports — a SEPARATE interface from
      `PersistenceAdapter`, not a generic one: the two roots are stored under different keys,
      migrated by different runners and validated by different validators, and a shared generic would
      let a document be appended to a site's log with the failure surfacing later as a patch path
      that does not resolve.
      `openSite` is Law M for a site: load(snapshot + tail) → migrate → replay → validate → open,
      with every failure thrown BEFORE a kernel exists. The order is not interchangeable — migrating
      before the replay is what makes a stored tail of old-format transactions replayable, and
      validating after it is what catches a tail written by a version whose invariants no longer
      hold. Both halves are tested, the second with a hand-written transaction that moves the home
      page's address: no live command can produce it, because `renamePage` refuses, which is exactly
      what a tail from an older build looks like.
      **One append per group, not one per page.** A group editing three pages appends once. That is
      the whole reason there is one log: with a log per page, a conflict on the third append — after
      the first two succeeded — is a torn write `persist/seq-conflict` has no way to express.
      The page kernel's two flush hazards are carried over verbatim and tested: a rejected link must
      not poison the chain (`then(work, work)`, so one refused write does not silence every later
      save for the life of the kernel), and the persisted mark is claimed before the await.
      **A defect the tests found:** the post-door auto-flush hook was wired only onto the site
      kernel's own `dispatch`/`dispatchGroup`. Surfaces only ever hold a LENS, so every edit anyone
      actually made would never have counted toward a save. The lens now routes through the same
      hook.
      `liftDocumentSession` (FR-007) lifts an existing document session into a one-page site byte for
      byte — asserted as `JSON.stringify` equality, not "equivalent" — replaying the document's tail
      first so the lift is what the person last saw. The stated cost, written in the code: the
      document's transactions are not site-rooted, so history before the lift is not undoable after
      it. The alternative is a history that silently fails to apply.
      That same trap caught my own test: its first version seeded the tail from a SITE kernel and
      immer refused with "path doesn't resolve: pages/0/document/nodes/p1/props/content". The
      demonstration is kept in the test's comment.
      Exported through `@craftkit/builder-core`, `@craftkit/builder`, and `headless.ts` (T046).
      Mutation-checked, five runs: skipping the tail replay, ignoring the stored seq, dropping the
      lens hook, using `then(work)` alone, and skipping the lift's own replay each fail exactly the
      tests that name them.
      Gates: core 228 tests (216 → 228), typecheck and lint clean; repository typecheck 30/30.

- [x] T319 [US10] **A regression my own concurrency work caused, caught by a story.**
      `AssistantPanel.stories.tsx` → `Build In Flight` asserted that the fifth section reads
      `waiting` while the third runs. That was an accurate description of the SEQUENTIAL fill loop
      and became false when `runAiBuild` gained a writer pool: with a window of
      `DEFAULT_AI_BUILD_FILL_CONCURRENCY` the writers work ahead of the ordered lander, so a section
      can be finished and still not be on the page. It surfaced only in the full repository run, and
      it reproduced in isolation — it was not the load flakiness the first two runs suggested.
      The story now asserts the truth (rows 0–1 applied, 2–4 running) with the reason written into
      it, rather than being relaxed. And because five sections with two landed makes "3 running"
      indistinguishable from "everything left", a second story — `Build Window Bounded` — holds the
      FIRST section so nothing lands: exactly three run and two genuinely wait. Mutation-checked in
      both directions: setting the constant to 1 or to 5 fails both stories; 3 passes.
      Without that second story the limit is a constant nobody can observe.

- [x] T320 [US10] **The site kernel's laws as properties (`site-kernel.property.test.ts`).**
      Six properties at 200 runs each, fixed seed: SC-014 (a group only ever changes the pages it
      names, asserted byte-identical on the untouched ones), one group is one transaction whatever it
      touched, one undo restores the site byte for byte, a refused step inserted at an ARBITRARY
      position leaves the site exactly as it was, SC-013 (the same seed builds the same site, minted
      ids included), and every accepted group leaves a site the validator still accepts.
      An example test says "this group behaved"; these say "no group of these commands, in any order,
      over any of these pages, can behave otherwise" — which is the claim the plan actually makes.
      One measured accommodation, written into the file: the properties first used `landingFixture()`
      across four pages and three of them blew the 5s timeout, because every run constructs a fresh
      kernel and construction canonicalises AND validates the whole site. A two-node page runs all
      six in 5.5s at full 200 runs. Nothing these properties claim depends on how much is in a page.
      Mutation-checked: routing every page step to the current page fails SC-014 alone; giving each
      step its own production fails the three atomicity properties and nothing else.
      Gates: core 234 tests (228 → 234), typecheck and lint clean.

- [x] T321 [US1] **`SitePages` (T072–T077).** The site's pages as a listbox in
      `shell/src/components/SitePages/`, with all five artifacts. It takes a `BuilderSiteKernel`, not
      a `BuilderKernel`: the order, the titles and which page is current are site state, and no lens
      lets one page see its siblings. Every mutation goes through the site's own commands, so each is
      one transaction and one undo.
      **Focus destinations are named, and one of them was proved redundant before it was proved
      real.** Removing `focusDestinationAfterDelete` entirely left every test green — because the
      tests only ever deleted the CURRENT page, where the site kernel's own neighbour rule
      (`pruneViewState`, T317) already moves everything and focus follows for free. The case that
      tells the two rules apart is deleting a page you arrowed to WITHOUT opening: the kernel has no
      reason to move, and "wherever the current page happens to be" throws the keyboard to the other
      end of the list. That test now exists and fails when the rule is removed.
      The reorder destination is named for the same reason: without it a second `Alt+ArrowDown` does
      nothing, and the interaction is unusable past the first press.
      **Refusals are reported, not thrown.** `removePage` refuses the home page; an exception
      escaping a React event handler unmounts the tree in development and tells the person nothing,
      so the component shows the door's own message in a `role="status"` line and leaves the list
      intact. It re-implements no rule.
      **Three defects found while building it, all mine:** the derived-state correction re-read
      `currentPage` unconditionally and looped forever on a site with no pages (React: "Too many
      re-renders"); the focus effect stole focus from the rename field the instant it mounted, which
      fired the field's own blur, committed the rename and unmounted it before anyone could type; and
      the test's empty-site stand-in built a fresh site object per `getSite()` call, which is exactly
      the `useSyncExternalStore` contract violation that makes React re-render forever — the real
      kernel keeps that reference stable, and `pages()` now caches its array for the same reason.
      Mutation-checked: dropping the delete destination, always falling back to the first page, and
      removing the RTL mirror each fail exactly the tests that name them.
      Gates: shell 918 tests (17 new), 6 Chromium stories, typecheck and lint clean;
      `check:components` counts 109 components with no new missing artifacts.

- [x] T322 [US1] **The playground boots on a SITE.** `useVaultKernel` now opens a site through
      `openSite` and hands every surface `siteKernel.page(currentPage)` — an ordinary
      `BuilderKernel` — so the canvas, the tree, the inspector, the code view and the assistant did
      not have to learn that sites exist. The current page is read with `useSyncExternalStore` from
      the site store rather than kept in React state, because `setCurrentPage` is a site write: a
      page switch made anywhere, including by an undo that took a page away, has to re-render the app
      with the lens for the page the site is actually on.
      **First boot LIFTS what the person already has** (FR-007). Before falling back to the fixture,
      `seedSiteFrom` looks for a document session in the same store and lifts it into the home page,
      tail replayed, byte for byte — and reports it as `restored`, because their work was found, just
      under the old shape. Finding a starter fixture where your page used to be is the worst possible
      first impression of a new version. "Start over" therefore deletes BOTH keys: leaving the
      document behind would make the next boot re-lift the very work that was just discarded, so the
      button would visibly do nothing.
      **`autosave` was extracted, not copied** (`vault/autosave.ts`), generic over the root. It is a
      hundred lines of answers to specific failures — a poisoned promise chain, a stale position that
      silently ends saving for good, a bare `catch` that turned a full disk into a green screen — and
      a second copy is a second place for each of them to come back. Behaviour-preserving: the vault
      suite stayed green through the extraction.
      `createVaultSitePersistence` mirrors the document adapter exactly (serialised writes,
      `persist/seq-conflict` on a stale position with nothing written, compaction only AT the current
      position, `takeOverSite` as the unconditional answer to a session frozen out by a second tab),
      under `vault/site/` — a different namespace, because a site and a document are different roots
      with different validators and sharing a key space would let one be loaded as the other.

- [x] T323 [US1] **Two defects the playground's own tests found in the site kernel.**
      **Direction is a property of the SITE.** `setDocMeta` is a legal page command and through a
      lens it writes `pages[i].document.dir`, leaving the site and every other page pointing the
      other way. `validateSite` reports that as `page-direction-mismatch` on RELOAD — so the editor
      looked fine for a whole session and refused to open the next time, which is the worst shape a
      defect can take. The site door now refuses a page-scoped direction change at the moment it
      happens and names `setSiteDirection`, which turns the site, every page and every shared region
      in one production. `DirectionFlip` dispatches that when a site is present.
      **`insertedNodeId` was reading the ROOT, not the shape.** It matched `path[0] === 'nodes'`, and
      a site's transactions carry `['pages', i, 'document', 'nodes', id]`. Five call sites depend on
      it — the palette, the drag session, block actions, the playground's extension demo — and every
      one of them silently stopped selecting what it had just inserted. It now matches the path's
      tail, which answers for both kinds of transaction, with the precision cases pinned: a prop
      write and a whole-map replacement are not insertions.

- [x] T324 [US1] **`SitePages` in the app, and the page switch proved end-to-end.** The pages sit
      above the layer tree in the same panel — reading them the other way round tells you the shape
      of something you have not been told the name of. `App.test.tsx` gains a test that adds a page
      through the list and opens it, and asserts the TREE changed with it: the canvas, the tree and
      the inspector all follow the site's current page. That is D3's live evidence, in the app's own
      end-to-end suite rather than a claim.
      Gates: playground 313 → 314 tests, core 241, typecheck and lint clean everywhere touched.

---

## D1 begins — Plan mode plans, and the suggestions are derived

- [x] T325 [US10] **`craftkit.plan-mode`, and why it is a skill and not a flag.** A new built-in in
      `ai/src/skills/builtins.ts`. It gives the model the four-part shape to answer in — GOAL,
      OUTLINE, ALTERNATIVES, RISK, plus a required `followUp` — and it declares
      `restrictToCommands: []`. Skill restrictions INTERSECT, so an empty list leaves a run with no
      command it is allowed to emit whatever else is loaded: "Plan never applies" stops being a flag
      a caller must remember and becomes a property of the run.
      Mutation-checked: dropping the empty restriction, or making activation automatic, each fails
      exactly the test that names it.

- [x] T326 [US10] **A BoundedRelay audit corrected my diagnosis and found a whole class I missed.**
      I had recorded that Plan "sends a request differing only by `apply`". That was wrong: Ask and
      Plan send byte-identical requests — both `apply: 'never'`, only Auto differs — and `apply` is
      not on the provider wire at all. The mode produced ZERO provider-visible difference, which is
      why the answer was never a plan.
      The class I had not seen is **stale runs**: a run captures its mode in a closure, and the mode
      control stayed enabled while it worked. Press Auto, change your mind to Plan, and the page is
      written anyway — by a run you had just told to stop writing. The same held for a build's
      scaffold, its fallback, its fills and their retries, and for the approval card, which resolves
      the promise the ORIGINAL run installed. The control is now locked while a run is in flight,
      with the reason written where the next reader will look: this run's authority was decided when
      it started, and the way to change it is Stop.

- [x] T327 [US10] **`outlineAiPlan` — a plan the door never sees.** `generateAiPlan` promises a plan
      of COMMANDS, and it enforces that three times over: it refuses an empty command policy before
      the provider is called, `validateAiPlan` rejects a plan with zero commands, and the emitted
      output contract demands `minItems: 1`. I first tried threading a `readOnly` flag through all
      three and reverted it: that would have been three exceptions pretending to be one rule.
      `outlineAiPlan` takes the same context assembly, the same skills and the same provider, shows
      the model an EMPTY command vocabulary — the strongest way to say "do not propose edits",
      because there is nothing left to name — and never goes near the door. Commands a provider
      returns anyway are dropped and COUNTED, and the count is shown: a model that ignores the
      instruction costs the person a paragraph, never their page.
      The panel gains a `kind: 'outline'` turn with no proposal in it, so Apply and Preview do not
      exist rather than being hidden. That closes the route the audit confirmed — a Plan card's
      Preview dialog has no mode check, so "no Apply" was two clicks from an apply.
      Two tests were rewritten rather than relaxed: both asserted the old card-with-Preview shape.
      Mutation-checked across the AI package and the panel: eight separate runs.

- [x] T328 [US10] **Suggestions are derived, bilingual, and never run out.** The panel showed four
      hardcoded English sentences that had nothing to do with the registered blocks and vanished
      after the first message — in a product whose default locale is Arabic.
      `AssistantPanel.suggestions.ts` derives them instead, from three sources in priority order:
      the model's own `followUp`, the SELECTED block's schema (what is inline-editable, what its
      slots accept, an example its author wrote), and the catalog's own `examples[].prompt` — which
      are already sentences a person would say, in both languages, written by whoever knew the block.
      A new block therefore arrives with its suggestions already written.
      Falls back to the other language rather than showing nothing, because a host catalog with only
      English examples would otherwise leave an Arabic panel with an empty strip — the exact failure
      the module exists to end. `localeOf` reads the SCRIPT, so Persian and Urdu answer `ar`; Hebrew
      answers `en`, and that limit is asserted so it is a known boundary rather than a surprise.
      **A defect of mine, found by the owner from a screenshot**: the strip inherited the empty
      state's styling — four full-width stacked cards — and, now that it is permanent, it ate half a
      360px panel and hid the very thread it was meant to help continue. It has two layouts now:
      stacked on an empty panel, where nothing is being crowded, and a one-row scrollable rail once
      a conversation exists. **A second defect I found while fixing it**: the rail scrolled with
      `scrollLeft += delta`, and in RTL — this product's default — `scrollLeft` starts at 0 on the
      right and runs negative, so the rail simply refused to move. And `touch-action: pan-x` had
      taken vertical panning away, so a finger starting its drag on the rail could no longer scroll
      the conversation behind it.
      The per-card follow-up chip was removed: with the strip it was two identical buttons for one
      action, and the strip is the one that does not scroll away.

- [x] T329 [US10] **A second BoundedRelay review, and eight defects it found in what I had just
      built.** Every one is fixed with a test that fails when the fix is removed.
      **The write route I had left open.** Plan was a label on new cards, not a state of the panel:
      every gate read the mode a turn was PROPOSED under, so an Ask proposal made a minute earlier
      kept its Apply after the person switched to Plan, and its Preview dialog applied
      unconditionally. `accept()` now fails closed against the CURRENT mode, at the single function
      every route reaches — a gate on a button is a gate somebody can forget to copy — and the card
      and the dialog stop offering what the door would refuse.
      **Plan's own follow-up was stored and never shown.** `lastFollowUp` read only `kind: 'plan'`
      turns; the outline branch saved `outline.followUp` into a turn it would never look at. Half of
      what Plan mode was asked to fix was silently absent.
      **The outline was dropped from the conversation.** `historyOf` did not carry it, so a person
      could say "do option two" and the next request arrived without the answer that had the options
      in it — the model asked to remember something it was never told.
      **Stop was rendered as a failure**, showing the platform's AbortError on a card, and the branch
      read `activeRunRef.current.runId` directly — which New chat and unmount set to null, so
      starting a plan and then opening a new chat crashed the panel. Both now follow the ordinary
      run's rules: `ownsRun`, and a stop is an outcome.
      **The mode was not persisted**, so every reload returned to Ask — and Ask can write. A person
      who deliberately chose Plan came back to a panel that would apply, having changed nothing and
      been told nothing.
      **The dev bridge rejected a conformant outline.** `scripts/ai-plan-bridge.mjs` refused any
      answer with zero commands, so against a live model Plan could only "succeed" by VIOLATING the
      contract it had just been handed. The permission is read from the forwarded contract's
      `commands.maxItems === 0`, so the bridge enforces what it sent rather than learning what Plan
      mode is.
      **Three smaller ones**: suggestion chips measured ~42px against this project's own 44px
      minimum, on a control directly under the thumb; the rail's 2px block padding shaved the outer
      pixel off a focus ring that reaches 3px; and the locked mode buttons kept `cursor: pointer` and
      their hover, with the reason only in a `title` no keyboard or screen-reader user can reach.
      **Two the review raised that I did NOT take**, and why. The comparator equality case and the
      normalised dedup key I did fix. `offset` remains unused in production — the rotation is real
      and tested, and the caller that varies it belongs with the "show me others" affordance that
      does not exist yet; removing it now would only have to be written again. And the review's
      reading that Plan should enter the split-build path (T290–T292) is the plan's own ق٥ and is
      NOT done: what exists is the outline. That is recorded below as a partial, not as a claim.

- [x] T330 [US10] **What the plan would change, before the decision (T292's half, and T291's
      negative).** `AssistantPanel.impact.ts`: `planImpact(before, after)` diffs the document
      `previewAiPlan` produced — the plan rehearsed on a scratch kernel through the REAL door —
      against the live one. Not a re-reading of the step list, and no second model call: the two
      differ exactly where it matters, and a `setProp` to the value already there reads like work in
      a step list while moving nothing on the page. The card now says so before a person spends an
      undo finding out.
      **A rule the tests forced me to decide.** Adding a block changes its parent's slot list, so a
      naive diff reported "2 blocks added, 1 changed" for what a person calls "2 blocks added" —
      and once every add inflates the changed count, that count means nothing. A slots-only
      difference counts ONLY when the set of children is unchanged, which is a reorder: the same
      children in a different order, something nothing else in the summary would say.
      Computed ONCE, when the plan arrives, and stored on the turn: the honest source builds a
      scratch kernel and dispatches the whole plan, which is the right price per proposal and the
      wrong one per render — `turns` changes on every streamed progress tick. It is plain data, so
      it survives persistence as readable history, unlike the proposal beside it.
      T291's negative is stated over the WHOLE tree, not one card: while Plan is selected, no button
      anywhere reads "Apply".
      Mutation-checked: counting slots as an ordinary change, dropping the reorder case, dropping
      orphans, and removing the card's impact each fail exactly the tests that name them.

- [x] T332 [US10] **A labelled cost estimate (T292's last third).** `estimateRequestTokens` uses the
      ENGINE's own `estimateAiPlanWireRequestTokens` over `result.context` — the assembled context
      this run actually carried — so the number a person reads is the same one `generateAiPlan`
      checks its budget against, not a second calculation wearing the same name. No engine change was
      needed: `AiAgentRunResult.context` already carries everything the request held.
      Rounded to two significant figures and labelled `تقدير` / `Estimate`, because both facts are
      true and both belong on screen: no model was asked, and it measures the REQUEST rather than
      the answer. "~4.2k" says estimate in a way "4,237" does not.

- [x] T333 [US10] **A gap in `planImpact` that a review agent's probe found before its report
      landed.** My rule was "a parent's slot change is already explained by an added or removed
      child". That is true for an add and a remove and FALSE for a MOVE: a node relocated between
      two boxes leaves both parents' membership different with nothing added and nothing removed to
      account for it, and the node itself byte-identical — so the card said the plan changes NOTHING
      while the page visibly rearranged.
      The rule is now precise instead of approximate: a parent's slots are compared with the added
      and removed ids SUBTRACTED from both sides. What survives that subtraction is exactly the two
      structural changes nothing else in the summary would say — a reorder and a move.
      Worth recording how it was found: five reviewers were reading in parallel, and one wrote a
      throwaway probe test to see what the function actually returns rather than reasoning about it.
      That is the technique, not the agent: I had reasoned about the same function and reasoned
      wrong.

- [x] T331 [US10] **A design break the owner caught from a screenshot, twice in one session.** The
      mode-lock explanation was a paragraph INSIDE the radiogroup: it wrapped over three lines
      between the mode buttons and Send, and the composer's action row looked broken. It moved to
      the hint line under the row — the one-line place a person already reads for mode information —
      and a test now asserts it is there and NOT among the buttons.
      Recorded because it is the second time the same mistake shape appeared: a thing that reads
      correctly in isolation, put in a place that has no room for it. Both were caught by a person
      looking at the screen, not by a green suite.

**PARTIAL, stated as one**: D1's plan (ق٥) asks for Plan to enter the build path and stop at the
structure with a plan card carrying steps, "what will change" from `planImpact()`, and a labelled
cost estimate. What is built is the outline route — Plan answers with a four-part plan, writes
nothing, and offers a follow-up. The richer card, `planImpact()`, the cost estimate and
`createDirectPlanProvider` are not built. T290–T292 stay open.

**Two suite failures investigated, with different answers.** `@craftkit/builder-ai`'s
`custom-code-vocabulary` first test and `@craftkit/builder-code-view`'s `CodeViewPanel` are 5s
timeouts that appear only in the full parallel run and pass in isolation (ai 446/446; code-view
86/86, seven consecutive runs) — load, not regression. The AssistantPanel story was the opposite: it
reproduced in isolation, and it was mine (T319). Reproducing in isolation is the check that
separates them, and it is the one worth running before calling anything flaky.

**Pre-existing and NOT mine, recorded again**: `pnpm check:components` is RED with the same 11
missing artifacts in `custom-code` (`CustomCodeBlock`, `CustomCodeCssField`, `CustomCodeTreeField`)
and `renderer/CustomCode` — now across 108 components rather than 102. It blocks `pnpm verify` and
belongs to whoever owns those components.

- [x] T334 [US10] **Adaptive split-build concurrency.** `runAiBuild` now derives its default writer
      pool from the scaffolded section count: 3 for the baseline, 4 for 4–6 sections, 5 for 7–9,
      and a hard ceiling of 6 for 10–12. A caller-supplied `fillConcurrency` remains exact. The
      integration proof holds four provider fills behind one gate and observes all four in flight;
      a large-build proof observes six and no more. Ordered landing and per-section validation are
      unchanged. **FR-103, SC-027.**

**Total after the first D2 tasks**: 334 tasks.
