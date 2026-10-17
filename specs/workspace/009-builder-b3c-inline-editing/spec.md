# Feature Specification: Builder B3c Inline Editing & Floating Toolbars

**Feature Branch**: `009-builder-b3c-inline-editing`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "When the editor selects something on the canvas they should be able to
edit it right there — like Puck — and a bubble should appear offering quick actions such as bold.
The builder editor must feel professional and distinctive."

## Clarifications

- **Two toolbars, two jobs**: a BLOCK toolbar rides the selection outline and offers structural
  actions (duplicate, delete, move earlier/later, and entering text editing); a TEXT bubble appears
  only while text is selected INSIDE an inline edit and offers formatting (bold, italic, link,
  clear). They never appear together for the same gesture.
- **Inline editing edits the SAME properties the inspector edits** — one document, one door, one
  transaction law. Inline editing is a second surface onto the existing property model, never a
  parallel one; the inspector stays authoritative for everything inline editing does not cover.
- **Two property kinds are inline-editable**: a block's designated plain-text property edits as a
  single-line surface; a rich-text property edits through the SAME contributed editor B3b registered
  — no second editing engine, and the engine still loads lazily.
- **Geometry crosses a document boundary**: the editable content lives inside the preview iframe
  while the toolbars are host-document chrome. Every toolbar position is derived from frame-space
  geometry projected into host space through ONE conversion — the same discipline the drag engine
  uses.
- **Visual polish is NOT this milestone**: behavior, correctness, and accessibility here; the
  scheduled design milestone (after B4) restyles these surfaces. This spec fixes the contracts they
  will be styled against.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit text where it lives (Priority: P1)

An editor double-clicks a heading on the canvas (or presses Enter with the block selected) and the
text becomes editable in place, with the caret where they clicked. Typing updates the document
through the same one-transaction-per-commit law; Escape leaves editing and returns to block
selection; clicking another block leaves editing and selects that block. Undo restores the prior
text and the canvas shows it immediately.

**Why this priority**: editing where the content lives is the headline authoring gesture; it is what
makes the canvas feel like a builder rather than a preview.

**Independent Test**: mount the editable canvas over a kernel; double-click a text block; assert an
editing surface with a caret; type; assert transactions equal commits and the canvas text follows;
press Escape; assert editing ended with the block still selected.

**Acceptance Scenarios**:

1. **Given** a block with an inline-editable text property, **When** it is double-clicked (or Enter
   is pressed while selected), **Then** that text becomes editable in place and takes focus, with
   the block still the selected node.
2. **Given** an inline edit in progress, **When** text is typed, **Then** each commit is exactly one
   transaction and the rendered content reflects it without reload.
3. **Given** an inline edit in progress, **When** Escape is pressed, **Then** editing ends, the
   block remains selected, and no further transaction occurs.
4. **Given** an inline edit in progress, **When** another block is clicked, **Then** editing ends,
   the clicked block becomes selected, and the edit's last value is already committed.
5. **Given** undo after an inline edit, **Then** the canvas shows the restored text and the editing
   surface (if still open) shows it too — the document is the only truth.
6. **Given** a block with NO inline-editable property, **When** the gesture is attempted, **Then**
   nothing enters editing and the selection is unchanged.

---

### User Story 2 - A bubble for quick formatting (Priority: P2)

While editing rich text inline, selecting a phrase raises a small floating toolbar next to the
selection with bold, italic, link, and clear-formatting. Applying an action formats the selection,
keeps the caret and the selection intact, and commits one transaction. The bubble follows the
selection, disappears when the selection collapses or editing ends, and never covers the text it
belongs to when there is room above or below.

**Why this priority**: the quick-action bubble is the gesture that makes inline editing feel like a
real editor rather than a text box.

**Independent Test**: enter inline rich-text editing; select a phrase; assert the bubble appears
positioned near the selection in host coordinates; activate bold; assert one transaction, the mark
applied to exactly that phrase, and the selection preserved; collapse the selection; assert the
bubble disappears.

**Acceptance Scenarios**:

1. **Given** a non-empty text selection inside an inline rich-text edit, **Then** a floating toolbar
   appears anchored to that selection.
2. **Given** the bubble is showing, **When** a formatting action is activated, **Then** exactly one
   transaction applies the format to the selected text and the selection survives.
3. **Given** the selection collapses, editing ends, or the frame scrolls the selection out of view,
   **Then** the bubble disappears (never a stranded floating control).
4. **Given** the frame scrolls or the window resizes while a selection is active, **Then** the
   bubble stays anchored to the selection's on-screen position.
5. **Given** a plain-text inline edit (no rich-text property), **Then** no formatting bubble appears
   — the quick actions belong to rich text only.

---

### User Story 3 - Block actions at the selection (Priority: P3)

Selecting a block raises a compact action bar attached to its outline: duplicate, delete, move
earlier, move later, and "edit text" when the block has an inline-editable property. Every action is
one transaction, is announced, and is reachable by keyboard. The bar tracks the outline exactly as
the outline tracks the block, and hides during a drag.

**Why this priority**: the "select then act" loop is the second half of feeling like a builder; it
also gives keyboard users a discoverable route to actions that were pointer-only.

**Independent Test**: select a block; assert the action bar renders anchored to the selection
outline; activate duplicate/delete/move; assert one transaction each with the expected document
change; start a drag; assert the bar hides; drop; assert it returns.

**Acceptance Scenarios**:

1. **Given** a selected block, **Then** an action bar appears anchored to its selection outline with
   actions valid for that block.
2. **Given** any action is activated, **Then** exactly one transaction is dispatched, the change is
   announced, and the selection ends up on the node the action leaves behind (the duplicate, the
   sibling after a delete, the moved block).
3. **Given** a block that cannot be deleted (the document root), **Then** that action is absent or
   disabled rather than failing at the door.
4. **Given** a drag session starts, **Then** the action bar hides for the duration and returns on
   drop or cancel.
5. **Given** keyboard-only interaction, **Then** the action bar is reachable and operable without a
   pointer.

---

### User Story 4 - The canvas laws survive (Priority: P4)

Inline editing and the toolbars are chrome plus ONE editing surface: hovering, selecting,
positioning a toolbar, and scrolling still cause zero re-renders of document content other than the
node actually being edited. The 1,000-node stress document behaves identically. Both directions and
both editing surfaces work under RTL.

**Why this priority**: B2a's zero-render law and B2b's one-transaction law are the foundation
everything else is built on; a new interactive surface is exactly where they get broken.

**Independent Test**: on the stress document, hover/select/scroll with toolbars active and count
content renders; assert only the edited node re-renders during an inline edit; run the same
acceptance suite with an RTL document.

**Acceptance Scenarios**:

1. **Given** toolbars are active, **When** the pointer moves, the selection changes, or the frame
   scrolls, **Then** zero document-content components re-render.
2. **Given** an inline edit, **Then** only the edited node's subtree re-renders per commit.
3. **Given** an RTL document, **Then** inline editing, the bubble, and the action bar all position
   and behave correctly.
4. **Given** the 1,000-node stress document, **Then** every guarantee above holds unchanged.

---

### Edge Cases

- The edited node is removed (undo, or another surface deletes it) while editing: editing ends
  without a stray commit, and the selection is pruned as it already is elsewhere.
- The block's inline-editable property is rejected at the door mid-edit: the rejection is visible
  near the editing surface, the document is unchanged, and editing continues.
- Two rapid double-clicks, or a double-click on an already-editing block: idempotent — one editing
  session.
- A selection spanning the whole editable content, and a selection at the very top of the frame
  where the bubble would render off-screen: the bubble flips to the other side.
- The frame is scrolled while a bubble is open (see US2/AC4) and while an action bar is open.
- A drag starting from an editing surface: the drag never begins from inside an active inline edit
  (text selection wins).
- The document root and a block with no editable property both appear in the action bar scenarios;
  nothing offered may fail at the door.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Declaration): a block declares WHICH property is inline-editable; blocks that declare
  none are simply not inline-editable. No block may need per-block editing code.
- **FR-002** (Entry/exit): double-click or Enter enters editing on the selected block; Escape,
  clicking elsewhere, or selecting another block exits. Entering never changes the document; exiting
  never leaves an uncommitted value.
- **FR-003** (One transaction per commit): every inline commit dispatches exactly one command
  through the same door as the inspector; rejections are surfaced without document change.
- **FR-004** (Document truth): the editing surface renders from the document; undo, redo, and
  external edits show through immediately.
- **FR-005** (Rich reuse): a rich-text property edits through the EXISTING contributed rich editor —
  no second engine, still lazily loaded, and the published path stays engine-free.
- **FR-006** (Text bubble): a non-empty selection inside a rich inline edit raises a floating
  toolbar with bold, italic, link, and clear; each action is one transaction and preserves the
  selection; the bubble tracks the selection and disappears when it is gone.
- **FR-007** (Block action bar): a selected block raises an action bar with duplicate, delete, move
  earlier, move later, and enter-editing where applicable; each is one transaction, each announced;
  invalid actions are absent or disabled, never door failures.
- **FR-008** (Geometry): toolbar positions derive from frame-space geometry projected to host space
  through ONE conversion, stay anchored across frame scroll and viewport resize, and flip when they
  would render outside the viewport.
- **FR-009** (Chrome laws preserved): pointer movement, selection, scrolling, and toolbar
  positioning cause zero document-content re-renders; an inline edit re-renders only the edited
  node.
- **FR-010** (Keyboard & a11y): every toolbar action is a labeled control reachable by keyboard;
  entering and leaving editing is keyboard-complete; state changes are announced through the
  existing polite channels; focus never strands.
- **FR-011** (RTL): all surfaces position and behave correctly under RTL content.
- **FR-012** (Component contract): every new UI component ships the complete mechanical contract and
  passes the catalog a11y gate.
- **FR-013** (No new dependencies): B3c adds nothing to the dependency catalog.

### Key Entities

- **Inline edit session**: which node, which property, which kind (plain or rich) — view state; ends
  on Escape, blur to another block, or the node vanishing.
- **Inline-editable declaration**: the block-schema statement of which property edits inline.
- **Toolbar anchor**: a host-space rectangle derived from frame-space geometry (a selection
  rectangle for the bubble, the selection outline for the action bar).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across a scripted inline session (enter, type, format, exit), transactions equal
  commits exactly, and the canvas matches the document at every step.
- **SC-002**: With toolbars active, pointer movement, selection changes, and frame scrolling produce
  zero content re-renders on the 1,000-node stress document (mechanical count); an inline edit
  re-renders exactly one node's subtree.
- **SC-003**: Every block-action-bar action produces exactly one transaction with the expected
  document change and the expected resulting selection, in 100% of automated cases.
- **SC-004**: Bubble and action-bar anchors match their target geometry in a table-driven
  positioning suite, including frame-scrolled, viewport-edge (flip), and RTL cases.
- **SC-005**: The engine loader is invoked zero times in sessions that never inline-edit rich text
  (the B3b containment law holds through the new surface).
- **SC-006**: All new UI components pass the mechanical contract and the catalog a11y gate at error
  level; the browser-truth stories prove inline editing and the bubble in real Chromium.
- **SC-007**: The complete acceptance suites for Stories 1–4 pass in the workspace verification
  pipeline.

## Assumptions

- The B2a geometry index and B2b drag session are sufficient as-is; this milestone consumes them and
  adds a selection-rectangle channel rather than a second geometry system.
- The B3b field machinery (rich editor, projection, door) is reused unchanged.
- Visual design of these surfaces is the scheduled design milestone's job; this spec fixes behavior
  and contracts only.
- The playground remains the demonstration host.
