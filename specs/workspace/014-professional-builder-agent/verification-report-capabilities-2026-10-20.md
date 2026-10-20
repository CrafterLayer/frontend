# Professional report capabilities: local verification

Date: 2026-10-20, Asia/Hebron. Scope: RP1–RP7 / T303–T309 in
[the increment](report-capabilities-2026-10-20.md). Local source changes; no deployment, commit,
dependency installation or paid provider request. Implementation, independent review and scoped
local convergence are complete.

## Implemented behavior

- Twenty-one explicit chart families in Chart, compact Report and agent tools: the existing twelve
  plus waterfall, heatmap, treemap, histogram, bubble, boxplot, candlestick, lollipop and bullet.
- Five detailed report presentations: analytical, executive, financial, operational and comparison;
  explicit chart/column selections and optional source tables. Examples cover finance/sales,
  project/team delivery and marketing/web analytics, including Arabic.
- Stats comparison captions, semantic sentiment, observed-source sparklines and accessible progress.
  Report supports eight KPIs, median/count, explicit baselines/targets/detail and optional trends.
  Explicit baselines show their own caption/value; counts remain unitless. Target bars are bounded
  while their visible/accessibility captions retain actual attainment above 100 percent.
- Compact report refreshes use the existing ID and preserve compatible KPI configuration by source
  column name. Changed or ambiguous sources and changed goal units require explicit replacement KPI
  configuration. Authored summary stays separate from computed histogram provenance.
- Missing numeric data is never invented as zero. Specialized invalid shapes fail before writes.
  Histogram bins retain distinct representable boundaries and conserve observations. Bubble input
  requires exactly X/Y/Size; X/Size are unitless and Y may carry one consistent unit.
- Request skills cover the specialized names in host and section lanes. Tool prompts remain bounded;
  build/edit caps rose by 140 characters each to retain existing discoverable signatures. No file
  size or initial-load baseline was increased.

## Tests and checks

| Check                                                            | Result                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI data tools, analysis, skill selection and adjacent tool menus | 20 files / 595 cases: 594 passed; one stale cap literal corrected, then its complete 9-case suite passed. All behaviors covered across these overlapping runs.      |
| Marketing Chart, Stats, Report and MetricTrend                   | 14 files / 224 tests passed.                                                                                                                                        |
| Full Playground catalog/context readiness                        | 1 file / 3 tests passed, including landing/empty full-catalog requests reaching the scripted provider once.                                                         |
| AI scoped ESLint                                                 | Passed after one optional-chain cleanup; affected-file rerun passed.                                                                                                |
| Marketing scoped ESLint                                          | Passed, including the final comparison/provenance/attainment repairs.                                                                                               |
| Browser script syntax, ESLint and formatting                     | Passed.                                                                                                                                                             |
| Workspace/component/file-size/boundary gates                     | Passed: 37 members, 261 components, 4,567 size-checked files, 5,965 boundary-checked files. No baseline increased.                                                  |
| Owner/consumer TypeScript                                        | Passed for builder-ai, marketing blocks, builder facade and Playground.                                                                                             |
| Advanced chart static markup                                     | 28-test AdvancedChart suite passed, including server-rendered standalone SVG for all nine new families. This overlaps the 224-case component run and adds one case. |
| Playground production and initial-load budget                    | Passed: entry 560,867 / 896,000; JS 1,097,787 / 1,151,000; CSS 145,890 / 147,000 bytes gzip.                                                                        |
| Storybook production                                             | Passed after removing duplicate autodocs tagging from the new MDX-documented AdvancedChart story.                                                                   |
| Affected Storybook interactions/a11y                             | 5 files / 63 tests passed in installed Chrome, using the unchanged Storybook preview and a temporary launch-path override.                                          |

Commands (from the repository root):

```sh
pnpm --filter @craftkit/builder-ai exec vitest run src/data-tools src/skills/data-viz.test.ts src/skills/request-skills.test.ts src/style-tools/part-tools.test.ts src/media-tools/media-tools.test.ts src/tools/agent/expand.test.ts src/tools/agent/builtin/scene-preset.test.ts --maxWorkers=1
pnpm --filter @craftkit/builder-ai exec vitest run src/tools/agent/expand.test.ts --maxWorkers=1
pnpm --filter @craftkit/builder-blocks-marketing exec vitest run src/components/Chart src/components/Stats src/components/Report src/components/MetricTrend --maxWorkers=1
pnpm --filter @craftkit/playground exec vitest run src/features/preview/assistant-agent-readiness.test.ts --maxWorkers=1
pnpm -r --workspace-concurrency=1 --filter @craftkit/builder-ai --filter @craftkit/builder-blocks-marketing --filter @craftkit/builder --filter @craftkit/playground typecheck
pnpm --filter @craftkit/playground build
pnpm --filter @craftkit/playground check:size
pnpm --filter @craftkit/storybook build-storybook
# Same config/annotations, local temporary override for installed Chrome launchOptions.executablePath:
pnpm --filter @craftkit/storybook exec vitest run --config /tmp/craftkit-reports-storybook.config.mts Chart.stories.tsx Stats.stories.tsx Report.stories.tsx MetricTrend.stories.tsx --maxWorkers=1 --fileParallelism=false
node apps/evals/src/browser/report-capabilities.mjs http://127.0.0.1:5174
```

Earlier failures were repaired: single-column histogram parsing, stale unsupported-type/menu
assertions, unavailable-renderer fixture selection, fixture parameterization and one optional
Testing Library name typing. Under heavy concurrent work in other workspaces, three five-second AI
cases timed out and full-App browser startup timed out before assertions. Own concurrent checks were
reduced; all three cases passed on the later normal-timeout run. No timeout or quality baseline was
relaxed. Interrupted verification jobs are not counted as passes.

## Browser evidence

Final installed-Chrome run: **56/56 passed**, zero page errors, zero external/provider requests. The
harness uses the actual public tools, plan validation, kernel, DocumentView, application Tailwind
styles and self-hosted fonts on the existing local Vite origin. It bypasses unrelated App startup;
it is not a composer keyboard journey.

- All 21 families through both `data.show` and `report.build`: valid grouped application, visible
  matching SVG, finite geometry, page containment and Undo.
- Five report-page presentations and all three domains.
- Median/count, true comparisons/attainment, source trends, same-ID refresh and Undo.
- Arabic 390px operational report and heatmap/treemap/bubble/boxplot/candlestick. The Arabic 130
  percent attainment remains visible and has no conflicting 100 percent caption.
- Invalid specialized shapes, missing values and unsupported types refuse before mutation; an Arabic
  executive request follows the deterministic route.

Machine-local evidence: `/tmp/craftkit-report-capabilities-results.json`. Screenshots:
`/tmp/craftkit-report-capabilities-{finance-kpis-desktop,waterfall-desktop,operations-desktop,marketing-desktop,operations-rtl-phone,candlestick-rtl-phone}.png`.
The primary inspected finance and Arabic mobile output. Final finance cards fill the appropriate
one/two/three/four-column layout; browser evidence was rerun after that layout adjustment.

## Independent review and convergence

Fresh native read-only review found and repaired KPI reset, collapsed histogram labels, missing
section skill routing, lost bubble role units, contradictory target percentages, histogram source
provenance and explicit-baseline captions. Follow-up review caught intervening bubble text columns,
authored histogram summary loss and the saved-KPI detail limit; all were repaired with regression
coverage. Final reviewer decision: **no actionable findings remain in the reviewed repairs**. No
external Codex CLI or professional-sdd workflow-engine pass is claimed.

Final scoped convergence: all seven RP requirements, the six implementation-plan steps and the
applicable constitution constraints are satisfied for this increment. No remaining buildable gap or
appended repair task. Component implementations/exports/stories/MDX/tests and package boundaries
remain intact. Final review also accepted the adaptive KPI grid and Storybook tagging repair.

## Limits and recovery

The finite catalog does not promise every possible chart. Treemap is flat, histogram uses bounded
equal-width bins, boxplot consumes explicit five-number summaries and candle input is OHLC.
Specialized charts do not add a plotting runtime, pan/zoom engine or statistical estimation service.
Detailed report pages still consist of separate editable sections; compact reports have the new ID
refresh path. No saved-document migration or automatic rewrite is performed.

No live-model adherence, creative quality, provider cost/latency, full CI, physical touch or
complete standalone-export packaging claim follows from these checks. Existing default rendering
remains compatible and specialized figures emit ordinary SVG. The other device is unchanged.
Rollback is source-only. Preserve the previous staged work and concurrent AI-server/specs/apps
changes; those are outside this report increment and its review.
