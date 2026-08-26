# Research: Production Monorepo Foundation

**Verified:** 2026-08-24

## Decision 1: pnpm 11.23.0 owns dependency installation

**Decision:** Pin `pnpm@11.23.0` exactly in both `packageManager` and `devEngines.packageManager`.
Store workspace settings in `pnpm-workspace.yaml`, use one shared lockfile, `workspace:*` for
internal edges, and catalog references for aligned external versions.

**Rationale:** pnpm provides strict workspace-local dependency resolution and a compact
single-lockfile model. Version 11.23.0 is the current stable release; pnpm 12 is still a release
candidate. pnpm 11 requires Node 22 or newer and places project settings in the workspace YAML
rather than `package.json#pnpm`.

**Alternatives considered:** npm workspaces lack pnpm's explicit workspace protocol and strict
workspace settings; Yarn Berry adds Plug'n'Play and release workflow choices that are not needed
here; pnpm 12 is not stable.

**Sources:** [pnpm workspaces](https://pnpm.io/workspaces),
[pnpm settings](https://pnpm.io/settings), and
[pnpm 11.23.0 release](https://github.com/pnpm/pnpm/releases/tag/v11.23.0).

## Decision 2: Turborepo 2.10.10 owns the task graph

**Decision:** Pin `turbo@2.10.10` at the root. Keep the root graph framework-neutral, declare real
outputs, preserve `$TURBO_DEFAULT$` when adding inputs, and keep watch/dev tasks persistent and
uncached. Do not set a custom `cacheDir`.

**Rationale:** Turbo provides package-aware parallel execution, affected execution, local cache
reuse, and framework-specific per-member overrides without forcing an application framework. The
default cache location can be shared across Git worktrees by current Turbo.

**Alternatives considered:** Nx provides broader generators and a larger governance surface than
this empty product workspace needs; plain pnpm recursive scripts do not model outputs and cache
invalidation; custom orchestration would duplicate existing tooling.

**Sources:** [Turbo 2.10.10 release](https://github.com/vercel/turborepo/releases/tag/v2.10.10),
[configuration reference](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/reference/configuration.mdx),
and
[caching guide](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/crafting-your-repository/caching.mdx).

## Decision 3: Node 24.19.0 LTS is the workspace runtime baseline

**Decision:** Pin Node 24.19.0 in `.node-version` and `.nvmrc`; require Node `>=24.15.0 <25` in the
root engine contract.

**Rationale:** Node 24 is the current LTS line and satisfies pnpm, Vite, Storybook, and Vitest. The
exact local pin makes developer and CI resolution deterministic while the engine range permits
security-patched Node 24 releases.

**Alternatives considered:** Node 22.19.0 is installed and supported, but is an older LTS line for a
new long-lived foundation. Node 25 is not an LTS baseline.

**Source:** [Node release schedule](https://nodejs.org/en/about/previous-releases).

## Decision 4: React 19.2.8 with TypeScript 6.0.3

**Decision:** Pin React and React DOM exactly at 19.2.8. Pin TypeScript 6.0.3 and the corresponding
React/Node types.

**Rationale:** 19.2.8 is the current patched React 19.2 line required by the constitution.
TypeScript 6 has the stable programmatic API required by current lint and build tooling; TypeScript
7.0's native preview does not yet provide the complete ecosystem API expected by tools such as
typescript-eslint.

**Alternatives considered:** React 20 is not the project baseline. TypeScript 7.0.2 is newer but not
yet the safe toolchain choice for this workspace.

**Sources:** [React versions](https://react.dev/versions),
[TypeScript 6 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/),
and
[TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

## Decision 5: ESLint 10, recommended Hooks rules, and Prettier

**Decision:** Use ESLint 10.9.0 flat configuration, typescript-eslint 8.67.0,
`eslint-plugin-react-hooks` 7.1.1 stable recommended rules, Storybook's current lint plugin, and
Prettier 3.9.6. Do not install stale React/JSX plugins with incompatible ESLint peers.

**Rationale:** These versions support the chosen TypeScript and React lines without peer overrides.
The stable Hooks preset includes supported compiler-diagnostic rules without opting CI into
experimental lint behavior. Formatting remains separate and deterministic.

**Alternatives considered:** ESLint 9 allows older JSX a11y plugins, but the actual UI accessibility
gate is stronger as a rendered Storybook axe test. Peer overrides were rejected because they hide
ecosystem incompatibility.

**Sources:** [React Hooks lint reference](https://react.dev/reference/eslint-plugin-react-hooks) and
[typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/).

## Decision 6: Vite/Vitest and one central Storybook

**Decision:** Use Vite 8.2.2 only for the UI library and Storybook tooling member, Vitest 4.1.11 for
component tests, and Storybook 10.5.10 React-Vite with docs, a11y, and Vitest addons. Browser story
tests use Playwright Chromium and configure a11y violations as errors. Product apps retain the right
to select their own approved framework/bundler.

**Rationale:** The combination provides fast library builds, realistic React component tests,
authored MDX, interaction tests, and automated accessibility evidence without creating a fake
product app. Storybook officially supports React-Vite and integrates Vitest browser mode.

**Alternatives considered:** A root-only Storybook has weaker package ownership; separate Storybooks
duplicate catalog configuration; Jest adds a second testing ecosystem; choosing Next.js or another
app framework now would violate scope.

**Sources:**
[Storybook React-Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite/),
[Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon/index),
[accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing), and
[Vitest browser mode](https://vitest.dev/guide/browser/).

## Decision 7: Stable custom validation plus Turbo Boundaries as defense in depth

**Decision:** Make `@craftkit/workspace-tools` the authoritative manifest and component contract
gate. It validates direct members and tests positive/negative fixtures. Run `turbo boundaries`
separately as defense in depth, but do not make experimental tagging the only enforcement layer.

**Rationale:** Manifest validation can produce project-specific actionable failures and is fully
testable without depending on experimental behavior. Turbo still adds undeclared dependency and
cross-package path checks from the actual graph.

**Alternatives considered:** ESLint import rules alone cannot validate manifest ranges or package
direction; Turbo Boundaries alone is experimental; manual review does not scale.

## Decision 8: Supply-chain checks are strict and explicit

**Decision:** Enable strict peer dependencies, cycle rejection, strict dependency-build approval, a
one-day minimum release age, no-downgrade trust policy, and exotic subdependency blocking. Add
`allowBuilds` only for reviewed packages whose installation genuinely needs a build script.

**Rationale:** A new foundation can adopt secure defaults without legacy exceptions. Exact versions
and a frozen CI lockfile make reviewed changes visible.

**Alternatives considered:** Allowing all lifecycle scripts is convenient but expands the install
attack surface; disabling scripts globally breaks legitimate native/transpiler dependencies without
producing an actionable review list.

**Sources:** [pnpm supply-chain security](https://pnpm.io/supply-chain-security) and
[dependency build settings](https://pnpm.io/settings/build).

## Deferred Decisions

- Product application framework, router, server rendering, and deployment platform.
- Remote Turbo cache provider and credentials.
- Public package publishing, registry scope, Changesets, provenance, and release workflow.
- React Compiler activation for product applications. It is stable, but must be selected with the
  eventual app bundler and measured verification rather than silently imposed by the shared UI
  source package.
