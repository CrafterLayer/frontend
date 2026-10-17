# Verification: Production Agent Readiness

**Feature**: [spec.md](./spec.md) · **Tasks**: T179–T211 · **Started**: 2026-09-01

This record separates the reproduced pre-change failure from later red/green, mutation, package, and
real-Playground evidence. It does not treat a package-only fixture as proof that the shipped
Assistant can reach its provider.

## Pre-change real-Playground baseline (T179)

The probe used the real `createPlaygroundKernel()` registrations and hydration, an instrumented
provider call counter, the package's own complete-wire estimator, and the default 64,000-token
budget. Its temporary file lived under `/private/tmp` and was deleted after the run; the repository
was not modified by the probe.

```text
pnpm --filter @craftkit/playground exec vitest run \
  --root /private/tmp --globals d1-audit.test.ts \
  --reporter=verbose --disableConsoleIntercept

exit: 0
tests: 1 file, 3 passed
```

| Fixture | Blocks | Templates | Nodes | Fragment estimate | Complete wire | Budget | Provider calls |
| ------- | -----: | --------: | ----: | ----------------: | ------------: | -----: | -------------: |
| Landing |     54 |         4 |    27 |            55,936 |       121,291 | 64,000 |              0 |
| Empty   |     54 |         4 |     1 |            52,679 |       114,321 | 64,000 |              0 |

Both requests threw `AiContextBudgetError` before `provider.propose()`. Parsed block and document
fragment bodies were structurally byte-equivalent under canonical serialization to the structured
`context.blocks` and `context.document` fields.

Removing only the duplicated block/document fragments in the probe changed the landing wire from
121,291 to 56,268 and the empty wire from 114,321 to 53,011. Removing all four duplicated built-in
fragments measured 55,945 and 52,688 respectively. This proves the outage is caused by duplicate
representation rather than an intrinsically oversized registered vocabulary.

## Confirmed companion baselines

- One top-level `applyPatches` plan step containing 5,000 patches passed the pre-change default
  policy even though `maxCommands` was 64; the bound counted plan steps, not nested work.
- A plan rejected under an explicit strict policy applied when the pre-change apply call omitted its
  optional policy. `runAiAgent` passed policy correctly; the Playground called the lower-level
  generate/apply functions directly.
- `add features items for 2025` produced an array of 2,025 items in the local provider. The word
  `constructor` read through `Object.prototype` and entered the count path as a function.
- Raw `plan.rationale` text, including newline-delimited instruction-looking content, was stored and
  replayed as Markdown memory.

## Dependency decision

`p-limit` was evaluated and deliberately not added for T179–T211. The agent path is sequential, and
the dev bridge is an untrusted inbound boundary: it rejects above its active-request cap with `429`
instead of retaining a pending Promise queue. Revisit only if a trusted multi-page pipeline later
parallelizes per-page work and owns both active and pending-work caps.

## Green and mutation evidence

### Canonical context and real-Playground gate (T180–T187)

The durable test uses the real landing/empty kernels, the production complete-wire estimator, and an
instrumented provider returning one valid registered `setDocMeta` command.

```text
pnpm --filter @craftkit/playground exec vitest run --config vitest.config.ts \
  src/features/preview/assistant-agent-readiness.test.ts

exit: 0
tests: 1 file, 2 passed
```

The first red run after adding the live command catalog/output contract still failed before provider
work at 77,162 landing tokens and 73,905 empty tokens. The remaining cost was not duplicate
documents; it was verbose repetition of Inspector section metadata across all 54 blocks. The final
wire preserves every declared property tab and semantic kind as compact grouped `propertyIntents`,
while omitting presentation-only section labels.

| Fixture | Blocks | Templates | Nodes | Complete wire before | Complete wire after | Budget | Provider calls after |
| ------- | -----: | --------: | ----: | -------------------: | ------------------: | -----: | -------------------: |
| Landing |     54 |         4 |    27 |              121,291 |              62,511 | 64,000 |                    1 |
| Empty   |     54 |         4 |     1 |              114,321 |              59,237 | 64,000 |                    1 |

The gate additionally asserts that no `craftkit.block-catalog`, `craftkit.template-catalog`,
`craftkit.document-shape`, or `craftkit.selection` fragment duplicates the structured fields.
Document nodes now carry current `bindings`, `variantOf`, and `responsive` facts, while selection is
only ordered focus ids. Selecting all 27 landing nodes therefore costs 62,584 tokens instead of
duplicating node props past the budget.

A smallest expectation mutation changed both budget assertions to exact zero. The three named cases
failed with observed values 62,511 (landing), 59,237 (empty), and 62,584 (all nodes selected).
Restoring the assertions returned the readiness file byte-for-byte to SHA-256
`e59ada0dfa369cc2edd53850754a31438b9c42e2051567820eaa8f43efbf3ac2`; the gate then passed 3/3.

### Pinned authority and nested-work mutations (T193)

Each mutation changed the smallest relevant production expression, ran the named focused test, then
restored the source. SHA-256 before and after restoration was identical for all three files:

| Mutation                                                          | Named failure observed                                                                                                                               | Restored SHA-256                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Remove `authority.policy` from the final `assertValidAiPlan` call | `rechecks policy at apply time and leaves the live kernel untouched on denial` failed because no error was thrown                                    | `apply-plan.ts`: `0a6fc1d5c9f95c950975caf4820c3d397dce7e55bdbfe31fea5fe78f79c52038`     |
| Remove the explicit-host gate for `applyPatches`                  | `denies applyPatches by default and allows it only through an explicit host allowlist` failed because `applyPatches` entered the default command set | `command-policy.ts`: `ae5b92f28ada770adf157dbd8485338d17c692f8f5fa5a1c3e3ab8ae74fa50a7` |
| Count a raw `applyPatches` array as one operation                 | `rejects 5,000 nested patches before schema parsing or scratch work` failed when the unreadable patch proxy was materialized                         | `validate-plan.ts`: `30e40432f7dfe7690bb463bc0c101bdfac862758b0d6d4b449b93ad732ff318b`  |

After byte-for-byte restoration, the combined authority/policy gate passed 20/20.

Later adversarial review found and closed three authority edges before the release rerun:

- A getter-backed proposal was read five times by the pre-fix apply path and could mix two otherwise
  authenticated authorities. The red probe observed five reads; `applyAiPlan` and preview now
  snapshot the getter once, and both regression tests assert exactly one read.
- A first `applyPatches` step could change a node type before a later `setProp` authored that new
  type's human-only utility field. The pre-fix probe returned `ok: true`; ordered shadow node-type
  state now rejects the later step before scratch work.
- A host calling `abort(new Error(...))` surfaced that raw error even though the event said
  `cancelled`. The red probe observed `Error`; every cancelled run now rejects with `AbortError`
  while preserving the host message and typed non-retryable cancellation event.

The final command-contract review also compared the runtime Zod schemas and emitted JSON Schema for
all 12 core commands over 126 representative JSON inputs: zero mismatches. This includes required
`value` for `add`/`replace` patches, forbidden reserved patch segments, and the `setDocMeta`
`dir`/`surface` union.

### Provider, diagnostic, and memory mutations (T202)

The same mutate → named failure → byte-for-byte restore protocol covered the remaining hardening
boundaries:

| Mutation                                                   | Named failure observed                                                                                                                               | Restored SHA-256                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Remove the pre-allocation collection clamp                 | Both `bounds the request-derived collection before allocation` cases failed: 2,025 items were built and the maximum-safe integer caused `RangeError` | `local-provider.ts`: `ff73993bb4decbec282b34d9c074de72e11422146e588d84190775f98608e42a`  |
| Omit JSON reader cleanup in `finally`                      | `cleans up the reader before surfacing a versioned invalid-output response` failed with zero cancel calls                                            | `remote-provider.ts`: `3082f0cb9ee59e6e851c298f8b3f6b5d0df6e7c84ee045452f674e00bb0e9138` |
| Replace the provider failure code with `unknown`           | `preserves provider refusal, retryability, and status as stable structured data` failed on `http-status` versus `unknown`                            | `agent/errors.ts`: `5fe4f7d0b21cc6215be319f0574c13d87654cf3384cb354acb58b273d29ba393`    |
| Spread undeclared memory fields into the normalized record | `keeps prompt-looking text typed as data and never replays an extra model rationale field` failed because `SYSTEM:` rationale entered context        | `memory-provider.ts`: `49a8cfcac68882b778456b270d06502ec575830888eb8654f56b9b5fb81dd1fa` |

After byte-for-byte restoration, the local/remote/error/memory gate passed 63/63.

### Final SC-020–SC-026 integration rerun (T209)

After the Playground switched to `runAiAgent`, the real readiness test was rerun with console
interception disabled only to record the computed measurements; the diagnostic print was then
removed.

```text
pnpm --filter @craftkit/playground exec vitest run --config vitest.config.ts \
  src/features/preview/assistant-agent-readiness.test.ts \
  --reporter=verbose --disableConsoleIntercept

exit: 0
tests: 1 file, 3 passed
landing:     62,511 complete-wire tokens, provider calls 1, duplicate built-ins []
empty:       59,237 complete-wire tokens, provider calls 1, duplicate built-ins []
all-selected: 62,584 complete-wire tokens, selection facts duplicated 0 times
```

A final duplicate-context mutation preloaded the four built-in providers into the additive fragment
map. Both named readiness cases failed before provider work with `AiContextBudgetError`: 134,239
tokens for landing and 127,269 for empty. Restoring `assemble-context.ts` produced the original
SHA-256 `3b4fa10c16294e9ded23d1d12d60e1a14b2cdce883918af4a46691962a204a3f`, after which the
readiness gate passed again. The later selection/context-field hardening is covered by the 3/3 rerun
above.

SC-021–SC-024 are covered by the named mutations above. SC-025's final Assistant gate passed 33/33,
including Ask/Auto runner events, host Skill pins, context-budget refusal, retry, Stop, and late-run
supersession. The final AI package gate passed 290/290 and the focused Assistant/readiness/env gate
passed 40/40.

### Dev bridge security gate

The bridge now requires a bearer session token, reflects only allowlisted origins, binds the
runnable entrypoint to `127.0.0.1`, caps request and CLI output bytes, permits a bounded active
count with no pending queue, disables Claude tools/customizations/session persistence, and makes
exactly one model call per wire request. Invalid model text becomes versioned `invalidOutput`; it
never triggers a hidden bridge repair.

The first sandboxed test run observed `listen EPERM 127.0.0.1`; this is unavailable evidence, not a
pass. The same command was rerun with explicit loopback permission:

```text
node --test scripts/ai-plan-bridge.test.mjs
exit: 0
tests: 14 passed
```

The gate covers CLI isolation, strict wire output, origin/auth/body rejection, one-call behavior,
`429` rejection while the sole active slot is occupied, stdin `EPIPE`, caller cancellation,
TERM-to-KILL escalation, POSIX process-group descendant cleanup, stdout/stderr overflow, and socket
closure after early, health/preflight, and admitted-body timeout responses. `p-limit` remains
deliberately absent as a direct dependency because queuing untrusted excess work would weaken this
boundary.

Two independent final reviews used different lenses. The command/context reviewer cross-checked the
runtime and advertised command contracts, canonical context, proposal authority, runner, and custom
cancellation. The security/resource reviewer checked the bridge's trust boundary, resource caps,
socket lifecycle, and process tree. Both reported no remaining Critical, High, or Medium findings.

## Final package and cross-cutting gates (T207–T210)

| Gate                            | Fresh result                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| AI lint + typecheck             | passed                                                                                  |
| AI coverage                     | 33 files, 290 tests; 93.18% statements, 86.14% branches, 94.11% functions, 94.09% lines |
| Schema lint + typecheck         | passed                                                                                  |
| Schema coverage                 | 20 files, 202 tests; 95.45% statements, 89.67% branches, 96% functions, 95.67% lines    |
| Playground lint + typecheck     | passed                                                                                  |
| Playground coverage             | 16 files, 87 tests; 93.96% statements, 88.81% branches, 94.35% functions, 93.98% lines  |
| Core lint + typecheck + tests   | 14 files, 123 tests passed                                                              |
| Focused Assistant/readiness/env | 3 files, 40 tests passed                                                                |
| Playground production build     | passed; 1,199 modules transformed                                                       |
| `pnpm check:workspace`          | passed for 29 members                                                                   |
| `pnpm check:components`         | passed for 101 components                                                               |
| `pnpm check:boundaries`         | 1,073 files checked, no issues                                                          |
| `git diff --check`              | passed                                                                                  |
| Changed-file Prettier gate      | passed                                                                                  |

The production build still reports the existing large-entry warning (`index` 1,016.12 kB before
gzip); this phase did not change route chunking. The repository-wide `pnpm format:check` remains red
only on ten unchanged baseline files (`App.css`, `CLAUDE.md`, and eight marketing-block files); all
changed and added files pass Prettier.

The full workspace Storybook command stops before Chromium because existing components outside this
AI scope are indexed twice by `autodocs` and colocated MDX. A temporary Assistant-only Storybook
configuration was therefore used only for the affected surface and deleted afterward. Its first
sandboxed Chromium attempt observed `listen EPERM ::1:63315` (unavailable evidence, not a pass); the
same targeted browser gate with loopback permission passed one story file and all 9 interaction
tests. Package/jsdom results were never substituted for that browser result.

Residual risks below Medium: the POSIX process-group implementation intentionally refuses the
default CLI path on Windows, no paid live Claude CLI request was sent during the deterministic test
run, the unrelated full-Storybook indexing baseline remains red, and bundle splitting remains a
later performance task.
