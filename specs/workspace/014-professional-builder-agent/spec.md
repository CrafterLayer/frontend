# Feature Specification: Professional Builder and Agent

**Feature Branch**: `builder-core`

**Created**: 2026-09-09

**Status**: Approved for implementation

**Monorepo Scope**: Workspace, cross-cutting. Extends the site model, editing kernel, canvas,
code-editing surface, AI generation, local persistence, evaluation application, and preview/export
runtime. The approved 2026-10-10 increment adds Frontend dashboards and workflows; generated
application backends remain excluded.

**Input**: User description: "Build a professional website builder and agent with compact chat,
precise visual selection and insertion, complete page management, free interactive page composition,
progressive preview, durable recovery, independent export, strong context caching, and measured
model routing. Keep dashboards and generated backends for a later feature."

## User Scenarios & Testing

### User Story 1 - Create and safely edit one free-form page (Priority: P1)

A creator describes a page and receives a real, interactive first version. They can select a visible
element, change it visually or through source, undo the change, reload the editor without losing
acknowledged work, and export a page that works independently.

**Why this priority**: This vertical slice proves the central promise and the hardest boundaries
before the product expands to larger sites.

**Independent Test**: Create one interactive page, select a nested image and heading, edit each,
undo, reload, and export. The selected target, saved source, preview, and exported page must agree.

**Acceptance Scenarios**:

1. **Given** a page request, **When** the first authored portion becomes valid, **Then** it appears
   in the canvas without waiting for the complete page.
2. **Given** a nested visual element, **When** the creator selects and edits it, **Then** only that
   target changes and one undo restores it.
3. **Given** acknowledged saved work, **When** the editor reloads, **Then** the same source and
   latest valid preview are restored.
4. **Given** a valid page, **When** it is exported and opened outside the editor, **Then** its
   primary content, navigation, and configured interactions work.

---

### User Story 2 - Edit through a compact, target-aware Agent (Priority: P1)

The creator can ask questions, request a plan, or let the Agent apply a change. The Agent always
shows whether it targets the whole site, one page, a selected instance, or a shared source, and the
conversation remains usable while work runs.

**Why this priority**: A capable generator is not useful when the user cannot understand or control
where its next change will land.

**Independent Test**: Start a page edit, switch panels and pages, queue one follow-up, stop the
active work, and resume. No response may land on the currently viewed page unless it was the
captured target.

**Acceptance Scenarios**:

1. **Given** a selected element, **When** the creator asks for a change, **Then** the conversation
   displays and retains the captured target until the request settles.
2. **Given** an active run, **When** the creator writes a follow-up, **Then** one editable queued
   request is retained and revalidated before execution.
3. **Given** an active run, **When** the creator stops it, **Then** completed draft work is
   recoverable and no late result is applied.
4. **Given** a completed run, **When** its card renders, **Then** summary and undo are prominent
   while technical detail is collapsed by default.

---

### User Story 3 - Select, insert, and arrange exact elements (Priority: P1)

The creator can select the deepest editable target, navigate to its parent, select multiple targets,
edit text without accidentally dragging structure, and insert content at an exact visible position.

**Why this priority**: Selection errors make both direct editing and Agent edits unsafe.

**Independent Test**: Select words inside a nested heading, open and close its toolbar, move its
section by the drag handle, multi-select siblings, and insert between two sections while an
unrelated section is reordered.

**Acceptance Scenarios**:

1. **Given** a nested element, **When** it is selected from canvas or layers, **Then** outline,
   inspector, toolbar, breadcrumb, and Agent refer to the same target.
2. **Given** text-edit mode, **When** the creator selects words or uses a popup, **Then** no
   structural transaction occurs.
3. **Given** an insertion position, **When** surrounding content changes before completion, **Then**
   insertion follows the captured neighbors or makes no change and asks for a new position.
4. **Given** dynamic output with no item-level edit contract, **When** selected, **Then**
   unsupported local operations are unavailable and shared impact is disclosed.

---

### User Story 4 - Manage a coherent multi-page website (Priority: P2)

The creator sees the same pages in a list and visual map, can create, rename, duplicate, reorder,
make home, configure, and remove pages, and keeps navigation correct as addresses change.

**Why this priority**: A professional website builder must treat the site as one coherent artifact.

**Independent Test**: Create three linked pages, rename an address, duplicate one, make it home,
remove another, and undo every operation while list, map, current page, and exported navigation stay
consistent.

**Acceptance Scenarios**:

1. **Given** a page operation in either list or map, **When** it completes, **Then** both views and
   the current-page control reflect the same result immediately.
2. **Given** an internal link, **When** its destination address changes, **Then** navigation
   resolves to the new address without editing every source occurrence.
3. **Given** another page is made home, **When** the operation commits, **Then** exactly one home
   page remains and one undo restores the prior state.
4. **Given** the final remaining page, **When** page actions open, **Then** clearing is available
   and deletion is unavailable.

---

### User Story 5 - Recover, preview, and publish trustworthy revisions (Priority: P2)

The creator can keep an incomplete source draft, see diagnostics alongside the last valid preview,
and can publish only a result built from the selected source revision.

**Why this priority**: A fast tool that loses work or publishes a stale revision is not production
ready.

**Independent Test**: Save an invalid source edit, reload it, trigger overlapping builds, undo to a
prior revision, and attempt export. The editor must preserve source and refuse stale publication.

**Acceptance Scenarios**:

1. **Given** invalid source, **When** saving succeeds, **Then** the draft is retained with
   diagnostics and the last valid preview is labelled as older.
2. **Given** overlapping builds, **When** an older result finishes last, **Then** it cannot replace
   the newest preview.
3. **Given** an export request, **When** the artifact revision does not match the selected source,
   **Then** export is refused with an actionable reason.
4. **Given** persistent browser storage is unavailable, **When** the creator works, **Then** the UI
   states that work is session-only and offers a project download.

---

### User Story 6 - Receive fast, distinctive, measured websites (Priority: P2)

The creator receives a coherent visual direction, business-specific content, responsive behavior,
and useful interactions. The product measures first visible authored content, completion, repair,
accepted-output cost, and quality before changing its default model policy.

**Why this priority**: Model names and activity indicators do not prove product quality or value.

**Independent Test**: Run the fixed evaluation set across candidate policies, record every attempt,
and perform blind human review at phone, tablet, and desktop sizes.

**Acceptance Scenarios**:

1. **Given** a representative brief, **When** generation starts, **Then** real authored content
   appears progressively and placeholders or progress rows are not counted as preview.
2. **Given** a deterministic editor command, **When** requested directly, **Then** it completes
   without a model call.
3. **Given** a candidate routing policy, **When** evaluated, **Then** failures, repair, review,
   cache, and escalation costs are included in accepted-output cost.
4. **Given** two distinct briefs, **When** generated, **Then** their hierarchy and composition
   differ meaningfully while each remains coherent across its pages.

### Edge Cases

- The selected target is removed or its source identity changes while an Agent request is pending.
- An insertion target loses one or both captured neighbors before the result arrives.
- A shared source gains another instance after impact preview but before apply.
- The creator edits the same source while an Agent patch or build is in flight.
- Browser storage is unavailable, full, or evicts rebuildable artifacts.
- A generated page loops forever, attempts unauthorized access, imports an unavailable dependency,
  or sends a forged preview message.
- An older compile, preview, or model response finishes after a newer run or after cancellation.
- A browser-only interaction cannot be rendered in indexable output.
- A page deletion would create dangling internal links or remove the only page.
- Right-to-left content, reduced motion, long messages, and narrow editor viewports are used
  together.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST preserve existing page projects without requiring conversion.
- **FR-002**: The system MUST support new pages whose authored source can express free layout,
  reusable components, state, events, and responsive behavior.
- **FR-003**: Every page MUST remain part of one site history and save session.
- **FR-004**: The system MUST show real authored preview content as soon as a valid portion exists.
- **FR-005**: The first-preview milestone MUST exclude placeholders, skeletons, and progress-only
  UI.
- **FR-006**: The same selected target MUST drive canvas, layers, inspector, toolbar, and Agent
  actions.
- **FR-007**: A selection MUST carry page, source or document identity, revision, optional instance
  identity, and supported capabilities.
- **FR-008**: A stale selection MUST be reconciled safely or cleared; it MUST NOT redirect silently.
- **FR-009**: Text editing and popup interaction MUST NOT create structural moves.
- **FR-010**: Structural dragging MUST begin only from its dedicated handle after intentional
  motion.
- **FR-011**: The system MUST support parent navigation and multiple selection for compatible
  targets.
- **FR-012**: Unsupported operations on dynamic or third-party output MUST be visibly unavailable.
- **FR-013**: Shared-source edits MUST identify affected instances and pages before apply.
- **FR-014**: The default edit scope MUST be the selected instance when an instance contract
  supports it.
- **FR-015**: Insertion MUST capture page, owner, slot, neighbors, revision, and before/after/inside
  mode.
- **FR-016**: Invalidated insertion anchors MUST cause zero content writes.
- **FR-017**: Page list and site map MUST use the same page commands and current state.
- **FR-018**: The system MUST expose create, rename, address change, duplicate, reorder, make-home,
  settings, clear, and delete operations where valid.
- **FR-019**: Make-home MUST preserve exactly one home page in one undoable operation.
- **FR-020**: The last page MUST be clearable and MUST NOT be deletable.
- **FR-021**: Internal links created by the system MUST follow stable page identity across address
  changes.
- **FR-022**: Deleting a referenced page MUST resolve or explicitly remove affected links in the
  same action.
- **FR-023**: Duplicated pages MUST have independent private content and retain explicit shared
  references.
- **FR-024**: The Agent MUST expose Ask, Plan, and Auto behavior with a visible execution scope.
- **FR-025**: The Agent MUST preserve one editable queued request while an operation runs.
- **FR-026**: A queued request MUST be revalidated against current site state before execution.
- **FR-027**: Cancellation MUST stop all owned work and prevent late results from applying.
- **FR-028**: Completed draft units MUST be recoverable after reload without duplicate application.
- **FR-029**: The system MUST distinguish durable acknowledgement from session-only storage.
- **FR-030**: Invalid manual source MUST be saveable and recoverable with diagnostics.
- **FR-031**: Source, valid preview, and export artifact MUST each carry an explicit revision
  identity.
- **FR-032**: An artifact from an older revision MUST NOT replace or publish over a newer revision.
- **FR-033**: All source writes MUST pass through the site's transaction boundary with revision
  checks.
- **FR-034**: Disjoint concurrent changes MAY merge only after validating the merged result.
- **FR-035**: Conflicting source changes MUST require resolution and MUST NOT overwrite silently.
- **FR-036**: Generated code MUST execute without access to editor authority, credentials, or
  another project.
- **FR-037**: Preview communication MUST accept only expected source, channel, project, and revision
  identities.
- **FR-038**: Project compilation and rendering MUST be cancellable and isolated from the editor
  interface.
- **FR-039**: The system MUST restrict generated dependencies to a versioned managed catalog.
- **FR-040**: Managed components MUST remain optional building materials rather than required page
  templates.
- **FR-041**: Export MUST provide directly loadable routes, primary indexable content, styles,
  assets, metadata, and working client interactions without editor services.
- **FR-042**: The compact Agent layout MUST preserve usable conversation and canvas space at
  supported sizes.
- **FR-043**: Layout, selection, controls, and generated sites MUST support keyboard use,
  right-to-left content, reduced motion, and the defined responsive widths.
- **FR-044**: Deterministic page and element commands MUST execute without a model call.
- **FR-045**: Model routing MUST be versioned, observable, replaceable, and selected through
  evaluation.
- **FR-046**: Context assembly MUST retrieve only relevant project material and preserve reusable
  prefixes.
- **FR-047**: Usage MUST distinguish ordinary input, cached input, cache writes, output, attempts,
  and unknown data.
- **FR-048**: Cost per accepted output MUST include failed attempts, repairs, review, and
  escalation.
- **FR-049**: The Agent MUST bound concurrency, file ownership, retries, visual repairs, and
  escalation.
- **FR-050**: Generation MUST derive and consistently apply a business-specific visual direction.
- **FR-051**: Generated output MUST use available real assets or a deliberate labelled absence.
- **FR-052**: The system MUST keep English as the product's source language and support Arabic and
  RTL.
- **FR-053**: New functionality MUST be rollout-controlled and reversible without deleting
  new-format projects.
- **FR-054**: Resume MUST create a successor run with a new run identity, restore persisted
  completed units, and revalidate target and revisions. The stopped run remains terminal, completed
  units MUST NOT apply twice, interrupted units remain subject to the retry limit, and its queued
  request waits for explicit continuation. Result review MUST distinguish planned, applied, undone,
  rejected, failed, and stopped outcomes.
- **FR-055**: `SelectionTarget.revision` MUST identify the owning site transaction revision while a
  source handle revision identifies the authored project revision. Reconciliation MUST retain a
  target only while its stable identity and capability remain unambiguous. Page switching clears the
  visual selection but MUST NOT rewrite a submitted request's captured target.
- **FR-056**: Shared-source approval MUST include an impact fingerprint over affected instance and
  page identities. A changed impact set MUST yield zero patches, refresh the preview, and require a
  new acknowledgement.
- **FR-057**: A persistence quota or write failure MUST NOT advance durable acknowledgement or show
  Saved. The system MUST retain the draft in session memory, expose recovery and download actions,
  preserve the last acknowledged source, and evict rebuildable artifacts before sources or completed
  run checkpoints. Missing source caused by external storage eviction MUST be reported explicitly.
- **FR-058**: The runtime profile MUST define compiler and prerender deadlines and resource
  ceilings. A preview without valid heartbeats for five seconds MUST be classified unresponsive, its
  owned execution terminated, and Retry offered from saved source while the editor remains
  interactive.
- **FR-059**: Default editor geometry MUST use a 48px top bar, 48px rail, 320px resizable left
  panel, 288px Inspector, and 44px Agent header; the Composer expands from two to six lines. Both
  side panels remain open only while at least 640px remains for Canvas. Otherwise opening one
  replaces the other without losing drafts; phone widths use sheets. Zoom MUST NOT change the
  selected website breakpoint.
- **FR-060**: The versioned benchmark MUST contain 20 generation briefs plus their declared
  follow-up scenarios. Candidate and reference policies run identical cases in separately reported
  cold and warm conditions, recording manifest hash, code revision, hardware, provider, model
  settings, and every attempt. Three blinded raters use an anchored four-point rubric. Accepted
  output passes all functional/export gates, contains no critical defect, and reaches the visual
  threshold; unknown usage is reported and MUST NOT be treated as zero.
- **FR-061**: Release accessibility coverage MUST include light and dark editor chrome, LTR and RTL,
  reduced motion, keyboard-complete selection, text editing, menus, insertion, page operations and
  source editing, visible focus, labelled controls, correct focus return, zero critical or serious
  automated violations, and manual contrast, zoom, and focus-order review.

### Key Entities

- **Site**: The coherent, ordered collection of pages, design decisions, assets, shared content,
  history, and optional authored projects.
- **Authored project**: The versioned collection of source files and managed dependencies used by
  one or more pages.
- **Page reference**: A page's link to its authored entry and exposed inputs.
- **Selection target**: The revision-bound identity and capabilities of the currently targeted
  content.
- **Insertion anchor**: The revision-bound location for a new item relative to an owner and
  neighbors.
- **Build artifact**: Rebuildable output tied to the exact source, dependency, and runtime revision.
- **Run record**: The target, progress, checkpoints, usage, and cancellation state of Agent work.
- **Managed catalog**: The approved, versioned set of reusable components and dependencies.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The reference vertical slice completes create, select, edit, undo, reload, and export
  with zero target mismatches and zero acknowledged data loss.
- **SC-002**: At every supported editor width, measured bounding rectangles follow FR-059 with no
  overlap and at least 640px of Canvas whenever both desktop side panels are open; at 720px panel
  height the default Agent conversation occupies at least 60% of usable panel height.
- **SC-003**: All page-operation scenarios preserve exactly one home page, unique addresses, and
  zero dangling system-created internal links after each action and undo.
- **SC-004**: Stopping work at every named stage produces zero subsequent writes from that run;
  resuming creates a new run and every previously completed unit remains applied exactly once.
- **SC-005**: Reopening acknowledged local work restores the saved source and run checkpoint within
  two seconds on the reference development machine without model access.
- **SC-006**: All supported directly loaded exported routes show primary content and configured
  interactions without editor services or hydration errors.
- **SC-007**: Unauthorized preview access, forged or stale messages, cross-project reads, unmanaged
  imports, and invalid build paths succeed zero times in the release security suite.
- **SC-008**: At least 90% of the versioned manifest's follow-up edit set succeeds from one request
  with no unrelated change.
- **SC-009**: Blind human review averages at least 3.5/4 across composition, typography, spacing,
  imagery, responsiveness, and brief fidelity, with no critical functional defect accepted.
- **SC-010**: The chosen economic model policy does not reduce task success and remains within
  0.25/4 of the quality reference on the fixed evaluation set.
- **SC-011**: The first real authored preview is measured with targets of P50 at or below 10 seconds
  and P90 at or below 20 seconds; results always report sample size, provider, model, and cache
  state.
- **SC-012**: Accepted-output cost is measured against a live baseline with a target reduction of
  50%; no savings claim is made until the evaluation demonstrates it.
- **SC-013**: Chromium, Firefox, and WebKit pass FR-061 in light and dark editor chrome at
  390/768/1024/1280/1440 widths, with zero critical or serious automated accessibility violations
  and recorded manual contrast, zoom, focus-order, and focus-return evidence.
- **SC-014**: Every new interface component has implementation, public export, documented states,
  behavioral coverage, and accessibility evidence before its owning story is complete.

## Assumptions

- The current site kernel, page lens, transaction log, persistence adapters, Agent panel, and
  evaluation harness are extended rather than replaced.
- Existing projects remain readable; the new format is used only when authored pages are present.
- The managed catalog initially contains the component families already present in the repository
  and expands through a controlled catalog release process.
- A browser with persistent storage disabled may continue in a clearly labelled session-only mode.
- Live model benchmarking and three-person visual scoring require configured provider access and
  human raters; their absence does not justify synthetic success data.
- Generated authentication, generated databases, server actions, and generated business backends
  remain outside this feature.

## Approved Agent conversation and parallel-task increment — 2026-10-10

The user's follow-up authorizes improving the live `features/agent` conversation, scrolling, and
multiple workers cooperating on one build. This increment does not authorize provider calls during
verification, deployment, or rewriting existing staged features.

- CHAT-001: The conversation fills the available panel height; the composer remains reachable,
  starts at two lines, and does not waste conversation space. Long requests and auxiliary questions
  remain bounded and scrollable. Light/dark, Arabic/English, keyboard and reduced motion work.
- CHAT-002: Streaming follows only a reader already at the bottom. Scrolling upward releases the
  follow, viewport/composer resizing follows the latest only while pinned, and hiding/reopening the
  panel must not reset the reading position. Jump to latest resumes following.
- CHAT-003: A build exposes its actual independent section tasks, active writers, queued work,
  verification/application, failures and completion. Concurrent generation retains ordered
  validation/application and isolated task ownership. A single-section edit is not advertised as
  parallel work, and no fabricated worker identities or quality claims are shown.
- CHAT-004: The user can select sequential, three-worker, or six-worker build execution before a
  request; the choice is captured for that run and locked while it runs. Existing automatic legacy
  engine defaults are preserved for consumers that do not opt into this control.
- CHAT-005: Deterministic concurrency/cancellation tests and isolated real-browser scrolling and
  geometry checks prove this increment. Whole-feature release and live-generation quality remain
  open.

## Approved live telemetry and Pixi creative increment — 2026-10-11

The user authorizes continuing chat feedback and expanding PixiJS for interactive stories, murals
and small 2D games. This is not all of upstream Pixi, a multiplayer backend, unrestricted package
execution, or permission for paid model calls during verification.

- PX-001: Public operational progress reaches the conversation before completion, including
  section-attributed activity where available. Bound/deduplicate updates; never expose private
  reasoning, invent workers or promise faster single-target edits. Regress scrolling with live
  updates, full controls and short/narrow panels.
- PX-002: Actual input/output/cache usage travels from provider/server to the run and is distinct
  from context estimates. Missing counts remain unknown; cached replies are not newly billed;
  parallel attempts aggregate once. Dollar cost is unknown unless reported. Old unmeasured runs
  cannot be backfilled with estimates presented as actual usage.
- PX-003: The lazy scene kit gains scoped keyboard/virtual input, bounded fixed-step simulation and
  explicit chapter navigation. Preserve editor input isolation, reduced motion, visibility pausing,
  resizing, teardown and backwards compatibility.
- PX-004: Project AI skills activate in Arabic/English for game/story/mural requests, teach actual
  scene/add-on contracts, meaningful game state and accessible DOM controls. Unrelated landing pages
  or business-story copy must not activate game/story guidance.
- PX-005: Run game, chapter-story and mural examples through actual generated Pixi/kit assets.
  Research optional packages using official compatibility/license guidance; prefer existing physics,
  viewport, filters and sound when sufficient. Record deterministic/browser evidence and fresh
  independent review, separately from live-model quality and feature 014 release.

## Approved creative engines and creative agent increment — 2026-10-12

The user asked (2026-10-12, Arabic) to complete full PixiJS support for stories, add strong
libraries for expansion, and strengthen the Agent with a creative planner, character and asset
memory, effect, animation, story and dialogue engines, plus design and project-section organization.
This executes the deferred package roadmap's runtime slices. It is not all of upstream Pixi, a game
engine replacement, a backend, unrestricted package execution, or paid model calls during
verification.

- CE-001: Admit `@pixi/tilemap` and `inkjs` as separate lazy Studio assets in the media-engine owner
  with licence audit, exact catalog pins and measured budgets; add first-party `anim`, `fx` and
  `dialogue` assets. One Pixi namespace; nothing in editor or ordinary page bundles; preview and
  static export load them only when a region names their key literally.
- CE-002: Engines are bounded and safe for model-authored code: no eval in dialogue conditions,
  validated story graphs and saves, step/loop limits, capped particles/tweens/tiles/ink source,
  owned teardown, reduced-motion and editor behaviour, no window/document listeners.
- CE-003: Stories keep meaning in accessible DOM: speaker, live line, numbered native choice
  buttons, transcript, Arabic/English labels and whole-word Arabic reveal.
- CE-004: The Agent gains a deterministic creative planner (genre, libraries, mechanics, beats,
  setting effects, rig states, cast) delivered as a data fragment to creative scene writers only,
  and a validated, bounded character & asset memory (story bible) that learns from scenes the Agent
  wrote without executing them and is read by every build.
- CE-005: New Arabic/English skills teach the actual engine APIs with executable examples; a matched
  game/story/mural playbook brings its engine companions within writer budgets; ordinary business
  pages activate none of them.
- CE-006: The playground persists the story bible per browser, teaches it after builds and applied
  edits, sends it to runs, and shows an accessible StoryBiblePanel (component contract complete).
- CE-007: Organize the creative skills into `skills/creative/` and the creative domain into
  `src/creative/`; document the libraries, decisions and verification. AssetPack, Layout and Spine
  remain assessed-and-deferred with recorded reasons.

## Approved baseline quality repair — 2026-10-10

The user authorizes repairing the old Inspector MDX build error and ScriptParamsForm's missing
component artifacts identified in the chat verification. Scope is `builder-shell`,
`builder-custom-code` and their existing shared Storybook catalog, not unfinished Agent features.

- BQ-001: Literal Inspector header placeholders render as documentation text rather than MDX tags;
  the complete configured Storybook catalog must index and build without weakening its gates.
- BQ-002: The existing ScriptParamsForm has a local export, representative typed stories, attached
  MDX, behavior tests and its previously missing stylesheet. Its default/draft/commit/reset,
  disabled, empty, Arabic and native control behavior are verified without adding new dependencies
  or wiring an unfinished form into the product.
- BQ-003: Preserve all existing staged/unstaged work. Record fresh scoped checks and independent
  review; successful catalog/component checks do not imply full feature 014 release acceptance.

## Approved quality and Frontend increment — 2026-10-10

The user's `1+2` clarification adds interactive React websites and Frontend applications (including
dashboards and multi-step flows). This expands creative output, not filesystem authority or backend
capabilities. Existing page/file ownership, dependency locks, isolated execution and atomic undo
stay.

- QF-001: Accessibility evaluation runs real axe in Chromium, reports every blocking count before
  truncating evidence, and distinguishes automated pass, manual-review-needed and execution failure.
  It must detect an intentionally inaccessible fixture; an empty or skipped scan is not a pass.
- QF-002: Existing carousel markup gains lazy Embla swipe/snap behavior in interactive preview and
  static export. RTL, keyboard, indicators, reduced motion and disposer remain coherent. The editing
  canvas retains its native still layout and must not capture drag input or restructure React's DOM.
- QF-003: Managed React projects may import the pinned Embla module only through their dependency
  lock. Installing it alone does not make it available to existing projects.
- QF-004: Actual authored-source model requests receive project-kind-aware design and interaction
  guidance, not a mandatory marketing-page formula. Dashboard and workflow requests require real
  stateful controls, responsive/RTL layouts and honest sample data, never pretend server
  integrations.
- QF-005: Local deterministic and browser evidence is separate from paid-provider output quality,
  blind human design scores and production readiness. No global/professional certification is
  implied.
