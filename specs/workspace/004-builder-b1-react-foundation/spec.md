# Feature Specification: Builder B1 View Foundation

**Feature Branch**: `004-builder-b1-react-foundation`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Make the B0 kernel visible and provable in a browser: view-layer
bindings for the kernel, a pure static renderer and a live per-node renderer with breakpoint
resolution and design-token theming, a thin preset that becomes the only entrypoint applications may
use, the first real content-block extension (five marketing blocks, each a complete component
contract), and an isolated playground application with fixture documents, a theme switcher, a
direction flip, and a runtime extension-registration demo — zero backend, zero network."

## Clarifications

### Session 2026-08-25

- Q: How is the isolated preview frame obtained — vendored from the reference third-party editor or
  built in-repo? → A: Built in-repo as a small, focused isolation frame (style + direction
  containment). The reference plan's full third-party vendor pass is deferred to the canvas-editing
  milestone where its drag/zone machinery is actually consumed; this keeps B1's vendored surface at
  zero. Recorded as a deliberate deviation from the non-normative reference docs.
- Q: Which five blocks ship first? → A: hero, features, pricing, testimonials, call-to-action (the
  most demonstrable landing-page set; navbar/footer/faq follow with the canvas milestone).
- Q: How is the block component contract enforced? → A: Mechanically. Block components live where
  the workspace component validator scans, so implementation/story/docs/test/export presence is
  CI-fatal, not conventional; if the validator's allowed-file set needs the block-specific data
  files (schema/examples) added, that extension is additive and tested in the same feature.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Embed the builder and see the document rendered live (Priority: P1)

An application developer mounts the builder through its single public entrypoint, hands it a
document and a set of registered content blocks, and sees the document rendered on screen. When a
document value changes through the kernel's command door, exactly the affected part of the screen
updates — the rest of the rendered tree is untouched.

**Why this priority**: This is the bridge from the proven headless kernel to anything visible; every
later milestone (canvas editing, inspector, AI review) renders through this layer. Nothing else in
B1 is testable on screen without it.

**Independent Test**: Mount the entrypoint with a fixture document and fixture blocks in a
browser-equivalent test environment; assert the rendered output mirrors the document tree, then
dispatch one property change and count exactly one re-rendered block view.

**Acceptance Scenarios**:

1. **Given** a landing fixture document and registered blocks, **When** the builder is mounted,
   **Then** every document node appears once, in document slot order, with its property values
   visible.
2. **Given** the mounted builder, **When** one text property changes via a command, **Then** exactly
   one block view re-renders and the change is visible.
3. **Given** the mounted builder, **When** undo is invoked, **Then** the previous value is visible
   again without remounting.
4. **Given** components inside the builder tree, **When** they read the current selection or
   dispatch a command, **Then** the read is live and the dispatch flows through the kernel's single
   door with an attributed record.
5. **Given** an application, **When** it tries to depend on any builder internals deeper than the
   public entrypoint, **Then** the workspace boundary check fails the build.

---

### User Story 2 - A real content-block library ships complete (Priority: P2)

A content author's vocabulary arrives: five marketing blocks — hero, features, pricing,
testimonials, and call-to-action — registered as one extension. Each block is a complete component:
implementation, catalog story with representative states, usage documentation, and a
behavior-focused test. Blocks render entirely from document data (properties and slots) and expose
meaningful structure (headings, lists, landmarks) for assistive technology.

**Why this priority**: The kernel's contract is only proven when a REAL extension — not a fixture —
registers blocks that render; this is also the first consumer of the new extensions grouping in the
workspace.

**Independent Test**: Register the extension in a test kernel; assert each block type is
discoverable, renders its example documents, honours its declared slots, and passes its behavior
tests; the workspace component validator counts a complete artifact set for every block.

**Acceptance Scenarios**:

1. **Given** the extension is registered, **When** the catalog is queried, **Then** all five block
   types are present with model-facing descriptions and examples.
2. **Given** a document using all five blocks, **When** it renders, **Then** each block displays its
   property values and slot children in order.
3. **Given** any block, **When** its artifact set is validated, **Then** implementation, local
   export, story, documentation, and test are all present.
4. **Given** a block with declared slot rules, **When** a document violates them, **Then**
   validation reports the violation (kernel rules from the previous milestone still hold through the
   view layer).

---

### User Story 3 - Publish-grade static rendering with breakpoint resolution (Priority: P3)

A publishing pipeline renders a document without any live wiring: a pure document-in, markup-out
transformation. The same document rendered live and rendered statically shows the same content.
Per-breakpoint property overrides resolve against the requested breakpoint (base values cascade
unless overridden).

**Why this priority**: Static output is the seed of the future publish/diff pipeline and the
reference for round-trip laws in later milestones; it must exist before the code-view and AI
milestones compare against it.

**Independent Test**: Render fixture documents statically for each breakpoint and compare content
equality against the live render and against expected snapshots of resolved values.

**Acceptance Scenarios**:

1. **Given** a fixture document, **When** rendered statically twice, **Then** the outputs are
   identical (purity).
2. **Given** a document with tablet/mobile overrides, **When** rendered for each breakpoint,
   **Then** overridden values replace base values only for that breakpoint.
3. **Given** the same document, **When** rendered live and statically, **Then** the visible content
   matches.

---

### User Story 4 - The playground proves it end-to-end, in isolation (Priority: P4)

A developer starts the playground application and, with zero backend and zero network, loads fixture
documents, sees them rendered inside an isolated preview frame, switches the design theme and
watches the canvas recolor immediately, flips the content direction between left-to-right and
right-to-left, and registers an additional extension at runtime whose block becomes usable without
reloading.

**Why this priority**: The playground is the product-direction safety net from the reference plan —
nothing touches real applications before graduating here — but it composes everything from Stories
1–3, so it lands last.

**Independent Test**: Drive the playground's own behavior tests: fixture loads, theme switch
recolors a sampled token-driven style, direction flip updates the preview root, runtime registration
makes a new block type render.

**Acceptance Scenarios**:

1. **Given** the playground, **When** it starts, **Then** the landing fixture is visible inside the
   preview frame with theme values applied, with no network activity.
2. **Given** the playground, **When** the theme is switched, **Then** token-driven colors change
   immediately without reload.
3. **Given** the playground, **When** the direction flip is toggled, **Then** the preview root
   direction changes and layout follows, without mutating the document.
4. **Given** the playground, **When** the demo extension is registered at runtime, **Then** its
   block renders in a document without reload.

---

### Edge Cases

- A document node whose type has no registered renderer shows an explicit inline fallback marker
  (type name included) and never crashes the tree.
- A block with missing optional properties renders with its declared defaults.
- Empty declared slots render nothing (no placeholder rows in published output).
- Disposing an extension whose blocks are on screen downgrades those nodes to the fallback marker on
  the next render.
- A breakpoint with no overrides renders identical to base.
- Right-to-left direction flips layout order without changing document data.
- The live renderer subscribes per node: unrelated kernel-state changes (selection, persistence
  position) cause zero block re-renders.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001 (Single mount point)**: The builder MUST be embeddable through one public entrypoint that
  wires a kernel instance into the view tree; applications MUST NOT need (and MUST NOT be able) to
  reach deeper builder internals — enforced by the existing workspace boundary law.
- **FR-002 (Live document views)**: The view layer MUST render every document node through its
  registered block renderer, in slot order, with validated property values.
- **FR-003 (Scoped re-rendering)**: A change to one node's values MUST re-render exactly that node's
  view; sibling and ancestor block views MUST NOT re-render (count-verified on the stress fixture).
- **FR-004 (Kernel access from views)**: Components inside the builder tree MUST be able to read
  live state (document, selection, catalogs) and dispatch commands through the kernel's single door,
  preserving author attribution.
- **FR-005 (Slot composition)**: A block's declared slots MUST render their children in document
  order, and slot content MUST be composable by the block's own layout.
- **FR-006 (Static rendering purity)**: A static render MUST be a pure function of (document,
  breakpoint, registered blocks): no subscriptions, no kernel required, identical output for
  identical input.
- **FR-007 (Breakpoint resolution)**: Rendering MUST resolve per-breakpoint property overrides as
  base-plus-override for the requested breakpoint only; unknown breakpoints are rejected.
- **FR-008 (Design-token theming)**: All block styling MUST consume named design tokens; a theme is
  a set of token values injected at the preview root, and switching themes MUST recolor rendered
  content without reload.
- **FR-009 (Direction awareness)**: The preview root MUST carry the document's content direction,
  and block layout MUST follow it using direction-agnostic styling (no left/right-specific rules).
- **FR-010 (Unknown-type resilience)**: Unregistered node types MUST render an explicit fallback
  marker naming the type, and MUST NOT break surrounding content.
- **FR-011 (Marketing block set)**: Exactly five blocks ship in the first extension — hero,
  features, pricing, testimonials, call-to-action — each with model-facing description, example
  documents, declared slots where applicable, and intent-only property vocabularies.
- **FR-012 (Complete component contract)**: Every block (and every other new UI component in this
  feature) MUST ship implementation, local export, catalog story with representative states, usage
  documentation, and a behavior-focused test — validated mechanically where the workspace validator
  applies.
- **FR-013 (Runtime registration)**: Registering a trusted extension at runtime MUST make its blocks
  render in documents without reload; disposal MUST downgrade its rendered nodes to the fallback
  marker.
- **FR-014 (Playground isolation)**: The playground application MUST run with zero backend and zero
  network: fixture documents, deterministic identity/time sources, and in-memory persistence only,
  and MUST import the builder only through the public entrypoint.
- **FR-015 (Catalog coverage)**: The shared component catalog MUST include every new block and every
  new shared view component with their representative states.
- **FR-016 (Accessibility baseline)**: Blocks MUST expose semantic structure —
  landmarks/headings/lists as appropriate — and interactive elements MUST be reachable and labelled;
  the catalog's accessibility checks MUST pass for every block story.
- **FR-017 (Kernel laws preserved)**: All prior kernel guarantees (single door, validation,
  undo/redo, determinism) MUST remain observable through the view layer — the view never opens a
  second mutation path.
- **FR-018 (Preview containment)**: Document content MUST render inside an isolated preview boundary
  so application styling and document styling cannot leak into each other.

### Key Entities

- **View binding**: The wiring that connects one kernel instance to a rendered tree (provider +
  read/dispatch access points).
- **Block renderer**: The visual half of a registered block; receives validated properties, resolved
  slot content, and context flags.
- **Live render tree**: Per-node-subscribed views over the document.
- **Static render**: Pure (document, breakpoint) → markup transformation.
- **Design token / theme**: Named visual values; a theme is a complete token assignment injected at
  the preview root.
- **Preview frame**: The isolated boundary the document renders into (style containment + direction
  root).
- **Marketing block set**: hero, features, pricing, testimonials, call-to-action.
- **Playground**: The isolated proving-ground application composed from fixtures and the public
  entrypoint.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The landing fixture renders with 100% of its nodes represented in document order,
  verified by automated tests.
- **SC-002**: A single property change re-renders exactly 1 block view on the 1,000-node stress
  fixture (render-count instrumentation), and unrelated kernel state changes re-render 0.
- **SC-003**: Static and live renders of the fixture documents match in content in 100% of automated
  comparisons; static rendering is bit-identical across repeated runs.
- **SC-004**: Theme switching updates sampled token-driven styles in under 1 second with zero
  reloads, verified by an automated interaction test.
- **SC-005**: A runtime-registered block type renders successfully in 100% of test runs without
  reload; after disposal, 100% of its nodes show the fallback marker.
- **SC-006**: 5 of 5 blocks pass the mechanical component-contract validation and their catalog
  stories pass automated accessibility checks.
- **SC-007**: The complete acceptance suites for Stories 1–4 pass in the workspace verification
  pipeline, and the catalog build includes the new entries.

## Assumptions

- Builds directly on the accepted 003 kernel contracts (documents, commands, registries, ports); no
  kernel behavior changes are in scope.
- Canvas EDITING interactions (selection overlays, drag-and-drop, inspector panels) are explicitly
  out of scope — they are the next milestone; this feature renders and proves, it does not edit
  visually beyond driving kernel commands from demo controls.
- Rich-text leaf rendering is out of scope (a later milestone); text properties render as plain
  content.
- The three-breakpoint model from 003 stands; no new breakpoints.
- The starter design-token vocabulary is intentionally small (surface, text, accent, muted, radius,
  spacing scale) and grows in the shell milestone.
- The new extensions grouping enters the workspace with this feature (first member), following the
  same discovery/boundary machinery accepted in 003.
- The reference documents under `specs/workspace/builder-core/` remain non-normative; where this
  feature's artifacts differ (e.g., component-contract file naming), this feature's artifacts win.
