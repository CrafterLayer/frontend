# Frontend Architecture

**Status:** React and component baseline is approved; framework and supporting tools are
not selected yet.

## Composition Model

Frontend code follows feature-first composition:

```text
app bootstrap
  -> route shell
    -> feature composition root
      -> feature components and hooks
        -> shared package public APIs
```

Route files stay thin. They select data and compose features; they do not become stores,
API clients, or collections of inline components. Feature slices own product behavior,
while `packages/ui` remains domain-agnostic.

## App Feature Shape

```text
apps/<app>/src/features/<feature>/
├── api/                 # feature transport adapters when app-owned
├── components/          # app/feature-owned UI composition
├── hooks/               # concrete reusable feature behavior
├── model/               # state and domain transformations
├── schemas/             # runtime validation contracts when needed
├── utils/               # focused pure helpers only
├── types.ts             # feature public types when needed
└── index.ts             # narrow feature public entrypoint
```

Create only folders with real responsibilities. Do not scaffold every optional folder
for a small feature.

## Component Contract

One substantive React component owns one `.tsx` file. Never define a component inside
another component, callback, Hook, loop, or condition. Extract meaningful JSX-returning
helpers and sibling components into their own component folders.

Every new UI component is complete only with:

```text
ComponentName/
├── ComponentName.tsx
├── ComponentName.stories.tsx
├── ComponentName.docs.mdx
├── ComponentName.test.tsx
├── index.ts
└── optional focused support files
```

The story demonstrates representative states and accessibility behavior. The test covers
user-visible behavior and interactions. The MDX document owns component usage, API,
variants, states, and accessibility notes.

## State and Data Boundaries

- Keep local UI state local.
- Derive values during render instead of mirroring them through Effects.
- Use Effects only to synchronize with external systems.
- Keep transport details behind typed feature or integration boundaries.
- Avoid a workspace-wide mega-context or store; introduce shared state only for a proven
  cross-tree responsibility.
- Keep domain and server state out of domain-agnostic UI components.

## Server and Client Boundaries

React Server Components may be introduced only through a framework that supports them
and only after the approved plan records the boundary. Server code must not use browser
APIs, client state, or Effects. Place `'use client'` at the narrowest interactive edge.

## Verification Contract

For a UI change, verification expands in this order:

1. changed-file formatting and static checks;
2. component behavior and accessibility tests;
3. owning app/package lint and typecheck;
4. Storybook interaction checks and static build;
5. owning app build and browser smoke test; and
6. affected workspace checks when shared contracts changed.

Exact commands remain pending until the first approved technical plan selects the
toolchain.

## Staleness Condition

Update this document when the framework, state/query strategy, rendering boundary,
design-system ownership, or component completion contract changes.
