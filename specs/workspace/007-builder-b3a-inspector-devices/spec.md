# Feature Specification: Builder B3a Inspector, Devices & Preview

**Feature Branch**: `007-builder-b3a-inspector-devices`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Builder B3a: make the selected block EDITABLE through a generated
inspector — every registered block gets a working properties panel derived from its own schema with
zero panel code; every edit is one kernel transaction and appears live on the canvas. Add device
switching: desktop/tablet/mobile presets plus a custom width, where ANY width maps to the correct
editing breakpoint bucket, the canvas frame takes the device width, and per-breakpoint overrides are
edited in the active bucket and render accordingly. Field renderers are extensible through the
existing field-type contribution point (runtime registration included). Add Preview mode: all
editing chrome hidden, document interactions live, Escape exits, and a direction-flip preview that
never mutates the document. Rich text (TipTap) is explicitly deferred to B3b with its own dependency
decision."

## Clarifications

- **B3 is split (the B2a/B2b precedent)**: B3a ships the inspector, default field library,
  devices/buckets, responsive editing, and Preview mode with ZERO new dependencies; B3b ships
  rich-text leaf props (TipTap) behind its own registry-verified dependency decision. The split
  keeps the first third-party editing dependency an isolated, auditable step.
- **Default field renderers are in-repo** (the R1-006/R3-005 precedent): the reference docs'
  vendored controls are replaced by a small library derived from the schema shapes this builder
  actually produces; the field-type contribution point (shipped in B0: priority `match(schema)`,
  lazy component) remains the extension road.
- **Bucket rule (declared)**: editing breakpoints follow the document model's two override buckets —
  widths < 768 edit the `mobile` bucket, 768–1023 edit `tablet`, ≥ 1024 edit the base (`desktop`). A
  custom width maps through the same thresholds; the thresholds live in ONE exported constant.
- **Preview direction flip is VIEW state**: it re-renders the preview in the opposite direction
  without dispatching `setDocMeta` — the document, history, and log stay untouched (the playground's
  existing flip control remains the document-mutating path).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit the selected block in a generated panel (Priority: P1)

An editor selects a block on the canvas and an inspector panel appears listing that block's
properties — labeled controls derived from the block's own schema (text inputs for strings, selects
for enumerations, switches for booleans, number inputs for numbers) with current values filled in.
Changing a control updates the document through one transaction and the canvas reflects it live; an
invalid value is rejected at the door and surfaced next to the control without corrupting the
document. Selecting nothing shows an empty-state hint.

**Why this priority**: property editing is the core authoring loop after arranging; the "zero panel
code per block" exit criterion is the milestone's headline.

**Independent Test**: mount inspector + canvas over a kernel; select a block; assert generated
controls match the schema (kinds, labels, current values); edit each kind and assert one transaction
per commit + live canvas text; submit an invalid value and assert rejection with zero document
change.

**Acceptance Scenarios**:

1. **Given** a selected block whose schema declares string/enum/boolean/number properties, **When**
   the inspector renders, **Then** each property appears as the matching control kind with its label
   and current value — with NO panel code in the block's own folder.
2. **Given** an edited text control, **When** the change is committed, **Then** exactly one
   transaction updates that property and the canvas shows the new value without reload.
3. **Given** a control edit the schema rejects (e.g. an over-long string), **Then** no transaction
   occurs, the document is unchanged, and the rejection reason shows at the control.
4. **Given** no selection, **Then** the inspector shows an accessible empty state.
5. **Given** undo after an inspector edit, **Then** the control shows the restored value (the
   inspector reads document truth, not its own copy).

---

### User Story 2 - Devices and responsive editing (Priority: P2)

An editor switches the canvas to tablet or mobile: the preview frame narrows to the device width and
the inspector now edits THAT breakpoint's overrides — a property edited under tablet writes a tablet
override (base value untouched), shown with an override marker and a clear-override affordance. A
custom width typed into the device bar maps to the correct bucket by the declared thresholds.
Switching back to desktop edits base values again.

**Why this priority**: responsive intent is document truth (Law R); editing it visually is what
makes the two buckets usable.

**Independent Test**: switch device; assert frame width and active bucket; edit a property under
tablet and assert a `setResponsive` transaction + override marker + canvas rendering the override at
tablet and the base at desktop; clear the override; type custom widths across both thresholds and
assert the mapped bucket.

**Acceptance Scenarios**:

1. **Given** the tablet preset, **When** it is activated, **Then** the preview frame takes the
   preset width and the inspector labels itself as editing tablet overrides.
2. **Given** a property edited under tablet, **Then** one override transaction is dispatched, the
   base value is untouched, the control shows an override marker, and the canvas at tablet shows the
   override while desktop shows the base.
3. **Given** an existing override, **When** its clear affordance is used, **Then** one transaction
   removes the override and the control returns to (and shows) the inherited base value.
4. **Given** custom widths 500, 800, and 1200, **Then** the editing bucket resolves to mobile,
   tablet, and base respectively (the declared thresholds).
5. **Given** undo/redo across responsive edits, **Then** canvas and inspector stay in lockstep at
   every step.

---

### User Story 3 - Field types are extensible, live (Priority: P3)

An extension author registers a field type at runtime — a custom control with a priority match
against schema shapes. Selecting a block whose property matches shows the custom control instead of
the default; disposing the extension restores the default, all without reload. A field component
that fails to load or throws is contained: the property falls back to the default control and the
panel keeps working.

**Why this priority**: the extension-first architecture applied to authoring UI; it also proves the
B0 field-type contribution point live.

**Independent Test**: register a runtime extension contributing a field type whose match targets
string schemas with high priority; assert the custom control renders for a string property; dispose
and assert the default returns; register a throwing field and assert containment.

**Acceptance Scenarios**:

1. **Given** a runtime-registered field type matching a property's schema with the highest priority,
   **Then** that property renders through the custom control without reload.
2. **Given** the extension is disposed, **Then** the property returns to the default control.
3. **Given** a field type whose loader rejects or whose component throws on render, **Then** the
   property falls back to the default control and the rest of the panel is unaffected.
4. **Given** two matching field types, **Then** the higher `match` score wins; ties break by
   registration order.

---

### User Story 4 - Preview mode (Priority: P4)

An editor enters Preview: every piece of editing chrome disappears (outlines, panels, device bar
affordances beyond a minimal floating exit), the document renders live and interactive, and Escape
(or the exit control) returns to editing with selection intact. A direction toggle inside Preview
shows the document in the opposite direction WITHOUT mutating it — leaving Preview always returns to
the true document state.

**Why this priority**: the "see it as a visitor" loop; also the first consumer of the
view-state-only direction concept.

**Independent Test**: enter preview; assert chrome absence + content presence; interact with a
rendered control (no editing side-effects); toggle direction and assert the frame direction changed
while the document did not; press Escape and assert edit mode returns with the prior selection and
zero new transactions from the whole round trip.

**Acceptance Scenarios**:

1. **Given** Preview is entered, **Then** no outlines, inspector, palette, or layers chrome is
   present and the document content renders fully.
2. **Given** the preview direction toggle, **Then** the preview flips direction while
   `getDocument()` stays reference-identical and the log length is unchanged.
3. **Given** Escape (or the exit control), **Then** editing chrome returns and the selection from
   before Preview is still selected.
4. **Given** the whole enter→flip→exit round trip, **Then** zero transactions were created.

---

### Edge Cases

- A block schema with no editable properties: the inspector states so (not an empty void).
- A property whose schema has no matching field type at all: a read-only fallback shows the JSON
  value rather than nothing.
- Selection removed (undo) while its panel is open: the inspector returns to the empty state (the
  kernel prunes the id — B2a law).
- Rapid consecutive edits to one control: transactions equal commits, no lost updates (the control
  commits on change, reads on document truth).
- An override equal to the base value is still an override (explicit intent survives).
- Custom width exactly at a threshold (768, 1024): buckets resolve per the declared half-open
  ranges.
- Runtime field-type registration while its target control is focused: the swap must not steal focus
  mid-typing (defer swap to the next selection or blur).
- Preview entered while a drag session is somehow pending: the session cancels first.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Generated inspector): Selecting a block MUST show a panel of controls derived from the
  block's schema — label, control kind, current value — with zero per-block panel code.
- **FR-002** (One transaction per commit): Every committed control change MUST dispatch exactly one
  `setProp` (base bucket) or `setResponsive` (override bucket) through the door; invalid values MUST
  be rejected with zero document change and a control-adjacent reason.
- **FR-003** (Document truth): Controls MUST render from the document (undo/redo/external edits
  update them); the inspector holds no authoritative copy.
- **FR-004** (Default field library): String, enum, boolean, number, and optional-of-those schemas
  MUST map to working default controls; unmatched schemas fall back to an accessible read-only
  display.
- **FR-005** (Field-type contributions): The field-type contribution point MUST be consumed: highest
  `match(schema)` score wins (ties by registration order), lazily loaded, live under runtime
  registration/disposal, with load/render failures contained to the single property.
- **FR-006** (Devices): Device presets (desktop/tablet/mobile) and a custom width MUST set the
  preview frame width; the active editing bucket derives from the width through ONE declared
  threshold constant (half-open ranges; 768 and 1024 boundaries).
- **FR-007** (Responsive editing): Under a non-base bucket the inspector MUST read/write that
  bucket's overrides (`setResponsive`), show an override marker where one exists, and offer a
  one-transaction clear returning the control to the inherited base.
- **FR-008** (Law R intact): Only property VALUES are ever bucket-dependent; structure and selection
  never are.
- **FR-009** (Preview mode): Preview MUST hide all editing chrome, keep content live, exit on Escape
  with selection intact, and offer a direction toggle that is pure view state (the document stays
  reference-identical; zero transactions for the whole round trip).
- **FR-010** (Announcements): Edit commits, rejections, bucket switches, and preview enter/exit MUST
  reach the polite announcement channels.
- **FR-011** (RTL/i18n readiness): All new chrome MUST use logical properties and behave correctly
  under RTL content and shell.
- **FR-012** (Component contract): Every new UI component ships the complete mechanical contract and
  passes the catalog a11y gate.
- **FR-013** (Kernel laws preserved): The Law-S audit holds with inspector/devices/preview mounted;
  every observable change pairs 1:1 with a transaction.
- **FR-014** (No new dependencies): B3a adds nothing to the catalog; rich text is B3b's isolated
  decision.

### Key Entities

- **Field resolution**: schema → (contributed field types by score, then default library, then
  read-only fallback) → control component.
- **Editing bucket**: 'base' | 'tablet' | 'mobile', derived from the device width through the
  declared thresholds; determines read path (props vs responsive[bucket]) and write command.
- **Device state**: preset or custom width (view state; never in the document).
- **Preview state**: on/off + direction override (view state; never in the document).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For a block schema declaring the four base kinds, 100% of properties render the
  correct control kind with the correct current value — with zero panel code in the block folder
  (verified by the mechanical component contract of the blocks package remaining unchanged).
- **SC-002**: Across scripted edit sessions, transactions equal commits exactly (base edits →
  setProp, override edits → setResponsive, clears → one removal each); invalid submissions produce
  zero transactions and a visible reason.
- **SC-003**: Custom widths across both thresholds resolve to the declared buckets in 100% of
  automated cases, the frame width follows the device state, and tablet/mobile overrides render at
  their breakpoints while desktop renders base values.
- **SC-004**: A runtime-registered field type replaces the default for its matching property without
  reload in 100% of runs; disposal restores the default; a failing field never breaks the panel.
- **SC-005**: The full Preview round trip (enter → interact → direction flip → Escape) produces zero
  transactions, keeps the document reference-identical during the flip, and restores selection on
  exit.
- **SC-006**: All new UI components pass the mechanical contract and the catalog a11y gate at error
  level.
- **SC-007**: The complete acceptance suites for Stories 1–4 pass in the workspace verification
  pipeline.

## Assumptions

- The B0 `FieldProps`/`FieldTypeDef` contracts are sufficient (priority match, lazy load, path +
  onChange); the registry gains a typed read for field types exactly as it did for canvas tools
  (additive, 003-§13 style).
- Schema introspection uses the zod definitions blocks already carry; only the four base kinds (plus
  optional/default wrappers) need first-class controls in B3a.
- The inspector is a shell component (kernel by prop, no context) composed by consumers, like
  Palette and LayersTree.
- Device width applies to the preview frame via an additive width input on the canvas; the
  1,000-node guarantees are untouched (no new hot paths).
- The playground remains the demonstration host.
