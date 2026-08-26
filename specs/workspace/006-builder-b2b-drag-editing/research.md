# Research & Decisions: Builder B2b Drag Editing

Verified 2026-08-25 against the repository, the accepted 003/004/005 artifacts, and the installed
toolchain. Format: Decision / Rationale / Alternatives.

## R1 — Zero new dependencies (the in-repo drag engine)

**Decision**: No catalog additions — no dnd library, no vendored editor code. The drag engine is
plain TypeScript in `builder-shell` on top of B2a's primitives: `RectIndex` (geometry + `nodeAt`
hit-testing), the chrome layer + frame-batched flush discipline, the traversal model, and the
announcement channel. Pointer events come from the frame document exactly as B2a's hover path does.

**Rationale**: three forces align. (1) _The law_: dnd libraries drive drag state through
view-library context — subscribed draggable/droppable components re-render during the drag, which
structurally violates the zero-content-re-render law B2a just proved; fighting a library's render
model to preserve our invariant is worse than not inviting the conflict. (2) _The primitives already
exist_: what a zone system fundamentally provides — a rect registry, hit-testing, and drop-candidate
resolution — IS the B2a rect index; adding a second geometry system beside it would duplicate state
with divergent invalidation. (3) _Precedent_: R3-004 (in-repo CanvasFrame over vendored AutoFrame)
and R2-005 made the same call for the same reasons and both survived independent review. The
vendor/license machinery (VENDOR.md + THIRD_PARTY_LICENSES.md) explicitly starts only when a
milestone actually transplants code — none does here; zone CONCEPTS (before/after halves, indicator
language) are re-derived from first principles on the flat slots model.

**Alternatives**: @dnd-kit/core (rejected — context-driven re-renders on the content path; its
collision detection operates on ITS droppable registry, parallel to our rect index; its value-add —
sensors abstraction, a11y announcements — duplicates what B2a already ships); vendoring the
reference editor's zone layer (rejected — it is welded to that editor's config/ store/data model,
all four of which the mining notes explicitly say NOT to take; a transplant would be a rewrite
wearing a license file).

## R2 — Session model: a chrome-state machine beside the overlay controller

**Decision**: `createDragSession` (plain TS, `overlay/drag-session.ts`) owns
`idle → pending → active → committed|cancelled`. `pending` starts on pointerdown over a node wrapper
(canvas) or a palette entry (payload `{kind:'move', id}` or `{kind:'insert', type}`); crossing a 4px
threshold activates; release commits or cancels; Escape cancels; a store subscription self-cancels
the session if a `move` payload's node disappears (FR-001 edge). While active, the session drives
THREE prebuilt chrome elements — ghost outline, target highlight, insertion indicator — through the
same one-flush-per-frame scheduler the overlay controller uses, and suppresses the hover outline
(one chrome authority at a time).

**Rationale**: mirrors the B2a controller's proven shape (dirty flag → batched flush → direct DOM);
`pending` keeps plain clicks intact (US1 edge); chrome elements are prebuilt so the drag path
allocates nothing per move.

**Alternatives**: driving drag through React state in EditorCanvas (rejected — re-renders); merging
into overlay-controller.ts (rejected — the controller is selection/hover truth, the session is
gesture truth; separate lifecycles, separate files, both React-free).

## R3 — Target resolution: hit-test + parent-chain walk, rules first

**Decision**: `overlay/drop-resolver.ts`, pure function
`resolveDropTarget(doc, registry, index, session, x, y): DropTarget | null` where
`DropTarget = {parentId, slot, index, indicatorRect}`. Algorithm per pointer move: `nodeAt(x,y)` →
hovered node; candidates in priority order: (a) sibling gap in the hovered node's parent slot —
before/after by pointer position within the hovered rect's vertical half (visual order, so RTL
follows geometry automatically); (b) into-drop: the hovered node's own first slot whose rules accept
the payload, at its end; (c) walk UP the parent chain repeating (a)/(b) until the root. Rules gate
every candidate: `allow` includes the payload type; `max` not exceeded (a node reordering within its
own slot is exempt — it already holds a seat); self-and-descendant parents are excluded for `move`
payloads (ancestor check via the parent map). Same-position resolution returns the current location
unchanged — the drop layer then skips dispatch entirely (FR-005's no-transaction case, belt) and the
kernel's no-effect rule backs it (suspenders).

**Rationale**: bounded work per move — one hit-test plus at most one parent-chain walk (FR-015);
purity makes the resolver exhaustively unit-testable against SC-003 (resolution ≡ door validation)
without any DOM.

**Alternatives**: droppable-zone registration per slot (rejected — a second registry beside the rect
index); nearest-gap search across ALL siblings' rects per move (rejected — O(siblings) measurement
per move; the half-rule needs only the hovered node's own cached rect).

## R4 — Drop dispatch and the one-transaction law

**Decision**: commit = exactly one dispatch: `moveNode {id, toParentId, toSlot, toIndex}` for move
payloads (index adjusted down by one when moving forward within the same slot — the node's own
removal shifts positions), `insertNode {type, parentId, slot, index}` for palette payloads. The
session then selects the affected node (moved id, or `insertedNodeId(tx.patches)`), which is kernel
bookkeeping, not a second transaction. Cancel dispatches nothing. SC-002's byte-identity is asserted
on `getDocument()` reference equality (the sealed store guarantees no write ⇒ same object) plus
`transactions().length`.

**Rationale**: the single-door law does the heavy lifting — validation, patches, inverse, history —
and the no-effect rule already returns transaction-free for same-position drops.

## R5 — Keyboard moves: same resolver, no pointer

**Decision**: with a selected node, `Alt+ArrowUp/Down` = sibling swap (toIndex = current ∓ 1,
clamped — out-of-range is a silent no-op per US4/AC2); `Alt+ArrowLeft` (step-out, mirrored to
`Alt+ArrowRight` under RTL content) = become the parent's next sibling when the grandparent slot
accepts the type; `Alt+ArrowRight` (step-in, mirrored) = append into the nearest PRECEDING sibling's
first accepting slot. Every move funnels through the same rule-check helper the resolver uses,
dispatches one `moveNode`, keeps selection on the moved node, and announces ("moved after …" /
"cannot move: slot 'x' does not accept 'type'"). Alt is chosen because plain arrows are traversal
(B2a) and browsers reserve Ctrl/Cmd+arrows.

**Rationale**: gesture parity by construction — one shared rule path means SC-003 covers both input
modes; announcements ride the existing polite channel (FR-010).

**Alternatives**: a "grab mode" (Space to lift, arrows to place, Space to drop — the classic a11y
drag pattern) (deferred — strictly more states to announce; Alt-moves deliver full arrangement
parity now, grab mode can layer on in the panels milestone without contract change).

## R6 — Palette: catalog-driven, two insert paths

**Decision**: `components/Palette/` (full contract) renders `registry.blocks(surface)` filtered to
types that are allowed in at least one slot of some registered container (cheap static check;
entries never hidden — an entry with no accepting slot in the CURRENT document stays visible and
announces the rejection on activation, per US2 edge). Uses the existing registry-version
subscription for runtime liveness (FR-007). Entries are buttons: keyboard activation inserts at the
selection (walk-up rule, US2/AC3); pointerdown+threshold starts an `insert` drag session handed to
the SAME canvas session machinery (the palette only creates the payload — the canvas owns chrome and
resolution). The palette lives OUTSIDE the frame (host document), so its pointermove during drag is
bridged: the session listens on the host document too and translates coordinates into frame space
via the frame's bounding rect (the one place host/frame spaces meet, isolated in one function).

**Rationale**: catalog is already live and sorted; one session machinery for both payload kinds
keeps US1 and US2 proofs shared.

## R7 — Layers tree: rows from the traversal model, selection from the kernel

**Decision**: `components/LayersTree/` (full contract). Row list derives from the document +
`orderedChildren` (the B2a traversal model — same slot ordering the canvas uses), memoized per
document reference; expand/collapse is component state (`Set<NodeId>`), defaulting to expanded;
selection reads/writes the kernel exactly like the canvas. Selecting from elsewhere expands
ancestors to reveal the row (FR-008). Keyboard: standard tree pattern (Up/Down visible rows,
Right/Left expand/collapse-or-parent, Enter selects) with `role="tree"`/`role="treeitem"`/
`aria-expanded`/`aria-selected` and roving tabindex.

**Rationale**: reusing `orderedChildren` guarantees canvas/tree order identity (SC-006);
kernel-owned selection needs zero new wiring — it is the same `useKernelSelector` read and
`setSelection` write the canvas uses.

**Alternatives**: virtualizing rows for the stress doc (deferred — expanded-set defaulting can be
revisited; tree perf is not a B2b exit criterion and adding a virtualization dependency contradicts
R1).

## R8 — EditorCanvas integration: one additive prop

**Decision**: `EditorCanvas` gains `editable?: boolean` (default false — B2a behavior unchanged,
FR-012). When true it wires the drag session into the existing frame listeners (pointerdown/move/up
joining the current handlers), registers the Alt-move keydown branch ahead of traversal, and exposes
the session to the palette through a small `CanvasDragHandle` (context-free — passed by prop from
the composing surface). Shell exports `Palette`, `LayersTree`, `EditorCanvas` (now
editable-capable); the preset re-exports; the playground composes canvas + palette + layers in edit
mode.

**Rationale**: additive-prop evolution keeps every 005 test meaningful unchanged; passing the drag
handle by prop (not context) preserves the shell's no-context law.

## R9 — Lane-A proofs (counting) + the deferred smoothness script

**Decision**: merge gates count: press-to-predrop content re-renders = 0 (landing + stress);
transactions per gesture (1 / 0 / 0 for drop/cancel/same-position); resolver ≡ door agreement
(SC-003: property-style sweep over generated documents asserting every offered target dispatches
cleanly and every non-offered candidate is door-rejected); byte-identity on cancel. Browser truth:
Storybook play() drags via dispatched PointerEvents in Chromium asserting indicator geometry and the
committed order. The 60 fps sustained-drag budget is NOT a merge gate: a standalone
`scripts/perf-drag.md`-documented manual run records numbers in the evidence log (the dedicated
Lane-B job arrives with CI infrastructure, per the twice-validated policy).

## R10 — Storybook coverage

**Decision**: existing globs already cover new shell components (`packages/builder/*/src/**`) and
playground components; the R12-005 catalog-presence check extends to Palette/LayersTree entries in
the evidence run. No `main.ts` changes expected.
