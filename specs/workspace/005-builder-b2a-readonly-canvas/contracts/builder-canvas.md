# Contract: Builder B2a Read-Only Canvas

Normative TypeScript contracts as fenced blocks (001/003/004 precedent). Types not declared here
come from `@craftkit/builder-schema` / `@craftkit/builder-core` / `@craftkit/builder-renderer`.

## 1. Geometry ports and rect index (`@craftkit/builder-shell`)

```ts
interface NodeRect {
  nodeId: NodeId;
  x: number; // PREVIEW-LOCAL coordinates (as-implemented refinement: the chrome layer
  y: number; // overlays the frame exactly, so preview-local = layer-local; pointer
  width: number; // events from the frame document arrive in this space natively — no
  height: number; // host-offset bookkeeping exists anywhere)
  version: number; // index version at measurement time
}

/** jsdom has no layout — the system impls are defaults, tests inject fakes (Law-D style). */
interface GeometryPorts {
  measure(element: HTMLElement): Omit<NodeRect, 'nodeId' | 'version'>;
  hitTest(frameDocument: Document, clientX: number, clientY: number): Element | null;
  schedule(callback: () => void): () => void; // frame rhythm; returns cancel
}
declare function systemGeometryPorts(): GeometryPorts;

interface RectIndex {
  attach(id: NodeId, element: HTMLElement): void; // callback-ref driven (renderer reports)
  detach(id: NodeId): void;
  rect(id: NodeId): NodeRect | undefined; // lazy re-measure iff stale; never caches across frames
  nodeAt(clientX: number, clientY: number): NodeId | undefined; // hit-test, zero measurement
  has(id: NodeId): boolean;
  version(): number; // monotonic; bumped by observation only
  onInvalidate(listener: () => void): () => void; // observation-driven notify — consumers mark
  // dirty and read lazily (no polling anywhere)
  stats(): { measures: number; invalidations: number }; // test instrumentation
  dispose(): void;
}
declare function createRectIndex(options: {
  frame: HTMLIFrameElement;
  ports?: Partial<GeometryPorts>;
}): RectIndex;
// Invalidation sources (each: version += 1, NO measurement): shared ResizeObserver over attached
// elements · frame scroll (capture) · frame viewport resize · frame root dir-attribute change ·
// structural/layout mutations on the frame body (childList + class/style attributes, subtree) —
// added post-review: a same-size sibling REORDER (moveNode from another surface) moves DOM
// without firing any resize and without re-running keyed wrappers' refs, and this channel also
// guarantees the first content commit invalidates. NOTHING else invalidates; nothing polls;
// idle cost is zero.
```

## 2. Renderer cooperation (additive, `@craftkit/builder-renderer`)

```ts
interface CanvasFrameProps {
  // …existing 004 props unchanged…
  /**
   * Edit-mode cooperation: reports the mounted iframe element once its document
   * is ready, and null on unmount. Absent ⇒ behavior identical to 004.
   */
  onFrame?: ((frame: HTMLIFrameElement | null) => void) | undefined;
}

interface DocumentViewProps {
  // …existing 004 props unchanged…
  /**
   * Edit-mode geometry attachment. When present, every node renders inside
   * <div data-bldr-node={id} data-bldr-type={type}> whose callback ref reports
   * (id, element) on mount and (id, null) on unmount. When absent — always for
   * StaticDocument — output is byte-identical to 004.
   */
  attachNodeElement?: ((id: NodeId, element: HTMLElement | null) => void) | undefined;
}
```

## 3. Overlay + canvas tools (`@craftkit/builder-shell`)

```ts
/** Concretization of the B0 OverlayToolRenderer target (schema keeps `unknown`). */
interface CanvasToolTarget {
  nodeId: NodeId;
  rect: NodeRect;
  layer: HTMLElement; // the chrome layer; tools mount here, never into the frame
  ctx: KernelApi;
}

interface EditorCanvasProps {
  kernel: BuilderKernel; // BY PROP — shell hot path never reads React context
  theme: Theme; // forwarded to CanvasFrame
  title?: string; // accessible name (default "Editor canvas")
  onToolError?: (toolId: string, error: unknown) => void; // default console.error; never rethrown
  geometryPorts?: Partial<GeometryPorts>; // tests only
}
declare function EditorCanvas(props: EditorCanvasProps): JSX.Element;
// Composition: CanvasFrame(theme, live dir) ▸ DocumentView(kernel, attachNodeElement)
//            + chrome layer (host-side, position:absolute over the frame)
//            + visually-hidden aria-live="polite" announcer.
// Hot path (pointermove/over/out, outline positioning, tool mount): plain TS, direct DOM,
// one frame-rhythm flush per dirty period, batched reads THEN writes. React renders the
// scaffold once; no React state changes on hover.
```

Chrome behavior:

- Hover outline + label follow `nodeAt(pointer)`; leaving all nodes clears it.
- Selection outline renders FROM `kernel` selection (first id); click ⇒ `kernel.setSelection([id])`,
  empty-canvas click / Escape ⇒ `kernel.setSelection([])`.
- Labels = block schema `description` (fallback: node `type`).
- All chrome colors/z-index via `--bldr-*` custom properties with inline fallbacks; geometry via
  transforms; logical properties only; correct in LTR and RTL including live flips.
- A stale id (node removed / rect gone) hides its chrome the same flush.

## 4. Registry read (additive, `@craftkit/builder-schema` + core impl)

```ts
interface RegistryRead {
  // …existing members unchanged…
  /** Canvas tools sorted by ascending `order` (undefined last, then id). */
  canvasTools(): OverlayToolDef[];
}
// Core registry: canvasTools ids join the all-or-nothing duplicate probe (same law as
// blocks/commands); disposal removes the owner's tools; recorded as 003 §13 additive note.
```

## 5. Tool lifecycle (ToolHost)

```ts
// Activation mapping in B2a: 'selection' → mounts for the selected node;
// 'hover' → mounts for the hovered node; 'always' → mounts once for the document root
// on canvas ready; 'drag' → registered, never fires (B2b).
//
// Guarantees:
// g1. load() is called lazily, once per tool id per canvas (cached promise).
// g2. Every successful mount's cleanup runs exactly once — on target change, activation end,
//     registry version change, or canvas unmount, whichever first.
// g3. A load rejection or mount throw is contained: onToolError(toolId, error) is called,
//     built-in chrome and other tools are unaffected, and the tool may retry on next activation.
// g4. Tools mount into `layer` only; writing into the frame document is out of contract.
```

## 6. Keyboard map (host-level, canvas focused)

```ts
// ArrowDown / ArrowUp   sibling next/previous in parent's ordered child list (slots in schema
//                       declaration order, children in array order); no wrap.
// ArrowRight | ArrowLeft  step-in to first child of first populated slot | step-out to parent —
//                         MIRRORED when content dir is 'rtl'.
// Escape                clear selection.  Tab is never intercepted.
// No selection + any traversal key ⇒ select root's first child.
```

## 7. Lane-A proof contract (merge-blocking, counting only)

| Proof                   | Instrument                   | Assertion                                                                         |
| ----------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Zero content re-renders | `onBlockRender` counter      | 0 across sweep/hover/select/clear; landing AND 1,000-node stress                  |
| Observer-only currency  | `RectIndex.stats()`          | `measures` grows only after an invalidation event; idle ticks ⇒ 0 new measures    |
| 1:1 cleanup             | ToolHost test doubles        | every mount's cleanup ran exactly once (g2)                                       |
| Real geometry           | Storybook play() in Chromium | outline box ≈ target box; repositions after programmatic resize; RTL flip correct |

Wall-clock assertions are prohibited in merge gates (003 §13.13); absolute numbers go to the
uncontended evidence run.

## 8. Preset surface additions (`@craftkit/builder`)

```ts
export { EditorCanvas, defineCanvasTool } from '@craftkit/builder-shell';
export type {
  CanvasToolTarget,
  EditorCanvasProps,
  GeometryPorts,
  NodeRect,
  RectIndex,
} from '@craftkit/builder-shell';
// surface.test.ts gains 'EditorCanvas' and 'defineCanvasTool'. `defineCanvasTool` is
// REQUIRED in the curated surface: an app-side extension (the playground's demo tool)
// cannot author a canvas tool without it, and the dependency law forbids importing
// @craftkit/builder-shell directly. Apps still import ONLY '@craftkit/builder'.
```

## 9. As-implemented refinements (post-review, additive)

1. **Selection is bookkeeping over LIVE nodes (kernel, additive to 003).** `dispatch` and
   `undo`/`redo` prune ids whose node no longer exists, INSIDE the same `store.write` — no extra
   notification exists, so the Law-S 1:1 change↔transaction audit is unchanged, and the array is
   returned by reference when nothing was dropped so selection subscribers never churn. Without
   this, every consumer of `state.selection` (chrome, announcer, contributed tools) would have to
   defend itself against a dangling id — the wrong shape for a single source of truth. Satisfies
   US2/AC3's "the selection clears".
2. **ToolHost drops a dead target.** Activation is gated on the target's node still existing, not on
   id equality alone, so tool chrome can never be orphaned at a stale position; the canvas
   re-notifies BOTH selection and hover on every document change (hover included, though no pointer
   moved).
3. **Focus returns to the canvas after an in-frame click**, because clicking inside the preview
   moves focus into the iframe's browsing context and would otherwise strand keyboard traversal. A
   `keydown` listener inside the frame handles traversal too, so focus arriving there by any other
   route still works (keydown does not cross document boundaries — no double handling).
4. **The announcer never reads a raw node id**: an id that does not resolve to a live node is
   announced as "Selection cleared".
