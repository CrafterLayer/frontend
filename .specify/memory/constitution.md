<!--
Sync Impact Report
- Version change: 1.1.0 -> 1.2.0
- Modified principles:
  - VI. Shared Context and Deliberate Delegation (formalized cross-runtime orchestration,
    bounded worker authority, and fail-closed bridge behavior)
- Updated section:
  - Agent Workflow and Delivery Gates (added explicit task partition and delegation gate)
- Added sections: none
- Removed sections: none
- Deferred items: none
-->

# CraftKit Builder Frontend Constitution

## Core Principles

### I. Spec Kit Is the Agent Source of Truth

All project agents MUST treat `.specify/` as the canonical governance and continuity
system. The constitution defines non-negotiable policy; the active specification,
plan, and tasks define feature intent; `.specify/agents/` defines shared operational
context. `AGENTS.md`, `CLAUDE.md`, and Cursor rules MUST remain thin entrypoints into
that shared source instead of carrying independent copies of project policy.

When instructions conflict, agents MUST follow this order: current user instruction,
this constitution, the active Spec Kit artifacts, shared agent rules, then tool-specific
adapters. This keeps Claude, Codex, Cursor, and future agents aligned without silently
forking project conventions.

### II. Modern React 19 Baseline

New application code MUST target the latest patched React 19.2 release. At ratification,
that release is React 19.2.8; `react` and `react-dom` MUST use exactly matching versions.
Agents MUST re-check the official release line before installing or upgrading packages.

React components and Hooks MUST be pure and idempotent. Props, state, context values,
Hook arguments, and values already passed to JSX MUST NOT be mutated. Normal Hooks MUST
only be called at the top level of React components or custom Hooks. Effects MUST be
reserved for synchronization with external systems; derived values belong in render and
user-triggered work belongs in event handlers or Actions.

New code MUST use the modern JSX transform, development Strict Mode, TypeScript, and the
recommended `eslint-plugin-react-hooks` rules. React 19 patterns are preferred when they
fit the product flow: `ref` as a prop instead of introducing `forwardRef`, Actions and
`useActionState` for mutation state, `useOptimistic` for genuine optimistic experiences,
and `useEffectEvent` only for non-reactive Effect-local logic. Legacy React DOM render
APIs, string refs, legacy context, function-component `propTypes` or `defaultProps`,
`react-test-renderer`, and shallow-render testing are forbidden in new code.

### III. One Component per TSX File

Each substantive React component MUST own one `.tsx` file. A component MUST NOT be
declared inside another component, Hook, callback, loop, or condition, and sibling
components MUST NOT be hidden at the bottom of a parent file. Meaningful `renderX()`
helpers that return JSX MUST be extracted into named components. Small inline JSX
conditions and local event callbacks are allowed when they are not independent UI units.

The default architecture is feature-first with component-owned folders and composition
roots. Workspace-wide domain-agnostic primitives belong under
`packages/ui/src/components`; app-owned product UI belongs under
`apps/<app>/src/features/<feature>/components`. Pages and routes MUST remain thin
composition shells. Reusable logic belongs in Hooks or pure `.ts` modules, not in large
route files or generic `shared` dumping grounds.

### IV. Every UI Component Ships Complete

Every newly created UI component MUST be delivered as a complete component contract in
its own folder. At minimum, that folder MUST contain:

- `<ComponentName>.tsx` for the single component implementation;
- `index.ts` for the local public export;
- `<ComponentName>.stories.tsx` using typed Storybook CSF and representative states;
- `<ComponentName>.docs.mdx` documenting purpose, usage, API, variants, accessibility,
  and examples; and
- `<ComponentName>.test.tsx` testing behavior through user-visible interactions.

Optional `types.ts`, `styles.ts`, `constants.ts`, `utils.ts`, and `use-*.ts` files MUST be
created only when they contain real responsibilities. Storybook stories MUST cover the
default state plus meaningful variants, loading, empty, error, disabled, and responsive
states where applicable. Interactive behavior MUST use a `play` test when it adds useful
confidence. Tests MUST prefer accessible queries and user interactions over internals or
snapshot-only coverage. A component is not complete if its implementation, documentation,
story, or test is missing.

### V. Evidence-Based Quality and Review

No agent may claim work is complete from inspection alone. The narrowest relevant checks
MUST run first, followed by the configured typecheck, lint, unit tests, Storybook build,
and application build in proportion to the change. Unavailable or failing checks MUST be
reported explicitly and never described as passing.

Every material change MUST receive a final diff review. Reviews MUST report findings in
severity order and prioritize correctness, regressions, accessibility, security,
performance, architecture boundaries, tests, stories, and documentation. The primary
agent MUST review and verify all sub-agent output before accepting it.

### VI. Shared Context and Deliberate Delegation

All agents MUST follow the load order documented in `.specify/agents/README.md`. Current,
replaceable task state belongs in `.specify/agents/HANDOFF.md` and
`.specify/agents/context.json`; durable validated decisions and failure modes belong in
`.specify/agents/MEMORY.md`. Raw logs, guesses, credentials, tokens, cookies, and other
sensitive values MUST NOT be stored in these files.

Sub-agents MAY be used only for concrete, bounded work that can proceed independently.
The agent that accepts the user request is the coordinating primary agent unless the user
explicitly assigns that role elsewhere. Every delegated task MUST define its objective and
deliverable, read or write authority, exact allowed paths, source-of-truth artifacts,
verification, prohibited actions, and evidence to return. Parallel agents MUST NOT receive
overlapping write scopes.

Cross-runtime delegation through MCP, an agent plugin, a CLI, or a future transport MUST obey
the same contract. Transport configuration is an adapter, never a second source of governance.
A delegated worker MUST NOT widen its scope, recursively delegate or spawn additional workers
without explicit coordinator authority, or commit, push, deploy, install dependencies, or mutate
external state unless the task contract and current user authorization explicitly allow that
action. The coordinator MUST select the working directory, least-privilege sandbox and approval
policy, and any model override deliberately; an unbounded or danger-full-access default is
forbidden.

The coordinator retains ownership of task partitioning, integration, review, final verification,
continuity updates, and the user-facing result. It MUST verify bridge availability before relying
on delegation. A required independent review or required delegation MUST fail closed when the
selected worker is unavailable; optional parallel work MAY continue in the coordinator only when
that fallback is reported and does not weaken an acceptance gate. A permanent context-heavy
sub-agent registry is forbidden unless the user explicitly requests one.

Workflow enforcement MUST be observable outside an agent's prose. Required delegation MUST emit a
run-local structured result that a separate engine step validates before implementation. Mandatory
Codex review MUST start a fresh process with an explicitly enforced read-only sandbox and
never-approve policy, produce non-empty review evidence, and expose that evidence to the following
approval gate. A workflow-designated independent reviewer MUST NOT recursively delegate review.

### VII. Commit Integrity

Commit messages MUST follow Conventional Commits using an imperative summary:
`type(scope): summary`. Before generating a message, an agent MUST inspect the actual
staged diff, or the complete relevant diff when nothing is staged. It MUST NOT invent
changes that are absent from the diff.

For non-trivial changes, the body MUST explain why the change was needed, what changed,
and which verification ran. Breaking changes MUST use `!` and a `BREAKING CHANGE:` footer.
Agents MUST present the proposed message before committing and MUST NOT create a commit
unless the user explicitly authorizes it.

### VIII. Monorepo Boundaries and Scoped Specifications

This repository is a large multi-application monorepo. Every change MUST identify its
scope before specification or implementation: workspace, one app, one package, or an
explicit cross-cutting set. Applications MUST NOT import from other applications.
Packages MUST NOT import from applications. Shared packages MUST expose intentional
public entrypoints, avoid undocumented deep imports, and maintain an acyclic dependency
graph. Cross-app code MUST move into a package only when its ownership and reuse contract
are clear; generic `shared` or `common` packages are not acceptable dumping grounds.

A package MUST NOT be created for possible future reuse. It requires either two credible
consumers or a clear platform or integration boundary, an owner, a narrower public API than
its implementation, and an acyclic dependency direction. Empty placeholder packages and
pre-scaffolded optional folders are forbidden. When multiple applications or external
projects consume the same backend contract, the generated client, transport, normalization,
and framework-agnostic domain operations MUST live behind an intentional package public API.
React, routing, notifications, and application state MUST NOT leak into that shared API
package.

The root `.specify/` project owns workspace governance and cross-cutting features.
App- and package-specific features MUST use scoped feature directories such as
`specs/apps/<app>/<feature>` and `specs/packages/<package>/<feature>`. A member may receive
its own `.specify/` project only when it has genuinely independent governance, release,
or backlog needs. Because Spec Kit constitutions do not inherit automatically, every
member project MUST reference and remain compliant with this root constitution. Agents
MUST use `SPECIFY_INIT_DIR` to select a member project and `SPECIFY_FEATURE_DIRECTORY` to
select its feature; ambiguous scope is a blocking error, not permission to write into the
nearest convenient directory.

### IX. Vertical Feature Ownership and Thin Delivery Layers

Application composition MUST flow in one direction:
`app bootstrap -> routes -> pages -> features -> package public APIs`. Each layer has one
non-overlapping responsibility:

- `app/` owns bootstrap, root providers, global error handling, and application-wide wiring;
- `routes/` owns route objects, URL structure, guards, loaders or actions, lazy boundaries,
  route error elements, and intent prefetch;
- `pages/` owns thin route-entry composition and page-level layout or metadata;
- `features/<feature>/` owns the product capability, including its UI, behavior, state,
  validation, feature-specific query orchestration, and presentation adapters; and
- `packages/` owns stable, explicitly exported contracts that have proven reuse or a clear
  platform boundary.

Route modules and pages MUST NOT contain feature business logic, transport implementations,
stores, schemas, or collections of inline components. A page MAY compose multiple feature
public APIs, but feature code MUST NOT import from `pages/` or `routes/`. Cross-feature imports
MUST use each feature's narrow `index.ts`; implementation deep imports are forbidden. If two
features genuinely share domain behavior, the behavior MUST move to the nearest specifically
named owner or a justified domain package, never to a generic `shared`, `common`, or global
`utils` area.

A feature MUST begin with the smallest real shape and add `components/`, `hooks/`, `model/`,
`validation/`, focused support modules, or nested component folders only when those
responsibilities exist. Product code MUST NOT be horizontally scattered across top-level
`components/`, `api/`, `forms/`, `store/`, and `utils/` trees. App-specific query Hooks and
view adapters stay with the owning feature; a shared framework-agnostic API client belongs in
an integration package. A React Query package is justified only when the same Hook contract is
consumed unchanged by multiple applications.

## Architecture and Artifact Standards

The preferred monorepo and component shape is:

```text
apps/
└── <app>/
    └── src/
        ├── app/                              # bootstrap, root providers, global wiring
        ├── routes/                           # URLs, guards, loaders, lazy boundaries
        ├── pages/
        │   └── <page>/                       # thin route-entry composition only
        │       ├── <PageName>.tsx
        │       └── index.ts
        └── features/
            └── <feature>/                    # complete vertical product capability
                ├── components/
                │   └── ComponentName/        # full component contract
                ├── hooks/                    # only concrete reusable feature behavior
                ├── model/                    # state and domain transformations
                ├── validation/               # runtime/form schemas when needed
                ├── types.ts                  # only feature-owned public types
                ├── utils.ts                  # focused pure helpers only
                └── index.ts                  # narrow feature public API
packages/
├── <api-client>/                    # shared transport/contracts; no React or app state
├── <api-react-query>/               # only for proven identical multi-app Hook contracts
├── ui/src/components/
│   └── ComponentName/
│       ├── ComponentName.tsx
│       ├── ComponentName.stories.tsx
│       ├── ComponentName.docs.mdx
│       ├── ComponentName.test.tsx
│       ├── index.ts
│       ├── types.ts                # only when needed
│       ├── styles.ts               # only when needed
│       ├── constants.ts            # only when needed
│       ├── utils.ts                # only when needed
│       └── SubcomponentName/
│           ├── SubcomponentName.tsx
│           ├── SubcomponentName.stories.tsx
│           ├── SubcomponentName.docs.mdx
│           ├── SubcomponentName.test.tsx
│           └── index.ts
├── <domain-package>/               # explicit domain contract and ownership
├── <tooling-package>/              # shared lint, TS, test, or build config
└── <integration-package>/          # typed external-system boundary
```

Composition MUST flow from route or page shells into feature composition roots, then into
focused components and shared primitives. Business logic, server state, and transport
code MUST remain outside domain-agnostic UI primitives. Props MUST be narrow, explicit,
and serializable when crossing a Server/Client Component boundary. Global barrels are
discouraged when they create circular dependencies; local component barrels are allowed.
No application may become the source of reusable code for another application. Workspace
tooling MUST enforce dependency direction, package public APIs, TypeScript boundaries,
and affected-only task execution once the monorepo toolchain is selected in a plan.

The shared API package MUST expose generated contracts and transport through curated exports;
generated files are read-only and MUST remain behind normalization or domain adapters when their
wire shape is not the application contract. Feature code consumes that public API and owns only
application-specific orchestration. The architecture tree documents allowed ownership, not a
scaffolding checklist: absent responsibilities MUST remain absent.

Storybook SHOULD run as one workspace catalog for shared UI and collect colocated stories
from packages and applications. A separate app Storybook is allowed only when a framework
or runtime boundary makes the shared catalog technically incorrect. The plan MUST record
that exception and its verification command.

React Server Components MUST only be introduced through a framework that supports them.
Server Components MUST stay free of browser APIs, client state, and Effects; `'use client'`
belongs at the narrowest interactive boundary. RSC transport packages MUST use a currently
patched React release and MUST be reviewed for current security advisories before release.

## Agent Workflow and Delivery Gates

Each feature follows the Spec Kit lifecycle:

1. Establish or amend this constitution when governance changes.
2. Declare the monorepo scope and create the feature specification in its scoped directory.
3. Resolve material ambiguity, including every affected app and package boundary.
4. Produce the technical plan and record architecture and dependency-graph decisions.
5. Generate dependency-ordered tasks with documentation, stories, tests, review, and
   verification represented explicitly.
6. Partition the approved task graph; delegate only independently verifiable, path-disjoint work
   through the shared collaboration contract and record which agent owns each active write scope.
7. Integrate delegated evidence, then implement remaining work in small coherent changes.
8. Review the diff and run package-level checks before affected workspace checks.
9. Converge implementation against the specification, plan, and tasks.
10. Update shared context or handoff state before pausing or transferring work.

UI task lists MUST NOT collapse implementation, docs, Storybook, and tests into an
optional final note. Those artifacts are part of the component's definition of done.
Code review MUST occur before a commit message is generated. Commit generation MUST use
the shared template and the verified diff.

## Governance

This constitution supersedes lower-level project practices. Amendments require an explicit
change to this file, a Sync Impact Report, a semantic version bump, and alignment of the
shared agent routing files. Governance changes MUST be reviewed for their effect on all
three active integrations: Claude, Codex, and Cursor.

Versioning follows semantic versioning: MAJOR for incompatible removals or redefinitions,
MINOR for new principles or materially expanded obligations, and PATCH for clarification
without changed obligations. Every feature plan and every code review MUST include a
constitution compliance check. Exceptions require a documented rationale, owner, and
removal condition in the active plan; undocumented exceptions are invalid.

**Version**: 1.2.0 | **Ratified**: 2026-08-24 | **Last Amended**: 2026-08-26
