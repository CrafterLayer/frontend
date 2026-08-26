# Feature Specification: Builder B2b Drag Editing

**Feature Branch**: `006-builder-b2b-drag-editing`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Builder B2b: turn the read-only canvas into an arranging canvas — drag
existing blocks between and within slots on the flat slots map, insert new blocks from a palette of
the registered vocabulary, and navigate/select through a layers tree. A drag session is pure chrome
until the moment of drop: exactly one document transaction per completed drop, zero trace on cancel.
Slot rules (allow lists, max counts) decide valid targets while dragging, not after. Keyboard-only
users can reorder and insert without a pointer. Still zero inline editing, zero resize, zero styling
UI — those are later milestones."

## Clarifications

- **In-repo drag engine (deviation from the reference docs, following the R3-004 and R3-005
  precedent).** The reference plan mines a vendored third-party zone layer plus a drag library. B2a
  already built the exact primitives a drag engine needs — the observer-invalidated geometry index,
  point hit-testing, a React-free chrome layer, and a frame-batched overlay controller — and the
  third-party pairing drives drag state through view-library context, which would re-render content
  mid-drag and break this builder's zero-content-re-render law. The drag engine is therefore built
  in-repo on the B2a machinery. No third-party editor code is copied in this milestone (the
  vendor/license machinery starts if and when a milestone actually transplants code); the
  reference's zone CONCEPTS (candidate resolution, before/after halves, insertion indicator) are
  re-derived on the flat slots model.
- **One-transaction law extends the kernel laws to gestures**: mid-drag there is no document
  mutation of any kind — ghost, target highlight, and insertion indicator are chrome; drop
  dispatches exactly one `moveNode`/`insertNode` through the validated door; cancel leaves the
  document, history, and transaction log byte-identical.
- **Merge-blocking proofs stay counted, never timed** (standing policy, twice-validated): drag
  smoothness budgets (60 fps sustained) belong to the uncontended evidence run and a dedicated
  non-merge-blocking performance script; CI gates count re-renders and transactions.
- Layers tree in B2b is navigate/select/expand only; reordering happens on the canvas (pointer or
  keyboard). Drag-within-layers is deferred with the rest of the panel system.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Rearrange by dragging (Priority: P1)

An editor presses on a block in the canvas and moves it: a ghost outline follows the pointer, an
insertion indicator line shows exactly where the block would land (between which siblings, in which
parent slot), and slots that cannot accept the block visibly refuse it. Releasing over a valid gap
moves the block there — one undoable step. Releasing over nothing, or pressing Escape mid-drag,
cancels: the document is untouched and no history entry exists.

**Why this priority**: arranging is the first document-mutating gesture and the reason the canvas
exists; every later editing surface builds on the drop-target machinery.

**Independent Test**: mount the editing canvas over a fixture document with injected geometry;
simulate press-move-release across slots; assert indicator positions, the single resulting
transaction, the new slot membership/order, and the zero-trace cancel.

**Acceptance Scenarios**:

1. **Given** a document with sibling blocks A, B, C in one slot, **When** the editor drags C and
   releases over the gap between A and B, **Then** the slot order becomes A, C, B via exactly one
   transaction, undoable in one step.
2. **Given** a block being dragged, **When** the pointer is over the upper half of a sibling,
   **Then** the insertion indicator shows BEFORE that sibling; over the lower half, AFTER it.
3. **Given** a block whose type a slot's allow list rejects, **When** the pointer hovers that slot's
   area mid-drag, **Then** no insertion indicator is offered there and releasing does not mutate the
   document.
4. **Given** a slot at its `max` capacity, **When** a block from elsewhere is dragged over it,
   **Then** the slot is not offered as a target — unless the dragged block already lives in that
   slot (reordering within a full slot stays allowed).
5. **Given** an active drag, **When** Escape is pressed or the pointer is released over no valid
   target, **Then** the document, transaction log, and history are byte-identical to before the
   press, and all drag chrome is gone.
6. **Given** any complete drag interaction, **When** content re-renders are counted from press to
   before drop, **Then** the count is zero — only the drop's own transaction re-renders exactly the
   affected nodes.

---

### User Story 2 - Build from the palette (Priority: P2)

An editor opens the palette, sees the registered block vocabulary with display names, and adds a
block two ways: dragging a palette entry into a canvas gap (same indicator language as rearranging),
or keyboard-activating an entry to insert it at a sensible position relative to the current
selection. Runtime-registered block types appear in the palette without reload; disposed ones leave
it.

**Why this priority**: inserting is how a page gets built at all; it reuses the entire US1
target-resolution machinery.

**Independent Test**: mount palette + canvas over a kernel; assert the palette lists the catalog
(and tracks runtime registration); drag an entry to a gap and assert one insert transaction with
correct type/parent/slot/index; keyboard-activate an entry and assert the insertion position rule.

**Acceptance Scenarios**:

1. **Given** a registered vocabulary, **When** the palette renders, **Then** it lists every
   registered block type with its display name, excluding none.
2. **Given** a palette entry dragged over the canvas, **When** it is released at a valid gap,
   **Then** exactly one insert transaction creates a node of that type at that parent/slot/index,
   with schema defaults applied.
3. **Given** a selected block, **When** a palette entry is keyboard-activated, **Then** the new
   block is inserted after the selected block in its parent slot when allowed there — otherwise into
   the first slot (walking up from the selection to the document root) whose rules accept the type;
   if none accepts, nothing is inserted and the editor is told why.
4. **Given** an extension registered at runtime contributing new block types, **When** the palette
   re-renders, **Then** the new types are present without reload; after disposal they are gone.
5. **Given** a palette drag released over no valid target, **Then** zero trace (as US1/AC5).

---

### User Story 3 - Navigate the structure as a tree (Priority: P3)

An editor opens the layers tree and sees the document's structure — every node, nested by slot,
labeled with its display name. Clicking a row selects that node on the canvas (same outline, same
announcement); selecting on the canvas highlights and reveals the row. Rows with children expand and
collapse; keyboard navigation moves through visible rows.

**Why this priority**: deep or visually-dense documents need a structural handle; it also proves
selection is truly a single shared state across three surfaces (canvas, tree, kernel).

**Independent Test**: mount the tree over a fixture kernel; assert row structure matches the
document (slots in schema order); click rows and assert kernel selection; set selection
programmatically and assert the row highlight; expand/collapse and keyboard-walk rows.

**Acceptance Scenarios**:

1. **Given** the landing fixture, **When** the tree renders, **Then** every document node appears
   exactly once, nested under its parent, ordered as the canvas orders slots (schema declaration
   order, then array order).
2. **Given** a tree row is clicked, **Then** the kernel selection becomes that node and the canvas
   outline moves accordingly; **Given** selection changes from anywhere else, **Then** the matching
   row is highlighted and its ancestors are expanded so it is visible.
3. **Given** a collapsed row with children, **When** toggled, **Then** its subtree shows/hides;
   collapse state is view state and never touches the document.
4. **Given** the tree has focus, **When** Up/Down arrows move through VISIBLE rows, Right/Left
   expand/collapse or step to parent (mirrored under RTL shell conventions), and Enter selects,
   **Then** a keyboard-only editor can reach and select every node.
5. **Given** a document change removes or adds nodes (undo included), **Then** the tree reflects it
   without reload and a removed selected node's row highlight clears.

---

### User Story 4 - Arrange without a pointer (Priority: P4)

A keyboard-only editor selects a block on the canvas and moves it: a modifier with the vertical
arrows swaps it with its previous/next sibling; the same modifier with the horizontal arrows moves
it out to become a sibling of its parent, or into the nearest preceding sibling that can accept it.
Each completed move is one transaction with the same announcement channel as selection. Rules that
would reject a pointer drop reject the keyboard move identically.

**Why this priority**: gesture parity is an accessibility baseline, and it exercises the same
single-door mutation path as dropping.

**Independent Test**: drive the canvas entirely by keyboard: select, move within a slot, move out,
move in, attempt an illegal move; assert transactions, order, announcements, and rejections.

**Acceptance Scenarios**:

1. **Given** siblings A, B, C with B selected, **When** modifier+Down is pressed, **Then** order
   becomes A, C, B in one transaction; modifier+Up reverses it.
2. **Given** a first/last sibling, **When** moved further up/down, **Then** nothing happens — no
   transaction, no error state.
3. **Given** a nested block, **When** modifier+step-out is pressed, **Then** it becomes a sibling of
   its parent (placed after the parent) when the grandparent slot's rules accept it; an illegal move
   is announced and changes nothing.
4. **Given** any keyboard move, **Then** the announcement channel reports the result ("moved
   before/after …", "cannot move: …") and selection stays on the moved block.

---

### Edge Cases

- Drag started but pointer never crossed the threshold: treated as a click (selection), no drag
  chrome ever appears.
- The dragged node is removed mid-drag by another surface (undo elsewhere): the session cancels
  itself with zero trace.
- Dropping a node onto ITSELF or into its own descendant slot: never offered as a target (a node
  cannot become its own ancestor); releasing there is a cancel.
- Reordering to the position the node already occupies: drop resolves to a no-effect move and
  produces NO transaction (the kernel's no-effect rule already guarantees this).
- A drag leaving the canvas viewport: indicator hides; releasing outside cancels.
- Palette entry whose type no slot in the current document can accept: entry is visible but its
  keyboard insert reports "no slot accepts this here" and drags over the canvas offer no target.
- Direction flip mid-drag: geometry re-resolves (B2a's observation channels) and the indicator stays
  correct; before/after halves follow the visual order.
- The 1,000-node stress document: candidate resolution stays bounded (hit-test plus one parent chain
  walk — never a whole-tree scan per pointer move).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Drag session lifecycle): Pressing on a canvas block and moving beyond a small
  threshold MUST start a drag session; releasing MUST either commit (valid target) or cancel; Escape
  MUST cancel; a session MUST also self-cancel if its node disappears.
- **FR-002** (Chrome-only until drop): An active session MUST NOT mutate the document, emit
  transactions, or re-render any document content. Ghost, target highlight, and insertion indicator
  are chrome-layer elements positioned from the geometry index.
- **FR-003** (Target resolution on the flat slots map): The session MUST resolve, per pointer
  position, a candidate `(parentId, slot, index)` using: the hovered node's before/after half for
  sibling gaps; the hovered node's own slots for into-drops; ancestor walk for nothing-hovered gaps;
  document order everywhere.
- **FR-004** (Slot rules gate targets): Resolution MUST offer only targets whose slot `allow` list
  accepts the dragged type and whose `max` is not exceeded (a node re-ordering within its own slot
  does not count against `max`). Self-and-descendant targets MUST never be offered.
- **FR-005** (One transaction per drop): A committed drop MUST dispatch exactly one `moveNode`
  (rearrange) or `insertNode` (palette) through the kernel door; a drop that resolves to the node's
  current position MUST produce no transaction.
- **FR-006** (Zero-trace cancel): After a cancel, the document, history, and transaction log MUST be
  identical to the pre-press state and every piece of drag chrome MUST be gone.
- **FR-007** (Palette catalog): The palette MUST list the registered block vocabulary with display
  names, live under runtime registration/disposal, and support both drag-to-insert and keyboard
  insert-at-selection (the walk-up placement rule of US2/AC3).
- **FR-008** (Layers tree): The tree MUST mirror the document structure (slots in schema declaration
  order), share kernel selection bidirectionally, reveal the selected row, support expand/collapse
  as pure view state, and be fully keyboard-navigable.
- **FR-009** (Keyboard moves): Modifier+arrow moves MUST perform sibling reorder and out/in moves
  through the same resolution rules as drops, one transaction each, announced.
- **FR-010** (Announcements): Session outcomes (moved, inserted, cancelled, rejected reasons) MUST
  reach the existing polite announcement channel.
- **FR-011** (Direction correctness): All drag chrome and before/after semantics MUST be correct in
  LTR and RTL, including a live flip mid-session.
- **FR-012** (Read-only surfaces unchanged): The plain preview, static rendering, and B2a's
  read-only canvas behaviors MUST be unaffected when drag editing is not mounted.
- **FR-013** (Complete component contract): Every new UI component ships the complete mechanical
  contract and enters the catalog's accessibility gate.
- **FR-014** (Kernel laws preserved): The Law-S audit MUST hold across full drag interactions: every
  observable change pairs 1:1 with a transaction; cancel contributes zero.
- **FR-015** (Stress behavior): Sessions on the 1,000-node stress document MUST keep per-move work
  bounded (hit-test + parent-chain walk; no full-tree scans) with zero content re-renders.

### Key Entities

- **Drag session**: ephemeral chrome-state machine —
  `idle → pending (pressed, under threshold) → active (payload: existing node | palette type) → committed | cancelled`;
  never kernel state.
- **Drop target**: a resolved `(parentId, slot, index)` triple plus its indicator geometry;
  existence implies rule-validity.
- **Insertion indicator**: prebuilt chrome line positioned at the target gap.
- **Palette entry**: a registered block type's display name + type key; source for insert payloads.
- **Layers row**: a node's tree representation — id, depth, expandable, expanded (view state),
  selected (kernel state).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across full drag interactions (press, sweep, hover targets, drop) content re-renders
  counted before the drop are exactly 0, on the landing and 1,000-node fixtures; the drop itself
  re-renders only the affected nodes.
- **SC-002**: 100% of completed drops produce exactly one transaction; 100% of cancels leave the
  document, history, and log byte-identical; a same-position drop produces zero transactions.
- **SC-003**: Slot-rule enforcement at resolution time matches the door's own validation in 100% of
  automated cases (nothing offerable is dispatch-rejected; nothing rejected is offered).
- **SC-004**: A scripted "build the landing page by hand" flow — inserting from the palette and
  arranging by drag — reproduces the target document structure exactly, in N inserts + M moves = N+M
  transactions.
- **SC-005**: Keyboard-only flows achieve every arrangement the pointer can (reorder, out, in) on
  the fixture document, with announcements at each step.
- **SC-006**: The layers tree mirrors 100% of document nodes, syncs selection both ways in 100% of
  automated cases, and updates on document change without reload.
- **SC-007**: 100% of new UI components pass the mechanical contract validation and the catalog
  accessibility gate; the complete acceptance suites for Stories 1–4 pass in the workspace
  verification pipeline.

## Assumptions

- The B0 command set is sufficient (`moveNode {id, toParentId, toSlot, toIndex}`,
  `insertNode {type, props?, parentId, slot, index}`); no new commands are introduced.
- The B2a geometry index, overlay controller, hit-testing, and announcement channel are reused
  as-is; drag chrome joins the same chrome layer.
- Palette display names come from block schema descriptions (fallback type), as B2a labels do.
- The drag ghost is an outline clone (chrome), not a live render of the block — faithful visual
  cloning is deferred with the styling system.
- Multi-select drag, drag between documents, copy-drag (modifier duplicating), and
  drag-within-layers are out of scope for B2b.
- The playground remains the demonstration host; panels (palette, layers) mount beside the canvas in
  edit mode without any new app-level state management.
