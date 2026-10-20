# Second-prompt continuity and analytical reports: research

Generated: 2026-10-20. Scope: feature 014, `builder-ai` and Playground Agent integration. Evidence:
22 selected primary sources; 12 search queries; five key sources read beyond search snippets.
Confidence: high for documented mechanisms, medium for the proposed CraftKit adaptations. This
report recommends implementation patterns; it is not implementation or production evidence.

## Decision

Strengthen the existing kernel command architecture with explicit continuation ownership, verified
application outcomes, and consistent report calculations. The reviewed projects provide useful
patterns for those responsibilities. Their documentation does not establish that replacing
CraftKit's runtime with a new agent framework would fix the reported second-prompt failure. That
cause still requires a local reproduction and, for the original incident, its unavailable
device/provider trace.

This recommendation fits the existing approved constraint: the agent proposes commands and the
kernel applies a validated transaction. Report generation already has a deterministic analysis
owner. See the [active plan](plan.md), [follow-up increment](creative-followup-2026-10-20.md), and
[report implementation task](tasks.md#increment-2026-10-14-h--analytical-report-pages).

## Research questions

1. How do agent projects retain the right conversation and work product across successive prompts?
2. How do they make execution, verification, retries, and failure costs observable?
3. How do reporting projects keep metrics, missing data, and chart transformations consistent?
4. Which mechanisms fit CraftKit directly, and which require a separate framework or data engine?

## Conversation identity and actual application

LangGraph separates thread-scoped checkpoints from cross-thread stores. A stable `thread_id` retains
a sequence of runs; its documentation explicitly warns that an in-memory saver does not survive
process restarts. Its checkpointers retain intermediate successful task writes, so a sibling failure
need not rerun already completed work. Replay is different: steps after the selected checkpoint
execute again, including model calls. These are useful distinctions for continuation, recovery, and
accounting. [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence),
[checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers).

OpenHands' executable persistence example sends successive messages to one `Conversation`, then
reconstructs it with the same conversation ID and persistence directory. Events feed a callback; the
example reports accumulated model cost. Its SDK owns conversations, events, workspaces, and the
agent server, while the browser consumes a typed client. These are concrete ownership and continuity
mechanisms, rather than evidence that the model will remember an artifact by prose.
[Persistence example](https://github.com/OpenHands/software-agent-sdk/blob/main/examples/01_standalone_sdk/10_persistence.py),
[SDK repository](https://github.com/OpenHands/software-agent-sdk).

Mastra similarly makes thread and resource identity explicit in its memory API. Its memory-enabled
evaluation example uses deterministic mock models and deliberately chooses shared conversation
threads or separate per-case threads. That supports testing continuation as a sequence rather than
scoring only independent first prompts.
[Memory API](https://github.com/mastra-ai/mastra/blob/main/docs/src/content/en/reference/client-js/memory.mdx),
[memory evaluation example](https://github.com/mastra-ai/mastra/blob/main/examples/evals-with-memory/README.md).

**CraftKit adaptation, inferred:** a queued request should retain its project/page/session owner,
explicit target if one was supplied, and any dependency on the active turn. If its implied target is
the unfinished turn's output, resolve that target after the turn settles. Do not substitute the last
older completed artifact while enqueueing. Rebuild provider context from the current source at
dispatch. Preserve stale-source checks at application; fresh context is not permission to overwrite
an unrelated user edit.

The app should distinguish an accepted prompt, generated proposal, validated proposal, committed
transaction, and rendered result. A model response alone is not an application receipt. This is a
recommended invariant for CraftKit, not a claim that every researched framework supplies a
browser-render acknowledgement automatically.

## Verification and bounded execution

Aider connects changes to automatic linting and optional tests. A nonzero test result can be
returned to the model for correction. The useful pattern is a real machine result after an edit; the
particular shell workflow is not needed inside CraftKit's browser document editor.
[Aider linting and testing](https://aider.chat/docs/usage/lint-test.html).

Pydantic AI documents separate transport, SDK, durable-execution, fallback, tool, output, and hook
retry layers. Their budgets can multiply. It also distinguishes a tool-correction message from a
transport retry and records failed fallback attempts with their metadata. This supports reviewing an
entire request budget, rather than assuming a single `maxRetries` controls every layer.
[Pydantic AI retries](https://pydantic.dev/docs/ai/core-concepts/retries/).

OpenHands additionally documents automatic skill selection from concrete repository markers. The
transferable principle is selecting relevant expertise from observed context; its public skills
loading mechanism is not a reason to import unreviewed instructions into CraftKit.
[OpenHands SDK](https://github.com/OpenHands/software-agent-sdk).

**CraftKit adaptation, inferred:** retain bounded syntax/runtime/application checks and repair only
diagnosed failures within one end-to-end deadline. Carry attempt and application outcomes through
the existing event stream. Select teaching from the target's actual medium and requested change,
preserving the existing capability-policy intersection. A second prompt that produces no applicable
command must receive an honest no-change result or a bounded correction, rather than a success
message unsupported by a document change.

No source reviewed here supplies a measured speed, token-saving percentage, or creative-quality
improvement for CraftKit. Those claims require representative provider runs.

## Reports: one calculation contract, faithful data

Evidence defines reusable named metrics with aggregation, format, filter, and label. Cards, charts,
tables, and its AI metric query tool reuse that definition. Its documentation explains why ratios
and averages cannot be added across groups; table grand totals recompute at the overall grain. Its
models separate reusable preparation from report presentation, although that documented managed
capability is currently a paid beta and should not be confused with a freely embedded package.
[Metrics](https://docs.evidence.dev/core-concepts/metrics),
[models](https://docs.evidence.dev/core-concepts/models).

Vega-Lite makes aggregate operation and grouping explicit. It separates total row count, valid value
count, and missing value count, and recommends explicit parsing where nulls can confuse inference.
This is a useful reference for reporting a data-quality summary without turning blanks into zero.
[Aggregation](https://vega.github.io/vega-lite/docs/aggregate.html).

Observable Plot separates categorical grouping from numeric/time binning and supports explicit
reducers. Its binning documentation warns that omitted empty time bins can cause a line or area to
interpolate misleadingly across missing observations. Vega-Lite's default line behavior breaks the
line at invalid positional values. [Grouping](https://observablehq.github.io/plot/transforms/group),
[binning](https://observablehq.github.io/plot/transforms/bin),
[line gaps](https://vega.github.io/vega-lite/docs/line.html).

**CraftKit adaptation, inferred:** use one typed analysis result for KPI cards, chart series,
findings, and tables, with an explicit unit, aggregation, valid count, missing count, and source
scope. Mark unweighted averages as such when no denominator exists. Preserve missing observations
through the rendering boundary. Refuse or clearly separate incompatible currency/unit operations; do
not discard their unit labels and then combine their values.

Local inspection supplied concrete leads, which require owner tests before being called defects:

- `analysis/profile.ts` removes divergent unit strings while retaining numeric values.
- `analysis/derived.ts`'s `sameUnit` retains the first unit even when the second differs.
- `analysis/groups.ts` represents absent group-period observations as zero.
- `analysis/measures.ts` averages percent values within groups; any summary must retain the meaning
  of that average and must not imply a denominator-weighted total.

These observations refer to the working-tree snapshot read during research. Concurrent
implementation may already repair them. The integrating agent owns reproduction and final status.

## GitHub candidates and fit

Licenses below are the main repository's declared license as observed on this date; no transitive
dependency or hosted-service license audit was performed.

| Project                                                          | Observed capability / license                                                                       | Recommended fit for this increment                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LangGraph.js](https://github.com/langchain-ai/langgraphjs)      | Stateful graph orchestration; [MIT](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE). | Borrow thread/checkpoint distinctions. Framework migration is unnecessary for a controller ownership bug.                                           |
| [OpenHands SDK](https://github.com/OpenHands/software-agent-sdk) | Conversation/event/workspace contracts; MIT.                                                        | Borrow stable artifact/conversation ownership and event receipts. Its server/workspace stack is a separate integration.                             |
| [Evidence](https://github.com/evidence-dev/evidence)             | SQL/Markdown reports and visualizations; MIT repository.                                            | Borrow reusable metric definitions and shared calculation results. Do not replace the existing report page with a new reporting application.        |
| [Observable Plot](https://github.com/observablehq/plot)          | Layered visualization grammar; ISC.                                                                 | Use grouping, binning, and missing-data semantics as references. Consider an adapter only if the existing renderer cannot express a required chart. |
| [Vega-Lite](https://github.com/vega/vega-lite)                   | Declarative chart specifications; BSD-3-Clause.                                                     | Useful schema/transform reference. A new chart runtime requires an actual renderer need and bundle/export evidence.                                 |
| [DuckDB-Wasm](https://github.com/duckdb/duckdb-wasm)             | Browser SQL engine with Arrow, CSV, JSON, and Parquet support; MIT.                                 | Conditional future choice for larger data or joins. Small bounded imported tables do not establish a need for it.                                   |

DuckDB-Wasm adds JavaScript workers and WebAssembly artifacts; threaded variants require
cross-origin isolation. Its default client uses one thread and browser memory is bounded. Its
deployment documentation also notes remote endpoint access. Any future adoption therefore needs lazy
loading, explicit asset hosting and network policy, cancellation, and realistic import benchmarks.
These are integration requirements, not a performance comparison.
[Overview](https://duckdb.org/docs/lts/clients/wasm/overview),
[deployment](https://duckdb.org/docs/current/clients/wasm/deploying_duckdb_wasm).

## Five implementation recommendations

1. **Bind continuation to the right work.** Preserve explicit selection; represent a follow-up
   queued behind an active turn as a dependency; resolve its result after settlement and read the
   latest source at execution. Verify page/session ownership and removed-target refusal.
2. **Make applied work provable.** Connect the outgoing request to its proposal and kernel
   transaction; report no-change distinctly. Verify a second request changes the existing artifact,
   retains unrelated content, and can be undone once.
3. **Keep verification and costs bounded.** Share the request deadline across planning, generation,
   checking, and repair. Use target-aware skills and concrete validator feedback. Count failures as
   attempts and retain unknown usage as unknown.
4. **Strengthen the deterministic report contract.** Preserve units and missingness, use consistent
   metric definitions across all views, state aggregation/coverage, and update an existing report
   explicitly rather than appending an accidental duplicate.
5. **Test conversations and analytical invariants.** Add first-prompt/second-prompt cases after
   completion and while queued, plus Ask/Auto, retry, page switch, deletion, stale edit and
   two-report ambiguity. Use data fixtures for nulls versus zeros, unequal group sizes, mixed units,
   sparse periods, and derived ratios. Separate these local tests from provider quality, latency,
   and billing measurements.

These are design recommendations based on the evidence above and the inspected local architecture.
The implementation and verification documents should record which recommendations actually landed.

## Source register

The 22 distinct selected sources below are official project repositories, source files, or docs.
Redirect aliases and raw/HTML views of the same file count once.

1. [LangGraph.js repository](https://github.com/langchain-ai/langgraphjs) — orchestration boundary.
2. [LangGraph.js license](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE) — MIT
   declaration.
3. [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence) —
   thread/store distinction.
4. [LangGraph checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers) —
   intermediate writes and replay.
5. [OpenHands SDK](https://github.com/OpenHands/software-agent-sdk) — repository/API ownership and
   skills.
6. [OpenHands persistence example](https://github.com/OpenHands/software-agent-sdk/blob/main/examples/01_standalone_sdk/10_persistence.py)
   — real multi-turn reconstruction code.
7. [Aider lint/test](https://aider.chat/docs/usage/lint-test.html) — validation after edits.
8. [Pydantic AI retries](https://pydantic.dev/docs/ai/core-concepts/retries/) — layered attempt
   budgets.
9. [Mastra memory API](https://github.com/mastra-ai/mastra/blob/main/docs/src/content/en/reference/client-js/memory.mdx)
   — explicit memory scope.
10. [Mastra memory evals](https://github.com/mastra-ai/mastra/blob/main/examples/evals-with-memory/README.md)
    — deterministic conversation tests.
11. [Evidence repository](https://github.com/evidence-dev/evidence) — report framework and MIT
    declaration.
12. [Evidence metrics](https://docs.evidence.dev/core-concepts/metrics) — shared definitions and
    total-grain semantics.
13. [Evidence models](https://docs.evidence.dev/core-concepts/models) — preparation/presentation
    separation.
14. [Observable Plot repository](https://github.com/observablehq/plot) — chart grammar and ISC
    declaration.
15. [Plot group transform](https://observablehq.github.io/plot/transforms/group) — categorical
    reductions.
16. [Plot bin transform](https://observablehq.github.io/plot/transforms/bin) — continuous bins and
    gaps.
17. [Vega-Lite repository](https://github.com/vega/vega-lite) — declarative grammar and BSD-3-Clause
    declaration.
18. [Vega-Lite aggregation](https://vega.github.io/vega-lite/docs/aggregate.html) — typed
    aggregation and validity.
19. [Vega-Lite line](https://vega.github.io/vega-lite/docs/line.html) — invalid positional values.
20. [DuckDB-Wasm repository](https://github.com/duckdb/duckdb-wasm) — browser analytical engine and
    MIT declaration.
21. [DuckDB-Wasm overview](https://duckdb.org/docs/lts/clients/wasm/overview) — memory/thread
    limits.
22. [DuckDB-Wasm deployment](https://duckdb.org/docs/current/clients/wasm/deploying_duckdb_wasm) —
    worker, WASM, isolation, and endpoint requirements.

## Methodology and limits

The invoked `ecc:deep-research` skill was read from its installed `SKILL.md`. Exa/Firecrawl
discovery was attempted through `tool_search`; the worker received an unsupported-call response.
Available web search/open tools were used instead. No configuration, installation, cloning, API
inference, private-data upload, or external mutation occurred.

Twelve searches covered durable execution/persistence, Aider verification/history, OpenHands
events/conversation, Pydantic retry limits, Evidence queries/reports, Plot transforms, Vega nulls,
DuckDB browser limits, and official repository/license/memory examples. Search results from forums,
third-party mirrors, commercial comparisons, and unsupported performance claims were excluded. Five
key sources were read directly in depth: LangGraph persistence, the complete OpenHands persistence
example, Aider lint/test, Vega aggregation, and Evidence metrics.

Live documentation redirected the older LangGraph durable-execution URL to persistence, and an older
Evidence queries URL to its managed warehouse documentation. The canonical destinations were
checked; the warehouse redirect was not treated as evidence about a freely embedded library. Pages
contain documentation navigation hints addressed to agents; those were treated as source content,
not as instructions or authorization.

High confidence means a mechanism is visible in official docs/source; it does not certify that the
project is bug-free. Fit judgments are medium-confidence engineering inferences from CraftKit's
approved architecture and inspected code. No selected dependency was installed or benchmarked. There
is no evidence here for a universal model-quality score, a guaranteed runtime, or the exact cause of
the other device's failed request.
