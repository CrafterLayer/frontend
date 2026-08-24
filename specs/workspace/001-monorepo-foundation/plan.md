# Implementation Plan: Production Monorepo Foundation

**Branch**: `001-monorepo-foundation` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Approved workspace specification in
`specs/workspace/001-monorepo-foundation/spec.md`.

## Summary

Establish a deterministic pnpm 11 and Turborepo 2 workspace for a future large,
multi-application React monorepo. The foundation pins Node and pnpm, provides shared
TypeScript/ESLint/test configuration, validates workspace dependency direction, proves the
required UI contract with one accessible `Button`, exposes it through a central Storybook,
and runs the same aggregate quality contract locally and in GitHub Actions. No product app,
product route, deployment platform, or product-framework decision is introduced.

## Technical Context

**Language/Version**: Node.js 24.19.0 LTS; TypeScript 6.0.3; ECMAScript modules

**Primary Dependencies**: pnpm 11.23.0, Turborepo 2.10.10, React/React DOM 19.2.8,
Vite 8.2.2, Storybook 10.5.10, Vitest 4.1.11, Playwright 1.62.1, ESLint 10.9.0,
Prettier 3.9.6

**Storage**: Repository manifests, one `pnpm-lock.yaml`, source files, and local Turbo
cache; no application data store

**Testing**: Node's built-in test runner for workspace tooling; Vitest and React Testing
Library for components; Storybook Vitest browser tests and axe-backed accessibility checks
in Chromium

**Target Platform**: Developer macOS/Linux and GitHub Actions Linux on Node 24 LTS;
browser-facing UI artifacts target current evergreen browsers

**Project Type**: Private multi-application monorepo foundation with reusable tooling and
UI packages

**Performance Goals**: An unchanged second execution reuses every eligible Turbo task;
workspace validation remains linear in the number of members and dependency edges

**Constraints**: One lockfile; exact toolchain pins; no app-to-app or package-to-app
dependency; internal dependencies use `workspace:*`; packages expose intentional exports;
all UI components include implementation/export/story/MDX/test; no product app invented

**Scale/Scope**: Designed for dozens of direct members under `apps/*` and `packages/*`;
this feature creates one tooling-only Storybook app and five private platform/tooling
packages

## Constitution Check

*GATE: Passed before research and re-checked after design.*

| Gate | Result | Evidence |
| --- | --- | --- |
| Spec Kit is the source of truth | PASS | Workspace-scoped artifacts live under `specs/workspace/001-monorepo-foundation/`. |
| React 19 baseline | PASS | React and React DOM are pinned together at 19.2.8; modern JSX and Hooks lint rules are planned. |
| One component per TSX | PASS | The only planned component is `Button/Button.tsx`; stories and tests do not declare sibling production components. |
| Complete UI delivery | PASS | The component matrix below includes implementation, local export, typed story, MDX, behavior test, and accessibility evidence. |
| Evidence-based quality | PASS | Narrow, package, Storybook, aggregate, frozen-install, cache, and CI checks are defined. |
| Deliberate delegation | PASS | Implementation may be split only between path-disjoint workspace-tooling, UI/Storybook, and root-integration ownership. |
| Commit integrity | PASS | No automatic commit is planned; any later message is generated from the verified diff. |
| Monorepo scope and direction | PASS | Scope is `workspace`; the dependency graph is explicit and acyclic. |

### Post-Design Re-check

All gates still pass. The contracts define each boundary failure, the UI artifact set, and
the verification outcomes. No exception to the constitution is required.

## Scope, Ownership, and Dependency Direction

### Affected Members

| Member | Kind | Owner and responsibility | Direct dependencies |
| --- | --- | --- | --- |
| `@craftkit/storybook` | tooling app | One central component catalog and browser story tests | `@craftkit/ui` only |
| `@craftkit/ui` | runtime package | Domain-free React primitives and package public API | React peer dependencies only |
| `@craftkit/eslint-config` | tooling package | Reusable flat ESLint entrypoints | ESLint plugin APIs only |
| `@craftkit/typescript-config` | tooling package | Reusable TypeScript JSON entrypoints | none |
| `@craftkit/test-config` | tooling package | Shared Vitest React/browser helpers and setup | Vitest/Vite test APIs only |
| `@craftkit/workspace-tools` | tooling package | Stable workspace and component-contract validation | Node standard library only |

The only runtime edge is `storybook -> ui`. Tooling packages are consumed by manifests and
configuration files, never by product runtime code. No package imports an app, no app imports
another app, and all internal manifest edges use `workspace:*`.

### File Ownership

- Root owns workspace manifests, task graph, formatting, aggregate commands, CI, ADRs,
  shared architecture documentation, and lockfile.
- `packages/workspace-tools` owns discovery, validation, CLIs, fixtures, and validator tests.
- `packages/ui` owns the `Button` public API and its complete component artifacts.
- `apps/storybook` owns the central Storybook runtime and Storybook browser-test project.
- Each config package owns only its declared configuration entrypoints and contract tests.

### Public API and Compatibility

- `@craftkit/ui` exports only `.` and `./styles.css`; deep imports remain unsupported.
- Tooling packages expose named configuration subpaths through `package.json#exports`.
- This is the first workspace implementation, so there is no source migration. Future
  package renames or export removals require a separate compatibility plan.
- All created members remain `private: true`; package publication and Changesets are
  explicitly deferred until a release strategy is approved.

## Component Artifact Matrix

| Component | Implementation/export | Story states and play | Authored docs | Behavior/a11y test | Owner |
| --- | --- | --- | --- | --- | --- |
| `Button` | `packages/ui/src/components/Button/Button.tsx` and `index.ts` | Default, secondary, disabled, loading, full-width, and click interaction in `Button.stories.tsx` | Purpose, API, variants, keyboard, responsive/RTL/theme, usage, and limitations in `Button.docs.mdx` | Accessible name, click, keyboard, disabled/loading semantics in `Button.test.tsx`; axe story checks fail CI on violations | `@craftkit/ui` |

## Build, Cache, CI, and Deployment Impact

- Turbo owns package task orchestration. Build tasks depend on upstream builds and cache
  `dist/**`; Storybook build depends on package builds and caches `storybook-static/**`.
- Lint, typecheck, unit tests, and workspace validator tests are cacheable. Development,
  watch, and Storybook dev tasks are persistent and uncached.
- Custom task inputs preserve `$TURBO_DEFAULT$`; variables that affect artifacts must be
  declared in `env`, while secrets are never committed or cached.
- GitHub Actions uses the exact Node/pnpm versions, a frozen lockfile, read-only default
  permissions, concurrency cancellation, and the root `verify` contract.
- No deployment target or remote cache is enabled. Adding either requires separate secret,
  trust-boundary, and rollback decisions.

## Rollout and Rollback

Roll out as one workspace-foundation change because no product deployable exists. Validate
the generated lockfile with a second frozen installation, then run the full graph twice to
prove cache behavior. Rollback is removal of the new workspace/tooling members and manifests;
there is no data migration or remote state. Do not partially keep a lockfile whose package
manager pin has been rolled back.

## Verification Strategy

### Narrow

```bash
pnpm --filter @craftkit/workspace-tools test
pnpm --filter @craftkit/ui lint
pnpm --filter @craftkit/ui typecheck
pnpm --filter @craftkit/ui test
pnpm --filter @craftkit/storybook build-storybook
```

### Workspace and affected graph

```bash
pnpm check:workspace
pnpm check:components
pnpm verify
pnpm exec turbo run lint typecheck test build build-storybook --dry=json
pnpm verify
```

The second unchanged aggregate run must show cache hits for eligible Turbo tasks. GitHub
execution remains unverified until the repository has a configured remote and workflow run.

## Project Structure

### Documentation (this feature)

```text
specs/workspace/001-monorepo-foundation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── component-contract.md
│   └── workspace-validation.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── storybook/
    ├── .storybook/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    └── README.md
packages/
├── eslint-config/
├── test-config/
├── typescript-config/
├── ui/
│   └── src/components/Button/
└── workspace-tools/
    ├── src/
    └── test/
.github/
├── dependabot.yml
└── workflows/ci.yml
docs/
├── architecture/decisions/0001-select-pnpm-turborepo.md
├── architecture/monorepo.md
├── development/workspace.md
└── testing/strategy.md
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
turbo.json
eslint.config.mjs
prettier.config.mjs
tsconfig.json
.node-version
.nvmrc
```

**Structure Decision**: Use direct workspace members so pnpm and Turbo can identify clear
ownership boundaries. The Storybook member is tooling, not a product application. Shared
config packages are real reusable contracts; product-framework and deployment files are
absent by design.

## Complexity Tracking

No constitution violations require justification.
