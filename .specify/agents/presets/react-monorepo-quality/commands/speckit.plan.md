---
description: "Create the implementation plan with mandatory monorepo and UI quality decisions"
strategy: wrap
---

{CORE_TEMPLATE}

## Workspace Planning Requirements

Before the plan is considered ready, apply the root constitution and read
`.specify/agents/rules/monorepo.md`. For React or UI scope also read
`.specify/agents/rules/react-ui.md`.

The plan MUST identify the exact affected apps and packages, file ownership, public API
changes, dependency direction, direct consumers, migration impact, build/cache/deployment
impact, rollout or rollback needs, and narrow plus affected-workspace verification. If
workspace tooling has not been selected, record the choice and trade-offs in this plan;
do not silently assume a package manager, task runner, framework, test runner, or bundler.

For each planned UI component, include a component artifact matrix covering its single
implementation file, local export, typed Storybook story, MDX documentation, behavioral
test, accessibility states, and ownership. Plan composition roots and separate real
subcomponents into their own folders; never plan nested component declarations or a
multi-component TSX file.

The Constitution Check MUST fail when monorepo scope is ambiguous, a dependency boundary
is inverted, or a UI component lacks any required artifact. Exceptions require a named
owner, rationale, and removal condition in the plan.
