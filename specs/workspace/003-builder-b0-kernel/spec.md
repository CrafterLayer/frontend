# Feature Specification: Builder B0 Kernel Foundation

**Feature Branch**: `003-builder-b0-kernel`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Builder B0 kernel foundation: create the headless document kernel for
the Crafterlayer page builder as two new workspace packages. The document is the single source of
truth; every mutation flows through one validated dispatch door producing transactions with inverse
patches (undo/redo); extensions contribute capabilities through typed contribution points; tier-2
(database-sourced) extensions are declarative-only and can never carry executable code; documents
use a flat node map with named slots; behavior is deterministic under injected clock/id ports. B0 is
entirely headless — no UI, no browser, no network, memory persistence only."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build and edit a page document through commands with reliable undo (Priority: P1)

A platform developer constructs a page document programmatically: inserting elements into named
slots of parent elements, changing element properties, moving and removing elements, and changing
document metadata (such as content direction). Every change is expressed as a named command through
a single entry point. The developer can undo and redo any sequence of changes and always returns to
a prior exact document state.

**Why this priority**: The command-driven document with reliable history is the kernel's reason to
exist. Every future client (canvas, code view, AI assistant) is a consumer of exactly this
capability; nothing else in the product can be built without it.

**Independent Test**: Can be fully tested by scripting command sequences against an empty document
and asserting resulting document states, undo/redo round-trips, and the recorded change history —
with no user interface involved.

**Acceptance Scenarios**:

1. **Given** an empty document, **When** a sequence of insert/change/move/remove commands is
   applied, **Then** the resulting document matches the expected structure exactly and each command
   is recorded as one change record with its author attribution.
2. **Given** any sequence of applied commands, **When** undo is invoked repeatedly to the beginning,
   **Then** the document is identical to the original starting state.
3. **Given** a sequence of undos, **When** redo is invoked the same number of times, **Then** the
   document is identical to the state before undoing.
4. **Given** a command with malformed input, **When** it is dispatched, **Then** it is rejected
   before any state change occurs, with an error that names the offending input, and the history
   remains untouched.
5. **Given** a document change made by an automated author (such as an AI assistant or a code editor
   client), **When** it is applied, **Then** it produces the same kind of change record as a
   human-authored change, distinguished only by its recorded author.

---

### User Story 2 - Extend the builder through registered extensions (Priority: P2)

An extension author packages a set of capabilities — element type definitions, named commands,
keyboard mappings, and other contribution kinds — as an extension. Registering the extension makes
its contributions available through catalog lookups. Extensions declare dependencies on other
extensions and are initialized in dependency order; removing (disposing) an extension cleanly
releases what it set up.

**Why this priority**: The contribution model is what keeps the kernel small forever and is the
delivery mechanism for every future feature; it must exist before any real feature package is
written.

**Independent Test**: Can be fully tested by registering fixture extensions and asserting catalog
contents, initialization order, lookup behavior, and clean disposal.

**Acceptance Scenarios**:

1. **Given** a fixture extension contributing element types and commands, **When** it is registered,
   **Then** its element types are discoverable in the catalog, its commands are dispatchable, and
   lookups by name return the exact contribution.
2. **Given** two extensions where one depends on the other, **When** both are registered in any
   order, **Then** initialization runs dependency-first, and a dependency cycle is reported as an
   error naming the extensions involved.
3. **Given** a registered extension, **When** it is disposed, **Then** its contributions are no
   longer discoverable and any resources it set up are released.
4. **Given** catalogs populated with many contributions, **When** a lookup by name is performed,
   **Then** the cost of the lookup does not grow with the number of registered contributions.

---

### User Story 3 - Organization content loads safely as declarative extensions (Priority: P3)

Organization-created content (saved compositions, widget definitions with skins) is stored as rows
of pure data and later loaded ("hydrated") into the same catalogs as built-in contributions.
Data-sourced content can never carry executable behavior: any stored manifest containing executable
content is rejected outright. A widget skin is accepted only when it defines all four presentation
states (loading, empty, error, success).

**Why this priority**: This is the security and marketplace foundation — user content flowing
through the extension system must be structurally incapable of code injection — but it depends on
the catalogs of Story 2 existing first.

**Independent Test**: Can be fully tested by hydrating valid declarative rows and asserting catalog
contents, and by asserting rejection of every manifest that carries executable or non-data content.

**Acceptance Scenarios**:

1. **Given** a stored declarative manifest of compositions and widget definitions, **When** it is
   hydrated, **Then** its contributions appear in the catalogs and are indistinguishable in lookup
   behavior from built-in contributions.
2. **Given** a stored manifest containing any executable content (a function value, a setup routine,
   or renderer code), **When** hydration is attempted, **Then** the manifest is rejected with an
   error identifying the offending field, and no partial registration occurs.
3. **Given** a widget skin definition missing any of the four required states, **When** validation
   runs, **Then** the skin is rejected naming the missing state(s).

---

### User Story 4 - Documents persist, reload, and replay deterministically (Priority: P4)

A document session persists its change history through a pluggable storage interface (an in-memory
implementation for this phase). Reloading a document from its latest snapshot plus the change tail
reproduces the exact document. Replaying a recorded history against the starting document reproduces
the exact final document. With deterministic identity and time sources, the same inputs always
produce the same recorded history.

**Why this priority**: Determinism and replay are the foundation for collaboration, auditability,
and versioning later — valuable, but meaningful only after Stories 1–3.

**Independent Test**: Can be fully tested by persisting sessions to the in-memory store, reloading,
replaying, and comparing documents and histories for exact equality.

**Acceptance Scenarios**:

1. **Given** a session of applied commands persisted through the storage interface, **When** the
   document is reloaded from the stored snapshot and change tail, **Then** the reloaded document is
   exactly equal to the live document.
2. **Given** a recorded change history and its starting document, **When** the history is replayed,
   **Then** the final document is exactly equal to the original final document.
3. **Given** two stores of the same document where one has advanced, **When** an append is attempted
   with a stale expected position, **Then** the append is rejected as a concurrency conflict without
   corrupting the stored history.
4. **Given** fixed identity and time sources, **When** the same command sequence runs twice,
   **Then** the two recorded histories are identical in every field.

---

### Edge Cases

- Moving an element into its own descendant is rejected (would create a cycle).
- Removing an element also removes its entire subtree; no orphaned elements remain.
- An element id appearing in two parents, two slots, or twice in one slot is rejected by validation.
- Inserting into a slot that the parent's element type does not declare is rejected.
- Inserting beyond a slot's declared capacity is rejected.
- A slot left empty after a removal is not stored as an empty list.
- Undo with an empty history and redo with no undone changes are safe no-ops.
- A document written by an older document-format version is migrated forward step by step and then
  validated; a document that cannot be migrated fails loudly and is never partially opened.
- Property values that are not plain data (executable values, missing values, non-finite numbers, or
  other non-serializable content) are rejected at the door.
- Raw pixel or color-code literals in style-bearing property values are rejected; properties carry
  intent values only.
- An unknown element type in a document is reported by validation with the offending id.
- Breakpoint-specific property overrides may change property values only; a structural change
  (membership, order, existence) expressed as an override is rejected.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001 (Single door)**: Every document mutation MUST occur through dispatching a named command
  via one entry point. No observable document state change may occur through any other path — each
  observable state change corresponds to exactly one recorded change record.
- **FR-002 (Validated door)**: Command input MUST be validated before any state change; malformed
  input is rejected with an error naming the offending field, leaving document and history
  untouched.
- **FR-003 (Change records)**: Each applied command MUST produce one change record containing: the
  command name, the author kind (human user, AI assistant, or code editor), the forward change set,
  the inverse change set, a timestamp, and a unique identifier.
- **FR-004 (History integrity)**: Undo MUST apply inverse change sets and redo MUST reapply forward
  change sets such that, for any command sequence, undoing everything restores the exact original
  document and redoing everything restores the exact final document.
- **FR-005 (Flat document with named slots)**: A document MUST consist of a format version, a
  surface kind, a content direction, a root element id, and a flat map of elements by id. Child
  membership and order MUST be expressed per named slot on the parent; every non-root element
  appears in exactly one slot of exactly one parent.
- **FR-006 (Document validation)**: Validation MUST enforce, structurally: root exists and has no
  parent; exactly-once membership; no duplicate id within a slot; no cycles; no orphans; no stored
  empty slot lists; all values plain serializable data with finite numbers. With catalogs available,
  validation MUST additionally enforce: element types exist; slot names are declared by the parent
  type; slot content-type and capacity rules hold; property values conform to the element type's
  property rules.
- **FR-007 (Data purity)**: Documents MUST contain only plain serializable data values (text,
  numbers, booleans, null, lists, maps). Executable values, missing-value markers, and non-finite
  numbers MUST be rejected at command dispatch and by validation.
- **FR-008 (Intent-only styling)**: Style-bearing property values MUST be expressed as named intent
  values; raw pixel and raw color-code literals MUST be rejected by validation.
- **FR-009 (Extension lifecycle)**: Extensions MUST register through one manager that resolves
  declared dependencies (initializing dependency-first, rejecting cycles), runs each extension's
  setup, and supports disposal that releases contributions and resources.
- **FR-010 (Contribution catalogs)**: Contributions MUST land in keyed catalogs with lookup cost
  independent of catalog size, covering at minimum: element type definitions, commands, and keyboard
  mappings, with room for further contribution kinds.
- **FR-011 (Declarative-only stored extensions)**: Stored (database-sourced) extension manifests
  MUST be pure data. A stored manifest containing any executable content MUST be rejected with an
  error identifying the offending field, and no partial registration may occur. Valid stored
  contributions MUST be indistinguishable in catalog behavior from built-in ones.
- **FR-012 (Widget completeness gate)**: A widget skin MUST define all four presentation states
  (loading, empty, error, success) to be accepted; rejection names the missing states.
- **FR-013 (Determinism)**: Identity generation and time MUST be injected capabilities. With fixed
  sources, identical command sequences MUST produce identical recorded histories and identical
  documents, run after run.
- **FR-014 (Persistence contract)**: Document storage MUST be a pluggable interface offering: load
  (returning the latest snapshot state and subsequent change records) and append (accepting change
  records at an expected position, rejecting stale positions as concurrency conflicts). An in-memory
  implementation MUST be provided; no network storage exists in this phase.
- **FR-015 (Replay)**: Replaying a stored change history against its starting document MUST
  reproduce the exact final document.
- **FR-016 (Format migration)**: Documents carrying an older format version MUST be migrated forward
  step by step to the current version and then validated before opening; failure to reach the
  current version MUST fail loudly without partially opening.
- **FR-017 (Breakpoint overrides are value-only)**: Per-breakpoint overrides MUST be limited to
  property values; structural changes expressed as overrides MUST be rejected.
- **FR-018 (Document metadata as commands)**: Changes to document metadata (such as content
  direction or surface kind) MUST be ordinary undoable commands, and their current values MUST be
  observable live by extensions.
- **FR-019 (Change notifications)**: Applied changes MUST emit notifications scoped to what changed:
  a change to one element's property notifies exactly the subscribers of that element, not the whole
  document's subscribers.
- **FR-020 (Headless verifiability)**: Every behavior above MUST be fully verifiable in an
  environment with no user interface, no browser, and no network.

### Key Entities

- **Document**: The single source of truth — format version, surface kind, content direction, root
  reference, and a flat map of elements by id.
- **Element (Node)**: One unit of page content: stable unique id, a type name referencing an element
  type definition, plain-data properties, optional data bindings, optional per-breakpoint property
  overrides, and named slots holding ordered child id lists.
- **Slot**: A named, ordered child list on an element, governed by the parent type's declaration of
  allowed content and capacity.
- **Element type definition**: The declarative description of one element kind: name, description
  written for machine consumption, applicable surfaces, property rules, slot declarations, binding
  declarations, and usage examples.
- **Extension manifest**: A named, versioned bundle of contributions. Two kinds: trusted (ships with
  the platform, may carry behavior) and stored/declarative (pure data, sourced from a database,
  never carries behavior).
- **Command**: A named, validated document operation; the only way to change a document.
- **Change record (Transaction)**: The audit unit — command name, author kind, forward and inverse
  change sets, timestamp, unique id.
- **Catalog (Registry)**: Keyed lookup structures holding registered contributions.
- **Widget definition & skin**: A widget's data contract plus one or more skins; each skin provides
  the four presentation states.
- **Storage interface (Persistence port)**: Load/append contract with concurrency positions;
  in-memory implementation in this phase.
- **Identity & time sources (Ports)**: Injected capabilities for id generation and timestamps
  enabling deterministic operation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across at least 1,000 randomized command sessions (property-based), undoing every
  change restores the exact original document in 100% of runs, and redoing restores the exact final
  document in 100% of runs.
- **SC-002**: Replaying any persisted history reproduces the exact final document in 100% of tested
  sessions.
- **SC-003**: With fixed identity/time sources, repeated runs of the same session produce identical
  histories field-for-field in 100% of runs.
- **SC-004**: 100% of invalid inputs in the negative-test suite (malformed command input; executable
  content in stored manifests; non-serializable property values; structural violations; raw
  pixel/color literals; incomplete widget skins) are rejected with addressable errors and zero
  partial state changes.
- **SC-005**: Catalog lookup time is flat as contributions grow from 10 to 1,000 entries (no
  measurable growth in lookup cost).
- **SC-006**: On a 1,000-element stress document: full structural validation completes in under 150
  ms, and a single property change notifies exactly one element subscriber.
- **SC-007**: The complete acceptance suite for Stories 1–4 runs and passes headless (no browser, no
  network) in the workspace's standard verification pipeline.

## Assumptions

- The two new workspace packages and their tooling wiring follow the reviewed builder execution plan
  and the workspace constitution; the three documents under `specs/workspace/builder-core/` are
  non-normative reference material for this feature.
- Scope is workspace-level: the change touches workspace configuration, three existing tooling
  packages, the workspace validators, and the two new packages — and nothing else.
- B0 excludes all rendering, UI, AI integration, code-view projection, and network persistence; the
  only storage implementation is in-memory. Later milestones (B1+) build on these contracts.
- The breakpoint set is fixed at three (base plus two overrides) for this phase.
- Documents reference data through named binding paths; resolving those bindings against real data
  sources is out of scope for B0 (the binding declarations and their storage shape are in scope).
- The reserved default slot name and any forbidden slot names are finalized during
  clarification/planning without changing the behavior specified here.
