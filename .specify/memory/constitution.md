<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles:
  - I. Spec Kit Is the Agent Source of Truth
  - II. Modern React 19 Baseline
  - III. One Component per TSX File
  - IV. Every UI Component Ships Complete
  - V. Evidence-Based Quality and Review
  - VI. Shared Context and Deliberate Delegation
  - VII. Commit Integrity
  - VIII. Monorepo Boundaries and Scoped Specifications
- Added sections:
  - Architecture and Artifact Standards
  - Agent Workflow and Delivery Gates
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
Delegated tasks MUST define the deliverable, allowed paths, verification, and whether the
task is read-only or may edit. Parallel agents MUST NOT receive overlapping write scopes.
The primary agent retains ownership of integration, review, final verification, and the
user-facing result. A permanent context-heavy sub-agent registry is forbidden unless the
user explicitly requests one.

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

The root `.specify/` project owns workspace governance and cross-cutting features.
App- and package-specific features MUST use scoped feature directories such as
`specs/apps/<app>/<feature>` and `specs/packages/<package>/<feature>`. A member may receive
its own `.specify/` project only when it has genuinely independent governance, release,
or backlog needs. Because Spec Kit constitutions do not inherit automatically, every
member project MUST reference and remain compliant with this root constitution. Agents
MUST use `SPECIFY_INIT_DIR` to select a member project and `SPECIFY_FEATURE_DIRECTORY` to
select its feature; ambiguous scope is a blocking error, not permission to write into the
nearest convenient directory.

## Architecture and Artifact Standards

The preferred monorepo and component shape is:

```text
apps/
└── <app>/
    └── src/
        ├── app/                    # bootstrap, providers, routing
        ├── routes/                 # thin route composition
        └── features/<feature>/     # app-owned product capabilities
packages/
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
6. Implement in small coherent changes with non-overlapping package ownership.
7. Review the diff and run package-level checks before affected workspace checks.
8. Converge implementation against the specification, plan, and tasks.
9. Update shared context or handoff state before pausing or transferring work.

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

**Version**: 1.0.0 | **Ratified**: 2026-08-24 | **Last Amended**: 2026-08-24
