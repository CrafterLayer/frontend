# System Architecture Overview

**Status:** Current workspace foundation; product applications are not scaffolded yet.

## Purpose

CraftKit is planned as a large multi-application frontend monorepo. The root workspace
owns shared governance and tooling, applications own deployable product experiences, and
packages own deliberate reusable contracts.

```mermaid
flowchart TD
  Users[Users] --> Apps[apps/* deployable experiences]
  Apps --> Features[app-owned feature slices]
  Features --> Packages[packages/* public contracts]
  Packages --> UI[packages/ui domain-free design system]
  Packages --> Integrations[typed integration packages]
  Tooling[pnpm + Turbo + shared configs] --> Apps
  Tooling --> Packages
  Storybook[central Storybook tooling app] --> UI
  Specs[scoped Spec Kit artifacts] -. govern .-> Apps
  Specs -. govern .-> Packages
  Docs[architecture and runbooks] -. explain .-> Apps
  Docs -. explain .-> Packages
```

## Ownership Model

- `apps/<app>` owns a deployable application, its routing, composition, product features,
  app configuration, and app-only assets.
- `packages/ui` owns reusable domain-agnostic UI primitives and design-system contracts.
- `packages/<domain>` owns an explicit reusable domain contract only when multiple
  consumers justify that boundary.
- `packages/<integration>` owns transport and typed external-system boundaries.
- `packages/<tooling>` owns shared TypeScript, lint, test, Storybook, or build
  configuration.
- `apps/storybook` owns the one workspace UI catalog and is not a product deployable.
- `.specify/` owns governance, agent workflows, and feature-delivery artifacts.
- `docs/` explains architecture and repeatable engineering or operational practice.

## Dependency Direction

Composition flows downward from application shells to feature slices and then to package
public APIs. Applications never import other applications, and packages never import
applications. Dependencies between packages must remain acyclic.

```text
app shell -> route -> feature composition -> feature modules -> package public APIs
```

## Workspace Runtime

Node 24 LTS, pnpm 11, and Turborepo 2 own repository tooling. The root graph discovers
direct members, packages use explicit exports, internal edges use `workspace:*`, and the
repository validators plus Turbo Boundaries enforce dependency direction. The complete
commands and cache model are documented in [monorepo.md](monorepo.md) and
[workspace.md](../development/workspace.md).

## Product Runtime and Deployment

No runtime framework or deployment topology has been approved yet. When those choices
are made, update this document with:

- deployable application inventory and responsibilities;
- browser/server/edge execution boundaries;
- authentication and tenant boundaries;
- external services and data ownership;
- build and release topology;
- observability and failure containment; and
- links to the approving ADRs and scoped specifications.

## Staleness Condition

Revisit this overview when the first application is scaffolded, a new deployable is
added, a package changes ownership, or runtime/deployment boundaries change.
