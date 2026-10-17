# Implementation Plan: Builder B2b Drag Editing

**Branch**: `main` (feature directory scoped) | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/workspace/006-builder-b2b-drag-editing/spec.md`

## Summary

Turn B2a's read-only canvas into an arranging canvas: an in-repo, React-free drag engine on the
existing geometry index (session state machine + pure drop resolver + prebuilt drag chrome), a
catalog-driven Palette with drag- and keyboard-insert, a LayersTree sharing kernel selection, and
Alt-arrow keyboard moves — all under the one-transaction-per-drop / zero-trace-cancel law, proven by
counting. Zero new dependencies; zero vendored code.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict), React 19.2.8

**Primary Dependencies**: none new (R1). Everything builds on `@craftkit/builder-shell`'s B2a
machinery + `@craftkit/builder-{schema,core,renderer}`

**Storage**: none — session and expand/collapse are ephemeral view state; every document change is a
kernel transaction

**Testing**: vitest 4 jsdom with injected geometry/scheduler ports (B2a harness pattern) + Storybook
Chromium play() drags + property-style resolver≡door agreement sweep

**Target Platform**: browser

**Project Type**: monorepo workspace feature — shell package growth + preset surface + playground
composition; NO new workspace member

**Performance Goals**: 0 content re-renders press-to-predrop (landing + 1,000-node stress); bounded
per-move resolution (hit-test + one parent-chain walk); smoothness budgets live outside merge gates
(R9)

**Constraints**: single-door mutations only at drop/keyboard-move commit; chrome-only sessions; no
context in the shell (drag handle by prop); B2a behavior byte-compatible when `editable` is absent
(FR-012)

**Scale/Scope**: ~6 new shell modules, 2 new full-contract components (Palette, LayersTree) + 1
extended (EditorCanvas), playground composition, ≈45–55 new tests

## Constitution Check

_GATE: evaluated before Phase 0; re-evaluated after Phase 1 design — PASS (×2)._

- **Explicit workspace scope** — PASS: all writes inside `packages/builder/shell`,
  `packages/builder/editor` (re-exports), `apps/playground`; spec artifacts in 006.
- **Dependency direction** — PASS: no new edges anywhere; shell stays layer 3 → {0,1,2}; playground
  stays preset-only. Boundary negatives re-run in the evidence gate.
- **Complete component contract** — PASS: Palette and LayersTree ship the 5-artifact contract;
  EditorCanvas's existing contract absorbs the `editable` prop (stories gain drag states);
  session/resolver/chrome are non-component `.ts` modules with colocated tests.
- **One component per `.tsx`** — PASS: `Palette.tsx`, `LayersTree.tsx` only; imperative drag
  machinery is plain TS.
- **Tests mandatory** — PASS: law-proof table in quickstart maps every FR/SC to a named suite;
  counting-only merge gates (twice-validated policy, recorded in MEMORY).
- **No commits without explicit user authorization** — PASS: the user has explicitly withheld commit
  authorization; T-final produces a proposal only.

## Project Structure

### Documentation (this feature)

```text
specs/workspace/006-builder-b2b-drag-editing/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/builder-drag.md
├── checklists/{requirements.md,drag.md}
└── tasks.md
```

### Source Code (repository root)

```text
packages/builder/shell/src/
├── overlay/
│   ├── drag-session.ts          # R2 state machine (idle→pending→active→committed|cancelled)
│   ├── drag-chrome.ts           # prebuilt ghost + target highlight + insertion indicator
│   ├── drop-resolver.ts         # R3 pure resolution (+ rule gate shared with keyboard moves)
│   └── *.test.ts                # session, chrome, resolver (incl. resolver≡door sweep)
├── keyboard/
│   └── move-actions.ts          # R5 Alt-move resolution → moveNode + announcements (+ test)
├── components/
│   ├── EditorCanvas/            # + editable prop, session wiring, drag stories/tests
│   ├── Palette/                 # NEW full contract (Palette.tsx/stories/docs/test/index + css)
│   └── LayersTree/              # NEW full contract (LayersTree.tsx/stories/docs/test/index + css)
└── index.ts                     # + Palette, LayersTree, drag types

packages/builder/editor/src/index.ts       # + Palette, LayersTree re-exports; surface.test.ts
apps/playground/src/app/App.tsx            # edit-mode composition: palette | canvas | layers
apps/playground/src/app/App.test.tsx       # US-level acceptance additions
```

**Structure Decision**: drag machinery joins the shell's existing overlay/keyboard families — no new
member, no new layer; panels are shell components composed by consumers.

## Affected members, ownership, and consumers

| Member                       | Change                                                   | Direct consumers affected      |
| ---------------------------- | -------------------------------------------------------- | ------------------------------ |
| `@craftkit/builder-shell`    | drag engine + 2 new components + EditorCanvas `editable` | preset (re-export), playground |
| `@craftkit/builder` (preset) | re-export Palette/LayersTree (+ types)                   | playground, future apps        |
| `@craftkit/playground`       | edit-mode三panel composition + acceptance suites         | none (leaf)                    |

Kernel/schema/renderer: **zero changes** — the B0 command set and B2a cooperation suffice (spec
Assumptions). Public API growth is preset-surface only, guarded by `surface.test.ts`. Rollback =
revert the shell additions + two re-export lines + playground composition.

## Component artifact matrix (constitution-mandated)

| Component           | File                                           | Export          | Story (states)                                 | MDX                    | Test                      |
| ------------------- | ---------------------------------------------- | --------------- | ---------------------------------------------- | ---------------------- | ------------------------- |
| Palette             | shell/src/components/Palette/Palette.tsx       | index + package | default / RTL / keyboard-insert play()         | Palette.docs.mdx       | Palette.test.tsx          |
| LayersTree          | shell/src/components/LayersTree/LayersTree.tsx | index + package | default / deep-nesting / selection-sync play() | LayersTree.docs.mdx    | LayersTree.test.tsx       |
| EditorCanvas (ext.) | existing folder                                | existing        | + DragRearrange play() (Chromium pointer drag) | docs gain drag section | tests gain US1/US4 suites |

## Verification plan

Narrowest-first: shell lint/typecheck/test → preset surface test → playground → workspace gates
(`check:workspace`/`check:components`/`check:boundaries` + boundary negatives re-run) → storybook
build + browser suite (catalog-presence check incl. Palette/LayersTree) → full `pnpm verify`.
Evidence recorded at the gate task; smoothness numbers via the documented manual run only (R9).

## Complexity Tracking

No constitution violations. Watched: the host↔frame coordinate bridge for palette drags (R6) is the
single place two coordinate spaces meet — isolated in one function with its own test.
