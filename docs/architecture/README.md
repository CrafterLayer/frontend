# Architecture Documentation

**Status:** Current workspace architecture; product application framework remains undecided.

This directory is the canonical architecture index for the frontend monorepo. pnpm and Turborepo own
the workspace graph, while shared query and routing-helper packages own reusable frontend contracts.
An empty icon package reserves its workspace identity only. Product runtime and deployment choices
remain scoped to future application decisions.

## Index

- [`overview.md`](overview.md) — system context, layers, and ownership model.
- [`monorepo.md`](monorepo.md) — workspace layout, dependency direction, and package extraction
  rules.
- [`frontend.md`](frontend.md) — React composition, feature slices, UI contracts, and frontend
  dependency flow.
- [`decisions/`](decisions/README.md) — accepted architecture decision records (ADRs).
- [`decisions/0001-select-pnpm-turborepo.md`](decisions/0001-select-pnpm-turborepo.md) — accepted
  workspace package-manager and task-graph decision.
- [`decisions/0002-select-routing-query-foundations.md`](decisions/0002-select-routing-query-foundations.md)
  — accepted caller-owned query, deferred-route helper, and bundle-budget decision.

## Architecture Rules

- Describe the real checked-in system. Mark future designs as **Proposed** until an approved Spec
  Kit plan and implementation make them current.
- Use diagrams to clarify relationships, but keep the written ownership and dependency rules
  authoritative.
- Record material alternatives and consequences in an ADR rather than burying them in a diagram or
  feature plan.
- Link architecture changes to the relevant scoped Spec Kit artifacts.
- Update affected architecture documents in the same delivery as the code change.
- Do not duplicate constitution policy. Link to `.specify/memory/constitution.md` when a
  non-negotiable rule is relevant.

## Decision Boundary

[The monorepo foundation plan](../../specs/workspace/001-monorepo-foundation/plan.md) selected pnpm,
Turborepo, shared lint/type/test configuration, Vite for private library builds, Vitest, and one
React-Vite Storybook catalog. The
[routing/query foundation](../../specs/workspace/002-routing-query-foundation/plan.md) then selected
shared package contracts and React Router v8 helpers. Neither decision selects an application
framework, app bundler, concrete route tree, server/runtime boundary, deployment platform, remote
cache, or public release workflow. Each requires its own scoped plan and ADR.
