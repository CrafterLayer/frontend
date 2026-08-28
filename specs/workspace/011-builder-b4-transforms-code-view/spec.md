# Feature Specification: Builder B4 — Transforms and Code View

**Feature Branch**: `builder-core`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: Builder B4 — make the document editable as CODE without ever letting
the two representations disagree; a transforms layer that projects a document to text and parses it
back, a code view panel, the round-trip law proven by property testing, heavy work off the main
thread, and the panel's implementation loaded only when opened.

## User Scenarios & Testing _(mandatory)_

An author has been building a page by pointing at it. Some things are simply faster to say in text —
renaming six headings, reordering a list, fixing a value that appears in four places. B4 gives them
a second way to say the same thing, and guarantees the two ways can never drift apart.

### User Story 1 - Read the page as text (Priority: P1)

An author opens the code view and sees the current page written out as text. Selecting a block on
the canvas scopes the text to that block. Nothing they do by looking changes the document.

**Why this priority**: Reading is the whole foundation. If the text does not faithfully describe the
document, every later story is built on a lie — and this story alone already delivers value: it is
how an author (or a reviewer) inspects exactly what a page contains.

**Independent Test**: Open the code view on a known page, confirm the text describes it completely,
select a block and confirm the text narrows to that block, then close the view and confirm the
document is byte-identical and no change was recorded.

**Acceptance Scenarios**:

1. **Given** a page with several blocks, **When** the author opens the code view, **Then** the text
   describes every block, its properties, and its structure.
2. **Given** the code view is open, **When** the author selects a single block on the canvas,
   **Then** the text narrows to that block's subtree.
3. **Given** the code view is open, **When** the author only reads and scrolls, **Then** the
   document is unchanged and the change history records nothing.
4. **Given** a page containing content that has no textual form yet, **When** it is projected,
   **Then** the text says so explicitly rather than silently omitting it.

### User Story 2 - Edit the page as text (Priority: P1)

The author edits the text. While what they have typed is not yet valid, the document is untouched
and the problem is reported next to the line that caused it. The moment it is valid, it applies as a
single change that undo reverses in one step.

**Why this priority**: This is the feature. It is P1 alongside reading because a read-only code view
would not be worth a milestone.

**Independent Test**: Type an invalid edit, confirm the document did not change and the error names
the line; complete the edit, confirm the page updates, confirm the change history grew by exactly
one entry, and confirm one undo restores the previous page exactly.

**Acceptance Scenarios**:

1. **Given** the author is typing, **When** the text is not yet valid, **Then** the document is
   unchanged and the error is reported against the line that caused it.
2. **Given** the author finishes a valid edit, **When** it is applied, **Then** the canvas shows the
   result and the change history grows by exactly one entry.
3. **Given** an applied code edit, **When** the author undoes once, **Then** the page returns
   exactly to its previous state — indistinguishable from undoing a canvas edit.
4. **Given** the author is typing rapidly, **When** several keystrokes arrive in quick succession,
   **Then** the document is not changed once per keystroke.
5. **Given** a valid edit that would produce a document the rules refuse, **When** it is applied,
   **Then** it is rejected with a reason and the document is unchanged.

### User Story 3 - The two representations can never disagree (Priority: P1)

Whatever the author built by pointing, writing it out as text and reading it back produces the same
page. Not for a few example pages — for arbitrary ones.

**Why this priority**: P1 because it is the law that makes Stories 1 and 2 safe to use. A projection
that loses information silently corrupts documents, and corruption discovered later is
unrecoverable.

**Independent Test**: Generate many random valid pages, project each to text, parse it back, and
compare with the original. Any difference fails, and the failing page is reported in full so it can
be reproduced.

**Acceptance Scenarios**:

1. **Given** any valid page, **When** it is projected to text and parsed back, **Then** the result
   equals the original page.
2. **Given** the round-trip check fails for some generated page, **When** the verification runs,
   **Then** the whole verification fails and names the page that broke it.
3. **Given** a page whose text has been edited and applied, **When** it is projected again, **Then**
   projecting the new page reproduces text that parses back to that same new page.

### User Story 4 - The canvas stays responsive, and pays nothing when unused (Priority: P2)

Typing in the code view never makes the canvas stutter, and an author who never opens the code view
carries none of its cost.

**Why this priority**: P2 because Stories 1–3 are correct without it, but the feature is unusable in
practice if it makes the rest of the editor slow, and unacceptable if it taxes people who do not use
it.

**Independent Test**: Drive a burst of typing and confirm, by counting rather than timing, that the
heavy work does not run on the path that renders the canvas; then run a session that never opens the
code view and confirm its implementation is never loaded.

**Acceptance Scenarios**:

1. **Given** the author types continuously in the code view, **When** the text is being checked,
   **Then** the work does not run on the path that renders the canvas.
2. **Given** a session that never opens the code view, **When** it ends, **Then** the code view's
   implementation was never loaded.
3. **Given** the code view is open on a very large page, **When** the author types, **Then** the
   canvas continues to respond.

### Edge Cases

- The author edits text describing a block that another change deletes underneath them.
- The author pastes an enormous amount of text at once.
- The text is valid but describes a page far larger than the current one.
- The author edits scoped text, then changes the canvas selection before it applies.
- Two edits become valid in quick succession — the second must not be lost or applied twice.
- The text is valid in form but names a block type that is not registered.
- The author opens the code view while an inline text edit is already open on the canvas.
- The document changes on the canvas while the code view is open and the author has not typed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Projection): a page can be written out as text that describes it completely; the same
  is possible for a single selected block's subtree.
- **FR-002** (Parse-back): text can be read back into a page, producing either a change to apply or
  a set of errors, never a partial application.
- **FR-003** (Round trip): projecting a page and parsing the result reproduces that page, for
  arbitrary valid pages, and this is verified as a merge-blocking check.
- **FR-004** (One change per applied edit): applying a code edit records exactly one entry in the
  change history, through the same path every other edit uses.
- **FR-005** (Errors never mutate): text that cannot be read back leaves the document untouched, and
  every error names the line responsible.
- **FR-006** (Debounced application): rapid typing does not produce one change per keystroke.
- **FR-007** (Undo parity): undo and redo of a code edit behave exactly as they do for a canvas
  edit.
- **FR-008** (Refusals surface): an edit the rules refuse is reported with its reason and changes
  nothing.
- **FR-009** (Off the rendering path): the work of projecting, parsing, and checking does not run on
  the path that renders the canvas, and this is verified by counting rather than by timing.
- **FR-010** (Pay-per-use): the code view's implementation is loaded only when it is first opened,
  verified by counting invocations.
- **FR-011** (Live scope): the text follows the current selection — whole page when nothing is
  selected, that subtree when something is.
- **FR-012** (Existing laws preserved): opening, reading, and closing the code view records no
  change; the canvas's existing behaviour and its counted guarantees are unaffected.
- **FR-013** (Component contract): every new interface element ships the project's complete
  mechanical contract, and reads correctly in both content directions.

### Key Entities

- **Projection**: a named pairing of "write this page out as text" and "read this text back",
  contributed rather than built in, so more than one textual form can exist over time.
- **Parse result**: either a change ready to apply, or a list of errors each tied to a line.
- **Code view**: the panel an author reads and edits text in, scoped to the whole page or one block.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For randomly generated valid pages, projecting and parsing back reproduces the
  original page every time; a single counter-example fails the verification and is reported in full.
- **SC-002**: An applied code edit records exactly one change-history entry, and one undo restores
  the previous page exactly.
- **SC-003**: Text that cannot be read back produces zero changes to the document, and every
  reported error names a line.
- **SC-004**: A burst of typing produces at most one applied change, counted.
- **SC-005**: With the code view open and receiving continuous typing, the number of times the
  rendering path performs the projection or parse work is zero.
- **SC-006**: In sessions that never open the code view, its implementation is loaded zero times.
- **SC-007**: All new interface elements pass the project's mechanical contract and its
  accessibility gate at error level.
- **SC-008**: The complete acceptance suites for Stories 1–4 pass in the workspace verification,
  with the round-trip check merge-blocking.

## Assumptions

- The textual form is a project decision to be fixed during planning, not by this specification. The
  only property this specification fixes is that it must be complete enough to satisfy FR-003.
- "Merge-blocking" means the workspace verification fails, consistent with how this project already
  treats counted guarantees.
- Scoping follows the existing selection model: no selection means the whole page.
- Content that has no textual form yet is represented explicitly rather than dropped; deciding which
  content that is belongs to planning.
- The round-trip verification generates pages from the registered block vocabulary, so it covers
  what authors can actually build.

## Out of Scope

- Importing external markup into pages (a later milestone).
- Any assistant or generated-change review (a later milestone).
- Widgets and database-loaded content (a later milestone).
- Visual redesign of any surface; the scheduled design milestone follows this one, and this
  specification fixes behaviour only.
- Collaborative or multi-author editing of the text.
