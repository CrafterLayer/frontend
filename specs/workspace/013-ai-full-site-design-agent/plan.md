# Implementation Plan: AI Full-Site Design Agent

**Branch**: `builder-core` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/workspace/013-ai-full-site-design-agent/spec.md`

## Summary

Turn a one-shot "propose commands for this page" assistant into a five-stage agent that produces a
whole website. The unit of work becomes a **site**: an ordered page set, shared regions, one
generated design system, and an asset library — validated as a whole, and owned by the same layer
that already owns documents.

Three decisions were fixed by the requester before planning and are treated here as constraints, not
options: the site **wraps** pages rather than replacing them; reasoning runs **client-side** against
a replaceable endpoint with a published stage contract; imagery is **selected** from a project asset
library rather than generated.

A fourth direction was added on 2026-09-01 after a source audit of the requester's three reference
projects: the agent accepts **versioned declarative skills** and runs through a bounded, observable
headless state machine. This is not free-form prompt injection and it is not a filesystem tool.
Skills are progressively disclosed, selected per request, fingerprinted, budgeted, and permitted
only to narrow the host's command policy. The existing scratch-kernel and grouped command door stay
the authority boundary.

The technical shape follows from one discovery made while reading the layer law. The page's design
tokens (`Theme`, `ColorToken`, `MeasurementToken`) live today in `@craftkit/builder-renderer`, which
sits at **layer 2** — the same layer as `@craftkit/builder-ai`. The builder dependency law (ADR
0003, enforced by `check:workspace`) forbids sideways edges, so the agent **cannot** import the
vocabulary it must generate. Making design tokens first-class data is therefore not a new subsystem;
it is a **downward move of the existing token vocabulary into `@craftkit/builder-schema`
(layer 0)**, where the renderer, the agent, the shell, and every extension can all legitimately read
it. This one move is what unlocks FR-009 through FR-015, and it is the reason this plan touches the
schema layer at all.

The second discovery is cheaper than expected: the page format does **not** need a version bump.
Pages already carry per-breakpoint prop overrides
(`responsive?: Partial<Record<'tablet' | 'mobile', …>>`), and an asset reference is an ordinary
`JsonValue` prop. `LATEST_SCHEMA_VERSION` stays `1`. The new version number belongs to the site, not
to the page — which is exactly what "the site wraps pages" was supposed to buy.

**No new package is created.** The site model, the token vocabulary, and the asset contract go into
`@craftkit/builder-schema`; site commands into `@craftkit/builder-core`; the site projection into
`@craftkit/builder-transforms`; the pipeline into `@craftkit/builder-ai`; the new editor surfaces
into `@craftkit/builder-shell`. Constitution VIII forbids a package created for possible future
reuse, and every candidate here has exactly one credible consumer.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.2.8 (`react` and `react-dom` pinned identical).
Node 24 LTS.

**Primary Dependencies** _(revised 2026-08-29 — this section previously read "No new runtime
dependency is introduced by this feature", which the requester's Tailwind and animation direction
made false; the claim is corrected rather than quietly dropped)_:

New, all verified against the registry before install and pinned in the root catalog — `tailwindcss`
4.3.3 and `@tailwindcss/vite` 4.3.3 (app-level build tooling), `@tailwindcss/typography` 0.5.20,
`clsx` 2.1.1 and `tailwind-merge` 3.6.0 (class composition in the block library), and `motion`
13.1.1 (the animation engine, **contained** — see D8/D9). Existing: zod 4.4.3 (schema), immer
11.1.18 + zustand 5.0.15 vanilla + nanoid 6.0.1 (core), fast-check 4.9.0 (dev, property laws). The
agent reaches a model over `fetch` through the existing provider port; no model SDK enters the
workspace.

**Storage**: None. A site is in-memory kernel state, projected to canonical JSON text. The asset
library is populated by a host-supplied port; this feature ships a local implementation and a
deterministic test double, and no binary asset enters the repository as a runtime dependency.

**Testing**: Vitest 4.1.11. Three tiers, already established by B0–B4 and the design milestone:
jsdom unit and behaviour tests colocated per package; `fast-check` property laws for the round-trip
and validation invariants; and Chromium stories run from `apps/storybook`
(`pnpm exec vitest run --project=storybook <path>`) for every claim about size, position, contrast,
or theme resolution — jsdom cannot measure a box or resolve a custom property, so SC-008 and SC-009
are Chromium-only by construction.

**Target Platform**: Browser. Modern evergreen; the code-view codec already runs in a Web Worker.

**Project Type**: Frontend monorepo (pnpm 11.23.0 workspaces + Turborepo 2.10.10). No backend member
is added — see Decision D2.

**Performance Goals**: First named stage visible within 5s of submitting (SC-001); a five-page site
complete within 180s (SC-001); a refinement at least 3× faster than a full regeneration (SC-007);
zero content re-renders attributable to unrelated pages when one page changes (the merge-gate
discipline established in B3a).

**Constraints**: Every write goes through the existing single validated door — no generated document
or generated site object may be assigned (FR-030). No executable-code generation path (FR-031). The
codec stays off the render thread (SC-005 of feature 011 must keep holding). The agent must remain
fully exercisable offline (FR-028). Generation must be seed-deterministic (FR-024, SC-013).

**Scale/Scope**: 89 functional requirements, 26 success criteria, and 9 user stories across the
declared Builder packages and Playground application. The production-readiness phase added after the
2026-09-01 audit executes immediately after the Skills core and before any site-pipeline/UI claim.

## Constitution Check

_GATE: evaluated before Phase 0 research, re-evaluated after Phase 1 design._

Constitution v1.2.0.

| Principle                                        | Verdict | Evidence / how this plan satisfies it                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Spec Kit is the source of truth**           | PASS    | Artifacts live in `specs/workspace/013-ai-full-site-design-agent/`. No policy is forked into `CLAUDE.md` or `AGENTS.md`.                                                                                                                                                                                                                      |
| **II. Modern React 19 baseline**                 | PASS    | No new React surface departs from 19.2.8. New components take `ref` as a prop, use Actions for the generation mutation (`useActionState` for stage/pending/error state), and use `useSyncExternalStore` through the existing kernel selectors rather than mirroring kernel state in an Effect.                                                |
| **III. One component per TSX file**              | PASS    | Six new components are planned, each in its own folder with its own file. The component matrix below names every one. No nested declarations; the stage list, page list, and swatch grid are real components in their own folders, not `renderX()` helpers.                                                                                   |
| **IV. Every UI component ships complete**        | PASS    | All six carry implementation + `index.ts` + typed CSF story + `.docs.mdx` + behavioural test. Enforced by `pnpm check:components` (currently 58 components, measured in baseline.md; this plan takes it to 64).                                                                                                                               |
| **V. Evidence-based quality and review**         | PASS    | Per-gate verification commands are named below. SC-008 and SC-009 are measured in Chromium, not asserted. The evaluation harness (Phase H) exists precisely so the competitive claim is measured.                                                                                                                                             |
| **VI. Shared context and deliberate delegation** | PASS    | Coordinator-owned. Phase boundaries are path-disjoint by package, which is what makes delegation safe if it is used later; no parallel writer shares a scope.                                                                                                                                                                                 |
| **VII. Commit integrity**                        | PASS    | No commit is proposed by this plan. Commit authorization remains withheld per `HANDOFF.md`.                                                                                                                                                                                                                                                   |
| **VIII. Monorepo boundaries and scoped specs**   | PASS    | Scope declared: workspace, cross-cutting. Affected members enumerated below. **No new package** — every candidate failed the two-credible-consumers test. Dependency direction is preserved and, in one case, corrected: moving the token vocabulary from renderer(2) to schema(0) removes a would-be sideways edge rather than creating one. |
| **IX. Vertical feature ownership**               | PASS    | Reusable editor surfaces go to `@craftkit/builder-shell` (the established owner of `Palette`, `LayersTree`, `Inspector`). Playground-specific composition stays in `apps/playground/src/features/preview`. No product logic moves into a route or page shell.                                                                                 |

**Gate result: PASS, no violations.** The Complexity Tracking table is therefore empty and has been
removed.

One item is worth naming explicitly because it _looks_ like a violation and is not. This plan edits
`@craftkit/builder-schema`, the layer-0 contract package, which B0 deliberately froze. The spec
authorizes it ("B4 and any lower layer may be modified or extended if the current design cannot
support this"), and the reason is concrete rather than convenient: the agent at layer 2 cannot see a
vocabulary that lives at layer 2. Leaving the tokens in the renderer would force either a sideways
dependency (illegal), a duplicated parallel vocabulary in the agent (two sources of truth for the
same tokens, guaranteed to drift), or generation by opaque string (unvalidatable). The downward move
is the only option that keeps one vocabulary and one validator.

### Post-design re-evaluation (after Phase 1)

Re-checked after `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` were written.
**Still PASS.** Two things changed during design and both were checked against the constitution
rather than waved through:

1. **`dispatchGroup` was added to `@craftkit/builder-core`** (contracts/site-model.md §2). Phase 0
   found that `applyAiPlan()` reports `mode: 'sequence'` because the kernel has no transaction-group
   API, so a multi-command plan costs several undo steps — while FR-034 and FR-037 require one
   generation and one refinement to each be one undo step. This is new layer-1 public API that was
   not in the original sketch. It stays inside the layer that owns dispatch, and it is the only way
   to satisfy those requirements without the AI package faking grouping by writing patches around
   the door, which its own README forbids. Principle VIII holds: no boundary is inverted.
2. **`TokenSwatchGrid` was identified as a real subcomponent** rather than a helper inside
   `DesignSystemPanel`. Principle III requires it to get its own folder and its own complete
   contract, so the component count is 56, not 55, and the matrix reflects that.

No violation surfaced in either pass, so Complexity Tracking stays empty and has been removed from
this plan.

### Tooling note discovered during planning

`.specify/scripts/bash/setup-plan.sh` fails with
`PyYAML is required to resolve preset template composition`; the system Python at `/usr/bin/python3`
has no `yaml` module. Verified that neither `.specify/presets/` nor `.specify/extensions/` provides
a `plan-template` override — the preset `react-monorepo-quality` wraps _commands_ only
(`speckit.plan`, `speckit.tasks`, `speckit.implement`). The base
`.specify/templates/plan-template.md` is therefore byte-identical to what the resolver would have
emitted, and it was copied directly. This is a local tooling gap, not a governance bypass. Fix
before the next cycle by making PyYAML available to the interpreter Spec Kit invokes.

## Affected Apps and Packages

Ownership, dependency direction, and public-API effect. Layers per ADR 0003 as enforced in
`packages/workspace-tools/.../validate-builder-boundaries.mjs`.

| Member                                          | Layer | Change                                                                                                                                                                                                                               | Public API effect                                                                                                  |
| ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `@craftkit/builder-schema`                      | 0     | **Major.** Site type + validator + site version/migration; token vocabulary moved down from the renderer; asset-library contract; asset-reference prop type.                                                                         | Additive exports plus one **relocation** (`Theme`, `ColorToken`, `MeasurementToken`, `TokenName`).                 |
| `@craftkit/builder-core`                        | 1     | Site-scoped commands (`addPage`, `removePage`, `renamePage`, `reorderPage`, `setSharedRegion`, `setDesignToken`, `setDesignSystem`, `registerAsset`), site-aware open/empty helpers, and a human-labelled grouped dispatch contract. | Additive. `CoreCommandName` widens; grouped dispatch accepts a backward-compatible options form.                   |
| `@craftkit/builder-transforms`                  | 2     | Site manifest projection + parse; the site-level round-trip law layered on the existing per-page law.                                                                                                                                | Additive (`projectSite`, `parseSite`, `SITE_MANIFEST_PROJECTION_ID`).                                              |
| `@craftkit/builder-renderer`                    | 2     | Resolve the theme from site data instead of a module constant; resolve asset references; re-export the relocated token types for source compatibility.                                                                               | **Behavioural change** at `themeToCssVars`/`DocumentView`; type re-exports preserved.                              |
| `@craftkit/builder-ai`                          | 2     | **Major.** The five-stage pipeline, versioned stage contracts, site-scoped refinement, asset selection, declarative skill registry/resolver, bounded agent runner, and deterministic offline implementations.                        | Additive; existing `generateAiPlan`/`applyAiPlan` remain. Skills and the runner converge on the same command path. |
| `@craftkit/builder-shell`                       | 3     | Four new editor surfaces (page navigator, generation progress, design-system panel, asset picker).                                                                                                                                   | Additive.                                                                                                          |
| `@craftkit/builder-extensions/blocks-marketing` | 4     | Block vocabulary breadth + responsive completeness for every section.                                                                                                                                                                | Additive block types; existing prop shapes preserved.                                                              |
| `@craftkit/builder-extensions/code-view`        | 4     | Worker protocol gains a `site` scope; the panel can project a site.                                                                                                                                                                  | Additive protocol variant.                                                                                         |
| `@craftkit/builder` (preset)                    | 5     | Re-export the new surface so apps keep importing one entrypoint.                                                                                                                                                                     | Additive.                                                                                                          |
| `@craftkit/builder-theme`                       | 2     | **Unchanged.** It owns _editor chrome_ (`--bldr-*`); the generated site design system is `--t-*`. FR-015 is satisfied by not touching it.                                                                                            |
| `apps/playground`                               | app   | Compose the new surfaces; supply the local asset library; extend `AssistantPanel` from one-shot to staged.                                                                                                                           | App-owned.                                                                                                         |
| `apps/storybook`                                | app   | Collect the new stories and the Chromium measurement gates.                                                                                                                                                                          | App-owned.                                                                                                         |
| `apps/adaptive-spec-router`                     | app   | **Out of scope, untouched** — the user's separately-owned work per `HANDOFF.md`.                                                                                                                                                     |

**Dependency direction before and after**: unchanged in shape and strictly improved in one place.
Every new edge is downward (`ai(2) → schema(0)`, `ai(2) → core(1)`, `shell(3) → schema(0)`,
`extensions(4) → transforms(2)`). The renderer's token vocabulary moving to schema **removes** the
only edge that would otherwise have had to go sideways. `pnpm check:workspace` is the gate; no entry
is added to `BUILDER_LAYERS` because no package is added.

**Build / cache / deployment**: no new deployable, no new build step (builder packages are internal
`src`-export packages with no build). Turbo's graph gains no node. The one cache consideration is
that `@craftkit/builder-schema` sits at the root of the graph, so Phase A invalidates every
downstream task once — expected and acceptable for a layer-0 change.

**Rollout / rollback**: single deployable (the playground), so no coordinated rollout. Rollback is
per-phase: every phase below is independently revertable because each ends with its own green gate,
and the site model is additive to a page format that never changes.

## Key Design Decisions

### D1 — The site wraps pages, and the page format stays at version 1

`BuilderSite` is a new layer-0 type holding `siteVersion`, an ordered page list, shared regions, the
design system, and the asset table. Each entry holds a `BuilderDocument` unchanged at
`LATEST_SCHEMA_VERSION = 1`.

This is the whole point of the wrap decision: because a page is untouched, every proof B0–B4 bought
keeps holding without being re-run at a new shape — per-page validation, per-page projection, the
per-page round-trip law, the renderer, the inspector, the canvas. A page lifted out of a site is
still a valid document (SC-014), and an existing bare document upgrades into a one-page site
(FR-007).

`LATEST_SITE_VERSION = 1` is introduced alongside, with its own migration table mirroring the
existing `document/migrations.ts` pattern. Two version numbers is a real cost, and it is the price
of not re-proving four milestones.

**Rejected**: pages as nodes inside one document (single namespace, site-wide undo stream, and
FR-036's byte-identical guarantee becomes far harder to prove); and replacing the document with a
site at `schemaVersion 2` (every consumer and every existing law migrates at once — the largest
blast radius available, for no requirement that demands it).

### D2 — Reasoning is client-orchestrated against a published stage contract

`@craftkit/builder-ai` gains a `SiteStageProvider` port with one method per stage, each carrying an
explicit versioned request/response type in `src/pipeline/wire.ts` — the same pattern the existing
`src/provider/wire.ts` already uses for single plans, which is what makes this a widening rather
than an invention.

Three implementations ship: a deterministic offline one (so every scenario in the spec is testable
without a network — FR-028), a remote one over the existing `fetch` boundary with SSE progress
reuse, and a scripted one under `@craftkit/builder-ai/testing`.

The contract is written so a future server can implement all five stages behind one endpoint with
**no change to the client** (FR-027): stage requests are self-contained, carry the seed, and never
depend on client-held state between calls.

**Rejected**: a workspace backend member. The repository is frontend-only and the constitution's
package, boundary, and verification story is written for that; adding a deployable to satisfy a
prompt-secrecy concern nobody has raised yet is scope the spec explicitly puts out.

### D3 — Design tokens move down to layer 0

`ColorToken`, `MeasurementToken`, `TokenName`, and `Theme` move from
`packages/builder/renderer/src/resolve/theme.ts` into `packages/builder/schema/src/theme/tokens.ts`.
The renderer keeps `themeToCssVars`, `paletteOf`, `COLOR_ROLES`, `lightTheme`, `darkTheme`, and
re-exports the moved types so no consumer's import breaks.

The generated design system is then a `Theme` stored **on the site** and validated in schema. The
renderer resolves `--t-*` from site data rather than from a module constant. Blocks continue to
consume roles and step counts, never literals — the existing `style-values.ts` law that refuses
`"16px"` already enforces FR-011 and needs no change, which is the strongest evidence that this
vocabulary was designed for exactly this.

FR-014's contrast gate reuses the Chromium harness the design milestone built for `--bldr-*`,
retargeted at generated `--t-*` pairings.

### D4 — Assets are site data behind a replaceable port

The site owns an asset table: `{ id, url, description, mood, palette, alt, width, height }`. Blocks
reference `id`. The renderer resolves `id → url` from the site.

`AssetLibraryPort` supplies entries; this feature ships a local implementation in the playground and
a deterministic double in `@craftkit/builder-ai/testing`. A later upload backend implements the same
port (FR-050) and changes nothing about selection.

FR-045 — the agent may only place assets the library holds — is enforced structurally, not by
prompt: the assembly stage rejects any asset reference not present in the site's asset table, so an
invented address is a validation failure and cannot reach a page. SC-012's "zero invented addresses"
is therefore a property, not a hope.

### D5 — The site round-trip law is composed, not rewritten

The existing law is `parseDocument(projectDocument(d)) ≡ d` over registry-generated documents, 1,000
cases, fixed seeds, merge-blocking.

The site law is layered on top rather than replacing it:

```
projectSite(site)  = manifest projection  +  projectDocument(page) for each page
parseSite(text)    = parse manifest       +  parseDocument(page text) for each page
```

The proof obligation splits in two, and only the first half is new:

1. **Manifest law (new)**: `parseManifest(projectManifest(m)) ≡ m` for arbitrary generated manifests
   — page order, shared regions, design system, asset table. New `fast-check` arbitrary; 1,000
   cases; fixed seeds.
2. **Composition law (new, cheap)**: a site's projection decomposes into exactly its manifest text
   plus its page texts, and recomposition is order-independent and lossless.
3. **Page law (unchanged)**: reused verbatim. Not re-derived.

Plus the existing non-vacuity gate, extended: a `parseSite` that returns an empty patch list forever
must fail, exactly as `parseDocument`'s gate does today.

### D6 — The code-view worker protocol gains a scope, not a rewrite

`TransformScope` today is `{kind:'document'} | {kind:'node'; nodeId}`. It gains `{kind:'site'}`, and
`{kind:'page'; pageId}` so a person can read one page of a site as text.

The `TransformDocumentMessage` channel — which exists so typing never re-clones the document per
request — carries the site instead when the scope is site-level. This is the one place where site
size has a real cost, and it is why the per-page scopes exist: editing one page must not
re-serialize nine others.

`SC-005` of feature 011 (the codec never runs in the render realm, proven statically _and_ by
counted invocations during a typing burst) must be re-proved at site scope, not assumed. Its
existing tests are extended, not replaced.

### D7 — Responsiveness needs no schema change

`Breakpoint = 'tablet' | 'mobile'` with desktop as the base already gives the three widths FR-041
requires, and `setResponsive` already writes per-breakpoint prop overrides through the door. What is
missing is not capability but **coverage**: existing marketing blocks do not all carry deliberate
narrow behaviour. Phase D is therefore block work, not kernel work — a genuinely cheaper answer than
the spec's framing assumed.

### D8 — Tailwind v4 binds to the tokens; it does not replace them

Added 2026-08-29 at the requester's direction ("engine + editor + AI").

`@theme inline` declares every Tailwind namespace as `var(--t-…)`, generated from the token
vocabulary by `packages/builder/renderer/src/tailwind/token-bridge.ts` and held equal to its
checked-in stylesheet by a drift gate — the same arrangement `chrome.css` already uses. The result
is that `bg-accent` compiles to `background-color: var(--t-accent)`: a **reference, not a value**.
Re-point the token and every page moves, so FR-012 survives Tailwind's arrival intact.

`inline` is load-bearing rather than stylistic. A plain `@theme` copies the declared value into
Tailwind's own variable once; the utility would then freeze at the starting palette and a runtime
design-system change would move nothing.

The mapping is **mechanical and one-to-one** with token names. `--color-foreground` would read
better than `--color-text`, and that is precisely the temptation refused: a nicer name is a
translation table, a translation table is a second source of truth, and it drifts the first time a
token is added. An exhaustiveness test makes an unmapped token a failure.

**The agent never authors class strings.** It emits tokens and named intents; the block chooses the
utilities. Measured on the existing code, this is not a stylistic preference: `style-values.ts`
refuses hex colours and px lengths, and `p-4` / `bg-blue-500` pass straight through it. A guard that
looks like protection would have provided none, while the design system quietly stopped being
addressable and SC-004's distinctiveness collapsed into Tailwind's default palette.

### D9 — Motion is data at layer 0; the engine is contained at layer 4

The vocabulary (`packages/builder/schema/src/motion/`) is a closed union of entrance effects,
scroll-linked effects, and **named timing steps** — validated at the same door as every other prop.
It sits at layer 0 for two reasons: the planner at layer 2 must be able to emit motion and have it
refused when it invents an effect, and a document carrying motion must round-trip whether or not any
animation engine is loaded.

Timing is a named step, never a number. `duration: 300` is a literal in exactly the way
`padding: '16px'` is, and it would make motion the one part of the design system a theme edit could
not move.

`motion` 13.1.1 is **contained** in a layer-4 extension, following the precedent the workspace
already set for tiptap: the read, publish, and static-output paths render a document carrying motion
without loading the engine. Extensions under `packages/builder/extensions/` receive
`EXTENSION_LAYER` automatically, so no `BUILDER_LAYERS` entry is needed.

Absence means stillness, and a viewer's reduced-motion preference is honoured — motion is opted
into, never defaulted on.

### D10 — Skills are progressively disclosed data; the agent run is a bounded state machine

The source audit in [research.md](./research.md) R11 showed that `open-builder` has the strongest
Skills mechanics of the three references: metadata discovery, explicit request-local selection,
content preparation under a hard cap, and an immutable run policy. It also showed exactly what not
to copy: raw XML-like instruction injection, capability union, URL imports, and host-interpreter
scripts. `open-v0` contributes live canvas context categories; `OpenLovable` contributes visible
streamed operations. Neither supplies Builder's validation or rollback guarantees.

`@craftkit/builder-ai` therefore owns a new, headless Skills surface:

1. `defineAiSkill()` validates and canonicalizes one v1 definition, computes its deterministic
   fingerprint, and refuses functions, scripts, unsafe ids, oversized bodies, or unsafe reference
   paths.
2. `createAiSkillRegistry()` is immutable. It exposes small catalog entries separately from
   `readSkill()`/`readReference()` and prepares full content only for selected, required, always-on,
   or deterministically auto-matched skills.
3. Resolution is request-local, input-order independent, dependency/conflict aware, and bounded by
   skill count and token budget. Explicit errors fail closed before the provider call; optional
   auto-matches may be omitted only with structured reasons.
4. A skill's `restrictToCommands` is a restriction, not a grant. The effective set is the
   intersection of the current run policy and every active restriction; registered kernel commands
   remain the final authority.
5. The assembled context carries catalog metadata plus active structured bodies, and plan-cache
   identity includes that complete context. No XML tags or executable content are used.

The same package adds `runAiAgent()`, a UI-independent coordinator with injected run id and clock.
Its state sequence is
`started → resolving-skills → gathering-context → proposing → validating → proposed → completed` for
review-only runs, or `... → validating → applying → completed` for auto-apply runs. Every emitted
event carries a monotonic sequence; exactly one terminal event is legal. `apply: 'never'` supports
Ask/Plan review, while `apply: 'auto'` applies the already validated batch through the grouped door
as one AI-authored, human-labelled transaction. A host-owned synchronous run lease is rechecked
around cache/provider results and immediately before application, so a late run cannot recover
authority merely because its provider ignored an abort signal.

The existing provider boundary stays replaceable. The first version deliberately has no model SDK,
MCP, subagents, skill scripts, URL imports, or direct filesystem/process tool. Those capabilities
need independent authorization and sandbox contracts; adding them here would weaken the product
before it improves it.

### D11 — Production readiness uses one canonical wire and one pinned authority path

The post-US8 audit reproduced a release-blocking mismatch between the strong headless contracts and
the Playground integration. With the real 54-block registry, context assembly serialized block,
template, document, and selection data both as structured fields and again as built-in fragments.
The landing request measured 121,291 estimated tokens and the empty request 114,321 against the
64,000 default; both failed before the provider was called. Removing only the duplicated block and
document fragments reduced the landing request to 56,268. This is an architecture defect, not a
reason to raise the budget.

The correction is one canonical provider envelope:

1. Structured block/template/document/selection fields remain the single authoritative
   representation used by local and remote providers. `fragments` is reserved for additive host,
   extension, memory, and active-Skill context and never mirrors those built-ins.
2. Every fragment carries `source`, `kind: 'instruction' | 'data'`, and `trust`; the remote adapter
   preserves those distinctions when assigning model roles. Model-authored rationale is not durable
   memory. Memory records host-authored structured outcomes only.
3. The live registry produces a data-only command catalog with JSON argument contracts. It is
   filtered by the effective policy before serialization and accompanied by a versioned output
   contract. No bridge or prompt owns a hand-maintained command list.
4. A validated proposal carries its immutable effective policy. Preview and apply accept that pinned
   proposal rather than an unbound `AiPlan`; the lower-level compatibility function also requires an
   explicit policy and fails closed when absent at runtime.
5. Command cost is recursive. Top-level count remains bounded, `applyPatches` is absent from default
   AI authority, and explicit authorization still charges every nested patch against a hard
   operation budget before scratch work.
6. Provider boundaries use typed failure codes, cleanup on every stream exit, observer isolation,
   endpoint/redirect/credential/referrer policy, and bounded tolerant invalid-output handoff to the
   existing single repair round.
7. `AssistantPanel` calls `runAiAgent` for both proposal and automatic application, supplies the
   host Skill registry/selection, and renders its sequenced events and activation pins. It no longer
   recreates a weaker React-owned execution path.

`p-limit` was evaluated for this phase and intentionally not added. The agent path is sequential.
The dev bridge is an untrusted inbound boundary, so it rejects work over its active-request cap with
`429` instead of creating the unbounded pending queue that `p-limit` permits by default. Reconsider
the dependency only if a trusted multi-page pipeline deliberately parallelizes per-page work and
also owns an explicit pending-work bound.

## Deviations recorded against the approved delivery plan (v3)

Four decisions in the delivery plan depart from what this document assumed, each because something
was measured rather than argued. They are recorded here so the plan and the spec do not disagree.

### V1 — Assembly is a local compiler, not a fifth model call

D2 describes five stages behind one provider port. The delivery keeps five OBSERVABLE stages but
implements assembly as pure, seeded, local code. Reasons: seed determinism (SC-013) and the timing
budget (SC-001) become properties of code rather than of a model; a compiler cannot invent a block
type or an image URL it never saw, which is where FR-045's structural rejection has to live; and it
removes one 30k-token call per site. `SiteStageProvider` therefore declares four methods.

### V2 — The site is ONE kernel; pages are lenses

The site substrate is a single kernel with one store, one transaction log, one history and one
persistence session. `siteKernel.page(id)` returns a view satisfying the existing `BuilderKernel`
interface and forwarding every call with a `pageId`. Patches are site-rooted, so a group spanning
pages is one immer produce, one transaction, one undo. Rejected: N page kernels with a coordinator.
N histories make an undo of an older group wrong the moment any page is hand-edited after it, and N
append logs turn a conflict on page 3 — after pages 1 and 2 have appended — into a torn write
`persist/seq-conflict` cannot express. Proved workable before adoption (T282), including the two
defects that proof surfaced.

### V3 — The commit is attributed to the agent

`restoreDocument` lands a whole document as one transaction but hardcodes `author: 'codeview'`. The
spec requires the agent's changes to be attributed to the agent, so the commit door takes the author
and a human label. Proved on the existing projection route without changing shipped code (T284),
including that a removal commits and that ids the draft minted survive the crossing — which is why
the commit sends PATCHES rather than replaying the run's steps.

### V4 — `TokenSwatchGrid` is a sibling, not a nested component

The Component Artifact Matrix places `TokenSwatchGrid` inside `DesignSystemPanel/`. The contract
checker governs only the DIRECT children of a `components/` directory
(`workspace-tools/src/components/validate-components.mjs`), so a nested component is invisible to
the gate it is supposed to satisfy. It gets its own sibling folder and its own five artifacts.

### V5 — Split-build concurrency scales from the scaffold, within a hard ceiling

The section list is the only trustworthy demand signal available before fill work starts. Automatic
builds therefore begin from a three-writer baseline, add one writer per further group of three
sections, and cap at six even when the page contains twelve regions. This makes a four-section page
use four provider calls at once without allowing a large scaffold to spawn one local CLI process per
section. Generation may overlap; landing remains ordered and revalidates every proposal against the
live kernel. An explicit `fillConcurrency` remains an exact host override.

## Project Structure

### Documentation (this feature)

```text
specs/workspace/013-ai-full-site-design-agent/
├── plan.md                    # This file
├── spec.md                    # Feature specification
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/                 # Phase 1 output
│   ├── site-model.md
│   ├── stage-pipeline.md
│   └── asset-library.md
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 — /speckit-tasks, NOT created here
```

### Source Code (repository root)

Only new or materially changed paths are listed. Everything else in these packages is untouched.

```text
packages/builder/schema/src/
├── theme/
│   ├── tokens.ts                     # MOVED DOWN from renderer/resolve/theme.ts
│   ├── design-system.ts              # generated Theme as validated site data
│   └── contrast.ts                   # pure ratio computation for the gate
├── site/
│   ├── types.ts                      # BuilderSite, SitePage, SharedRegion, LATEST_SITE_VERSION
│   ├── validate.ts                   # whole-site validator (FR-006)
│   └── migrations.ts                 # site version table + document→one-page-site upgrade
└── assets/
    ├── types.ts                      # AssetEntry, AssetRef, AssetLibraryPort
    └── validate.ts                   # reference-resolves-to-a-held-asset law (FR-045)

packages/builder/core/src/commands/
└── site-commands.ts                  # addPage/removePage/renamePage/reorderPage/
                                      # setSharedRegion/setDesignToken/setDesignSystem/registerAsset

packages/builder/transforms/src/codec/
├── site-codec.ts                     # projectSite / parseSite / manifest codec
└── ../testing/site-arbitraries.ts    # fast-check generators for the manifest law

packages/builder/ai/src/
├── skills/
│   ├── types.ts                       # v1 definitions, catalog, activation, policy
│   ├── define-skill.ts                # runtime validation + canonical fingerprint
│   ├── registry.ts                    # metadata discovery + progressive read surface
│   ├── resolve-skills.ts              # deterministic dependencies/conflicts/budgets
│   ├── command-policy.ts              # host ∩ active-skill restriction
│   └── builtins.ts                    # reviewed first-party instruction-only skills
├── agent/
│   ├── types.ts                       # run states, events, outcomes, bounds
│   └── run-agent.ts                   # bounded headless coordinator
├── pipeline/
│   ├── wire.ts                       # versioned per-stage request/response contracts
│   ├── stage-provider.ts             # SiteStageProvider port
│   ├── generate-site.ts              # the five-stage orchestrator (cancel, seed, bounds)
│   ├── stages/{sitemap,structure,content,design-system,assembly}.ts
│   └── offline/                      # deterministic implementations of all five stages
├── refine/
│   └── refine-site.ts                # site-scoped follow-up → commands, reusing validate/apply
├── assets/
│   └── select-assets.ts              # selection from the library, never invention
└── testing/
    └── scripted-stage-provider.ts

packages/builder/shell/src/components/
├── SitePages/                        # page navigator (full 5-artifact contract)
├── GenerationProgress/               # named stages, live status, cancel
├── DesignSystemPanel/                # read + adjust generated tokens
│   └── TokenSwatchGrid/              # real subcomponent, own folder + full contract
└── AssetPicker/                      # choose from the library

packages/builder/extensions/blocks-marketing/src/components/
├── <existing 12>/                    # responsive completeness pass
└── <new sections>/                   # vocabulary breadth (each: full contract + schema)

packages/builder/extensions/code-view/src/worker/
└── protocol.ts                       # + {kind:'site'} and {kind:'page'} scopes

apps/playground/src/features/preview/components/
├── AssistantPanel/                   # one-shot → staged brief + refinement
└── SiteBriefForm/                    # new: the brief entry surface (full contract)

apps/playground/src/features/preview/
└── local-asset-library.ts            # the local AssetLibraryPort implementation
```

**Structure Decision**: The existing builder layer structure is kept exactly as ADR 0003 defines it.
No option-style restructure applies here — this is a mature monorepo with an enforced layer map, and
the plan's job is to place new files inside it, which the tree above does. The one structural
judgement is that the four reusable editor surfaces belong to `@craftkit/builder-shell` rather than
to the playground, because the shell is the established owner of `Palette`, `LayersTree`, and
`Inspector`, and a second host would need all four. `SiteBriefForm` stays app-owned because the
brief is a product decision, not editor chrome.

## Component Artifact Matrix

Constitution IV: a component is incomplete unless all five artifacts exist and agree. Six new
components, all six artifacts each. `pnpm check:components` goes 58 → 64 (baseline measured, not
taken from HANDOFF.md’s stale 50).

| Component            | Owner             | Impl                                  | Export     | Story (CSF, autodocs)                                    | Docs MDX                               | Test                                                    | Accessibility + states                                                                   |
| -------------------- | ----------------- | ------------------------------------- | ---------- | -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SitePages`          | `builder-shell`   | `SitePages.tsx`                       | `index.ts` | default, single page, many pages, reordering, empty, RTL | purpose, props, keyboard model, limits | add/remove/rename/reorder via accessible queries        | listbox semantics, roving focus, Home/End, RTL mirror, focus destination named on delete |
| `GenerationProgress` | `builder-shell`   | `GenerationProgress.tsx`              | `index.ts` | idle, running each stage, complete, failed, cancelled    | stage vocabulary, cancel contract      | stage announcement, cancel callback, failure text       | `aria-live` polite for stage changes, cancel reachable by keyboard, no focus steal       |
| `DesignSystemPanel`  | `builder-shell`   | `DesignSystemPanel.tsx`               | `index.ts` | default, editing, regenerating, contrast warning, RTL    | token groups, adjust vs regenerate     | edit one token → one dispatch, draft discipline         | grouped fields with labels, contrast failure announced, external writes win over drafts  |
| `TokenSwatchGrid`    | `builder-shell`   | own folder under `DesignSystemPanel/` | `index.ts` | colour roles, measurements, overflow                     | why it is separate from the panel      | selection callback, keyboard grid nav                   | grid semantics, swatch names not colour-only                                             |
| `AssetPicker`        | `builder-shell`   | `AssetPicker.tsx`                     | `index.ts` | populated, empty library, unavailable, filtered, RTL     | port contract, empty behaviour         | select → callback; empty library shows labelled absence | images have alt, empty state is text not a blank box                                     |
| `SiteBriefForm`      | `apps/playground` | `SiteBriefForm.tsx`                   | `index.ts` | empty, typing, submitting, refused, error                | what a good brief contains             | submit via Action, refusal path, disabled while running | labelled textarea, error tied by `aria-describedby`, submit disabled state announced     |

No component in this matrix declares another component inside itself. `TokenSwatchGrid` is a real
subcomponent and therefore gets its own folder and its own complete contract rather than living at
the bottom of `DesignSystemPanel.tsx`.

## Phased Delivery

Ordered by dependency, not by visibility. Each phase ends green on its own gate and is independently
revertable.

| Phase | Scope                  | Delivers                                                                                                                                                                           | Gate                                                |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **A** | schema, core           | Site type, validator, site version + migration, site commands. No UI.                                                                                                              | Package tests + `check:workspace`                   |
| **B** | schema, renderer       | Token vocabulary moved to layer 0; theme resolved from site data; contrast gate.                                                                                                   | Package tests + Chromium contrast story             |
| **C** | transforms, code-view  | Site manifest codec, composed round-trip law, worker `site`/`page` scopes, off-thread re-proof.                                                                                    | Property laws (1,000 cases) + off-thread counter    |
| **D** | blocks-marketing       | Vocabulary breadth + responsive completeness on every section.                                                                                                                     | Component contracts + Chromium overflow story       |
| **E** | ai                     | Five-stage pipeline, wire contracts, offline + remote + scripted providers, cancel, seed, bounds.                                                                                  | Package tests, offline determinism property         |
| **F** | ai, shell, playground  | Refinement path; the four shell surfaces; `SiteBriefForm`; playground composition. **P1 stories 1, 2, 3 become true together here.**                                               | `check:components` 56, full component contracts     |
| **G** | schema, ai             | Asset library contract, local port, selection, structural rejection of invented references. **US6.**                                                                               | Property: zero unresolvable references              |
| **H** | specs, apps/storybook  | Evaluation harness: blind comparison protocol, distinctiveness measurement, durable evidence. **US7.**                                                                             | Recorded evidence artifacts                         |
| **I** | ai, core               | Versioned Skills runtime, cache/policy correctness, bounded agent runner, typed events, human-labelled grouped apply. **US8.**                                                     | AI/core focused tests + mutation/property proofs    |
| **J** | schema, ai, playground | Canonical real-kernel context, policy-pinned preview/apply, nested work bounds, provider/memory hardening, and Assistant→runner/Skills integration. **US9 / release-blocking P0.** | Real Playground readiness + security mutation gates |

Phases A–C are pure substrate and touch no UI. Phase F is the milestone: it is the first point at
which a person can type a brief and get a site, and it is deliberately gated behind A, B, C, and E
because every one of those is load-bearing for it. G and H follow the P2/P3 priority the spec
assigns and do not block F.

Phase J is numbered after the original plan for traceability but executes immediately after Phase I
and before E/F. It repairs the currently shipped single-page path on which the later full-site
pipeline depends. A green package fixture cannot substitute for its real-Playground readiness gate.

## Verification

Per `.specify/agents/rules/monorepo.md`, narrowest first. Prefix every command with
`PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`, and add
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` when pnpm attempts a forbidden auto-install.

```bash
# 1. Changed-file format
pnpm format:check

# 2. Narrow module or component tests — pass the PATH directly.
#    `pnpm --filter X test -- <path>` does NOT filter to that path.
pnpm exec vitest run packages/builder/schema/src/site
pnpm exec vitest run packages/builder/transforms/src/codec/site-codec.test.ts
pnpm exec vitest run packages/builder/ai/src/pipeline
pnpm exec vitest run packages/builder/ai/src/skills packages/builder/ai/src/agent

# 3. Owning package
pnpm --filter @craftkit/builder-schema lint typecheck test
pnpm --filter @craftkit/builder-ai     lint typecheck test

# 4. Direct consumer contract checks
pnpm check:workspace     # ADR 0003 layer law — the gate for every new edge
pnpm check:components    # 58 -> 64; a missing story/doc/test fails here
pnpm check:boundaries

# 5. Chromium measurement — jsdom cannot prove any of these
pnpm exec vitest run --project=storybook <relative path>   # from apps/storybook
#   SC-008 overflow/overlap at 360 / 768 / 1024 / 1440
#   SC-009 contrast over every generated --t-* text/background pairing

# 6. Cross-cutting: this feature touches layer 0, so the full gate is required before handoff
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify
```

**Read pnpm's own exit code, not a wrapper's.** `pnpm verify > log; echo $?` reports the _echo's_
status — three runs were misread that way during the design milestone. Capture pnpm's exit in braces
or read the log tail.

### Which gate proves which success criterion

| SC                               | Proven by                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| SC-001 (timing)                  | Instrumented pipeline test with a scripted provider; wall-clock claims only from uncontended runs |
| SC-002 (zero unvalidated writes) | Counted, not asserted: a spy on the door proves every write passed validation                     |
| SC-003 (round trip)              | `fast-check` 1,000 cases, fixed seeds, merge-blocking, plus the non-vacuity gate                  |
| SC-004 (distinctiveness)         | Phase H measurement over 10 briefs; recorded thresholds                                           |
| SC-005 (copy relevance)          | Term-overlap check against the brief + a filler-text refusal test                                 |
| SC-006 (blind comparison)        | Phase H protocol; ≥3 human raters; recorded                                                       |
| SC-007 (refinement isolation)    | Node-by-node comparison before/after; ratio measured against a full run                           |
| SC-008 (responsive)              | Chromium story, real layout boxes                                                                 |
| SC-009 (contrast)                | Chromium story, computed ratios over generated pairings                                           |
| SC-010 (all-or-nothing)          | Cancel/failure tests comparing captured prior state                                               |
| SC-011 (undo)                    | State comparison after one undo                                                                   |
| SC-012 (imagery)                 | Property test: every reference resolves to a held asset; count of invented addresses is 0         |
| SC-013 (seed determinism)        | Property test over repeated runs with fixed seeds                                                 |
| SC-014 (page independence)       | Property test: lift each page out of a generated site and validate it alone                       |

## Risks

| Risk                                             | Why it is real here                           | Mitigation held in this plan                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layer-0 change invalidates everything downstream | `@craftkit/builder-schema` is the graph root  | Phase A is isolated and lands green before anything depends on it; the token move keeps re-exports so no consumer import breaks                        |
| Site-scale text projection makes code view slow  | The document channel re-clones on site change | Per-page scopes (D6) exist so page editing never serializes the site; the off-thread proof is re-run at site scope, counted not timed                  |
| Skill content becomes hidden authority           | Prompt text can look like policy              | Structured bodies, trust metadata, progressive disclosure, command-policy intersection, no scripts, and kernel execution-time validation               |
| Cached plan ignores changed expertise            | Memory/skills/catalog are host-owned context  | Cache the complete canonical assembled context and check cancellation before returning a hit                                                           |
| Late provider result mutates a newer run         | Async streams outlive UI intent               | Request-local run id, AbortSignal plus host-owned run-lease checks at every boundary, monotonic terminal event law, no stale progress/validation/apply |
| Two version numbers drift                        | Site v1 and page v1 evolve separately         | One migration table each, mirroring the existing pattern; the composition law fails loudly if a page shape the manifest expects has moved              |
| Generated design systems look alike              | The failure mode competitors are judged on    | SC-004 measures it across 10 unrelated briefs with a recorded threshold, in Phase H, before the feature can be called done                             |
| The agent invents image URLs                     | The classic generation failure                | Structural, not prompted: assembly rejects any reference not in the site asset table (D4)                                                              |
| "Professional" is self-assessed                  | The spec's central competitive claim          | Phase H requires human raters and durable evidence; the implementing agent's own opinion is explicitly not evidence                                    |

## Open Items for `/speckit-tasks`

None blocking. Two notes to carry forward:

1. Phase D's "vocabulary breadth" is deliberately not enumerated here — the concrete section list
   should be derived from the Phase E sitemap/structure stages' actual needs, so tasks for D should
   be generated after E's stage contracts exist, or the block list will be guesswork.
2. Phase H needs a named human rater pool and a reference-competitor account before it can run. That
   is a user-side prerequisite, not an implementation task.
