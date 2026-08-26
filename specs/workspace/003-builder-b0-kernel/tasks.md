# Tasks: Builder B0 Kernel Foundation

**Input**: Design documents from `specs/workspace/003-builder-b0-kernel/` **Prerequisites**:
plan.md, spec.md, research.md, data-model.md, contracts/builder-kernel.md, quickstart.md — all
present. Tests are MANDATORY in this repository (workspace preset supersedes the core command's
optional-test language). No UI components exist in this feature, so no component artifact tasks
apply.

**Organization**: Setup → Foundational (blocking) → one phase per user story (US1–US4 from spec.md,
priority order) → Polish & delivery gates. `[P]` = path-disjoint and parallelizable with its
phase-mates.

## Phase 1: Setup

- [x] T001 [P] Add a "Status: reference material — executive source is
      specs/workspace/003-builder-b0-kernel" banner line at the top of
      specs/workspace/builder-core/crafterlayer-builder-master-plan.md,
      crafterlayer-builder-structure.md, and crafterlayer-builder-b0-appendix.md
- [x] T002 Add workspace glob `"packages/builder/*"` and catalog pins `zod: 4.4.3`,
      `immer: 11.1.18`, `zustand: 5.0.15`, `nanoid: 6.0.1`, `fast-check: 4.9.0` to
      pnpm-workspace.yaml (research R1)
- [x] T003 [P] Create packages/builder/schema skeleton: package.json (`@craftkit/builder-schema`,
      internal-mode exports `"."→./src/index.ts`, scripts lint/typecheck/test/test:coverage, deps
      zod, devDeps per plan), tsconfig.json (extends `@craftkit/typescript-config/headless.json`),
      vitest.config.ts (createNodeTestConfig), src/index.ts stub
- [x] T004 [P] Create packages/builder/core skeleton: package.json (`@craftkit/builder-core`,
      exports `"."` + `"./testing"→./src/testing/index.ts`, deps `@craftkit/builder-schema` +
      immer/nanoid/zustand, devDep fast-check), tsconfig.json, vitest.config.ts, src/index.ts +
      src/testing/index.ts stubs
- [x] T005 Run `pnpm install` and prove both filters resolve
      (`pnpm --filter @craftkit/builder-schema exec node -e "process.exit(0)"`); lockfile updates
      committed with the same change

## Phase 2: Foundational (blocking prerequisites for every story)

- [x] T006 [P] Add packages/typescript-config/headless.json (`extends ./base.json`,
      `lib: ["ES2024"]`) + its export entry in packages/typescript-config/package.json + a case in
      packages/typescript-config/test/exports.test.mjs
- [x] T007 [P] Add packages/test-config/src/node.mjs (`createNodeTestConfig`: environment node, no
      react plugin/jsdom, coverage thresholds 85/90/90/90 + stories/docs excludes) + src/node.d.ts +
      `"./node"` export in packages/test-config/package.json
- [x] T008 [P] Add packages/eslint-config/src/headless.mjs (`headlessConfig(files)` per research R9:
      core no-restricted-imports with allowTypeImports, no-restricted-globals, no-restricted-syntax
      Date.now/Math.random, scoped exemption override for
      `packages/builder/core/src/ports/system-*.ts`) + `"./headless"` export; compose into root
      eslint.config.mjs for `packages/builder/{schema,core}/src/**`; prove one violation fails and
      the exemption file passes
- [x] T009 [P] Extend packages/workspace-tools/src/workspace/discover-workspace.mjs `MEMBER_ROOTS`
      with `packages/builder` AND update every stale "apps/* and packages/*" contract text
      (validator error messages, JSDoc, packages/workspace-tools/README.md, affected fixtures/tests)
- [x] T010 Add packages/workspace-tools/src/workspace/validate-builder-boundaries.mjs (layer map
      schema=0…editor=5; lower-layers-only; extensions never on extensions; non-builder members
      reach the builder family only via `@craftkit/builder` while their other deps stay under
      existing rules) wired into the check-workspace CLI +
      packages/workspace-tools/test/builder-boundaries.test.mjs incl. a non-builder→non-builder pass
      case (depends on T009)
- [x] T011 [P] Implement packages/builder/schema/src/json/json-value.ts (JsonValue type +
      isJsonValue finite-number walk) and src/errors.ts (BuilderError + full code taxonomy from
      contracts §3) + colocated *.test.ts
- [x] T012 Implement packages/builder/schema/src/document/types.ts (BuilderDocument/Node slots-map
      per contracts §2) and src/document/validate.ts with BOTH passes — structural
      (root/exactly-once/duplicate-in-slot/cycles/orphans/empty-slot-arrays/JsonValue/finite/slot-name
      rules) and registry-aware via an injected `lookup(type) → BlockSchema | undefined` parameter
      (unknown-type/unknown-slot/allow/max/props-parse/style-literal rules) — + a negative test per
      checklist item (depends on T011; analyze C1)
- [x] T013 [P] Implement packages/builder/schema/src/blocks/style-values.ts (no-hex/no-px scan over
      prop values) + tests
- [x] T014 Implement packages/builder/schema/src/blocks/define-block-schema.ts (defineBlockSchema +
      JSON-representability guard rejecting date/bigint/function/undefined/symbol/map/set zod nodes)
      and src/json-schema.ts (z.toJSONSchema derivation) + tests (depends on T012)
- [x] T015 [P] Implement packages/builder/schema/src/document/migrations.ts (sequential registry,
      migrate→validate→open contract, doc/migration-gap) + tests
- [x] T016 [P] Implement
      packages/builder/core/src/ports/{clock.ts,ids.ts,persistence.ts,data-source.ts} interfaces +
      ports/{system-clock.ts,system-ids.ts} (the only Date.now/nanoid call sites) +
      src/testing/fixed-ports.ts (fixedClock, seededIds) + tests proving determinism of the seeded
      ports
- [x] T017 [P] Implement packages/builder/core/src/state/{store.ts,selectors.ts,selection.ts} —
      zustand/vanilla instance module-private behind BuilderStateFacade
      (getState/subscribe/subscribeNode/select; NO setState exposure) + tests incl. facade-only
      public surface assertion

## Phase 3: User Story 1 — Build and edit through commands with reliable undo (P1) 🎯 MVP

**Goal**: command-driven document editing with transactions, inverse-patch undo/redo, validated
single door, scoped notifications. **Independent test**: scripted command sequences on an empty
document — structure, history round-trips, rejection behavior — no UI (spec US1 scenarios 1–5).

- [x] T018 [P] [US1] Implement packages/builder/core/src/events/bus.ts (typed EventBus per contracts
      §9) + tests
- [x] T019 [P] [US1] Implement packages/builder/core/src/commands/define-command.ts
      (CommandInput→RegisteredCommand erasure; apply parses then runs — contracts §6) + tests
      proving parse-inside-the-door and strict-TS assignability into
      `Record<string, RegisteredCommand>`
- [x] T020 [US1] Implement packages/builder/core/src/commands/dispatch.ts pipeline (validate args →
      produceWithPatches → JsonValue+finite patch walk → transaction build via ports → append to a
      plain in-memory transaction list [coalescing/persistence flush arrive in T033] → history push
      → scoped notify → tx.applied event) + packages/builder/core/src/patches/apply.ts (applyPatches
      wrapper) + tests incl. no-partial-change on every rejection (depends on T018, T019; analyze
      I1)
- [x] T021 [US1] Implement packages/builder/core/src/commands/core-commands.ts — all ten core
      commands with structural guards
      (insertNode/removeNode/moveNode/setProp/setBinding/setResponsive/setDocMeta/duplicateNode/wrapNode/groupNodes
      per contracts §6) + per-command tests incl. cycle rejection, slot allow/max, same-parent
      grouping (depends on T020)
- [x] T022 [US1] Implement packages/builder/core/src/history/history.ts (undo/redo over
      inverse/forward patches, safe empty-stack no-ops, ClockPort-driven typing-merge window,
      history events) + tests (depends on T020)
- [x] T023 [US1] Implement packages/builder/core/src/kernel/{create-builder.ts,context.ts} (kernel
      factory + KernelContext with live surface/dir getters + docMeta.changed) including a minimal
      in-kernel block-schema catalog built from `options.extensions` block contributions that feeds
      command structural guards and `validate()`'s registry-aware lookup (full contribution catalogs
      remain T026), and src/testing/fixtures.ts (emptyDocument, landingFixture,
      stressDocument(1000)) wiring src/index.ts + src/testing/index.ts exports (depends on T021,
      T022; analyze C1)
- [x] T024 [US1] US1 acceptance + law suites in packages/builder/core/src: scenario tests for spec
      US1 1–5; fast-check property suite (≥1,000 randomized sessions: undo-all ≡ original, redo-all
      ≡ final); Law J negatives (function/undefined/bigint/NaN); Law S sealed-store audit (1:1
      change↔transaction, no setState in public API); FR-019 notification-count on
      stressDocument(1000); structural-validation-under-150ms budget (depends on T023)

**Checkpoint**: US1 fully functional and testable headless — MVP.

## Phase 4: User Story 2 — Extend through registered extensions (P2)

**Goal**: extension manager (register→topo→setup→dispose) + O(1) contribution catalogs.
**Independent test**: fixture extensions register/dispose; catalog lookups; cycle rejection (spec
US2 scenarios 1–4).

- [x] T025 [P] [US2] Implement
      packages/builder/schema/src/extensions/{manifests.ts,contribution-points.ts} (full
      ExtensionManifest union + contribution shapes per contracts §7 — type-only React imports) +
      tests for tier discrimination typing
- [x] T026 [US2] Implement packages/builder/core/src/registry/registry.ts (keyed O(1) catalogs incl.
      surface-filtered blocks) + src/keymaps/keymaps.ts (data-only) + tests (depends on T025)
- [x] T027 [US2] Implement packages/builder/core/src/extensions/manager.ts (register with
      topological dependency order, ext/cycle + ext/duplicate + ext/missing-dependency,
      setup/dispose lifecycle) + src/testing/fake-extension.ts (typed TrustedExtensionManifest — no
      `as never`) + kernel factory integration + tests (depends on T026)
- [x] T028 [US2] US2 acceptance suite: spec US2 scenarios 1–4 incl. flat-lookup-cost proof at
      10→1,000 contributions (depends on T027)

**Checkpoint**: US1+US2 — kernel with working extension system.

## Phase 5: User Story 3 — Organization content loads safely (P3)

**Goal**: tier-2 declarative hydration with structural code rejection + widget four-state gate.
**Independent test**: hydrate valid rows → catalogs; reject every function-bearing manifest (spec
US3 scenarios 1–3).

- [x] T029 [P] [US3] Implement packages/builder/schema/src/widgets/{contract.ts,validate-skin.ts}
      (DeclarativeWidgetTypeDef/SkinDef/CompositionDef + four-state gate naming missing states) +
      tests
- [x] T030 [P] [US3] Implement packages/builder/schema/src/extensions/validate-tier2.ts (structural
      function walk over raw rows; ext/tier2-executable with offending path; SchemaDescriptor
      passthrough) + tests covering a function in EVERY manifest position
- [x] T031 [US3] Implement packages/builder/core/src/registry/hydrate-declarative.ts (validate-tier2
      → all-or-nothing registration → catalogs indistinguishable from trusted lookups) +
      ExtensionManager.hydrateDeclarative wiring + tests (depends on T029, T030)
- [x] T032 [US3] US3 acceptance suite: spec US3 scenarios 1–3 + no-partial-registration proof
      (depends on T031)

**Checkpoint**: US1–US3 — security law demonstrably structural.

## Phase 6: User Story 4 — Persist, reload, replay deterministically (P4)

**Goal**: persistence port + memory adapter, snapshot+tail reload, replay equality, seq conflicts,
seed determinism. **Independent test**: persist/reload/replay equality + conflict rejection (spec
US4 scenarios 1–4).

- [x] T033 [P] [US4] Implement packages/builder/core/src/patches/log.ts (transaction log +
      ClockPort-driven coalescing constants N/T asserted by tests; typing never awaits
      persistence) + tests
- [x] T034 [US4] Implement packages/builder/core/src/testing/memory-persistence.ts
      (createMemoryPersistence per contracts §4) + kernel load path (migrate→validate→open;
      expectedSeq append; persist/seq-conflict) + tests (depends on T033)
- [x] T035 [US4] US4 acceptance suite: reload equality, replay ≡ final document, stale-seq conflict
      with stored-history integrity, fixed-ports field-for-field identical histories (SC-003
      property) (depends on T034)

**Checkpoint**: all four stories complete.

## Phase 7: Polish, documentation, and delivery gates

- [x] T036 [P] Write docs/architecture/decisions/0003-builder-dependency-law.md (ADR:
      workspace-tools layer validator over Turbo tags; links research R3) and update the decisions
      index if one exists
- [x] T037 [P] Write docs/architecture/decisions/0004-builder-tier2-declarative-model.md (ADR:
      JsonValue-typed tier-2, SchemaDescriptor compilation, versioned snapshot semantics; links
      research R7/R8) and update the decisions index if one exists
- [x] T038 [P] Write packages/builder/schema/README.md and packages/builder/core/README.md
      (member-owned public API + setup docs per rules/monorepo.md)
- [x] T039 Evidence run: per-package coverage
      (`pnpm --filter @craftkit/builder-schema test:coverage`, same for core, thresholds met) then
      full `pnpm verify` green end-to-end; record outputs
- [x] T040 Final diff review per .specify/agents/rules/code-review.md (severity-ordered findings),
      fix accepted findings, re-run narrow checks for every touched package
- [x] T041 Run /speckit-converge and implement any appended gap tasks to completion
- [x] T042 Run /speckit-workspace-handoff (refresh .specify/agents/HANDOFF.md; append durable
      invariants — laws + enforcement map — to .specify/agents/MEMORY.md)
- [x] T043 Run /speckit-workspace-commit to generate the Conventional Commit proposal from the real
      diff (no commit without explicit user authorization)

## Dependencies

```text
Phase 1 → Phase 2 → US1 (T018–T024) → US2 (T025–T028) → US3 (T029–T032) → US4 (T033–T035) → Phase 7
  Setup:        T002+T003+T004 land together (glob must match members); T005 after them
  Foundational: T006–T009, T011, T013, T015–T017 parallel-safe; T010 after T009;
                T012 after T011; T014 after T012
  US1:          T018,T019 parallel → T020 → T021,T022 → T023 → T024
  US2:          T025 → T026 → T027 → T028
  US3:          T029,T030 parallel → T031 → T032
  US4:          T033 → T034 → T035
  Story independence: each story phase ends in its own acceptance suite and the
  system remains green if later phases are deferred.
```

## Parallel execution examples

- Setup: T001 ∥ T003 ∥ T004 (T002 same change-set as T003/T004).
- Foundational wave 1: T006 ∥ T007 ∥ T008 ∥ T009 ∥ T011 ∥ T013 ∥ T015 ∥ T016 ∥ T017.
- US1 wave: T018 ∥ T019. US3 wave: T029 ∥ T030. Polish wave: T036 ∥ T037 ∥ T038.

## Implementation strategy

MVP = Phase 1 + Phase 2 + US1 (T001–T024): a working, property-tested, sealed, deterministic command
kernel. Each later story is an independent increment with its own checkpoint; stopping after any
checkpoint leaves the workspace green. Every task names exact paths inside the declared feature
scope; parallel tasks are path-disjoint.
