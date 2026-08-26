# Requirements Quality Checklist: Inspector, Devices & Preview

**Purpose**: Requirements-quality review ("unit tests for English") for the B3a spec before task
generation. `[x]` = reviewer judged the requirements-quality criterion satisfied (NOT implementation
progress). **Created**: 2026-08-25 **Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 — Are all four default control kinds AND the two fallbacks (readonly, no-editable
      notice) specified? [Completeness, Spec §FR-004, Edge Cases]
- [x] CHK002 — Is the full contribution lifecycle covered (priority match, tie-break, runtime
      registration/disposal, load/render failure containment)? [Completeness, §FR-005, US3]
- [x] CHK003 — Are BOTH override operations (write, clear) bound to exact transaction shapes?
      [Completeness, §FR-007, US2/AC2–3]
- [x] CHK004 — Is the preview round trip fully enumerated (enter, interact, flip, Escape, selection
      restoration, zero transactions)? [Completeness, §FR-009, US4]
- [x] CHK005 — Are rejection semantics complete (zero change + control-adjacent reason)?
      [Completeness, §FR-002, US1/AC3]

## Requirement Clarity

- [x] CHK006 — Are bucket thresholds DECLARED (768/1024, half-open) rather than implied, with
      boundary widths in the edge cases? [Clarity, Clarifications, §FR-006, Edge Cases]
- [x] CHK007 — Is "zero panel code per block" operationalized (the blocks package's mechanical
      contract unchanged)? [Clarity/Measurability, §SC-001]
- [x] CHK008 — Is "document truth" defined behaviorally (undo/external edits refresh; no
      authoritative copy)? [Clarity, §FR-003, US1/AC5]
- [x] CHK009 — Is the view-state nature of device AND preview state explicit (never document, never
      kernel)? [Clarity, Clarifications, Key Entities]
- [x] CHK010 — Is the B3a/B3b split (TipTap deferral) recorded with its reason? [Clarity,
      Clarifications, §FR-014]

## Requirement Consistency

- [x] CHK011 — Do FR-007 (bucket writes) and FR-008 (Law R) compose without contradiction (values
      only)? [Consistency]
- [x] CHK012 — Does the preview direction flip stay consistent with the playground's existing
      document-mutating flip (two distinct, named paths)? [Consistency, Clarifications]
- [x] CHK013 — Does field resolution keep ONE authority order (contributions → defaults → readonly)
      across FR-004/FR-005? [Consistency]
- [x] CHK014 — Is the transactions≡commits arithmetic phrased identically across US1/US2 and SC-002
      (the twice-validated counting policy)? [Consistency]

## Acceptance Criteria Quality / Measurability

- [x] CHK015 — Is every SC mechanically verifiable (counts, reference identity, table-driven bucket
      mapping, catalog-gate presence)? [Measurability, §SC-001–SC-007]
- [x] CHK016 — Is SC-005's "document untouched" measurable as REFERENCE identity plus log length?
      [Measurability]

## Scenario & Edge Coverage

- [x] CHK017 — Are the focus-safety (runtime swap mid-typing) and override-equals-base cases
      covered? [Coverage, Edge Cases]
- [x] CHK018 — Is the pruned-selection path (undo removes the inspected node) covered? [Coverage,
      Edge Cases, §FR-003]
- [x] CHK019 — Is drag-session interaction with preview entry defined? [Coverage, Edge Cases]

## Dependencies & Assumptions

- [x] CHK020 — Is B0 field-contract sufficiency an explicit assumption (no schema churn)?
      [Assumption]
- [x] CHK021 — Is the additive registry read named as following the canvasTools precedent?
      [Assumption]
- [x] CHK022 — Is the canvas width input declared additive with no new hot paths? [Assumption]

## Notes

- Review run 2026-08-25: 22/22 pass. `/speckit-implement` reads checklist state but does not modify
  markers.
