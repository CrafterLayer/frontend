# Creative agent reliability: verification

2026-10-20. Local implementation and focused verification complete; no commit, push, deployment,
paid model request or original-device reproduction was performed.

Scope: `packages/builder/ai`, `apps/ai-server`, existing Playground consumer tests/progress
documentation, and `apps/evals` browser fixtures. Requirements: [R1–R5](reliability-2026-10-20.md).
Research: [official-source comparison](research-reliability-2026-10-20.md).

## Findings and resulting behavior

| Requirement | Change and verified result                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1 / T283   | Completed independent writers apply serially after the final-plan gate. An unresolved first writer no longer blocks seven ready sections. Document positions and report rows retain page order; transactions record actual application order. Stop preserves applied work and rejects late writes.                                                                                               |
| R2 / T284   | Writing, checking and repair share the remaining attempt deadline. A stalled probe aborts; the structurally validated original proposal is retained without claiming a successful scene check. Nonretryable HTTP/auth/refusal failures do not invoke section retries or full-page fallback. Invalid model output remains eligible for the existing compact retry.                                |
| R3 / T285   | The user's exact `اصنع لعبه`, standard spelling and short game/story/mural creation requests select the direct creation route and relevant built-in expertise. Questions, business copy, selected-scene edits, exclusions, trust and token limits retain their gates. Existing skill matching already recognized some game wording; the missing direct route and story activation were repaired. |
| R4 / T286   | JSON errors retain bounded actionable text and terminal retry metadata across unary and SSE responses. Non-JSON, HTML, malformed, oversized or stalled error bodies cannot bypass limits. Invalid/truncated model answers remain diagnostic text and never apply as partial commands.                                                                                                            |
| R5 / T285   | A build-only adapter expands existing `scene.preset` game/story kits into the owned scaffold region. It requires explicit free-code capability and declared props, retains contract title/copy/anchor/CTA and existing authored tree/CSS, and preserves normal tool protections. Eleven existing kits are covered in Arabic and English; no second generation framework or new engine was added. |

In the scripted controller refusal case, requests now total **13**, matching physical provider
invocations: one scaffold, six terminal refusals, six user-requested successor writes. Previously
the test expected 19 because the six terminal refusals were automatically repeated. This proves
elimination of redundant calls in that controlled scenario, not a measured billing saving.

The real-kernel arcade and picture-book cases accept a tool answer below 250 JSON characters,
initialize real tree/CSS/code/settings locally, apply with zero repair calls and support per-section
undo. This is output-size and functional evidence; it is not live generation latency.

## Checks

Commands below run from the workspace root unless another directory is named. All providers in these
tests are deterministic. Counts from overlapping runs are deliberately not summed.

| Check                                                                                                                                   | Outcome                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @craftkit/builder-ai test src/agent/run-build src/provider/remote-provider.failure.test.ts`                              | 21 files, 221 tests: 220 passed; one lessons test exceeded its default 5-second test deadline under concurrent local load. No failed assertion. |
| `pnpm --filter @craftkit/builder-ai test src/agent/run-build.lessons.test.ts`                                                           | Isolated rerun: all 3 passed in 1.63 seconds of test time. No source or timeout adjustment.                                                     |
| Worker: intent/skills owner suites                                                                                                      | 39 files / 3,491 tests passed.                                                                                                                  |
| Worker: scene initializer, kit adapter, real-build kits and ordinary preset protection suites                                           | 4 files / 131 tests passed.                                                                                                                     |
| Worker: remote-provider suites                                                                                                          | 73 tests passed; final failure-body suite 24 passed.                                                                                            |
| Worker: AI-server focused handler/client/answer/error suites                                                                            | 152 passed; final terminal-error suite 17 passed.                                                                                               |
| `pnpm --filter @craftkit/playground test src/features/agent/hooks/use-agent-controller src/features/agent/model/build-progress.test.ts` | 10 files / 85 tests passed, including Stop, ready application, undo, finish-rest, retries and combined measured/unknown/cached receipts.        |
| Independent reviewer: creation-skills                                                                                                   | 39 passed.                                                                                                                                      |
| Independent reviewer: scene-kit initializer, real-build kits, remote-provider errors                                                    | 45 passed.                                                                                                                                      |
| Owner/consumer typechecks                                                                                                               | Builder AI, AI server, Builder facade, Playground and evals passed.                                                                             |
| Changed TypeScript ESLint                                                                                                               | All changed files in the four affected owners passed with zero warnings.                                                                        |
| Production builds                                                                                                                       | AI server and Playground passed. Playground still reports large lazy chunks and template URL warnings; these were not treated as runtime proof. |
| Playground `check:size`                                                                                                                 | Gzip: entry 550,951 / 896,000; JS 1,087,866 / 1,151,000; CSS 145,879 / 147,000 bytes.                                                           |
| Workspace/component/file-size/boundary checks                                                                                           | 37 members, 260 components, 4,513 source/test files; boundaries checked 5,911 files / 37 packages without issues.                               |
| Formatting / `git diff --check`                                                                                                         | Passed on final changed files.                                                                                                                  |

The previously documented server unary test expected a stream `restart` subscription even though
unary page plans have no draft observer. Its expectation now matches the current unary contract;
streaming restart behavior remains covered separately.

Initial test failures that expected document-order transaction application, or automatic retries of
terminal refusals, were updated to the new intended behavior. Stop tests explicitly wait for two
independent sections to apply, then verify no late transaction and only one remaining section. The
original model-output retry test caught an overly broad terminal check during development; the final
predicate preserves retry for recoverable invalid output.

## Actual browser behavior

```sh
CRAFTKIT_BROWSER_QA=1 CRAFTKIT_BROWSER_CHANNEL=chrome \
  pnpm --filter @craftkit/evals test src/pixi-creative/scene-kits-init.browser.test.ts
```

**4 / 4 passed** using the installed Chrome channel, an opaque `sandbox="allow-scripts"` iframe,
real generated Studio/Pixi assets and blocked HTTP(S) requests. The Playwright-pinned Chromium
revision was absent; nothing was installed. The restricted launch did not complete; the authorized
local browser run completed outside the filesystem sandbox.

The fixture sends a compact tool call through `completeReadyScene`, then renders its actual
tree/CSS/code/params. Arcade start/pause and picture-book next/reset work in English LTR at 1280px
and Arabic RTL at 390px, with reduced motion. Contract headings and copy are visible, CTA targets
are retained, canvas dimensions are nonzero, and no page or `ck-preview:error` diagnostics were
observed. This is not a full breakpoint matrix, pixel-content assertion, full editor click-path,
bespoke artwork review or proof of live model behavior.

## Review, convergence and continuation

Fresh native read-only review inspected the current implementation and independently ran the checks
above. Its final verdict had no actionable findings. Incremental review accepted the
browser/controller verification changes; the suggested preview error-channel assertion was added.
The continuing local-only review preference applies. No external Codex CLI review pass is claimed.

Final scoped convergence checked R1–R5 and T282–T287 against source, tests and evidence. Kernel-only
writes, explicit capability/ownership gates, public package boundaries and existing-component scope
are preserved. No new convergence task remains in this increment. Older feature-014 release tasks
and historical open items are not declared complete by this report.

Shared continuity is recorded in `.specify/agents/context.json` and `HANDOFF.md`. Proposed commit
subject, derived from the final diff: `fix(ai): apply ready sections and initialize creative kits`.
Nothing was staged or committed.

The reported incident occurred on another device, with an unknown model and no trace. This change is
local source plus verified builds; it has not updated that device or a deployed service. Full
monorepo CI, paid-provider quality/latency/billing benchmarks, cross-reload durable-run recovery and
human artistic scoring remain outside this local verification. No “10/10” output-quality claim is
made. Reverting this patch needs no data migration; already applied documents remain valid.
