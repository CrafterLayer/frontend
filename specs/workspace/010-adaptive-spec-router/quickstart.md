# Quickstart: Adaptive Spec Router

## Purpose

Validate the local product experience without credentials, provider calls, repository access, or
deployment.

## Prerequisites

- Node 24 and pnpm 11.23.0, as documented in
  [workspace setup](../../../docs/development/workspace.md).
- Workspace dependencies already installed.

## Run locally

From the repository root:

```bash
pnpm --filter @craftkit/adaptive-spec-router dev
```

Open the local address printed by Vite.

## Product validation scenarios

1. Confirm the local-demo boundary is visible in the first screen.
2. Submit a normal implementation brief and confirm the route has exactly one writer, one reviewer,
   a rationale, and a fallback statement.
3. Change the scenario to `architecture` plus `critical` and confirm the safety lane and review
   expectation escalate while the writer remains single-owner.
4. Open the plan audit, simulate a material revision, and confirm both old review records become
   stale and the plan is not marked ready.
5. Inspect the evidence console for the lease scope, timeline, evidence sources, and release gate.
6. Press reset and confirm the initial deterministic example returns.
7. Repeat primary interactions at 375px and 1440px and with keyboard-only navigation.

## Automated checks

```bash
pnpm --filter @craftkit/adaptive-spec-router lint
pnpm --filter @craftkit/adaptive-spec-router typecheck
pnpm --filter @craftkit/adaptive-spec-router test
pnpm --filter @craftkit/adaptive-spec-router build
pnpm check:components
pnpm build-storybook
```

All commands should exit zero. The app is intentionally not deployed in this feature.
