# Research: Adaptive Spec Router

## Decision 1: Use a local deterministic product trial

**Decision**: Build the first release as a browser-only demonstration that uses seeded scenarios and
a pure route policy.

**Rationale**: The user needs to judge the product idea before publishing it. This gives them an
interactive, professional experience without exposing a repository, credentials, provider accounts,
or billing. It also prevents a dashboard from overstating that it is supervising live agents.

**Alternatives considered**:

- Connect the existing Codex bridge now — rejected because browser UI cannot safely inherit the
  bridge's local approval and process controls, and live execution would widen scope to credentials
  and audit persistence.
- Build static mock screens — rejected because developers must be able to change a scenario and see
  an explainable routing outcome.

## Decision 2: Route by typed signals, not a model's self-confidence

**Decision**: Derive a route from the task class, risk, provider availability, and required review
lane.

**Rationale**: A recorded policy is inspectable and deterministic. It makes a fallback visible,
protects the one-writer law, and gives a future evaluation system a stable seam to replace with
measured performance data.

**Alternatives considered**:

- Let a provider choose itself — rejected because it is not explainable or stable enough for a
  governance product.
- Hard-code one model for all work — rejected because it cannot demonstrate the core adaptive
  routing proposition.

## Decision 3: Treat plan review freshness as a first-class gate

**Decision**: A plan is ready only when the Claude and Codex review records both match its frozen
revision.

**Rationale**: This makes the requested two-sided review concrete. A material revision invalidates
prior records rather than silently carrying them forward.

**Alternatives considered**:

- One combined review state — rejected because it hides reviewer separation and plan mismatch.
- Unconditional readiness — rejected because it defeats the dual-review quality gate.

## Decision 4: Use a Vite React app and existing workspace tools

**Decision**: Follow the workspace's private browser application pattern with Vite, React 19.2.8,
Vitest, Testing Library, and the central Storybook catalog.

**Rationale**: It adds no new external dependency and follows already-verified monorepo tooling. The
new ADR records the app-specific framework and no-deployment decision required by workspace policy.

**Alternatives considered**:

- Add a server or database — rejected because no persistent or multi-user requirement exists.
- Add a separate frontend framework — rejected because it would increase extraction work without
  improving this product trial.

## Decision 5: Use an accessibility-first command-center visual system

**Decision**: Use feature-scoped semantic CSS tokens with a dark, high-contrast command-center
presentation, rounded evidence panels, coloured status plus text labels, visible focus, and
responsive grid collapse.

**Rationale**: The product needs information density and traceability without reducing clarity. The
applied dashboard design guidance emphasizes strong contrast, deliberate interaction states, and
responsive reachability; the final execution avoids its landing-page-oriented patterns in favour of
an information-dense product UI.

**Alternatives considered**:

- Reuse builder styling — rejected because it belongs to the visual-page-builder domain.
- Introduce a design library — rejected because the existing workspace and this first release do not
  require a new dependency.
