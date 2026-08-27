# ADR 0005: Build Adaptive Spec Router as a Private Local React Demo

- **Status:** Accepted
- **Date:** 2026-08-27
- **Owners:** Adaptive Spec Router application owner
- **Related Spec:** `specs/workspace/010-adaptive-spec-router/`
- **Supersedes:** None
- **Superseded by:** None

## Context

The workspace has a governance setup for Claude and Codex, but the user wants to assess a separate
product idea before creating a public repository or integrating real providers. The first product
increment must be isolated from the active builder work, runnable locally, and unable to expose
credentials, source content, or an agent execution capability by accident.

## Decision Drivers

- A credible interactive trial with no provider account or secret.
- Clear ownership and a future extraction path without coupling it to the builder playground.
- Existing, already-approved workspace tooling and React baseline.
- Honest representation of illustrative evidence versus real execution.

## Considered Options

1. Add a panel to `apps/playground`.
2. Build a private Vite React product app with deterministic in-memory policy data.
3. Build a live agent console backed by the existing Claude/Codex transport.

## Decision

Create `apps/adaptive-spec-router` as a private Vite React application using the workspace's
existing React, TypeScript, Vitest, Testing Library, and Storybook tooling. It owns a feature-local,
deterministic model for route policy, dual plan-review freshness, writer leases, and evidence. It
has no router, backend, storage, credential, provider, MCP, repository, deployment, or publishing
integration in this feature.

The central Storybook catalog includes its colocated stories. The product app imports no other app
and exposes no reusable package API.

## Consequences

### Positive

- The user can test the product concept immediately without a sensitive integration surface.
- The model/routing policy is a pure seam that can later be evaluated or connected to a deliberate
  adapter design.
- The new app remains separable for an eventual standalone public repository.

### Negative or Trade-offs

- The displayed provider/model choices and evidence are illustrative, not live telemetry.
- A future real adapter needs a separate security, approval, persistence, audit, and deployment ADR.
- No multi-user or long-lived run history exists in this increment.

## Verification

The app's unit/component tests, central Storybook build, Vite build, and workspace
boundary/component validators provide automated local-product evidence. A manual 375px and 1440px
browser smoke remains a required validation gate before any extraction or public-release decision.
The UI includes a persistent local-demo boundary and contains no credential or provider transport
code.

## Rollout and Reversal

The app is available only through local workspace commands. There is no deployment target to roll
back. If the concept is rejected, remove this isolated app and its feature artifacts in a future,
explicitly authorized cleanup; no external system has to be recovered.
