# Feature Specification: AI Full-Site Design Agent

**Feature Branch**: `builder-core`

**Created**: 2026-08-29

**Status**: Draft

**Monorepo Scope**: Workspace, cross-cutting. Touches the document/schema layer, the kernel command
layer, the text-projection layer, the AI planning layer, the block vocabulary, the rendering and
editor layers, and the playground application. Declared members:
`packages/builder/{schema,core,transforms,ai,renderer,react,editor,shell,theme}`,
`packages/builder/extensions/blocks-marketing`, and `apps/playground`. Lower layers may be extended
where the current design blocks the outcome; extension is deliberate, never incidental.

**Input**: User description: "Elevate the AI pipeline from 'generate one page from a prompt' to a
multi-step AI design agent capable of producing complete, professional, multi-page websites that
stand up against Framer AI, Webflow AI, v0, and Durable — in visual quality, structural
intelligence, and iteration speed. B4 and any lower layer may be modified or extended if the current
design cannot support this. Pipeline: Brief → Sitemap → Structure → Content → Design system →
Assembly. Structural requirements: primitive-composed and JSON-canonical, a multi-page site model,
design tokens as first-class data, iterative chat refinement that patches rather than regenerates,
AI imagery consistent with the design system, responsive by construction. Quality bar: blind
side-by-side comparison against a reference competitor, and no two generated sites may look
template-identical. Non-negotiable: every generated artifact is a valid, schema-checked,
round-trippable document — the agent gets more reasoning power and more primitives, not license to
bypass the safety and validation layer."

## User Scenarios & Testing _(mandatory)_

Today a person types one sentence and receives one change to one page. This feature changes the unit
of work from a change to a **site**: a person describes a business in ordinary language and receives
a coherent, multi-page, professionally designed website that they can then keep editing — by hand or
by continuing the conversation.

The stories below are ordered so that each one, delivered alone, still leaves a person better off
than they are now.

### User Story 1 - Describe a business, receive a whole site (Priority: P1)

A person writes a paragraph about their business — what it does, who it serves, what it wants a
visitor to do. The agent decides which pages that business needs, what each page is for, what
sections each page should carry and in what order, what each section should actually say, and what
the whole thing should look like. It then produces every page as a finished, editable document. The
person watches the work progress in stages rather than staring at a blank screen, and can stop it.

**Why this priority**: This is the feature. Everything else refines, adjusts, or proves the result
of this one journey. Delivered alone it converts the product from a block-insertion assistant into a
site generator.

**Independent Test**: Submit a one-paragraph brief for a business the block vocabulary has never
seen named. Confirm a site of more than one page is produced, that every page validates against the
document rules before anything renders, that the page set and per-page sections are defensible for
that business rather than a fixed template, and that the person saw named progress for each stage.

**Acceptance Scenarios**:

1. **Given** a one-paragraph business description, **When** the person requests a site, **Then** the
   agent produces a page set of at least a home page plus the pages that business actually needs,
   each page carrying a stated purpose and intended audience.
2. **Given** a produced page set, **When** each page is composed, **Then** its sections appear in a
   deliberate order with a stated reason for that order, and no page is a re-ordering of the same
   fixed section list used for every other business.
3. **Given** a composed page, **When** its text is read, **Then** every headline, body paragraph,
   button label, and list item refers to the described business, and no placeholder filler text
   appears anywhere.
4. **Given** a generation in progress, **When** the person watches, **Then** each stage is named as
   it starts and its result is summarized as it finishes.
5. **Given** a generation in progress, **When** the person cancels, **Then** the work stops, no
   partial site is left behind, and the workspace is exactly as it was before the request.
6. **Given** any stage produces a result the document rules reject, **When** validation runs,
   **Then** nothing is written, the failure names the stage and the reason, and the person is
   offered a retry rather than a broken site.

---

### User Story 2 - One design language across the whole site (Priority: P1)

The agent derives a design system for the project — colour roles, a type scale and font pairing, a
spacing scale, radius and shadow values — from the business, its industry, and its tone. Every page
and every section reads from that one design system. The person can adjust it in one place, or ask
for a different one, and the entire site changes together.

**Why this priority**: The difference between a generated site that looks professional and one that
looks generated is whether the design decisions are made once and applied everywhere, or improvised
per block. Without this, more pages simply means more inconsistency.

**Independent Test**: Generate a site, then change one design-system value and confirm every page
and every section changes with it. Regenerate only the design system for the same content and
confirm the pages restyle without their structure or copy changing.

**Acceptance Scenarios**:

1. **Given** a business description, **When** the design system is derived, **Then** it is stored as
   named, addressable data belonging to the project — not as values copied into individual sections.
2. **Given** a generated site, **When** any section renders, **Then** every colour, size, spacing,
   radius, and shadow it displays resolves from the project design system, and no section carries a
   hard-coded appearance value of its own.
3. **Given** a generated site, **When** the person changes one design-system value, **Then** every
   page reflects that change without any page being regenerated.
4. **Given** a generated site, **When** the person asks for a different look, **Then** only the
   design system is replaced, and page structure and copy survive unchanged.
5. **Given** any derived design system, **When** its text and background pairings are measured,
   **Then** every pairing used for body text meets the normal-text contrast minimum and every
   pairing used for large text meets the large-text minimum.
6. **Given** two different businesses, **When** both are generated, **Then** their design systems
   differ meaningfully rather than differing only in one accent value.

---

### User Story 3 - Keep talking instead of starting over (Priority: P1)

After the site exists, the person keeps typing: "make the hero darker", "add a testimonials section
after pricing", "the pricing copy is too corporate", "add a careers page". Each request changes only
what it named. Everything else — including hand edits the person made after generation — survives
untouched, and each request is one undo step.

**Why this priority**: Iteration speed is one of the three axes this feature is measured on. A tool
that can only regenerate destroys the person's own work on every request and cannot compete.

**Independent Test**: Generate a site, hand-edit a value on a page the follow-up will not name,
issue three different follow-up requests, and confirm each one changed exactly its target, left the
hand edit intact, and can be undone individually.

**Acceptance Scenarios**:

1. **Given** an existing site, **When** the person issues a follow-up request naming a section,
   **Then** only that section changes and every other node on every page is unchanged.
2. **Given** an existing site, **When** the person issues a follow-up request naming the site's
   appearance, **Then** only the design system changes and no page content changes.
3. **Given** an existing site, **When** the person asks to add a page, **Then** the new page is
   composed with the existing design system and the shared navigation gains its entry.
4. **Given** an existing site with hand edits, **When** any follow-up request is applied, **Then**
   no hand edit outside the request's target is overwritten.
5. **Given** any applied follow-up request, **When** the person undoes, **Then** the site returns to
   its state immediately before that request.
6. **Given** a follow-up request naming something that does not exist, **When** it is processed,
   **Then** the agent says so and changes nothing, rather than inventing a target.

---

### User Story 4 - Shared navigation and footer, decided once (Priority: P2)

Header and footer belong to the site, not to each page. Adding a page updates the navigation
everywhere. Editing the footer once changes it on every page. A page may still opt out.

**Why this priority**: Repeating the header on every page is what makes multi-page generation feel
like several unrelated pages instead of one website, and it multiplies the editing cost of every
later change.

**Independent Test**: Generate a multi-page site, edit the shared footer once, and confirm the
change appears on every page; add a page and confirm the navigation gains its entry without editing
any other page.

**Acceptance Scenarios**:

1. **Given** a generated multi-page site, **When** the shared header or footer is edited, **Then**
   every page that uses it reflects the edit without being individually modified.
2. **Given** a generated site, **When** a page is added or removed, **Then** the shared navigation
   gains or loses exactly that entry.
3. **Given** a page that opts out of a shared region, **When** it renders, **Then** that region is
   absent from that page only.
4. **Given** the shared navigation, **When** a page is renamed, **Then** its navigation entry and
   its address stay consistent with the rename.

---

### User Story 5 - Correct at every width, by construction (Priority: P2)

Every generated section carries deliberate behaviour for narrow, medium, and wide viewports. Nothing
generated needs a second manual pass to be usable on a phone.

**Why this priority**: A desktop-only result fails the visual-quality comparison immediately and is
the most common way generated sites are visibly worse than hand-built ones.

**Independent Test**: Generate a site and inspect every page at phone, tablet, and desktop widths.
No page may scroll horizontally, overlap its own content, or present unreadable text at any tested
width.

**Acceptance Scenarios**:

1. **Given** any generated section, **When** it is produced, **Then** it carries explicit behaviour
   for the narrow and medium widths rather than inheriting the wide layout unchanged.
2. **Given** any generated page, **When** it is viewed at the phone, tablet, and desktop widths,
   **Then** no horizontal overflow occurs and no content overlaps other content.
3. **Given** any generated page, **When** it is viewed at the phone width, **Then** multi-column
   arrangements have collapsed to a readable order that follows the section's intended emphasis.
4. **Given** a right-to-left business description, **When** the site is generated, **Then** the
   document direction and every generated layout follow it.

---

### User Story 6 - Real imagery, chosen from the project's library (Priority: P2)

The project owns a library of available images. The agent chooses from that library for hero and
section imagery — matching subject, mood, and palette to the business and the derived design system
— rather than leaving empty grey rectangles. The agent may only place images the library actually
holds; it never invents an address. The library is filled locally today and by uploads through a
host backend later, and generation does not change when that source changes.

**Why this priority**: Imagery is the single largest contributor to the perceived quality gap
against the reference competitors, and grey boxes make an otherwise strong result read as a
wireframe. Choosing from a known library also removes the whole class of failure where a generated
image address points at nothing.

**Independent Test**: Populate a library, generate a site, and confirm every image position carries
a library asset whose description ties to the business, or an explicit, deliberate, labelled absence
— never an unfilled placeholder and never an address the library does not contain.

**Acceptance Scenarios**:

1. **Given** a generated page with an image position, **When** the page is complete, **Then** that
   position holds a real library asset or a stated deliberate absence, and never an unfilled
   placeholder.
2. **Given** a populated library and a derived design system, **When** imagery is chosen, **Then**
   the choice is directed by the business description and is consistent with the design system's
   palette and mood.
3. **Given** any placed image, **When** it is placed, **Then** it carries alternative text
   describing what it shows.
4. **Given** the library is empty, unavailable, or holds nothing suitable, **When** generation
   continues, **Then** the site still completes with every other stage intact and the affected
   positions are labelled rather than silently empty.
5. **Given** a placed image, **When** the document is inspected, **Then** it references a library
   asset by its stable identity rather than embedding a copy or opaque markup.
6. **Given** any generated site, **When** its image references are checked against the library,
   **Then** every reference resolves to an asset the library holds; the count of invented addresses
   is zero.
7. **Given** the library's source is replaced with a different one, **When** a site is generated,
   **Then** selection behaviour is unchanged and no generation logic needed modification.

---

### User Story 7 - Prove it competes, and prove it is not a template (Priority: P3)

The result is measured rather than asserted: the same briefs are run through this pipeline and
through a reference competitor and scored blind, and a set of unrelated briefs is checked to confirm
the outputs are genuinely different from one another.

**Why this priority**: The brief sets a competitive bar. A bar that is never measured is a bar that
was never met. It is P3 only because it evaluates the other stories rather than delivering the
capability.

**Independent Test**: Run the recorded evaluation protocol end to end and produce its scored record;
run the distinctiveness check across unrelated briefs and produce its measured record.

**Acceptance Scenarios**:

1. **Given** a fixed set of briefs, **When** each is generated by this pipeline and by a reference
   competitor, **Then** the results are presented to raters without revealing which tool produced
   which, and scored on visual coherence, copy relevance, and structural correctness.
2. **Given** a set of briefs for unrelated industries, **When** all are generated, **Then** their
   palettes, type pairings, page sets, and section orders differ measurably from one another by a
   recorded threshold.
3. **Given** an evaluation run, **When** it completes, **Then** its briefs, outputs, raters, scores,
   and thresholds are recorded as durable evidence rather than summarized from memory.

---

### User Story 8 - Give the agent trusted skills (Priority: P1 — foundational)

A person or host application can give the agent one or more reusable skills — for example a brand
voice, an accessibility discipline, or a page-composition method. The agent can discover skill
metadata cheaply, loads the full instructions only for skills selected or deterministically matched
to the current request, shows which versions influenced the run, and remains unable to gain a
command or capability the host did not already authorize.

This story was added after the original numbering, in response to the requester's 2026-09-01
direction to strengthen the agent from the best parts of `open-builder`, `open-v0`, and
`OpenLovable`. Despite its number, it is foundational and precedes the site-generation stories.

**Why this priority**: A professional agent needs reusable expertise without turning prompt text
into authority. Skills must improve reasoning while the kernel, not the skill, remains the security
and mutation boundary.

**Independent Test**: Register several skills, select one explicitly, let another auto-match, and
run the same request twice. Confirm that only metadata for unselected skills reaches the context,
the selected bodies and their exact versions/fingerprints are recorded, resolution is deterministic,
an oversized or conflicting explicit selection fails before the provider runs, and a plan outside
the effective command policy reaches neither the scratch nor live document.

**Acceptance Scenarios**:

1. **Given** a registry of skills, **When** no skill is selected, **Then** the provider sees a small
   discoverable catalog but not every skill's full instructions.
2. **Given** explicit skill ids, **When** a run begins, **Then** their validated instruction bodies,
   dependencies, versions, and fingerprints are prepared for that run only and survive retry.
3. **Given** auto-match rules, **When** the same request and selection are resolved repeatedly,
   **Then** the same ordered skill set is produced with no ambient time or randomness.
4. **Given** two conflicting skills or an unknown dependency in an explicit selection, **When**
   resolution runs, **Then** the run fails closed before a provider call or document write.
5. **Given** a skill that restricts commands, **When** the provider proposes a command outside the
   intersection of host policy and skill policy, **Then** validation rejects it and nothing changes.
6. **Given** a cancelled or superseded run, **When** a late provider or cache result arrives,
   **Then** it cannot apply commands or emit a successful terminal event.

---

### Edge Cases

- **A brief with no business in it.** Empty input, a single word, or text that describes no business
  must produce a refusal that says what is missing, never a generic template site.
- **A brief for something the block vocabulary cannot express.** When a required section has no
  primitive that can represent it, the agent must compose the closest honest arrangement from
  existing primitives and say what it could not represent — never fabricate a section type the
  registry does not have.
- **A brief in a right-to-left language.** Direction must reach both the document and every
  generated layout, not only the text.
- **A stage fails midway.** A site is produced whole or not at all; a failure after the third stage
  must not leave three stages of a site behind.
- **The person cancels.** Cancellation must stop the work, not merely discard its answer, and must
  leave nothing partially written.
- **A very large site.** A brief implying many pages must either complete within its stated budget
  or state the limit and produce a bounded page set — never truncate silently.
- **Two runs of the same brief.** Repeatability must be defined: the same brief and the same seed
  must produce the same site, so results can be evaluated and defects reproduced.
- **A follow-up request that contradicts the design system.** "Make the hero darker" on a palette
  that would break the contrast minimum must resolve to a compliant value and say what it did.
- **A follow-up request naming a page that does not exist.** Must be refused with an explanation,
  not silently applied to the nearest page.
- **A generated site opened in the text view.** Every generated document must survive the existing
  text round trip exactly; generation must not introduce shapes the projection cannot express.
- **The design system is regenerated while a page is open.** The open page must follow the new
  system without losing selection, editing focus, or unsaved field state.
- **The asset library is empty, unavailable, or holds nothing suitable.** Generation must complete
  without imagery and label the affected positions, never stall and never invent an address.
- **A library asset disappears after a site referenced it.** The page must show a labelled missing
  asset, not a broken image, and the site must remain valid.
- **An untrusted generation result.** Any escape-hatch markup must be sanitized before it can reach
  the page, and must remain the single exception to primitive composition.
- **A skill containing prompt delimiters or instruction-looking markup.** Skill content remains a
  structured data field; it cannot close a prompt section or masquerade as platform policy.
- **A skill selected twice or supplied in a different input order.** It activates once and resolves
  to the same canonical order and fingerprinted run context.
- **An oversized selected skill set.** Explicit selection fails with a budget issue before the
  provider runs; automatically matched skills may be omitted only with an observable reason.
- **Conflicting or cyclic skill dependencies.** Resolution fails closed and names the cycle or
  conflict; it never guesses which explicit skill the person meant.
- **A cache hit after memory, catalog, or selected-skill content changed.** It is a miss. A cache
  entry is valid only for the complete assembled context and skill fingerprints.
- **A request already aborted before cache lookup.** It surfaces `AbortError`; cached work is never
  allowed to revive a cancelled run.

## Requirements _(mandatory)_

### Functional Requirements

**The site model**

- **FR-001**: The system MUST represent a website as one addressable artifact containing an ordered
  set of pages, shared regions, and one project design system — not as a collection of unrelated
  single-page documents.
- **FR-002**: Each page in a site MUST carry its own address, human title, stated purpose, and
  intended audience alongside its content.
- **FR-003**: The system MUST let a page be added, removed, renamed, or reordered within a site
  through the same validated write path used for every other change.
- **FR-004**: Shared regions (at minimum a navigation header and a footer) MUST be defined once per
  site, referenced by pages, and editable in one place; a page MUST be able to opt out of a shared
  region without affecting other pages.
- **FR-005**: The shared navigation MUST stay consistent with the site's page set: adding, removing,
  or renaming a page updates its navigation entry.
- **FR-006**: The site MUST be a first-class validated artifact owned by the same layer that owns
  documents, with its own format version and its own defined, tested upgrade path. The application
  MUST NOT assemble a site out of loose parts; a site that has not been validated is not a site.
- **FR-007**: Each page within a site MUST remain an independently valid document at the current
  page format version. A single page MUST stay renderable, projectable, and round-trippable on its
  own, and an existing bare single-page document MUST upgrade to a one-page site without loss.
- **FR-008**: Every document produced or modified by this feature MUST remain expressible in, and
  recoverable from, the existing canonical text projection with no loss. The site as a whole MUST
  additionally have a lossless text projection, composed from its pages' existing projections plus a
  projection of the site's own manifest — its page order, shared regions, and design system.

**The design system as data**

- **FR-009**: The system MUST derive, per project, a named design system containing at minimum
  colour roles, a type scale with a font pairing, a spacing scale, radius values, and shadow values.
- **FR-010**: The design system MUST belong to the site, MUST be stored as addressable project data,
  MUST be readable and writable through the same validated write path as content, and MUST NOT be
  duplicated into individual sections or into individual pages.
- **FR-011**: Every generated section MUST express appearance only by referring to design-system
  entries; a generated section MUST NOT carry a literal colour, font, or raw size value.
- **FR-012**: Changing one design-system entry MUST change every page that refers to it, with no
  page regeneration and no page-by-page edit.
- **FR-013**: The design system MUST be replaceable as a unit, leaving page structure and copy
  unchanged.
- **FR-014**: Every derived design system MUST be checked, by measurement, against the normal-text
  and large-text contrast minimums for every text-on-background pairing it authorizes, and MUST NOT
  be accepted if any authorized pairing fails.
- **FR-015**: The design system's presentation MUST remain independent of the editor's own
  appearance: changing the editor's theme MUST NOT change the generated site, and the reverse.

**The staged pipeline**

- **FR-016**: The system MUST produce a site through named, separately observable stages — page-set
  planning, per-page structural planning, copy generation, design-system derivation, and document
  assembly — rather than a single undifferentiated request.
- **FR-017**: Each stage MUST produce a checked intermediate result, and a stage MUST NOT begin
  until the stage it depends on has produced a valid one.
- **FR-018**: The page set MUST be inferred from the brief. The system MUST NOT emit a fixed page
  list regardless of input.
- **FR-019**: Each page's section plan MUST record the order chosen, the emphasis intended, and the
  reason for that order, so the choice can be reviewed rather than assumed.
- **FR-020**: Generated copy MUST refer to the described business. The system MUST reject and
  regenerate any copy consisting of generic filler.
- **FR-021**: The person MUST see each stage named as it starts and summarized as it completes.
- **FR-022**: The person MUST be able to cancel at any point; cancellation MUST stop the work and
  leave no partial site.
- **FR-023**: A stage failure MUST leave the workspace unchanged, MUST name the failing stage and
  the reason, and MUST offer a retry.
- **FR-024**: Generation MUST be repeatable: the same brief with the same seed MUST produce the same
  site, so that results can be compared and defects reproduced.
- **FR-025**: The system MUST enforce a stated bound on how much work one generation may perform and
  MUST report when a brief exceeds it, rather than truncating without saying so.
- **FR-026**: The pipeline MUST orchestrate its stages on the client against a replaceable reasoning
  boundary, so that no reasoning service is introduced into this workspace and the operator of the
  reasoning endpoint keeps ownership of credentials, cost, and rate limits.
- **FR-027**: The request and response shape of every stage MUST be published as an explicit,
  versioned contract, so a future service can implement the whole pipeline behind one endpoint
  without any change to the client that consumes it.
- **FR-028**: A deterministic, offline-capable reasoning implementation MUST remain available, so
  that every acceptance scenario in this specification can be exercised without a network or a
  model.

**Validation and safety — non-negotiable**

- **FR-029**: Every generated artifact MUST be validated against the document rules, the site rules,
  and the registered block vocabulary before anything is written or rendered.
- **FR-030**: The system MUST NOT accept a generated document or a generated site object as a write.
  All generated change MUST be expressed as commands that pass through the existing single validated
  write path, including the commands that change the site itself.
- **FR-031**: Generation MUST NOT introduce any executable-code path. Composition from registered
  primitives is the only generation mechanism.
- **FR-032**: Exactly one escape hatch for arbitrary markup MAY exist. Its content MUST be sanitized
  before it can reach the page, and its use MUST be visible in the document.
- **FR-033**: Every change written by the agent MUST be attributed to the agent, distinguishably
  from changes a person made.
- **FR-034**: A rejected or malformed generation MUST be capable of producing an error, never a
  write.

**Iterative refinement**

- **FR-035**: A follow-up request against an existing site MUST be expressed as a change to that
  site, not as a regeneration of it.
- **FR-036**: A follow-up request MUST leave every part of the site it did not name byte-identical,
  including edits the person made by hand after generation.
- **FR-037**: A follow-up request MUST be undoable as one step.
- **FR-038**: A follow-up request naming a page, section, or property that does not exist MUST be
  refused with an explanation and MUST change nothing.
- **FR-039**: A follow-up request that would violate the design system's accessibility minimums MUST
  resolve to a compliant value and report the adjustment.
- **FR-040**: Refinement MUST reuse the existing planning and application machinery rather than
  introducing a second, parallel write path.

**Responsiveness**

- **FR-041**: Every generated section MUST carry explicit behaviour for narrow and medium widths in
  addition to the wide default.
- **FR-042**: No generated page may produce horizontal overflow or overlapping content at the tested
  phone, tablet, and desktop widths.
- **FR-043**: The document's reading direction MUST follow the brief's language, and generated
  layouts MUST respect it.

**Imagery from an asset library**

- **FR-044**: The project MUST own an asset library: an addressable collection of available images,
  each with a stable identity and descriptive metadata sufficient for the agent to choose between
  them.
- **FR-045**: The agent MUST select imagery from the asset library. It MUST NOT invent, fabricate,
  or reference an asset that the library does not contain, and it MUST NOT emit an image address it
  has not been given.
- **FR-046**: Selection MUST be directed by the business description and MUST be consistent with the
  derived design system's palette and mood, using the library's metadata as the basis for that
  judgment.
- **FR-047**: Every image position in a generated page MUST hold a real library asset or a stated,
  deliberate absence; unfilled placeholders are not an acceptable result.
- **FR-048**: Every placed image MUST carry alternative text describing what it shows.
- **FR-049**: Documents MUST reference library assets by their stable identity rather than by an
  embedded copy or opaque markup.
- **FR-050**: The asset library MUST sit behind a replaceable boundary. The library is populated
  locally in this feature; a later host-supplied backend MUST be able to populate the same library —
  including from people uploading images — with no change to how generation selects from it.
- **FR-051**: When the library is empty, unavailable, or holds no suitable asset for a position,
  generation MUST still complete and MUST label the affected positions rather than leave them
  silently blank.

**The styling system**

- **FR-055**: The page's styling system MUST be a utility framework whose every design value
  resolves through the project design system rather than carrying a value of its own. A utility that
  paints a colour MUST reference a token, so re-pointing that token moves every page that uses it.
- **FR-056**: The binding between the token vocabulary and the utility framework MUST be generated
  from the vocabulary, never hand-maintained, and a checked-in generated stylesheet MUST be held
  equal to its generator by a gate that fails when they disagree.
- **FR-057**: Adding a token without deciding where it belongs in the utility framework MUST fail
  the build rather than silently producing a utility that resolves to nothing.
- **FR-058**: The agent MUST NOT author raw utility class strings into documents. It emits tokens
  and named intents; the block decides which utilities express them. A class string is opaque to
  validation, carries literal values, and would make the design system unaddressable.
- **FR-059**: The styling system MUST serve the generated pages, the block library, and the editor's
  own surfaces, while the editor's appearance stays independent of the page's (FR-015).

**Motion**

- **FR-060**: Motion MUST be declarative document data drawn from a closed vocabulary — entrance
  effects, scroll-linked effects, and named timing steps — validated at the same door as every other
  prop. An effect the vocabulary does not contain MUST be refused, never silently ignored.
- **FR-061**: Motion timing MUST be expressed as named steps, never as raw durations. A millisecond
  count is a literal in exactly the way a pixel length is, and would make motion the one part of the
  design system a theme change could not move.
- **FR-062**: Motion MUST be expressible per breakpoint, so a page may animate on a wide screen and
  stay still on a phone.
- **FR-063**: The animation engine MUST be contained: the read, publish, and static-output paths
  MUST render a document carrying motion without loading it, exactly as the rich-text engine is
  contained today.
- **FR-064**: Generated motion MUST honour a viewer's reduced-motion preference, and the absence of
  a motion value MUST mean stillness — motion is opted into, never defaulted on.

**Agent skills and bounded run control**

- **FR-065**: A skill MUST be declarative, runtime-validated, JSON-canonical data with a stable id,
  semantic version, description, instruction body, activation policy, trust/source metadata, and a
  deterministic content fingerprint. Skill scripts and executable hooks MUST NOT exist in v1.
- **FR-066**: The context MUST expose discoverable metadata for registered skills separately from
  their instruction bodies. Full instructions MUST be loaded only for skills selected explicitly,
  required as dependencies, configured as always-on, or deterministically matched to the request.
- **FR-067**: Skill activation MUST be request-local. Every run and retry MUST pin the activated
  skills' ids, versions, and fingerprints; activation from one run MUST NOT leak into another.
- **FR-068**: Resolution MUST be deterministic, order-independent, dependency-aware, conflict-aware,
  and budgeted. Unknown, conflicting, cyclic, untrusted, or over-budget explicit selections MUST
  fail before the provider is called.
- **FR-069**: A skill MUST NOT grant authority. Its command declaration may only narrow the current
  host/session policy; effective authority is the intersection of host policy, run mode, skill
  restrictions, and commands actually registered in the kernel.
- **FR-070**: Skill bodies and references MUST travel as structured content with bounded sizes and
  deterministic serialization. Prompt delimiters inside content MUST remain data and MUST NOT alter
  platform policy or surrounding prompt structure.
- **FR-071**: An agent run MUST expose typed, monotonically sequenced events with a run id and
  injected timestamp for skill resolution, context assembly, proposal, validation, application,
  failure, cancellation, and terminal completion. Exactly one terminal event is permitted.
- **FR-072**: Every run MUST enforce explicit bounds for active skills, skill/context tokens,
  commands, and repair rounds. The default validation repair budget remains one; no silent third
  provider attempt is permitted.
- **FR-073**: A validated command batch MUST apply through the grouped kernel door as one
  AI-authored history entry carrying a human label. Preflight MUST exercise the same grouped door,
  not a weaker per-command approximation.
- **FR-074**: Cancellation and run supersession MUST be checked before cached results, provider
  results, validation, and application. A stale run MUST be incapable of mutating the live kernel.
- **FR-075**: A plan cache key MUST cover the complete assembled context, conversation history, and
  activated skill fingerprints. Memory, catalog, template, block, selection, or skill changes MUST
  invalidate the entry.
- **FR-076**: Existing callers that provide no skill registry MUST retain the current command-plan
  behavior; skills are additive and do not create a second mutation path.

**Evidence and evaluation**

- **FR-052**: A recorded evaluation protocol MUST exist that generates a fixed brief set through
  this pipeline and through a reference competitor, presents results without revealing their source,
  and scores visual coherence, copy relevance, and structural correctness.
- **FR-053**: A recorded distinctiveness check MUST measure, across briefs from unrelated
  industries, that palettes, type pairings, page sets, and section orders differ by a stated
  threshold.
- **FR-054**: Evaluation results MUST be stored as durable evidence — briefs, outputs, raters,
  scores, and thresholds — not summarized in prose.

### Key Entities

- **Site**: The unit of work. Owns an ordered page set, its shared regions, its design system, its
  asset library, its format version, and its reading direction. Validated as a whole.
- **Page**: One independently valid document within a site. Owns its address, title, stated purpose,
  intended audience, its own content, and which shared regions it uses. Remains renderable and
  round-trippable on its own.
- **Shared Region**: A navigation header or footer defined once for the site and referenced by
  pages.
- **Design System**: The project's named appearance data — colour roles, type scale and font
  pairing, spacing scale, radius values, shadow values — referenced by every section and adjustable
  in one place.
- **Brief**: The person's description of the business, its audience, and its desired action.
- **Sitemap**: The stage-one result. The inferred page set with each page's purpose and audience.
- **Section Plan**: The stage-two result for one page. Its ordered sections, the emphasis intended,
  and the reason for the order.
- **Copy Set**: The stage-three result for one page. The real text for each planned section.
- **Asset Library**: The project's addressable collection of available images. The only place the
  agent may take imagery from. Populated locally now, by a host backend and by uploads later.
- **Library Asset**: One image in the library, with a stable identity, a description of its subject
  and mood sufficient to choose between assets, and its alternative text.
- **Generation Run**: One execution of the pipeline. Owns its brief, its seed, its per-stage
  results, its progress record, its bound, and its outcome.
- **Refinement Request**: One follow-up instruction against an existing site, its resolved target,
  the change it produced, and its single undo step.
- **Evaluation Record**: The durable evidence of one comparison or distinctiveness run.
- **Agent Skill**: A validated, versioned, non-executable expertise bundle. Its metadata is
  discoverable; its full content is request-local and cannot grant capabilities.
- **Skill Activation**: The pinned id, version, fingerprint, reason, dependencies, budget cost, and
  command restriction for one skill in one run.
- **Agent Run**: A bounded state machine over skill resolution, context assembly, proposal,
  validation, optional grouped application, and one terminal result, identified by a run id.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A one-paragraph business brief produces a complete site of at least four pages, with
  every page valid, in under three minutes; the person sees the first named stage begin within five
  seconds of submitting.
- **SC-002**: 100% of generated artifacts are validated before they are written or rendered. The
  count of unvalidated writes reaching the page is zero, measured rather than asserted.
- **SC-003**: Every generated document survives the canonical text round trip unchanged, proven over
  at least 1,000 generated cases with fixed seeds.
- **SC-004**: Across ten briefs from ten unrelated industries, no two produced sites share a design
  system, and at least eight of the ten pairs differ measurably in primary colour, type pairing,
  page set, and section order.
- **SC-005**: At least 95% of generated text spans contain business-specific terms drawn from the
  brief, and zero spans contain generic filler text.
- **SC-006**: In blind scoring by at least three independent raters across at least five briefs,
  this pipeline's median score is at least equal to the reference competitor's on each of visual
  coherence, copy relevance, and structural correctness.
- **SC-007**: A follow-up request changes only its named target: at least 99% of nodes outside the
  target are unchanged, and the request completes at least three times faster than regenerating the
  site.
- **SC-008**: Every generated page shows zero horizontal overflow and zero content overlaps at the
  phone, tablet, and desktop widths, measured in a real browser.
- **SC-009**: Every text-on-background pairing authorized by a generated design system meets the
  normal-text or large-text contrast minimum as computed in a real browser; the count of failing
  pairings is zero.
- **SC-010**: A failure or cancellation at any stage leaves zero partial sites: the workspace is
  either fully changed or byte-identical to its prior state.
- **SC-011**: Every generation and every follow-up request is reversible in one undo step, verified
  by comparing the restored state to the captured prior state.
- **SC-012**: Every image position in a generated site holds a real library asset or a labelled
  deliberate absence; the count of unfilled placeholders is zero and the count of image references
  that do not resolve to a library asset is zero.
- **SC-013**: The same brief with the same seed produces an identical site on repeat runs.
- **SC-014**: An existing single-page document upgrades to a one-page site and back to its rendered
  result with no loss, and every page of every generated site remains independently valid when taken
  out of its site.
- **SC-015**: Across 1,000 shuffled registry/selection inputs, skill resolution produces the same
  ordered activations and fingerprints for equal requests, selections, and policies.
- **SC-016**: Unselected skill instruction bytes reaching provider context equal zero; selected and
  auto-matched skills reach it exactly once with their recorded version and fingerprint.
- **SC-017**: 100% of commands outside the effective run/skill policy are rejected before a live
  transaction; the count of policy-bypassing writes is zero.
- **SC-018**: Every run's event sequence is monotonic, begins with `run.started`, ends in exactly
  one completed/failed/cancelled event, and emits no event or write after that terminal event.
- **SC-019**: Changing only memory, a context fragment, block/template catalog data, or one selected
  skill byte produces a plan-cache miss; a pre-aborted lookup always produces `AbortError`.

## Resolved Decisions

Three questions were open when this specification was drafted. All three were decided by the
requester on 2026-08-29 and are now binding requirements rather than assumptions.

- **The site wraps pages; it does not replace them** (FR-006, FR-007, FR-008). A site is a
  first-class validated, versioned artifact that owns an ordered set of pages, its shared regions,
  its design system, and its asset library. Each page stays an independently valid document at the
  current page format, so the existing rendering, projection, and round-trip guarantees keep holding
  unchanged for a page. The professional condition attached to this choice is that the site is owned
  and validated by the same layer that owns documents — never assembled ad hoc by the application —
  and that the site gets its own lossless text projection composed from its pages' projections plus
  its manifest, so "the whole site is round-trippable" is a proved law rather than an inherited
  hope.

- **Reasoning runs on the client now, against a replaceable endpoint** (FR-026, FR-027, FR-028). No
  reasoning service enters this workspace. Every stage's request and response shape is published as
  an explicit versioned contract so a future service can absorb the whole pipeline behind one
  endpoint without changing its client. A deterministic offline implementation stays available so
  every scenario here is testable without a network.

- **Tailwind v4 is the styling system, bound to the tokens** (FR-055 through FR-059). Added
  2026-08-29 at the requester's direction: "engine + editor + AI", and "everything that gets built
  has to be built on it so the thing is completely professional — I don't want anything random."
  Tailwind v4's `@theme inline` declares every namespace as `var(--t-…)`, so `bg-accent` compiles to
  `background-color: var(--t-accent)` — a reference, not a colour. That is what lets Tailwind serve
  the request without costing the design system its addressability. The agent still emits tokens and
  named intents and never authors a class string: `p-4` and `bg-blue-500` are literal values in
  class clothing, they would make a token edit unable to move a page, and — measured on the existing
  code — `style-values.ts` does not catch them, so the guard that looks like protection here gives
  none.

- **Motion is declarative data from a closed vocabulary** (FR-060 through FR-064). Added the same
  day, with the same reasoning applied one layer further: a named step (`duration: 'normal'`)
  survives a theme change, a raw `300` does not. The engine is contained the way the rich-text
  engine already is, so the publish path never loads it.

- **Imagery is selected from a project asset library, not generated** (FR-044 through FR-051). The
  library is populated locally in this feature. The agent may only place assets the library holds.
  The library sits behind a replaceable boundary so that a later backend — including people
  uploading images, with every upload joining the same library — replaces the source without
  touching how generation selects from it. Model-generated imagery is therefore a future way to
  populate the library, not a separate path into the page.

- **Skills are declarative expertise, never executable authority** (FR-065 through FR-076). The
  strongest reusable pattern from `open-builder` is progressive disclosure plus request-local
  selection; its script execution and capability-union semantics are deliberately not copied.
  `open-v0` contributes live-canvas context categories, and `OpenLovable` contributes visible
  streamed operations, but Builder keeps typed command batches, scratch preflight, and atomic apply.
  Skill bodies are structured and fingerprinted, scripts are absent, and the effective command set
  can only shrink relative to host policy.

## Assumptions

- The block vocabulary needed for professional pages does not exist in sufficient breadth today.
  Extending it — including new primitives and new section types — is expected work inside this
  feature, not a prerequisite delivered elsewhere.
- The person generating a site is the site's author. Multi-user roles, permissions, and concurrent
  editing are not introduced by this feature.
- The reference competitor used for blind comparison is accessed manually by a human evaluator using
  their own account. This feature delivers the protocol and the evidence format, not automated
  access to a competitor's product.
- Ratings in the blind comparison come from people. This feature does not assert that a model can
  substitute for human judgment of visual quality.
- The existing single validated write path, its history semantics, and its attribution of authorship
  remain the only way documents change. Extending it is permitted; bypassing it is not.
- The existing per-breakpoint override mechanism is the intended basis for responsive behaviour;
  extending its breakpoints or its expressiveness is permitted where it cannot carry a required
  layout.
- The editor's own appearance system and the generated site's design system remain separate
  concerns, as established by the preceding design milestone.
- Language-model cost and rate limits are the host application's concern. This feature states its
  work bound and reports when a brief exceeds it.
- The asset library available during this feature is populated locally and is small. Imagery variety
  is therefore bounded by the library, and the distinctiveness measure in SC-004 deliberately
  excludes imagery for that reason.
- Skill definitions are supplied by trusted application code in v1. Importing skills from a URL,
  executing skill scripts, and installing dependencies are intentionally deferred until an
  authenticated review, hashing, sandbox, and atomic-install contract exists.
- "Professional" is judged by the recorded evaluation, not by the implementing agent's own
  assessment.

## Out of Scope

- Hosting, publishing, deployment, custom domains, and site delivery.
- Content management: collections, dynamic data sources, and content modelling beyond the generated
  pages themselves.
- Commerce: catalogues, carts, checkout, and payment.
- Form submission backends. Generated forms are presentational until a host wires them.
- Multi-language and translated sites. Reading direction is in scope; translation is not.
- Real-time multi-user collaboration on a site.
- A reasoning service. The stage contracts are published so one can be built; building it is not
  part of this feature.
- Model-generated imagery, image upload, and the backend that stores uploaded assets. This feature
  delivers the library, its boundary, and selection from it; filling the library from a model or
  from uploads comes later through that same boundary.
- Search-engine optimization beyond a page's own title and description.
- Analytics, consent management, and third-party embeds beyond the single sanitized escape hatch.
- Automated access to, or scraping of, any competitor product.
- Skill scripts, arbitrary tool execution, URL-based skill import, dependency installation by a
  skill, and any skill API that reads or writes the filesystem directly.
