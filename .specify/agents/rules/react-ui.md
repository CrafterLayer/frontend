# React 19 and UI Component Rules

Load this file for React components, hooks, UI architecture, Storybook, component
documentation, accessibility, or component tests. The constitution is authoritative.

## Current Baseline

- Target the latest patched React 19.2 release. React 19.2.8 was the latest verified
  release on 2026-08-24; re-check before installing or upgrading.
- Keep `react` and `react-dom` on exactly the same version.
- Use TypeScript, the modern JSX transform, development Strict Mode, and the recommended
  `eslint-plugin-react-hooks` preset in CI.
- If React Server Component transport packages are present, verify the current React
  security advisories before release. React 19.2.0 through 19.2.3 are forbidden for
  those packages; use the current patched line (19.2.8 at this verification date).

## Component Boundaries

- One substantive component per `.tsx` file is mandatory.
- Declare components at module top level. Never declare a component inside another
  component, Hook, callback, loop, condition, story, or test helper.
- Never keep sibling components below the main export in the same file.
- Extract meaningful `renderHeader()`, `renderRow()`, or other JSX-returning helpers into
  named components with explicit props.
- Small inline conditions, `.map()` callbacks, and local event handlers may stay local
  only when they are not independent UI units.
- Use named components and explicit props. Keep props narrow; pass behavior or data the
  child needs rather than an entire store, response, or parent object.
- Pages and routes are thin composition shells. They do not own large product UI trees.

## Preferred Folder Pattern

Use the nearest owning feature for product UI and `packages/ui` for domain-agnostic
primitives:

```text
apps/<app>/src/features/<feature>/components/ComponentName/
packages/ui/src/components/ComponentName/
```

Every component folder uses this contract:

```text
ComponentName/
├── ComponentName.tsx
├── ComponentName.stories.tsx
├── ComponentName.docs.mdx
├── ComponentName.test.tsx
├── index.ts
├── types.ts                 # when types are shared or exported
├── styles.ts                # when component-owned styling needs a module
├── constants.ts             # static configuration only
├── utils.ts                 # pure non-JSX helpers only
├── use-<behavior>.ts        # reusable stateful behavior only
└── SubcomponentName/        # same complete contract when it is a real component
```

Do not create empty support files for symmetry. Do not put JSX in `.ts` files. Use a
local `index.ts` as the public surface; avoid broad barrels that create cycles or expose
component internals.

## React Purity, State, and Effects

- Components and Hooks are pure and idempotent. Never mutate props, state, context,
  Hook arguments, module globals, or values already passed to JSX.
- Do not call `Date.now()`, random generators, DOM mutations, storage, analytics, or
  network operations during render.
- Keep state minimal. Derive values during render when they can be calculated from props
  or state. Do not mirror derived values through an Effect.
- Keep local state local. Lift only genuinely shared state to the closest common owner.
- Effects synchronize with external systems. User-caused work belongs in event handlers
  or Actions. Subscriptions and resources require symmetric cleanup and complete deps.
- Normal Hooks run only at the top level of a component or custom Hook, before early
  returns. Custom Hooks begin with `use`, remain pure, and model a concrete behavior.
- Never call a component as a normal function; render it through JSX.

## React 19 APIs

- Accept `ref` as a prop in new function components. Do not introduce `forwardRef` in
  new React 19 code. Use imperative refs only when a declarative prop cannot express the
  interaction.
- Pass an initial value to `useRef`. Ref callbacks MUST use a block body when assigning
  and MUST NOT implicitly return the assignment; return a cleanup function only when it
  is intentionally the ref cleanup. Do not read or write refs during render except for
  safe one-time initialization.
- Prefer Actions for mutation workflows when they simplify pending, error, and result
  state. Use `useActionState` for Action result/pending state and `useFormStatus` inside
  a descendant of its owning form.
- Use `useOptimistic` only for a real optimistic experience with defined failure recovery.
- Use `useTransition` when the UI needs pending state. If an async Transition performs a
  state update after `await`, wrap that update in another Action/Transition as required
  by the current React behavior; do not assume the outer transition retains the context.
- Use `useEffectEvent` only for non-reactive logic called from an Effect. Never use it to
  hide missing dependencies, pass it to children, or call it outside Effect logic.
- `use` may be conditional or iterative, unlike normal Hooks, but only inside a component
  or Hook. Never wrap it in `try/catch`; use Suspense and an Error Boundary. Reuse a
  cached Promise rather than creating an uncached request during render.
- Add `'use client'` only at the narrowest interactive boundary when the selected
  framework supports Server Components. Server Components contain no browser APIs,
  client state, or Effects. `'use server'` marks Server Functions, not components.

Do not add legacy context, string refs, function-component `propTypes` or `defaultProps`,
`ReactDOM.render`, `ReactDOM.hydrate`, `findDOMNode`, `useFormState`, access to
`element.ref`, `react-test-renderer`, shallow rendering, or `react-dom/test-utils`. Use
TypeScript props, parameter defaults, modern roots, `useActionState`, React Testing
Library, and `act` from `react` only when direct `act` is necessary.

## Optional React Compiler

React Compiler is a plan-level toolchain decision, not an implicit dependency. If a plan
enables it, pin its version, retain the recommended Hooks lint preset, preserve existing
manual memoization until behavior is verified, and rely on compiler memoization for new
code. Add `memo`, `useMemo`, or `useCallback` only for measured performance or semantic
identity requirements, not as a default ritual.

## Required Storybook Story

Every UI component has `<ComponentName>.stories.tsx` using typed CSF:

- declare metadata with `satisfies Meta<typeof ComponentName>`;
- derive stories from `StoryObj<typeof meta>`;
- enable `tags: ['autodocs']`;
- use args and controls for the public component API;
- include the default state and every meaningful variant;
- include applicable loading, empty, error, disabled, overflow, RTL, and responsive states;
- use decorators for required providers rather than importing the application shell; and
- add a `play` interaction when it validates behavior that belongs in the story.

Stories MUST be deterministic. They do not call real production APIs, depend on developer
credentials, or hide required providers in global mutable state.

## Required Component Documentation

Every UI component has `<ComponentName>.docs.mdx` attached to its story module with
Storybook's `Meta` Doc Block. It documents:

1. purpose and ownership;
2. when to use and when not to use;
3. public props and defaults;
4. variants and state behavior;
5. accessibility semantics and keyboard behavior;
6. responsive, RTL, theme, and content constraints where relevant;
7. composition examples; and
8. any known limitations.

The Storybook config MUST include both `**/*.stories.tsx` and `**/*.docs.mdx`. Autodocs
supplements MDX; it does not replace the required usage guidance.

## Required Component Test

Every UI component has `<ComponentName>.test.tsx` using React Testing Library or the
approved equivalent. Tests MUST:

- exercise user-visible behavior rather than internal state or component instances;
- prefer accessible roles, names, labels, and text queries;
- use realistic user interactions for interactive components;
- cover the primary state plus important edge, disabled, error, and keyboard behavior;
- verify callback contracts and async outcomes where relevant;
- include accessibility assertions when the configured toolchain supports them; and
- avoid snapshot-only coverage.

A feature-level integration test may add confidence, but it does not remove the required
component test. Shared helpers and provider renderers belong in the workspace testing
package once that package is established.

## Completion Gate

A new UI component is incomplete unless all five artifacts exist and agree:

1. implementation;
2. local public export;
3. typed story;
4. MDX documentation; and
5. behavioral test.

Before handoff, run the narrow component test, typecheck/lint for the owning package,
Storybook build, and affected application or workspace checks when configured.

## Primary References

- React versions: https://react.dev/versions
- React releases: https://github.com/react/react/releases
- Rules of React: https://react.dev/reference/rules
- Avoid unnecessary Effects: https://react.dev/learn/you-might-not-need-an-effect
- React 19 upgrade guide: https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- React 19.2: https://react.dev/blog/2025/10/01/react-19-2
- React Server Components security advisory: https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components
- Storybook TypeScript stories: https://storybook.js.org/docs/writing-stories/typescript
- Storybook MDX: https://storybook.js.org/docs/writing-docs/mdx
- Testing Library principles: https://testing-library.com/docs/
