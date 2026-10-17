# Requirements Quality Checklist: Rich Text

**Purpose**: Requirements-quality review ("unit tests for English") for the B3b spec before task
generation. `[x]` = reviewer judged the criterion satisfied (NOT implementation). **Created**:
2026-08-26 **Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 — Is the ENTIRE whitelist enumerated (block nodes, inline nodes, marks, heading levels)
      rather than implied? [Completeness, §FR-001, Key Entities]
- [x] CHK002 — Are BOTH halves of the unknown-type rule specified (reject on write, degrade on
      read)? [Completeness, Clarifications, §FR-001/FR-004]
- [x] CHK003 — Is the full dependency-decision deliverable enumerated (pins, publish-age policy,
      transitive inventory, no-downgrade proof, trust policy)? [Completeness, §FR-011, US3/AC3]
- [x] CHK004 — Are all three containment mechanisms named (one-package boundary, lazy load,
      published-path exclusion)? [Completeness, §FR-005, US3]
- [x] CHK005 — Is the empty-content round trip specified (canonical empty doc, invisible render)?
      [Completeness, Edge Cases]

## Requirement Clarity

- [x] CHK006 — Is "one transaction per commit" bound to the SAME counting law as B3a (spec
      references the existing inspector discipline)? [Clarity, §FR-003, §SC-001]
- [x] CHK007 — Is "safe link" quantified (protocol allowlist behavior + neutralized rendering)?
      [Clarity, US2/AC2, §SC-004]
- [x] CHK008 — Is "parity" measurable (same visible text + same semantic structure on both paths)?
      [Clarity/Measurability, §FR-009, §SC-005]
- [x] CHK009 — Is the responsive-bucket limitation EXPLICIT (base only, visible notice, deferral
      recorded)? [Clarity, Edge Cases, research R7]

## Requirement Consistency

- [x] CHK010 — Do FR-002's resolution laws defer to B3a's (no new resolution semantics)?
      [Consistency, §FR-002, Assumptions]
- [x] CHK011 — Does FR-004's read-tolerance coexist with FR-001's write-strictness without
      contradiction (two different doors)? [Consistency]
- [x] CHK012 — Is the a11y story consistent with B3a's structural labeling (group + controlId
      contract)? [Consistency, §FR-007]

## Acceptance Criteria Quality / Measurability

- [x] CHK013 — Is every SC counting-based or table-driven (no wall-clock anywhere)? [Measurability,
      §SC-001..007, MEMORY law]
- [x] CHK014 — Is SC-003's lazy law phrased as loader-invocation COUNTS (0 then 1-cached)?
      [Measurability]

## Scenario & Edge Coverage

- [x] CHK015 — Focus-lock interplay with runtime registration covered? [Coverage, Edge Cases]
- [x] CHK016 — Two rich props on one block covered? [Coverage, Edge Cases]
- [x] CHK017 — Disposal-restores-fallback covered as an acceptance scenario? [Coverage, US1/AC5]

## Dependencies & Assumptions

- [x] CHK018 — Is B3a-machinery sufficiency an explicit assumption (no row/resolution changes)?
      [Assumption]
- [x] CHK019 — Are the deferred items (responsive rich text, size budgets, tables/images,
      inline-on-canvas) each RECORDED rather than silently absent? [Assumption, Edge Cases,
      Clarifications]

## Notes

- Review run 2026-08-26: 19/19 pass.
