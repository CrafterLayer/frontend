# Testing Strategy

The root `pnpm verify` command is the local and CI quality contract. Tests remain closest to their
owner and expand from fast deterministic checks to rendered browser evidence.

## Layers

| Layer                    | Owner and tool                                           | Required evidence                                                          |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Repository contract      | `@craftkit/workspace-tools`, Node test runner            | Positive and negative graph/component fixtures plus real workspace pass    |
| Unit/pure logic          | Owning member, Vitest or Node test runner                | Inputs, outputs, edge cases, and error contracts                           |
| React component          | Colocated `*.test.tsx`, Vitest + Testing Library + jsdom | Accessible queries, realistic interaction, disabled/error/loading behavior |
| Component catalog        | Colocated typed CSF + MDX, Storybook                     | Representative deterministic states and authored usage documentation       |
| Browser interaction/a11y | Storybook Vitest addon + Playwright Chromium + axe       | Story play functions and configured a11y violations fail CI                |
| Member integration       | Owning app/package                                       | Public API and real provider/transport boundaries                          |
| Product journey          | Future owning product app                                | Critical browser workflow only after an app and runtime exist              |
| Release/build            | Turbo, Vite, Storybook                                   | Package output and static catalog build with declared cache artifacts      |

The current foundation has no product app, so it does not invent browser end-to-end product
journeys. That layer becomes mandatory when app-scoped specifications identify critical flows.

## UI definition of done

Every component folder contains exactly one substantive production component plus:

```text
ComponentName.tsx
ComponentName.stories.tsx
ComponentName.docs.mdx
ComponentName.test.tsx
index.ts
```

The component validator checks presence. ESLint checks React/Hook structure, TypeScript checks the
public API, Testing Library checks behavior, Storybook play checks rendered interaction, axe checks
detectable accessibility violations, and the static build checks catalog integration. No single
layer replaces the others.

Automated axe results do not prove complete accessibility. Keyboard behavior, visible focus,
semantics, accessible naming, content constraints, RTL, responsive behavior, and eventual manual
screen-reader checks remain part of review.

## Commands by scope

```bash
# Fast package evidence
pnpm --filter @craftkit/workspace-tools test
pnpm --filter @craftkit/ui test
pnpm --filter @craftkit/ui test:coverage

# Real browser and catalog evidence
pnpm --filter @craftkit/storybook test:storybook
pnpm --filter @craftkit/storybook build-storybook

# Repository contracts
pnpm check:workspace
pnpm check:components
pnpm check:boundaries

# Full local/CI evidence
pnpm verify
```

The shared React coverage baseline is 90% statements, lines, and functions plus 85% branches.
Coverage is a regression signal, not permission to assert implementation details or substitute
snapshots for behavior.

## Test authoring rules

- Tests use accessible roles, names, labels, text, and realistic user events.
- Tests remain deterministic and do not call production APIs or require credentials.
- Tests cover failure, disabled, loading, cancellation, and recovery when those states exist in the
  public contract.
- Snapshot-only tests are not acceptable evidence.
- Story play functions test behavior visible in the catalog; deeper logic remains in the owning
  unit/component suite.
- Shared provider renderers move into an intentional testing-helper package only after two real
  consumers exist. `@craftkit/test-config` owns configuration, not product fixtures.

## CI and trust boundary

CI installs the frozen lockfile, installs the Playwright-managed Chromium runtime, and runs
`pnpm verify`. Cache writes are disabled for untrusted fork pull requests. Hosted CI is not
considered verified until a real GitHub workflow completes; local parity proves only the command and
source contract.
