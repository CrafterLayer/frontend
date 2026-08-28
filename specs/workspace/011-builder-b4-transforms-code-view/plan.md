# Implementation Plan: Builder B4 — Transforms and Code View

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Date**: 2026-08-28

## Summary

Give the document a second, textual representation that provably cannot drift from the first. A new
layer-2 `transforms` package owns the codec (project ↔ parse); a lazily loaded layer-4 `code-view`
extension owns the panel and a module worker that runs the codec off the rendering path; the
round-trip law is proven by registry-directed property testing and gated in CI.

Three decisions, all of which say **no** to a dependency — see research R1/R4/R5:

- **Canonical strict JSON**, not JSX/YAML/MDX. Every nicer form breaks on node identity: our ids are
  stable forever and referenced by slots and `variantOf`, so a form that hides them forces
  parse-back to invent them and the round trip fails by construction.
- **A native `<textarea>`**, not CodeMirror (75 KB gz) or Monaco (~846 KB gz). The spec needs
  display, edit, per-line errors, debounce — not highlighting, folding or completion.
- **A handwritten typed `postMessage` protocol**, not Comlink — and the reason is structural, not
  size: `ProjectionDef` holds FUNCTIONS, which cannot be structured-cloned, so proxying would run
  the transform back on the thread it came from and defeat FR-009.

## Technical Context

|                    |                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------- |
| Language / runtime | TypeScript 6.0.3 (strict), React 19.2.8, Node 24                                      |
| Test               | Vitest 4.1.11 + Testing Library; Storybook 10.5.10 in real Chromium for browser truth |
| Property testing   | `fast-check` 4.9.0 — **already in the catalog** since B0                              |
| New dependencies   | **none** (research R4/R5)                                                             |
| Workspace          | pnpm 11.23.0 + Turborepo 2.10.10                                                      |
| Off-thread         | a module `Worker` owned by the extension; injected as `WorkerLike` in jsdom           |

**No NEEDS CLARIFICATION remains.** The three open questions from the spec's Assumptions (textual
form, editor, RPC) are resolved in research R1/R4/R5 with the trade-off stated for each.

## Constitution Check

| Principle                              | Assessment                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec Kit is source of truth         | PASS — spec → research → this plan → tasks; no code before artifacts                                                                                              |
| II. React 19 baseline                  | PASS — no new runtime deps; the panel is ordinary React 19                                                                                                        |
| III. One component per TSX             | PASS — see the component matrix; every subcomponent gets its own folder                                                                                           |
| IV. Every UI component ships complete  | PASS — matrix below assigns all six artifacts per component                                                                                                       |
| V. Evidence-based quality              | PASS — every law below is a COUNTED gate; two independent reviews before handoff (the B3c lesson, `MEMORY.md`)                                                    |
| VI. Shared context / delegation        | PASS — path-disjoint leases; the coordinator owns integration, browser gates and cross-package contracts                                                          |
| VII. Commit integrity                  | PASS — no commit is made by an agent                                                                                                                              |
| VIII. Monorepo boundaries              | PASS — `@craftkit/builder-transforms` is **already assigned layer 2** in `validate-builder-boundaries.mjs`; the extension is layer 4; apps import only the preset |
| IX. Vertical ownership / thin delivery | PASS — the codec is the vertical; the panel is a thin surface over it                                                                                             |

**Gate result: PASS.** No exception is requested.

## Structure

```
packages/builder/schema/            (layer 0) — CHANGED
  src/json/json-value.ts              -0 canonicalised at the boundary (research R2)
  src/extensions/contribution-points.ts
                                      RegistryRead gains `projection(id)` / `projections()`
                                      (verified gap: zero occurrences today)
packages/builder/core/              (layer 1) — CHANGED
  src/registry/registry.ts            register/unregister/lookup for projections

packages/builder/transforms/        (layer 2) — NEW, name already reserved in the layer map
  src/codec/canonical-json.ts         deterministic printer: sorted keys, 2-space, slot order kept
  src/codec/strict-parse.ts           duplicate-key rejection + one-based line diagnostics
  src/codec/document-codec.ts         project(doc|scope) ⇄ parse(text, doc) → patches | errors
  src/codec/scope.ts                  the versioned scoped envelope (root id + flat descendants)
  src/testing/arbitraries.ts          REGISTRY-DIRECTED fast-check generators + blueprint shrinking

packages/builder/extensions/code-view/   (layer 4) — NEW
  src/index.ts                        manifest: ONE lazy panel + ONE projection contribution
  src/worker/transform-worker.ts      module worker; imports transforms DOWNWARD
  src/worker/protocol.ts              typed request/response; generation + revision + scope
  src/worker/client.ts                WorkerLike injection, coalescing, stale-drop, teardown
  src/CodeViewPanel/                  the panel (component contract below)
  src/CodeViewErrors/                 the per-line error list (component contract below)

packages/builder/editor/            (layer 5) — CHANGED: preset surface additions
apps/playground/                    scenario 10 + the Law-S counter
```

**Dependency direction**: extension(4) → transforms(2) → core(1) → schema(0). The shell is NOT
touched by B4 and must never import the transform engine — the panel reaches the document only
through the kernel door it already has.

**Direct consumers / migration impact**: adding `projection`/`projections` to `RegistryRead` is
additive, but `RegistryRead` is implemented by the core registry and by test doubles; every
implementer must be updated in the same change or typecheck fails (this is how the B3c
`inlineEditor` addition behaved). The `-0` canonicalisation is a behaviour change at the document
boundary — a value no author can intend, but it needs a negative test proving it is normalised
rather than rejected in a way that breaks an existing document.

## Component matrix (constitution IV)

| Component        | Impl                 | Local export | Story                                                          | MDX                                                       | Behaviour test                                                | a11y states                                                                     | Owner       |
| ---------------- | -------------------- | ------------ | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------- |
| `CodeViewPanel`  | `CodeViewPanel.tsx`  | `index.ts`   | typed states: clean · typing · invalid · conflict · busy · RTL | purpose, the round-trip law, why a textarea, known limits | applies once, never on invalid, debounce counted              | labelled textbox, `aria-invalid`, stable `aria-describedby`, real Tab traversal | coordinator |
| `CodeViewErrors` | `CodeViewErrors.tsx` | `index.ts`   | none · one · many · RTL                                        | error shape, line semantics, how focus moves              | selecting an error focuses the textarea and selects that line | list semantics, one settled announcement (not one per error)                    | coordinator |

Line numbers, if drawn, are `aria-hidden` decoration — never one DOM node per source line.

## Phases

### Phase A — close the blocker and finish the contribution point

`-0` canonicalisation (research R2, verified by execution: `JSON.stringify(-0) === "0"`, so the
round trip is unachievable until fixed), then `projection`/`projections` on `RegistryRead` + the
core registry, mirroring exactly how `inlineEditor` was added in B3c.

### Phase B — the codec, and its proof

Canonical printer, strict parser with duplicate-key rejection and one-based lines, the scoped
envelope, then the registry-directed generators. The proof matrix (research R3) is the deliverable,
not an afterthought:

| Gate                   | Assertion                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Pure codec             | `parse(project(doc))` reproduces `doc` exactly                                                           |
| Canonical text         | `project(parse(project(doc))) === project(doc)` (second-print idempotence)                               |
| **Non-vacuous**        | generated `base ≠ edited`; parsing `project(edited)` against `base` yields ≥1 patch and exactly `edited` |
| Key-order metamorphism | re-inserting keys in another order leaves the canonical text identical                                   |
| Scope isolation        | everything outside the selected subtree is untouched                                                     |
| Invalid text           | every truncation/corruption → errors with valid one-based lines and **zero** patches                     |
| Field mutants          | dropping ids, slot order, bindings, a breakpoint, `variantOf`, envelope fields — each detected           |
| Regression retention   | every minimised counter-example committed as a named fixture with its seed                               |

1,000 cases per principal law, matching the existing kernel property suite.

### Phase C — the worker and the panel

Typed protocol carrying `{operation, requestId, generation, baseRevision, scope, projectionId}`;
only a response matching the current generation, revision and scope may apply. At most one in-flight
request plus one coalesced latest. The document crosses **once per revision**, the text per
debounce.

**Cancellation is stated honestly**: `postMessage` queues on the recipient's event loop, so a cancel
message cannot interrupt a parse already running. Request ids suppress _stale application_; true
interruption would need cooperative checkpoints or worker termination, and B4 does not claim it.

Then the panel: applies through the same kernel door (one transaction, one undo), never mutates on
invalid text, pins a dirty draft to `{scope, baseRevision}` and reports a conflict rather than
retargeting when the selection moves underneath it.

### Phase D — laws, surfaces, and the browser truth

The 14 counted gates from research R7, the preset surface, playground scenario 10, docs coherence,
then the evidence run. **Browser truth is coordinator-owned and non-negotiable**: a real module
worker must be proven to run (a fake port cannot prove thread placement), and real Tab/Escape must
be pressed in Chromium — B3c §19 is the standing reminder that a programmatic `.focus()` left every
unit test green while the real tab order was broken.

### Phase E — close-out

Two INDEPENDENT reviews with different lenses before handoff (`MEMORY.md`: sixteen defects were
found this way in an already-green milestone), fix accepted findings with mutation-checked
regressions, converge, handoff, commit proposal.

## Verification

Narrowest → widest, at every phase:

```
pnpm --filter @craftkit/builder-transforms  lint|typecheck|test
pnpm --filter @craftkit/builder-code-view   lint|typecheck|test
pnpm --filter @craftkit/builder-schema      test        # -0 boundary
pnpm --filter @craftkit/builder-core        test        # projection registry
pnpm check:workspace && pnpm check:components
cd apps/storybook && pnpm exec vitest run --project=storybook   # browser truth
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify
```

Negative proofs required: a shell package importing `@craftkit/builder-transforms` fails
`check:workspace`; an extension depending on another extension fails; a new UI component missing any
of its six artifacts fails `check:components`.

## Complexity Tracking

| Risk                                                | Mitigation                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| The textual form is coupled to the persisted schema | Accepted and documented; a friendlier projection may be added later behind the same contribution point, but must pass the identical gate first |
| Registry-directed generators are real work          | Unavoidable — arbitrary-JSON generation would prove nothing about the vocabulary authors can actually build (research R3)                      |
| The worker path is only countable, not timeable     | That is the house law; one real-browser gate covers what counting cannot (thread placement)                                                    |
| `variantOf` semantics are underspecified            | B4 preserves it as an exact string and does not interpret it; clarifying belongs to B6                                                         |
