# Second-prompt execution and trustworthy reports

User authorization: investigate and repair the second prompt, strengthen the existing agent and
analytical reports, and research relevant GitHub implementations (2026-10-20).

## Scope and requirements

This continuation belongs to feature 014. Owners: `@craftkit/playground` request queue, conversation
history and controller; `@craftkit/builder-ai` deterministic report analysis and report rendering.
Read the server/provider boundary for diagnosis. Preserve the 115 staged files from prior work; new
work remains unstaged. No dependency, new component, schema migration or external write.

- Q1: A queued follow-up belongs to its originating page and conversation. A deselected reference to
  the active artifact resolves after that predecessor completes; it cannot silently use the
  previously completed artifact. Explicit targets stay explicit. Stop, missing targets, failed
  predecessors and page changes must not turn into edits of another artifact.
- Q2: A second request after completion receives current source and honest prior execution outcomes.
  Proposed, failed, unfilled and undone content must not be described as applied.
- Q3: Report changes and trends use chronological periods when their order is unambiguous.
  Incompatible units cannot silently become sums or derived profit/margin. Derived measures must use
  paired source observations, not unrelated missing values joined after aggregation.
- Q4: Quality limitations are visible in the generated report. Existing bounds, RTL, Undo,
  deterministic calculations and supported table/chart contracts remain intact.
- Q5: Research uses primary repository/documentation sources and distinguishes demonstrated
  mechanisms from recommendations. Local checks and scripted-provider results do not prove live
  model quality, API costs, other-device behavior or deployment.

## Plan and checklist

1. Reproduce queue ownership/predecessor defects and report arithmetic failures before repairs.
2. Carry runtime queue ownership and predecessor identity through dispatch; use exact kernel
   ownership, never coincident node IDs or a shared transaction log as page identity.
3. Send bounded execution receipts in conversation history; current document remains authoritative.
4. Repair period ordering, unit compatibility and paired calculations in the existing pure engine.
   Surface quality findings through existing report blocks, without adding rendering dependencies.
5. Run focused behavior tests, owner/consumer checks, applicable browser fixtures and fresh
   independent native review. Repair findings and update this artifact and shared handoff.

Constitution analysis: kernel-only mutation and package direction remain unchanged. Workers have
non-overlapping controller, report-analysis and research scopes; the primary owns integration and
history. Existing local-review preference continues for this directly related work; no external
CLI/workflow-engine pass is claimed. No new UI component is planned.

## Verification

### Implemented behavior

- **Q1:** Queue entries carry their original runtime kernel and conversation. An implicit follow-up
  waits for its active predecessor's actual target; an explicit selection wins. Failed predecessors
  cannot substitute an older completed artifact. Other pages with colliding node IDs cannot accept
  the queued edit. Returning to the original page can resume the held request.
- Build ownership is acquired before asynchronous host page creation. Stop releases the request
  while the host is pending and prevents a late result from launching an AI build. Clarification,
  answer/as-written, and a competing Retry retain the original page/conversation.
- A compatibility build fallback records the uniquely changed, reachable section from that run's
  applied transactions. It does not infer ownership from an unrelated mural already on the page.
- **Q2:** Conversation history distinguishes applied IDs, failed/unfilled sections, proposals,
  no-change results, stopped work and undone changes. Restored records explicitly require checking
  the current document. Current creative source and the existing stale-source guard remain intact.
- **Q3:** Analysis sorts a copy of comparable periods while retaining source table order. Ambiguous
  undated weekdays, year boundaries and equivalent period aliases do not invent growth or forecasts.
  Irregular intervals suppress interval-dependent trends. Incompatible units are not combined;
  profit/margin use matched original observations and ratios of paired totals.
- **Q4:** Reports explain missing observations, bounded analysis, uncertain chronology, different
  units and unweighted percentages. Incomplete chart series are omitted rather than fabricated as
  zero; actual zeros remain. Quality notes survive rich-text and table-only rendering, including
  single-row reports. Existing kernel validation, one-step Undo, table controls and RTL remain.
- **Q5:** [Research](research-second-prompt-reports-2026-10-20.md) records 22 primary sources and
  separates documented mechanisms from proposed adaptations. No framework dependency was added.

### Reproductions and automated checks

The report worker first demonstrated nine failing integrity cases. Primary integration separately
reproduced invalid single-row report headers and missing quality notes, then repaired both. Fresh
review reproduced equivalent month aliases and undated weekday wraparound; their regressions now
pass. Controller regressions exercise actual dispatch/kernel changes, not only route classification.

Commands run from the workspace root:

```sh
pnpm --filter @craftkit/builder-ai exec vitest run src/data-tools --maxWorkers=1
pnpm --filter @craftkit/builder-ai exec vitest run src/data-tools/analysis src/data-tools/report-page.test.ts src/data-tools/report-page.quality.test.ts --maxWorkers=1
pnpm --filter @craftkit/playground exec vitest run src/features/agent/model/conversation-memory.test.ts src/features/agent/model/turns.test.ts src/features/agent/hooks/use-agent-controller.followup.test.tsx --maxWorkers=1
pnpm --filter @craftkit/playground exec vitest run src/features/agent/hooks/use-agent-controller.queue-continuity.test.tsx --maxWorkers=1
pnpm --filter @craftkit/playground test use-agent-controller.queue-continuity use-agent-controller.followup use-agent-controller.test use-agent-controller.site.test use-agent-controller.incident.test src/features/agent/model/creative-followup.test.ts src/features/agent/model/queue.test.ts --maxWorkers=1
pnpm --filter @craftkit/builder-ai typecheck
pnpm --filter @craftkit/playground typecheck
pnpm --filter @craftkit/builder typecheck
pnpm --filter @craftkit/playground build
pnpm --filter @craftkit/playground check:size
node apps/evals/src/browser/agent-continuation-reports.mjs http://127.0.0.1:5174
```

- Reports: 11 files / 246 tests passed before the final three period regressions. The final affected
  group passed 5 files / 75 tests, including all period repairs and three real report
  expansion/validation/application/Undo cases.
- Conversation memory, turn state and existing follow-up suite: 3 files / 70 tests passed.
- Final controller/model/site/incident regression run: 7 files / 84 tests passed, including all 12
  queue/landing/clarification cases and both review repairs. Test groups above overlap.
- All three owner/consumer typechecks passed. Changed-source ESLint and browser-script lint passed.
  The final production Playground build passed, retaining existing unresolved template-URL and
  large-chunk warnings. No dependency or size baseline was changed.
- Initial-load budgets passed: entry 550,951/896,000; JS 1,087,871/1,151,000; CSS 145,879/147,000
  bytes gzip.
- Workspace structure (37 packages), components (260), file sizes (4,544) and package boundaries
  (5,942 files / 37 packages) passed. Repository-wide checks include concurrent files but are not a
  review of those unrelated changes.

### Browser evidence

The repeatable script uses the actual `useAgentController`, builder kernel and document renderer.
Installed Chrome ran all four cases successfully; the primary reran it after the last production
repairs. External/provider endpoints were blocked; zero live provider calls and zero page errors.

1. A completed edit followed by a deselected second prompt updates the same visible artifact.
2. A queued second prompt follows its active predecessor, preserving the older unrelated artifact.
3. English report at 1280px: chronological periods, paired margin of 60% from 960/1600, quality
   note, source order, filtering, numeric sorting and pagination.
4. Arabic report at 390px: the same checks, RTL and no horizontal page overflow.

Local screenshots: `/tmp/craftkit-continuation-browser.png`, `/tmp/craftkit-report-en-browser.png`,
`/tmp/craftkit-report-ar-browser.png`.

### Review, convergence and limits

A fresh read-only native reviewer inspected the scoped source and tests. Four Medium findings were
repaired: equivalent period labels, undated weekday wraparound, fallback artifact ownership, and
clarification racing a different conversation/run. The reviewer rechecked the repairs and reported
no remaining actionable finding. The local-review preference remains in force; no external CLI
review or professional-sdd engine result is claimed.

Final scoped convergence: Q1–Q5 and T298–T302 are satisfied, with no additional implementation task.
Historical feature-wide release gates remain separate. The shared context and handoff record the
local completion and verification limits.

These browser cases use scripted responses and controller callbacks; they are not a composer
keyboard journey or live-provider evaluation. The original failing other-device run and its provider
trace are unavailable. Model adherence, creative quality, cost, billing, production latency, full CI
and deployment are not established by this increment.

The host's `addPage` API has no abort argument: Stop prevents late AI writes but cannot cancel host
page creation already in progress. Queue ownership is runtime-only. Ambiguous dates use categorical
analysis; incomplete chart series are omitted because the current renderer has no gap contract.
`report.page` still creates report sections; this increment does not introduce a dedicated report
group replacement API. Existing explicit editing remains separate.

Preserve the 115 files staged before this increment and the concurrently appearing AI-server/Codex
backend work. Those server changes were neither edited nor reviewed here. No commit, push,
deployment, paid provider request, migration or saved-document rewrite occurred.
