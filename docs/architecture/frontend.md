# Frontend Architecture

**Status:** React, component, query, and routing-helper baselines are approved; the product
application framework, deployment runtime, app-level route tree, and icon contract are not selected
yet.

## Composition Model

Frontend code follows feature-first composition:

```text
app bootstrap
  -> route shell
    -> feature composition root
      -> feature components and hooks
        -> shared package public APIs
```

Route files stay thin. They select data and compose features; they do not become stores, API
clients, or collections of inline components. Feature slices own product behavior, while
`packages/ui` remains domain-agnostic.

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

Create only folders with real responsibilities. Do not scaffold every optional folder for a small
feature.

## Component Contract

One substantive React component owns one `.tsx` file. Never define a component inside another
component, callback, Hook, loop, or condition. Extract meaningful JSX-returning helpers and sibling
components into their own component folders.

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
user-visible behavior and interactions. The MDX document owns component usage, API, variants,
states, and accessibility notes.

## State and Data Boundaries

- Keep local UI state local.
- Derive values during render instead of mirroring them through Effects.
- Use Effects only to synchronize with external systems.
- Keep transport details behind typed feature or integration boundaries.
- Avoid a workspace-wide mega-context or store; introduce shared state only for a proven cross-tree
  responsibility.
- Keep domain and server state out of domain-agnostic UI components.

## Shared Query Boundary

`@craftkit/query` owns the workspace's TanStack Query adapter surface. Applications create their own
client with `createQueryClient` and pass it to `QueryProvider`. A browser app may own one client per
root; a server-rendered app creates one per request. The package never owns a module-global
QueryClient, application query keys, transport logic, notifications, or domain state.

The current package baseline uses TanStack Query 5.102.2. The exact version remains in the root
dependency catalog and changes only through a dependency review that respects the workspace
minimum-release-age policy.

## Shared Routing Boundary

`@craftkit/routing` owns framework-neutral React Router v8 exports plus two performance helpers:

- `createDeferredRoutePatcher` keeps a small stable route tree and loads child branches through
  React Router's `patchRoutesOnNavigation` contract.
- `lazyWithRetry` creates a typed lazy component with explicit code preloading and bounded
  recognized-chunk recovery.

Applications still own route ids, route objects, loaders/actions, authorization, error elements,
pending UI, and the app router instance. React Router v8 shared APIs come from `react-router`; DOM
`RouterProvider` comes from `react-router/dom`. Do not add `react-router-dom` to new members.

Every expensive destination is evaluated as two independent warm-up layers: route code prefetch and
the first TanStack Query data prefetch. Intent prefetch belongs on `pointerenter`, `pointerdown`,
and keyboard `focus`, and must be safe to repeat.

## Reserved Icon Package

`@craftkit/icons` currently reserves a private workspace package identity only. It exposes package
metadata but has no root runtime entry, source, glyph, dependency, build, test, or Storybook
contract. Do not treat the placeholder as an approved icon system; adding one requires a separate
scoped specification and dependency decision.

## Server and Client Boundaries

React Server Components may be introduced only through a framework that supports them and only after
the approved plan records the boundary. Server code must not use browser APIs, client state, or
Effects. Place `'use client'` at the narrowest interactive edge.

## Verification Contract

For a UI change, verification expands in this order:

1. changed-file formatting and static checks;
2. component behavior and accessibility tests;
3. owning app/package lint and typecheck;
4. Storybook interaction checks and static build;
5. owning app build and browser smoke test; and
6. affected workspace checks when shared contracts changed.

Shared package verification uses owner lint, typecheck, coverage, build, and `check:size`, then
`pnpm check:bundles` and the full workspace verification. Product applications must also report
their emitted route chunks and runtime navigation evidence once an app exists.

## Staleness Condition

Update this document when the framework, query lifecycle, routing helper contract, icon placeholder
status, rendering boundary, design-system ownership, or component completion contract changes.
