# Pixi creative and live Agent telemetry verification — 2026-10-11

Status: PX-001..005 locally verified; full feature 014 release remains open. This is a native Spec
Kit implementation/review/convergence increment, not a claim that the pinned professional-sdd
workflow engine or every release gate ran. No paid model calls, package installs, Git staging,
commits, pushes, deployment or external writes.

## Scope and delivered behavior

- `builder-media-engines`: scene kit 1.1.0 adds focus-scoped keyboard/virtual input, bounded
  fixed-step simulation and manual chapter navigation. Input does not capture editor typing;
  pause/visibility/blur clear held keys. Fixed updates stop in editor/reduced motion. Manual chapter
  changes redraw even after the reduced-motion still-frame timer. Unsubscription and disposal are
  owned by the scene.
- `builder-schema` and generated `builder-renderer` kit: CK reference, scene member contract, lazy
  asset version/license/hash and existing 16,000-byte gzip budget stay aligned. Existing Pixi
  namespace and library allowlist are preserved.
- `builder-ai`: games, stories and murals have Arabic/English activation, real API guidance and
  canonical runnable examples. Game states include ready/running/paused/won/lost, meaningful
  collection/collision, keyboard and native touch controls. Story chapters are manual; mural objects
  and motion are bounded. Business-story and game-store/studio briefs are negatives.
- Explicit Plan/full-build skill selection now forwards creative expertise to the actual provider
  contexts. Only a scene's contract inherits expertise; the hero additionally receives the original
  creative brief. With free code on, creative regions bypass a fixed kit-only writer and can land
  scene JS. Ordinary sections retain their kit path. Retry/Finish retain targeted expertise.
  Existing skill/context budgets, dependency resolution and command policy remain in force;
  unrelated automatic skills are not enabled.
- `builder-ai`, `ai-server`, Playground Agent: additive measured usage callbacks/events, SSE `usage`
  before the unchanged final `result`, and a unary exposed usage header. Old peers remain readable.
  SDK signals produce public understanding/planning/writing/checking phases, never private reasoning
  contents. Physical retries, checker repairs and successor runs have separate identities;
  deduplicated receipts survive settled turns/reload. Missing usage/cost remains unknown; local
  cached responses incur zero new usage.
- New `RunTelemetry` owns implementation, local export, behavior tests, stories, attached MDX and
  CSS with real chrome tokens/logical layout. The ledger keeps 64 attempts/16 public updates;
  overflow is persisted and invalidates totals rather than showing a partial bill. Malformed
  optional telemetry is dropped without losing a valid conversation.
- Composer controls share wrapping rows only on short/narrow panels, preserving all controls and
  scrollable conversation space. Reader pin/unpin behavior and real 1/3/6 section-worker pools
  remain; single edits are still single-writer work.
- `apps/evals/src/pixi-creative/`: exact examples run through public builder/wire APIs in the actual
  generated sandboxed runtime. Its separate DOM/JSX TypeScript project leaves the existing
  model-quality harness and Node services headless.

Architecture and researched library decisions:
[builder-design-libraries.md](../../../docs/architecture/builder-design-libraries.md). No dependency
was added: existing Matter, viewport, filters, brush/rough and audio cover this increment. Tilemap
v5 is proposed for a concrete large tile-world use case, not installed or agent-admitted. Managed
React dependency locks and free-code opt-in are unchanged.

## Fresh verification

Counts below describe separate focused runs and can overlap; they are not summed into a claimed
workspace-wide test total.

| Check                                                            | Outcome                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Complete media-engine unit suite                                 | 7 files / 60 tests passed, including 15 creative-helper cases                                    |
| Final AI build/page-plan/Plan/selection regression run           | 4 files / 92 tests passed                                                                        |
| Delegated AI skill/context regressions                           | 14 focused suites / 789 tests passed; independent final creative/selection recheck 57/57         |
| Usage/remote/cache/agent/standalone Plan focused run             | 93/93 passed; independent usage/remote recheck 51/51                                             |
| Server handler/Claude/OpenRouter/CLI focused suites              | 173/173 passed                                                                                   |
| Final Playground workers/telemetry/storage/RunTelemetry run      | 4 files / 70 tests passed                                                                        |
| Wider delegated controller/model and conversation component runs | 112/112 and 164/164 passed respectively                                                          |
| AgentFace provider-usage regression suite                        | 35/35 passed; independent Face/RunTelemetry recheck 40/40                                        |
| Renderer preview/loaders/generated-source/export regression      | 4 files / 34 tests passed                                                                        |
| Public wire/headless consumer checks                             | 2 files / 9 tests passed                                                                         |
| Real generated-runtime creative browser fixture                  | 1 test containing 4 LTR/RTL × 390/1280 matrices passed; rerun after pixel-space collision repair |
| Live chat browser fixture                                        | All 10 Chromium geometry/scroll/telemetry variants passed twice                                  |
| RunTelemetry original-config Chromium Storybook plays            | 6/6 passed                                                                                       |
| Full original-config Storybook static build                      | Passed, 5,180 modules and 2,275 indexed entries                                                  |
| Playground / AI-server production builds                         | Passed, 4,429 / 515 modules respectively                                                         |
| Owner/consumer TypeScript checks                                 | AI, media engines, schema, renderer, editor, Playground, Evals (both projects), AI-server passed |
| Scoped changed-source ESLint / formatting / whitespace           | Passed after repairs; existing create-scene lint debt is separately recorded below               |
| Workspace / component / Turbo boundary contracts                 | 36 members / 222 components / 4,506 files in 36 packages passed                                  |
| Graph contract dry run                                           | Passed; not an executed full lint/build/test graph                                               |

Representative repeatable commands:

```sh
node scripts/build-studio-engines.mjs kit
pnpm --filter @craftkit/builder-media-engines test
pnpm --filter @craftkit/builder-ai exec vitest run src/agent/run-build.page-plan.test.ts src/agent/run-build.test.ts src/agent/page-plan/plan-ai-page.test.ts src/skills/pixi-selection.test.ts
pnpm --filter @craftkit/playground exec vitest run src/features/agent/hooks/use-agent-controller.workers.test.tsx src/features/agent/model/run-telemetry.test.ts src/features/agent/model/turns.test.ts src/features/agent/components/RunTelemetry/RunTelemetry.test.tsx
pnpm --filter @craftkit/evals test:pixi-creative:browser
pnpm --filter @craftkit/evals test:agent-chat:browser http://127.0.0.1:5194
pnpm --filter @craftkit/storybook test:storybook ../../apps/playground/src/features/agent/components/RunTelemetry/RunTelemetry.stories.tsx
pnpm --filter @craftkit/storybook build-storybook
pnpm --filter @craftkit/playground build
pnpm --filter @craftkit/ai-server build
pnpm --filter @craftkit/evals typecheck
pnpm check:workspace
pnpm check:components
pnpm check:boundaries
```

Chat browser QA requires a separately started local Playground fixture server. The task-owned server
at 127.0.0.1:5194 was stopped and the absence of a listener confirmed. Existing developer servers
were untouched. Browser fixtures block external HTTP/model/provider routes; local Chromium execution
used approved local diagnostic permission. `/private/tmp/craftkit-chat-after.png` is disposable
screenshot evidence, not a committed artifact.

The creative fixture covers actual keyboard movement, start/pause/restart, resizing, removal and
teardown; manual story navigation after 800 ms under reduced motion; and finite bounded mural layers
without a running ticker. Game win/loss, touch cancellation, pixel-space contacts across wide/tall
sizes and editor behavior additionally have deterministic unit coverage. This is not an assertion
that touch was tested on a physical phone or that every game genre was evaluated.

Generated kit body SHA-256 (excluding its leading licence banner) is
`7015d8a4428c159319ae0f5863eb7ab14d0d5e378975902aec0ad9f4f55a6f74`. The licensed asset is 14,930
gzip bytes at the generator's level 9, or 14,932 with Node's default compression, below the
unchanged 16,000-byte cap. Its body digest was independently rechecked. Only kit-source changed
after regeneration; no handwritten generated source repair.

## Review, repairs and scoped convergence

Path-disjoint telemetry and creative-skill workers returned scoped checks; primary integrated the
runtime, public APIs, scene-capable build lanes, fixtures and docs. A fresh read-only native
reviewer made no source/Git mutations. Its final verdict has no unresolved Critical/High/Medium
finding in the inspected PX increment. Browser matrices remain primary-owned evidence, not
independently repeated by that reviewer.

Accepted findings repaired and rerun: reused outer-retry identities; missing checker/successor
receipts; malformed stored telemetry; business game-prefix activation; overflow at attempt 65;
creative skills not reaching actual explicit build lanes. Primary also repaired normalized-vs-pixel
collision thresholds and a duplicate automatic/attached Storybook docs entry. Exact independent
rechecks passed 8 provider-context cases, 2 scene-writing/targeting cases, 3 successor-context
cases, 2 retry/checker cases, 55 telemetry/storage cases and the overflow rendering case.

Scoped `speckit-converge` assessed PX-001..005, eight implementation decisions and the nine core
constitution principles. No missing/partial/contradicting/unrequested implementation gap remains
within this increment. Tasks stayed byte-for-byte unchanged during assessment (SHA-256
`932b26e4f73f0dd6022c9d2457d5c8f17a49ae4651e1d7ad23e741165f482c9f`); no empty convergence phase was
appended. Completion tracking and canonical handoff are separate subsequent updates. Historical
T045/T122 and broader release tasks are not bulk-checked from these results.

## Limits and failed checks, not concealed

- Exact original production screenshot scroll failure was not reproduced in every environment. The
  short Arabic full-control fixture exposed a real lost-height case: the thread recovered from 95 to
  131 px at 288×400; long draft/resize cases retain over 80 px instead of the previous 45 px. Ten
  repeatable variants pass; physical/mobile and all-user-environment proof remains open.
- First story/scene QA fixture queries and capture seams were wrong and repaired; the final
  canonical browser run passed. Early provider-context menu lookup and CTA-kit expectations were
  fixture mistakes, corrected against actual briefs. New Plan-test option typing and candidate
  typing were repaired; final 92-test run and TypeScript checks pass.
- First Storybook build found the new duplicate automatic/attached RunTelemetry docs entry. It was
  repaired without reducing configured catalog scope; complete build and six plays pass.
- Evals initially typechecked the browser fixture as headless Node. A feature-local DOM/JSX config
  and Vite client CSS ambient types repaired this without widening server configuration. Both
  projects now typecheck.
- A first checksum probe incorrectly included the licence banner and an unnecessary root `tsx`
  import was unavailable. Correct Node-native body-only hashing matches the generator contract.
- Existing `create-scene.ts` lint debt remains: 19 errors with identical rule counts in the baseline
  and current source. New helper/wiring lint is clean; full media-owner/root lint is not claimed.
  Media unit tests emit the existing jsdom canvas-not-implemented notice; real Pixi browser tests
  are separate passing evidence.
- Production builds retain unresolved example-template URL warnings, ineffective dynamic import
  warnings and large chunks. No warning threshold or asset budget was raised. The current kit budget
  passing does not close historical all-pack/bundle-performance debt.
- Full `pnpm verify`, full coverage/catalog browser plays, Firefox/WebKit, manual screen readers,
  physical audio devices, live provider speed/design quality, human visual ratings and total
  fallback-provider charges were not measured. Missing receipts and old runs are not reconstructed
  as bills. Work has not been deployed; representative paid evaluations need separate authorization.
- Unrelated concurrent user changes in `direction-set.ts` and `nav-sync.ts` were preserved and
  excluded from this increment's implementation/review. No global memory file was changed.
