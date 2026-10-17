# Implementation Plan: Builder B3a Inspector, Devices & Preview

**Branch**: `main` (feature directory scoped) | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/workspace/007-builder-b3a-inspector-devices/spec.md`

## Summary

A generated Inspector (zod-introspected default field library + the B0 field-type contribution point
consumed live), a DeviceBar with the declared bucket thresholds driving both the preview frame width
and the responsive editing bucket (`setProp` vs `setResponsive` through the door), and a PreviewMode
built on the publish-safe render path with a view-state direction flip. Zero new dependencies; rich
text deferred to B3b.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict), React 19.2.8

**Primary Dependencies**: none new (R1). Shell grows on
`@craftkit/builder-{schema,core, renderer}` + zod (already a shell devDep → becomes a runtime dep of
shell for introspection — zod is ALREADY a core runtime dep, so no catalog change)

**Storage**: none — device/preview state is view state; every document change is a kernel
transaction

**Testing**: vitest 4 jsdom (injected geometry ports as before; field/bucket logic is pure) +
Storybook Chromium play() + a11y error gate

**Target Platform**: browser

**Project Type**: monorepo workspace feature — shell package growth + one additive registry read
(schema+core) + additive canvas width input + preset surface + playground composition

**Performance Goals**: no new hot paths — inspector renders on selection/document change only;
counting proofs per R9

**Constraints**: shell no-context law (kernel by prop); Law R (values only per bucket);
zero-panel-code per block; focus-safe field swaps (R8)

**Scale/Scope**: ~8 new shell modules, 3 new full-contract components (Inspector, DeviceBar,
PreviewMode) + field controls as internal modules, ≈45 new tests

## Constitution Check

_GATE: evaluated before Phase 0; re-evaluated after Phase 1 design — PASS (×2)._

- **Explicit workspace scope** — PASS: writes confined to `packages/builder/shell`,
  `packages/builder/schema` + `core` (one additive read), `packages/builder/renderer` (additive
  `frameWidth` on the canvas — no, the WIDTH lands on EditorCanvas in shell; renderer untouched),
  `packages/builder/editor` (re-exports), `apps/playground`.
- **Dependency direction** — PASS: no new edges; zod moves from shell devDep to dep (zod is
  layer-0's own runtime dep — no boundary change); negatives re-run at the gate.
- **Complete component contract** — PASS: Inspector/DeviceBar/PreviewMode ship 5-artifact contracts;
  field controls are internal non-exported modules with colocated tests (the drag-chrome precedent).
- **One component per `.tsx`** — PASS: one component file each; field controls one per file.
- **Tests mandatory** — PASS: law-proof table in quickstart maps every FR/SC.
- **No commits without explicit authorization** — PASS: proposal-only remains standing.

## Project Structure

### Documentation (this feature)

```text
specs/workspace/007-builder-b3a-inspector-devices/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/builder-inspector.md
├── checklists/{requirements.md,inspector.md}
└── tasks.md
```

### Source Code (repository root)

```text
packages/builder/schema/src/extensions/contribution-points.ts   # + RegistryRead.fieldTypes()
packages/builder/core/src/registry/registry.ts                  # typed fieldTypes catalog read
                                                                # + duplicate-id probe + tests

packages/builder/shell/src/
├── fields/
│   ├── resolve-field.ts        # R2 zod introspection + contribution-first resolution
│   ├── controls/               # TextField.tsx SelectField.tsx SwitchField.tsx NumberField.tsx
│   │                           #   ReadOnlyField.tsx (one component per file; internal)
│   └── *.test.ts(x)
├── devices/
│   └── buckets.ts              # BUCKET_THRESHOLDS + bucketForWidth (+ test)
├── components/
│   ├── Inspector/              # FULL contract — R4/R6/R8
│   ├── DeviceBar/              # FULL contract — R5
│   ├── PreviewMode/            # FULL contract — R7
│   └── EditorCanvas/           # + frameWidth?: number (additive; centered frame)
└── index.ts                    # + Inspector, DeviceBar, PreviewMode, buckets

packages/builder/editor/src/{index.ts,surface.test.ts}          # re-exports + guard
apps/playground/src/app/App.tsx                                 # device bar + inspector +
                                                                # preview wiring in edit mode
apps/playground/src/app/App.test.tsx                            # US-level acceptance
```

**Structure Decision**: everything editing-UI lives in the shell (layer 3); the only engine touches
are the additive registry read (schema+core). The renderer is untouched — frame width is
EditorCanvas layout.

## Affected members, ownership, and consumers

| Member                       | Change                                             | Direct consumers affected    |
| ---------------------------- | -------------------------------------------------- | ---------------------------- |
| `@craftkit/builder-schema`   | additive `RegistryRead.fieldTypes()`               | core (impl), shell (reader)  |
| `@craftkit/builder-core`     | typed fieldTypes read + probe                      | shell; 003 suites stay green |
| `@craftkit/builder-shell`    | fields/devices/preview + 3 components + frameWidth | preset, playground           |
| `@craftkit/builder` (preset) | re-export the three + bucket helpers               | playground, future apps      |
| `@craftkit/playground`       | edit-mode composition + acceptance                 | none (leaf)                  |

Rollback = revert shell additions + two additive engine touches + re-export lines + playground
wiring.

## Component artifact matrix (constitution-mandated)

| Component   | Story states                                                            | MDX                                         | Test focus                   |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------- | ---------------------------- |
| Inspector   | empty / selected(all kinds) / override-bucket / RTL + play() edit-props | purpose, zero-panel-code law, buckets, a11y | US1+US2 acceptance           |
| DeviceBar   | presets / custom width / RTL + play() width switch                      | thresholds, view-state law                  | bucket mapping + frame width |
| PreviewMode | on (live doc) / RTL + play() flip+escape                                | view-state flip, zero-tx law                | US4 acceptance               |

Field controls (Text/Select/Switch/Number/ReadOnly): internal modules — colocated behavior tests;
surfaced visually through Inspector stories (they are not exported components).

## Verification plan

Narrowest-first: shell → schema/core (suites stay green) → preset surface → playground → workspace
gates + boundary negatives → storybook build/browser suite with catalog-presence (Inspector,
DeviceBar, PreviewMode) → full `pnpm verify`. Evidence recorded at the gate task.

## Complexity Tracking

No violations. Watched: zod-4 introspection surface (`_zod.def`) is the same one B0's
representability gate uses — a zod major bump breaks both together (single staleness point, noted in
MEMORY's staleness conditions).
