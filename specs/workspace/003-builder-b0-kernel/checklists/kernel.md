# Requirements Quality Checklist: Builder B0 Kernel Foundation

**Purpose**: Reviewer-owned "unit tests for the requirements" — validate that the B0 kernel
spec/plan/contracts are complete, clear, consistent, and measurable BEFORE task generation. `[x]`
means the reviewer judged the requirements-quality criterion satisfied; it does NOT mean any
implementation exists. **Created**: 2026-08-25 **Feature**: [spec.md](../spec.md) ·
[plan.md](../plan.md) · [contracts/builder-kernel.md](../contracts/builder-kernel.md)

## Requirement Completeness

- [x] CHK001 - Are requirements defined for every mutation avenue reaching the single door (human,
      AI, code-view authors)? [Completeness, Spec §FR-001/FR-003]
- [x] CHK002 - Are undo AND redo requirements both specified, including empty-stack behavior?
      [Completeness, Spec §FR-004, Edge Cases]
- [x] CHK003 - Are both validation passes (structural vs catalog-aware) individually itemized with
      their rule lists? [Completeness, Spec §FR-006, Contracts §2]
- [x] CHK004 - Are extension lifecycle requirements complete across register, dependency order,
      cycle rejection, setup, and dispose? [Completeness, Spec §FR-009]
- [x] CHK005 - Are persistence requirements complete across load (snapshot+tail), append (expected
      position), and conflict rejection? [Completeness, Spec §FR-014, Contracts §4]
- [x] CHK006 - Are migration requirements defined for both success (stepwise to current) and failure
      (loud, never partial)? [Completeness, Spec §FR-016]
- [x] CHK007 - Is the widget four-state gate requirement present with the rejection message content
      specified? [Completeness, Spec §FR-012]

## Requirement Clarity

- [x] CHK008 - Is "plain serializable data" enumerated concretely (allowed kinds + finite-number
      rule) rather than left abstract? [Clarity, Spec §FR-007, Contracts §1]
- [x] CHK009 - Is "constant-time lookup" operationalized as a measurable flat-cost check (10→1,000
      entries) instead of an adjective? [Clarity/Measurability, Spec §SC-005]
- [x] CHK010 - Is "scoped notification" quantified (exactly one element subscriber notified per
      single-property change)? [Clarity, Spec §FR-019, §SC-006]
- [x] CHK011 - Is the reserved default slot name and the non-empty slot-name rule explicitly fixed?
      [Clarity, Contracts §1, Research R14]
- [x] CHK012 - Are the author kinds a closed enumerated set rather than open prose? [Clarity, Spec
      §FR-003, Contracts §1]

## Requirement Consistency

- [x] CHK013 - Do the spec's edge cases and the contracts' error-code taxonomy cover each other
      one-to-one (no edge case without a code, no dead code)? [Consistency, Spec Edge Cases,
      Contracts §3]
- [x] CHK014 - Is the slots model consistent everywhere (spec FR-005, contracts Node, data-model
      rules) with no residual children-array language? [Consistency]
- [x] CHK015 - Are undo/redo consistently specified as history operations that do NOT create new
      change records (spec vs contracts §5)? [Consistency]
- [x] CHK016 - Do plan.md enforcement mechanisms map 1:1 to the laws they claim to enforce (no law
      without a mechanism, no orphan mechanism)? [Consistency, Plan §Enforcement Design]
- [x] CHK017 - Is tier-2 rejection consistently scoped to tier-2 manifests only (trusted manifests
      legitimately carry behavior)? [Consistency, Spec §FR-011, Contracts §7]

## Acceptance Criteria Quality (Measurability)

- [x] CHK018 - Is every success criterion expressed as a count, percentage, or bounded time — never
      a technology or an adjective? [Measurability, Spec §SC-001–SC-007]
- [x] CHK019 - Is the determinism criterion verifiable field-for-field (identical histories), not
      merely "behaves the same"? [Measurability, Spec §SC-003]
- [x] CHK020 - Is the property-testing volume quantified (≥1,000 randomized sessions) so
      "property-tested" is not open-ended? [Measurability, Spec §SC-001]
- [x] CHK021 - Is the single timing budget (validation < 150 ms @1,000 nodes) the only wall-clock
      assertion, with all other performance criteria count-based? [Measurability, Research R13]

## Negative / Edge-Case Coverage

- [x] CHK022 - Does every rejection requirement specify observable failure content (offending
      field/path named) and the no-partial-change guarantee? [Coverage, Spec §FR-002/FR-011,
      §SC-004]
- [x] CHK023 - Are all four data-purity attack values (function, missing value, big integer,
      non-finite number) individually required to be rejected? [Coverage, Spec Edge Cases,
      Quickstart proofs]
- [x] CHK024 - Are structural attacks each covered: move-into-descendant, duplicate membership,
      duplicate-in-slot, undeclared slot, capacity overflow, stored empty slot list? [Coverage, Spec
      Edge Cases]
- [x] CHK025 - Is concurrent-append conflict behavior specified with stored-history integrity
      guaranteed? [Coverage, Spec §US4-3, Contracts §4]
- [x] CHK026 - Is executable-content rejection required for every function-bearing field position in
      a stored manifest (not just `setup`)? [Coverage, Spec §FR-011, Contracts §7]

## Dependencies & Assumptions

- [x] CHK027 - Are all five new dependencies pinned with registry-verified evidence (age vs
      release-age policy, no-downgrade analysis)? [Dependency, Research R1]
- [x] CHK028 - Is the assumption set explicit about what B0 excludes (rendering, AI, network,
      binding resolution) so scope cannot silently grow? [Assumption, Spec Assumptions]
- [x] CHK029 - Is the `./testing` public-surface exception documented with owner, rationale, and
      removal condition? [Assumption, Plan §Complexity Tracking, Research R15]
- [x] CHK030 - Are the workspace-tools contract-text updates (discovery messages, README, fixtures)
      explicitly in scope so no stale "apps/* and packages/*" claim survives? [Dependency, Research
      R3]

## Traceability

- [x] CHK031 - Does every FR trace to at least one acceptance scenario or quickstart proof, and
      every SC to at least one FR? [Traceability]
- [x] CHK032 - Do contracts, data-model, and quickstart cross-reference each other without
      duplicating normative content (single source per fact)? [Traceability]

## Notes

- Evaluated by the reviewer before `/speckit-tasks`; `/speckit-implement` reads state but never
  toggles markers.
- Evaluation 2026-08-25: 32/32 pass. One finding during evaluation — CHK016 initially failed because
  plan.md's Enforcement Design table lacked rows for Law R (responsive value-only) and Law L (live
  meta); both rows were added to plan.md before checking the item. All other items passed against
  the artifacts as written.
