# Scene initialization and server latency verification

Scope: [SP-001..004 and SP-T1..5](scene-speed-2026-10-13.md). Local implementation only; the rest of
feature014's release requirements remain separate.

## Result and evidence limits

A writer's compact `@preset:<id>` answer initializes the captured section locally using the existing
22 backdrop presets. It supplies responsive markup/CSS, exact contract title/claims/facts,
appropriate primary action, catalog code/metadata and validated settings. Explicit tree/CSS remains
authored. Bespoke/excluded scene requests avoid forced initialization. An explicitly selected preset
stays selected on retry; mandatory initialization is enforced for original and repaired answers.

Eligible backdrop attempts default to 180 seconds; initialization-only attempts to 90 seconds.
Ordinary sections retain 240 seconds and other scene lanes 420 seconds. Explicit host task deadlines
remain exact overrides. These are per-call deadlines, not a promise about total website duration.
The server applies low effort/8192 output tokens only to actual Free-code Pixi fill initialization.
Explicit deep effort and ordinary custom-scene reasoning/output capacity remain intact.

Cache staggering now observes backend activity/text instead of synthetic waiting narration. Provider
usage remains the evidence of an actual cache read. Thinking-off is conditional on model support.

The [offline JSON artifact](verification-scene-speed-2026-10-13.json) measures 22 presets, 1100
local initializations on Node 24.19.0: p50=0.111 ms, p95=0.257 ms under this machine's load. Compact
proposals total 3015 serialized characters versus 171950 expanded characters, a 98.25% reduction.
This comparison includes locally generated markup/code/settings. It is not a token, billing,
provider-latency or model-quality measurement. Repeat with:

```sh
pnpm --filter @craftkit/builder-ai benchmark:scene-init
```

No live provider generation, deployment, saved-document migration or dependency installation was
performed. The development listener changed from PID 49111 to 90996 following the successful build,
consistent with the existing watch restart; a live model run/revision was not verified.

## Checks

| Gate                                                        | Result                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Final initializer/briefing/ownership/real-build regressions | 4 files, 37 tests passed                                                                                                    |
| Broader run-build/revert regressions after review fixes     | 17 files/181 tests covered: 180 passed together; the 3 lesson tests passed in isolation after one 5 second parallel timeout |
| Earlier complete owning AI suite                            | 223 files/6805 tests passed before the last review fixes; those fixes received the final focused/broader runs above         |
| Server policy/cache/CLI/OpenRouter/routing regressions      | 10 files/166 tests passed, fake providers/processes, no HTTP listener                                                       |
| Headless public wire                                        | 1 file/3 tests passed                                                                                                       |
| Playground successor Undo/Redo                              | 1 file/6 tests passed                                                                                                       |
| TypeScript                                                  | Builder AI, public Builder facade, AI server and Playground passed; Evals Pixi harness passed                               |
| ESLint                                                      | All changed source/test modules passed with zero warnings                                                                   |
| Production builds                                           | AI server and Playground passed                                                                                             |
| Playground first-load budget                                | entry 548015/896000; JS 1084347/1151000; CSS 145761/147000 bytes gzip: passed                                               |
| Workspace contracts                                         | 37 members passed                                                                                                           |
| Package boundaries                                          | 5482 files across 37 packages passed                                                                                        |
| File sizes                                                  | 4297 files passed; existing oversized initializer consumers/barrels shrank                                                  |
| Formatting/diff                                             | Changed focused modules/READMEs and `git diff --check` passed                                                               |

The exact targeted commands use `pnpm --filter <member> exec vitest run --config vitest.config.ts`
with the files in `scene-initializer.test.ts`, `scene-ready.test.ts`, `fill-guard.test.ts`,
`run-build.ready-scene.test.ts`; the broader AI run targets `src/agent/run-build` and
`src/agent/build-revert` with `--maxWorkers=2`. The isolated rerun targets
`src/agent/run-build.lessons.test.ts` with `--maxWorkers=1` and unchanged test deadlines.

Offline Chromium QA passed 9/9 cases: validated fixture smoke plus 390/1280 px, LTR/RTL and
motion/reduced-motion combinations. It checks real visible canvas pixels outside the opaque copy
panel, exact text/action, layering, bounds/overflow and native Tab/Enter fragment navigation. The
final fixture uses the intentional `@craftkit/builder/testing` API, not private source imports.
After that import-boundary repair the primary reran the validated fixture and an actual mobile LTR
browser case: 2 passed, 7 deliberately excluded by the focused test filter. The fixture values and
the other browser assertions were unchanged. Final Evals Pixi types/lint passed. HTTP requests are
blocked and no provider is called. Run:

```sh
CRAFTKIT_BROWSER_QA=1 pnpm --filter @craftkit/evals exec vitest run --config vitest.config.ts src/pixi-creative/scene-init.browser.test.ts
```

The existing Studio thumbnail bridge returned blank WebGL readbacks in reduced-motion cases;
compositor screenshots confirmed visible still artwork. This separate capture limitation was not
changed by this initializer increment. The fixture evaluates visible rendering directly.

## Review and convergence

Direct `speckit-workspace-review` used an independent native reviewer. It found and verified repairs
for mandatory preset enforcement, repair completion, explicit retry IDs, host deadline overrides,
bespoke/excluded requests and metadata/settings recovery. Its fresh final tests passed 36 builder,
53 server, 3 wire and 6 successor cases. The primary reviewed the source/diff and reran owner
checks. The final integration review also approved the test-only public API and narrowed exclusions,
with 11 scene-briefing tests independently rerun. No unresolved implementation finding remains.

Automatic approval review rejected the fresh read-only/never-approve external Codex CLI review
because it may transmit private repository contents to an unverified external service. No process or
source export occurred through that attempt. On 2026-10-13 the user explicitly replied: “لا، اكتفِ
بالمراجعة المحلية”. The user accepted local independent review and declined the external action.
That runtime gate is waived only for this increment, as recorded in the active plan; no CLI pass is
claimed and the declined action must not be retried without new user authorization.

Scoped convergence found the implementation of all 4 requirements and 7 plan decisions present. T260
and SP-T5 are resolved under the user-accepted local review boundary; no requested implementation or
local verification work remains for this increment. The full `professional-sdd` CLI workflow and its
pinned reviewer were not run. Live provider measurements and broader release gates remain separate
and unverified.
