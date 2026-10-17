# Contract: Builder B2b Drag Editing

Normative TypeScript contracts as fenced blocks (001/003/004/005 precedent). Types not declared here
come from `@craftkit/builder-{schema,core,renderer,shell}` (005 contract included).

## 1. Drag session (`@craftkit/builder-shell`, plain TS — React-free)

```ts
type DragPayload =
  | { kind: 'move'; id: NodeId } // an existing canvas node
  | { kind: 'insert'; type: string }; // a palette vocabulary entry

type DragPhase = 'idle' | 'pending' | 'active';

interface DragSession {
  /** Pointer inputs (frame-local coordinates; the palette bridge translates). */
  press(payload: DragPayload, x: number, y: number): void;
  move(x: number, y: number): void;
  release(): void; // commit if a target is resolved, else cancel
  cancel(): void; // Escape / self-cancel / release over nothing
  phase(): DragPhase;
  /** Current resolved target while active (null = no valid target under pointer). */
  target(): DropTarget | null;
  dispose(): void;
}

declare function createDragSession(options: {
  kernel: BuilderKernel;
  index: RectIndex;
  layer: HTMLElement; // drag chrome joins the same chrome layer
  schedule: GeometryPorts['schedule'];
  announce(message: string): void; // the existing polite channel
  onHoverSuppress(active: boolean): void; // overlay controller mutes hover chrome mid-drag
}): DragSession;
```

Session laws (each is a tested invariant):

- s1. `pending → active` only after the pointer moves ≥ 4px from the press point; a release while
  pending is a plain click (no chrome ever showed).
- s2. While active: ZERO document mutations, ZERO transactions, ZERO content re-renders — ghost,
  target highlight, and insertion indicator are prebuilt chrome positioned in the shared
  one-flush-per-frame rhythm.
- s3. Commit dispatches EXACTLY ONE `moveNode`/`insertNode`; a target equal to the payload's current
  position dispatches NOTHING (belt) and the kernel no-effect rule backs it (suspenders). After a
  successful move/insert the affected node becomes the selection (bookkeeping, not a transaction).
- s4. Cancel leaves `getDocument()` REFERENCE-identical, `transactions().length` unchanged, and
  removes every piece of drag chrome. Escape cancels; a `move` payload whose node disappears
  mid-drag self-cancels (store subscription).
- s5. Announcements: committed ("moved/inserted …"), cancelled ("cancelled"), rejected release ("no
  valid target").

## 2. Drop resolution (pure — the shared rule authority)

```ts
interface DropTarget {
  parentId: NodeId;
  slot: SlotName;
  index: number; // insertion index in the slot's child array
  /** Chrome geometry for the indicator line (preview-local). */
  indicatorRect: { x: number; y: number; width: number; height: number };
}

declare function resolveDropTarget(
  doc: BuilderDocument,
  registry: RegistryRead,
  index: RectIndex,
  payload: DragPayload,
  x: number,
  y: number,
): DropTarget | null;

/** The single rule gate — used by the resolver AND keyboard moves (SC-003). */
declare function slotAccepts(
  doc: BuilderDocument,
  registry: RegistryRead,
  parentId: NodeId,
  slot: SlotName,
  payload: DragPayload,
): boolean;
```

Resolution laws:

- r1. Candidate order (three-band rule — the half rule alone would make an EMPTY container
  untargetable): within the hovered node's rect, the middle vertical band (25–75%) prefers the
  INTO-drop (the node's first accepting slot, append); the outer quarters prefer the sibling GAP
  (before above the midline, after below, in the parent slot). Whichever the band prefers is tried
  first, the other second; then the parent-chain walk repeats the same rule upward. Pointer over no
  node at all ⇒ into-drop on the document root. Never a whole-tree scan (FR-015).
- r2. `slotAccepts` = `allow` contains the payload type AND (`max` absent OR occupancy < max, where
  a `move` payload already seated in that slot is exempt) AND (for `move`) the parent is not the
  payload node itself nor any of its descendants.
- r3. Resolver≡door agreement (SC-003): every non-null resolution dispatches cleanly; every
  candidate `slotAccepts` rejects is also rejected by the door. Proven by a generated-document sweep
  test.
- r4. Same-slot forward moves report the POST-REMOVAL index (the node's own departure shifts later
  positions down by one).

## 3. Keyboard moves (`keyboard/move-actions.ts`)

```ts
type MoveAction = 'up' | 'down' | 'out' | 'in';
/** Alt+Arrows; horizontal pair MIRRORED under RTL content (same rule as traversal). */
declare function resolveMoveAction(
  key: string,
  altKey: boolean,
  dir: ContentDirection,
): MoveAction | undefined;
/** Applies one action through slotAccepts + ONE moveNode; returns the announcement. */
declare function performMoveAction(
  kernel: BuilderKernel,
  selected: NodeId,
  action: MoveAction,
): string;
```

- k1. `up`/`down`: sibling swap, clamped silently at the edges (no transaction, announcement
  "already first/last").
- k2. `out`: become the parent's NEXT sibling in the grandparent slot when `slotAccepts` allows;
  `in`: append into the nearest PRECEDING sibling's first accepting slot.
- k3. Selection stays on the moved node; every outcome is announced; an illegal move announces the
  reason and changes nothing.

## 4. Palette (`components/Palette/`)

```ts
interface PaletteProps {
  kernel: BuilderKernel; // BY PROP (shell no-context law)
  /** Hands insert payloads to the canvas session; absent ⇒ keyboard-insert only. */
  dragHandle?: CanvasDragHandle | undefined;
}
```

- p1. Lists `registry.blocks(doc.surface)` with display names (description → type fallback), live
  under runtime registration/disposal (registry-version subscription).
- p2. Keyboard activation inserts AFTER the selected node in its parent slot when accepted, else
  walks UP from the selection to the root taking the first accepting slot (append); no acceptor ⇒ no
  dispatch + announcement "no slot accepts <type> here".
- p3. Pointerdown + threshold hands `{kind:'insert', type}` to the canvas session; the palette never
  owns chrome or resolution. Host-document pointer coordinates are translated to frame-local space
  in ONE bridge function (the only host↔frame meeting point).

## 5. LayersTree (`components/LayersTree/`)

```ts
interface LayersTreeProps {
  kernel: BuilderKernel; // BY PROP
}
```

- l1. Rows derive from the document via the B2a `orderedChildren` model — canvas order ≡ tree order
  by construction; every node appears exactly once.
- l2. Selection is kernel state both ways: row click ⇒ `setSelection([id])`; external selection
  highlights the row and expands its ancestors to reveal it.
- l3. Expand/collapse is component view state (default expanded); document changes (undo included)
  re-derive rows without reload.
- l4. A11y: `role="tree"`/`treeitem`, `aria-expanded`/`aria-selected`, roving tabindex; Up/Down over
  VISIBLE rows, Right/Left expand/collapse-or-parent (RTL-mirrored), Enter selects.

## 6. EditorCanvas extension (additive)

```ts
interface EditorCanvasProps {
  // …005 contract §3 unchanged…
  /** Enables drag editing + Alt-moves. Absent/false ⇒ B2a behavior byte-compatible (FR-012). */
  editable?: boolean | undefined;
  /** Receives the canvas drag handle (for the palette). */
  onDragHandle?: ((handle: CanvasDragHandle) => void) | undefined;
}
interface CanvasDragHandle {
  /** Begin an insert drag from outside the frame (host coordinates; bridged internally). */
  beginInsert(type: string, hostX: number, hostY: number): void;
}
```

- e1. Editable wiring joins the EXISTING frame listeners (pointerdown feeds the session; pointermove
  feeds session-or-hover; Escape cancels the session before clearing selection; Alt+arrow feeds
  move-actions ahead of traversal).
- e2. Hover chrome is suppressed while a session is active; restored after.
- e3. All 005 guarantees (zero re-render law, announcements, geometry observation) hold with
  `editable` on — re-proven, not assumed.

## 7. Lane-A proof contract (merge-blocking, counting only)

| Proof                       | Instrument                      | Assertion                                               |
| --------------------------- | ------------------------------- | ------------------------------------------------------- |
| Chrome-only sessions        | `onBlockRender` counter         | 0 from press to pre-drop; landing AND 1,000-node stress |
| One transaction per gesture | `transactions().length`         | +1 drop/keyboard-move, +0 cancel, +0 same-position drop |
| Zero-trace cancel           | document reference + log length | `getDocument()` identical reference; chrome removed     |
| Resolver ≡ door             | generated-document sweep        | every offer dispatches; every gate-reject door-rejects  |
| Hand-built landing (SC-004) | scripted palette+drag flow      | final structure equals target; N+M transactions exactly |
| Browser truth               | Chromium play() PointerEvents   | indicator at the correct gap; committed order; RTL drag |

Wall-clock budgets (60 fps sustained drag) are NOT merge gates — documented manual run, numbers in
the evidence log (twice-validated policy).

## 8. Preset surface additions (`@craftkit/builder`)

```ts
export { LayersTree, Palette } from '@craftkit/builder-shell';
export type {
  CanvasDragHandle,
  DragPayload,
  DropTarget,
  LayersTreeProps,
  PaletteProps,
} from '@craftkit/builder-shell';
// surface.test.ts gains 'Palette' and 'LayersTree'. Apps still import ONLY '@craftkit/builder'.
```

## 9. As-implemented refinements (post-review, additive)

Two independent reviewers converged on ONE architectural seam — the host↔frame document boundary,
which jsdom does not simulate — plus test-anchoring gaps. All fixed with regression tests:

1. **`GeometryPorts.viewport(frame)` + session law s6.** "Empty area inside the canvas" (a valid
   root-append target) and "the pointer left the canvas entirely" are DIFFERENT states: outside
   `[0,width)×[0,height)` there is no target, ever — the indicator hides and a release there is a
   zero-trace cancel. Without this, a palette drag that never reached the canvas offered (and
   committed!) a phantom root append.
2. **A permanent host-side safety net** (pointermove/pointerup on the host document + window-blur →
   cancel), installed and removed by the canvas effect itself. Cross-document routing means the
   frame stops receiving a gesture the moment the pointer leaves it — without the net, sessions
   wedged `active` forever and could hijack the next unrelated gesture with a stale payload. The
   palette's `beginInsert` now only presses; the same net feeds and releases both payload kinds
   (per-gesture listeners are gone, so nothing can leak on unmount/kernel swap either).
3. **The click-suppress flag is frame-release-only**: a host-side release never synthesizes a frame
   click, so setting the flag there would swallow the NEXT legitimate canvas click.
4. **Hot-path parent lookup is memoized per document reference** (WeakMap over the immutable
   document) — the resolver's "never a tree scan per move" claim is now true by construction; the
   keyboard module's whole-document walk stays a per-keystroke cold path.
5. **Live regions mutate on REPEATED outcomes** ({text, nonce} with a zero-width toggle) in BOTH the
   gesture and palette channels — React bails out on identical strings and AT would otherwise hear
   nothing the second time.
6. **LayersTree**: focus restore when the FOCUSED row is removed is decided in the same render that
   observes the loss (the browser drops focus to body BEFORE passive effects);
   `aria-posinset`/`aria-setsize` are explicit (a flat DOM cannot convey logical sibling position);
   RTL arrow mirroring is test-covered.
7. **SC-004's arithmetic is asserted literally**: the playground shows a live transaction counter
   (Law S makes it exact), and the hand-built-landing scenario asserts 0 → 3 → 4.
8. **US1/AC4 end-to-end**: a full slot (max) is skipped by SESSION resolution over real geometry,
   while own-slot reordering is still offered — no longer proven only at the pure-function level.

## 10. Convergence refinements (post-audit, additive)

A 13-agent convergence audit (16 candidates → 7 adversarially confirmed) closed the remaining proof
and behavior gaps:

1. **SC-001's second clause is now asserted literally**: after a same-parent drop the render set is
   exactly {the mutated parent}; after a cross-parent drop on the 1,000-node stress document it is
   exactly {source parent, target parent, the moved node itself} (a real remount — keyed identity
   cannot bridge two parents). Chasing this assertion exposed a LATENT B1 defect: the recursive
   `<NodeView/>` self-reference inside `memo(function NodeView(){…})` resolved to the inner
   UN-memoized function (the function expression's own name shadows the exported const), so every
   parent re-render dragged its entire subtree. The inner function is now named `NodeViewInner` and
   children go through the memoized export — recorded in the 004 contract as well.
2. **FR-001 self-cancel covers the PENDING phase**: a move payload whose node vanishes before
   activation resets silently, and `activate()` re-checks existence — ghost chrome can never appear
   for a nonexistent node.
3. **Mid-drag geometry invalidation re-resolves the indicator with zero pointer movement**: the
   session subscribes to `RectIndex.onInvalidate` exactly like the overlay controller, closing the
   "direction flip mid-drag" edge case; proven in jsdom (flip during an active drag) and by the
   `DragRearrangeRtl` Chromium story.
4. **The resolver≡door sweep now runs over GENERATED documents** (a deterministic LCG grows 20 valid
   documents through the real door) and dispatches the RESOLVER'S OWN outputs — parent, slot, and
   index — through `moveNode`/`insertNode`, >400 resolutions per run.
5. **SC-004 is proven literally**: a scripted flow of palette DRAG-inserts plus a drag arrangement
   reproduces a declared target structure exactly (types, parents, slot order) in N+M transactions;
   the playground scenario keeps the UI-level arithmetic (0 → 3 → 4).
6. **An aborted palette drag can never become a click-insert**: `beginInsert` returns a
   `didActivate()` probe and the palette suppresses its own click after any activated gesture —
   "cancelled" now means zero trace on BOTH sides of the document boundary.
7. **The click-suppress flag is payload-aware**: only frame-originated (move) gestures set it on a
   frame release; insert gestures never do, so no stale flag can swallow the next canvas click in
   either direction.
