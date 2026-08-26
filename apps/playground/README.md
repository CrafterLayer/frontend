# @craftkit/playground

The proof application for the builder preset: mounts `<Builder/>` with fixture documents and
deterministic ports, renders inside the isolation iframe with injected `--t-*` theme variables, and
demonstrates the B1 exit criteria live — **zero backend, zero network** (a test asserts no
`fetch`/XHR usage in app source).

Normative source:
[`specs/workspace/004-builder-b1-react-foundation`](../../../specs/workspace/004-builder-b1-react-foundation/plan.md).
Imports **only** `@craftkit/builder` (+ `react`/`react-dom`) — the dependency law forbids deeper
builder imports for apps, and this app existing at all is the proof the preset surface suffices.

## What it demonstrates

- **Live canvas** — the marketing landing fixture (Arabic + English variants) rendered per-node in
  `CanvasFrame` with theme tokens applied.
- **Theme switcher** — light/dark token switch recolors the canvas in place (SC-004, no reload).
- **Direction flip** — `setDocMeta` flips content `dir` document-safely (undo/redo included).
- **Runtime extension registration** — registers the `playground-demo` manifest on click; inserting
  an `announcement` node then renders without reload (SC-005); disposing falls back to
  `UnknownBlock`.
- **Undo/redo** — history buttons drive `kernel.undo()`/`kernel.redo()`.

Kernel wiring lives in `src/features/preview/create-playground-kernel.ts` (seeded ports + memory
persistence from `@craftkit/builder/testing`); each control is its own full-contract component under
`src/features/preview/components/`.

## Run

```bash
pnpm --filter @craftkit/playground dev        # Vite dev server
pnpm --filter @craftkit/playground test
pnpm --filter @craftkit/playground build
```
