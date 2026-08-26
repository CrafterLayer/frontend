# Requirements Quality Checklist: Read-Only Canvas

**Purpose**: Requirements-quality review ("unit tests for English") for the B2a spec before task
generation. `[x]` = reviewer judged the requirements-quality criterion satisfied (NOT implementation
progress). **Created**: 2026-08-25 **Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 — Are geometry-currency requirements complete for every layout-change class the
      milestone names (element growth, scroll, viewport resize, direction flip)? [Completeness, Spec
      §FR-002, §US2]
- [x] CHK002 — Are requirements defined for chrome behavior when the target node disappears
      (undo/remove) rather than only when it moves? [Completeness, Spec §FR-007, US2/AC3]
- [x] CHK003 — Is the read-only boundary exhaustively enumerated (drag, drop, resize, inline edit,
      palette, layers all named as exclusions)? [Completeness, Spec §FR-008]
- [x] CHK004 — Are tool lifecycle requirements complete across ALL dismissal causes (target change,
      activation end, disposal, unmount)? [Completeness, Spec §FR-012, US4/AC2–3]
- [x] CHK005 — Are failure-path requirements defined for tools (load rejection, mount throw) with a
      containment guarantee? [Completeness, Spec §FR-014, Edge Cases]
- [x] CHK006 — Are keyboard requirements complete for entry (no selection), traversal, nesting
      (in/out), and exit (Escape)? [Completeness, Spec §FR-009, US3]

## Requirement Clarity

- [x] CHK007 — Is "zero content re-draws" operationalized as a mechanical count rather than a
      qualitative claim? [Clarity, Spec §FR-006, §SC-001]
- [x] CHK008 — Is "kept current purely by observation" defined by the exclusion of BOTH
      per-interaction measurement AND polling? [Clarity, Spec §FR-002]
- [x] CHK009 — Is "display name" given a concrete source (schema description, fallback type)?
      [Clarity, Spec Assumptions]
- [x] CHK010 — Is the innermost-wins rule for nested hover stated? [Clarity, Edge Cases]
- [x] CHK011 — Is "selection through the kernel" phrased so programmatic selection MUST render
      identically (single source of truth)? [Clarity, Spec §FR-004]

## Requirement Consistency

- [x] CHK012 — Do the read-only guarantee (FR-008) and click-to-select (FR-004) stay consistent via
      the workbench-state/document-content distinction? [Consistency, Clarifications]
- [x] CHK013 — Do the zero-re-render requirement (FR-006) and selection-through-kernel (FR-004)
      avoid contradiction (selection changes are exempt from content re-draws by prior milestone
      proof)? [Consistency, Spec §FR-017; 004 SC-002]
- [x] CHK014 — Are stress-document requirements consistent between FR-015 and SC-001/SC-002 (same
      document size, same guarantees)? [Consistency]
- [x] CHK015 — Does the keyboard mirroring requirement align with the direction-correctness
      requirement rather than duplicating it? [Consistency, Spec §FR-009/§FR-011]

## Acceptance Criteria Quality / Measurability

- [x] CHK016 — Can every SC be verified mechanically (counts, percentages, presence) without
      wall-clock assertions? [Measurability, Spec §SC-001–SC-007, Clarifications]
- [x] CHK017 — Is observation-attribution testable as stated (instrumentation attributing 100% of
      updates to observation events)? [Measurability, Spec §SC-002]
- [x] CHK018 — Is cleanup verification quantified (every mount's cleanup verified to have run)?
      [Measurability, Spec §SC-005]

## Scenario & Edge Coverage

- [x] CHK019 — Are first-frame (no geometry yet) and rapid double-selection races addressed?
      [Coverage, Edge Cases]
- [x] CHK020 — Is the between-blocks pointer position (no target) covered so stale hover cannot
      persist? [Coverage, Edge Cases]
- [x] CHK021 — Is a recovery scenario defined after a tool failure (canvas keeps working, failure
      surfaced)? [Coverage, Edge Cases, Spec §FR-014]

## Dependencies & Assumptions

- [x] CHK022 — Are the reused foundations named as dependencies (kernel selection state, B1 preview
      boundary, existing contribution point) rather than assumed silently? [Assumption, Spec
      Assumptions/Clarifications]
- [x] CHK023 — Is the deferred-shell boundary (top bar, panels, styling system) recorded so scope
      cannot silently grow? [Assumption, Spec Assumptions]

## Notes

- Review run 2026-08-25: 23/23 pass. `/speckit-implement` reads checklist state but does not modify
  markers.
