# Deadline reliability and published style verification

Scope:
[SP-005..007 / SP-T6..9 / T261..264](scene-speed-2026-10-13.md#authorized-reliability-and-visual-follow-up--2026-10-13).
The user selected speed/reliability and visual repairs (“1+2”). This is local implementation and
verification; the other feature014 release gates remain separate.

## Result

Section deadlines now settle a provider promise even if it ignores cancellation. The real-build
regressions prove that an expired initialization retries once, two hanging attempts report timeout,
a hanging repair retains the first checked scene, and late proposals/repairs cause no document,
transaction or event changes. Caller deadlines, abort reasons and Stop precedence remain supported.
The provider receives the abort signal; actual remote compute still depends on its honoring that
signal. This fixes a reproduced robustness gap without identifying the original live seven-minute
run's cause.

The CLI shim now carries explicit output caps and effort through both the child environment and
inline settings. Warm identity includes the output cap so a ready-init process cannot serve a larger
custom/deep request with the wrong limit. Absent caps retain defaults; invalid caps fail before
spawning. Cache followers wait only the remaining pioneer window; unrelated HTTP 400 responses
receive no cache retry. Known legacy API models, including dated Claude4 identifiers, omit
unsupported effort while retaining other request fields. Supported modern effort stays intact. The
CLI controls are documented in the primary
[environment reference](https://code.claude.com/docs/en/env-vars); legacy Haiku effort support is
documented in its [model overview](https://platform.claude.com/docs/en/models/haiku-4-5/overview).
Process and request checks use fakes; no live model budget or latency result is claimed.

Published marketing sections now include the exact owner `section-layout.css` through dedicated
marketing and Builder public entries. The existing rendered-class compiler callback adds it once per
page, including shared regions. It handles an absent original callback and main-document aliasing
without attaching styles to the wrong page. Utility-only pages omit the sheet. Selector names come
from the owner CSS itself; the helper imports no renderers or schemas. The renderer and source
stylesheet are unchanged. This public entry requires a raw-import-aware bundler, verified with the
publishing host's Vite build.

## Checks

| Gate                                          | Result                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Builder helper and deadline/build regressions | Worker focused 4 files/44 tests passed; independent reviewer fresh 3 files/28 tests passed |
| Broader Builder run-build/revert regressions  | Primary 18 files/186 tests passed, 40.58 seconds                                           |
| Server generation/cache/routing regressions   | Final 10 files/154 tests passed, 12.45 seconds                                             |
| Marketing owner CSS and tone                  | 2 files/30 tests passed                                                                    |
| Playground publishing/compiler feature        | Primary final 6 files/22 tests passed; worker focused 3 files/16 tests passed              |
| TypeScript                                    | Builder AI, AI server, marketing, public Builder facade and Playground passed              |
| ESLint                                        | Changed source/test/config files passed with zero warnings                                 |
| Production builds                             | AI server and Playground passed                                                            |
| Playground initial-load budget                | entry 550374/896000; JS 1086717/1151000; CSS 145879/147000 bytes gzip: passed              |
| Workspace contract                            | 37 members passed                                                                          |
| Package boundaries                            | 5551 files across 37 packages passed                                                       |
| File sizes                                    | 4353 files passed; existing oversized consumers remain within their baselines              |
| Formatting/diff                               | Changed focused files and `git diff --check` passed                                        |

Vitest normally blanks CSS imports, including `?raw`. The marketing and Playground configurations
enable only `section-layout.css?raw`, so these regressions test the actual owner text while ordinary
component CSS side effects retain their existing test behavior.

Primary Chromium QA rendered real exported HTML/CSS produced by the real registered hero and
comparison-table blocks and live Tailwind compiler. All 8 combinations of 390/1280 px, light/dark
theme and LTR/RTL passed. Computed slab background/ink retained the owner dark rules; mobile used
comparison cards, desktop used the table, direction matched, and overflow was zero. The fixture used
a Vite middleware server with no HTTP listener, stripped scripts/external links and blocked all
browser network requests. The [browser measurements](verification-published-styles-2026-10-13.json)
record actual computed styles, not a visual-quality score or a deployed-site check.

The current catalog has 28 presets. The saved
[offline initialization measurement](verification-scene-init-followup-2026-10-13.json) covers 1400
runs: p50 0.079 ms, p95 0.295 ms, 3825 compact versus 199119 expanded JSON characters, 98.08% fewer
characters. CPU timing depends on machine/load. The original 22-preset artifact remains historical
evidence. JSON characters are not provider tokens, cost or elapsed generation time.

## Reproduction

Use existing installed binaries from each owning directory; no dependency installation is needed.

```sh
# packages/builder/ai
node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/agent/run-build src/agent/build-revert --maxWorkers=2
node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/agent/settle-on-abort.test.ts src/agent/run-build.ready-scene.test.ts src/agent/run-build.scene-check.test.ts --maxWorkers=1
node scripts/measure-scene-init.mjs

# apps/ai-server
node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/cli-generation-config.test.ts src/cli-client.test.ts src/cli-warm-pool.test.ts src/cache-gate.test.ts src/cache-readiness.test.ts src/openrouter-cache.test.ts src/thinking-config.test.ts src/routing-client.test.ts src/scene-writer.test.ts src/openrouter-thinking.test.ts --maxWorkers=2

# apps/playground
node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/features/export --maxWorkers=2

# packages/builder/extensions/blocks-marketing
node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/stylesheet.test.ts src/components/section-tone.test.ts
```

## Local review and completion

Independent native review found and verified the legacy dated-model compatibility repair. Primary
integration review reproduced a document-alias CSS omission before repair; the final publisher uses
per-page rendered classes. Fresh final independent reviews of the abort boundary and publishing
composition found no remaining actionable issue. The primary inspected the final diff and ran the
broader build/publishing tests, production builds, browser probes and workspace/budget gates.

SP-005..007 and T261..264 are locally complete. The user's prior “لا، اكتفِ بالمراجعة المحلية”
instruction continues to apply, as recorded in the active plan. No external Codex CLI review or full
`professional-sdd` CLI workflow ran, and neither is claimed. No live provider generation, dependency
installation, stored-data migration, commit, push or deployment occurred. Live latency, cost and
representative model quality remain unmeasured.

Commit proposal after reviewing the final diff (not executed):
`fix(builder): enforce agent budgets and restore published marketing styles`.
