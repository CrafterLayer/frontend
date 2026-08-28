# Quickstart: Builder B4 — Transforms and Code View

How to prove B4 works, in the order a reviewer should run it. Every command is copy-ready.

Prefix each shell command with:

```bash
export PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
```

If pnpm attempts a forbidden automatic install, prefix `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`.

## 0. Prerequisites

Working tree green before starting:

```bash
pnpm check:workspace && pnpm check:components
```

## 1. The blocker is closed (`-0`)

The round-trip law is unachievable while `-0` is storable, because JSON prints it as `0`. Confirm
the defect exists before the fix, and is gone after:

```bash
node -e "console.log(JSON.stringify(-0), Object.is(JSON.parse(JSON.stringify(-0)), -0))"
# expected today:  0 false
pnpm --filter @craftkit/builder-schema test src/json
# expected after Phase A: a named test proves -0 is canonicalised at the document boundary
```

## 2. The contribution point is reachable

`ProjectionDef` has been declared since B0 and never wired. After Phase A:

```bash
pnpm --filter @craftkit/builder-core test src/extensions
# expected: projections register, resolve by id, reject duplicates all-or-nothing, and disappear on disposal
```

## 3. The codec and the round-trip law

The centre of the milestone:

```bash
pnpm --filter @craftkit/builder-transforms test
```

Expected, and each one must be a NAMED test:

| Gate                   | What it proves                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| pure codec             | `parse(project(d))` reproduces `d` exactly, 1,000 generated documents                                   |
| second print           | `project(parse(project(d))) === project(d)`                                                             |
| **non-vacuous**        | generated `base ≠ edited` yields ≥1 patch and exactly `edited` — a parser returning `[]` must FAIL here |
| key-order metamorphism | re-inserting keys in another order leaves canonical text identical                                      |
| scope isolation        | everything outside the selected subtree is byte-identical                                               |
| invalid text           | every prefix truncation → errors with one-based lines and zero patches                                  |
| field mutants          | dropped ids / slot order / bindings / a breakpoint / `variantOf` / envelope fields each detected        |

**Mutation-check the suite, do not trust it green.** Break the codec in the smallest way and confirm
the named test fails:

```bash
# e.g. make the printer emit keys in insertion order instead of sorted, then:
pnpm --filter @craftkit/builder-transforms test
# expected: the second-print / key-order gates FAIL. Restore and confirm green.
```

## 4. The worker path is real, and counted

```bash
pnpm --filter @craftkit/builder-code-view test
```

Expected counted assertions: posts, responses, stale drops, teardown, applications; document
messages = 1 per revision (not per keystroke); pending requests reject exactly once on `error`,
`messageerror` and termination, with the listener count returning to zero.

`WorkerLike` is injected because jsdom has no real Worker — which is exactly why §5 below is not
optional.

## 5. Browser truth (coordinator-owned, non-negotiable)

jsdom cannot prove thread placement or real focus movement. B3c §19 is the standing reminder: a
programmatic `.focus()` left every unit test green while the real tab order was broken.

```bash
cd apps/storybook && pnpm exec vitest run --project=storybook
```

Expected in real Chromium:

- the module worker actually runs (a fake port cannot prove this)
- a real **Tab** press reaches the code view and leaves it correctly; **Escape** returns focus to
  the documented continuation target
- typing invalid text leaves the canvas visibly unchanged
- one applied edit, one undo step

## 6. Playground scenario 10

```bash
pnpm --filter @craftkit/playground test
pnpm --filter @craftkit/playground dev    # to see it
```

Expected: select a block → open code view → edit its text → apply → undo, with the live transaction
counter showing exactly one transaction per applied edit and one per undo.

## 7. Boundary negatives (they must FAIL)

Prove the laws are enforced, not merely intended:

```bash
# 1. make the transforms package depend on the shell (UPWARD, 2→3), then:
pnpm check:workspace         # expected: BUILDER_LAYER_VIOLATION
# 2. make the code-view extension depend on another extension, then:
pnpm check:workspace         # expected: BUILDER_EXTENSION_COUPLING
# 3. delete any one of a new component's artifacts, then:
pnpm check:components        # expected: MISSING_COMPONENT_ARTIFACT naming the file
```

Restore each after observing the failure.

**Two corrections this section itself needed, found by RUNNING it (T031):**

- The first negative was originally written as shell→transforms and did NOT fail — correctly so: the
  layer law permits 3→2 exactly as shell→renderer. What actually protects the render path is
  SC-005's STATIC gate in `off-thread.test.ts` (main-thread modules cannot even import the codec),
  which is mutation-proved. The negative above now tests something genuinely illegal.
- The third negative originally PASSED silently: component discovery scanned only `src/components/`,
  so every extension component living directly under `src/` (richtext since B3b, code-view now) was
  ungoverned. The discovery gap is closed in workspace-tools, pinned by
  `governs extension-style components living directly under src (011 T031)`, and the governed count
  rose from 40 to 44 with all four newly-governed components passing.

## 8. Full evidence run

```bash
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify
```

Expected `EXIT=0`. Record the package test counts, the Storybook count, and the round-trip case
count in `tasks.md` as the evidence for the milestone.
