# Active Work Handoff

## Current continuation — baseline repair, 2026-10-10

Requested baseline repair: **idle / locally verified**. BQ-001..003 / T160..164 are complete.
Overall feature 014 production release remains open. Preserve the staged user baseline and all
unstaged chat/repair work; do not reset, bulk-stage, commit, push or deploy.

### Delivered and verified

- `builder-shell` InspectorPartPanel's MDX now formats the header placeholder as literal code;
  the full configured Storybook catalog indexes/builds successfully, without configuration changes.
- `builder-custom-code` ScriptParamsForm has its four missing artifacts (local export, typed
  stories, attached MDX, behavior tests), missing stylesheet and local deterministic fixture.
  Three old lint errors were repaired equivalently. No product wiring or root API expansion.
- Source semantics remain stored overrides vs preview callbacks vs one gesture commit. The story
  models committed host values with React state rather than unsupported portable `useArgs`
  re-rendering; reset interaction remains repeatable. Existing render-helper exception is owned and
  bounded in the plan: extract before production wiring/substantial new form behavior work.
- Custom-code 14 files / 180 tests, selected Inspector 16 tests and original-config Chromium 16
  story/a11y tests passed. Custom-code lint/types, changed-form format, diff whitespace, full static
  Storybook rebuild (5172 modules / 2268 index entries), component221/workspace36/boundary contracts
  passed. Fresh read-only review independently passed18 form tests and rechecked the story repair;
  no actionable findings remain. Scoped BQ convergence found no additional unbuilt requirement.

Evidence: `specs/workspace/014-professional-builder-agent/verification-baseline-quality-2026-10-10.md`.
The earlier chat report now links this resolution while retaining its original evidence.

### Remaining limits and next work

There is no remaining requested repair task. Existing bundle warnings and previous renderer
all-packs budget debt remain separate; no threshold was raised. Full verify/coverage/catalog browser
matrix, Firefox/WebKit, real mobile pickers/manual screen readers and live model quality/cost were
not run. A mistakenly broad shell test command timed out two DesignSystemPanel tests and was stopped
(exit130), not passed; the corrected direct Inspector suite passed. Initial sandboxed browser runs
could not bind IPv6; final browser run used approved local-listener permission with no source/config
workaround. First interactive fixture failures were repaired and rerun successfully.

ScriptParamsForm remains dormant, not integrated into Inspector/Studio. On a newly authorized
feature continuation, inspect T045/T122 preview feedback and source-agent adapters; do not assume
provider-call or external-write authorization. Preserve prior chat worker defaults and source-agent
scope. No new persistent server was started, no unknown process was stopped, no dependencies,
paid calls, staging, commits, pushes or deployment. Node24.19.0 / pnpm11.23.0.

## Previous chat increment — 2026-10-10

Current requested increment: **idle / locally verified**. CHAT-001..005 and T154..159 are
complete for the live `apps/playground/src/features/agent` chat. Overall feature 014 production
release remains open. Prior editing/library/Studio/quality work is staged user baseline; this
chat increment is unstaged/untracked. Do not reset, bulk-stage, commit, push or deploy it.

### Delivered chat scope

- Content/viewport-aware scrolling follows only a pinned reader. Wheel, touch and focused-thread
  upward keyboard intent release it. A nonzero history offset survives streaming and hide/reopen;
  Jump to latest resumes following. Composer/viewport resizing keeps the pinned bottom.
- Content-sized writing field, inset focus edge, smaller budgets on short panels, independently
  scrollable clarification/paused-queue content, wrapping controls and bounded two-line titles.
  Existing tokens, Arabic/English, RTL and light/dark are preserved.
- Build-worker choice 1/3/6, default3, reaches real `runAiBuild` and retry/Finish pools. Choice is
  locked during execution; paused queued continuation can use a newly selected limit. Stop prevents
  late application. Single-target edits remain one writer; no universal multi-agent claim.
- New `BuildTaskBoard` reports actual active/queued/drafted/applied/failed rows and maximum capacity,
  retaining ordered validation/application and per-section ownership. It and `WorkerMenu` have
  all five artifacts. Existing EffortMenu story/MDX debt was completed.
- `apps/evals/src/browser/agent-chat.mjs` and the non-production Playground browser fixture provide
  reusable local QA via `pnpm --filter @craftkit/evals test:agent-chat:browser <local-vite-url>`.

Evidence: `specs/workspace/014-professional-builder-agent/verification-agent-chat-2026-10-10.md`.

### Fresh evidence and remaining gates

- 13 scoped Vitest files: 298/298 passed. Real worker gates cover1/3/6, ordered reverse completion,
  locked selection, cancellation, retry pool changes and paused queued builds. Independent review
  passed61 focused tests plus a separate queued-continuation test; final recheck has no findings.
- Nine fresh Chromium variants passed, including narrow/short Arabic full model/effort/code controls,
  reading-position retention, viewport/composer resizing, long input and actual task display.
- Scoped Storybook plays90/90 and scoped static build passed using original preview/config with
  temporary restricted indexing. Repaired the named-combobox query and duplicate attached/automatic
  docs found during verification. Temporary config files were removed, not committed.
- Playground production build/types, changed-source lint/format, diff whitespace, workspace36 members
  and Turbo boundaries3380 files/36 packages passed. These are local checks, not hosted CI.
- Full Storybook build fails at unchanged `InspectorPartPanel.docs.mdx:13` (literal MDX tags).
  Component check still reports four pre-existing ScriptParamsForm artifacts. Prior bundle-budget
  failure is earlier evidence, not freshly rerun. Full coverage/verify, Firefox/WebKit, real mobile
  gestures, live model speed/quality/cost and human ratings remain unverified.

### Next work and recovery

There is no remaining requested chat task. If a subsequent feature continuation is authorized,
start at T045/T122: inspect revision-bound `inspect_preview`, Source Agent request/apply adapters,
then bounded repair/re-inspection. Do not infer paid provider or external-write authorization.
The legacy engine automatic maximum8 and authored default3/max6 scheduler are separate; neither was
rewritten by the new live-panel preference. Generation quality gains require representative output.

Node24.19.0 / pnpm11.23.0. The task-owned Vite server on127.0.0.1:5186 was stopped (exit130);
existing developer servers were untouched. Scoped Storybook output is disposable under
`/private/tmp/craftkit-agent-storybook.Sp0rD7`. No dependencies, paid calls, staging, commits, pushes,
deployment or external writes. No global memory was changed.

## Previous quality increment — 2026-10-10

Active feature: `specs/workspace/014-professional-builder-agent/`. The user wants a world-class
Builder/Agent and approved axe then Embla plus stronger authored design. Their `1+2` clarification
includes interactive React websites and Frontend dashboards/workflows. Generated backends,
authentication, databases and payments remain outside this increment; creative freedom does not
remove file ownership, exact dependency locks or isolated execution.

Status: the QF-001..005 increment is locally verified and T148..153 are checked; the overall feature
and production release remain in progress, not idle or accepted. Prior editing/library/Studio
changes are staged user work. The new increment is unstaged/untracked; never reset or bulk-stage it.

### Completed increment and owning paths

- `apps/evals/src/accessibility/`: real axe scans, bounded findings, full blocking counts, explicit
  failure/manual/empty states; positive/negative Chromium checks.
- `builder-media-engines/src/carousel*`, vendored MIT notice and `scripts/build-carousel-engine.mjs`:
  pinned Embla 8.6.0. Renderer pack/injector/export load it only for interactive carousels; native
  editor markup is preserved. Real React update/removal no longer reparents DOM or throws.
- `builder-editor/src/catalog/`: exact managed admission, default export and lock rejection tests.
  Existing v1 catalog locks stay valid; full content fingerprints change artifacts/caches.
- `builder-ai/src/skills/authored-design.ts`, public wire and `apps/ai-server/src/authored-run.ts`:
  actual cached authored requests get tailored composition, real interaction and honest demo
  guidance. No rigid page formula or additional write authority.
- Architecture/carousel docs and scoped spec/plan/tasks updated. No new production UI component.

Exact evidence and commands:
`specs/workspace/014-professional-builder-agent/verification-quality-frontend-2026-10-10.md`.
Prior local increments have separate `verification-library-editing-2026-10-10.md` and
`verification-element-patterns-2026-10-10.md`; do not present them as fresh full-feature acceptance.

### Verification and unresolved gates

- AI 2, AI-server 6, managed catalog 5, media engines 45 tests passed. Evals Chromium/report tests
  passed 5; Dashboard/workflow fixture is hand-authored, compiled through the actual managed runtime
  at 390/1280 widths × LTR/RTL. It is not a model-quality benchmark.
- Actual exported carousel Chromium QA passed swipe, keyboard, dots, RTL, reduced motion, overflow
  and blocking axe gates without editor services. Independent read-only review has no findings left.
- Renderer scoped run: 72 pass / 1 fail. The unchanged 16,000-byte all-packs growth gate already
  fails staged baseline (18,794); this increment gives 19,198 (+404). Own carousel pack stays below
  4,096; engine asset 8,888/20,000 gzip. Do not raise the global gate to hide the failure.
- TypeScript passed for media engines, AI-server, evals, AI, editor, renderer and Playground.
  Scoped lint, script syntax and diff whitespace passed; Playground/AI-server/evals builds passed.
  Existing placeholder assets, ineffective dynamic imports and large-chunk warnings remain.
- Workspace contract passes 36 members; dry graph succeeds. Component check still finds six
  pre-existing missing artifacts in EffortMenu/ScriptParamsForm; Turbo boundaries still finds two
  generated Storybook `@storybook/blocks` imports. Full verify/coverage/Storybook/Firefox/WebKit/
  manual accessibility/live model/rater evaluation and full review/convergence were not completed.

### First next executable step

Inspect `packages/builder/ai/src/tools/site-tools.ts` (`inspect_preview`),
`apps/playground/src/features/preview/source-agent-session.ts` and
`apps/ai-server/src/authored-run.ts` against T045/T122. Establish current revision-bound inspection
and apply adapters before wiring preview evidence → bounded repair → re-inspection. Axe currently
provides eval evidence only; the Source Agent does not automatically receive these reports.
Then use the existing fixed-corpus/usage/blind-review work (T128..132) for website/dashboard/workflow
outputs. Paid provider runs and actual human raters require explicit approval/availability.

Use package-local binaries on Node 24.19.x/pnpm 11.23.0; React remains 19.2.8. Local browser QA uses
fresh contexts and the existing loopback server; do not kill unknown dev processes or use the user's
browser profile. Temporary budget diagnostics were deleted. No new server needs teardown.
No paid model calls, staging, commits, pushes, deployment or external writes were made.

## Historical handoff — feature 013 (superseded for active work)

**Status:** Feature 013 — the AI full-site design agent — is delivered except for three blocks that
this session cannot finish itself (see **What is NOT done**). 316 of 337 tasks are closed. No
commit, push, deploy, dependency installation, or external mutation was performed or authorized.
**Commit authorization remains withheld.**

**Updated:** 2026-09-07

## What a person can now do

Type one sentence describing a business, in Arabic or English, and get a multi-page site — pages,
sections, copy, a palette, a header and a footer — landed on the live site as **one transaction**
that **one undo** reverses. A run that fails at any stage leaves the site byte-identical, because
nothing writes until the commit.

## The architecture, in four sentences

1. **A site is one kernel.** One store, one dispatcher, one transaction log, one history, one save
   session. `siteKernel.page(pageId)` is a lens satisfying the document `BuilderKernel` interface,
   so every component built for a document works over a site unchanged. Recorded in
   [ADR 0006](../../docs/architecture/decisions/0006-builder-site-model-and-design-tokens.md).
2. **The door is the only writer.** `generateSite` is handed no kernel and returns commands.
   `applySiteCommands` sends them into a DRAFT kernel one at a time — a group cannot read back an id
   minted halfway through it — and `commitGeneratedSite` lands the whole result as a single
   `applySitePatches`.
3. **`DesignSystem` is layer 0.** The schema owns the type, the default, and `validateDesignSystem`,
   which measures contrast and fails closed. The renderer owns only the translation to CSS
   variables.
4. **An image holds an id or a labelled absence.** `ImageProp = AssetRef | { absent, reason }`.
   There is no path that produces an address, because a generated URL satisfies every schema, stores,
   validates, renders, and is a broken image on a stranger's site.

## Delivered blocks

| Block | Tasks | What shipped |
| --- | --- | --- |
| Site core | T001–T031 | `BuilderSite`, `validateSite`, `migrateSite`, `createSiteBuilder`, the page lens, eleven site commands |
| Codec | T032–T047 | `projectSite`/`parseSite`; a page's projection is byte-identical to `projectDocument`'s |
| Five-stage pipeline | T048–T066 | sitemap → structure → content → design system → assembly, validated between each |
| Playground site | T072–T085 | site boot, `SitePages`, `SiteBriefForm`, `SiteBuilderPanel` on its own rail destination |
| Design system | T086–T103 | `DesignSystemPanel`, `TokenSwatchGrid`, tokens at layer 0 |
| Refinement | T104–T111, T113–T114 | resolve → refuse → propose → validate → apply, page and palette |
| Shared regions | T115–T121 | header and footer across pages, one definition |
| Responsive | T122–T128 | container queries, a Chromium overflow gate at 360/768/1024/1440 + RTL |
| Assets | T129–T143 | selection, the labelled-absence union, `AssetPicker`, the local library |
| Docs | T149–T152 | ADR 0006, the architecture docs, five package READMEs |

## What is NOT done, and why

Three items are **blocked on something outside this session**, not unfinished work:

1. **T144–T148 — evaluation and the critic.** The protocol needs **three independent human raters**
   and a live API key. A single agent scoring its own output is not a measurement, so this was left
   open rather than faked.
2. **T305–T307 — token usage and model tiers.** These need `apps/ai-server`, which belongs to the
   peer session **frontend-6d**. Ports 8787 and 5173 are theirs; nothing here starts a server.
3. **T112 — the refinement conversation in `AssistantPanel`.** Left open deliberately, with the
   reason recorded in `tasks.md` at that entry.

Also open: **T294** (persist the assistant mode, and replace one vacuous `followUp` assertion at
`assemble-context.contract.test.ts:337`), and **T153–T158**, the review-and-verify tail this
session is working through.

## Gate state at handoff

```text
pnpm check:workspace     passed, 33 members
pnpm check:components    passed, 133 components
pnpm check:boundaries    passed
pnpm turbo run lint typecheck    61/61, exit 0
```

`pnpm format:check` is clean **except** `apps/ai-server/**` (13 files) and `CLAUDE.md`, which were
deliberately left untouched: the server belongs to the peer session, and reformatting a file another
session is editing loses their work. Whoever owns those should run
`pnpm exec prettier --write apps/ai-server CLAUDE.md`.

## Working method, for whoever picks this up

Two habits produced most of the real findings and should not be dropped:

- **Build a gate that MEASURES, then let it find defects.** The responsive gate found two sections
  overflowing 348px at a 360px viewport; the UX gate found a 67×20 button below the 24px pointer
  minimum; the theme's measurement gate caught a raw `9rem` in new CSS. None of those was visible to
  a green test count.
- **Mutation-test every rule, and delete what survives.** Break the code, watch a NAMED test fail. A
  check no mutation can distinguish from its absence is decoration — the `AssetPicker`'s unmount
  guard was exactly that and was rewritten as the case that IS observable.

Three traps this repository sets, all of which cost time here:

- `pnpm turbo run test` will replay a stale PASS for a gate whose inputs turbo does not track. Use
  `--force` at least once before believing it.
- A vitest run can print `N passed` and exit 1 — unhandled errors inside React's event dispatch are
  reported on an `Errors` line, not as failures. Read the exit code.
- A Storybook story that leaves a promise pending starves every story declared after it in the same
  file, and the failures name the wrong story.

## Environment

- `PATH` must include `$HOME/.nvm/versions/node/v24.19.0/bin` before any pnpm (`engines.node` is
  `>=24.15.0 <25`).
- `rg` is absent (use `grep -rn`), `head` is shadowed (use `sed -n`), `timeout` does not exist, and
  `curl`/`wget` are blocked.
- Peer sessions share this checkout. Run `ListAgents` before touching `apps/ai-server/**` or any
  file another session may be editing, and prefer targeted string replacements over whole-file
  rewrites in `App.tsx`, `AssistantPanel.tsx`, `AssistantHeader/*` and `App.css`.

## Active artifacts

- Feature: `specs/workspace/013-ai-full-site-design-agent`
- Plan: `specs/workspace/013-ai-full-site-design-agent/plan.md`
- Task ledger with per-block evidence: `.../tasks.md`
- Audits written this cycle: `.../responsive-audit.md`, `.../design-audit.md`
- Asset contract: `.../contracts/asset-library.md`
- Public package contracts: `packages/builder/{schema,core,transforms,ai,shell}/README.md`
