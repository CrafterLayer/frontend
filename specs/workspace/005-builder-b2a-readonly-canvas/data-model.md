# Data Model: Builder B2a Read-Only Canvas

All shapes are ephemeral, in-memory, and canvas-local; nothing here enters the document, the kernel
store, or persistence. Normative TypeScript lives in
[contracts/builder-canvas.md](contracts/builder-canvas.md).

## NodeRect (geometry record)

| Field             | Type     | Meaning                                                      |
| ----------------- | -------- | ------------------------------------------------------------ |
| `nodeId`          | `NodeId` | the document node this box belongs to                        |
| `x`, `y`          | `number` | top-left in HOST viewport coordinates (frame offset applied) |
| `width`, `height` | `number` | drawn size                                                   |
| `version`         | `number` | the index version this measurement was taken at              |

Rules: a record exists only while the node's wrapper is attached (rendered in edit mode); `rect(id)`
re-measures lazily when `record.version < index.version()`; consumers never cache rects across
frames — they re-read.

## RectIndex

- **Membership**: `attach(id, element)` on wrapper mount, `detach(id)` on unmount (callback-ref
  driven — the renderer reports, the index never scans).
- **Invalidation** (each bumps `version` by 1, O(1), no measurement): any observed element resize;
  frame scroll; frame viewport resize; frame root `dir` attribute change.
- **Reads**: `rect(id)` (lazy re-measure of that element only), `nodeAt(x, y)` (point hit-test →
  closest wrapper — no measurement), `version()`, `has(id)`.
- **Instrumentation** (test-only): `stats()` → `{ measures, invalidations }`.
- **Lifecycle**: `dispose()` disconnects all observers/listeners; idle cost after creation is zero
  (no timers).

State transitions: `created → observing (frame ready) → disposed`. Attach/detach and invalidation
are valid only in `observing`.

## Overlay state (chrome)

| Field        | Type             | Source                                                     |
| ------------ | ---------------- | ---------------------------------------------------------- |
| `hoverId`    | `NodeId \| null` | pointer path (overlay-local; NEVER kernel state)           |
| `selectedId` | `NodeId \| null` | first entry of kernel selection (store subscription)       |
| `dirty`      | flag             | set by: hover change, selection change, index invalidation |

One frame-rhythm flush per dirty period: batched reads (`rect()` for hover/selection targets) →
batched writes (transform/size/visibility on prebuilt chrome elements). A node id whose rect no
longer exists hides its chrome. Two changes inside one frame produce one flush (last wins).

## CanvasToolTarget (concretization of the B0 `OverlayToolRenderer` input)

| Field    | Type          | Meaning                                             |
| -------- | ------------- | --------------------------------------------------- |
| `nodeId` | `NodeId`      | activation target                                   |
| `rect`   | `NodeRect`    | target geometry at mount time (fresh read)          |
| `layer`  | `HTMLElement` | the chrome layer to mount into                      |
| `ctx`    | `KernelApi`   | the existing kernel context (read/dispatch surface) |

Tool lifecycle: `idle → loading (load(), cached per id) → mounted (cleanup held) → cleaned`.
Cleanups run on: activation target change, activation end, registry version change, canvas unmount.
`load` rejection / mount throw → `failed` (reported via `onToolError`, never rethrown into chrome).
`'drag'` activation is registered but never fires in B2a.

## Keyboard traversal model

Derived from the kernel document (cold path): the ordered child list of a node = concatenation of
its slots in schema declaration order, each slot's children in array order.

| Key                                | With selection                                                 | Without selection          |
| ---------------------------------- | -------------------------------------------------------------- | -------------------------- |
| ArrowDown / ArrowUp                | next / previous sibling in the parent's ordered list (no wrap) | select first child of root |
| ArrowRight (LTR) / ArrowLeft (RTL) | step INTO first child of first populated slot                  | select first child of root |
| ArrowLeft (LTR) / ArrowRight (RTL) | step OUT to parent (root stops)                                | —                          |
| Escape                             | clear selection                                                | no-op                      |

Accessibility channel: visible outline labels (block display name = schema description, fallback
type) + one visually-hidden `aria-live="polite"` region in the HOST announcing "<name> selected" /
"selection cleared".

## Relationships

```text
DocumentView(attachNodeElement) ──registers──▶ RectIndex ◀──reads── OverlayController
kernel.selection ──subscribes──▶ OverlayController ──mounts──▶ ToolHost ──reads── registry.canvasTools()
pointer events (frame doc) ──▶ nodeAt() ──▶ hoverId          keyboard (host) ──▶ traversal ──▶ kernel.setSelection
```
