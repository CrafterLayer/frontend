# Adaptive Spec Router

Adaptive Spec Router is a private local product trial for an explainable multi-model development
workflow. It lets a developer compose a task scenario, inspect a deterministic writer/reviewer
recommendation, audit two plan reviews against one frozen revision, and view a one-writer evidence
run.

## Product boundary

This app is deliberately a local deterministic demonstration. It does not authenticate a provider,
send prompts, call Claude/Codex/MCP, read source files, start agents, persist data, modify Git, or
publish anything. The displayed route and evidence are illustrative policy data.

The default entry is **Codex-native**: it never starts Claude automatically. Select
**Claude-adaptive** in the local scenario only when you deliberately want to evaluate the one-way
Claude-to-Codex coordination policy.

## Run locally

From the workspace root:

```bash
pnpm --filter @craftkit/adaptive-spec-router dev
```

## Validate

```bash
pnpm --filter @craftkit/adaptive-spec-router lint
pnpm --filter @craftkit/adaptive-spec-router typecheck
pnpm --filter @craftkit/adaptive-spec-router test
pnpm --filter @craftkit/adaptive-spec-router build
```

The central Storybook catalog discovers the component stories from this app. Run
`pnpm build-storybook` from the workspace root for catalog evidence.

Before proposing extraction or publication, manually smoke the dashboard at 375px and 1440px: apply
a scenario, verify a material plan revision invalidates old reviews, and use **Reset demo**.

## Ownership

The app owns `features/adaptive-router` and imports no other application. It has no shared package,
backend, deployment target, account system, or persistence layer. The decision is recorded in
[ADR 0005](../../docs/architecture/decisions/0005-adaptive-spec-router-local-demo.md) and the
feature artifacts are under `specs/workspace/010-adaptive-spec-router/`.

Do not extract, license, publish, or connect this app to a provider until the user explicitly
chooses the next product phase.
