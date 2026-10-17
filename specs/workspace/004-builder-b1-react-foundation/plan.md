# Implementation Plan: Builder B1 View Foundation

**Branch**: `004-builder-b1-react-foundation` | **Date**: 2026-08-25 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from `specs/workspace/004-builder-b1-react-foundation/spec.md`

## Summary

Make the B0 kernel visible: `@craftkit/builder-react` (context provider + kernel hooks + slot
component), `@craftkit/builder-renderer` (pure static renderer, live per-node-subscribed renderer,
breakpoint resolution, token theming, isolated `CanvasFrame`), `@craftkit/builder` (the layer-5
preset — the ONLY entrypoint applications may import, already enforced by ADR 0003), the first real
extension `@craftkit/builder-blocks-marketing` (five landing blocks as mechanically-validated
complete components), and `@craftkit/playground` (isolated Vite app: fixtures, deterministic ports,
theme switcher, dir flip, runtime-registration demo — zero network). Storybook grows to catalog
every new component. No kernel changes.

## Technical Context

**Language/Version**: TypeScript 6.0.3; React 19.2.8 (catalog; exact per constitution II)

**Primary Dependencies**: NO new catalog entries. Everything needed is already pinned:
`react`/`react-dom` 19.2.8, `@types/react`/`@types/react-dom`, `@vitejs/plugin-react` 6.1.0, `vite`
8.2.2, `vitest` 4.1.11, `@testing-library/react` + `jsdom` (view tests), Storybook 10.5.10 stack.
Builder deps come via `workspace:*` on 003's packages.

**Storage**: none new — `createMemoryPersistence` from `@craftkit/builder-core/testing`.

**Testing**: jsdom component tests via `@craftkit/test-config/react` (`@testing-library/react`,
behavior-focused); Storybook browser tests (`test:storybook`, a11y addon set to `error` — FR-016
rides the existing gate); render-count instrumentation for FR-003/SC-002.

**Target Platform**: Browser (jsdom for unit/behavior; Chromium via the existing Storybook
browser-test infra). Kernel packages stay headless-untouched.

**Project Type**: three internal library packages + one preset package + one Vite application +
Storybook config growth.

**Performance Goals**: SC-002 exactly-one block re-render per single-prop change on the 1,000-node
stress fixture (React Profiler/render-counter — Lane A counting); SC-004 theme switch reflected < 1s
(interaction test); static render bit-identical across runs (SC-003).

**Constraints**: layer law (ADR 0003): react=2, renderer=2 — **siblings must not import each
other**, so the renderer subscribes to the kernel through the `StateFacade` directly (its own
`useSyncExternalStore` wiring) and receives the kernel BY PROP; the ergonomic context/hooks live in
builder-react; composition happens only in the layer-5 preset. Apps (playground, storybook) touch
the family only via `@craftkit/builder` (storybook needs no manifest dep — story files load by glob
and resolve imports from their own package context). All block styling is logical-properties CSS
consuming `--t-*` tokens (FR-008/FR-009); px/hex stay out of document props (kernel law) while CSS
files own real values mapped from tokens.

**Scale/Scope**: ~5 workspace members touched/created, ~12 complete component contracts (5 blocks +
Builder + BuilderProvider + Slot + DocumentView + StaticDocument + UnknownBlock + CanvasFrame) +
playground feature components, ~60 files.

## Constitution Check

_GATE: evaluated pre-Phase-0; re-checked post-design._

| Principle                     | Status            | Evidence                                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec Kit source of truth   | PASS              | Full lifecycle in 004; builder-core docs stay non-normative (spec Clarifications record the canvas-frame deviation).                                                                                                                                              |
| II. React 19 baseline         | PASS              | react/react-dom exactly 19.2.8 (catalog); function components + hooks only; no forwardRef (ref-as-prop), no legacy APIs; `useSyncExternalStore` for external kernel state.                                                                                        |
| III. One component per TSX    | PASS              | Every component in its own folder/file; composition roots (`Builder`, playground `App`) stay thin; no sibling declarations.                                                                                                                                       |
| IV. Complete UI components    | PASS (mechanical) | All components live under `src/components/*` (packages) or `src/features/*/components/*` (app) where `check:components` enforces tsx+stories+mdx+test+index; block data files (schema.ts/examples.ts) are extra files the validator permits (verified in source). |
| V. Evidence-based quality     | PASS              | Narrowest-first verification plan below; SC-002 is counted, not assumed.                                                                                                                                                                                          |
| VI. Shared context/delegation | PASS              | Continuity files updated at boundaries; no agent registry.                                                                                                                                                                                                        |
| VII. Commit integrity         | PASS              | `/speckit-workspace-commit` proposal only; no auto-commit.                                                                                                                                                                                                        |
| VIII. Monorepo boundaries     | PASS              | New globs additive; preset is the single app-facing entrypoint (validator-enforced); acyclic by layer construction.                                                                                                                                               |

**Post-design re-check**: no violation introduced; the react↔renderer sibling rule is solved by
design (facade subscription + prop injection), not by exception. GATE: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/workspace/004-builder-b1-react-foundation/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/builder-view.md
├── checklists/requirements.md
└── tasks.md (from /speckit-tasks)
```

### Source Code (repository root)

```text
pnpm-workspace.yaml                 # + glob "packages/builder/extensions/*" (lands with first member)

packages/builder/react/             # @craftkit/builder-react — layer 2
├── package.json                    # internal mode; deps: schema+core (workspace), peer react
├── tsconfig.json                   # extends react-library.json
├── vitest.config.ts                # createReactTestConfig
└── src/
    ├── index.ts
    ├── kernel-context.ts           # React context holding BuilderKernel (value, not component)
    ├── hooks/{use-builder.ts,use-node.ts,use-selection.ts,use-dispatch.ts,use-registry-version.ts}
    └── components/
        ├── BuilderProvider/        # full contract (tsx/stories/mdx/test/index)
        └── Slot/                   # renders a node's named slot children via render-prop

packages/builder/renderer/          # @craftkit/builder-renderer — layer 2 (NO dep on builder-react)
├── package.json                    # deps: schema+core; peer react
└── src/
    ├── index.ts
    ├── resolve/{responsive.ts,theme.ts}   # breakpoint merge; Theme→CSS-vars (--t-*)
    ├── themes.ts                   # starter light/dark token sets
    ├── subscribe.ts                # useSyncExternalStore wiring over StateFacade (internal)
    └── components/
        ├── DocumentView/           # live per-node renderer (kernel BY PROP)
        ├── StaticDocument/         # pure (document, breakpoint, blocks) → markup
        ├── UnknownBlock/           # explicit fallback marker
        └── CanvasFrame/            # in-repo isolation iframe: style mirroring + tokens + dir

packages/builder/editor/            # @craftkit/builder — layer 5 preset (THE entrypoint)
├── package.json                    # deps: core, react, renderer, blocks-marketing (workspace)
└── src/
    ├── index.ts                    # curated re-exports + testing passthrough note
    ├── testing.ts → exports "./testing" re-exporting @craftkit/builder-core/testing
    ├── default-blocks.ts           # defaultBlocks manifest (structural starter set)
    └── components/
        ├── Builder/                # <Builder> = provider + CanvasFrame + DocumentView composition
        └── Page/                   # structural root block (full contract + schema.ts/examples.ts)

packages/builder/extensions/blocks-marketing/   # @craftkit/builder-blocks-marketing — layer 4 (by path)
├── package.json                    # deps: schema; peer react; sideEffects ["**/*.css"]
└── src/
    ├── index.ts                    # defineExtension-style manifest: blocksMarketing
    └── components/{Hero,Features,Pricing,Testimonials,Cta}/
        # each: Name.tsx · Name.css · Name.stories.tsx · Name.docs.mdx · Name.test.tsx
        #        · index.ts · schema.ts · examples.ts   (triad colocated, contract mechanical)

apps/playground/                    # @craftkit/playground — imports ONLY @craftkit/builder
├── package.json                    # deps: @craftkit/builder (workspace), react, react-dom
├── index.html · vite.config.ts · tsconfig.json · vitest.config.ts
└── src/
    ├── main.tsx                    # createRoot bootstrap
    ├── app/App.tsx                 # thin composition shell
    └── features/preview/
        ├── create-playground-kernel.ts   # fixtures + deterministic ports + memory persistence
        ├── demo-extension.ts             # runtime-registration demo (announcement block)
        └── components/{ThemePicker,DirectionFlip,FixturePicker,RegisterDemoExtension}/
            # each: full 5-artifact contract

apps/storybook/.storybook/main.ts   # + story/docs globs for packages/builder/** and extensions/**
packages/workspace-tools/…          # ONLY if a validator gap appears (none expected — verified)
```

**Structure Decision**: internal-packages mode continues (src exports, no build) for all four new
packages; the playground is a real Vite app (dev/build/test). The extensions glob
`packages/builder/extensions/*` enters `pnpm-workspace.yaml` in the same change as its first member.
Layer names react/renderer/preset are already in the ADR 0003 layer map; blocks-marketing resolves
to layer 4 by path.

## Workspace Planning Details (rules/monorepo.md)

**Affected members (exact)**: NEW `packages/builder/react`, `packages/builder/renderer`,
`packages/builder/editor` (`@craftkit/builder`), `packages/builder/extensions/blocks-marketing`,
`apps/playground`. MODIFIED (additive): `pnpm-workspace.yaml` (one glob),
`apps/storybook/.storybook/main.ts` (story globs). UNTOUCHED: kernel packages (schema/core),
ui/query/routing/icons, turbo.json, eslint/test/ts config packages.

**Public API changes**: each new package exposes `"."` only, except the preset which adds
`"./testing"` (same rationale/approved shape as builder-core's). The preset is the only surface
applications may consume (ADR 0003 `BUILDER_FAMILY_ACCESS`).

**Dependency direction (all downward)**: react→{core,schema}; renderer→{core,schema};
blocks-marketing→{schema}; editor→{blocks-marketing,renderer,react,core,schema};
playground→{editor}. No sibling edges at layer 2 (renderer gets the kernel by prop).

**Direct consumers**: playground and storybook stories consume the new packages; nothing else
changes. Migration impact: none (kernel untouched; additive only).

**Build/cache/deploy impact**: playground adds standard `dev`/`build` (vite) using existing turbo
tasks; internal packages add no build. Storybook input globs widen —
`build-storybook`/`test:storybook` naturally cover the new stories.

**Rollout/rollback**: delete the four packages + playground, drop the glob and the storybook globs —
kernel and all 003 guarantees stand alone.

**UI component artifact matrix** (all mechanically validated by `check:components`):

| Component                                                        | Package/App       | Extra files                            |
| ---------------------------------------------------------------- | ----------------- | -------------------------------------- |
| BuilderProvider, Slot                                            | builder-react     | —                                      |
| DocumentView, StaticDocument, UnknownBlock, CanvasFrame          | builder-renderer  | —                                      |
| Builder                                                          | @craftkit/builder | —                                      |
| Hero, Features, Pricing, Testimonials, Cta                       | blocks-marketing  | `schema.ts`, `examples.ts`, `Name.css` |
| ThemePicker, DirectionFlip, FixturePicker, RegisterDemoExtension | playground        | —                                      |

Each row = `Name.tsx` + `Name.stories.tsx` + `Name.docs.mdx` + `Name.test.tsx` + `index.ts`; stories
cover default + meaningful variants + RTL/theme states where applicable; interactive stories add
`play` checks; a11y addon runs at `error`.

## Enforcement Design (feature-level laws)

| Rule                        | Mechanism                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Apps import preset only     | ADR 0003 validator (`BUILDER_FAMILY_ACCESS`) — already CI-fatal                                                                       |
| No layer-2 sibling imports  | Layer law (`BUILDER_LAYER_VIOLATION` on 2→2) + design (kernel by prop)                                                                |
| Component completeness      | `check:components` discovers all new `src/components/*` dirs mechanically                                                             |
| Scoped re-render (FR-003)   | render-counter probe components in tests + stress fixture; counted, not timed                                                         |
| Static purity (FR-006)      | double-render byte equality + no-kernel-required type signature                                                                       |
| Token theming (FR-008)      | themes are `Record<TokenName,string>`; `themeToCssVars` unit-tested; recolor interaction test                                         |
| Direction (FR-009)          | CSS logical properties only in block styles (reviewed) + `dir` on frame root asserted                                                 |
| Isolation (FR-014/018)      | playground has zero network code; CanvasFrame mirrors styles into the iframe; tests assert no fetch usage and frame-contained styling |
| Kernel laws intact (FR-017) | view tests dispatch through `kernel.dispatch` only; Law-S audit re-run with a mounted view                                            |

## Complexity Tracking

No constitution violations. Approved exceptions carried forward: preset `"./testing"` subpath (same
owner/rationale/removal condition as builder-core's). Deviation from reference docs (no Puck vendor
pass in B1) is recorded in spec Clarifications and revisits at B2 where the drag/zone machinery is
consumed.
