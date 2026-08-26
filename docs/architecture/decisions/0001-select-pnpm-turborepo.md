# ADR 0001: Select pnpm and Turborepo for the Workspace

- **Status:** Accepted
- **Date:** 2026-08-24
- **Scope:** Workspace
- **Spec:**
  [`specs/workspace/001-monorepo-foundation`](../../../specs/workspace/001-monorepo-foundation/spec.md)

## Context

CraftKit Builder is intended to contain many applications and reusable packages. The repository
needs deterministic dependency resolution, explicit local-package contracts, parallel task
execution, affected-only checks, and cacheable builds before product apps are created. The toolchain
must not force a product framework or deployment platform.

## Decision

Use pnpm 11.23.0 as the package manager and Turborepo 2.10.10 as the task orchestrator. Pin Node
24.19.0 locally and require the Node 24 LTS line. Use one shared lockfile, `workspace:*` internal
dependency ranges, exact shared dependency catalogs, strict cycle and lifecycle-script policy,
framework-neutral root tasks, and per-member overrides only when a real member requires them.

The authoritative architecture boundary check is the repository-owned workspace validator. Turbo
Boundaries is an additional check, not the sole policy mechanism while it remains experimental.

## Consequences

### Positive

- Clean checkouts resolve one deterministic workspace graph.
- Internal dependencies cannot silently fall back to registry packages.
- Members can run independently while root commands orchestrate the graph.
- Cache keys include declared source, config, environment, and dependency inputs.
- A future app can choose its approved framework and provide its own output override.

### Costs and risks

- Contributors and CI must use the pinned Node/pnpm versions.
- pnpm lifecycle builds require explicit review and `allowBuilds` entries.
- Turbo task outputs and environment declarations must stay accurate to avoid stale cache.
- pnpm/Turbo major upgrades require lockfile, CI, and cache verification together.
- Some hosts may lag pnpm 11 support; deployment compatibility must be tested when a host is
  selected rather than weakening the local contract preemptively.

## Alternatives considered

- **npm workspaces:** rejected because the explicit `workspace:`-only resolution and pnpm
  security/configuration controls better fit a large private monorepo.
- **Yarn Berry:** capable, but Plug'n'Play and Yarn-specific release decisions add scope without a
  current need.
- **Nx:** capable, but its larger generator/plugin governance surface is unnecessary for this
  framework-neutral foundation.
- **Plain pnpm recursive scripts:** rejected because they do not provide the same declared output
  graph and cache behavior.
- **Custom task runner:** rejected as non-differentiating infrastructure.

## Follow-up decisions

Separate ADRs are required for the first product app framework, deployment platform, remote cache
trust model, and any public package release workflow.

## Staleness condition

Revisit this decision when pnpm or Turbo reaches a new major, the selected deployment host cannot
support the pinned package-manager contract, or measured repository scale requires a different graph
engine.
