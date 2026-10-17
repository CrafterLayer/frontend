# Verification: GenerationProgress (T067–T071)

**Feature**: [spec.md](./spec.md) · **Tasks**: T067–T071 · **Date**: 2026-09-01

The first US1 surface: the five-stage pipeline made observable. This record separates what was
proved from what was merely run, and names one repository defect that blocks a gate for reasons
unrelated to this slice.

## Checklist reconciliation (read this before trusting the counts)

The handoff warned that early checkboxes had drifted from source. They have. Parsing all 211 tasks
and resolving every backtick-quoted path against the working tree:

| Bucket                                  | Count | Meaning                                                                                                                                 |
| --------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Unchecked, but every target file exists | 41    | stale checkbox candidates — T004–T021, T025, T030, T037, T039–T046, T066, T077, T083–T091, T102, T112–T113, T116, T135–T136, T142, T152 |
| Unchecked, targets genuinely absent     | 94    | the real remaining work                                                                                                                 |
| Unchecked, partial                      | 2     |                                                                                                                                         |
| Unchecked, no path in the task text     | 21    | gates and audits                                                                                                                        |

**Those 41 were not marked complete here.** File existence is not acceptance: proving them would
mean re-deriving each task's criteria against its tests, which this slice did not do. The count
below moves only by the five tasks actually built and verified.

Tasks complete: **58 / 211** (was 53).

## What was built

`packages/builder/shell/src/components/GenerationProgress/` — component, `constants.ts`, CSS,
stories, docs, tests, local export; re-exported from `packages/builder/shell/src/index.ts`.

The stage **id** is the pipeline's wire vocabulary and the **label** is what a person reads
(`sitemap`→Plan, `structure`→Structure, `content`→Content, `design`→Design, `assembly`→Apply), so
renaming a stage in the UI cannot rename a wire field.

## Red/green and mutation evidence

The suite passed on first run, which is not by itself evidence. Five mutations were applied to
confirm the assertions bite. Each was reverted and the baseline re-confirmed green.

```text
M1  stage label 'Apply' → 'Finish'              Tests  2 failed | 8 passed
M2  drop aria-live="polite"                     Tests  1 failed | 9 passed
M3  cancel renders regardless of running state  Tests  1 failed | 9 passed
M4  hard-coded #ff0000 in the stylesheet        Tests  1 failed | 9 passed
M5  canvas token var(--t-accent) in chrome      Tests  1 failed | 9 passed
restored baseline                               Tests 10 passed (10)
```

M4 and M5 guard the rule that matters most here: chrome reads `--bldr-*` and never `--t-*`. A
builder that read canvas tokens would repaint its own progress card whenever the edited site was
re-themed.

## Behaviours proved

- Region named, five stages listed in pipeline order.
- Status carried by a **word** in every row (`Done`, `Active`, `Failed`, `Cancelled`), never colour
  or icon alone.
- One `role="status"` / `aria-live="polite"` line announcing `Stage N of M`, completion, failure
  with its reason, and cancellation as distinct from failure.
- Cancel reachable by <kbd>Tab</kbd>, fires on <kbd>Enter</kbd>, withdrawn once nothing runs.
- **Focus never moves** — asserted on mount and across a stage advance, by `document.body`, not by
  `not.toHaveFocus()`.

## Gates run

```text
pnpm --filter @craftkit/builder-shell lint        clean (0 errors, 0 warnings)
pnpm --filter @craftkit/builder-shell typecheck   clean
pnpm --filter @craftkit/builder-shell test        44 files, 723 tests passed
pnpm typecheck                                    26/26 tasks successful
pnpm lint                                         27/27 tasks successful
pnpm test                                         24/29 tasks successful (see below)
pnpm check:components                             passed, 102 components
pnpm check:workspace                              passed, 29 members
pnpm check:boundaries                             1069 files, 29 packages, no issues
git diff --check                                  clean
prettier --write                                  applied
```

## Pre-existing defect blocking the Storybook gate — NOT from this slice

`pnpm test:storybook` fails at index time:

```text
IndexingError: You created a component docs page for 'Builder/Shadcn/Tabs',
but also tagged the CSF file with 'autodocs'. This is probably a mistake.
```

Proved pre-existing: stashing this slice's files and re-running reproduces the identical error. The
cause is repo-wide — **34** story files carry `tags: ['autodocs']` _and_ a sibling `.docs.mdx`
containing `<Meta of={…}>`. Storybook reports only the first it reaches.

Affected packages: `builder-shell` (Palette, MotionField), `magicui` (5), `blocks-marketing` (9),
`shadcn` (12), `motion` (1), `primitives` (2), `aceternity` (3).

It was **not repaired here**: the fix touches 34 files across seven packages that this slice holds
no lease on. The uniform repair is to drop the redundant `tags: ['autodocs']` wherever an explicit
`.docs.mdx` exists, since Constitution III makes the written docs page authoritative.

Consequence for this slice: the `CancelIsKeyboardReachable` play interaction could not be executed
in Chromium. The identical behaviour — tab to cancel, press <kbd>Enter</kbd>, assert `onCancel`
called exactly once — is covered by the passing unit test, so the behaviour is proved; only the
redundant browser path is blocked.

## Live provider outage, fixed and verified

The Assistant reported `Failed to fetch · network · provider`. Two independent causes:

1. `VITE_AI_PLAN_ENDPOINT=http://localhost:8787/plan` with **nothing listening on 8787** — the dev
   bridge was never started.
2. `VITE_AI_PLAN_TOKEN` absent from `apps/playground/.env.local`, so every request would have been
   rejected `401` even once the bridge was up.

Both fixed. `AI_BRIDGE_ALLOWED_ORIGINS` was widened to include `:5174`, because Vite is listening on
both `5173` and `5174` and the default allowlist carries only `5173`.

```text
GET  /health                      http=200
POST /plan  (no auth)             http=401
OPTIONS /plan  Origin :5174       204, access-control-allow-origin: http://localhost:5174
POST /plan  (wire v1, authed)     http=200 in 6.4s
  {"version":1,"refusal":"The editor context registers no commands or block types…"}
```

The refusal is correct for that probe: it carried no registry. The real Playground sends the full
catalog.

## Not done

`GenerationProgress` is presentational and currently has nothing to drive it — the pipeline it
displays (T048–T066, `packages/builder/ai/src/pipeline/`) does not exist yet. The component is
proved against its own contract, not against a live run.

---

# Addendum: Design System contract (T012–T015)

**Date**: 2026-09-01 · Step 1 of the critical path.

The first of three foundations the pipeline stands on. Stage 4 must emit a `DesignSystem` that
passes `validateDesignSystem()`, so without this the design stage cannot be built at all.

## What was built

- `packages/builder/schema/src/theme/design-system.ts` — the `DesignSystem`, `DesignPairing`, and
  `DesignTypography` contracts, plus the token vocabulary **at runtime**.
- `packages/builder/schema/src/theme/validate.ts` — the FR-014 gate.
- `packages/builder/schema/src/theme/validate.test.ts` — 32 tests (20 new).
- Exported from `theme/index.ts` and the package root.

`contrastRatio()` (T013) already existed and is exercised by these tests; marked complete on
inspection, not rewritten.

## The runtime-vocabulary problem, and how drift is prevented

`tokens.ts` states the vocabulary as TYPES, which vanish at build — so a validator required to
reject an unknown token key had nothing to check against, and no runtime list existed anywhere.

A hand-copied array would be a second source of truth. Instead the lists derive from maps declared
`as const satisfies Record<ColorToken, true>` / `Record<MeasurementToken, true>`. TypeScript fails
the build if a name is **missing** and fails it again if an **extra** name appears. 9 colours, 58
measurements, 67 total — asserted at runtime too.

## Mutation evidence

Nine mutations, each observed failing before the source was restored. Baseline green after each.

```text
M1  unmeasurable contrast treated as a pass    1 failed | 31 passed
M2  unknown token keys accepted                1 failed | 31 passed
M3  a fixed 4.5 reported regardless of size    1 failed | 31 passed
M4  measurement token accepted as a colour     1 failed | 31 passed
M5  only the first failing pairing reported    1 failed | 31 passed
M6  measured ratio replaced by a constant      1 failed | 31 passed
M7  missing-token check removed                1 failed | 31 passed
M8  caller's tokens object returned by alias   1 failed | 31 passed
M9  caller's pairing objects returned by alias 1 failed | 31 passed
baseline                                       32 passed (32)
```

**Three of these were found by mutation, not by review**, and each exposed a real defect:

- **M3 survived the first sweep.** A local `minimumFor(size)` sat beside `checkContrast`, which
  already resolves the same minimum internally. Changing the local copy moved the _reported_
  threshold while the _enforced_ one stayed put — the validator could have said "below the 4.5:1
  required" having tested against 3:1. The duplicate was deleted; every number in a message now
  comes from the measurement that produced the verdict.
- **M6 and M8 survived too.** No test pinned the reported ratio, and the "does not mutate its input"
  test did not cover the opposite hazard: a result that _aliases_ the caller's objects, so a later
  edit on their side silently rewrites a system that already passed the gate. Both are now covered,
  and the validator collects proved pairings as it goes rather than casting at the return.

## The fail-closed rule

`checkContrast` returns `undefined` when a colour cannot be parsed. The tempting reading is "no
problem found"; it is the opposite — the rule could not be applied. That path raises
`contrast-unmeasurable` and fails. M1 is the test that keeps it that way.

## Gates

```text
pnpm --filter @craftkit/builder-schema lint        clean
pnpm --filter @craftkit/builder-schema typecheck   clean
pnpm --filter @craftkit/builder-schema test        21 files, 219 tests passed
pnpm typecheck                                     26/26
pnpm lint                                          27/27
pnpm test                                          only @craftkit/storybook fails (pre-existing)
pnpm check:workspace                               29 members
pnpm check:boundaries                              1,075 files, 29 packages, no issues
pnpm check:components                              102 components
git diff --check                                   clean
```

One full-suite run showed `@craftkit/builder-core#test` failing under turbo's parallel execution. It
passes in isolation (14 files, 123 tests) and passed on the immediate re-run, so it is recorded here
as observed flakiness, not a regression from this change.

Tasks complete: **62 / 211**. Next on the critical path: T023–T029, site commands and
`dispatchGroup`.

---

# Addendum: Grouped dispatch verified (T027–T029)

**Date**: 2026-09-01 · Step 2 of the critical path — and mostly already built.

## A false negative in the earlier audit

The audit in the first section resolved each task's backtick-quoted paths against the working tree
and called T027–T029 missing. They are not. The tasks name
`packages/builder/core/src/commands/dispatch-group.ts` and `dispatch-group.test.ts`; the work landed
in `dispatch.ts` and `group-dispatch.test.ts` (note the reversed name) during US8 T172.

**So the "94 genuinely missing" figure is an overcount.** A path-based audit cannot see work that
landed at a different path than its task named. Treat 94 as an upper bound, not a count.

`dispatchGroup` was already implemented with 9 tests covering all-or-nothing application, one
transaction, one undo restoring the exact document, mid-group failure leaving document/log/history
untouched, unknown-command and bad-arg rejection before any write, label bounds, and runtime-author
validation. T027 and T028 are marked complete on that evidence, not rewritten.

## What this slice actually added: T029

The uSES ordering (003 contract §15) had no test on the GROUPED door. `commit()` orders `log.append`
→ `history.record` → `store.write`, and the comment explains why, but nothing pinned it for
`dispatchGroup`.

The failure mode is why it matters: `store.write` is the observable moment, and
`useSyncExternalStore` reads its snapshot **synchronously inside the notification**. A subscriber
deriving from the log — `transactions().length` is the real case — must already see the transaction
by then. Record after notifying and the change-check bails out, leaving the view one event behind
**forever**; nothing later re-notifies to repair it.

The new test subscribes through `kernel.context.store`, dispatches a three-step group, and asserts
that inside the first notification the log, the history, and the document already agree.

Mutation: `commit()` reordered so `store.write` runs before `log.append`/`history.record`.

```text
baseline                                   30 passed (30)
notify before recording (007 regression)   1 failed | 29 passed
restored                                   30 passed (30)
```

## Gates

```text
pnpm --filter @craftkit/builder-core lint       clean
pnpm --filter @craftkit/builder-core typecheck  clean
pnpm --filter @craftkit/builder-core test       14 files, 124 tests passed
turbo run test --concurrency=1                  28/29 (only @craftkit/storybook, pre-existing)
turbo run lint --concurrency=1                  27/27
pnpm check:workspace / boundaries / components  passed
git diff --check                                clean
```

## Parallel-run flakiness, now measured rather than assumed

Full-suite runs under turbo's default parallelism intermittently failed
`@craftkit/builder-core#test` (twice) and `@craftkit/playground#lint` (once). Each passes in
isolation. Re-running both gates with `--concurrency=1` was clean apart from the known Storybook
defect, which identifies the cause as resource contention on this machine, not a regression.

Practical consequence: `pnpm verify` will fail intermittently here for reasons unrelated to the
code. Prefer `--concurrency=1` when a run's result is being used as evidence.

## Blocked: T023–T026 need an unlisted prerequisite

The site commands (`addPage`, `removePage`, `setDesignSystem`, `registerAsset`, …) are specified in
`contracts/site-model.md` §2 as ordinary kernel commands "dispatched through the same door", which
means they mutate the draft. **But the kernel is document-only.** `BuilderSite` appears nowhere
outside `packages/builder/schema/src/site/*`; the store holds a `BuilderDocument`, and `commit()`
produces patches over `state.doc`.

`plan.md` says only "a site is in-memory kernel state" and no task in the checklist creates that
state. The site commands therefore have a prerequisite the plan never scheduled, and how it is
satisfied is an architectural fork with materially different blast radius. Raised for a decision
rather than chosen unilaterally.

Tasks complete: **65 / 211**.
