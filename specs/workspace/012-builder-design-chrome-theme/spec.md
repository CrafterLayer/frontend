# Feature Specification: Builder Design Milestone — Chrome and Theme

**Feature Branch**: `builder-core`

**Created**: 2026-08-28

**Status**: Implemented

**Input**: Retrospective documentation of the implemented builder design milestone: a coherent
editor chrome, prepared color and density choices, runtime brand overrides, structured navigation
and editing panels, and measurable accessibility safeguards. This specification records only
behavior present in the working tree.

## User Scenarios & Testing _(mandatory)_

The page author now works inside an editor that reads as one product rather than a collection of
debug surfaces. The editor around the page can follow the author's environment or take an explicit
appearance, while the page being edited keeps its own independent appearance.

### User Story 1 - Choose the editor appearance without changing the page (Priority: P1)

A host or author can let the editor follow the operating system, force a light or dark editor, use
comfortable or compact spacing, and change only selected brand roles during a running session. None
of those choices changes the appearance of the page being edited.

**Why this priority**: A design system is only useful if the editor can actually adopt and override
it without coupling the authoring tool to the authored page.

**Independent Test**: Exercise the system-following, explicit-light, and explicit-dark states with
both densities; change a small set of brand roles during the session; confirm unmentioned roles keep
their prepared values and the page appearance remains independently controlled.

**Acceptance Scenarios**:

1. **Given** no explicit editor appearance, **When** the operating-system preference changes,
   **Then** the editor follows that preference.
2. **Given** a dark operating-system preference, **When** the host explicitly selects the light
   editor, **Then** the editor remains light.
3. **Given** any prepared color choice, **When** the host selects comfortable or compact density,
   **Then** the editor changes its occupied space without changing its colors.
4. **Given** a prepared editor appearance, **When** the host overrides only selected brand roles,
   **Then** those roles update during the session and every unmentioned role keeps its existing
   value.
5. **Given** an editor appearance and a separately chosen page appearance, **When** either choice
   changes, **Then** the other remains unchanged.

### User Story 2 - Work inside a coherent editor shell (Priority: P1)

An author sees product identity and document actions at the top, primary destinations in a rail, the
page in the largest available area, optional working panels around it, and status information at the
bottom. Optional regions consume no space when absent.

**Why this priority**: The shell establishes the hierarchy of the entire editing experience. If it
cannot allocate space predictably, every panel competes with the page.

**Independent Test**: Render the full shell, a shell with a lower dock, and a canvas-only shell;
confirm every supplied region appears in the expected order, omitted regions have no rendered
container, the dock stays below the canvas, and narrow and right-to-left layouts preserve the page
as the primary surface.

**Acceptance Scenarios**:

1. **Given** all editor regions, **When** the shell renders, **Then** the top band, rail, panel,
   canvas, aside, and status band appear in a stable document order that establishes their reading
   order and the sequence between focusable descendants of those regions.
2. **Given** an omitted optional region, **When** the shell renders, **Then** no element or reserved
   track remains for that region.
3. **Given** a lower working surface, **When** it opens, **Then** it occupies the canvas column
   below the page rather than narrowing adjacent panels.
4. **Given** a viewport narrower than 1180 units, **When** the editor lays out, **Then** the shell's
   optional panel region, which contains the palette in the implemented composition, is hidden;
   below 900 units the aside is hidden as well.
5. **Given** a right-to-left host, **When** the shell renders, **Then** the rail and aside exchange
   inline sides; given a right-to-left edited document, horizontal tree navigation mirrors its
   expand and collapse semantics.
6. **Given** the device selector in the top band, **When** the author uses arrow keys, **Then**
   focus and selection move to the previous or next device with wraparound; Home moves to the first
   device and End moves to the last.

### User Story 3 - Find blocks, understand structure, and inspect changes (Priority: P1)

An author can search the registered block vocabulary, collapse meaningful groups, follow the page's
structure, edit the selected block through grouped fields, and see what changed most recently and
through which editing door.

**Why this priority**: Visual polish without information hierarchy still leaves authors hunting for
blocks, properties, and recent outcomes.

**Independent Test**: Filter and collapse the block palette, select the same node from the tree and
from another surface, edit and clear an inspector value, then inspect the recent-change strip. Each
surface must reflect the same document truth without inventing a second history.

**Acceptance Scenarios**:

1. **Given** a registered block vocabulary, **When** the author searches by name, type, description,
   or category, **Then** only matching block cards remain and a no-match search gives actionable
   guidance.
2. **Given** several populated block categories, **When** one category is collapsed, **Then** its
   cards are hidden while the other categories remain available.
3. **Given** a nested document, **When** the author navigates the structure with the keyboard,
   **Then** visible rows move in document order, horizontal keys expand or collapse, and activation
   selects the same node on the canvas.
4. **Given** a selection made outside the structure tree, **When** the selection changes, **Then**
   the matching row is revealed and selected, with its stable identity visible.
5. **Given** a selected block with editable properties, **When** the inspector opens, **Then** its
   fields appear in expanded, independently collapsible groups derived from the current property
   meanings.
6. **Given** the implemented Content, Design, and Advanced category row, **When** the inspector is
   read, **Then** Content is identified as current, all implemented fields remain reachable, and the
   other labels do not claim unavailable switching behavior.
7. **Given** recent changes from the canvas, code view, or assistant, **When** the status strip
   renders, **Then** the newest change is identified and each change names both its source and
   action; an empty history states that there are no recent changes.

### User Story 4 - Retain accessible, scrollable, and verifiable chrome (Priority: P1)

Keyboard and assistive-technology users can identify and operate the editor's controls, motion
preferences are respected, prepared colors maintain their contrast floors, and application framing
never makes the authored page unreachable.

**Why this priority**: These are release conditions for the design, not optional polish.

**Independent Test**: Inspect accessible names and current states, traverse the navigation and
device controls by keyboard, check the prepared contrast matrix in both appearances, enable reduced
motion, and verify the page inside the preview can still scroll when the host editor clips its own
frame.

**Acceptance Scenarios**:

1. **Given** rail items and icon-only top or status controls, **When** assistive technology reads
   them, **Then** every control has a useful name and a target at least 44 units across its
   constrained dimensions.
2. **Given** either prepared appearance, **When** the contrast matrix is evaluated, **Then** all 18
   recorded foreground/background pairings meet their assigned floor.
3. **Given** keyboard focus anywhere in the editor, **When** focus is visible, **Then** one shared
   focus treatment identifies it.
4. **Given** a reduced-motion preference, **When** editor state changes, **Then** decorative motion
   is reduced and the saving state remains understandable through visible text.
5. **Given** the host application clips its own editor frame, **When** the preview mirrors host
   styling, **Then** no global clipping or scrolling rule prevents the authored page from being
   reached.

### Edge Cases

- The host explicitly chooses light while the operating system prefers dark.
- The editor is dark while the page being edited is light, or the reverse.
- The shell receives only its required canvas and no optional regions.
- A palette search matches no registered block.
- A selected tree row is removed while focus is inside the structure tree.
- The inspector has no selection, an unknown block type, or a block with no editable properties.
- A responsive inspector value inherits the base value, is overridden, and is later cleared.
- The status strip receives no changes or more changes than the host chooses to show.
- A long authored page is rendered inside a host that clips only its own editor root.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001** (Three appearance states): the editor must support system-following, explicit light,
  and explicit dark appearances; system-following is the default.
- **FR-002** (Independent density): the editor must support comfortable and compact densities, and
  density selection must not alter the chosen colors.
- **FR-003** (Runtime overrides): a host must be able to change only named appearance roles during a
  running session, with every unmentioned role continuing to inherit its prepared value.
- **FR-004** (Chrome/content separation): changing the editor appearance must not change the
  appearance of the page being edited, and changing the page appearance must not retheme the editor.
- **FR-005** (Single shell owner): one shell must own the placement of the required canvas and the
  optional top, rail, panel, dock, aside, and status regions.
- **FR-006** (Zero-cost absence): an optional shell region that is not supplied must render no
  container and reserve no layout track.
- **FR-007** (Canvas-first adaptation): the optional panel region must be hidden below 1180 units
  and the aside below 900 units, leaving the canvas to use the released space.
- **FR-008** (Controlled navigation): the rail must render primary and optional secondary
  destinations as labelled controls, expose the current destination, and report selections to its
  host without owning the selected state.
- **FR-009** (Top-band controls): the top band must expose product identity, a controlled three-way
  device selector, caller-controlled undo and redo actions with native disabled states, preview, and
  separate publish and publish-options actions.
- **FR-010** (Searchable palette): the block palette must stay current with the registered
  vocabulary, filter across names, types, descriptions, and categories, group populated results,
  preserve independent group collapse state, and state when no result matches.
- **FR-011** (Synchronized structure): the layers view must follow document order, expose stable
  node identities, synchronize selection in both directions, reveal selected descendants, and
  support mirrored keyboard tree navigation.
- **FR-012** (Honest inspector hierarchy): the inspector must derive editable rows from the selected
  block, group them into collapsible sections, state its empty and unsupported cases, preserve
  current responsive overrides, and keep non-functional category labels non-interactive.
- **FR-013** (Recent-change provenance): the status strip must distinguish canvas, code, and
  assistant changes, identify the newest supplied change, and show zoom, device, save, and empty
  states only from caller-provided facts.
- **FR-014** (Contrast floors): each prepared appearance must evaluate the same 18 pairings; normal
  text pairings must meet 4.5:1 and large-text or non-text control pairings must meet 3:1.
- **FR-015** (Operable controls): navigation items and icon-only top/status controls must have
  useful accessible names, native keyboard behavior, and a minimum 44-unit target.
- **FR-016** (Shared focus and reduced motion): the editor must provide one visible focus treatment
  and honor a reduced-motion preference without removing semantic status text.
- **FR-017** (Frame isolation): host-application clipping must be scoped to the editor root; global
  element rules must not set overflow behavior that can be mirrored into the authored page.
- **FR-018** (Direction support): shell geometry must mirror under inherited right-to-left
  direction, and horizontal structure-tree semantics must mirror when the edited document direction
  is right-to-left.
- **FR-019** (Appearance is reachable): the editor's appearance state must be selectable from inside
  the running application, separately from the page's, and must offer a way back to following the
  machine. An appearance that can only be reached by changing an operating-system setting is not
  selectable.
- **FR-020** (Appearance actually resolves): choosing an appearance must change the values the
  editor resolves, not merely a recorded state. Evidence for this requirement must be read back from
  a rendering engine; a check on the shape of a rule is not evidence.
- **FR-021** (Host content stays in its band): supplementary controls supplied by a host must remain
  within the top band in both axes whatever their size, and must never be drawn over another
  region's controls.
- **FR-022** (Navigation moves what it names): selecting a navigation destination must change the
  panel it names. A destination that only moves a highlight is a defect, and a destination without
  content must say where that content is.
- **FR-023** (Every control is operable): every control the editor or its host draws must meet the
  minimum target size the design system defines, and controls that share a band must be
  distinguishable by their spoken names.
- **FR-024** (Regions fill their columns): a panel must take its size from the container that places
  it, and a region's cap must be expressed on the container's own track rather than as a proportion
  of the space that region was already given.

### Key Entities

- **Chrome role**: a semantic visual decision such as surface, text, accent, state, focus, or
  elevation. A prepared appearance supplies every role; a host override supplies only roles that
  change.
- **Editor appearance**: one of system-following, light, or dark, independent of the page
  appearance.
- **Density**: comfortable or compact shell measurements, independent of editor color.
- **Shell region**: one optional editor band or panel placed around the required canvas.
- **Recent change**: a caller-provided identity, source door, and short action label, ordered newest
  first.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All six combinations of three editor appearance states and two densities can be
  represented without coupling color and density.
- **SC-002**: A partial runtime override changes exactly the named roles and writes zero values for
  unmentioned roles.
- **SC-003**: A canvas-only shell renders one required region and zero containers for the six
  omitted optional region types; adding a dock keeps it inside the canvas column.
- **SC-004**: A matching palette query hides every non-matching card; an unmatched query produces
  one visible, actionable empty result; collapsing one category leaves other populated categories
  available.
- **SC-005**: Structure-tree selection works in both directions, uses one keyboard tab stop, and
  repairs focus to a valid row when the focused row disappears.
- **SC-006**: Each accepted inspector commit and each responsive clear records exactly one change; a
  rejected value records zero changes and leaves the document unchanged.
- **SC-007**: The playground projects at most the three most recent changes by default, newest
  first, and maps each known source to one of three visible provenance doors.
- **SC-008**: All 36 prepared contrast checks pass their assigned 4.5:1 or 3:1 floor; any single
  failed pairing fails the acceptance evidence.
- **SC-009**: The application frame contains zero overflow declarations in document-root,
  document-body, or universal selector blocks and keeps its clipping on one application-owned root.
- **SC-010**: Every rail item and icon-only top/status control has an accessible name and a minimum
  44-unit target; disabled history controls remain natively disabled.
- **SC-011**: With the editor set to dark, the resolved value of every appearance role equals that
  prepared appearance's own value and differs from the light one, read back from a rendering engine.
- **SC-012**: A host supplying more supplementary content than the top band can hold has all of it
  inside the band's box in both axes, and none of it intersecting the device controls.
- **SC-013**: Zero controls drawn by the editor or its harness measure below the design system's
  minimum target size, and no two controls in the same band share a spoken name.
- **SC-014**: Selecting each navigation destination changes the panel's contents; the previously
  shown panel is absent afterwards.
- **SC-015**: Each panel's rendered box equals the box of the container that places it, in both
  axes.

## Assumptions

- This is a retrospective specification of the implementation present on 2026-08-28, not approval
  for additional product work.
- The system-following appearance is represented by the absence of an explicit appearance choice.
- Comfortable density is the prepared default; compact is the alternate density.
- Content, Design, and Advanced in the inspector are presentational category labels in this
  milestone. Content is current and no tab-switching behavior is claimed.
- The host decides how appearance and density preferences are stored; persistence is not part of
  this milestone.
- Existing document commands, validation, history, and rendering remain the source of truth behind
  the redesigned surfaces.

## Out of Scope

- Redesigning the page-content theme or coupling it to editor chrome.
- Persisting editor appearance or density preferences across sessions.
- Making the inspector's Design or Advanced labels interactive.
- Adding new block types, document commands, collaboration, or backend behavior.
- Replacing the implemented responsive shell thresholds with a different adaptation model.
