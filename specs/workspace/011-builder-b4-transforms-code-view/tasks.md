# Tasks: Builder B4 — Transforms and Code View

**Input**: `specs/workspace/011-builder-b4-transforms-code-view/` — spec.md, plan.md, research.md,
data-model.md, contracts/builder-transforms.md, quickstart.md **Prerequisites**: B3c converged;
`pnpm verify` EXIT 0. Tests are MANDATORY; every UI component ships the full six-artifact contract.
**NO COMMITS** — the final task produces a proposal only. **No new dependencies** (plan/research
R4–R5): textarea + handwritten typed RPC; `fast-check` is already catalogued.

## Format: `[ID] [P?] [Story] Description with exact path`

`[P]` = parallelizable (path-disjoint from every other open `[P]` task). Stories: US1 read as text,
US2 edit as text, US3 the round-trip law, US4 responsive + pay-per-use.

## Phase 1: Setup

- [x] T001 Package skeleton `packages/builder/transforms/` (`@craftkit/builder-transforms`, private,
      `type: module`, exports `./src/index.ts` + `"./testing": "./src/testing/index.ts"`, scripts
      lint|typecheck|test|test:coverage, deps `@craftkit/builder-schema` workspace + `fast-check`
      catalog devDep) mirroring `packages/builder/core/package.json`; wire vitest.config.ts +
      tsconfig.json from the core package's pattern
- [x] T002 Package skeleton `packages/builder/extensions/code-view/` (`@craftkit/builder-code-view`,
      deps transforms+core+schema workspace, react peer) mirroring
      `packages/builder/extensions/richtext/package.json`; confirm both packages appear in
      `pnpm check:workspace` (member count grows by 2)

## Phase 2: Foundational (plan Phase A — blocks every story)

- [x] T003 [P] Canonicalise `-0` at the document boundary in
      `packages/builder/schema/src/json/json-value.ts` (+ its test): a stored `-0` normalises to
      `0`, never rejected in a way that breaks an existing document; named regression proving
      `Object.is` round-trip now holds (research R2 — verified `JSON.stringify(-0) === "0"`)
- [x] T004 [P] Add `projection(id)` / `projections()` to `RegistryRead` in
      `packages/builder/schema/src/extensions/contribution-points.ts` + export from
      `packages/builder/schema/src/index.ts` (verified gap: zero occurrences today)
- [x] T005a Complete the `panels` contribution point too — found equally declared-but-unreachable
      during implementation, and T021's lazy panel cannot resolve without it (contract §4.5):
      `panel(id)`/`panels(slot?)` on `RegistryRead` + core registry + all-or-nothing duplicate and
      disposal tests
- [x] T005 Implement projection registration/lookup/disposal in
      `packages/builder/core/src/registry/registry.ts` exactly as `inlineEditors` was added in B3c
      (all-or-nothing duplicate rejection, disposal removes) + tests in
      `packages/builder/core/src/extensions/manager.test.ts`; update every `RegistryRead`
      implementer/test double the typecheck names

**Checkpoint**: schema 110+ and core 91+ suites green; the contribution point is reachable.

## Phase 3: User Story 1 — Read the page as text (P1) 🎯 MVP

- [x] T006 [P] [US1] Canonical printer `packages/builder/transforms/src/codec/canonical-json.ts` (+
      test): sorted keys, two-space indent, `\n` endings, slot-array order preserved, absent ≠
      present-empty, byte-identical second print (contract c1, c6)
- [x] T007 [P] [US1] Scoped envelope `packages/builder/transforms/src/codec/scope.ts` (+ test):
      `{envelope: 1, rootId, nodes}` flat descendant map; refuse unknown envelope versions
- [x] T008 [US1] `projectDocument`/`projectScope` in
      `packages/builder/transforms/src/codec/document-codec.ts` (+ test) over T006/T007; export from
      `packages/builder/transforms/src/index.ts`
- [x] T009 [US1] US1 acceptance in `packages/builder/transforms/src/codec/document-codec.test.ts`:
      AC1 full description, AC2 scope narrowing, AC3 projection dispatches nothing (pure function —
      assert no kernel needed), AC4 unprojectable content is explicit, never silently dropped

**Checkpoint**: a document can be faithfully written out, whole or scoped.

## Phase 4: User Story 3 — The representations can never disagree (P1)

US3 precedes US2 deliberately: the parser is written against the proof, not proved afterwards.

- [x] T010 [US3] Strict parser `packages/builder/transforms/src/codec/strict-parse.ts` (+ test):
      duplicate-key rejection (c4), one-based line diagnostics pointing at the offending token (c3),
      total — malformed input returns errors, never throws (c2), own-property/null-prototype lookups
      against `__proto__`/`constructor` keys (research trap 11)
- [x] T011 [US3] `parseDocument`/`parseScope` in
      `packages/builder/transforms/src/codec/document-codec.ts` (+ test): id agreement enforced
      (c5), all-patches-or-all-errors, scope isolation (c7); patches produced against `base` via the
      schema's existing Patch shape; a well-formed text naming an UNREGISTERED block type
      (`CodecPorts.blockExists` false) is `ok:false` with a correct one-based line (analysis C4)
- [x] T012 [US3] Registry-directed arbitraries
      `packages/builder/transforms/src/testing/arbitraries.ts` (+ its own test): blueprint
      generation from a registered vocabulary (allowed child types per slot, capacities, props from
      real block schemas, bindings from declared vocabulary, unicode/edge ids, absent|empty|present
      optional states), blueprint-level shrinking, validation as ASSERTION not filter (research R3)
- [x] T013 [US3] The proof matrix in
      `packages/builder/transforms/src/codec/round-trip.property.test.ts`: pure codec, second-print
      idempotence, NON-VACUOUS edit gate (base ≠ edited ⇒ ≥1 patch and exactly `edited`), key-order
      metamorphism, scope isolation, prefix-truncation invalid-text sweep, field mutants (ids, slot
      order, bindings, breakpoints, `variantOf`, envelope) — 1,000 cases per principal law, seeds
      recorded; fixtures directory `packages/builder/transforms/src/codec/__fixtures__/` for every
      minimised counter-example
- [x] T014 [US3] MUTATION-CHECK the matrix: break the printer's key sorting, the parser's id check,
      and the patch emitter each in the smallest way; confirm the named gate FAILS; restore; record
      the three mutations in this file under Evidence

**Checkpoint**: the round-trip law holds and cannot be satisfied vacuously.

## Phase 5: User Story 2 — Edit the page as text (P1)

- [x] T015 [P] [US2] Worker protocol `packages/builder/extensions/code-view/src/worker/protocol.ts`
      (+ test): discriminated request/response with `requestId`, `generation` (increments on INPUT),
      `baseRevision`, `scope`, `projectionId`; serializable-only (w1)
- [x] T016 [P] [US2] Worker entry
      `packages/builder/extensions/code-view/src/worker/transform-worker.ts`: imports transforms
      DOWNWARD, resolves projection by id locally, functions never cross (w1)
- [x] T017 [US2] Client `packages/builder/extensions/code-view/src/worker/client.ts` (+ test):
      `WorkerLike` injection, one in-flight + one coalesced latest, stale drop counted (w2),
      document crosses once per revision (w4), error/messageerror/termination reject every pending
      request exactly once and listeners return to zero (w6)
- [x] T018 [US2] `CodeViewPanel` —
      `packages/builder/extensions/code-view/src/CodeViewPanel/CodeViewPanel.tsx`: labelled
      textarea, `aria-invalid`, stable `aria-describedby`, debounce, dirty draft pinned to
      `{scope, baseRevision}` with conflict state (p4), apply = ONE kernel dispatch (p1), door
      refusals surface control-adjacent (p5), invalid text changes nothing (p2); a CLEAN draft
      re-projects when the selection or the document revision changes — only a dirty one pins
      (analysis C2, spec FR-011 + edge case 8)
- [x] T019 [US2] `CodeViewPanel` remaining contract artifacts: `index.ts` export,
      `CodeViewPanel.stories.tsx` (clean/typing/invalid/conflict/busy/RTL + play asserting one
      transaction per apply), `CodeViewPanel.docs.mdx` (purpose, round-trip law, why a textarea,
      known limits), `CodeViewPanel.test.tsx` (behaviour + a11y: applies once, never on invalid,
      debounce counted, conflict never retargets)
- [x] T020 [P] [US2] `CodeViewErrors` —
      `packages/builder/extensions/code-view/src/CodeViewErrors/CodeViewErrors.tsx` + `index.ts` +
      `CodeViewErrors.stories.tsx` (none/one/many/RTL) + `CodeViewErrors.docs.mdx` +
      `CodeViewErrors.test.tsx`: list semantics, choosing an error focuses the textarea and selects
      that line via `setSelectionRange`, ONE settled announcement per parse (p6)
- [x] T021 [US2] Manifest `packages/builder/extensions/code-view/src/index.ts`: ONE lazy panel
      contribution + ONE projection contribution (`canonical-json`), loader counted; containment
      test `packages/builder/extensions/code-view/src/containment.test.ts` mirroring the richtext
      containment suite
- [x] T022 [US2] US2 acceptance in the panel test: AC0 open → read → scroll → close records
      transactions +0 at the PANEL level (analysis C1, FR-012), AC1 invalid → unchanged + line-named
      error, AC2 valid → canvas updates + history +1, AC3 one undo restores exactly, AC4 burst → ≤1
      change, AC5 door refusal surfaces with reason

**Checkpoint**: text edits land as single, undoable transactions; invalid text is inert.

## Phase 6: User Story 4 — Responsive, and pay-per-use (P2)

- [x] T023 [US4] Counted off-thread gate: render-path instrumentation proving projection/parse
      invocations on the rendering path = 0 during a typing burst (SC-005), in
      `packages/builder/extensions/code-view/src/worker/client.test.ts`
- [x] T024 [US4] Out-of-order resolution gate (research trap 3): fake worker resolves N+1 before N ⇒
      exactly one application, final state N+1
- [x] T025 [US4] Loader containment gate (SC-006): dynamic-import count 0 unopened / 1 on first
      open, in `packages/builder/extensions/code-view/src/containment.test.ts`
- [x] T026 [US4] Large-document transfer gate (research trap 6): counted document snapshots/message
      bytes on the 1,000-node stress document — document once per revision, text per debounce;
      include one ENORMOUS single paste (spec edge case 2, analysis C5): exactly one coalesced
      request, no per-keystroke amplification

## Phase 7: Integration, browser truth & delivery gates

- [x] T027 Preset surface additions in `packages/builder/editor/src/index.ts` +
      `packages/builder/editor/src/surface.test.ts` (follow the B3c precedent: components and
      app-facing types yes, imperative plumbing no)
- [x] T028 Playground scenario 10 in `apps/playground/src/features/preview/` per existing scenario
      conventions: select → open code view → edit → apply → undo with the Law-S transaction counter
- [x] T029 Browser truth (coordinator-owned, non-delegable) in
      `packages/builder/extensions/code-view/src/CodeViewPanel/CodeViewPanel.stories.tsx` +
      canvas-level story: the REAL module worker runs in Chromium; real Tab/Escape traversal;
      invalid typing leaves the canvas visibly unchanged; one apply + one undo (B3c §19 law); open
      an INLINE edit then the code view and assert exactly ONE active editing surface and zero
      unintended transactions (analysis C3, spec edge case 7, research trap 13)
- [x] T030 [P] Docs coherence: `packages/builder/transforms/README.md`, code-view README section,
      contract §-references from the adapted files
- [x] T031 Boundary negatives per quickstart §7: shell→transforms fails `check:workspace`,
      extension→extension fails, missing component artifact fails `check:components` — observe each
      failure, restore, record here — **T031 record (2026-08-28)**: extension→extension coupling
      flagged `BUILDER_EXTENSION_COUPLING` ✓; missing artifact flags `MISSING_COMPONENT_ARTIFACT` ✓
      — but only after CLOSING a discovery gap: `check:components` scanned only `src/components/`,
      so extension components directly under `src/` (richtext since B3b, code-view) were ungoverned;
      discovery now also scans package `src/` roots (governed count 40 → 44, all pass), pinned by a
      durable workspace-tools test. The shell→transforms negative was MIS-SPECIFIED: 3→2 is
      layer-legal (like shell→renderer); quickstart §7 corrected to an upward 2→3 negative and notes
      SC-005's static import gate as the real render-path protection (mutation-proved). Browser
      truth: full Chromium suite 152/152 incl. RealModuleWorker (real thread placement, paste→1
      transaction, invalid→aria-invalid+unchanged, real Tab focus exit). The Chromium road also
      exposed `documentPatches` returning a ROOT-replace patch (satisfying the non-vacuous gate
      vacuously); fixed node-granular, named regression added, root-replace mutation kills it.
- [x] T032 Evidence run per quickstart: narrow → package gates → Storybook → full
      `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify`; record counts here — **T032 record
      (2026-08-28)**: the gate exposed two flakes that pass in isolation and fail under
      full-workspace load — `@craftkit/ui` and `@craftkit/builder-react`, neither touched by B4.
      Cause: the first test in a file absorbs jsdom + userEvent warmup on a CPU shared with a dozen
      vitest workers and a Chromium suite, and vitest's 5s default is a unit-test budget, not a
      full-gate one. Fixed once in the SHARED config (`packages/test-config/src/react.mjs`,
      `testTimeout: 30_000`, playground precedent) rather than per package; a genuine hang still
      fails, later.

## Phase 8: Close-out

- [x] T033 Two INDEPENDENT reviews with different lenses (correctness+laws; a11y/RTL/perf/
      boundaries) — the B3c lesson in MEMORY.md; fix accepted findings with mutation-checked
      regressions. **Record below.**

### T033 record (2026-08-28)

Both reviews ran on `gpt-5.6-sol`, read-only, in fresh sessions. **Both refused to merge.** Reviewer
1 (correctness + laws): 7 findings, 3 HIGH. Reviewer 2 (a11y/RTL/perf/boundaries): 10 findings, 4
HIGH. Seventeen findings in a suite that was entirely GREEN across nine packages and 152 Chromium
tests — the B3c lesson held exactly. Four were in the coordinator's own work, including a VACUOUS
focus assertion in the story labelled "browser truth": `not.toHaveFocus()` passes when focus falls
to `<body>`, which is the defect a focus gate exists to catch.

Reviewer 2's sandbox could not start vitest or Chromium (Vite was denied a temp directory). It said
so rather than claiming runs, and its findings are source-derived; every one was re-verified here
before being accepted.

**Coordinator-fixed, each mutation-checked** (mutation named, test failed, restored, green):

- Worker plumbing off the PRODUCTION surface: `createLoopbackWorkerLike` and
  `createTransformWorkerClient` moved to `@craftkit/builder-code-view/testing` and
  `@craftkit/builder/testing`, so `worker/client.ts` and `protocol.ts` leave every unopened
  consumer's initial module graph. Static gate in `containment.test.ts`: the entry may reach
  `./worker` dynamically or as types only. Mutation = re-export the loopback.
- `ProjectionDef.parse` now receives `ProjectionPorts` from the caller (contract §4.6). It had been
  inferring vocabulary from the base document, so a REGISTERED type the document had not used yet
  was refused. Mutation = restore document-inferred ports.
- `CanvasInlineEditHandle` on the editable canvas (contract §4.7): the host ends a live inline
  session before opening the code view, so exactly one editing surface exists. Proven for the
  built-in rich surface AND a contributed editor in jsdom, and end-to-end in Chromium
  (`OneEditingSurface`) where the action bar can actually anchor. Mutation = drop the `end()` call;
  the Chromium gate fails.
- Keyboard exit (contract §4.8): ONE control across both states with `aria-expanded` instead of
  swapping the trigger for a status span, which destroyed the focused node; plus Escape. Focus
  destinations asserted EXACTLY, in jsdom and Chromium. Mutation = drop the focus return.
- Unmounting DURING the lazy open no longer strands the adapter and worker the resumed continuation
  creates; counted in live store subscriptions. Mutation = drop the mounted guard.
- The `RealModuleWorker` focus gate now names every destination and walks out of the panel, failing
  on `<body>` at any step.

**Delegated in parallel with path-disjoint leases**, every mutation RE-RUN by the coordinator rather
than taken on report: stale-baseline pin moved to `projectedTarget`, so a stale draft conflicts
instead of silently reverting an external edit; a per-revision payload cache (three parses on one
revision serialize the document once); conflict announced once on entry and focus returned exactly
to the textarea after discard; the error list carries a stable id inside `aria-describedby` exactly
while errors exist; panel chrome inherits the HOST direction while the JSON textarea stays LTR; the
worker client dedupes by revision AND payload, failing closed on a collision; adapter revisions
advance only on document-identity or vocabulary change, with registry events subscribed.

**One defect existed only at the SEAM between two independently-correct fixes**, and no single lease
could see it. The client now fails closed when one revision arrives with two payloads, while every
reopen of the code view builds a FRESH adapter whose counter restarted at 0 — so reopening after an
edit offered revision 0 twice with different documents and killed the shared worker. Found by
writing the close/reopen integration test after both fixes landed. Fixed by making adapter revisions
GLOBAL: a revision identifies a document state, not an adapter's age. Mutation = restore the
per-adapter counter; only that integration test fails. This is the argument for integrating and
re-testing rather than merging green leases.

One Chromium story then failed HONESTLY and was resequenced, not weakened: after an applied edit the
panel re-projects, and typing before that lands is a CONFLICT by law p4, not a parse error. The
story now waits for the panel's own settled state before typing invalid text.

**The deepest finding — two holes of one shape** (contract §4.9). Reviewer 1's depth finding was an
instance, not a one-off: any document the kernel ACCEPTS whose projection parses into patches the
kernel REFUSES makes the round-trip law false. Two existed.

1. Depth: `MAX_JSON_DEPTH = 128` is now enforced in the Law-J walk; the scanner keeps 256 as an
   unreachable parser margin; the generators reach the limit exactly.
2. Reserved keys: `__proto__`, `constructor` and `prototype` were legal as node ids and prop keys
   while the patch door refused them as path segments — Law J and `doc/reserved-node-id` now refuse
   them, so read and write agree.

Mutations: raise the depth limit above the scanner ceiling and two named gates fail; disable either
reserved-key guard and the two new schema gates fail. Those schema gates were added BECAUSE the
first mutation left the schema suite green while only transforms caught it — a law must be guarded
where it lives. `fast-check` biases string generation toward prototype-poisoning words, so
`nodeIdArbitrary` produced `constructor` on its own the moment reserved ids became invalid, and the
generated-document validity ASSERTION caught it. That is what validation-as-assertion is for.

**Delegation notes.** The depth job reported honestly that it could not certify the literal "any
route" claim because two cases needed core edits; the coordinator closed both. The trusted
`createBuilder({ document })` constructor is the documented trust boundary — every untrusted route,
`openDocument` included, validates — and the reserved-key asymmetry became the second hole above.
Two of three delegated jobs stalled for an hour without a single write, were cancelled, and were
re-cut into smaller leases; the re-cut jobs reached verification in eleven minutes.

- [x] T034 /speckit-converge (append-only; a MUTATION check on at least one recorded fix) —
      **Outcome `tasks_appended`**: 13 FR, 8 SC, 15 acceptance scenarios and 8 edge cases checked
      against the code; 0 missing, 0 contradicting, 0 unrequested. The only three findings were
      documentation drift the review round itself created — the code moved and three documents did
      not — appended as T037–T039 (Phase 9) and completed immediately. **Mutation check
      (coordinator-run, on a recorded fix)**: reverted the stale-baseline pin in `CodeViewPanel.tsx`
      from `current.pin ?? current.projectedTarget` back to `current.pin ?? currentTarget`. The
      named gate
      `p4 stale-baseline regression: an R1 draft typed after an R2 external edit conflicts without     reverting R2`
      FAILED (1 failed | 24 passed); restored; 25 passed. The record is not a claim — the guard is
      alive.
- [x] T035 /speckit-workspace-handoff (HANDOFF/context/MEMORY refresh)
- [ ] T036 /speckit-workspace-commit proposal ONLY — commit authorization remains withheld

## Dependencies

```text
T001 → T002 → (T003 ∥ T004) → T005 →
US1: (T006 ∥ T007) → T008 → T009 →
US3: T010 → T011 → T012 → T013 → T014 →
US2: (T015 ∥ T016) → T017 → T018 → T019; T020 [P]; → T021 → T022 →
US4: T023 → T024 → T025 → T026 →
T027 → T028 → T029; T030 [P]; T031 → T032 → T033 → T034 → T035 → T036
```

## Parallel opportunities

- T003 ∥ T004 (schema files, disjoint)
- T006 ∥ T007 (printer vs envelope)
- T015 ∥ T016 (protocol vs worker entry)
- T020 in parallel with T018/T019 (separate component folder)
- T030 in parallel with T028/T029 (docs vs playground/stories)
- Delegation leases: transforms package / code-view worker / code-view components are path-disjoint
  and may go to separate workers; T005 (cross-package typecheck ripple) and T029 (browser truth)
  stay with the coordinator

## Implementation strategy

MVP = Phases 1–4 (projection + the proof): after T014 the law is enforceable even with no UI. US3
sits BEFORE US2 so the parser is written against the property gates from its first line — the B3c
lesson was that green tests written after the fact certify intent, not truth.

### Evidence — coordinator's independent mutation checks (2026-08-28)

The workers reported their own mutation checks; these are the coordinator's, run separately on the
delivered code. A test that does not fail when its behaviour breaks is not a guard.

| Mutation                                       | Named tests it killed                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| removed canonical key sorting                  | `sorts every object level…`, `preserves slot-array order…`, `key-order metamorphism (1000 cases)` |
| made the parser vacuous (`patches: []` always) | 6 gates including `pure codec (1000 cases)` and `second-print idempotence (1000 cases)`           |
| disabled node-id ↔ map-key agreement           | `rejects an id that disagrees with its node-map key…`, `change id is detected…`                   |

Gates at this point: transforms 98 tests (cov 90.8/88.3/98.9/90.6), code-view 19 tests, schema 115,
core 95 — typecheck and lint clean in every package.

## Phase 9: Convergence

- [x] T037 Bring `specs/workspace/011-builder-b4-transforms-code-view/data-model.md` into agreement
      with contracts §4.6 and §4.9: record `MAX_JSON_DEPTH = 128` and the reserved-key refusal
      (`doc/reserved-node-id`, Law J `reserved-key`) as document-validity rules, and show
      `ProjectionDef.parse` with its `ProjectionPorts` parameter per `plan: Law J` (partial)
- [x] T038 Refresh `packages/builder/transforms/README.md` for the depth and reserved-key laws, and
      either add `packages/builder/extensions/code-view/README.md` or record the decision not to
      (richtext sets a no-README precedent) per T030 (partial)
- [x] T039 Record in `contracts/builder-transforms.md` §1 which gate discharges US1/AC4 — canonical
      JSON carries every field, so "nothing is silently omitted" is exactly what the round-trip law
      proves — per US1/AC4 (partial)
