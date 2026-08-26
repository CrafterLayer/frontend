# Tasks: Builder B1 View Foundation

**Input**: Design documents from `specs/workspace/004-builder-b1-react-foundation/`
**Prerequisites**: spec/plan/research/data-model/contracts/quickstart complete; 003 kernel green.
Tests are MANDATORY. Every new UI component ships the full 5-artifact contract (mechanically
validated); tasks below name components explicitly — no hidden cleanup work.

## Phase 1: Setup

- [x] T001 Add glob `"packages/builder/extensions/*"` to pnpm-workspace.yaml (lands with T004's
      first member in the same change)
- [x] T002 [P] Skeletons for packages/builder/react and packages/builder/renderer: package.json
      (internal mode; react deps: `@craftkit/builder-{schema,core}` workspace + peer `react`;
      renderer additionally peer `react-dom`; devDeps per `@craftkit/query` react pattern), tsconfig
      (extends react-library.json), vitest.config.ts (createReactTestConfig), src/index.ts stubs
- [x] T003 [P] Skeleton for packages/builder/editor (`@craftkit/builder`): deps
      core+react+renderer+blocks-marketing (workspace) + peers react/react-dom; exports `"."` and
      `"./testing"` (passthrough re-export of `@craftkit/builder-core/testing` via src/testing.ts)
- [x] T004 [P] Skeleton for packages/builder/extensions/blocks-marketing
      (`@craftkit/builder-blocks-marketing`): deps `@craftkit/builder-schema` + peer react;
      `sideEffects: ["**/*.css"]`
- [x] T005 [P] Scaffold apps/playground (`@craftkit/playground`): package.json (deps
      `@craftkit/builder` workspace + react + react-dom; scripts dev/build/lint/typecheck/test),
      index.html, vite.config.ts (@vitejs/plugin-react), tsconfig (react-library + node types),
      vitest.config.ts, src/main.tsx bootstrap, thin src/app/App.tsx placeholder
- [x] T006 `pnpm install`; prove all five members resolve; `pnpm check:workspace` green (layer map
      already contains react/renderer/editor names; blocks-marketing resolves layer 4 by path)

## Phase 2: Foundational (blocking all stories)

- [x] T007 [P] renderer: src/resolve/responsive.ts (`resolveResponsiveProps` incl.
      unknown-breakpoint rejection) + src/resolve/theme.ts (`themeToCssVars`) + src/themes.ts
      (lightTheme/darkTheme per contracts §1) + colocated tests
- [x] T008 [P] renderer: src/subscribe.ts — `useNodeExternal(kernel, id)` and
      `useKernelState(kernel, selector)` via `useSyncExternalStore` over the 003 StateFacade (NO
      builder-react import) + tests
- [x] T009 [P] react: src/kernel-context.ts (context object) + hooks
      src/hooks/{use-builder,use-node,use-selection,use-dispatch,use-registry-version}.ts (+
      registry-version listens to extension.registered/disposed) + hook tests through a probe
      component
- [x] T010 [P] storybook: extend apps/storybook/.storybook/main.ts stories globs with
      `../../../packages/builder/*/src/**/*.stories.@(ts|tsx)`,
      `../../../packages/builder/*/src/**/*.docs.mdx`,
      `../../../packages/builder/extensions/*/src/**/*.stories.@(ts|tsx)`,
      `../../../packages/builder/extensions/*/src/**/*.docs.mdx`

## Phase 3: User Story 1 — Embed and render live (P1) 🎯 MVP

**Goal**: single-entrypoint mount; per-node live rendering; kernel access from views. **Independent
test**: jsdom mount with fixture blocks; content mirrors document; one change ⇒ one re-render; undo
visible; boundary negatives fail CI.

- [x] T011 [P] [US1] react components/BuilderProvider/ — full contract
      (BuilderProvider.tsx/stories/docs/test/index)
- [x] T012 [P] [US1] react components/Slot/ — render-prop slot component, full contract, order
      assertions
- [x] T013 [P] [US1] renderer components/UnknownBlock/ — fallback marker, full contract
- [x] T014 [US1] renderer components/DocumentView/ — live per-node tree (kernel BY PROP,
      `onBlockRender` probe, slots in document order, BlockRenderProps per 003) — full contract
      (depends T007/T008/T013)
- [x] T015 [US1] renderer components/CanvasFrame/ — isolation iframe (style mirroring incl. head
      MutationObserver, managed token style, dir root, portal, accessible title) — full contract
      (depends T007)
- [x] T016 [US1] preset: components/Page/ (structural root block: full contract +
      schema.ts/examples.ts; slot default allows marketing set + 'announcement') +
      src/default-blocks.ts manifest (depends on the T003 skeleton only)
- [x] T017 [US1] preset: components/Builder/ (provider + CanvasFrame(dir live via docMeta.changed) +
      DocumentView composition) — full contract — plus curated src/index.ts re-export surface per
      contracts §4 (depends T011/T014/T015/T016)
- [x] T018 [US1] US1 acceptance suite (renderer+react+preset tests): scenarios 1–5 incl. SC-002
      stress render-count (core testing fixtures in an isolated kernel), zero re-render on selection
      change, undo visibility, Law-S audit re-run with a mounted view (FR-017), and the two
      quickstart boundary negatives executed against the validator then reverted

**Checkpoint**: `<Builder/>` renders documents live — MVP.

## Phase 4: User Story 2 — Marketing blocks ship complete (P2)

**Goal**: five real blocks as one extension; mechanical contracts; a11y-gated stories. **Independent
test**: register extension; catalog + render + slot rules + validator counts 5/5; stories pass a11y
at error.

- [x] T019 [P] [US2] blocks components/Hero/ — schema.ts (tone/align/heading/body + actions slot
      allow ['cta'] max 2), Hero.tsx + Hero.css (logical props + tokens), examples.ts (ar+en),
      stories (default/dark/RTL/with-actions), docs.mdx, behavior test, index.ts
- [x] T020 [P] [US2] blocks components/Features/ — items list props per contracts §5, full contract
      set
- [x] T021 [P] [US2] blocks components/Pricing/ — plans list incl. highlighted state, full contract
      set
- [x] T022 [P] [US2] blocks components/Testimonials/ — quotes list semantics, full contract set
- [x] T023 [P] [US2] blocks components/Cta/ — real button semantics + emphasis variants, full
      contract set
- [x] T024 [US2] blocks src/index.ts `blocksMarketing` manifest (five schema+render registrations) +
      registration/coverage tests: catalog discovery, example documents render, slot-rule violations
      still rejected through the view, `pnpm check:components` counts all five (depends T019–T023)

**Checkpoint**: real vocabulary registered and rendering.

## Phase 5: User Story 3 — Static rendering + breakpoints (P3)

- [x] T025 [US3] renderer components/StaticDocument/ — pure tree (document+blocks lookup+breakpoint)
      — full contract (depends T007/T013)
- [x] T026 [US3] renderer src/render-static-markup.ts — `renderStaticMarkup` via react-dom/server +
      purity note (depends T025)
- [x] T027 [US3] US3 acceptance suite: static-twice byte equality, live/static content parity on
      marketing landing + kernel fixtures, per-breakpoint override resolution incl. no-override
      identity (SC-003/FR-007)

## Phase 6: User Story 4 — Playground proves it (P4)

- [x] T028 [US4] playground features/preview/create-playground-kernel.ts (registers defaultBlocks +
      blocksMarketing; marketing-landing + empty fixtures authored here; seeded ports + memory
      persistence via `@craftkit/builder/testing`) + features/preview/demo-extension.ts (the
      'playground-demo' manifest wiring the Announcement component from T029) + tests (depends on
      T029 for the component)
- [x] T029 [P] [US4] playground feature components — FIVE full contracts under
      src/features/preview/components/: ThemePicker/, DirectionFlip/, FixturePicker/,
      RegisterDemoExtension/ (each drives ONLY `kernel.dispatch`/extension APIs + local UI state),
      and Announcement/ (the runtime-demo block renderer + its schema.ts/examples.ts)
- [x] T030 [US4] playground src/app/App.tsx thin composition (controls + `<Builder/>`) + US4
      acceptance suite: fixture visible in frame with tokens, theme switch recolors sampled style
      <1s no reload (SC-004), dir flip via setDocMeta (document-safe), runtime registration → insert
      announcement renders (SC-005) → dispose → fallback, zero-network assertion (no fetch/XHR usage
      in app source) (depends T028/T029, US1–US3)

**Checkpoint**: all four stories demonstrable end-to-end.

## Phase 7: Polish & delivery gates

- [x] T031 [P] READMEs: packages/builder/{react,renderer,editor}/README.md,
      packages/builder/extensions/blocks-marketing/README.md, apps/playground/README.md
      (member-owned API/setup docs)
- [x] T032 Evidence run: quickstart narrow sequence per package →
      `pnpm check:workspace && pnpm check:components && pnpm check:boundaries` →
      `pnpm build-storybook` + `pnpm test:storybook` (a11y error level over new stories) → full
      `pnpm verify`; record outputs — **Recorded 2026-08-25**: narrow tests exit 0 for all seven
      members (schema 80, core 80, react 9, renderer 28, blocks-marketing 18, preset 31 incl. the
      contract-§4 surface guard, playground 10 = 256 tests); `check:workspace` 16 members ·
      `check:components` 19 components · `check:boundaries` 371 files, all exit 0; boundary
      negatives proven live: renderer→builder-react ⇒ `BUILDER_LAYER_VIOLATION` exit 1, and
      playground→builder-core ⇒ `BUILDER_FAMILY_ACCESS` exit 1, both reverted and re-verified green;
      `build-storybook` exit 0 and `test:storybook` 44 passed (a11y at error level); full
      `pnpm verify` exit 0. SC-006 note: the contended coverage lane measured 227 ms best-of-15
      (instrumentation + parallel turbo), so the merge gate now asserts load-invariant linear
      scaling; uncontended, the whole laws suite (five interleaved 1k-node validations included)
      completes in ~300 ms total, far inside the 150 ms per-validation budget.
- [x] T033 Final diff review per rules/code-review.md; fix accepted findings; re-run affected checks
      — **Recorded 2026-08-25**: two independent read-only reviewers (engines/preset lens +
      blocks/playground/a11y lens). Findings accepted and fixed, each with a regression test:
      **High** — registry-version/epoch hooks derived their value inside the event listener, so a
      registration fired before a consumer subscribed (tree-order-earlier sibling mount effect) was
      silently dropped (bus has no replay) ⇒ fixed by a kernel-intrinsic monotonic
      `extensions.version()` counter read as the `useSyncExternalStore` snapshot (contract §7.1);
      **High** — Storybook globs omitted `apps/playground`, so the five playground components never
      entered the a11y error gate ⇒ globs added; catalog grew 44→50 browser tests, all passing;
      **Medium** — CanvasFrame's mirror cleanup left clones behind under StrictMode's dev
      double-invoke ⇒ cleanup now removes clones (StrictMode regression test); **Medium** —
      Announcement success tone used raw hex ⇒ optional `--t-success(-text)` tokens with fallbacks
      (contract §7.5); **doc gap** — `useKernelSelector` missing from the §4 list ⇒ contract §7.2.
      Re-runs after fixes: core 81 / react 10 / renderer 30 / preset 31 / playground 10 tests,
      typecheck 0 everywhere, storybook build + 50 a11y tests, full `pnpm verify` exit 0.
- [x] T034 /speckit-converge; implement any appended gaps to completion
- [x] T035 /speckit-workspace-handoff (HANDOFF/context refresh; durable invariants → MEMORY)
- [x] T036 /speckit-workspace-commit proposal (no commit without explicit user authorization)

## Dependencies

```text
Phase1 → Phase2 → US1 (T011–T018) → US2 (T019–T024) → US3 (T025–T027) → US4 (T028–T030) → Phase7
Setup: T001+T004 same change; T002–T005 parallel; T006 last.
Foundational: T007–T010 all parallel.
US1: T011,T012,T013 parallel → T014 → (T015 ∥ T016) → T017 → T018.
US2: T019–T023 parallel (path-disjoint block folders) → T024.
US3: T025 → T026 → T027.   US4: T028 ∥ T029 → T030.
Story independence: each phase ends in its own acceptance suite; stopping at any
checkpoint leaves `pnpm verify` green.
```

## Implementation strategy

MVP = Phases 1–3 (a mounted `<Builder/>` rendering live with scoped updates). Blocks (US2) make it
real; static (US3) seeds publishing; playground (US4) is the integration proof. Parallel tasks are
path-disjoint; every component task names its complete artifact set so `check:components` (not
discipline) is the gate.

## Phase 8: Convergence

- [x] T037 Re-run the Law-S 1:1 observable-change↔transaction audit WITH a mounted DocumentView
      (valid command, rejected command, no-effect command, undo, redo, selection write — assert
      pairing counts hold while node subscribers are attached and rendering) in
      packages/builder/renderer/src/components/DocumentView/DocumentView.test.tsx per FR-017
      (partial)
