# Feature Specification: Adaptive Spec Router

**Feature Branch**: `010-adaptive-spec-router`

**Created**: 2026-08-27

**Status**: Implementation complete; responsive browser smoke pending

**Input**: User description: "Build a professional product here to try: an adaptive system that
coordinates Claude and Codex, selects the strongest suitable model for each task, applies two-sided
plan review, prevents overlapping writers, and makes the result explainable before a future public
release."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Route a development task with a clear rationale (Priority: P1)

A developer enters a concise task brief, selects its work class and risk, and receives one
recommended writer and one independent reviewer. The recommendation explains the provider, model
tier, reasoning level, expected safety lane, and the signals that caused the recommendation.

**Why this priority**: The routing explanation is the product's core promise: it turns a multi-model
setup into a decision a developer can inspect and trust.

**Independent Test**: A developer can change a task from a low-risk UI polish request to a high-risk
architecture request and observe the selected route and its evidence change without leaving the
workspace.

**Acceptance Scenarios**:

1. **Given** a new task with normal implementation risk, **When** the developer submits the task
   brief, **Then** the product presents exactly one designated writer, one reviewer, and the reason
   for both choices.
2. **Given** a high-risk task, **When** the developer opens the route decision, **Then** the product
   identifies the elevated review lane and makes clear that one writer still owns edits.
3. **Given** a developer changes the task class or risk, **When** the recommendation updates,
   **Then** the displayed decision, rationale, and safety constraints remain internally consistent.

---

### User Story 2 - Audit a plan with two independent viewpoints (Priority: P1)

A developer can inspect a frozen plan revision, see separate Claude and Codex plan-review records,
and understand whether the plan is ready, blocked, or needs a revised review cycle.

**Why this priority**: Independent plan review is the principal quality gate requested for decisions
that affect code architecture and implementation safety.

**Independent Test**: A developer can view a plan revision with two completed reviews and then
trigger a material revision state that invalidates the previous decision until both reviews are
current again.

**Acceptance Scenarios**:

1. **Given** a frozen plan revision with two current reviews, **When** the developer views the plan
   audit, **Then** each reviewer, verdict, evidence count, and revision match are visible.
2. **Given** a material plan revision, **When** the developer views the previous review records,
   **Then** the product identifies them as stale and shows the required follow-up review gate.
3. **Given** a review flags a risk, **When** the developer opens its finding, **Then** the related
   requirement, severity, and next action are understandable without provider-specific hidden
   context.

---

### User Story 3 - Follow a safe execution run through evidence (Priority: P2)

A developer can follow an illustrative run from planning through implementation and verification,
see the active single-writer lease, and inspect its evidence ledger.

**Why this priority**: The product needs to make safety and quality visible rather than merely
describing them in policy documents.

**Independent Test**: A developer can open an example run and identify its current stage, active
writer ownership, reviewer separation, checks, and unresolved risks in one screen.

**Acceptance Scenarios**:

1. **Given** a run in progress, **When** the developer opens the dashboard, **Then** the timeline
   shows the completed, active, and gated stages in sequence.
2. **Given** one writer lease is active, **When** the developer inspects execution safety, **Then**
   the permitted ownership scope and the prohibition on a second writer are explicit.
3. **Given** verification evidence is available, **When** the developer opens the evidence ledger,
   **Then** each item exposes its source, result, and whether it satisfies a release gate.

---

### User Story 4 - Evaluate the product locally without credentials (Priority: P2)

A developer can try the routing and audit experience locally with deterministic example data,
without entering provider credentials, starting an AI task, or sending project content outside the
browser.

**Why this priority**: The user needs a safe, fast product trial before deciding whether to extract
and publish it.

**Independent Test**: A developer can start the app, create and modify a scenario, inspect all
primary product surfaces, and reset the demo without a network account or external integration.

**Acceptance Scenarios**:

1. **Given** a fresh local session, **When** the developer starts the product, **Then** a populated
   example run and a clear local-demo boundary are visible.
2. **Given** a developer tries a new scenario, **When** they apply it, **Then** the result is
   deterministic and the demo data remains clearly labelled as illustrative.
3. **Given** a developer wants to start over, **When** they reset the demo, **Then** the initial
   example data is restored without affecting any repository, model account, or remote system.

### Edge Cases

- A task may be intentionally too ambiguous for a confident route; the product must show which
  information is missing rather than pretending a strong recommendation exists.
- A selected provider or model tier may not be available; the product must expose the fallback and
  identify that the decision changed.
- A plan may have only one completed review or reviews attached to different revisions; the product
  must not call it ready.
- A run may be blocked by a verification failure; the product must preserve the failed evidence and
  show the next safe action.
- On narrow screens, all route, review, and evidence controls must remain reachable without relying
  on colour alone.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The product MUST let a developer define a local task scenario using a brief, work
  class, and risk level.
- **FR-002**: The product MUST return one designated writer and one independent reviewer for every
  routable scenario, including a human-readable rationale and safety lane.
- **FR-003**: The product MUST keep the writer decision explainable: task signals, selected
  provider/model tier, workflow entry mode, fallback status, and reason for selection are visible
  together.
- **FR-004**: The product MUST identify one-writer ownership explicitly and MUST never represent
  parallel writers as safe for the same change scope.
- **FR-005**: The product MUST present a dual plan-review audit that distinguishes current, stale,
  blocked, and ready status by plan revision.
- **FR-006**: The product MUST surface a sequential run timeline with explicit planning, review,
  implementation, verification, and release-gate states.
- **FR-007**: The product MUST maintain an evidence ledger in which each visible evidence item has a
  source, result, and gate relevance.
- **FR-008**: The product MUST make unavailable provider/model routes and any fallback decision
  visible; it MUST not silently downgrade a recommended route.
- **FR-008a**: The product MUST default to Codex-native operation and MUST not imply that a task
  started in Codex can invoke Claude. Cross-provider coordination is available only after the
  developer explicitly chooses Claude-adaptive mode.
- **FR-009**: The product MUST be fully usable with keyboard navigation, visible focus indication,
  semantic labels, and text alternatives to colour-only status cues.
- **FR-010**: The product MUST clearly label this release as a local deterministic evaluation
  experience and MUST not claim to execute, bill, authenticate with, or inspect Claude, Codex, or a
  repository.
- **FR-011**: The product MUST provide a reset action that restores its initial example scenario
  without changing files, credentials, remote services, or user data outside the current local
  session.
- **FR-012**: The product MUST preserve the same primary capability at phone, tablet, and desktop
  widths without hiding critical routing, audit, or evidence information.

### Key Entities

- **Task scenario**: A developer-defined unit of work described by a brief, work class, risk level,
  and optional constraints.
- **Route decision**: The explainable choice of writer, reviewer, model tier, reasoning level,
  safety lane, and fallback condition for a task scenario.
- **Plan revision**: A frozen, identifiable planning snapshot against which independent plan reviews
  are assessed.
- **Review record**: An independent reviewer outcome tied to one plan revision, including its
  verdict, findings, and evidence freshness.
- **Writer lease**: A visible assertion that exactly one writer owns a bounded change scope while a
  run is active.
- **Evidence record**: A traceable verification, review, or policy result with a gate relevance and
  outcome.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can produce and understand a route decision for a supplied task scenario
  in under 30 seconds without documentation or credentials.
- **SC-002**: 100% of routable example scenarios display one writer, one independent reviewer, a
  model tier, a rationale, and a visible fallback state.
- **SC-003**: 100% of example plans with reviews from two different revisions are visually
  identified as not ready for implementation.
- **SC-004**: A developer can identify the current run stage, active writer ownership, and the next
  release gate from the dashboard without opening a second screen.
- **SC-005**: All primary interactions remain keyboard-operable and all critical state uses a text
  label at viewport widths of 375px, 768px, 1024px, and 1440px.
- **SC-006**: The product can be started and explored locally with no provider credentials, network
  request, source-code execution, or repository mutation.

## Assumptions

- The first release is a local-first product prototype that demonstrates routing policy, review
  freshness, and evidence ergonomics with deterministic scenario data.
- No provider credentials, billing, account linking, live model invocation, repository access, or
  agent execution are in scope for this release.
- The user wants a professional demo to evaluate the product concept before any extraction,
  licensing, GitHub repository, or public publishing decision.
- The project keeps Codex as the default coordinator. Claude can be represented as a routed provider
  in the product model, but this implementation must not create a Codex-to-Claude runtime call.
- The prototype supports English product copy for clarity; localisation and persistent multi-user
  collaboration are later product phases.
