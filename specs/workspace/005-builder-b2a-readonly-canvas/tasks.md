# Tasks: Builder B2a Read-Only Canvas

**Input**: Design documents from `specs/workspace/005-builder-b2a-readonly-canvas/`
**Prerequisites**: spec/plan/research/data-model/contracts/quickstart complete; 004 view foundation
green. Tests are MANDATORY; every new UI component ships the full 5-artifact contract (mechanically
validated). NO COMMITS in this milestone — the user has explicitly withheld commit authorization;
T021 produces a proposal only.

## Phase 1: Setup

- [x] T001 Skeleton packages/builder/shell (`@craftkit/builder-shell`, layer 3): package.json
      (internal mode; deps `@craftkit/builder-{schema,core,react,renderer}` workspace + peers
      react/react-dom; devDeps per builder-react precedent), tsconfig (react-library),
      vitest.config.ts (createReactTestConfig), src/index.ts stub
- [x] T002 `pnpm install`; `pnpm check:workspace` green (shell resolves at layer 3 in the existing
      map; no validator changes)

## Phase 2: Foundational (blocking all stories)

- [x] T003 [P] canvasTools read (contract §4): additive `RegistryRead.canvasTools()` in
      packages/builder/schema/src/extensions/contribution-points.ts + typed catalog read, `order`
      sort, duplicate-id probe join in packages/builder/core/src/registry/registry.ts + registry
      tests (duplicate probe all-or-nothing, disposal removes tools); 003 suites stay green
- [x] T004 [P] Renderer cooperation (contract §2): optional `attachNodeElement` prop through
      packages/builder/renderer/src/components/DocumentView/{DocumentView.tsx,NodeView/NodeView.tsx}
      (edit-only `data-bldr-node` wrapper + callback-ref registration) + tests: registration/
      unregistration reported, absent-prop output byte-identical (static path untouched); 004 suites
      stay green
- [x] T005 [P] Rect index (contract §1): packages/builder/shell/src/rects/geometry-ports.ts
      (`GeometryPorts`, `systemGeometryPorts`) + rects/rect-index.ts (`createRectIndex`:
      attach/detach, lazy `rect`, `nodeAt` hit-test, `version`, `stats`, `dispose`; invalidation =
      shared ResizeObserver + frame scroll + viewport resize + dir-attribute observer) +
      rects/rect-index.test.ts (observer-attribution, idle ⇒ 0 measures, lazy single-element
      re-measure, membership by ref, dispose disconnects)
- [x] T006 [P] Traversal model (contract §6): packages/builder/shell/src/keyboard/traversal.ts
      (document-order child lists from slots in schema declaration order; sibling next/prev;
      step-in/out; RTL mirroring; no-selection entry) + keyboard/traversal.test.ts

## Phase 3: User Story 1 — Inspect and select in place (P1) 🎯 MVP

**Goal**: hover + selection chrome over the B1 preview with zero content re-renders. **Independent
test**: jsdom mount with injected geometry ports; sweep/hover/select/clear with `onBlockRender`
counter pinned at 0; outlines correct.

- [x] T007 [P] [US1] Chrome elements: packages/builder/shell/src/overlay/outline-elements.ts
      (prebuilt hover/selection outlines + name labels; creation-free hot path) +
      overlay/overlay.css (`--bldr-*` tokens with fallbacks, logical properties, transforms only) +
      outline-elements.test.ts
- [x] T008 [US1] Overlay controller: packages/builder/shell/src/overlay/overlay-controller.ts (hover
      id from `nodeAt`, selection from kernel store subscription, dirty flag, ONE frame-rhythm flush
      with batched reads→writes, stale-id chrome hiding, label = description→type fallback) +
      overlay-controller.test.ts (depends T005, T007)
- [x] T009 [US1] shell components/EditorCanvas/ — FULL contract (EditorCanvas.tsx composition per
      contract §3: CanvasFrame + DocumentView(attach) + chrome layer + announcer + pointer/keyboard
      wiring; stories default/selection/RTL/dark WITH play() real-geometry assertions; docs.mdx
      incl. zero-render law and a11y notes; EditorCanvas.test.tsx; index.ts) (depends T004, T008)
- [x] T010 [US1] US1 acceptance suite in EditorCanvas.test.tsx: SC-001 counting (landing +
      1,000-node stress: sweep/hover/select/clear ⇒ 0 content re-renders), click ⇒ `setSelection`,
      programmatic selection renders identically (FR-004), empty-click/Escape clear (FR-005), Law-S
      1:1 audit re-run with EditorCanvas mounted (FR-017)

**Checkpoint**: read-only canvas MVP — see and pick blocks with zero content re-draws.

## Phase 4: User Story 2 — Geometry stays true without interaction (P2)

- [x] T011 [US2] Observation acceptance: programmatic block growth, frame scroll, viewport resize,
      and dir flip reposition/clear chrome with ZERO pointer interaction and 100%
      observer-attributed updates (`stats()`); undo removing the selected node clears chrome
      (SC-002/SC-003) — jsdom port-driven suites in rect-index.test.ts + EditorCanvas.test.tsx, plus
      browser-truth play() additions in EditorCanvas.stories.tsx (real resize ⇒ outline repositions)

## Phase 5: User Story 3 — Keyboard-first selection (P3)

- [x] T012 [US3] Keyboard + a11y wiring in EditorCanvas (focusable host, traversal keys per contract
      §6, Escape, `aria-live` announcer, no Tab trapping) + US3 acceptance: full keyboard walk of
      the landing fixture (siblings, into/out of the hero actions slot, RTL mirroring, entry with no
      selection), announcements asserted (SC-004)

## Phase 6: User Story 4 — Chrome is extensible, live (P4)

- [x] T013 [US4] Tool host: packages/builder/shell/src/overlay/tool-host.ts (lifecycle g1–g4 per
      contract §5: lazy cached `load`, mount with `CanvasToolTarget`, cleanup on target
      change/activation end/registry version change/unmount, fault isolation via `onToolError`,
      'always' on ready, 'drag' registered-but-inert) + tool-host.test.ts (cleanup 1:1 counting,
      failure containment, registry-version reaction) (depends T003)
- [x] T014 [US4] Playground demo: extend apps/playground/src/features/preview/demo-extension.ts with
      one selection-badge canvasTool; apps/playground/src/features/preview/components/EditMode/ —
      FULL contract (EditMode.tsx toggle + stories + docs.mdx + test + index); thin wiring in
      src/app/App.tsx (edit mode swaps in EditorCanvas via the preset); US4 acceptance: runtime
      register ⇒ badge on selection, dispose ⇒ gone + cleanups ran (SC-005), canvas keeps working
      after a deliberately-failing demo tool (FR-014) (depends T009, T013)
- [x] T015 [US4] Preset surface: re-export `EditorCanvas` + types from
      packages/builder/editor/src/index.ts per contract §8 + surface.test.ts entries; execute and
      revert BOTH boundary negatives (shell→preset upward ⇒ BUILDER_LAYER_VIOLATION;
      playground→shell direct ⇒ BUILDER_FAMILY_ACCESS), capturing outputs for T017

## Phase 7: Polish & delivery gates

- [x] T016 [P] packages/builder/shell/README.md (purpose, layer, API, ports rationale, dev commands)
- [x] T017 Evidence run per quickstart: narrow sequence → workspace gates → `build-storybook` +
      `test:storybook` with EXPLICIT shell-stories-in-catalog check (R12) → full `pnpm verify`;
      record outputs + boundary-negative captures in this file — **Recorded 2026-08-25**: narrow
      tests exit 0 for all eight members (schema 80, core 83, react 10, renderer 33, shell 39,
      blocks-marketing 18, preset 33, playground 12 = 308); `check:workspace` 17 members ·
      `check:components` 21 components · `check:boundaries` 413 files, all exit 0. Boundary
      negatives proven live and reverted: shell→preset upward blocked FIRST by pnpm's own cycle
      guard (`ERR_PNPM_DISALLOW_WORKSPACE_CYCLES`, exit 1 — layered defense), the pure-upward
      variant shell→blocks-marketing ⇒ `BUILDER_LAYER_VIOLATION` exit 1, playground→builder-shell ⇒
      `BUILDER_FAMILY_ACCESS` exit 1. Storybook: build exit 0, R12 explicit catalog check found 5
      shell entries + 4 EditMode entries in index.json, `test:storybook` 57 passed (a11y error
      level; includes the Chromium real-geometry play() proofs: outline≈target box, observer-driven
      reposition after a programmatic resize, RTL alignment). Shell coverage
      98.37/91.11/98.46/98.35. Full `pnpm verify` exit 0.
- [x] T018 Final diff review per .specify/agents/rules/code-review.md (independent read-only
      reviewers); fix accepted findings with regression tests; re-run affected checks — **Recorded
      2026-08-25**: two independent read-only reviewers (machinery/observation lens +
      a11y/tests/integration lens). Four High, one Medium, one Low — all verified against source and
      fixed, each with a regression test: **High (machinery)** — a same-size sibling REORDER
      (`moveNode` from another surface) moved DOM without firing any ResizeObserver and without
      re-running keyed wrappers' refs, so chrome kept a stale rect ⇒ added a structural
      MutationObserver channel (childList + class/style, subtree) on the frame body; O(1)
      invalidate-only, and it also guarantees the first content commit invalidates (closing the
      reviewer's second residual risk). Contract §1 updated. **High ×2 (a11y lens, one shared root
      cause)** — nothing pruned `state.selection` when its node was removed, so an undo left
      orphaned tool chrome AND made the announcer read a raw internal node id aloud ⇒ fixed at the
      KERNEL: `dispatch`/`undo`/`redo` prune dangling ids inside the SAME `store.write` (no extra
      notification, Law-S audit unchanged; array returned by reference when nothing dropped so
      selection subscribers never churn). ToolHost also gates activation on the target node still
      existing, and the canvas re-notifies hover as well as selection on document change; the
      announcer treats an unresolvable id as "Selection cleared". Contract §9.1/§9.2/§9.4. **High**
      — clicking inside the preview moves focus into the iframe's browsing context, stranding
      keyboard traversal ⇒ focus is pulled back to the host after an in-frame click, plus a
      `keydown` listener inside the frame so focus arriving there by any other route still traverses
      (keydown does not cross document boundaries ⇒ no double handling). Contract §9.3. **Medium** —
      `Selection` story's `play()` mutated a module-scope kernel and asserted growth against a
      captured absolute height, so an Interactions-panel rerun would fail ⇒ the resize is now sized
      RELATIVE to the current box (idempotent). **Low** — unused `@craftkit/builder-react`
      dependency removed from the shell package. **Also fixed en route** (surfaced by the re-run,
      same class as B1's SC-006 lesson): the playground's SC-004 test asserted a WALL-CLOCK budget
      (`< 1000 ms`) inside a merge gate and flaked at 1014 ms under parallel coverage
      instrumentation ⇒ the gate now asserts the property that makes it fast (in-place recolor: same
      frame document, same managed style element, no reload), with the absolute number left to the
      uncontended evidence run. Re-runs after fixes: core 86 / shell 44 / renderer 33 / preset 33 /
      playground 12; shell coverage 98.78 / 91.60 / 100.00 / 98.78; storybook build exit 0 + 57
      browser tests at a11y error level; full `pnpm verify` exit 0.
- [x] T019 /speckit-converge; implement any appended gap tasks to completion
- [x] T020 /speckit-workspace-handoff (HANDOFF/context refresh; durable invariants → MEMORY)
- [x] T021 /speckit-workspace-commit proposal ONLY — the user has explicitly withheld commit
      authorization for this milestone; produce the message, commit nothing

## Dependencies

```text
Phase1 (T001→T002) → Phase2 (T003–T006 all parallel) →
US1: (T007 ∥ after T005) → T008 → T009 → T010 →
US2: T011 → US3: T012 → US4: (T013 ∥ from T003) → T014; T015 after T009 →
Phase7: T016 [P] anytime after T009; T017 → T018 → T019 → T020 → T021.
Story independence: each story phase ends in its own acceptance suite; stopping at any
checkpoint leaves `pnpm verify` green.
```

## Implementation strategy

MVP = Phases 1–3 (chrome + zero-render proof). US2 makes geometry trustworthy, US3 makes it
accessible, US4 makes it extensible. Parallel tasks are path-disjoint; the mechanical gates
(`check:components`, boundary validator, storybook catalog check) — not discipline — hold the
contract.

## Phase 8: Convergence

Appended by `/speckit-converge` (13-agent audit: 15 candidates → 8 adversarially verified → 3
confirmed, 5 refuted as misreadings/stale line numbers). Confirmed items 1 and 3 are the same gap
seen from two slices.

- [x] T022 Prove the LIVE direction flip end-to-end, not just its links, per FR-011 / SC-002 /
      US2-AC4 and contract §7's "RTL flip correct" browser-truth row (partial): the composed chain
      (setDocMeta → frame root dir → rect-index dir observer → controller flush → outline re-track)
      is currently proven only link-by-link — `RightToLeft` mounts an ALREADY-rtl kernel and never
      flips, and quickstart.md's law-proof table names a "dir flip repositions" test in
      EditorCanvas.test.tsx that does not exist. Add (a) a jsdom composition test in
      packages/builder/shell/src/components/EditorCanvas/EditorCanvas.test.tsx that flips dir while
      mounted, with ZERO pointer interaction, and asserts the outline re-tracks, and (b) a Chromium
      play() flip proof in EditorCanvas.stories.tsx, written idempotently (flip to the OPPOSITE of
      the current dir) so an Interactions rerun cannot invalidate it
- [x] T023 Anchor the 1,000-node sweep to demonstrably real chrome per US1/AC5 (partial, honest
      severity LOW): EditorCanvas.test.tsx's stress test asserts only `renders === []`, which passes
      identically if every pointerMove silently resolved to no node. Assert hover visibility and the
      correct schema label per sweep step, plus a click-select and an empty-canvas clear. Do NOT
      assert transforms there — the harness injects one constant measure for every node, so a
      transform assertion would re-assert the injected constant (real geometry is proven in the
      Chromium play() lane)

**Convergence outcome (2026-08-25)**: T022 and T023 implemented and verified — shell suite 45 tests
(was 39), storybook 58 browser tests (was 57, +DirectionFlip Chromium flip proof), shell coverage
91.60 branches / 100.00 functions, full `pnpm verify` exit 0. The quickstart law-proof table was
corrected: it previously named a "dir flip repositions" proof in EditorCanvas.test.tsx that did not
exist; that row is now split into the kernel-pruning proof and the composed live-flip proof (jsdom
composition + Chromium browser truth), both of which now exist.
