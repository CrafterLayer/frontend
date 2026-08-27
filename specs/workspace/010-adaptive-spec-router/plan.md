# Implementation Plan: Adaptive Spec Router

**Branch**: `010-adaptive-spec-router` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/workspace/010-adaptive-spec-router/spec.md`

## Summary

Add a private, local-first product application called **Adaptive Spec Router**. It is a
deterministic evaluation dashboard, not an agent runner: developers can compose a task scenario, see
an explainable writer/reviewer recommendation, audit two plan reviews against a plan revision, and
inspect a single-writer execution timeline with evidence. No credential, network, source repository,
or live provider access is added.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.2.8 (matching `react-dom`)

**Primary Dependencies**: Existing workspace React, React DOM, Vite, Vitest, Testing Library,
Storybook

**Storage**: In-memory deterministic demo state only; no persistence or remote storage

**Testing**: Vitest + React Testing Library component and feature behavior tests; Storybook catalog
build; Vite production build

**Target Platform**: Modern desktop and mobile browsers in a local development session

**Project Type**: Private Vite React product application under `apps/adaptive-spec-router`

**Performance Goals**: Initial interface is interactive without a provider call; route changes
update synchronously from local data; all primary controls remain reachable at 375px through 1440px.

**Constraints**: No new dependency, provider credential, remote request, source-code execution,
repository mutation, provider billing, or publishing action. The UI must not imply that an
illustrative run is live.

**Scale/Scope**: One local dashboard with five complete component contracts, deterministic seed
scenarios, and no server or multi-user runtime.

## Constitution Check

| Gate                                       | Pre-design | Post-design | Evidence                                                                                                       |
| ------------------------------------------ | ---------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Scoped monorepo ownership is explicit      | Pass       | Pass        | New private app owns its product UI; no existing app changes.                                                  |
| Dependency direction stays acyclic         | Pass       | Pass        | App consumes only workspace configuration and catalog packages; no app-to-app imports.                         |
| React 19.2 baseline remains aligned        | Pass       | Pass        | Existing catalog pins `react` and `react-dom` to 19.2.8; no upgrade or install is needed.                      |
| Every UI component has a complete contract | Pass       | Pass        | Matrix below requires implementation, export, typed story, MDX, and behavior test for all five new components. |
| Evidence and review are honest             | Pass       | Pass        | UI states are labelled deterministic/illustrative; no actual agent result is fabricated.                       |
| No overlapping writer model is represented | Pass       | Pass        | One writer lease is part of the route and execution model.                                                     |
| Directional provider topology is visible   | Pass       | Pass        | Codex-native does not start Claude; Claude-adaptive is an explicit entry mode for cross-provider routing.      |

### Compatibility exception

| Exception                             | Owner                          | Rationale                                                                                                                                                                  | Removal condition                                                                                                  |
| ------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Story files omit `tags: ['autodocs']` | Adaptive Spec Router app owner | Storybook 10.5 rejects an explicit MDX docs page and `autodocs` for the same component. Every component still has its required typed story and explicit MDX documentation. | Restore the tag when the workspace Storybook configuration supports both artifacts without duplicate-doc indexing. |

## Architecture Decisions

1. **Private Vite React app, no server**: the workspace already uses this stack for local browser
   work. This keeps the trial isolated, credential-free, and removes a backend/deployment surface
   from the first product increment.
2. **Feature-owned deterministic domain model**: routing policy and seed data live within the new
   app's `adaptive-router` feature. They are not extracted into a package because there is only one
   credible consumer.
3. **Single dashboard composition root**: the first release has no real resource URLs or server
   data. A route tree would add abstraction without user value; thin `App` bootstrap composes a
   feature-level product root.
4. **No live provider adapter**: presentation of Claude/Codex route choices is deliberately modelled
   data. A later adapter must use an explicit security and approval design rather than reusing UI
   demo state.
5. **CSS custom properties and component-owned selectors**: a dark command-center interface uses a
   small semantic token set, no dependency, visible focus, text status labels, and responsive grid
   collapse.
6. **No automatic persistence**: reset is predictable and the demo cannot retain credentials or
   project content. Persistence becomes a later opt-in product decision.

## Monorepo Scope, Ownership, and Dependency Direction

| Scope                                      | Change                                            | Owner                       | Dependency effect                                                       |
| ------------------------------------------ | ------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `apps/adaptive-spec-router`                | New private local product app                     | Adaptive Spec Router        | Depends only on workspace catalog/tooling; imports no application.      |
| `apps/storybook`                           | Add the new app's colocated component story globs | Workspace component catalog | Tooling-only catalog change; imports no product application at runtime. |
| `specs/workspace/010-adaptive-spec-router` | Product feature artifacts                         | Root Spec Kit               | Documents the new app and quality gates.                                |
| `docs/architecture`                        | ADR and index update                              | Workspace architecture      | Records the app framework and no-deployment decision.                   |

The dependency direction is
`app bootstrap -> feature composition root -> feature components and pure model`. No new shared
package is justified, and no existing app or package consumes this app.

## UI Component Contract Matrix

| Component            | Ownership                  | Purpose                                          | Required states                    | Artifacts                                  |
| -------------------- | -------------------------- | ------------------------------------------------ | ---------------------------------- | ------------------------------------------ |
| `AdaptiveSpecRouter` | `features/adaptive-router` | Feature composition root and local demo boundary | seeded / reset                     | TSX, export, story, MDX, RTL behavior test |
| `ScenarioComposer`   | `features/adaptive-router` | Collect a task brief, work class, and risk       | default / critical / invalid brief | TSX, export, story, MDX, behavior test     |
| `RouteDecisionPanel` | `features/adaptive-router` | Explain one writer/reviewer route and fallback   | standard / critical / unavailable  | TSX, export, story, MDX, behavior test     |
| `PlanReviewAudit`    | `features/adaptive-router` | Show fresh/stale independent plan reviews        | ready / stale                      | TSX, export, story, MDX, behavior test     |
| `EvidenceConsole`    | `features/adaptive-router` | Show lease, timeline, evidence, and release gate | active / blocked                   | TSX, export, story, MDX, behavior test     |

Every interactive control has a visible keyboard focus state, semantic accessible name, and a text
label for status. Styles are feature-owned CSS, not a new shared design system.

## Project Structure

### Documentation

```text
specs/workspace/010-adaptive-spec-router/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── local-demo-contract.md
├── checklists/
│   ├── requirements.md
│   └── governance.md
└── tasks.md

docs/architecture/
├── README.md
└── decisions/
    ├── README.md
    └── 0005-adaptive-spec-router-local-demo.md
```

### Source Code

```text
apps/adaptive-spec-router/
├── README.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── src/
    ├── app/
    │   ├── App.tsx
    │   └── App.test.tsx
    ├── features/
    │   └── adaptive-router/
    │       ├── AdaptiveSpecRouter.css
    │       ├── index.ts
    │       ├── model/
    │       │   ├── demo-data.ts
    │       │   ├── routing-policy.test.ts
    │       │   ├── routing-policy.ts
    │       │   └── types.ts
    │       └── components/
    │           ├── AdaptiveSpecRouter/
    │           ├── ScenarioComposer/
    │           ├── RouteDecisionPanel/
    │           ├── PlanReviewAudit/
    │           └── EvidenceConsole/
    ├── main.tsx
    └── styles.css

apps/storybook/.storybook/main.ts          # discovers the new app's stories and MDX docs
```

**Structure Decision**: This is a one-app vertical feature. The bootstrap has no business UI;
product behavior, deterministic model, styles, and components remain feature-owned. The app does not
export a reusable package API.

## Delivery, Deployment, and Reversal

The app is private and local only. It is available through the workspace dev command and creates no
deployment target, database, credential, or migration. Reversal is a clean removal of the new app
and its ADR/spec after a future user decision; it touches no external service.

## Verification Plan

1. Pure routing-policy unit tests cover normal, critical, unavailable, and ambiguous scenarios.
2. Component tests cover task submission, stale plan review invalidation, reset, keyboard-reachable
   controls, and evidence/lease visibility.
3. Run `pnpm --filter @craftkit/adaptive-spec-router lint`, `typecheck`, `test`, and `build`.
4. Run the workspace component validator and Storybook build to prove the component contracts are
   catalogued.
5. Browser-smoke the local app at desktop and mobile viewports, then inspect the real diff and run
   `git diff --check`.

## Complexity Tracking

| Decision        | Why Needed                                                             | Simpler Alternative Rejected Because                                                                               |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| New private app | The user needs a separately runnable product trial without risking B3c | Adding a panel to the builder playground would couple unrelated product domains and make future extraction harder. |
