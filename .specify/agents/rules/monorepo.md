# Monorepo Architecture and Spec Kit Scoping

Load this file for app creation, package creation, cross-app work, shared UI, workspace
tooling, dependency boundaries, or Spec Kit project selection.

## Architecture Model

Use a feature-first modular monorepo:

```text
apps/
└── <app>/
    └── src/
        ├── app/                 # bootstrap, providers, routing, app-wide wiring
        ├── routes/              # thin route shells
        └── features/<feature>/  # app-owned vertical product slices
packages/
├── ui/                          # domain-agnostic design system
├── <domain>/                    # explicit reusable domain contract
├── <integration>/               # external-system boundary and typed client
├── testing/                     # shared test utilities and provider renderers
└── <tooling>/                   # shared TS, lint, Storybook, or build config
```

The approved workspace foundation uses pnpm 11.23.0 and Turborepo 2.10.10 on Node 24 LTS.
Vite/Vitest serve the private shared UI package and the central Storybook catalog only.
Product application framework, bundler, router, runtime, and deployment remain app-scoped
decisions; do not silently assume Next.js, Vite, or another framework for a product app.

## Dependency Direction

- Apps may import packages through documented public entrypoints.
- Apps MUST NOT import another app.
- Packages MUST NOT import apps.
- Lower-level packages MUST NOT import a higher-level feature or composition package.
- Package dependencies MUST remain acyclic.
- Deep imports into another package's internal source are forbidden unless explicitly
  exported as part of its supported contract.
- Cross-app code moves into a package only after its owner, API, versioning impact, and
  reuse cases are documented. Never create catch-all `shared`, `common`, or `utils`
  packages for unrelated leftovers.
- Each app or package owns its source, tests, config, and public API. Changes outside the
  declared scope require an updated plan or explicit user approval.

Workspace tooling enforces these rules through explicit package exports, the stable
repository validators, TypeScript, and Turbo's graph/path checks:

```bash
pnpm check:workspace
pnpm check:components
pnpm check:boundaries
pnpm check:graph
```

Internal dependencies use `workspace:*`, shared external versions use the root catalog,
and pnpm rejects workspace cycles during installation. Turbo Boundaries remains defense in
depth while experimental; the repository validator is the authoritative manifest gate.

## Documentation Ownership

- `docs/README.md` is the workspace documentation index.
- `docs/architecture/` owns current cross-workspace architecture; future designs MUST be
  marked proposed until approved and implemented.
- `docs/architecture/decisions/` owns durable Architecture Decision Records (ADRs).
- `docs/development/`, `docs/testing/`, and `docs/runbooks/` own shared repeatable
  engineering guidance for their named concern.
- Feature requirements, plans, and work items stay in scoped `specs/` directories.
- Component API documentation stays colocated as `*.docs.mdx` beside the component.
- Member-specific setup and public API details stay in that app or package `README.md`.

Do not create a competing root `architecture/` directory or duplicate the same policy in
multiple documentation trees. Architecture-changing work MUST update the relevant
document and ADR in the same delivery, with links to its approved Spec Kit artifacts.

## UI Ownership

- `packages/ui` owns reusable domain-agnostic primitives and design-system components.
- App-specific or domain-specific composition stays in the owning feature.
- Shared UI does not import routes, app stores, feature queries, product DTOs, or app-only
  translations.
- A root Storybook SHOULD aggregate colocated stories across packages and apps. Separate
  Storybooks require a framework/runtime reason recorded in the relevant plan.
- Every UI component follows `react-ui.md`, regardless of whether it lives in an app or
  package.

## Spec Kit Project Model

Use the root `.specify/` project for workspace governance and cross-cutting features.
Store root-managed feature artifacts under a declared scope:

```text
specs/
├── workspace/<feature>/
├── apps/<app>/<feature>/
└── packages/<package>/<feature>/
```

Set `SPECIFY_FEATURE_DIRECTORY` before creating or operating on a scoped feature. Spec Kit
also persists the active feature in `.specify/feature.json`; it is machine-local and MUST
not be treated as durable project truth.

Create a member `.specify/` only when an app or package has independent governance,
release cadence, backlog, or access needs. For member projects:

- initialize that member explicitly;
- keep its specs inside the member;
- point its constitution to the root constitution and copy only the member-specific rules;
- use `SPECIFY_INIT_DIR=<member>` from the root; and
- remember that `SPECIFY_INIT_DIR` selects the project while
  `SPECIFY_FEATURE_DIRECTORY` selects the feature inside it.

Spec Kit does not provide constitution inheritance. A member constitution that diverges
from the root without an explicit amendment is invalid.

## Required Plan Content

Every monorepo plan MUST state:

1. exact affected apps and packages;
2. which member owns each new file and public API;
3. dependency direction before and after the change;
4. shared contract, migration, and backward-compatibility effects;
5. build/cache/deployment effects for every affected app;
6. testing and Storybook scope;
7. rollout and rollback strategy when multiple deployables change; and
8. the narrow and affected-workspace verification commands.

Implementation tasks MUST be grouped by package ownership and dependency order. Parallel
agents may edit only path-disjoint scopes, and the primary agent integrates cross-package
contract changes.

## Verification Order

1. Changed-file format and static checks.
2. Component or module tests.
3. Owning package lint, types, tests, Storybook, and build.
4. Direct consumer contract checks.
5. Affected workspace checks when a valid Git baseline exists.
6. `pnpm verify` for cross-cutting, release, or workspace-foundation changes.

Always distinguish local checks from hosted CI evidence. The configured workflow is not
considered executed until a real GitHub Actions run completes.

## Primary Spec Kit Reference

- Monorepo guide: https://github.com/github/spec-kit/blob/main/docs/guides/monorepo.md
- Core project/feature targeting: https://github.com/github/spec-kit/blob/main/docs/reference/core.md
