# Monorepo Architecture

**Status:** Current and enforced by the pnpm/Turborepo foundation.

**Decision:** [ADR 0001](decisions/0001-select-pnpm-turborepo.md)

## Workspace Shape

```text
apps/
├── README.md
├── storybook/                    # one tooling-only component catalog
└── <future-product-app>/
    ├── README.md
    ├── package.json
    ├── turbo.json                # only for framework-specific output overrides
    └── src/
packages/
├── eslint-config/                # shared flat ESLint contract
├── test-config/                  # shared Vitest/Storybook test contract
├── typescript-config/            # shared strict TypeScript contract
├── ui/                           # domain-free React primitives
├── workspace-tools/              # stable boundary/component validation
└── <future-explicit-contract>/
specs/
├── apps/<app>/<feature>/
├── packages/<package>/<feature>/
└── workspace/<feature>/
```

pnpm discovers only direct `apps/*` and `packages/*` members. Nested fixtures, generated output, and
component folders are not workspace members. One committed `pnpm-lock.yaml` represents the complete
graph.

## Toolchain Contract

- Node 24.19.0 is the local/CI pin; patched Node 24 from 24.15 is accepted by engines.
- pnpm 11.23.0 is exact in `packageManager` and `devEngines.packageManager`.
- Turborepo 2.10.10 is a root dev dependency and owns task scheduling/cache.
- Workspace settings live in `pnpm-workspace.yaml`, not `package.json#pnpm`.
- Shared external versions use the workspace catalog. Every internal manifest dependency uses
  `workspace:*` so it can never fall back to a registry package.
- All current packages and apps are private. Publication requires a separate decision.

## Boundary Contract

| Owner               | May depend on                                           | Must not depend on                             |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `apps/<app>`        | Package public APIs and its own features                | Another app or package internals               |
| `apps/storybook`    | `@craftkit/ui` and tooling/config packages              | Product app source or runtime state            |
| `packages/ui`       | React peers and approved low-level domain-free packages | Apps, routes, stores, DTOs, or feature queries |
| Domain package      | Lower-level public contracts                            | Apps or unrelated product features             |
| Integration package | Transport/runtime foundations                           | Apps or UI composition                         |
| Tooling package     | Tool APIs and workspace config contracts                | Product runtime code                           |

All package public APIs are declared in `package.json#exports`. A path into another member's `src`
tree is unsupported unless that exact subpath is intentionally exported. The internal member graph
remains acyclic.

## Enforcement

The stable repository-owned gates are:

```bash
pnpm check:workspace
pnpm check:components
```

`check:workspace` validates names, privacy, `workspace:*`, missing targets, app-to-app and
package-to-app edges, cycles, and package exports. `check:components` requires every discovered UI
folder to contain implementation, local export, typed story, authored MDX, and behavior test. Both
have positive and negative fixture tests in `packages/workspace-tools`.

```bash
pnpm check:boundaries
```

Turbo Boundaries adds undeclared-dependency and cross-package-path defense. Because that surface is
experimental, it supplements rather than replaces the stable manifest validator. TypeScript config,
package exports, ESLint, reviews, and tests provide additional layers.

## Task and Cache Graph

- `build` waits for upstream builds and caches `dist/**`.
- `build-storybook` waits for upstream builds and caches `storybook-static/**`.
- `lint`, `typecheck`, tests, and coverage use source/config inputs and cache deterministic
  completion/logs; coverage output is declared where generated.
- `dev`, `test:watch`, and Storybook development are persistent and uncached.
- Custom inputs always retain `$TURBO_DEFAULT$`.
- Output-affecting environment variables belong in task `env`; pass-through secrets are never
  committed or written into cache artifacts.
- The repository intentionally leaves `cacheDir` unset so current Turbo can share local cache across
  parallel Git worktrees.

Framework-specific members extend the root task contract only for real differences. For example, a
future Next app can declare its own build outputs; the root does not assume that framework today.

## Supply-Chain Policy

pnpm rejects workspace cycles, incompatible engines/peers, unreviewed dependency lifecycle scripts,
releases inside the configured age window, trust downgrades, and exotic transitive sources.
`allowBuilds` contains only individually reviewed packages. A frozen lockfile is mandatory in CI.

Dependency update automation groups React, Storybook, Vitest, lint, toolchain, and GitHub Actions
updates so coupled versions are reviewed together. It opens pull requests; it does not merge or
publish automatically.

## When to Create a Package

Extract code into a package only when all of these are known:

1. at least two credible consumers or a clear platform boundary exist;
2. one team or workspace concern owns the contract;
3. the public API is smaller and more stable than the implementation;
4. versioning and compatibility impact are understood; and
5. dependency direction stays acyclic.

Do not create generic `shared`, `common`, or `utils` packages for unrelated leftovers. Keep product
code feature-local until a real reusable contract emerges.

## Adding and Verifying Members

Follow [workspace development](../development/workspace.md). The minimum gate order is changed-file
format/static checks, owner tests/types/build, direct consumers, affected workspace, then
`pnpm verify` for cross-cutting or release work.

Workspace-wide specifications live under `specs/workspace`; app/package features use their
corresponding scoped directory. A product app must select its framework and deployment in an
app-scoped plan rather than modifying this root contract implicitly.

## Staleness Condition

Update this document and an ADR when pnpm/Turbo majors change, member discovery changes, boundary
direction changes, a remote cache is approved, or public versioning/publishing is introduced.
