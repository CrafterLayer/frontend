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
