# Requirements Quality Checklist: Drag Editing

**Purpose**: Requirements-quality review ("unit tests for English") for the B2b spec before task
generation. `[x]` = reviewer judged the requirements-quality criterion satisfied (NOT implementation
progress). **Created**: 2026-08-25 **Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 — Is the full session lifecycle specified, including the press-without-threshold (plain
      click) and the mid-drag node-removal self-cancel? [Completeness, Spec §FR-001, Edge Cases]
- [x] CHK002 — Are BOTH mutation gestures (drop, keyboard move) bound to the one-transaction law,
      with the no-effect same-position case called out? [Completeness, Spec §FR-005/§FR-009]
- [x] CHK003 — Are all rule-gate dimensions enumerated (allow, max with own-slot exemption,
      self/descendant exclusion)? [Completeness, Spec §FR-004]
- [x] CHK004 — Are both palette insert paths (drag, keyboard) specified with a deterministic
      placement rule and a defined no-acceptor outcome? [Completeness, Spec §FR-007, US2/AC3]
- [x] CHK005 — Is layers-tree scope bounded (navigate/select/expand only; reorder stays on the
      canvas) so panel scope cannot silently grow? [Completeness, Clarifications, Spec §FR-008]
- [x] CHK006 — Are announcement requirements defined for every gesture outcome (moved, inserted,
      cancelled, rejected + reason)? [Completeness, Spec §FR-010]

## Requirement Clarity

- [x] CHK007 — Is "chrome-only until drop" operationalized (no mutations, no transactions, zero
      content re-renders, counted)? [Clarity, Spec §FR-002, §SC-001]
- [x] CHK008 — Is "zero-trace cancel" defined mechanically (byte-identical document, history, log;
      chrome gone)? [Clarity, Spec §FR-006, §SC-002]
- [x] CHK009 — Is before/after gap resolution defined by an observable rule (vertical half of the
      hovered node's rect, visual order)? [Clarity, US1/AC2, Spec §FR-003]
- [x] CHK010 — Is the keyboard-insert placement rule stated deterministically (after-selection →
      walk-up → announce failure)? [Clarity, US2/AC3]
- [x] CHK011 — Is the in-repo-engine deviation recorded with its reasoning rather than silently
      diverging from the reference docs? [Clarity, Clarifications]

## Requirement Consistency

- [x] CHK012 — Do FR-002 (chrome-only) and FR-005 (one transaction at drop) compose without
      contradiction across the session timeline? [Consistency]
- [x] CHK013 — Does FR-004's resolution-time gating align with SC-003's resolver≡door agreement
      rather than duplicating validation authority? [Consistency]
- [x] CHK014 — Do keyboard moves (FR-009) reference the SAME rule gate as drops, keeping gesture
      parity a construction property? [Consistency, Clarifications]
- [x] CHK015 — Does FR-012 (read-only surfaces unchanged) stay consistent with extending
      EditorCanvas rather than forking it? [Consistency, Assumptions]
- [x] CHK016 — Is the counting-only merge-gate policy applied consistently (60 fps explicitly routed
      to evidence, not CI)? [Consistency, Clarifications, §SC-001/002]

## Acceptance Criteria Quality / Measurability

- [x] CHK017 — Is every SC mechanically verifiable (counts, reference identity, structural equality,
      N+M transaction arithmetic)? [Measurability, §SC-001–SC-007]
- [x] CHK018 — Is the hand-built-landing exit criterion (SC-004) specified as an exact
      structure-equality + transaction-count check rather than a subjective "works"? [Measurability]

## Scenario & Edge Coverage

- [x] CHK019 — Are self-drop/descendant-drop, full-slot, and leaving-viewport cases covered?
      [Coverage, Edge Cases, US1/AC3–4]
- [x] CHK020 — Is the direction-flip-mid-drag interaction defined? [Coverage, Edge Cases, §FR-011]
- [x] CHK021 — Is stress-document boundedness stated as an algorithmic bound (hit-test + parent
      chain, no tree scans)? [Coverage, §FR-015, Edge Cases]

## Dependencies & Assumptions

- [x] CHK022 — Is B0-command sufficiency (no new commands) an explicit assumption so kernel scope
      cannot creep? [Assumption]
- [x] CHK023 — Is ghost fidelity (outline clone, not live block render) recorded as a deliberate
      deferral? [Assumption]

## Notes

- Review run 2026-08-25: 23/23 pass. `/speckit-implement` reads checklist state but does not modify
  markers.
