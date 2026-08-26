# Quickstart Validation: Monorepo Foundation

## Prerequisites

- Node 24.19.0 (the repository also accepts later security patches in Node 24)
- pnpm 11.23.0 selected from the root package-manager pin
- Playwright Chromium installed for Storybook browser tests

## Clean setup

```bash
pnpm install
pnpm exec playwright install chromium
pnpm verify
```

Expected outcome: the frozen workspace model, component contract, lint, types, Node tests, React
tests, Storybook browser tests, UI build, and static Storybook build all pass.

## Boundary contract scenarios

```bash
pnpm --filter @craftkit/workspace-tools test
pnpm check:workspace
pnpm check:components
```

Expected outcome: fixture tests prove that duplicate names, missing workspace targets, invalid
dependency direction, cycles, and incomplete component folders fail with actionable paths. The real
repository passes both validators.

## UI contract scenario

```bash
pnpm --filter @craftkit/ui test
pnpm --filter @craftkit/ui build
pnpm --filter @craftkit/storybook test
pnpm --filter @craftkit/storybook build-storybook
```

Expected outcome: Button behavior and keyboard semantics pass, rendered Storybook stories have no
configured accessibility violation, the UI package builds its public exports, and the static catalog
contains both the stories and authored MDX page.

## Deterministic install and cache scenario

```bash
pnpm install --frozen-lockfile
pnpm exec turbo run lint typecheck test build build-storybook --dry=json
pnpm verify
pnpm verify
```

Expected outcome: the frozen install makes no lockfile change. The dry-run graph contains the
expected member tasks. On the unchanged second run, eligible Turbo tasks report local cache hits;
`dev`, watch, and Storybook development remain uncached persistent tasks.

## CI parity

GitHub Actions calls `pnpm verify` after the same pinned install. A local pass proves command
parity, but the hosted workflow is considered verified only after a real GitHub run.

## Product-scope guard

Inspect `apps/`: only the tooling catalog may exist. No product app, route, data client,
authentication flow, deployment target, or product framework belongs to this feature.
