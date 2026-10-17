# Feature Specification: Builder B3b Rich Text

**Feature Branch**: `008-builder-b3b-rich-text`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Builder B3b: rich-text leaf props. A block property can be declared
'rich text' and every layer treats it correctly: the generated inspector edits it through a real
rich-text editor (bold, italic, headings, lists, links) with one transaction per commit and document
truth; the canvas, preview, and static output render the SAME stored JSON through a zero-dependency
renderer with a safe whitelisted subset; the editing engine is the workspace's FIRST third-party
editing dependency and stays contained to one extension package, lazily loaded only when a rich
property is actually edited. The dependency decision itself is a first-class deliverable:
registry-verified pins, transitive inventory, and no-downgrade proof."

## Clarifications

- **The editing engine is TipTap (decided pre-feature, recorded in the B3a handoff)**: the milestone
  exists to adopt it as an isolated, auditable dependency decision — the pins, their registry
  verification, and the containment boundary are deliverables, not details.
- **Editing lives in the INSPECTOR through the existing field-type contribution point** (the road
  B3a built): a marked schema resolves to the rich editor exactly like any contributed field —
  priority match, lazy load, containment, focus lock. Inline-on-canvas editing is a future
  milestone; nothing here blocks it.
- **Rendering is in-repo and dependency-free**: the stored JSON is rendered by a small whitelisted
  renderer (paragraph, heading levels 2–4, bold/italic, links, bullet/ordered lists, hard breaks).
  The published path never loads the editing engine.
- **Stored form is plain JSON** (Law J holds): the document persists the editor's JSON document
  shape, structurally validated at the command door against the whitelist — an unknown node or mark
  type is rejected on WRITE and degraded gracefully on READ (documents from older/newer versions
  must render, not crash).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit rich text in the generated inspector (Priority: P1)

An editor selects a block whose schema declares a rich-text property. The inspector shows a rich
editor with the current content and a small formatting toolbar (bold, italic, heading levels,
bullet/ordered list, link). Formatting and typing update the document — one transaction per commit —
and the canvas reflects the change live. Undo restores prior content in both the editor and the
canvas.

**Why this priority**: the milestone's reason to exist; also the first real-world heavyweight
consumer of the B3a field-type road.

**Independent Test**: mount inspector + canvas over a kernel with a rich-text block; assert the rich
editor appears for the marked prop (not the readonly fallback); apply bold + a heading + a list
item; assert one transaction per commit, canvas text/markup updates, and undo/redo lockstep.

**Acceptance Scenarios**:

1. **Given** a selected block with a rich-text property, **When** the inspector renders, **Then**
   the property shows a rich editor seeded with the stored content — with zero panel code in the
   block's folder.
2. **Given** text is typed or formatting applied (bold, heading, list, link), **Then** each commit
   dispatches exactly one transaction and the canvas shows the change live.
3. **Given** undo after rich edits, **Then** the editor shows the restored content (document truth —
   the editor holds no authoritative copy) and the canvas matches.
4. **Given** a document write that violates the whitelist (unknown node type), **Then** the door
   rejects it with zero document change and a control-adjacent reason.
5. **Given** the extension contributing the editor is disposed at runtime, **Then** the property
   falls back to the accessible read-only display without reload.

---

### User Story 2 - Faithful, safe rendering everywhere (Priority: P2)

A visitor (preview, published output) and the editor (canvas) see the SAME stored rich text:
paragraphs, headings, bold/italic, lists, links — themed by tokens, correct under RTL. A link with
an unsafe protocol never becomes clickable; content containing node or mark types outside the
whitelist renders its readable text rather than crashing.

**Why this priority**: rendering is the half that ships to visitors; it must not depend on the
editing engine and must be safe against hostile stored content.

**Independent Test**: render a fixture JSON through the canvas path and the static-output path;
assert structural HTML (headings, lists, links), identical text content on both paths,
`javascript:`/`data:` hrefs neutralized, and unknown node/mark types degraded to plain text.

**Acceptance Scenarios**:

1. **Given** stored rich text with the full whitelist, **Then** the canvas and the static output
   render the same visible text and semantic structure (real heading/list/link elements).
2. **Given** a link whose href uses a non-http(s)/mailto protocol, **Then** the rendered link is
   neutralized (no navigable href) while its text remains visible.
3. **Given** stored content containing an unknown node or mark type, **Then** rendering degrades to
   the readable text of known children — never a crash, never raw JSON.
4. **Given** RTL content direction, **Then** rendered rich text and the editor both lay out
   correctly.

---

### User Story 3 - The dependency stays contained (Priority: P3)

The workspace adopts its first third-party editing dependency without letting it leak: only one
extension package may import it (mechanically enforced), the editor code loads lazily only when a
rich property is actually edited, and the published/static path contains none of it. The decision
itself is recorded with registry-verified pins.

**Why this priority**: the reason B3b was split from B3a — the first editing dependency must be an
isolated, auditable step.

**Independent Test**: execute the boundary negative (a non-extension package importing the engine
fails the workspace gate); assert the field-type loader is not invoked until a rich-text property is
present and edited; assert the renderer package has no engine imports.

**Acceptance Scenarios**:

1. **Given** any builder package other than the rich-text extension declaring the engine as a
   dependency, **Then** the workspace boundary gate fails with a named violation.
2. **Given** an editing session with NO rich-text property selected, **Then** the engine module is
   never loaded (the contribution's loader is not invoked).
3. **Given** the dependency decision record, **Then** it names exact pins, publish dates satisfying
   the release-age policy, the transitive package inventory, and the no-downgrade proof against the
   lockfile.

---

### Edge Cases

- An EMPTY rich-text value: the editor shows an empty paragraph; rendering emits nothing visible;
  committing empty content stores the canonical empty document (not null).
- Two rich-text properties on one block: independent editors, independent commits.
- The rich editor is focused while a better-matching field type registers: the B3a focus lock holds
  (no swap mid-typing).
- Rapid typing: transactions equal commits; history typing-merge applies as it does for plain text.
- A rich-text property under a responsive override bucket: out of scope for value editing (rich
  props edit the BASE in B3b); the inspector must say so rather than silently writing overrides.
  (Responsive rich text is deferred — recorded.)
- Link with an empty href: stored as text without a navigable link.
- Very large content: the door validates structure, not size; size budgeting is deferred to the
  persistence milestone (recorded).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Declaration): ONE schema helper marks a property as rich text; the stored form is
  plain JSON (Law J) and is structurally validated at the command door against the whitelist
  (paragraph, heading 2–4, text with bold/italic/link marks, bullet/ordered lists, list items, hard
  breaks). Unknown node/mark types are rejected on write.
- **FR-002** (Resolution): marked properties resolve to the rich editor through the EXISTING
  field-type contribution point — registration-order/priority laws, lazy load, per-property failure
  containment, and the R8 focus lock all apply unchanged.
- **FR-003** (One transaction per commit): every editor commit dispatches exactly one `setProp`; the
  editor renders from document truth (undo/redo/external writes show through) and holds no
  authoritative copy.
- **FR-004** (Zero-dependency rendering): the renderer converts stored rich text to output with NO
  editing-engine code: whitelist subset, token theming, logical properties, unsafe href
  neutralization, unknown-type graceful degradation.
- **FR-005** (Containment): only the rich-text extension package may depend on the editing engine —
  enforced by the workspace boundary gate with an executed negative; the editor module loads lazily
  via the contribution's loader; disposal restores the fallback.
- **FR-006** (Adoption): at least one shipped block declares a rich-text property and renders it
  through the zero-dependency renderer — with zero panel code.
- **FR-007** (A11y): the editor is reachable and labeled through the B3a structural group labeling;
  toolbar controls are real labeled buttons; commits/rejections announce through the existing
  inspector channel.
- **FR-008** (RTL): editor and rendered output are correct under RTL content (logical properties;
  direction inherited from the document).
- **FR-009** (Parity): the same stored JSON produces the same visible text and semantic structure on
  the canvas path and the static-output path.
- **FR-010** (Component contract): every new UI component ships the complete mechanical contract and
  passes the catalog a11y gate.
- **FR-011** (Dependency decision): the adopted pins are registry-verified (exact versions, publish
  dates ≥ the release-age policy), the full transitive inventory is recorded, the no-downgrade check
  is proven against the lockfile, and the trust policy is unchanged.
- **FR-012** (Kernel laws preserved): the Law-S audit holds with the rich editor mounted; the
  zero-content-re-render law is untouched (an inspector rich edit re-renders only the edited node's
  view).

### Key Entities

- **Rich-text document**: the stored JSON shape — a `doc` containing whitelisted block nodes; inline
  text carries whitelisted marks. Canonical empty form exists.
- **Rich-text schema marker**: the declaration a block uses; carries the machine-readable marker
  field resolution matches on.
- **Rich-text field**: the contributed editor component (extension package, lazy).
- **Rich-text renderer**: the zero-dependency read path (renderer package).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across a scripted rich editing session (type, bold, heading, list, link, undo, redo),
  transactions equal commits exactly and editor/canvas stay in lockstep at every step.
- **SC-002**: The boundary negative fails the workspace gate for an out-of-package engine
  dependency, and the renderer/static path contains zero engine imports (import-graph verified).
- **SC-003**: The engine loader is invoked 0 times in sessions without rich-text editing and exactly
  once (cached thereafter) when a rich property is edited.
- **SC-004**: 100% of unsafe hrefs in a table-driven sweep (`javascript:`, `data:`, `vbscript:`,
  protocol-relative tricks) are neutralized in rendered output.
- **SC-005**: For the fixture document, canvas text content equals static-output text content, and
  the structural elements (headings, lists, links) are present on both paths.
- **SC-006**: All new UI components pass the mechanical contract and the catalog a11y gate at error
  level.
- **SC-007**: The complete acceptance suites for Stories 1–3 pass in the workspace verification
  pipeline.

## Assumptions

- The B3a inspector/field-type machinery is sufficient as-is (no changes to resolution, locking, or
  containment laws — the rich field is a consumer).
- The whitelist subset above covers B3b; tables, images, and embeds are future milestones.
- Rich-text properties edit the BASE bucket only in B3b (responsive rich text deferred).
- The playground remains the demonstration host.
