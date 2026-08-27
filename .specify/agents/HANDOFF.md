# Active Work Handoff

**Status:** ready for local user evaluation — all implementation and automated gates for Adaptive
Spec Router are complete; the manual responsive browser smoke remains pending.

**Updated:** 2026-08-27

**Scope:** `specs/workspace/010-adaptive-spec-router` and
`apps/adaptive-spec-router`.

**Active Spec:** `specs/workspace/010-adaptive-spec-router/spec.md`.

## Objective

Evaluate a private, deterministic product dashboard for explainable Claude/Codex task routing before
any decision to extract, connect providers, create a public repository, or publish. This feature is
not an agent runner and must not create a live provider, MCP, source-code, credential, or repository
integration.

## Completed

- Created the isolated `@craftkit/adaptive-spec-router` Vite React application with an explicit
  local-demo boundary and no external side effects.
- Default operation is **Codex-native**: it keeps Codex work in Codex and never starts Claude
  automatically. **Claude-adaptive** is an explicit user-selected, one-way evaluation mode.
- Added deterministic model-aware routes: Luna/Terra/Sol and Sonnet/Opus, clear provider/model
  unavailability fallback, one designated writer, and an independent reviewer.
- Added a frozen plan revision audit that requires current Claude and Codex reviews before a writer
  lease becomes active. Material revisions make old reviews stale; typed findings expose severity,
  requirement, and next action.
- Added an illustrative evidence console, active/reserved/no writer-lease states, release-gate
  safety, responsive styling, reset behavior, keyboard-visible controls, component stories, MDX
  documentation, and behavior tests.
- Created ADR 0005 and complete Spec Kit artifacts under
  `specs/workspace/010-adaptive-spec-router/`.
- Independent routing and governance reviews were completed. Their accepted findings were repaired,
  including the final case where an invalid scenario could otherwise keep a release state waiting.

## Verification

- `pnpm --filter @craftkit/adaptive-spec-router lint` passed.
- `pnpm --filter @craftkit/adaptive-spec-router typecheck` passed.
- `pnpm --filter @craftkit/adaptive-spec-router test` passed: 31 tests in 7 files.
- `pnpm --filter @craftkit/adaptive-spec-router build` passed: 66.55 kB gzip JavaScript.
- Direct central Storybook build passed. The catalog retains its existing generic large-chunk warning;
  it is not a feature build failure.
- `pnpm check:components`, `pnpm check:workspace`, and `pnpm check:boundaries` passed.
- `git diff --check` passed.
- The local Vite HTTP response was smoke-checked. In-app browser automation was unavailable in this
  environment, so it is not represented as an interaction or responsive verification.

## Incomplete

- T021 only: manually inspect the local dashboard at **375px** and **1440px**. Apply a scenario,
  create a material plan revision, and use **Reset demo**. Verify that critical information remains
  reachable and labelled in both widths.
- Obtain user feedback before authorizing any extraction, licensing, public GitHub repository,
  publishing, deployment, credentials, live provider adapter, persistence, or multi-user work.

## Decisions / Boundaries

- No commit, push, deployment, or publication is authorized.
- The interface displays policy examples only; it does not claim model availability or provider
  telemetry is live.
- A fallback must be visibly reported; no silent downgrade is allowed.
- A single bounded writer lease is required. Reviewers remain independent and read-only in the
  product model.
- The existing B3c worktree and any separately running Claude-to-Codex migration are out of scope
  for this feature follow-up. Preserve them and use their own feature artifacts for continuation.

## Next Exact Action

Run:

```bash
pnpm --filter @craftkit/adaptive-spec-router dev
```

At 375px and 1440px, test the default Codex-native route, explicitly select Claude-adaptive for a
critical route, change the plan revision to observe stale reviews, and reset the demo. Then capture
the user's product feedback and create a separate approved specification for any live integration or
public release phase.

## Recovery

The product can be reconstructed from its spec, plan, contracts, tasks, ADR 0005, app README, and
feature-local source. No external system state exists to recover. Resume at T021; do not re-run
implementation work unless the user reports a product defect.

## Parallel Claude-to-Codex Transport Cutover

- The user-scoped official `codex@openai-codex` plugin v1.0.6 is installed, enabled, authenticated,
  and ready. A real background smoke exposed tracked phases and returned the expected result without
  touching files; fresh Claude `/codex:setup` and `/codex:status` commands also passed.
- `.mcp.json` and `.specify/agents/bridges/codex-async/` were removed after the in-flight async and
  synchronous results were delivered. New work must use `/codex:rescue --background --fresh`, with
  user-invoked `/codex:status` and `/codex:result`; progress is on demand, not an unsolicited feed.
- A Claude session opened before the cutover still has the retired MCP tools in memory and may keep
  showing `Tinkering...`. Let its current call finish, then close that session and start a new one;
  do not kill an in-flight write task merely to reload transport.
- A user-scoped generic `codex` MCP server remains available for other projects but is failed and is
  explicitly forbidden by this workspace's routing. Do not remove it globally without separate
  authorization.
- Regenerating all integration-native workspace skills remains deferred: the forced Spec Kit
  recomposition would overwrite unrelated modified generated skills. The canonical extension,
  collaboration rule, runbook, `AGENTS.md`, and `CLAUDE.md` are updated; do not hand-edit generated
  skill folders.
