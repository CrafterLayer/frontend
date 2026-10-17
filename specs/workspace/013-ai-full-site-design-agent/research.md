# Phase 0 Research: AI Full-Site Design Agent

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-29

The specification entered planning with zero `NEEDS CLARIFICATION` markers — its three open
questions were decided by the requester and recorded in the spec's `Resolved Decisions`. Phase 0 was
therefore not about resolving unknowns in the spec. It was about answering the question the spec
deliberately left to the plan: **which layers actually have to change, and what does the existing
code already give us for free?**

Every finding below was read out of the working tree, not recalled.

---

## R1 — Where the page's design tokens live today, and why that decides the architecture

**Question**: FR-009 to FR-015 require a generated, addressable design system. Does one already
exist?

**Finding**: Yes, and it is better than expected — but it is in the wrong layer.

`packages/builder/renderer/src/resolve/theme.ts` already defines the page's complete token
vocabulary, split deliberately into `ColorToken` (`surface`, `text`, `accent`, `success`, …) and
`MeasurementToken` (`spaceUnit`, `radius`, `sectionSpacing*`, `contentWidth*`, `fontSize*`,
`shadowSoft`/`shadowStrong`, …). Its own comment states the invariant this feature depends on: every
token must be one a block actually consumes, and a stylesheet reading a token the theme never
defines "is not themed at all — it is a hard-coded 64px wearing a token's clothes".

Better still, `packages/builder/schema/src/blocks/style-values.ts` already **refuses** literal
lengths like `"16px"` in props. Padding is typed as a _number of steps_ and resolved as
`calc(var(--t-space-unit) * n)`. FR-011 — "a generated section MUST NOT carry a literal colour,
font, or raw size value" — is therefore already law at layer 0 and needs no new enforcement.

**The problem**: `@craftkit/builder-renderer` is **layer 2**. So is `@craftkit/builder-ai`. ADR
0003's law, enforced in `validate-builder-boundaries.mjs`, permits only strictly-downward edges. The
agent literally cannot import the vocabulary it is being asked to generate.

**Decision**: Move `ColorToken`, `MeasurementToken`, `TokenName`, and `Theme` down to
`@craftkit/builder-schema` (layer 0). The renderer keeps every _behaviour_ (`themeToCssVars`,
`paletteOf`, `COLOR_ROLES`, `lightTheme`, `darkTheme`) and re-exports the moved types so no
consumer's import breaks.

**Rationale**: It is the only option that leaves one vocabulary and one validator.

**Alternatives rejected**:

- _Sideways edge renderer → ai_: illegal under ADR 0003; `check:workspace` fails it.
- _Duplicate the vocabulary inside the agent_: two sources of truth for the same tokens. They drift
  the first time a token is added, and nothing catches it.
- _Generate tokens as opaque strings_: unvalidatable. FR-014's contrast gate cannot run over a shape
  nobody has typed.

---

## R2 — What the page format actually needs for a multi-page site

**Question**: The spec permits extending any lower layer. How much of the page format has to change?

**Finding**: None of it.

`packages/builder/schema/src/document/types.ts` gives `BuilderDocument` as
`{ schemaVersion, surface, dir, rootId, nodes }` with a flat node map, and `Node` already carries
`responsive?: Partial<Record<'tablet' | 'mobile', Record<string, JsonValue>>>` — per-breakpoint prop
overrides with desktop as the base ("Law R"). An asset reference is an ordinary `JsonValue` prop.

**Decision**: `LATEST_SCHEMA_VERSION` stays `1`. The new version number belongs to the site
(`LATEST_SITE_VERSION = 1`), not to the page.

**Rationale**: This is precisely what the requester's "site wraps pages" decision was supposed to
buy. Because the page is untouched, the per-page validation, projection, round-trip law, renderer,
inspector, and canvas proofs from B0–B4 keep holding without being re-derived at a new shape.

**Consequence for FR-041 (responsive by construction)**: the capability exists; the _coverage_ does
not. Not every marketing block carries deliberate narrow behaviour today. That makes responsiveness
a block-vocabulary task (Phase D), not a kernel task — materially cheaper than the spec's framing
assumed.

---

## R3 — How to prove the site round-trips without re-proving the page

**Question**: The existing law is `parseDocument(projectDocument(d)) ≡ d`, 1,000 `fast-check` cases,
fixed seeds, merge-blocking, with a non-vacuity gate that kills a parser returning `[]` forever.
What does a site-level law cost?

**Finding**: `packages/builder/transforms/src/codec/document-codec.ts` exposes `projectDocument`,
`parseDocument`, `projectScope`, `parseScope`. `parseDocument` returns _patches_ against a base
document, not a document — which is exactly why the door is never bypassed, and it composes cleanly.

**Decision**: Compose rather than replace.

```
projectSite(site) = projectManifest(site)  +  projectDocument(page) for each page
parseSite(text)   = parseManifest(...)     +  parseDocument(pageText, basePage) for each page
```

Three obligations, of which only two are new:

1. **Manifest law** (new): `parseManifest(projectManifest(m)) ≡ m` over generated manifests — page
   order, shared regions, design system, asset table. New arbitrary, 1,000 cases, fixed seeds.
2. **Composition law** (new, cheap): a site projection decomposes into exactly its manifest text
   plus its page texts; recomposition is order-independent and lossless.
3. **Page law** (unchanged): reused verbatim.

Plus the non-vacuity gate extended to `parseSite`.

**Alternative rejected**: one monolithic site codec. It would re-derive the page law inside a larger
shape — more code, weaker proof, and it discards the strongest asset B4 produced.

---

## R4 — What the code-view worker protocol costs

**Question**: Feature 011 proved SC-005 twice — the codec cannot be imported by main-thread modules
at all (statically), and a typing burst invokes it zero times in the render realm (counted, not
timed). Does a site break that?

**Finding**: `packages/builder/extensions/code-view/src/worker/protocol.ts` defines
`TransformScope = { kind: 'document' } | { kind: 'node'; nodeId }` and a separate
`TransformDocumentMessage` channel that exists specifically "so typing never clones it per request".
Requests carry `generation` (incremented when _input_ arrives, so a stale response is detectable
before the newer request even reaches the worker).

**Decision**: Add `{ kind: 'site' }` and `{ kind: 'page'; pageId }` scopes. The base-artifact
channel carries the site when the scope is site-level.

**Rationale**: The per-page scope is not a convenience — it is the mitigation. Editing one page must
not re-serialize the other nine. The existing generation/staleness machinery needs no change because
it is keyed on input arrival, not on payload size.

**Obligation**: SC-005 is re-proved at site scope, not assumed. The existing static-import test and
the counted-invocation burst test are extended, not replaced.

---

## R5 — Whether the agent's existing invariant survives multi-stage generation

**Question**: `packages/builder/ai/README.md` states the rule the package exists to preserve: _"AI
proposes kernel commands. It never creates, replaces, or writes a `BuilderDocument`."_ Five stages
that culminate in "assemble the document" reads like a direct assault on that.

**Finding**: It is not, provided the _stages_ produce plans and only the door produces documents.
The existing flow already validates a proposal by looking up every command in the live registry,
parsing args with each command's own schema, and dispatching the whole sequence through a **scratch
kernel** with dedicated deterministic ports before anything touches the live kernel.

**Decision**: The assembly stage emits `insertNode`/`setProp`/`setResponsive`/site commands — never
a document or a site object. FR-030 extends the existing refusal to cover generated _site_ objects
too.

**Rationale**: The scratch-kernel preflight is the mechanism that makes SC-002 ("zero unvalidated
writes") measurable rather than aspirational, and it already exists. Multi-stage reasoning changes
how the command list is _derived_, not how it is _admitted_.

**Note carried into the plan**: `applyAiPlan()` currently reports `mode: 'sequence'` because the
kernel has no transaction-group API, so a multi-command plan is several undo steps. FR-037 and
FR-034 require one generation and one refinement to each be **one** undo step. This is a real gap:
it needs a genuine grouped-dispatch contract in `@craftkit/builder-core`, and the README is explicit
that the AI package must not fake grouping by writing patches around the door. Recorded as Phase A
work.

---

## R6 — Where the multi-stage reasoning should run

**Question**: Decided by the requester (client-side now, server adapter later). What does the
existing code make that cost?

**Finding**: `packages/builder/ai/src/provider/wire.ts` already publishes a versioned wire contract
(`AiPlanWireRequest`, `AiPlanWireResponse`, `AI_PLAN_WIRE_VERSION`) exported so a TypeScript server
can import the exact types. `remote-provider.ts` already advertises
`accept: text/event-stream, application/json`, handles SSE `status` frames for live progress,
injects `fetch` for tests, and surfaces transport failures as a typed error with a human sentence.

**Decision**: Widen the same pattern into `src/pipeline/wire.ts` with one versioned request/response
per stage. Stage requests are self-contained and carry the seed, so no client-held state sits
between calls.

**Rationale**: FR-027 requires a future server to absorb all five stages behind one endpoint with no
client change. Self-contained stage requests are what make that true. The SSE progress channel that
already exists is exactly what FR-021's per-stage narration needs — no new transport.

**Alternative rejected**: a workspace backend member. The repository is frontend-only; the spec puts
a reasoning service explicitly out of scope.

---

## R7 — How to stop the agent inventing image URLs

**Question**: FR-045 says the agent may only place assets the library holds. Prompting for that is
not a guarantee.

**Decision**: Make it structural. The site owns an asset table; blocks reference `id`; the assembly
stage rejects any asset reference not present in that table. An invented address becomes a
validation failure and cannot reach a page.

**Rationale**: SC-012 asks for a _count of zero_ invented addresses. A count of zero is a property
test, not a prompt. This is the same discipline the codebase already applies elsewhere — the
reserved-key refusal and `MAX_JSON_DEPTH` exist in transforms so that "everything a document may
hold can also be written through the patch door", rather than trusting a caller to behave.

**Alternative rejected**: post-hoc URL liveness checking. It turns a structural invariant into a
network-dependent, flaky one.

---

## R8 — Whether a new package is justified

**Question**: Site model, design system, asset library, and a five-stage pipeline is a lot of new
surface. Does any of it deserve its own package?

**Finding**: Constitution VIII requires either two credible consumers or a clear platform boundary,
plus an owner and a narrower public API than its implementation. And ADR 0003 makes adding a builder
package a deliberate act — an unplaced member fails `check:workspace` with `BUILDER_UNKNOWN_LAYER`.

**Decision**: **No new package.** Site types → `builder-schema` (0). Site commands → `builder-core`
(1). Site codec → `builder-transforms` (2). Pipeline → `builder-ai` (2). Editor surfaces →
`builder-shell` (3).

**Rationale**: Every candidate has exactly one credible consumer today. A `@craftkit/builder-site`
package would have one consumer, would need a layer assignment, and would put the site model at a
layer where the kernel could not validate it — which contradicts FR-006 ("owned by the same layer
that owns documents").

---

## R9 — Which theme system the generated design system belongs to

**Question**: The design milestone (feature 012) introduced `@craftkit/builder-theme` with
`--bldr-*` chrome tokens. Is the generated site design system the same system?

**Finding**: No, and keeping them separate is a _requirement_, not an accident. `context.json`
records the split: the shell owns `--bldr-*` chrome theming "independent of the document `--t-*`
theme", and feature 012's User Story 1 exists specifically so a person can choose the editor's
appearance without changing the page's.

**Decision**: `@craftkit/builder-theme` is **untouched**. The generated design system is `--t-*`,
owned by the site, resolved by the renderer.

**Rationale**: FR-015 is satisfied by not doing something, which is the cheapest way to satisfy
anything. Merging them would reintroduce the coupling the previous milestone deliberately removed.

**Reusable asset**: feature 012's WCAG contrast harness — computed in Chromium over 18 pairings × 2
themes — is retargeted at generated `--t-*` pairings for FR-014. The measurement technique carries
over even though the token set does not.

---

## R10 — Local tooling gap found during setup

**Question**: `.specify/scripts/bash/setup-plan.sh --json` failed with
`PyYAML is required to resolve preset template composition`.

**Finding**: `/usr/bin/python3` has no `yaml` module. Verified that neither `.specify/presets/` nor
`.specify/extensions/` provides any `plan-template` override — `react-monorepo-quality` declares
only three _command_ templates (`speckit.plan`, `speckit.tasks`, `speckit.implement`), and no
`templates/` directory or template file exists in either tree.

**Decision**: Copy `.specify/templates/plan-template.md` directly. It is byte-identical to what the
resolver would have emitted given no overrides.

**Rationale**: Equivalent output, verified rather than assumed. Recorded here rather than silently
worked around.

**Follow-up for the user**: make PyYAML available to the interpreter Spec Kit invokes before the
next cycle, or `/speckit-tasks` will hit the same failure. This is environment repair, not feature
work.

---

## R11 — What the three local reference agents actually prove about Skills

**Question**: The requester named `open-builder`, `open-v0`, and `OpenLovable` as references and
asked for the strongest professional ideas missing here. Which parts are production-worthy, and
which would weaken Builder's safety model?

**Finding — `open-builder`**: it is the only one of the three with a real runtime Skills system.
`src/lib/skills/registry.ts` separates discoverable metadata from full `SKILL.md` content, prepares
explicit selections per request under a 128 KiB cap, and `active-context.ts` keeps activation local
to one run. `src/lib/ai/tools-schema.ts` snapshots run id, mode, platform, policy version, active
skills, and allowed dynamic tools, then filters the tool set before presentation. Its plan-mode
barrier withholds writes until approval and rotates the run boundary before unlocking them.

The reference also exposes failure modes not to inherit: forced skill bodies are interpolated into
XML-like prompt tags without the escaping applied to custom prompts; multiple skill tool lists are
combined by union; imported URL and script execution widen the security surface; and React
orchestration has accumulated into a very large hook. Builder therefore takes progressive
disclosure, request-local activation, fingerprints, immutable run policy, and execution-time
rechecks — but not scripts, URL import, capability union, raw prompt tags, or a React-owned core.

**Finding — `open-v0`**: `backend/main.py::chat` runs a genuine Agentlys tool loop and passes useful
live page context — route, viewport, scroll position, and selected element. That context taxonomy is
worth adding to Builder later. The loop itself registers a broad `CodeEditor` tool with no visible
command schema, scratch preflight, step budget, or rollback, so it is not an acceptable execution
boundary.

**Finding — `OpenLovable`**: `server/gemini.ts::generateResponse` is one Gemini completion, not an
agent loop. `src/lib/parser.ts::StreamingParser` turns XML-like model text into file/dependency HTTP
mutations while streaming. Its useful idea is presentation: people can see named operations and
status during generation. Builder should express that as typed run events and typed commands, never
as browser-parsed markup or fire-and-forget filesystem calls.

**Decision**: Build a new declarative `AgentSkillRegistry` and bounded headless agent runner inside
`@craftkit/builder-ai`. Skills are JSON-canonical data with version/fingerprint/trust metadata,
metadata-only discovery, request-local full content, deterministic selection, dependencies,
conflicts, and budgets. They may only narrow a host command policy. The runner emits typed sequenced
events and converges on the existing scratch-kernel + grouped command door.

**Rationale**: This preserves the one advantage Builder already has over all three references: AI
never receives a filesystem or document-write capability. It proposes typed commands; validation and
the kernel remain the only authority.

**Alternatives rejected**:

- _Copy `open-builder` Skills wholesale_: imports filesystem, scripts, and tool semantics that do
  not belong in a browser/headless layer-2 package.
- _Treat a skill as one more free-form prompt_: no version pin, no budget, no capability boundary,
  no cache invalidation, and no observable activation.
- _Let the browser parse tool markup_: repeats OpenLovable's partial-write and rollback failure.
- _Give the model a broad editor tool_: repeats open-v0's prompt-only authorization and bypasses
  Builder's strongest invariant.
