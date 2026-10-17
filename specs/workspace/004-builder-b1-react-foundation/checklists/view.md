# Requirements Quality Checklist: Builder B1 View Foundation

**Purpose**: Reviewer-owned requirements-quality gate before task generation. `[x]` = the
requirements criterion is satisfied; NOT implementation progress. **Created**: 2026-08-25
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) ·
[contracts/builder-view.md](../contracts/builder-view.md)

## Completeness

- [x] CHK001 - Are mount, live-update, undo-through-view, and boundary-enforcement requirements all
      present for the embedding story? [Spec §US1, FR-001–FR-004]
- [x] CHK002 - Are all five blocks enumerated with their property vocabularies and slot rules? [Spec
      §FR-011, Contracts §5]
- [x] CHK003 - Are static purity AND breakpoint resolution both specified with acceptance scenarios?
      [Spec §US3, FR-006/FR-007]
- [x] CHK004 - Are theme, direction, runtime-registration, and isolation requirements each
      independently testable in the playground story? [Spec §US4, FR-008/009/013/014/018]
- [x] CHK005 - Is the fallback behavior for unregistered types specified for BOTH render modes and
      for disposal? [Spec §FR-010/FR-013, Edge Cases]

## Clarity & Measurability

- [x] CHK006 - Is "scoped re-rendering" quantified (exactly 1 on stress fixture; 0 for unrelated
      state)? [Spec §FR-003, SC-002]
- [x] CHK007 - Is live/static parity a measurable comparison rather than an adjective? [SC-003]
- [x] CHK008 - Are theme-switch latency and reload-freedom bounded? [SC-004]
- [x] CHK009 - Is the component contract mechanically verifiable (validator facts confirmed
      permissive for extra block files)? [Clarifications, Research R4]

## Consistency

- [x] CHK010 - Does the sibling-layer constraint (renderer ↛ react) appear consistently in plan
      constraints, research R2, and the contracts' DocumentViewProps? [Consistency]
- [x] CHK011 - Do spec Clarifications, plan Complexity Tracking, and research R3 tell the same
      canvas-frame deviation story? [Consistency]
- [x] CHK012 - Is the fixture-vocabulary clash (test fixtures vs marketing blocks) resolved the same
      way in contracts §6 and data-model Fixtures? [Consistency]
- [x] CHK013 - Does the runtime-demo type's insertability have a consistent mechanism (pre-allowed
      by page vocabulary) across contracts §4/§6? [Consistency]

## Coverage (negative/edge)

- [x] CHK014 - Are unknown-breakpoint, empty-slot, missing-optional-prop, and RTL cases in the edge
      list with owning FRs? [Coverage]
- [x] CHK015 - Are the two boundary negatives (app→deep import; renderer→react) named as explicit
      proofs? [Quickstart proofs]
- [x] CHK016 - Is accessibility a gated requirement (a11y error level in the existing pipeline)
      rather than an aspiration? [FR-016, SC-006]

## Dependencies & Assumptions

- [x] CHK017 - Is the zero-new-dependency claim verified against the catalog rather than assumed?
      [Research R1]
- [x] CHK018 - Are canvas editing / rich text / token-vocabulary growth explicitly out of scope with
      owning milestones? [Assumptions]
- [x] CHK019 - Does the extensions glob land with its first member (same-change rule from 003)?
      [Plan structure]

## Traceability

- [x] CHK020 - Does every FR map to a story scenario, edge case, or quickstart proof, and every SC
      to at least one FR? [Traceability]

## Notes

- Evaluation 2026-08-25: 20/20 pass. CHK012/CHK013 initially surfaced real gaps during drafting
  (fixture clash; demo-type insertability) — both were resolved in the artifacts before checking
  (contracts §4/§6 + data-model updated), which is the checklist doing its job pre-tasks.
