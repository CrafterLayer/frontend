# Architecture Decision Records

Architecture Decision Records (ADRs) capture material technical choices that affect multiple
features, applications, packages, delivery workflows, or long-term maintenance.

## Accepted Decisions

- [`0001-select-pnpm-turborepo.md`](0001-select-pnpm-turborepo.md) — pnpm 11 and Turborepo 2 own the
  deterministic workspace graph and cache.
- [`0002-select-routing-query-foundations.md`](0002-select-routing-query-foundations.md) —
  caller-owned TanStack Query clients, React Router v8 deferred-route helpers, and measured package
  budgets.
- [`0003-builder-dependency-law.md`](0003-builder-dependency-law.md) — the builder layer law (schema
  ← core ← engines ← shell ← extensions ← preset) enforced by the workspace validators instead of
  experimental Turbo tags.
- [`0004-builder-tier2-declarative-model.md`](0004-builder-tier2-declarative-model.md) — tier-2
  builder content is JsonValue-typed declarative data compiled by Tier-1; executable content is
  structurally unrepresentable and rejected in depth.

## Naming

Use sequential filenames with a short kebab-case title:

```text
0001-select-workspace-tooling.md
0002-select-application-framework.md
```

Copy [`0000-template.md`](0000-template.md) and replace every placeholder. Do not edit a historical
ADR to hide a changed decision; supersede it with a new ADR and link both.

## Status Lifecycle

`Proposed -> Accepted -> Superseded` or `Rejected`

- **Proposed:** under review and not yet authoritative.
- **Accepted:** approved and reflected in active plans/code.
- **Rejected:** considered but not selected.
- **Superseded:** replaced by a later ADR.

## When an ADR Is Required

Create an ADR for choices such as framework and workspace tooling, rendering strategy, package
boundaries, cross-app state or API contracts, authentication architecture, deployment topology,
observability, or an intentional exception to the standard dependency model.

A small implementation detail local to one feature normally belongs in its Spec Kit plan instead.
