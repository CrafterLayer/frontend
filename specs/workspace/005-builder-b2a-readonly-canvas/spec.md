# Feature Specification: Builder B2a Read-Only Canvas

**Feature Branch**: `005-builder-b2a-readonly-canvas`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Builder B2a read-only canvas: make the rendered document inspectable
and selectable in place, with zero editing gestures. Introduce the builder's shell layer as the home
of canvas chrome: a geometry index kept current purely by observation, and an overlay layer above
the preview with hover and selection outlines. Clicking selects through the kernel's existing
selection state; the overlay's hot path causes zero document-content view updates; the chrome layer
is extensible through the existing canvas-tool contribution point. Non-goals: drag, drop, resize,
inline editing, palette, layers panel. Keyboard accessibility baseline, both content directions,
1,000-node stress guarantee."

## Clarifications

- The builder's reference documents describe this milestone's chrome (overlay host, geometry index)
  as part of the builder's shell tier; this feature introduces that tier as one new workspace
  member. The full editing shell (top bar, panels, palette, layers) arrives in later milestones —
  this feature ships only the read-only canvas portion of the shell.
- "Read-only" bounds GESTURES, not state: selecting a node is allowed (selection is workbench state,
  not document content) — no gesture in this milestone changes the document itself.
- The canvas-tool contribution point already exists in the extension contract (declared with
  deliberately abstract geometry/layer inputs); this feature concretizes those inputs and renders
  the contributions. That refinement is additive and recorded in this feature's contracts.
- Per the standing performance policy (Lane split): merge-blocking proofs in this feature are
  mechanical COUNTS (view-update counters, observer-invalidation counters), never wall-clock
  assertions; absolute timing numbers are recorded by uncontended evidence runs.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Inspect and select in place (Priority: P1)

An editor opens a document in the builder, moves the pointer across the rendered page, and sees a
light outline tracing the block under the pointer with its display name. Clicking a block marks it
as selected: a persistent, visually distinct outline with the block's display name stays on it.
Selecting another block moves the outline; clicking empty canvas or pressing Escape clears the
selection. None of this changes the document, and none of it re-draws any document content.

**Why this priority**: this is the foundational editing affordance — every future gesture (drag,
inspect, edit) begins with "the user can see and pick a block". It is also the milestone's hardest
guarantee (zero content re-draws), so it must be proven first.

**Independent Test**: mount the canvas over a fixture document with a mechanical view-update counter
attached to document content; hover and select nodes; assert outlines appear/move/clear correctly
while the content counter records zero updates.

**Acceptance Scenarios**:

1. **Given** a rendered fixture document, **When** the pointer moves over a block, **Then** a hover
   outline with the block's display name appears over exactly that block, and the content
   view-update count stays 0.
2. **Given** a hover outline is visible, **When** the user clicks the block, **Then** the block
   becomes the current selection in the workbench state, a persistent selection outline appears, and
   the content view-update count stays 0.
3. **Given** a selected block, **When** the user clicks a different block, **Then** the selection
   outline moves to the new block and the previous outline is removed.
4. **Given** a selected block, **When** the user clicks empty canvas or presses Escape, **Then** the
   selection clears and no outline remains.
5. **Given** the 1,000-node stress document, **When** the pointer sweeps across many blocks,
   **Then** hover feedback stays correct and the content view-update count stays 0.

---

### User Story 2 - Geometry stays true without interaction (Priority: P2)

The chrome always knows where each block is actually drawn. When content reflows — an image loads, a
block grows, the preview scrolls or resizes, the content direction flips, or an undo removes the
selected block — outlines follow the new geometry (or disappear when their node is gone) without the
user doing anything and without the system continuously re-measuring.

**Why this priority**: outlines that drift or linger destroy trust in the canvas; correctness of the
geometry index is what separates a real canvas from a demo. It depends on Story 1's chrome to be
observable.

**Independent Test**: mount the canvas, mutate layout programmatically (resize a block, scroll, flip
direction, undo a change) with no pointer interaction, and assert the geometry index and any visible
outline reflect the new positions — with instrumentation proving updates were driven by observation
events, not by per-interaction measurement or polling.

**Acceptance Scenarios**:

1. **Given** a selected block with a visible outline, **When** the block's rendered size changes
   (content growth), **Then** the outline matches the new bounds without any pointer interaction.
2. **Given** a selected block, **When** the preview scrolls or its viewport resizes, **Then** the
   outline stays glued to the block's on-screen position.
3. **Given** a selected block, **When** an undo removes that block from the document, **Then** the
   selection clears and its outline disappears.
4. **Given** a selected block, **When** the document's content direction flips, **Then** the outline
   is repositioned correctly for the new direction.
5. **Given** an idle canvas with no interactions, **When** no layout changes occur, **Then** no
   geometry re-measurement work happens (no polling).

---

### User Story 3 - Keyboard-first selection (Priority: P3)

An editor who cannot or prefers not to use a pointer focuses the canvas and walks the document with
the keyboard: sequential traversal moves the selection between sibling blocks, stepping into and out
of nested slots follows the document's structure, and Escape clears the selection. Every outline
announces the block it marks by name to assistive technology.

**Why this priority**: accessibility is a constitution-level baseline, and keyboard traversal also
exercises the same selection machinery as pointer interaction, hardening it.

**Independent Test**: focus the canvas, drive selection entirely with the keyboard across the
fixture document (siblings, into a nested slot, out again, clear), and assert selection state and
accessible names at each step.

**Acceptance Scenarios**:

1. **Given** a focused canvas with no selection, **When** the user presses the forward traversal
   key, **Then** the first top-level block becomes selected.
2. **Given** a selected block with a following sibling, **When** forward traversal is pressed,
   **Then** the selection moves to that sibling; backward traversal returns.
3. **Given** a selected block that contains a populated slot, **When** the step-in key is pressed,
   **Then** the selection moves to the slot's first child; step-out returns to the parent.
4. **Given** any selection, **When** Escape is pressed, **Then** the selection clears.
5. **Given** any visible outline, **When** inspected by assistive technology, **Then** it exposes
   the block's display name and selected state.

---

### User Story 4 - Chrome is extensible, live (Priority: P4)

An extension author ships a read-only canvas tool — for example a badge that appears beside the
selection. Registering the extension at runtime makes the tool appear on the next selection with no
reload; disposing the extension removes it. The tool mounts imperatively into the chrome layer,
receives the target's identity and geometry, and returns a cleanup that runs when the tool is
dismissed.

**Why this priority**: extensibility is the architecture's reason for existing, but it rides on
Stories 1–2 being correct first.

**Independent Test**: in the playground, register a demo canvas-tool extension at runtime, select a
block, assert the badge appears positioned at the selection; dispose the extension and assert the
badge is gone and its cleanup ran.

**Acceptance Scenarios**:

1. **Given** a registered extension contributing a selection tool, **When** a block is selected,
   **Then** the tool mounts once, positioned from the selection's geometry.
2. **Given** a mounted tool, **When** the selection moves or clears, **Then** the tool's cleanup
   runs before any next mount.
3. **Given** a runtime-registered tool extension, **When** it is disposed, **Then** its chrome
   disappears without reload and cleanups have run.
4. **Given** a tool that declares hover activation, **When** a block is hovered, **Then** the tool
   mounts on hover and cleans up on leave.

---

### Edge Cases

- Pointer over the gap BETWEEN blocks: hover outline clears (no stale outline on the nearest block).
- Selected node removed by undo/redo or a command from another surface: outline clears and workbench
  selection resets — never a dangling outline over reused space.
- Hovering nested structures (a child block inside a parent's slot): the innermost block under the
  pointer wins; parent remains reachable via keyboard step-out.
- Preview shown before any geometry has been observed (first frame): interactions are safe and
  outlines simply appear when geometry arrives — no crash, no wrong-position flash committed.
- Two rapid selections within one frame rhythm: only the final selection's chrome is visible.
- A canvas tool whose loader rejects or whose mount throws: the failure is contained (reported,
  chrome continues working) — one broken tool cannot take down the canvas.
- Content direction flip while a tool is mounted: the tool is remounted with fresh geometry.
- The stress document at 1,000 nodes: geometry observation stays bounded (observation is attached
  per rendered block, and idle cost is zero).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Geometry index): The canvas MUST maintain an index of the on-screen geometry of every
  rendered document node inside the preview boundary, addressable by node identity.
- **FR-002** (Observation-only currency): The geometry index MUST be kept current exclusively by
  observation of layout-affecting events (element size changes, content mutations, scrolling,
  preview viewport resizes) — never by per-interaction measurement and never by polling.
- **FR-003** (Hover chrome): Moving the pointer over a rendered node MUST show a hover outline with
  the node's display name over exactly that node; leaving it MUST clear the outline.
- **FR-004** (Selection through the kernel): Clicking a rendered node MUST set the kernel's existing
  selection state to that node; the canvas renders selection chrome FROM that state, so selection
  made anywhere else (programmatically, another surface) shows identically.
- **FR-005** (Selection chrome): The selected node MUST carry a persistent, visually distinct
  outline with its display name; empty-canvas click and Escape MUST clear the selection.
- **FR-006** (Zero content re-draws): Pointer movement, hovering, selecting, and clearing MUST cause
  zero view updates of document content — chrome positioning is applied directly to the chrome
  layer, batched to the display's frame rhythm.
- **FR-007** (Selection tracking): Chrome MUST track document changes: undo/redo or commands that
  move, resize, or remove the selected/hovered node update or clear its chrome without user
  interaction.
- **FR-008** (Read-only guarantee): No canvas gesture in this milestone may change the document.
  Drag, drop, resize, inline editing, palette, and layers are explicitly out of scope.
- **FR-009** (Keyboard traversal): The canvas MUST be focusable; keyboard traversal MUST move
  selection across siblings, into and out of populated slots (document order), and Escape MUST
  clear; traversal keys respect the content direction where directional.
- **FR-010** (Accessible chrome): Outlines MUST expose the target block's display name and selected
  state to assistive technology; chrome MUST NOT steal focus from the canvas.
- **FR-011** (Direction correctness): All chrome MUST position correctly in both content directions,
  including after a live direction flip.
- **FR-012** (Canvas-tool contributions): The chrome layer MUST render the extension contract's
  existing canvas-tool contributions: tools declare their activation (selection, hover, always),
  mount imperatively with the target's identity and geometry, and MUST have their returned cleanup
  run on dismissal, activation change, and extension disposal.
- **FR-013** (Runtime tool lifecycle): A canvas tool from an extension registered at runtime MUST
  appear on its next activation without reload; disposing the extension MUST remove its chrome and
  run cleanups.
- **FR-014** (Tool fault isolation): A canvas tool that fails to load or throws on mount MUST NOT
  break built-in chrome or other tools; the failure is surfaced as a contained report.
- **FR-015** (Stress behavior): All of the above MUST hold on the 1,000-node stress document, with
  zero idle cost when nothing changes.
- **FR-016** (Complete component contract): Every new UI component in this feature ships the
  complete mechanical contract (implementation, local export, typed story, docs, behavior test) and
  enters the shared catalog's accessibility gate.
- **FR-017** (Kernel laws preserved): All kernel guarantees remain intact with the canvas mounted —
  selection is workbench state (never a transaction), and the change↔transaction audit holds
  unchanged.

### Key Entities

- **Geometry record**: a node's current drawn bounds within the preview, plus the version of
  observation that produced it; addressable by node id; absent when the node is not rendered.
- **Chrome layer**: the visual stratum above the preview where outlines and tools draw; independent
  of document content; positioned from geometry records.
- **Canvas tool**: an extension-contributed read-only chrome unit with an activation trigger
  (selection/hover/always), an imperative mount receiving target identity + geometry, and a
  mandatory cleanup.
- **Workbench selection**: the kernel's existing selection state — the single source the selection
  chrome renders from.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Hover, select, clear, and pointer sweep interactions produce exactly 0 document
  content view updates (mechanically counted), on both the landing fixture and the 1,000-node stress
  document.
- **SC-002**: With zero pointer interaction, programmatic layout changes (block growth, scroll,
  viewport resize, direction flip) bring chrome to the correct new position, and instrumentation
  attributes 100% of geometry updates to observation events (0 polling, 0 per-interaction
  measurement).
- **SC-003**: Selection chrome tracks document changes in 100% of automated scenarios (undo removing
  the node clears it; move/resize repositions it).
- **SC-004**: Keyboard-only traversal reaches every sibling and every populated slot child of the
  fixture document and clears with Escape, with accessible names exposed at every step.
- **SC-005**: A runtime-registered canvas tool appears on its activation and disappears on disposal
  in 100% of test runs, with every mount's cleanup verified to have run.
- **SC-006**: 100% of new UI components pass the mechanical component-contract validation and the
  catalog accessibility gate at error level.
- **SC-007**: The complete acceptance suites for Stories 1–4 pass in the workspace's standard
  verification pipeline.

## Assumptions

- The kernel's existing selection state (single or empty selection focus in this milestone's chrome;
  the state itself may hold multiple ids — chrome renders the first) is sufficient; no new document
  or kernel state is introduced.
- Block display names come from the registered block schema's existing description/type metadata; no
  new naming field is required.
- Hover state is ephemeral canvas-local state; it never enters the kernel.
- The preview boundary and its style/token injection from B1 are reused as-is; this feature adds
  cooperation for geometry discovery, not a new preview.
- The reference documents' full editing shell (top bar, panels, styling system decisions) is
  intentionally deferred; only the read-only canvas portion of the shell tier ships now, and the
  next milestone (drag) builds on it.
- Single-pointer interaction is assumed (no multi-touch gestures in this milestone).
- The playground remains the demonstration host (zero backend, zero network).
