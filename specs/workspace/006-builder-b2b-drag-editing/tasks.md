# Tasks: Builder B2b Drag Editing

**Input**: Design documents from `specs/workspace/006-builder-b2b-drag-editing/` **Prerequisites**:
spec/plan/research/data-model/contracts/quickstart complete; 005 canvas delivered and green. Tests
are MANDATORY; every new UI component ships the full 5-artifact contract. NO COMMITS — the user has
explicitly withheld commit authorization; the final task produces a proposal only.

## Phase 1: Setup

- [x] T001 Confirm zero workspace changes needed: no new members, no new dependencies, no glob edits
      (R1); `pnpm check:workspace` green as the baseline snapshot

## Phase 2: Foundational (blocking all stories)

- [x] T002 [P] Rule gate + resolver (contract §2): packages/builder/shell/src/overlay/
      drop-resolver.ts — `slotAccepts` (allow, max with own-slot exemption, self/descendant
      exclusion via parent map) + `resolveDropTarget` (hovered-half sibling gaps, into-drop,
      ancestor walk, post-removal index adjustment, indicator geometry) + drop-resolver.test.ts
      incl. the SC-003 resolver≡door agreement sweep over generated documents
- [x] T003 [P] Drag chrome (contract §1 s2): packages/builder/shell/src/overlay/drag-chrome.ts —
      prebuilt ghost outline, target highlight, insertion indicator joining the existing chrome
      layer + overlay.css additions (`--bldr-*` tokens, physical geometry per the B2a exception) +
      drag-chrome.test.ts
- [x] T004 Drag session (contract §1): packages/builder/shell/src/overlay/drag-session.ts — state
      machine (s1–s5: threshold, chrome-only, single-dispatch commit + selection follow, zero-trace
      cancel, self-cancel subscription, announcements, hover suppression callback) +
      drag-session.test.ts (depends T002, T003)
- [x] T005 [P] Keyboard moves (contract §3): packages/builder/shell/src/keyboard/move-actions.ts —
      `resolveMoveAction` (Alt+arrows, RTL mirror) + `performMoveAction` (k1–k3 through
      `slotAccepts`, one moveNode, announcements) + move-actions.test.ts (depends T002)

## Phase 3: User Story 1 — Rearrange by dragging (P1) 🎯 MVP

- [x] T006 [US1] EditorCanvas editable wiring (contract §6): `editable` prop + session integration
      into existing frame listeners (pointerdown/move/up, Escape-cancels-session ordering, hover
      suppression, e1–e3) in packages/builder/shell/src/components/EditorCanvas/EditorCanvas.tsx
      (depends T004)
- [x] T007 [US1] US1 acceptance in EditorCanvas.test.tsx: AC1–AC6 (gap drop order, half rule, allow
      rejection, max with own-slot exemption, zero-trace cancel incl. Escape and no-target release,
      zero re-renders press→pre-drop on landing + 1,000-node stress) + Law-S audit across a full
      drag (FR-014) + editable-absent no-op proof (FR-012)
- [x] T008 [US1] Browser truth: `DragRearrange` play() in EditorCanvas.stories.tsx — dispatched
      PointerEvents drag in Chromium, indicator at the correct gap, committed order asserted,
      idempotent for reruns; plus an RTL drag variant (FR-011)

**Checkpoint**: blocks rearrange by pointer under the one-transaction law.

## Phase 4: User Story 2 — Build from the palette (P2)

- [x] T009 [P] [US2] shell components/Palette/ — FULL contract (Palette.tsx per contract §4 p1–p3 +
      Palette.css + stories default/RTL/keyboard-insert play() + docs.mdx + test + index); catalog
      liveness via registry version; keyboard walk-up insert; no-acceptor announcement (depends
      T002)
- [x] T010 [US2] Insert-drag path: `CanvasDragHandle` (contract §6) + host→frame coordinate bridge
      (ONE function + its own test) + palette pointerdown handoff; US2 acceptance: palette lists
      catalog, runtime register/dispose liveness, drag-insert one transaction at resolved gap,
      keyboard insert placement rule, no-valid-target zero trace (Palette.test.tsx +
      EditorCanvas.test.tsx) (depends T006, T009)

## Phase 5: User Story 3 — Layers tree (P3)

- [x] T011 [US3] shell components/LayersTree/ — FULL contract (LayersTree.tsx per contract §5
      l1–l4 + LayersTree.css + stories default/deep-nesting/selection-sync play() + docs.mdx +
      LayersTree.test.tsx + index): rows from `orderedChildren`, bidirectional kernel selection with
      ancestor reveal, expand/collapse view state, tree a11y pattern with roving tabindex,
      document-change re-derivation incl. undo

## Phase 6: User Story 4 — Keyboard arrangement (P4)

- [x] T012 [US4] Alt-move wiring in EditorCanvas (before traversal; editable-gated) + US4
      acceptance: reorder/clamp/out/in flows, illegal-move announcements, selection retention, RTL
      mirroring (EditorCanvas.test.tsx) (depends T005, T006)

## Phase 7: Integration, polish & delivery gates

- [x] T013 Preset surface (contract §8): Palette + LayersTree (+ drag types) re-exports in
      packages/builder/editor/src/index.ts + surface.test.ts entries
- [x] T014 Playground composition: edit-mode layout (palette | canvas | layers) in
      apps/playground/src/app/App.tsx + SC-004 hand-built-landing acceptance flow + drag/Alt-move
      scenario additions in App.test.tsx (depends T006, T009, T011, T013)
- [x] T015 [P] Docs: EditorCanvas.docs.mdx drag section; shell README drag-engine section;
      research-R9 smoothness run documented in quickstart (already) — verify coherence
- [x] T016 Evidence run per quickstart: narrow sequence → workspace gates + boundary-negative re-run
      → storybook build + browser suite with catalog-presence check (Palette, LayersTree,
      DragRearrange) → full `pnpm verify`; record outputs in this file — **Recorded 2026-08-25**:
      narrow tests exit 0 for all eight members (schema 80, core 86, react 10, renderer 33, shell
      99, blocks-marketing 18, preset 35, playground 13 = 374); `check:workspace` 17 members ·
      `check:components` 23 components · `check:boundaries` 488 files, all exit 0. Storybook: build
      exit 0; catalog-presence found 4 Palette entries, 4 LayersTree entries, and the DragRearrange
      story; browser suite 65 passed at a11y error level — including the REAL Chromium PointerEvent
      drag (indicator at the correct gap, committed order, exactly one transaction; a 0-height
      fullscreen story viewport initially blinded in-frame hit-testing and was fixed with an
      explicit-height decorator). Boundary negatives re-proven live and reverted:
      shell→blocks-marketing ⇒ exit 1, playground→builder-shell ⇒ exit 1, restore ⇒ exit 0 (B2b
      added no edges). Full `pnpm verify` exit 0. Design defect caught BY the acceptance suite
      mid-implementation: a palette CLICK fired both the pointer-drag path (silent into-root drop on
      pointerup) and the click-insert path — two transactions per click; fixed at the principle
      level (the activation threshold now applies to palette drags too: a click releases while still
      pending), bridge tests updated accordingly.
- [x] T017 Final diff review per .specify/agents/rules/code-review.md (independent read-only
      reviewers); fix accepted findings with regression tests; re-run affected checks — **Recorded
      2026-08-25**: two independent read-only reviewers (drag-engine lens + panels/a11y/tests lens).
      Both converged on ONE architectural seam jsdom cannot simulate — the host↔frame document
      boundary. Engine lens: 2 Critical (a palette drag OUTSIDE the canvas offered and could commit
      a phantom root-append; a drag whose release lands outside the frame document wedged the
      session `active` forever and could hijack the next gesture with a stale payload) + 3 Important
      (suppress-flag leak swallowing the next click; per-gesture host listeners leaking on
      unmount/kernel-swap; the hot-path ancestor walk contradicting the "never a tree scan" contract
      via the cold-path parentOf). Panels lens: 2 Critical (roving-focus loss when the FOCUSED tree
      row is removed by undo — the browser drops focus to body during commit, before any passive
      effect; the SC-004 scenario never asserted the N+M transaction arithmetic it was named for) +
      4 Important (aria-posinset/setsize missing on the flat tree DOM; RTL tree mirroring untested;
      repeated live-region outcomes silenced by React's same-string bailout; max-capacity refusal
      proven only at the pure-function level). ALL fixed at the principle level with regression
      tests — see contract §9.1–§9.8: viewport port + session law s6, the permanent host-side safety
      net (+ window-blur cancel), frame-release-only suppress flag, WeakMap parent memoization,
      {text,nonce} live regions in both channels, layout-effect focus repair, explicit ARIA set
      positions, a visible transaction counter making SC-004's arithmetic literal (0 → 3 → 4), and
      end-to-end max/own-slot session proofs. Re-runs: shell 107 / playground 13 / storybook 65
      browser tests / full `pnpm verify` exit 0. Smoothness evidence (informational, per the
      counting-only gate policy): an uncontended probe measured 10,000 drop resolutions on the
      1,000-node stress document in 12.4 ms — 1.24 µs per pointer move with the memoized parent map,
      three orders of magnitude under a 60 fps frame budget.
- [x] T018 /speckit-converge (multi-agent audit + adversarial verification); implement appended gaps
      to completion
- [x] T019 /speckit-workspace-handoff (HANDOFF/context refresh; durable invariants → MEMORY)
- [x] T020 /speckit-workspace-commit proposal ONLY — commit authorization remains withheld

## Dependencies

```text
Phase1 (T001) → Phase2 (T002 ∥ T003 ∥ T005; T004 after T002+T003) →
US1: T006 → T007 → T008 →
US2: T009 ∥ (from T002) → T010 (after T006+T009) →
US3: T011 ∥ (anytime after Phase 2) →
US4: T012 (after T005+T006) →
Phase7: T013 → T014; T015 [P]; T016 → T017 → T018 → T019 → T020.
Story independence: each phase ends in its own acceptance additions; stopping at any checkpoint
leaves `pnpm verify` green.
```

## Implementation strategy

MVP = Phases 1–3 (rearrange under the law). Palette makes building possible, layers makes depth
navigable, Alt-moves close gesture parity. The mechanical gates (check:components, boundary
validator, storybook catalog check, resolver≡door sweep) — not discipline — hold the contract.

**Convergence outcome (2026-08-25, T018)**: 13-agent audit — 16 candidates → 8 adversarially
verified → 7 confirmed, 1 refuted (the parent-map memoization "gap" was an accepted §9.4
by-construction decision with its evidence-log entry). All seven implemented with regression tests
(contract §10.1–§10.7). The headline: asserting SC-001's post-drop clause exposed a LATENT B1 defect
— `memo`'s inner function name shadowing the memoized export made every recursive child un-memoized,
so any parent re-render dragged its whole subtree (42+ nodes re-rendered per stress drop; now
exactly 3: both parents + the moved node's real remount). Fixed in the renderer (NodeViewInner),
recorded in the 004 contract §7.6. Final: shell 116 tests, renderer 33, preset 35, playground 13.
