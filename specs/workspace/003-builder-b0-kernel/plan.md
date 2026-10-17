# Implementation Plan: Builder B0 Kernel Foundation

**Branch**: `003-builder-b0-kernel` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/workspace/003-builder-b0-kernel/spec.md`

## Summary

Create the headless document kernel for the Crafterlayer builder as two new internal-mode workspace
packages — `@craftkit/builder-schema` (contracts, validators, definition helpers; zero runtime
dependencies beyond zod) and `@craftkit/builder-core` (document store, validated command dispatch,
transactions with inverse patches, history, extension manager, contribution catalogs, ports with
in-memory persistence). The JSON document is the single source of truth; every mutation passes one
validated door; tier-2 (database-sourced) extensions are declarative-only by type and by runtime
check; behavior is deterministic under injected clock/id ports. All laws are enforced structurally
(types + eslint + workspace validators + tests), not by convention. Non-normative reference
material: `specs/workspace/builder-core/*.md` and the reviewed execution plan (5 review rounds). The
contracts in [contracts/builder-kernel.md](./contracts/builder-kernel.md) are the normative data
contracts for this feature.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (catalog), ES2024 lib only for builder packages (no DOM lib —
DOM usage is a compile error)

**Primary Dependencies** (all new catalog entries, registry-verified 2026-08-25, all older than the
24h `minimumReleaseAge`):

- `zod@4.4.3` — schema/validation + `z.toJSONSchema` (same version already in the lockfile
  transitively → dedupes; verified locally: `zod/v4/core/to-json-schema` ships)
- `immer@11.1.18` — `produceWithPatches`/`enablePatches`/`applyPatches`; `Patch` shape
  `{ op: "replace"|"remove"|"add"; path: (string|number)[]; value? }` (verified against published
  d.ts — API unchanged from v10)
- `zustand@5.0.15` — vanilla store only (`zustand/vanilla`); all peer deps optional (verified
  `peerDependenciesMeta`) so `strictPeerDependencies` passes without React
- `nanoid@6.0.1` — ESM-only, Node 24-compatible (verified `engines`)
- `fast-check@4.9.0` — property-based tests (dev-only; new transitive `pure-rand@^8`)

**Storage**: In-memory `PersistenceAdapter` only (`createMemoryPersistence`), exposed from
`@craftkit/builder-core/testing`. No network, no database in B0.

**Testing**: Vitest 4.1.11 via a new additive `@craftkit/test-config/node` export (node environment,
no react plugin, no jsdom, same 85/90/90/90 coverage thresholds); property-based suites with
fast-check; colocated `*.test.ts`.

**Target Platform**: Headless Node 24 (kernel is environment-agnostic ES2024; browser integration
arrives in B1+, not here)

**Project Type**: Two internal workspace library packages + additive tooling changes

**Performance Goals**: Catalog lookups O(1) (flat cost 10→1,000 contributions); single-property
change notifies exactly 1 element subscriber on the 1,000-node stress document; full structural
validation < 150 ms at 1,000 nodes (spec SC-005/SC-006). Deterministic Lane-A assertions only
(counting, not timing) except the validation budget.

**Constraints**: Zero runtime React/DOM/network in both packages (eslint
`no-restricted-imports`/`no-restricted-globals` + ES2024-only lib + boundary validators, all
CI-fatal); documents JSON-pure by type (`JsonValue`); every mutation via one validated dispatch
door; determinism under injected `ClockPort`/`IdPort`.

**Scale/Scope**: 2 new packages (~60 source/test files), 4 existing tooling packages touched
additively, 1,000-node stress fixture, ≥1,000 randomized property-test sessions in CI.

## Constitution Check

_GATE: evaluated against constitution v1.0.0 before Phase 0; re-checked after Phase 1._

| Principle                                | Status                | Evidence                                                                                                                                                                                                                                                |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec Kit source of truth              | PASS                  | This feature runs the full lifecycle in `specs/workspace/003-builder-b0-kernel/`; builder-core docs demoted to non-normative references; no policy copied into AGENTS/CLAUDE files.                                                                     |
| II. React 19 baseline                    | PASS (N/A at runtime) | B0 ships zero React runtime code. `@types/react@19.2.18` (catalog) is used for type-only `ComponentType` references in schema; value imports are lint-fatal.                                                                                            |
| III. One component per TSX               | PASS (vacuous)        | No `.tsx` files and no React components exist in B0.                                                                                                                                                                                                    |
| IV. UI component completeness            | PASS (vacuous)        | No UI components are created; the component artifact matrix is intentionally empty. First UI arrives in B1 under its own feature.                                                                                                                       |
| V. Evidence-based quality                | PASS                  | Verification plan below runs narrowest-first and ends with full `pnpm verify`; negative proofs are explicit tasks.                                                                                                                                      |
| VI. Shared context & delegation          | PASS                  | HANDOFF/MEMORY updated at phase boundaries; no context-heavy agent registry created.                                                                                                                                                                    |
| VII. Commit integrity                    | PASS                  | Conventional Commits, package-scoped; messages proposed via `/speckit-workspace-commit`; no commit without explicit user authorization.                                                                                                                 |
| VIII. Monorepo boundaries & scoped specs | PASS                  | Workspace scope declared (below); new packages expose single public entrypoints (`.` plus one approved `./testing` subpath on builder-core); dependency graph acyclic and validated; `SPECIFY_FEATURE_DIRECTORY=specs/workspace/003-builder-b0-kernel`. |

**Post-Phase-1 re-check (2026-08-25)**: contracts/data-model introduce no violation — no UI
artifacts, no deep imports, no app involvement. GATE: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/workspace/003-builder-b0-kernel/
├── spec.md              # behavioral requirements (laws as testable behavior)
├── plan.md              # this file
├── research.md          # decisions with rationale/alternatives (Phase 0)
├── data-model.md        # entities, validation rules, transitions (Phase 1)
├── quickstart.md        # runnable validation guide (Phase 1)
├── contracts/
│   └── builder-kernel.md  # normative TypeScript contracts (fenced blocks; 001 precedent)
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
pnpm-workspace.yaml                  # + glob "packages/builder/*"; + catalog pins (§research R1)
eslint.config.mjs                    # + headlessConfig([...]) composition for builder paths

packages/typescript-config/
└── headless.json                    # NEW additive: base.json + lib:["ES2024"] (no DOM)

packages/test-config/
├── package.json                     # + "./node" export
└── src/node.mjs (+ node.d.ts)       # NEW additive: createNodeTestConfig

packages/eslint-config/
├── package.json                     # + "./headless" export
└── src/headless.mjs                 # NEW additive: headlessConfig(files) factory

packages/workspace-tools/
├── src/workspace/discover-workspace.mjs        # + MEMBER_ROOTS entry packages/builder
├── src/workspace/validate-builder-boundaries.mjs  # NEW: layer law validator
├── (error messages / README / JSDoc updated where "apps/* and packages/*" was asserted)
└── test/builder-boundaries.test.mjs            # NEW

packages/builder/                    # grouping folder (no package.json)
├── schema/                          # @craftkit/builder-schema  (deps: zod)
│   ├── package.json                 # exports { ".": "./src/index.ts" } — internal mode
│   ├── tsconfig.json                # extends @craftkit/typescript-config/headless.json
│   ├── vitest.config.ts             # createNodeTestConfig
│   └── src/
│       ├── index.ts                 # single public entrypoint
│       ├── json/json-value.ts       # JsonValue type + isJsonValue walk (finite numbers)
│       ├── document/types.ts        # BuilderDocument, Node, slots map
│       ├── document/validate.ts     # structural + registry-aware validator checklists
│       ├── document/migrations.ts   # sequential migration contract (Law M)
│       ├── blocks/define-block-schema.ts   # defineBlockSchema + JSON-purity of prop schemas
│       ├── blocks/style-values.ts   # no-hex/no-px law
│       ├── extensions/manifests.ts  # Trusted/Declarative manifest union (Law T)
│       ├── extensions/contribution-points.ts
│       ├── extensions/validate-tier2.ts    # structural function-rejection (defense-in-depth)
│       ├── widgets/contract.ts      # widget type + skin defs
│       ├── widgets/validate-skin.ts # four-state gate
│       ├── json-schema.ts           # z.toJSONSchema derivation for AI context
│       └── errors.ts               # typed, path-addressed error taxonomy
└── core/                            # @craftkit/builder-core  (deps: schema, immer, nanoid, zustand)
    ├── package.json                 # exports { ".": "...", "./testing": "./src/testing/index.ts" }
    ├── tsconfig.json                # extends headless.json
    ├── vitest.config.ts             # createNodeTestConfig
    └── src/
        ├── index.ts
        ├── ports/{clock.ts,ids.ts,persistence.ts,data-source.ts}   # port interfaces
        ├── ports/{system-clock.ts,system-ids.ts}   # ONLY files allowed Date.now()/nanoid
        ├── kernel/create-builder.ts # kernel assembly; store module-private (Law S)
        ├── kernel/context.ts        # KernelContext read-only facade
        ├── state/{store.ts,selectors.ts,selection.ts}
        ├── commands/{define-command.ts,core-commands.ts,dispatch.ts}  # Laws V/C
        ├── patches/{apply.ts,log.ts}               # replay + coalescing log
        ├── history/history.ts       # inverse-patch undo/redo + typing merge
        ├── registry/{registry.ts,hydrate-declarative.ts}  # O(1) catalogs + tier-2 hydration
        ├── extensions/manager.ts    # register → topo → setup → dispose; tier-2 rejection
        ├── events/bus.ts            # typed event bus
        ├── keymaps/keymaps.ts       # data-only keymap contributions
        └── testing/{index.ts,fixtures.ts,stress.ts,fake-extension.ts,memory-persistence.ts,fixed-ports.ts}
```

**Structure Decision**: Internal-packages mode (exports map to `./src/index.ts`, no build step)
following the `@craftkit/test-config` precedent — builder packages are consumed only inside the
workspace in B0; extraction/build tooling is a later-milestone concern. `packages/builder/` is a
grouping folder without a manifest (glob `packages/builder/*` matches only its children).

## Workspace Planning Details (rules/monorepo.md)

**Affected members (exact)**:

- NEW: `packages/builder/schema` (`@craftkit/builder-schema`), `packages/builder/core`
  (`@craftkit/builder-core`)
- MODIFIED (additive only): `packages/typescript-config`, `packages/test-config`,
  `packages/eslint-config`, `packages/workspace-tools`, root `pnpm-workspace.yaml`, root
  `eslint.config.mjs`
- UNTOUCHED: `apps/storybook`, `packages/ui`, `packages/query`, `packages/routing`,
  `packages/icons`, `turbo.json` (existing tasks suffice; contract tests unaffected)

**File ownership**: every new source file is owned by exactly one of the two new packages; tooling
additions are owned by their tooling package; no shared dumping ground is created.

**Public API changes**:

- `@craftkit/builder-schema`: new package, single `"."` entrypoint.
- `@craftkit/builder-core`: new package, `"."` plus approved `"./testing"` subpath (fixtures, fake
  extension, memory persistence, fixed ports — needed by B1+ package tests; the alternative, a third
  package, adds a workspace member for no contract gain).
- `@craftkit/typescript-config`: + `./headless.json` export.
- `@craftkit/test-config`: + `./node` export.
- `@craftkit/eslint-config`: + `./headless` export.
- `@craftkit/workspace-tools`: discovery covers `packages/builder/*`; new builder-boundaries
  validator wired into `check-workspace`.

**Dependency direction (before → after)**: unchanged for existing members. New edges:
`builder-core → builder-schema`; both → tooling config packages (dev). Layer law enforced by the new
validator: schema(0) ← core(1) ← engines(2) ← shell(3) ← extensions(4) ← editor(5); extensions never
depend on extensions; non-builder members may access the builder family only through the future
`@craftkit/builder` preset — their other dependencies remain governed by existing workspace rules.

**Direct consumers**: none yet (B1 `@craftkit/builder-react`/renderer/playground will consume `.`
and `./testing`). This is deliberate: B0 merges with zero consumer risk.

**Migration impact**: none — no existing package changes behavior; all tooling changes are additive
exports; document `schemaVersion` starts at 1 with the migration registry in place from day one.

**Build/cache/deployment impact**: builder packages have no `build` script (turbo skips absent
scripts; `test.dependsOn ^build` no-ops); existing tasks/caches unaffected; no deployable changes.
`turbo.json` untouched — turbo-contract and root-contract tests keep passing by construction.

**Rollout/rollback**: single-workspace rollout; rollback = delete `packages/builder/*`, remove the
glob + catalog entries + the three tooling exports + validator wiring. No consumer exists, so
rollback is mechanical and safe.

**UI component artifact matrix**: intentionally empty — B0 creates no UI components (constitution IV
vacuously satisfied; first components arrive with B1 under its own feature).

## Enforcement Design (how each law becomes CI-fatal)

| Law                            | Mechanism                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single door + sealed store (S) | zustand instance module-private; `KernelContext` exposes read-only facade + `dispatch`; public `index.ts` exports no raw store; subscription test asserts 1:1 change↔transaction                                      |
| Validated door (V)             | `defineCommand` erases to `RegisteredCommand.apply(unknown)` which `parse`s before the typed handler — malformed args cannot reach handler code (variance-safe under strict TS)                                       |
| JSON purity (J)                | `props`/`responsive` typed `Record<string, JsonValue>`; `defineBlockSchema` rejects non-JSON-representable zod types; dispatch walks patch values (finite numbers); negative tests: function/undefined/bigint/NaN     |
| Determinism (D)                | `ClockPort`/`IdPort` injected; system impls isolated in 2 files; eslint bans `Date.now`/`Math.random`/`nanoid` elsewhere; fixed-port fixtures prove identical logs                                                    |
| Purity (React/DOM-free)        | `headless.json` (lib ES2024 → DOM names fail typecheck) + `headlessConfig` eslint (core `no-restricted-imports` with `allowTypeImports`, verified supported by eslint 10.9.0; `no-restricted-globals`)                |
| Tier split (T)                 | Discriminated manifest union — tier-2 payloads `JsonValue`-typed (functions unrepresentable) + `validate-tier2.ts` structural walk at hydration (defense-in-depth)                                                    |
| Layer law                      | `validate-builder-boundaries.mjs` in `check-workspace` (CI-fatal); bare `turbo boundaries` stays as defense-in-depth                                                                                                  |
| Migrations (M)                 | Sequential registry; load = migrate → validate → open; unreachable version throws before any state exists                                                                                                             |
| Responsive value-only (R)      | `setResponsive` args admit only `(id, breakpoint, key, value)` — structural overrides are unrepresentable; validator additionally rejects any responsive key colliding with structural fields; negative test included |
| Live meta (L)                  | `KernelContext.surface`/`dir` are store-backed getters (never registration-time snapshots); `docMeta.changed` event asserted in tests after `setDocMeta`                                                              |

## Complexity Tracking

No constitution violations to justify. One approved API-discipline exception recorded:
`@craftkit/builder-core` exposes `"./testing"` in addition to `"."` (owner: builder core package;
rationale: B1+ package tests need shared fixtures without a third package; removal condition: if a
dedicated testing package is ever introduced, the subpath is removed in the same change).
