# Professional report and chart capabilities: research

Generated: 2026-10-20, Asia/Hebron. Sources: 20 selected official pages. Confidence: high for
documented capabilities and current repository observations; medium for product prioritization. This
is implementation research, not evidence that the proposed additions have shipped.

## Executive summary

Broaden CraftKit through explicit chart families, correct input contracts, and stronger Key Stats.
The current renderer already exposes twelve chart types, while its report tool exposes only ten; the
Stats block currently holds formatted text without trend or target semantics. These are local source
observations, detailed below. A useful first expansion is waterfall, heatmap, treemap, bullet, and
histogram, with box plots as a follow-on if their distinct statistics contract is implemented. This
prioritization is an engineering recommendation, not an external ranking.

Keep chart choice separate from data interpretation: ECharts documents explicit dimension mappings;
Vega-Lite distinguishes binning, distributions, and invalid values. KPIs should reuse the same
calculations as charts and tables, following the shared-metric pattern documented by Evidence. These
patterns can be implemented within the existing package boundaries without installing a new chart
runtime. [ECharts dataset](https://echarts.apache.org/handbook/en/concepts/dataset/),
[Vega-Lite binning](https://vega.github.io/vega-lite/docs/bin.html),
[Evidence metrics](https://docs.evidence.dev/core-concepts/metrics).

## 1. Current repository fit

Observed by reading working-tree source on the research date; concurrent implementation may change
these starting conditions:

| Surface                                                                              | Observed starting behavior                                                                                                                                                                                     | Consequence for this increment                                                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/builder/extensions/blocks-marketing/src/components/Chart/schema.ts`        | Twelve types: bar, hbar, line, area, combo, scatter, radar, funnel, gauge, sparkline, pie, donut. Up to 24 categories and six series. SVG and a screen-reader table are part of the documented block contract. | Preserve bounded data, editable parts, and export-compatible rendering while extending families.              |
| `packages/builder/ai/src/data-tools/data-chart.ts`                                   | A parallel type list and chart-specific rules drive `data.show` and `report.build`. Missing numeric cells are converted to zero with a note.                                                                   | Every new renderer type must reach agent tools; do not widen the missing-as-zero behavior.                    |
| `packages/builder/ai/src/data-tools/report-build.ts`                                 | Ten-type allowlist, excluding gauge and sparkline; at most four KPIs with last/total/average/min/max.                                                                                                          | Align supported report chart families with their actual renderer contracts.                                   |
| `packages/builder/extensions/blocks-marketing/src/components/Report/report-model.ts` | KPI changes compare the last two values; only `last` gets a delta. One source supplies chart and table.                                                                                                        | Keep the shared source and add explicit target/comparison semantics without guessing date meaning.            |
| `packages/builder/extensions/blocks-marketing/src/components/Stats/schema.ts`        | Items contain value, label, and optional detail; three visual variants.                                                                                                                                        | Add optional trend, comparison context, target progress, and sparkline while preserving existing saved props. |
| `packages/builder/ai/src/data-tools/report-page-charts.ts`                           | Automatic trend/ranking, share, pivot, and comparison sections; incomplete series are omitted.                                                                                                                 | Honor an explicit compatible chart request and preserve the prior integrity protections.                      |

This research does not establish production performance, provider success rates, or browser
accessibility conformance. Those require implementation and verification by the coordinator.

## 2. Recommended chart families and contracts

ECharts separates source data from its mapping to coordinates and visual channels. Its documentation
also acknowledges that trees and graphs need specialized structures. Thus a name alone is not a
sufficient chart contract.
[ECharts dataset](https://echarts.apache.org/handbook/en/concepts/dataset/).

The following table is a proposed CraftKit contract. The references substantiate the chart
semantics; the bounds and validation rules are local engineering recommendations.

| Family                              | Proposed accepted data                                                                                            | Required validation and behavior                                                                                                                                                 | Reference                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Waterfall                           | Ordered labels and one series of signed changes; optional explicit absolute/subtotal markers in a richer contract | Distinguish a delta from a total. Do not infer subtotal rows from labels or count totals twice. Keep connectors and the cumulative baseline visible.                             | [Plotly waterfall](https://plotly.com/javascript/waterfall-charts/)                    |
| Heatmap                             | Column labels, row/series labels, and numeric matrix                                                              | Match matrix dimensions; show a scale legend and readable value alternative. Preserve zero distinctly from missing. Duplicate coordinates require a declared aggregation.        | [Vega-Lite table heatmap](https://vega.github.io/vega-lite/examples/rect_heatmap.html) |
| Flat treemap                        | Labels and one nonnegative additive series                                                                        | Reject negative areas; explicitly handle an all-zero total. Clearly label the initial implementation as flat, without pretending to infer hierarchy.                             | [Plotly treemaps](https://plotly.com/javascript/treemaps/)                             |
| Bullet                              | Actual values, an explicit target, and a defined scale; optional qualitative ranges                               | Show target numerically as well as graphically. Do not invent targets or silently clamp an over-target actual. Validate range order.                                             | [Plotly bullet charts](https://plotly.com/javascript/bullet-charts/)                   |
| Histogram                           | Raw numeric observations with a bounded bin policy, or explicit non-overlapping bin edges and counts              | Distinguish raw observations from pre-binned counts. Preserve the final endpoint, empty bins, and total observation count. Do not rename arbitrary categorical bars a histogram. | [Vega-Lite binning](https://vega.github.io/vega-lite/docs/bin.html)                    |
| Box plot, conditional next addition | Raw observations by group, or named min/Q1/median/Q3/max summaries                                                | Declare min/max versus Tukey whiskers and the quantile convention. Reject unordered summaries; do not manufacture quartiles from an average.                                     | [Vega-Lite box plots](https://vega.github.io/vega-lite/docs/boxplot.html)              |

Plotly's financial gallery separately lists candlestick, OHLC, waterfall, bullet, gauge, funnel, and
time-series charts. This is evidence that professional coverage includes distinct contracts, not
evidence that arbitrary financial inputs fit CraftKit's existing category/series model. Defer
candlestick/OHLC, Sankey, geographic maps, and multi-level hierarchy until their specific data
contracts, editing, fallback tables, and export behavior exist.
[Plotly financial charts](https://plotly.com/javascript/financial-charts/).

An explicit requested family should win over automatic selection when its input validates. If it
does not, return the exact issue and a remedy before mutation: for example, a histogram needs
observations or bins; a treemap needs nonnegative weights. Unsupported types should produce an
honest supported-type response, not a successful receipt for a silently substituted chart. This is a
proposed agent behavior derived from the documented differences above.

## 3. Key Stats and professional report forms

Evidence's Big Value component supports a prominent value, comparison, delta, and sparkline.
Comparisons include previous periods, targets, and benchmarks, with controls for whether a decrease
is favorable. These are useful precedents for practical Key Stats, beyond decorative number cards.
[Evidence Big Value](https://docs.evidence.dev/components/big_value).

Recommended optional Key Stats fields:

- Comparison text and direction, with explicit positive/negative/neutral meaning; an increase in
  cost must not automatically render as good news.
- Target and progress only when the source provides a target. Keep the actual value visible above
  100%; clamp a visual bar only if its label preserves the true value.
- A small bounded sparkline with a textual period description and no fabricated missing values.
- Units, period, and explanatory detail. Long numbers and mixed Arabic/Latin labels should wrap or
  isolate predictably, rather than reducing all text to unreadable sizes.

These are proposed API additions. Values, deltas, and mini-trends should come from the same analysis
result. Evidence documents reusable metric definitions consumed by multiple components and an agent
query tool using the same compiler. It also explicitly explains why slice averages and ratios cannot
simply be averaged to obtain an overall result. CraftKit should preserve its existing paired-source
calculation protections and avoid a second formula implementation inside presentation components.
[Evidence metrics](https://docs.evidence.dev/core-concepts/metrics).

Observable Framework documents responsive grids, cards, spanning, and container-aware resizing. Its
documentation supports varying row heights when equal-height cards waste space. This suggests
several report forms built from existing blocks instead of an independent dashboard framework.
[Observable layout](https://observablehq.github.io/framework/markdown).

Proposed report presets, subject to available data:

| Form                       | Composition                                                                        | Data requirement                                      |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Executive summary          | Key Stats, one principal trend, leading categories, concise findings, source table | At least one meaningful numeric measure               |
| Performance against target | Actual/target Key Stats, bullet or comparison chart, variance table                | Comparable actual and target values                   |
| Financial movement         | Revenue/cost/profit summary, signed waterfall, period comparison                   | Compatible units and matched observations             |
| Distribution and quality   | Count/min/median/max, histogram or box plot, missing-data explanation              | Raw observations or valid statistical summaries       |
| Matrix comparison          | Heatmap, strongest/weakest cells, source matrix                                    | Two categorical dimensions and a quantitative measure |
| Share and ranking          | Treemap or donut, ranked bars, source detail                                       | Nonnegative additive values                           |

The agent should choose a preset by intent and data, not fill every report with every chart. Adding
charts that repeat the same values without a new analytical purpose increases page length; this is a
product judgment, not a measured conclusion from the cited projects.

## 4. Rendering, accessibility, RTL, and agent constraints

W3C guidance for complex charts calls for a short identification and a fuller equivalent
description, potentially including a structured data table. It notes that a long table flattened
through `aria-describedby` loses its navigable structure. Keep an actual accessible table and an
adjacent summary, rather than one enormous label.
[W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/).

ECharts provides chart descriptions and pattern fills in addition to color, but these features must
be enabled and imported when applicable. The transferable recommendation is redundant encoding: use
labels, target markers, shapes, or patterns rather than color alone. A library's accessibility
option is not itself proof of conformance.
[ECharts accessibility](https://echarts.apache.org/handbook/en/best-practices/aria/).

W3C's bidirectional text guidance recommends isolating opposite-direction phrases and using
`dir=auto` or `bdi` for unknown inserted text. Apply that to signed changes, currencies, dates, and
mixed-language labels; separately test the desired chart-axis order rather than mirroring every SVG
coordinate for RTL. The axis recommendation is an inference for CraftKit, not a W3C chart rule.
[W3C bidirectional markup](https://www.w3.org/International/articles/inline-bidi-markup/).

Vega-Lite documents separate treatments for invalid values, including filtering and breaking paths.
Missing observations therefore need an explicit policy. For this bounded renderer, rejecting
incompatible direct chart input or omitting an incomplete report series with a visible explanation
is safer than changing unknowns to zero. Real zeros must remain real observations.
[Vega-Lite invalid data](https://vega.github.io/vega-lite/docs/invalid-data.html).

ECharts describes SVG as useful for scaling and lower memory use in suitable scenarios, while Canvas
is useful for larger mark counts. Its server-rendering guide supports SVG output without requiring
the full browser runtime, with interaction limitations. These are precedents for retaining
CraftKit's bounded SVG path and standalone export; they are not a CraftKit benchmark.
[ECharts renderer comparison](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/),
[ECharts server rendering](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/).

If a future requirement truly needs a general grammar, treat that as a separate adapter decision.
Vega-Embed exposes URL loading, custom loaders, expressions, and export actions; its CSP-compatible
interpreter has a different performance tradeoff. A maintainer advisory documents a specific
untrusted-spec/global-debug exposure, reinforcing that JSON alone is not a trust boundary. This does
not identify a vulnerability in CraftKit, which this proposal does not ask to install Vega. Use
host-controlled adapters with allowlisted mappings, bounded data, and no arbitrary callbacks or
remote loading in model-authored chart props.
[Vega-Embed](https://vega.github.io/vega-embed/index.html),
[Vega maintainer advisory](https://github.com/vega/vega/security/advisories/GHSA-7f2v-3qq3-vvjf).

Plotly's repository demonstrates much broader specialized coverage than this proposed first
increment. It remains an option for future requirements, not a dependency recommendation based on
the number of advertised types. Bundle, renderer, export, and interaction costs would need local
measurement before adopting any such runtime.
[Plotly.js repository](https://github.com/plotly/plotly.js).

## 5. Acceptance evidence proposed for implementation

These are engineering acceptance recommendations, not completed checks:

1. Each newly supported family has a valid schema example, invalid-data cases, actual rendering,
   accessible values, and an export check. Verify negative, zero, single-value, and bounded-size
   cases where meaningful.
2. Explicit family requests survive tool parsing, planning, application, and a follow-up edit;
   incompatible requests make no document change and explain the missing contract.
3. Key Stats agree numerically with source tables and report charts. Verify decreasing-is-good,
   previous-zero comparisons, over-target values, sparse data, and mixed-unit rejection.
4. Arabic mobile and English desktop render without page-level horizontal overflow. Signed values
   retain their order, and keyboard users can reach source data and controls.
5. One Undo restores each generated report or chart mutation. Existing saved Chart/Report/Stats
   props continue to parse. No claimed support exists solely in a prompt description.
6. Measure the affected application build and bundle budget; distinguish scripted browser proof from
   live provider chart-selection quality. No paid calls are needed for deterministic checks.

## Sources

All sources below are first-party documentation, standards guidance, or maintainer material.
Documentation may be undated; it was retrieved for this research on 2026-10-20.

1. [ECharts dataset](https://echarts.apache.org/handbook/en/concepts/dataset/) — source/encoding
   separation.
2. [Vega-Lite box plots](https://vega.github.io/vega-lite/docs/boxplot.html) — quartiles and whisker
   conventions.
3. [Plotly waterfall](https://plotly.com/javascript/waterfall-charts/) — relative, absolute, and
   total steps.
4. [Plotly bullet](https://plotly.com/javascript/bullet-charts/) — actual, target, and qualitative
   ranges.
5. [Plotly treemaps](https://plotly.com/javascript/treemaps/) — hierarchical rectangular areas.
6. [Vega-Lite binning](https://vega.github.io/vega-lite/docs/bin.html) — observations, binning, and
   pre-binned input.
7. [Vega-Lite table heatmap](https://vega.github.io/vega-lite/examples/rect_heatmap.html) —
   categorical matrix encoding.
8. [Evidence Big Value](https://docs.evidence.dev/components/big_value) — comparison, delta, and
   sparkline.
9. [Evidence metrics](https://docs.evidence.dev/core-concepts/metrics) — shared formulas and
   aggregation grain.
10. [Observable layout](https://observablehq.github.io/framework/markdown) — responsive grids and
    cards.
11. [ECharts accessibility](https://echarts.apache.org/handbook/en/best-practices/aria/) —
    descriptions and patterns.
12. [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/) — equivalent structured
    descriptions.
13. [W3C bidirectional markup](https://www.w3.org/International/articles/inline-bidi-markup/) —
    mixed-direction text.
14. [ECharts renderer comparison](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
    — SVG/Canvas tradeoffs.
15. [ECharts server rendering](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/)
    — standalone SVG and limits.
16. [Vega-Lite invalid data](https://vega.github.io/vega-lite/docs/invalid-data.html) — gaps,
    filtering, and invalid values.
17. [Vega-Embed](https://vega.github.io/vega-embed/index.html) — loading, export, lifecycle, and
    interpreter options.
18. [Vega maintainer advisory](https://github.com/vega/vega/security/advisories/GHSA-7f2v-3qq3-vvjf)
    — scoped untrusted-spec exposure, published 2025-11-13.
19. [Plotly financial gallery](https://plotly.com/javascript/financial-charts/) — specialized
    financial families.
20. [Plotly.js repository](https://github.com/plotly/plotly.js) — broader renderer capability
    reference.

## Methodology and limits

The user goal is implementation: broaden professional reports, Key Stats, and agent-generated charts
while preserving correctness and editing. No clarification was necessary to research those
capabilities. Scope was divided into three questions:

- Which chart families provide useful coverage, and what data does each actually require?
- What makes Key Stats and report layouts useful, coherent, and responsive?
- How should an agent use declarative charts while preserving accessibility, RTL, export, and
  bounds?

Executed 12 search queries across official documentation and maintainer domains, then opened
selected pages directly where search discovery was incomplete. Twenty unique official sources are
retained above; unrelated, duplicate, legacy, and third-party search results were excluded. Five
focused documents were read in full: Vega-Lite box plots, binning, invalid data, table heatmap, and
ECharts accessibility. Longer documents were read in relevant sections; Evidence metrics was also
read through its aggregation and agent-tool guidance. The inaccessible guessed Vega-Lite security
page was excluded, and maintainer/Embed material used instead.

Exa and Firecrawl were absent from the configured callable tools. Research used `web.run` as the
available fallback; no Exa/Firecrawl coverage is claimed. Sources were treated as untrusted data.
Documentation navigation boilerplate was not treated as authorization or as research instructions.
No package was installed, no remote state was changed, and no live model was called.

Confidence is high for documented capabilities and directly inspected source shape. Priority,
implementation cost, and the recommendation to retain the current SVG runtime are engineering
inferences with medium confidence until verified in the actual build and browser. This report does
not claim support for every conceivable chart, live data connectivity, PDF generation, automatic
production-quality statistical inference, or completion of the proposed changes.
