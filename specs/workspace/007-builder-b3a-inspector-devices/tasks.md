# Tasks: Builder B3a Inspector, Devices & Preview

**Input**: Design documents from `specs/workspace/007-builder-b3a-inspector-devices/`
**Prerequisites**: spec/plan/research/data-model/contracts/quickstart complete; 006 delivered and
green. Tests are MANDATORY; every new UI component ships the full 5-artifact contract. NO COMMITS —
authorization remains withheld; the final task produces a proposal only.

## Phase 1: Setup

- [x] T001 Move zod from shell devDependencies to dependencies (runtime introspection; zod is
      already a layer-0 runtime dep — no catalog change); `pnpm install`; `pnpm check:workspace`
      green as the baseline

## Phase 2: Foundational (blocking all stories)

- [x] T002 [P] fieldTypes read (contract §2): additive `RegistryRead.fieldTypes()` in
      packages/builder/schema/src/extensions/contribution-points.ts + typed registration-order
      catalog read, duplicate-id probe join, disposal removal in
      packages/builder/core/src/registry/registry.ts + registry tests; 003 suites stay green
- [x] T003 [P] Buckets (contract §3): packages/builder/shell/src/devices/buckets.ts
      (`BUCKET_THRESHOLDS`, `bucketForWidth`, half-open b1) + buckets.test.ts (table incl.
      767/768/1023/1024)
- [x] T004 [P] Field resolution (contract §1): packages/builder/shell/src/fields/ resolve-field.ts
      (contributions-first f1, zod-4 unwrap+map f2, containment support f3) + resolve-field.test.ts
      (all kinds, wrappers, score/tie/≤0, unknown→readonly)
- [x] T005 [P] Default controls: packages/builder/shell/src/fields/controls/{TextField,
      SelectField,SwitchField,NumberField,ReadOnlyField}.tsx (one component per file; internal;
      FieldProps-driven; labeled, aria-describedby-ready) + controls.test.tsx behavior suite

## Phase 3: User Story 1 — Generated inspector (P1) 🎯 MVP

- [x] T006 [US1] shell components/Inspector/ — FULL contract (Inspector.tsx per contract §4 i1–i5 +
      Inspector.css + stories empty/selected/override/RTL with play() edit-props +
      Inspector.docs.mdx + Inspector.test.tsx + index) (depends T002, T004, T005)
- [x] T007 [US1] US1 acceptance in Inspector.test.tsx: AC1–AC5 (kinds/labels/values with zero panel
      code, one tx per commit + live canvas via a mounted EditorCanvas, rejection ⇒ 0 tx +
      control-adjacent reason, empty state, undo refresh/document truth)

**Checkpoint**: any registered block edits through a generated panel.

## Phase 4: User Story 2 — Devices & responsive editing (P2)

- [x] T008 [P] [US2] shell components/DeviceBar/ — FULL contract (presets 1280/834/390 + custom
      width via bucketForWidth; announced; RTL story; play() width switch) (depends T003)
- [x] T009 [US2] EditorCanvas `frameWidth` additive input (contract §6; centered layout, no hot-path
      change) + 005/006 suites stay green
- [x] T010 [US2] Inspector bucket wiring (contract §4 i2/i4: setResponsive writes, inherited- base
      placeholder, override marker, one-tx clear via null) + US2 acceptance: AC1–AC5 (frame width,
      override tx + marker + per-breakpoint rendering, clear, custom-width mapping, undo lockstep)
      (depends T006, T008, T009)

## Phase 5: User Story 3 — Field-type extensibility (P3)

- [x] T011 [US3] Runtime field-type acceptance: custom control wins by score without reload,
      disposal restores default, tie-break by registration order, load-reject/render-throw
      containment per property, focus-safe swap (R8 lock) — Inspector.test.tsx +
      resolve-field.test.ts additions (depends T006)

## Phase 6: User Story 4 — Preview mode (P4)

- [x] T012 [US4] shell components/PreviewMode/ — FULL contract (contract §5 p1–p3: publish-safe
      path, floating exit, dir override view-state, Escape) + US4 acceptance: chrome absence + live
      content, zero-tx round trip with reference identity during the flip, selection restored on
      exit, pending-drag cancel on entry

## Phase 7: Integration, polish & delivery gates

- [x] T013 Preset surface (contract §8): Inspector/DeviceBar/PreviewMode/bucketForWidth/
      BUCKET_THRESHOLDS re-exports + surface.test.ts entries
- [x] T014 Playground composition: device bar in the edit header, inspector panel beside the layers
      tree, preview toggle; App.test.tsx scenario additions (device→override edit→ preview round
      trip; Law-S audit with the full surface) (depends T010, T012, T013)
- [x] T015 [P] Docs coherence: shell README B3a section; EditorCanvas.docs.mdx frameWidth note
- [x] T016 Evidence run per quickstart: narrow → gates + boundary negatives → storybook with
      catalog-presence (Inspector, DeviceBar, PreviewMode) → full `pnpm verify`; record here —
      RECORD (2026-08-25): `pnpm verify` EXIT=0. Builder-family unit tests 446 (schema 80, core 89,
      react 10, renderer 33, shell 162, blocks 18, preset 40, playground 14); Storybook Chromium 77
      tests at a11y error level; catalog-presence PROVEN (Inspector, DeviceBar, PreviewMode all
      indexed); gates: 17 members / 26 components / 519 boundary files; boundary negatives
      EXECUTED+REVERTED (shell→blocks-marketing ⇒ BUILDER_LAYER_VIOLATION exit 1; playground→shell ⇒
      BUILDER_FAMILY_ACCESS exit 1; baseline re-verified green). Implementation-phase finding:
      latent B0 dispatch ordering defect (notify-before-log) found via the playground tx counter,
      fixed in core with a kernel-laws regression (003 contract §15, 007 contract §9.1).
- [x] T017 Final diff review per .specify/agents/rules/code-review.md (independent read-only
      reviewers); fix accepted findings with regression tests; re-run affected checks — RECORD
      (2026-08-25): two independent reviewers (kernel-laws lens: 2 HIGH, 5 MEDIUM, 7 LOW + confirmed
      the dispatch reorder is a net improvement; React/a11y lens: 1 CRITICAL, 4 HIGH, 10 MEDIUM, 8
      LOW). Both found the preview-Escape gap independently. All accepted findings fixed with
      regression tests (contract §10); four deferred with recorded rationale. Headliners: C1
      canvas-renders-active-breakpoint (EditorCanvas `breakpoint`), H1 modal-surface Escape, H2
      structural labeling + draft discipline, M1/M5 per-def WeakMap load cache + inert loading
      interim, M2 DeviceBar draft commits.
- [x] T018 /speckit-converge (multi-agent audit + adversarial verification); implement appended gaps
      to completion
- [x] T019 /speckit-workspace-handoff (HANDOFF/context refresh; durable invariants → MEMORY)
- [x] T020 /speckit-workspace-commit proposal ONLY (produced 2026-08-26; NO commit made) — commit
      authorization remains withheld

## Dependencies

```text
Phase1 (T001) → Phase2 (T002–T005 all parallel) →
US1: T006 → T007 → US2: (T008 ∥ T009) → T010 → US3: T011 → US4: T012 →
Phase7: T013 → T014; T015 [P]; T016 → T017 → T018 → T019 → T020.
Story independence: each phase ends in its own acceptance additions; stopping at any
checkpoint leaves `pnpm verify` green.
```

## Implementation strategy

MVP = Phases 1–3 (the generated panel). Devices make responsive intent editable, field types open
the authoring surface, preview closes the visitor loop. The mechanical gates — not discipline — hold
the contract.

## Phase 8: Convergence

- [x] T021 Add the missing pending-drag × preview-entry proof per US4 edge case (spec.md "Preview
      entered while a drag session is somehow pending") + tasks T012 record (missing):
      EditorCanvas.test.tsx — unmount mid-PENDING and mid-ACTIVE drag ⇒ zero transactions, zero
      chrome traces, no throw (the T012 acceptance item was structurally true but unbacked)
- [x] T022 Announce preview EXIT per FR-010 (partial): the composing surface owns the exit
      announcement (PreviewMode's own region unmounts with it) — playground App gains a mode polite
      region announcing the return to editing, scenario 7 asserts it, PreviewMode.docs.mdx and
      contract record the composer responsibility
- [x] T023 Add the merge-blocking Chromium browser-truth proof "inspector edit changes canvas text"
      per contract §7 row 12 (partial): an Inspector+EditorCanvas story over one kernel with a
      play() asserting the frame text changes; fix quickstart law-proof row 12's stale attribution
      (frame-narrowing proof lives in EditorCanvas DeviceWidth)
- [x] T024 Fix PreviewMode focus-on-mount per contract §10.H1 (contradicts): the region focus must
      run ONCE on mount, not on every onExit identity change (split the effect); regression test
      that a rerender with a fresh onExit does not steal focus
- [x] T025 Record the public `DeviceState` type per contract §3/§8 (unrequested): name it in the
      contract surface list + convergence record §11
