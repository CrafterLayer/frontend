# Execution Plan: who does what, and what is left

**Created**: 2026-08-29 · **Feature**: [spec.md](./spec.md) · **Tasks**: [tasks.md](./tasks.md)

The requester asked for the remaining work as a list, split between Claude and Codex, with Codex on
`gpt-5.6-sol`, and for the work to be finished without further back-and-forth. This file is that
split. It is the operational companion to `tasks.md`, which stays the authoritative task list.

---

## The split, and why it falls this way

`boundedrelay-profile.json` scores the two lanes on real capability, and the routing is derived from
it rather than from preference:

| Capability                                                          | Codex | Claude |
| ------------------------------------------------------------------- | ----- | ------ |
| implementation, testing, refactor, debugging, integration, analysis | **4** | 2      |
| planning, architecture, review, security-review, documentation      | 1–2   | **4**  |

So the line is not "Codex does the boring parts". It is:

- **Codex writes**, because it is the stronger implementer and this is where the token cost lives.
  Volume, precision against a written contract, and test suites.
- **Claude decides and integrates**, because the profile puts architecture, review, and
  documentation here — and because the coordinator owns integration under constitution VI regardless
  of who is stronger.

Three things stay with Claude for reasons that are structural, not preference:

1. **Every `index.ts` barrel.** `schema/src/index.ts`, `shell/src/index.ts`, `editor/src/index.ts`.
   Two writers on one barrel is the single collision the router's `SINGLE_WRITER_WAVE` rule exists
   to prevent, and it is cheaper to keep them on one desk than to serialise waves around them.
2. **Every Codex patch is reviewed and re-verified here before it is accepted.** Not ceremony — wave
   1 arrived claiming success with a type error in it, because Codex's sandbox had no network and
   could not run a single check. That will recur on every wave.
3. **Public-API moves across packages**, where a mistake is silent and wide.

### Model policy

Codex runs on the project profile, not on an ad-hoc choice. `codexPolicy.byRisk.critical` resolves
to **`gpt-5.6-sol` at `ultra`**, so layer-0 and cross-package work is marked `critical` and gets
`sol` by policy. `implementation` at lower risk resolves to `gpt-5.6-terra` at `medium`. Marking
work critical to reach `sol` is honest here: a layer-0 schema change is the root of the dependency
graph and invalidates everything downstream.

### The one thing that needs the requester

BoundedRelay proposes from an isolated clone and **refuses to run against a dirty tree**. Every
Codex wave therefore needs a commit first, and the standing project rule is that agents never
commit. That is one interruption per wave.

To honour "I don't want to have to talk about this again", the options are: grant standing commit
authorization for this feature, or batch — Claude works until a natural checkpoint, the requester
commits once, and several Codex waves then run back to back. **Batching is what this plan assumes**,
and the checkpoints are marked below. No other decision is outstanding.

---

## Done and verified

Evidence, not assertion. Every claim below was re-run locally after the patch landed.

| Work                                                                                   | Owner                           | Evidence                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| spec · plan · research · data-model · contracts · quickstart · tasks (158) · checklist | Claude                          | `prettier --check` clean; FR-001–064 contiguous                                                                                                                    |
| Green pre-change baseline                                                              | Claude                          | `PNPM_EXIT=0`, 58 components — [baseline.md](./baseline.md)                                                                                                        |
| **Asset contract** (T018–T020)                                                         | **Codex wave 1** + Claude fixes | `lint 0 · tsc 0 · 6/6`. Codex could run **no** checks (sandbox had no network) and shipped a real `PropertyKey`/`symbol` type error; fixed here, plus a lint error |
| Asset barrel export (part of T021)                                                     | Claude                          | `tsc 0`                                                                                                                                                            |
| **Tailwind v4 foundation**                                                             | Claude                          | 55 generated bindings, drift gate, exhaustiveness gate; playground build emits `.bg-accent{background-color:var(--t-accent)}`                                      |
| Catalog + install of Tailwind/motion/clsx/tailwind-merge                               | Claude                          | `pnpm install` clean, `check:workspace 0`                                                                                                                          |
| **Motion vocabulary** at layer 0                                                       | Claude                          | `lint 0 · tsc 0 · 12/12`                                                                                                                                           |
| Full suite, uncontended                                                                | Claude                          | `turbo run test --concurrency=1 --force` → **exit 0, 24/24**                                                                                                       |
| **Motion extension** `@craftkit/builder-motion`, contained                             | Claude                          | 12/12 tests incl. containment sweep; main bundle unchanged at 600,985 bytes with **zero** engine symbols                                                           |
| Containment rule for the engine, machine-enforced                                      | Claude                          | 4 new validator cases; `test:workspace` 42/42                                                                                                                      |
| Latent validator bug fixed (npm alias smuggling)                                       | Claude                          | `npm:motion@13.1.1` bypassed the matcher because the version was never stripped; found by the alias test                                                           |
| **`pnpm verify` — the whole gate**                                                     | Claude                          | **`VERIFY_EXIT=0`** · 24 members · **59 components**                                                                                                               |

A note worth keeping: the parallel suite failed twice with two _different_ tests, both of which pass
alone, one of them literally named "scales linearly". Those are contention flakes. Wall-clock
budgets belong to uncontended runs, and the serial run is the one that counts.

---

## Remaining work

### Checkpoint A — commit, then Codex waves 2–4

**Claude first** (no commit needed):

- [x] **Token move to layer 0** (T010–T011) — **done**. `ColorToken`, `MeasurementToken`,
      `TokenName`, `Theme`, and `tokenCssName` now live in `builder-schema`; the renderer re-exports
      all of them, and the workspace typechecks unchanged. Two tokens were added along the way
      (`motionDistance`, `motionParallax`) because the coverage gate refused a
      `var(--t-motion-distance, 24px)` no theme defined — it was right
- [x] **Motion CSS baseline** — done. Pure CSS on a `view()` timeline, drift-gated, reduced-motion
      honoured, prettier-shaped output so the drift gate and `format:check` cannot fight
- [ ] Site fixtures (T002) and site arbitraries (T003) — deferred: they need `BuilderSite`, which is
      wave 2's deliverable. Moved to just after wave 2 lands

**Then the requester commits.** Then Codex, in dependency order:

- [ ] **Wave 2 — site model** (T004–T009): `BuilderSite`, `validateSite`, `migrateSite`,
      `siteFromDocument`, the nine validation rules, the page-independence property test. `critical`
      → `gpt-5.6-sol` · write scope `packages/builder/schema/src/site`
- [ ] **Wave 3 — design system + contrast** (T012–T015): `DesignSystem`, `contrastRatio`,
      `validateDesignSystem`. `critical` → `sol` · write scope `packages/builder/schema/src/theme`
- [ ] **Wave 4 — site commands + grouped dispatch** (T023–T031): nine commands with zod arg schemas,
      six refusals, and `dispatchGroup` — the API that makes one generation one undo step.
      `critical` → `sol` · write scope `packages/builder/core/src/commands`

**Claude integrates each**: review the patch, re-run `lint`/`tsc`/`test` locally, wire the barrels,
run `check:workspace`.

### Checkpoint B — commit, then waves 5–7

- [ ] **Wave 5 — site codec + laws** (T032–T038): `projectSite`/`parseSite`, the manifest law at
      1,000 cases, the composition law, the extended non-vacuity gate. `critical` → `sol` · write
      scope `packages/builder/transforms/src/codec`
- [ ] **Wave 6 — code-view scopes** (T039–T045): `site` and `page` scopes, and SC-005 re-proved at
      site scope both statically and by counted invocation. `high` → `terra` · write scope
      `packages/builder/extensions/code-view/src/worker`
- [ ] **Wave 7 — Tailwind migration of the block library**: 66 hand-written stylesheets become
      token-bound utilities. The highest-volume, most mechanical work in the feature and the best
      possible use of the cheaper lane. `medium` → `terra` · write scope
      `packages/builder/extensions/blocks-marketing/src`

**Claude in parallel** (different packages, no collision):

- [x] **Motion extension** `packages/builder/extensions/motion` — **done**. Contained, dynamic front
      door, containment proven at the bundle level
- [ ] Renderer resolves the theme from site data (T016–T017)

### Checkpoint C — commit, then waves 8–10

- [ ] **Wave 8 — the five pipeline stages + offline provider** (T048–T057). The largest single body
      of code in the feature. `critical` → `sol` · write scope `packages/builder/ai/src/pipeline`
- [ ] **Wave 9 — orchestration + its test suite** (T058–T066): ordering, atomicity, cancellation,
      seed determinism, bounds, the door test. `critical` → `sol`
- [ ] **Wave 10 — refinement** (T104–T114): target resolution first, isolation, one undo step.
      `critical` → `sol` · write scope `packages/builder/ai/src/refine`

**Claude**: the six UI component contracts (T067–T082, T092–T102, T137–T142). Six components × five
artifacts each. Design judgment, accessibility semantics, and focus behaviour do not delegate well,
and `check:components` must go 58 → 64.

### Checkpoint D — the rest

- [ ] Responsive coverage across every section (T122–T128) — **Codex**, `terra`
- [ ] Asset selection + structural rejection of invented references (T129–T136) — **Codex**, `terra`
- [ ] Scroll-effect rendering, reduced-motion handling — **Claude** (design)
- [ ] Playground composition, `SiteBriefForm` (T078–T085) — **Claude**
- [ ] Evaluation harness (T144–T148) — **Claude** designs; **the requester** supplies raters and a
      competitor account. This one cannot be self-certified and will not be claimed as done
- [ ] ADR 0006, docs, README updates (T149–T152) — **Claude**
- [ ] Final review, `speckit-converge`, handoff, commit-message proposal (T153–T158) — **Claude**

---

## New work the original 158 tasks do not cover

Tailwind and motion arrived after `tasks.md` was written. These are additions, tracked here until
`/speckit-tasks` is re-run:

- [x] Catalog entries and install — Claude
- [x] Token bridge + drift gate + exhaustiveness gate — Claude
- [x] Preset and renderer CSS doors respecting ADR 0003 — Claude
- [x] Motion vocabulary at layer 0 — Claude
- [x] Motion extension with containment proof — Claude
- [ ] Block library migration to utilities — Codex wave 7
- [ ] Editor chrome on Tailwind — Codex
- [x] Storybook Tailwind wiring so stories render as pages do — Claude
- [ ] Scroll-effect rendering — Claude
- [x] Motion inspector field so a person can set it by hand — Claude
- [ ] `check:workspace` rule containing `motion` to its extension, mirroring the tiptap rule —
      Claude

---

## What "professional" means here, concretely

The requester asked for complete work rather than something patched together. Four commitments, each
of which is checkable rather than a promise:

1. **Nothing is claimed done without evidence.** Wave 1 shipped broken and was caught because the
   checks were re-run rather than trusted. That is the standing procedure, not a one-off.
2. **No literal ever enters a document.** Not a colour, not a pixel, not a class string, not a
   millisecond. It is the one invariant that keeps a theme edit able to move every page.
3. **Every new UI component ships all five artifacts.** `check:components` is the gate, and it fails
   on a missing story or doc.
4. **The competitive claim stays unproven until people prove it.** SC-004 and SC-006 need human
   raters. No amount of green tests substitutes, and this file will not pretend otherwise.
