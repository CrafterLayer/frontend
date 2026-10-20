# Professional reports, charts and Key Stats

User authorization (2026-10-20): broaden report formats, charts and Key Stats and let the agent
generate them professionally. The user selected all three example domains: business/sales/finance,
projects/team performance, and marketing/web analytics. This is implementation plus primary-source
research, not a framework migration or a promise of every imaginable visualization.

## Scope and acceptance

Owners: `@craftkit/builder-blocks-marketing` Chart, Stats, Report and a reusable metric-trend view;
`@craftkit/builder-ai` data tools and data-viz skills; `@craftkit/evals` browser proof; Playground
and the builder facade are consumers. Preserve all existing staged/unstaged changes, especially the
prior report-integrity fixes and concurrent AI-server work. No dependency installation, deployment,
commit, external write or paid provider call is part of this increment.

- RP1: Retain the 12 existing chart types and add waterfall, heatmap, treemap, histogram, bubble,
  boxplot, candlestick, lollipop and bullet. Types are explicit and discoverable. Valid supported
  requests render the requested family; incompatible data receives an actionable error before
  document mutation rather than an invented graph or silent substitution.
- RP2: Define and verify deterministic contracts: waterfall signed increments; heatmap matrix; flat
  treemap nonnegative weights; histogram equal-width bins computed from observations; bubble numeric
  x/y and nonnegative size; boxplot ordered min/Q1/median/Q3/max; candlestick OHLC bounds; lollipop
  signed values; bullet actual/target, nonnegative finite scale. No raw executable chart code,
  arbitrary network access, implicit unit conversion or blank-as-zero inference.
- RP3: Key Stats support comparison badges, bounded sparklines and target progress. Compact Report
  KPIs add median/count, explicit targets and comparison baselines; cards share the same source as
  charts and tables. Trend/target semantics must be visible and accessible without color alone.
- RP4: The agent can select every supported chart via data.show and report.build, configure detailed
  report pages with explicit chart selections and executive/analytical/financial/operational/
  comparison presentations, and update an existing compact Report by ID without duplication. Skills
  teach the exact contracts and truthful source/period/unit conventions. Existing automatic choices
  remain valid; specialized types are opt-in when their semantics need explicit intent.
- RP5: Examples cover all three requested domains. Old saved documents remain renderable; schemas
  add defaults/optional fields. In-place editing, Undo, static rendering, theme roles, mobile widths
  and RTL remain intact. No new runtime plotting dependency.
- RP6: Every new React component has its own file, local export, typed story, MDX documentation and
  behavior test. Existing Chart/Report/Stats stories/docs/tests cover the new contracts.
- RP7: Verify pure calculations, invalid data, actual kernel application/Undo and browser-visible
  output; check owner/consumer types, lint, Storybook and app builds, initial-load budgets and
  workspace gates. Fresh independent local review and scoped convergence precede handoff. Keep
  local/scripted evidence separate from live-model quality, costs and deployed behavior.

## Plan and contract

1. Research official chart/report implementations and audit current schema/tool mismatches.
2. Extend the existing SVG renderer with pure, bounded geometry and one complete advanced chart
   component contract; existing script-free/static output remains the rendering boundary.
3. Extend existing Stats/Report cards and add one reusable complete metric-trend component.
4. Integrate deterministic preparation, chart-specific validation and request routing in builder-ai.
5. Extend detailed report presentation/explicit chart options and compact report in-place updates.
6. Run owner tests and consumer/browser checks, repair independent review findings and document.

Chart representation stays `categories` plus `series` (at most 24 categories and six series):
histogram renders precomputed bin labels/counts; bubble series are Y then Size and numeric
categories are unitless X; Size is unitless and Y may carry one consistent unit. Bubble input has
exactly three columns; boxplot series order is Min, Q1, Median, Q3, Max; candlestick Open, High,
Low, Close; bullet Actual then Target. The data tools own preparation/validation, while the renderer
rejects invalid specialized shapes visibly without NaN/Infinity or misleading fallback. Histogram
raw input is one numeric column or a label plus one numeric column. Treemap is flat, not a
hierarchy/graph API.

Stats items gain optional `change`, `sentiment` (positive/negative/neutral), `trend` (at most 24
finite numbers), `progress` (0..100) and `progressLabel`. Report KPI configuration gains optional
`comparisonValue`, `target` and `detail` (up to 120 characters); `showTrends` controls per-card
source trends, with `median` and `count` measures and up to eight cards. Report chart options share
Chart's full enum. Defaults preserve current saved output. Optional `comparisonLabel` captions
explicit baselines, and `dataNote` keeps computed chart provenance separate from authored summary
text. Refreshes preserve compatible KPI configurations by column name and require explicit
replacements for changed source/goal units. Exact presentation refinements remain within these
outcomes.

Dependency direction is unchanged: AI never imports marketing internals. Matching public tool/schema
contracts are covered with real-kernel integration tests. No generated clients or governance files
are modified. Existing local-review preference continues; no external CLI or professional-sdd
workflow-engine pass is claimed. The primary owns integration and final evidence.

## Requirements checklist and verification

Scope, compatibility, deterministic semantics, accessibility, failure behavior, component artifacts,
review, build and browser evidence are explicit above. Tasks T303–T309 implement RP1–RP7. Evidence:
[primary-source research](research-report-capabilities-2026-10-20.md) and
[local verification](verification-report-capabilities-2026-10-20.md).
