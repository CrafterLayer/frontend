# Implementation Plan: Builder B2a Read-Only Canvas

**Branch**: `main` (feature directory scoped) | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/workspace/005-builder-b2a-readonly-canvas/spec.md`

## Summary

Introduce `@craftkit/builder-shell` (layer 3) carrying the read-only canvas: an observer-driven rect
index over edit-only node wrappers, a React-free overlay hot path drawing hover/selection chrome
above the B1 iframe, kernel-owned selection, a keyboard traversal baseline, and the first live
consumer of the B0 `canvasTools` contribution point — proven by counting (zero content re-renders)
in jsdom via injected geometry ports and in real Chromium via Storybook play functions. Zero editing
gestures; drag and all editing chrome stay in B2b+.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict; exactOptionalPropertyTypes,
noUncheckedIndexedAccess), React 19.2.8

**Primary Dependencies**: none new (R1). Shell depends on
`@craftkit/builder-{schema,core,react, renderer}` workspace + peers react/react-dom; platform
primitives (ResizeObserver, MutationObserver, rAF, elementFromPoint) behind injectable ports (R5)

**Storage**: none (geometry index is ephemeral in-memory; hover is overlay-local; selection is
existing kernel state)

**Testing**: vitest 4 (`createReactTestConfig`, jsdom + injected geometry/scheduler ports) +
Storybook 10 browser suite (Chromium play functions, real layout) + a11y addon at error

**Target Platform**: browser (jsdom for unit lanes; Chromium for geometry truth)

**Project Type**: monorepo workspace feature — one new package + additive edits to renderer, core,
schema, preset, playground

**Performance Goals**: 0 document-content re-renders on all pointer/selection interactions
(mechanical count, incl. 1,000-node stress); 0 idle geometry work; observer-attributed updates only
(Lane A counting — no wall-clock merge gates per 003 §13.13)

**Constraints**: layer law (shell=3 imports only ≤2); overlay hot path React-free (R3/R6); publish
path byte-identical when geometry attachment is absent (R4); read-only — no gesture mutates the
document (FR-008)

**Scale/Scope**: ~1 new package (≈10 source modules), 2 additive engine/core/schema touches, 2 new
full-contract UI components, playground demo, ≈40–50 new tests

## Constitution Check

_GATE: evaluated before Phase 0 research; re-evaluated after Phase 1 design — PASS (×2)._

- **Explicit workspace scope** — PASS: members named exhaustively (Project Structure); no ambiguity
  about ownership; writes confined to those paths.
- **Dependency direction** — PASS: `builder-shell` (3) → schema/core/react/renderer (0–2) only;
  additive `RegistryRead.canvasTools()` lives in schema (0) consumed upward; playground keeps
  importing ONLY `@craftkit/builder`; `check:workspace` + boundary negatives prove both directions.
- **Complete component contract** — PASS: every new UI component ships the 5-artifact contract
  (matrix below); imperative overlay modules are not React components and carry colocated unit tests
  instead; `check:components` remains the mechanical gate.
- **One component per `.tsx`** — PASS: `EditorCanvas.tsx` and `EditMode.tsx` are the only new
  component files; overlay/rect machinery is plain `.ts`.
- **Tests mandatory** — PASS: every FR maps to a named suite (quickstart law-proof table); Lane-A
  counting proofs merge-block; browser-truth assertions live in story play functions.
- **No secrets / no commits without authorization** — PASS: no credentials involved; commit remains
  proposal-only (user has explicitly forbidden commits this round).

## Project Structure

### Documentation (this feature)

```text
specs/workspace/005-builder-b2a-readonly-canvas/
├── plan.md
├── research.md          # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   └── builder-canvas.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
packages/builder/shell/                      # NEW — @craftkit/builder-shell (layer 3)
├── package.json  tsconfig.json  vitest.config.ts  README.md
└── src/
    ├── index.ts                             # curated: EditorCanvas + types + ports
    ├── rects/
    │   ├── rect-index.ts                    # createRectIndex(ports) — R5
    │   ├── geometry-ports.ts                # measure/hit-test/scheduler ports + system impls
    │   └── rect-index.test.ts
    ├── overlay/
    │   ├── overlay-controller.ts            # dirty-flag + frame-batched read/write — R6
    │   ├── outline-elements.ts              # prebuilt chrome DOM (hover/selection + labels)
    │   ├── tool-host.ts                     # canvasTools lifecycle + fault isolation — R9
    │   ├── overlay.css                      # --bldr-* tokens, logical properties
    │   └── *.test.ts (controller, tool-host)
    ├── keyboard/
    │   ├── traversal.ts                     # document-order model, RTL mirroring — R8
    │   └── traversal.test.ts
    └── components/EditorCanvas/             # full 5-artifact contract
        ├── EditorCanvas.tsx  EditorCanvas.stories.tsx  EditorCanvas.docs.mdx
        ├── EditorCanvas.test.tsx  index.ts

packages/builder/renderer/src/components/DocumentView/   # additive — R4
├── NodeView/NodeView.tsx                    # optional wrapper + callback-ref registration
└── DocumentView.tsx                         # attachNodeElement?: prop threading + tests

packages/builder/schema/src/extensions/contribution-points.ts   # additive — R9
                                             # RegistryRead.canvasTools(): OverlayToolDef[]
packages/builder/core/src/registry/registry.ts                  # typed canvasTools catalog read
                                             # + duplicate-id probe + tests

packages/builder/editor/src/index.ts         # + EditorCanvas re-export; surface.test.ts entry
packages/builder/editor/src/surface.test.ts

apps/playground/src/
├── app/App.tsx                              # edit-mode wiring (thin)
├── features/preview/demo-extension.ts       # + one canvasTool (selection badge) — R11
└── features/preview/components/EditMode/    # full 5-artifact contract (toggle)
```

**Structure Decision**: one new layer-3 member owns ALL chrome; engines receive only the minimal
additive cooperation the spec names (geometry attachment, typed catalog read); apps still see
nothing but the preset.

## Affected members, ownership, and consumers

| Member                       | Change                                             | Direct consumers affected                   |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `@craftkit/builder-shell`    | NEW package                                        | preset (re-export), playground (via preset) |
| `@craftkit/builder-renderer` | additive `attachNodeElement` prop                  | shell (only caller); static path unchanged  |
| `@craftkit/builder-schema`   | additive `RegistryRead.canvasTools()`              | core (impl), shell (reader)                 |
| `@craftkit/builder-core`     | registry canvasTools read + duplicate probe        | shell; existing suites must stay green      |
| `@craftkit/builder` (preset) | re-export EditorCanvas + types                     | playground, future apps                     |
| `@craftkit/playground`       | EditMode component + demo badge tool               | none (leaf)                                 |
| `apps/storybook`             | none expected (R12 — glob already matches `shell`) | catalog gains shell stories                 |

Public API changes: preset surface grows by `EditorCanvas` (+ types) — guarded by `surface.test.ts`;
schema `RegistryRead` grows one method — recorded as 003 §13 additive note. No migrations; no
rollout concerns (no app consumes edit mode yet). Rollback = delete `packages/builder/shell` +
revert the four additive touches.

## Component artifact matrix (constitution-mandated)

| Component    | File                                               | Export                   | Story (states)                                            | MDX                                                              | Test                                          | Owner         |
| ------------ | -------------------------------------------------- | ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- | ------------- |
| EditorCanvas | shell/src/components/EditorCanvas/EditorCanvas.tsx | index.ts + package index | default / selection / RTL / dark + play() geometry proofs | EditorCanvas.docs.mdx (purpose, API, a11y, RTL, zero-render law) | EditorCanvas.test.tsx (behavior, jsdom ports) | builder-shell |
| EditMode     | playground …/components/EditMode/EditMode.tsx      | local index              | off/on + play() toggle                                    | EditMode.docs.mdx                                                | EditMode.test.tsx                             | playground    |

Imperative modules (rect-index, overlay-controller, outline-elements, tool-host, traversal) are NOT
React components: each carries a colocated unit test; none may contain JSX.

## Verification plan

Narrowest-first: shell lint/typecheck/test → renderer, core, schema suites (additive changes must
keep 004/003 suites green) → editor surface test → playground → `pnpm check:workspace` +
`check:components` + `check:boundaries` (+ one negative: shell importing the preset must fail) →
`pnpm --filter @craftkit/storybook build-storybook && test:storybook` (shell stories present in
catalog — R12 explicit check) → full `pnpm verify`. Evidence recorded at the T-gate task; absolute
timings only in the uncontended evidence run.

## Complexity Tracking

No constitution violations to justify. The only watched complexity: injectable geometry ports exist
solely because jsdom has no layout — system impls are the defaults and tests are the only other
callers (same justification pattern as the kernel's clock/id ports).
