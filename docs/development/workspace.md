# Workspace Development

This is the executable setup guide for the pnpm and Turborepo foundation selected by
[ADR 0001](../architecture/decisions/0001-select-pnpm-turborepo.md).

## Prerequisites

| Tool     | Required                                                   | Purpose                                 |
| -------- | ---------------------------------------------------------- | --------------------------------------- |
| Node.js  | 24.19.0 locally; engine accepts patched Node 24 from 24.15 | Runtime for workspace tooling           |
| pnpm     | exactly 11.23.0                                            | Dependency graph and workspace commands |
| Git      | current supported release                                  | Source and Turbo affected history       |
| Chromium | Playwright-managed version                                 | Storybook browser/a11y tests            |

Use any trusted Node version manager to select the value in `.node-version` or `.nvmrc`. Then
install the pinned pnpm version if it is not already available:

```bash
npm install --global pnpm@11.23.0
node --version
pnpm --version
```

Corepack can be a local convenience, but it is not the canonical install path: newer Node lines no
longer bundle it. CI uses the official `pnpm/setup` action, which installs the exact pnpm and Node
releases from the checked-in pins.

## First setup

```bash
pnpm install
pnpm exec playwright install chromium
pnpm verify
```

The first command creates or validates the one root lockfile. pnpm settings live in
`pnpm-workspace.yaml`; do not move them into `package.json#pnpm` or add `.npmrc` unless a real
registry/auth requirement exists. Never commit registry credentials.

## Root commands

| Command                 | Scope and expected result                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`              | Runs real member development tasks; persistent tasks are uncached         |
| `pnpm build`            | Builds every member with a build task and restores valid Turbo outputs    |
| `pnpm lint`             | Runs member ESLint tasks through the one root flat config                 |
| `pnpm typecheck`        | Runs member TypeScript tasks with shared strict configs                   |
| `pnpm test`             | Runs member tests without coverage output                                 |
| `pnpm test:coverage`    | Runs coverage-enabled member tests and enforces thresholds                |
| `pnpm storybook`        | Starts the central catalog at its documented local address                |
| `pnpm test:storybook`   | Runs Storybook interaction and axe tests in headless Chromium             |
| `pnpm build-storybook`  | Produces the static catalog under `apps/storybook/storybook-static`       |
| `pnpm check:workspace`  | Validates identities, ranges, direction, exports, privacy, and cycles     |
| `pnpm check:components` | Validates every discovered component's five required artifacts            |
| `pnpm check:bundles`    | Builds query and routing foundations and enforces their raw entry budgets |
| `pnpm check:boundaries` | Runs Turbo's graph/path checks as defense in depth                        |
| `pnpm check:graph`      | Prints the planned Turbo graph as JSON without executing it               |
| `pnpm verify`           | Runs the full local/CI quality contract; must pass before handoff         |

Run one owner narrowly with a package filter:

```bash
pnpm --filter @craftkit/ui test
pnpm --filter @craftkit/ui typecheck
pnpm --filter @craftkit/query test:coverage
pnpm --filter @craftkit/routing build
pnpm --filter @craftkit/storybook build-storybook
pnpm --filter @craftkit/workspace-tools test
```

## Adding a member

1. Create exactly one direct directory at `apps/<name>` or `packages/<name>`.
2. Add a unique, scoped `package.json#name` and keep the member private.
3. Apps depend only on package public APIs. Packages never depend on apps.
4. Use `workspace:*` for every internal dependency and `catalog:` for an aligned external dependency
   listed in `pnpm-workspace.yaml`.
5. Packages declare explicit `exports`; consumers do not import another member's `src`.
6. Extend the appropriate `@craftkit/typescript-config` entrypoint and use root ESLint.
7. Add only real Turbo scripts and outputs. A member without a build does not add a no-op build
   merely for symmetry.
8. Add the member README, tests, and component artifacts when applicable.
9. Run `pnpm install`, both contract checks, the owning package checks, then `pnpm verify`.

Product apps additionally require an app-scoped spec and ADR before choosing a framework, router,
deployment target, or framework-specific Turbo output.

When routing, query prefetch, lazy components, or bundle ownership changes, load
`.specify/agents/rules/routing-performance.md` or invoke the generated
`speckit.routing-performance.optimize` operation. Verify both route-code and destination-data
prefetch and inspect emitted production artifacts; a source-level dynamic import is not enough
evidence by itself.

## Dependency security

The workspace rejects dependency cycles, peer mismatches, unreviewed lifecycle builds, very new
releases inside the minimum-age window, trust downgrades, and exotic transitive sources. If
installation reports a required build script:

1. inspect the exact package, version, source, and lifecycle command;
2. confirm why the dependency needs installation-time execution;
3. add the narrow package entry to `allowBuilds` in `pnpm-workspace.yaml` only after review;
4. regenerate the lockfile and rerun the frozen install; and
5. record any non-obvious exception in the owning ADR or feature plan.

Never enable a blanket “allow all builds” switch. A trust-policy exclusion also requires explicit
approval, an exact package version, documented evidence, and a removal condition.

## Cache behavior

Turbo caches completed deterministic tasks, not development servers or watchers. Build outputs and
Storybook static output are declared explicitly. When custom inputs are added, retain
`$TURBO_DEFAULT$`; otherwise ignored files and normal package inputs can silently drop out of the
hash. Output-affecting environment variables belong in Turbo `env`. Credentials belong only in the
runtime secret store and never in cache inputs or outputs.

To inspect cache behavior:

```bash
pnpm check:graph
pnpm verify
pnpm verify
```

The unchanged second run should report cache hits for eligible Turbo tasks. The repository does not
configure a remote cache; selecting one requires an explicit trust and credential plan.

## Troubleshooting

- **Engine mismatch:** select Node 24.19.0 and pnpm 11.23.0, then retry.
- **Frozen lockfile failure:** do not bypass it in CI. Use the pinned pnpm locally, run
  `pnpm install`, review the lockfile diff, and retry frozen installation.
- **Workspace range failure:** replace registry-like internal ranges with `workspace:*`.
- **Lifecycle build rejection:** follow the dependency-security review above.
- **Storybook browser failure:** install the managed Chromium release with
  `pnpm exec playwright install chromium`.
- **Suspicious cache result:** run the affected task with `--force`, inspect its declared
  inputs/outputs, and correct the graph rather than disabling caching globally.
