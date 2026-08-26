# Contract: Builder B3c Inline Editing & Floating Toolbars

Normative TypeScript as fenced blocks (001–008 precedent).

## 1. Declaration (`@craftkit/builder-schema`, additive)

```ts
interface BlockSchema<P extends z.ZodTypeAny = z.ZodTypeAny> {
  // …unchanged…
  /** Property key edited IN PLACE on the canvas; absent ⇒ not inline-editable. */
  inlineEditable?: string;
}
// d1. `defineBlockSchema` rejects an `inlineEditable` key that is not a property of `props`,
//     and one whose resolved kind is neither string nor rich text — a mis-declaration is a
//     registration-time error, never a runtime surprise.
// d2. Declaration is data: no package needs the shell or an engine to declare it.
```

## 2. Positioning (`shell/src/overlay/floating-position.ts`)

The bar is not "adequate" — it is feature-for-feature with a positioning library's middleware stack,
minus the parts our architecture makes unnecessary.

```ts
interface FloatingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface FloatingAnchor {
  box: FloatingBox;
  rects?: FloatingBox[];
}
interface FloatingPlacement {
  x: number;
  y: number;
  placement: 'above' | 'below';
  hidden: boolean;
  arrowOffset: number;
}

declare function positionFloating(input: {
  /** LAYER-LOCAL (= preview-local, 005 §1) — anchors never need conversion. */
  anchor: FloatingBox | FloatingAnchor;
  size: { width: number; height: number };
  /** The frame's box in HOST space — the ONLY reason host space is consulted. */
  frame: FloatingBox;
  viewport: { width: number; height: number };
  /** The frame's visible (scrolled) area in layer-local space. */
  visible?: { width: number; height: number };
  dir: 'ltr' | 'rtl';
  align?: 'center' | 'start';
  gap?: number;
  padding?: number;
  arrowSize?: number;
}): FloatingPlacement;
// p1. FLIP — prefer above, flip below when host space leaves no room, and when NEITHER side
//     fits take the side with more room. (GrapesJS clamps instead and covers its own content.)
// p2. SHIFT — slide along the inline axis with padding rather than snapping to an edge, so the
//     toolbar stays visually attached. `align: 'start'` mirrors under RTL.
// p3. PURE — no DOM, no globals, no time; every case table-testable (SC-004).
// p4. INLINE — a selection spanning LINES is many rects, not one union: above hugs the FIRST
//     line, below hugs the LAST. Placing against the union box is the tell of a naive bubble.
// p5. HIDE — an anchor scrolled out of the frame's visible area reports `hidden`, so a toolbar
//     never floats over content the user cannot see.
// p6. ARROW — the pointer keeps aiming at the anchor centre after a shift, clamped to the
//     toolbar's own corner range.
// NOT inherited from a library: an ancestor-walking auto-update loop. Invalidation is
// observer-driven through the rect index — strictly better than the 10 fps rect polling the
// prior art resorts to, and cross-frame correctness is ours by construction rather than by a
// frameElement walk (the exact area that needed four rounds of upstream patches).
```

## 3. Inline session (`shell/src/overlay/inline-session.ts`)

```ts
interface InlineSession {
  nodeId: NodeId;
  propKey: string;
  kind: 'text' | 'rich';
}
// s1. Entered by double-click on an inline-editable node, or Enter with it selected; entering
//     dispatches NOTHING.
// s2. Ended by Escape (selection kept), by selecting another node, or by the node vanishing —
//     always without a trailing commit.
// s3. VIEW state: never in the document, never in the kernel.
```

## 4. Editing surfaces

```ts
interface InlineTextSurfaceProps {
  value: string;
  onCommit: (next: string) => void; // ONE dispatch per commit — the door decides
  editable: boolean; // hover/focus gated (Safari drag-focus, webkit 112854)
}
// t1. VENDORED from Puck `InlineTextField` (MIT) — see vendor/VENDOR.md. Adapted: the upstream
//     per-keystroke store write is replaced by our door law; the value-sync guard
//     (write the DOM only when the incoming value differs from what is shown) is kept
//     verbatim in spirit — it is the caret-safety lesson.
// t2. Rich properties edit through the SAME B3b editor component (no second engine, still
//     lazily loaded, published path still engine-free).
```

## 5. Text bubble (`components/TextBubble/`)

```ts
interface TextBubbleProps {
  /** Layer-local anchor for the current selection, or null when there is none. */
  anchor: Box | null;
  actions: { id: string; label: string; pressed?: boolean; run: () => void }[];
}
// b1. Shown only for a NON-EMPTY selection inside a rich inline edit; hidden when the
//     selection collapses, editing ends, or the anchor leaves the frame viewport.
// b2. Cancels pointer-down so activation never moves focus out of the editor, and the canvas
//     click path ignores layer-origin clicks (risk 2/9 — otherwise Bold deselects the block).
// b3. Each action is ONE transaction and preserves the selection.
// b4. `shouldShow` + the selection→rect derivation are VENDORED LOGIC from TipTap's
//     BubbleMenu plugin (MIT, attributed); `posToDOMRect`/`isTextSelection` come from the
//     already-pinned `@tiptap/core` — no new package (research R2).
```

## 6. Block action bar (`overlay/block-actions.ts`)

```ts
// Registered through the EXISTING canvas-tool contribution point (`on: 'selection'`), so lazy
// load, exactly-once cleanup, error containment, and layer-only mounting are inherited (005 §4).
// a1. Actions: duplicate, delete, move earlier, move later, edit text (when declared).
// a2. Each is ONE transaction through the kernel door, announced, with the resulting selection
//     defined: the duplicate, the surviving sibling, the moved node.
// a3. An action that cannot apply (delete on the root, move at an edge) is ABSENT or DISABLED —
//     never a door failure.
// a4. Hidden for the duration of a drag session; restored on drop or cancel.
```

## 7. Canvas additions (`EditorCanvas`, additive)

```ts
// c1. `toHost` — the inverse of `toFrame`, the SECOND and last member of the one bridge; every
//     scale term (today none, tomorrow zoom) lives in this pair.
// c2. Gestures: double-click enters, Enter enters on the selected node, Escape exits.
// c3. Layer-origin clicks never reach the selection path.
```

## 8. Lane-A proof contract (merge-blocking, counting only)

| Proof                  | Instrument                                     | Assertion                                                                                                 |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Enter/exit             | session state + `transactions().length`        | entering and exiting dispatch nothing                                                                     |
| Transactions ≡ commits | `transactions().length`                        | +1 per inline commit; canvas follows                                                                      |
| Document truth         | undo with a session open                       | surface and canvas both show the restored value                                                           |
| Bubble lifecycle       | anchor presence                                | shown on non-empty selection; hidden on collapse/exit/out-of-view                                         |
| Placement              | table over anchor/size/frame/viewport/dir      | prefer-above, FLIP at the top edge, clamped, RTL-mirrored                                                 |
| Action bar             | one action at a time                           | +1 transaction each, expected document change AND resulting selection                                     |
| Drag interplay         | session start/stop                             | bar hidden during drag, restored after                                                                    |
| Zero-render law        | `onBlockRender` counter on the stress document | 0 content renders for hover/select/scroll/toolbar positioning; exactly 1 node's subtree per inline commit |
| Engine containment     | loader invocation counter                      | 0 loads in sessions that never inline-edit rich text                                                      |
| Browser truth          | Chromium play()                                | enter-edit, format via the bubble, exit — inside the real frame                                           |

## 9. As-implemented records (US1)

1. **The edit boundary is declared, not hidden** (`NodeView`): the seam replaces the declared
   property's VALUE with a React element, so a block that renders `{props.heading}` renders the
   editor where the text lives — the field-transform idea from the vendored prior art,
   expressed through our own wrapper machinery. The stored type says `JsonValue`; at this one
   boundary, in edit mode only, it is an element. Scoped to one node, so exactly one subtree
   re-renders (proven by the render-scope test).
2. **React's synthetic events do not cross the frame** — a third instance of the same law
   (B2b keydown, B2b pointer routing). The inline surface attaches NATIVE listeners to its own
   element; an `onInput` prop would never fire for content portaled into the preview document.
   The upstream file uses native listeners for exactly this reason.
3. **`innerText` is unimplemented in jsdom.** The surface reads it when present and falls back
   to `textContent`, with the DOM type narrowed to say what is actually true — a real browser
   takes the first branch, the suite takes the second, both read the same string.
4. **The surface mounts LIVE.** A programmatic focus updates React state on the NEXT render, so
   a keystroke in that gap is dropped by a real browser — invisible in jsdom, caught by the
   Chromium story. `contentEditable` is therefore live on first paint; the Safari drag-focus
   guard (hover OR focus) applies from the first blur onwards.
5. **Enter reads kernel truth, not a render closure.** The gesture listener lives on the frame
   document and resolves the selection from the store at call time, so it can never act on a
   stale render.
6. **`userEvent` cannot type into `contenteditable="plaintext-only"`** (its guard accepts only
   `"true"`), so the browser-truth story fires the real `InputEvent` a browser fires and waits
   for React's batched update — what it proves and what it does not is stated in the story.
