# Professional free page design — 2026-10-20

User-authorized continuation: professional, varied CVs and pages; explicit UI UX Pro Max
instructions must influence generation; existing block layouts must not limit authored composition.

User clarification: applies to **all designs**, not only CVs. New pages default to bespoke
composition, with freely chosen order and 1–12 regions (one region may contain a complete layout).
Existing JS/runtime libraries remain available when free code is enabled; templates are opt-in.

## Scope and findings

Owners: builder-ai skills, page-plan validation/streaming and section writing; ai-server page-plan
prompt/schema; Playground plan-card roundtrip; evals local browser evidence. Public Builder/wire
consumers stay compatible. No new runtime, dependency, migration or UI component is currently
needed. Existing customCode tree/CSS, validated scripts and kernel transactions already support
arbitrary responsive composition.

Verified defects: planner asks for a kit per section; the normalizer derives kits from variants; kit
writers may write only slots. CV instructions fix one layout. Explicit default skill IDs can be
removed before section writing and CV expertise is absent from the auto-disabled planning lane. The
checkout is clean at 52ab7448; older handoff staging statements are historical.

## Acceptance

- FD1: Every fresh page request defaults to authored composition unless the user asks for templates.
  Pro Max aliases in ordinary prose activate the implemented skill; explicit selected skills survive
  every step within existing hard budgets and disabled optional skills stay disabled.
- FD2: A bounded optional `design` plan artifact records kind (website/resume/portfolio),
  composition (bespoke/hybrid), chrome (standard/none) and concept. Section `layout` records custom
  geometry. Legacy saved plans remain readable. Bespoke plans cannot silently become kits; a CV need
  not acquire marketing navigation/footer or irrelevant stock photography.
- FD3: The same design and section layout reach streamed and final writers and participate in
  reconciliation. Authors can use semantic tree + scoped CSS, existing tools or bounded scripts; no
  mandatory canned layout. Existing target, Undo, cancellation and follow-up protections remain.
- FD4: CV instructions preserve user facts, omit or visibly label missing content, distinguish a
  résumé from a portfolio, and support print/readability/RTL without imposing one composition.
  Generic website plans may use kits when requested, but must state a subject-specific design
  concept and vary structure when the brief calls for it.
- FD5: Verify actual planner/build contracts, ordinary/streamed/approved plans, skill selection,
  browser-rendered distinct CV/page compositions at desktop/mobile/RTL, and relevant checks.
  Scripted fixtures prove mechanics and rendering, not live model artistic quality or latency.

## Plan and boundaries

Add optional fields to the existing plan contract and server structured answer, before sections in
stream order. Read/normalize through the existing validator, using request-derived constraints for
fresh generation. Propagate design into section briefs and fingerprints. Keep old no-design plans
unchanged. Free composition does not require enabling JavaScript, filesystem access or arbitrary
packages; interactive free code retains existing permission/runtime boundaries.

Repair explicit skill selection and natural-language aliases separately from capped automatic
discovery. Reduce CV instructions to content/design decisions rather than fixed markup. Research
official GitHub sources for mechanisms; do not import remote skill scripts or unreviewed code.

No dependency direction changes: apps consume public Builder APIs; packages never import apps.
Owner/consumer typechecks, focused Vitest, lint/format, workspace/file-size/boundary gates and
Playground production build/budgets verify integration. Browser fixture uses actual kernel and
renderer; screenshots are inspected. No new React components means no new component artifacts. Fresh
independent native review follows the user's established local-only review preference; no external
CLI review/workflow-engine pass is claimed. Rollback is source-only, no saved-page rewrite.

## Requirements checklist / analysis

- [x] Exact affected members and contracts identified.
- [x] Existing runtime is sufficient; package installation is optional, not a quality substitute.
- [x] Safety and ownership boundaries preserved; hard skill budgets stay bounded.
- [x] Legacy behavior, streaming and actual visible output included in acceptance.
- [x] Research conclusions separated from measured local and live-model evidence.
- [x] FD1–FD5 implementation, independent review, verification and convergence complete.

Evidence: [verification, 2026-10-21](verification-free-design-2026-10-21.md). Live model quality
remains unmeasured.
