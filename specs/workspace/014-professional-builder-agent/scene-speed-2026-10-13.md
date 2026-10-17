# Scene initialization and server latency increment

Scope: `packages/builder/ai`, `packages/builder/editor` headless wire and test-only exports, and
`apps/ai-server`, the Playground's existing section Redo model, and offline `apps/evals` scene QA.
User request: faster mural builds through reusable complete initialization scripts, with a strong AI
server. Existing feature 014 contracts remain the source of truth.

## Specification and clarification

- SP-001: A ready backdrop named by a section writer initializes its full section locally:
  responsive scene host, contract title and required copy, primary action where appropriate, tested
  scene code and declared scene settings. Reuse the existing catalog; preserve an explicitly written
  tree, custom scenes and exact section ownership.
- SP-002: An explicit initialization-only brief uses lower reasoning and a bounded output and
  execution budget. General creative advice must not be mistaken for that brief. Preserve explicitly
  requested deep effort and custom-scene reasoning/output capacity.
- SP-003: Cache staggering must wait for actual backend activity, with bounded cancellation and
  failure release; a synthetic waiting narration cannot prove that a prefix is cached.
- SP-004: Focused tests and a repeatable offline measurement prove local initialization and policy
  behavior. Report payload and simulated scheduling gains separately from real provider latency and
  visual quality. No paid calls are implied.

The repository uses Arabic `جدارية` for Pixi murals. That existing creative lane, grounded in the
repository and IDE context, is the implementation target. Generic ready scenes remain choices; do
not replace a named bespoke composition by a guessed abstract backdrop.

## Plan

Builder AI owns a focused initializer at the existing `completeStep` seam. A compact `@preset:<id>`
answer can omit markup because the initialized region uses the validated page contract. Existing
writers can still supply their own tree and CSS. The guard permits declared `jsMeta`/`jsParams` only
on the captured region and only with Free code on; recovery and probes retain the settings. A small
data-only public wire helper identifies an explicit init-only brief shared with the server, without
importing the preset catalog into the server wire graph.

The Playground's section Redo preserves the newly recorded scene settings and checks their current
values before restoring them. Evals owns isolated generated-runtime browser fixtures, loading the
real initializer and page CSS through the public Builder test-only facade. The server owns
effort/output selection and real stream readiness signals. Independent worker leases separate app
changes from initializer files; the primary owns integration, shared exports, guard/recovery, specs,
measurement and final verification. No dependency, schema-version, UI, deployment or saved-document
migration. New code stays in focused modules. Rollback removes the new creation hints/policy;
existing stored scene code/settings remain readable.

## Requirements checklist and analysis

- [x] Existing command door, ownership, Free-code boundary and custom scenes remain enforced.
- [x] Full initialization is grounded in the approved contract, with responsive readable content.
- [x] Exact initialization-only detection and ordinary/deep-effort negatives are specified.
- [x] Cache readiness, cancellation, missing stream signals and failures have testable outcomes.
- [x] Module/package checks, headless facade graph and reproducible measurement are scoped.
- [x] No new component, external mutation, provider spending or dependency admission is needed.

No conflicting requirement or missing blocking product decision was found for this increment.

## Tasks

- [x] SP-T1 Builder AI: complete ready-scene initialization, compact briefing and behavior tests.
- [x] SP-T2 Server: init-only call policy and accurate cache readiness, with regression tests.
- [x] SP-T3 Primary: integrate public wire, fill guard/settings/recovery and real-build tests.
- [x] SP-T4 Primary: offline measurement script, package/consumer verification and docs.
- [x] SP-T5 Independent review, repair findings, convergence and handoff: native review, repairs,
      scoped convergence and continuity are complete. On 2026-10-13 the user accepted local review
      and declined the external CLI review; that runtime gate is waived for this increment and was
      not executed. See canonical T260 and the scoped review exception in [plan.md](plan.md).

Verification and review limits: [local evidence](verification-scene-speed-2026-10-13.md).

## Authorized reliability and visual follow-up — 2026-10-13

The user requested continued work and selected both speed/reliability and open visual repairs
(“1+2”). Scope adds the existing CLI adapter, marketing stylesheet public entry, Builder facade and
Playground static publishing composition. No new UI component, provider call, dependency,
saved-document migration, commit or deployment is required.

### Requirements and plan

- SP-005: A section attempt settles when its deadline or cancellation fires, even when a provider
  violates its cancellation contract. Continue sending the provider the abort signal; preserve
  timeout classification, user Stop precedence, one retry and protection against late application.
  Builder AI owns a small abort-settlement helper and real-build regressions. This robustness gap is
  reproduced locally; it is not identified as the cause of the reported live seven-minute run.
- SP-006: The CLI route carries explicit output caps and per-call reasoning effort to cold and warm
  processes. Warm reuse distinguishes generation settings so init-only caps cannot leak into
  deep/custom calls. Keep the existing sandbox, disabled hooks and tool restrictions. Do not repeat
  an unrelated HTTP 400 as a cache retry or give an already-aged cache pioneer a fresh full wait.
  Known legacy API models without effort support must not receive an unsupported effort field;
  preserve supported modern/deep behavior and the initialization output cap.
- SP-007: Published registered marketing sections retain the same owner stylesheet used by the
  canvas, including dark-slab contrast and responsive comparison rules. Expose the exact stylesheet
  through marketing and Builder public entrypoints, then compose it through the existing static
  publisher rendered-class CSS callback. Detect the owner classes from its stylesheet data so shared
  regions, aliased documents and custom-only pages retain correct per-page inclusion. Renderer stays
  independent of the marketing extension; no reverse dependency or second CSS source is introduced.

Worker write scopes do not overlap: Builder AI helper/integration/tests; AI server CLI adapter and
focused policy/tests; marketing stylesheet export, Builder stylesheet facade and Playground
publisher/tests. The primary owns canonical artifacts, integration, review and verification.
Existing deadline/output overrides and authored scene choices remain supported. Rollback removes the
added helper/env propagation and export composition without changing stored data.

Verification: reproduce the non-cooperative writer deadline and late answers; inspect cold/warm fake
CLI environment/settings; publish a real registered-block page with the real compiler and assert the
missing stylesheet rules. Run focused owner tests, types/lint, consumer build/budgets and workspace
boundary/file-size checks. Continue the user's local-only review instruction; no external CLI
reviewer or live latency/cost result is implied.

### Follow-up tasks

- [x] SP-T6 / T261: Enforce section deadline settlement and test hanging/late providers.
- [x] SP-T7 / T262: Carry compatible generation policy and remove avoidable cache waits/retries.
- [x] SP-T8 / T263: Include marketing layout CSS in published registered-block pages.
- [x] SP-T9 / T264: Review findings, repair, verify and record scoped completion.

Locally complete under the user's continuing local-only review instruction. Exact checks, browser
measurements, current-catalog measurement and limits are recorded in
[follow-up verification](verification-reliability-visual-2026-10-13.md).

## Authorized empty-canvas and request-skills repair — 2026-10-13

The owner reported a 15-minute run that announced completion while the canvas stayed empty, then
requested automatic skill choice and prompt-local selections without the three-skill limit or
persistent chips above chat. Scope: Builder AI agent/plan/intent/skills, AI server request lifetime,
and the existing Playground agent and provider configuration. Preserve all prior local changes.

- SP-008: Ordinary edits and each page-planning step share one cumulative deadline across proposal,
  repair and retries. Stop and expiration settle even a non-cooperative provider; late results never
  apply or emit live planning callbacks. Forward caller budgets through both Plan mode and direct
  Build planning; distinguish user cancellation from timeout and retain bespoke creative capacity.
- SP-009: The server bounds a complete generation call, including stream consumption and fallback,
  rather than only receipt of headers or each retry. Propagate abort and avoid stacked SDK retries;
  use configurable budgets and fake providers for verification, without paid generation.
- SP-010: Explicit scene creation on a blank page takes the build path despite later edit verbs in
  the same brief. Existing content and selected-node edits retain ownership. Creation plans must
  produce meaningful scene content, including after repair/salvage; root language/direction/CSS
  alone cannot report creation success. Ordinary metadata edits remain valid. Partial Auto edits
  disclose retained/dropped commands, and actual application events advance progress accurately.
- SP-011: Choose enabled Builder skills automatically from the current request and existing
  metadata, within the engine's skill/token budgets. Optional slash selections stay inline in that
  prompt and travel with queued requests; remove the UI-only three-selection cap and persistent
  chips. Prior requests do not leak explicit selections. Do not load unrelated filesystem skills or
  all skill bodies, add a paid routing call, or weaken skill trust/policy limits.

Bounded write leases: engine worker owns agent/plan modules and their tests; server worker owns
AI-server lifetime/configuration and tests; UI worker owns existing Playground agent UI/controller
and provider configuration; primary owns intent/skill integration, public exports, canonical
artifacts and final verification. Extract oversized modules before growing them; no baseline
increase, dependency, new component, saved-data migration, external review, commit or deployment.

Verify the exact failures first: hung proposal/repair, total deadline, stalled SSE, metadata-only
creation including salvage, legitimate RTL edits, empty-canvas Arabic creative routing, actual Auto
application events, more than three inline skills and queued prompt isolation. Then run affected
owner/consumer tests, types, lint, browser/UI evidence and workspace/size/build gates. Native fresh
independent review follows integration; the user's local-only review instruction continues to apply.
Local reproductions identify concrete defects, not measured live provider latency.

- [x] SP-T10 / T265: Cumulative edit/planning deadline and meaningful scene-creation validation.
- [x] SP-T11 / T266: Complete server-call lifetime and bounded provider retry behavior.
- [x] SP-T12 / T267: Request-local inline skill UX, honest partial edits and accurate progress.
- [x] SP-T13 / T268: Empty-canvas creative routing and automatic skill integration.
- [x] SP-T14 / T269: Independent local review, repair, verification and handoff.

Locally complete on 2026-10-14, including convergence repair T270. Exact checks and limitations:
[empty-canvas and request-skills verification](verification-empty-canvas-skills-2026-10-13.md).
