# Tasks: Builder B3c Inline Editing & Floating Toolbars

**Input**: Design documents from `specs/workspace/009-builder-b3c-inline-editing/`
**Prerequisites**: B3b delivered and green; prior-art research complete (research.md R0–R3). Tests
are MANDATORY; every new UI component ships the full component contract. NO COMMITS — authorization
remains withheld; the final task produces a proposal only.

## Phase 1: Vendor intake (the first vendored code in this repository)

- [x] T001 Create `vendor/` with `VENDOR.md` (what, upstream repo + pinned commit, license, why
      vendored rather than depended, what we changed) and `THIRD_PARTY_LICENSES.md` (MIT texts for
      Puck and TipTap); add a `check:workspace`-side assertion that every file under `vendor/`
      carries a provenance header and appears in VENDOR.md
- [x] T002 Vendor Puck `packages/core/components/InlineTextField/index.tsx` (MIT, pinned commit)
      into `vendor/puck/inline-text-field.tsx` with a provenance header, unmodified; the ADAPTATION
      lives separately in the shell component (T008)

## Phase 2: Foundational (blocking all stories)

- [x] T003 [P] `positionFloating` (contract §2) in shell/src/overlay/floating-position.ts +
      table-driven suite: prefer-above, FLIP at the frame top edge, inline clamping, RTL mirroring,
      zero-size and oversized-toolbar degenerate cases (SC-004)
- [x] T004 [P] `toHost` beside `toFrame` in EditorCanvas (contract §7 c1) + a test asserting the
      pair round-trips a point (the ONE meeting place; future zoom lives here)
- [x] T005 [P] `inlineEditable` declaration (contract §1) in defineBlockSchema + registration- time
      validation (unknown key, wrong kind) + schema tests

## Phase 3: User Story 1 — Edit text where it lives (P1) 🎯 MVP

- [x] T006 [US1] Inline session (contract §3) in shell/src/overlay/inline-session.ts: enter
      (double-click / Enter), exit (Escape / other selection / node vanished), zero dispatch on
      entry and exit + unit tests
- [x] T007 [US1] Renderer seam: swap the declared prop's output for the editing surface on exactly
      ONE node, so only that node's subtree re-renders (FR-009) + render-scope test
- [x] T008 [US1] `InlineTextSurface` shell component adapted from the vendored Puck file (contract
      §4 t1) — FULL component contract; the per-keystroke store write becomes our
      one-commit-per-change door call; value-sync guard and hover/focus gating preserved
- [x] T009 [US1] US1 acceptance: AC1–AC6 (enter by both gestures, one tx per commit + live canvas,
      Escape keeps selection, click-away commits and re-selects, undo shows through, non-editable
      blocks ignore the gesture)

**Checkpoint**: text edits where it lives, under the same transaction law.

## Phase 4: User Story 2 — The formatting bubble (P2)

- [ ] T010 [US2] Selection-rect channel in the richtext extension: `selectionUpdate` →
      `posToDOMRect` → layer-local anchor, with the VENDORED BubbleMenu `shouldShow` logic
      (attributed; `@tiptap/core` only, no new package)
- [ ] T011 [US2] `TextBubble` shell component (contract §5) — FULL contract; pointer-down
      cancellation + the canvas layer-origin click guard (risks 2 and 9)
- [ ] T012 [US2] US2 acceptance: AC1–AC5 (appears on non-empty selection, one tx per action with the
      selection preserved, disappears on collapse/exit/out-of-view, stays anchored across frame
      scroll and resize, absent for plain-text surfaces)

## Phase 5: User Story 3 — Block action bar (P3)

- [ ] T013 [US3] `BlockActionBar` as a `'selection'` canvas tool (contract §6) — FULL contract;
      duplicate / delete / move earlier / move later / edit text
- [ ] T014 [US3] US3 acceptance: AC1–AC5 (anchored to the outline, one tx + expected resulting
      selection per action, invalid actions absent-or-disabled, hidden during a drag,
      keyboard-operable)

## Phase 6: User Story 4 — The laws survive (P4)

- [ ] T015 [US4] Zero-render and containment proofs on the 1,000-node stress document:
      hover/select/scroll/toolbar positioning ⇒ 0 content renders; an inline commit ⇒ exactly one
      node's subtree; the engine loader ⇒ 0 invocations without rich inline editing
- [ ] T016 [US4] RTL acceptance across all three surfaces + the Chromium browser-truth stories
      (enter-edit, bubble format, exit) inside the real frame (SC-006)

## Phase 7: Integration, polish & delivery gates

- [ ] T017 Preset surface additions + surface.test entries
- [ ] T018 Playground scenario 9: select → edit inline → bubble-format → action-bar duplicate → undo
      lockstep, with the Law-S counter
- [ ] T019 [P] Docs coherence: shell/renderer README notes; VENDOR.md cross-links from the adapted
      components
- [ ] T020 Evidence run per quickstart: narrow → gates + boundary negatives → storybook
      catalog-presence → full `pnpm verify`; record here
- [ ] T021 Final diff review (two independent read-only reviewers); fix accepted findings with
      regression tests; re-run affected checks
- [ ] T022 /speckit-converge (multi-agent audit + adversarial verification, with a MUTATION check on
      at least one recorded fix — the B3b lesson); implement appended gaps
- [ ] T023 /speckit-workspace-handoff (HANDOFF/context/MEMORY refresh)
- [ ] T024 /speckit-workspace-commit proposal ONLY — commit authorization remains withheld

## Dependencies

```text
T001 → T002 → (T003 ∥ T004 ∥ T005) →
US1: T006 → T007 → T008 → T009 → US2: T010 → T011 → T012 →
US3: T013 → T014 → US4: T015 → T016 →
T017 → T018; T019 [P]; T020 → T021 → T022 → T023 → T024
```

## Implementation strategy

MVP = Phases 1–3 (editing where the content lives). The bubble and the action bar are what make it
feel like a builder; the laws phase is what keeps it one. Prior art is adopted, not re-derived:
research R1 fixes exactly what is vendored, reused, and written fresh.
