# Design freedom and failure recovery — local verification

Scope: [DR1–DR5](design-recovery-2026-10-21.md), T316–T320. Started clean at `53617867`. Changes
remain uncommitted. No deployment, provider call, migration, saved-document rewrite or external
review CLI. Native independent review was used under the recorded local-review preference.

## Demonstrated changes

- A retryable malformed page-plan answer now enters the same single correction round as an invalid
  plan. Three regressions failed before the fix. Terminal errors, Stop, leases and the original
  total deadline remain bounded; no third call. Real controller EN/AR regressions prove an invalid
  first request keeps Retry and a distinct second request applies with a fresh, unaborted signal.
- Structure/page-composition skills no longer impose sticky white navigation, four-column footer or
  a marketing sequence. Existing design, explicit references, usable mobile links and content decide
  composition. New templates remain an explicit user choice.
- Eleven report-intent cases failed before routing repair. Custom layout, palette, title,
  table-only, multi-chart and mixed-language instructions now fall through intact. Ordinary CSV
  reports retain the deterministic path. A bounded untrusted COMPUTED REPORT DATA fragment supplies
  calculated metrics, summary, source rows, findings and quality notes to planner, writer and edit
  contexts. This permits authored report geometry without asking the model to compute its own
  totals.
- Installed MIT Open Props1.7.23, verified its package LICENSE and registry integrity. Selected real
  spacing, fluid type and reading-measure values reach planning, region writing, authored React and
  server edit rules. They are literal scoped CSS material, with no global stylesheet/CDN/runtime
  import grants. Existing prompt/skill budgets remain.
- Planner/writer/copy/checker contracts agree on missing data: omit or visibly label it; no
  fabricated contacts or claims.12 checker regressions failed before repair; plain missing labels
  pass, while filler/template markers and clickable/fake contacts fail. Legacy no-design contracts
  retain their readers. New design contracts conservatively reject mask-shaped contact values even
  if repeated by the planner; source provenance is not inferred from the model's fact ledger.
- Matching React/DOM19.2.9 pins meet the repository installation rule. Managed runtime metadata is
  truthful; explicit trusted19.2.8 lock aliases preserve saved projects without mutation. Unknown or
  mixed versions stay rejected; alias configuration participates in artifact fingerprints.

## Passing evidence

Commands were run from the repository root; overlapping reruns are not additional coverage.

- Builder-ai focused final11-file group:401 passed (context/build/checker/output recovery/material/
  design/direct-data). Final full `run-build.page-plan.test.ts`:43 passed. Its repair fixtures now
  use raw mustache markers, since plain missing-data labels are intentionally permitted.
- Worker skill/report groups:908 passed in9 files; final direct-data guard rerun96 passed in3
  overlapping files. All524 individual skill-budget/definition tests passed.
- Planner/output/deadline56 passed; controller failure/queue14 passed. Code-runtime31 passed;
  managed catalog/composition13 passed, including actual runtime19.2.9 and legacy-lock immutability.
- Server prompt86 passed; free-design/authored/remote-plan37 passed after intentional rule/digest
  updates. One old remote-plan assertion was aligned with the already implemented preservation of
  legacy slot reference content, verified in HEAD; kits remain omitted.
- TypeScript passed for builder-ai, code-runtime, Builder facade, ai-server and Playground.
  Changed-source typed ESLint passed for all five owning members. Formatting/diff checks and the
  workspace/component/file-size/boundary validators passed. No new React component was introduced.
- Production Playground and ai-server builds passed. Initial-load gzip budgets passed unchanged:
  entry560865/896000, JS1097946/1151000, CSS145890/147000 bytes. Build logs are temporary at
  `/tmp/craftkit-design-{playground,server}-build.log`.
- `node apps/evals/src/browser/free-design.mjs http://127.0.0.1:5194`:20/20, six real kernel builds,
  twelve EN/AR desktop/phone screenshots, same-region follow-up and exact Undo, mouse/keyboard JS
  interaction, no page errors or provider calls. Root inspected Arabic editorial desktop and English
  portfolio phone screenshots. Google-font requests were blocked; local app fonts were used.

## Broader-suite limits and baseline comparison

The unrestricted full builder-ai test attempt was interrupted after revealing failures; it is not a
passing full-suite result. A source-only HEAD baseline was recreated under
`/tmp/craftkit-design-baseline` with the same installed dependencies, without changing the worktree.

The following17 failures reproduce before these changes: kit-seo6, plan-path3, tidy1, widest Pixi
skill-budget1 (7025 vs7000), lessons2, safety1, scene-check2 and script-card1. These suites contain
old kit/ordering assertions alongside real compatibility behavior; this increment does not claim the
whole suite or CI is green. A concurrent-load report-integrity timeout passed19/19 when rerun alone.

## Review and remaining uncertainty

Fresh independent native review found two issues: inconsistent missing-business-data contracts and
Arabic derivation/RTL language selection. Both were repaired and re-reviewed with independent
probes; no open production finding remains. A documentation shadow-token overclaim was corrected to
the actual spacing/type/measure material. Primary reviewed the actual diff and integration evidence.

The original immediate stopped-after-failure incident was not reproduced. Current sequential
behavior is verified, but no production controller root-cause claim is made. Live-model artistry,
design adherence, custom-report numerical fidelity, latency and cost are unmeasured. Custom authored
reports are guided by calculated facts; no universal semantic validator proves every generated
figure/caveat. Full CI, hosted deployment, physical touch and other-device activation are
unverified.
