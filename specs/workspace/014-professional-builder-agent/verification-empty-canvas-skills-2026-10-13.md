# Empty-canvas incident and prompt skills verification

Scope:
[SP-008..011 / T265..270](scene-speed-2026-10-13.md#authorized-empty-canvas-and-request-skills-repair--2026-10-13).
Local implementation, verification, scoped convergence and fresh independent review are complete.
The incident started on 2026-10-13; final checks completed on 2026-10-14, Asia/Hebron. The other
feature014 release gates remain separate.

## Reproduced failures

The reported screenshot shows “Page updated” after 15:36 with direction, language and styling
changes while the canvas displays its empty state. A local real-kernel reproduction confirmed the
same failure shape: a scene request could accept or salvage root-only metadata, emit completion, and
leave zero scene nodes. This reproduction establishes a code defect; it does not identify every
call, model or event in the original live run. No original provider trace was obtained.

The edit engine previously awaited a non-cooperative proposal or repair after Stop. Each remote HTTP
attempt had a 660-second budget with three attempts, without an aggregate edit deadline. The server
also needed to bound consumption of streamed output and backend fallback, rather than relying on SDK
response-header timeouts and per-backend retry budgets. Page planning also awaited a non-cooperative
provider and omitted the existing caller `timeoutMs` when forwarding its options, so fixing the
creation route alone would leave a drafting hang.

The skill chooser kept mutable pins above the chat and limited them to three. Queued prompts did not
carry a stable snapshot of their chosen skills. Existing registry metadata matching already provided
automatic activation; this repair integrates the existing enabled vocabulary per request.

## Verified implementation

Ordinary edits now share one cumulative 120-second deadline; explicit creative creation defaults to
180 seconds, including each page-planning step. Positive `timeoutMs` overrides retain caller
capacity; Playground high/xhigh/max effort retains an explicit 420-second budget unless the host
supplies its own ceiling. Both Plan and direct Build forward that budget. Build writers inherit
their coordinator's section deadline through private option identity, rather than interpreting an
opaque run ID. Stop, timeout and late-result protection are distinct. These are edit/call budgets,
not a promise about complete multi-step build latency. A provider receives cancellation; terminating
remote compute still depends on its honoring that signal.

The server bounds the entire `/plan` call at 240 seconds by default, including cache waits, streamed
output and routing fallback. `CRAFTKIT_AI_CALL_TIMEOUT_MS` changes the server budget. Interactive
SDK stream calls disable stacked SDK retries while background batch behavior retains its defaults.
The Playground HTTP attempt defaults to 240 seconds and supports `VITE_AI_PLAN_TIMEOUT_MS`; the
engine's aggregate edit budget still bounds proposal/repair/retry work.

Explicit English/Arabic scene creation on an empty canvas takes the build path despite later edit
verbs. Real existing scene code and closed scene markers count as content to preserve, even when
their DOM host contains only a heading. Normal metadata edits remain valid. Scene-creation
validation checks the final reachable scratch document before normal, repaired or salvaged success;
metadata, empty hosts and empty stages alone cannot fulfill creation. Static content checks do not
prove runtime rendering or representative design quality; existing runtime scene checks remain
responsible for that evidence layer.

Auto records disclose retained/dropped commands and application progress responds to the actual
`plan.applying` event. Enabled skills activate automatically from request metadata, with Arabic
scroll and character cues integrated. Optional slash choices are part of the prompt, without
persistent chips or a three-choice UI cap. Engine skill/token and trust/policy limits remain intact.
No filesystem skill bodies, extra model routing call or new dependency is introduced.

Send and Queue capture chosen skill IDs together with the brief without selection tokens. Renames
and name collisions cannot bind a queued request to another skill; disabled/deleted skills are
excluded at execution. Improve/Restore, both Clarify paths, Retry after reload, and planned Build
retain the captured identity. Existing relative URLs and unknown slash words remain request text.
Revising a pending plan uses its captured prior brief before superseding/awaiting the old plan, then
combines it with the new brief; explicit skill IDs stay limited to the current request. Optional,
bounded user-turn metadata preserves Retry through existing storage; older turns still load,
malformed metadata is discarded, and no storage version/key or migration changes. Reuse creates a
fresh draft whose tokens resolve through the current vocabulary.

## Checks

- Final intent/creative suites: 20 files / 2493 tests passed, including actual kernel ownership.
- Primary final engine/planning/build integration: 13 files / 174 tests passed. Earlier broader
  engine checks: 19 files / 182 tests; the worker's final regression subset: 3 files / 55 tests.
- AI server full suite: 47 files / 759 tests passed; native reviewer independently ran 27 focused
  offline lifetime/stream/cancellation/fallback tests. Local fake HTTP sockets required a sandbox
  permission override; no provider endpoint or credential was used.
- Primary final Playground integration: 7 files / 100 tests passed. Worker UI/controller/model/
  provider suite: 15 files / 238 tests, followed by 2 files / 25 final regressions. These
  overlapping runs are separate evidence, not an additive unique-test count.
- After T270: primary incident/knowledge integration 2 files / 27 tests; worker incident/ordinary
  controller integration 2 files / 41 tests. Primary and worker Playground typechecks, scoped lint,
  format and the affected production build passed again. Independent rename/collision tests: 2/2.
- Primary Builder AI, public Builder facade, AI-server and Playground TypeScript checks passed.
  Primary changed-source lint: 35 AI files and 20 server files; worker scoped UI lint/format passed.
- Final AI-server and Playground production builds, complete Storybook catalog build, and affected
  Storybook browser tests passed: 4 files / 113 tests. Playground first-load budgets passed: entry
  550432 / 896000; JS 1086775 / 1151000; CSS 145879 / 147000 gzip bytes. Storybook and the component
  browser probes passed before the final controller-only T270 repair; no UI component or contract
  changed in T270.
- Workspace contract: 37 members; components: 259; boundaries: 5579 files in 37 packages; graph: 37
  packages / 185 tasks. File sizes: 4381 files passed. The obsolete oversized `plan-page.ts` entry
  was removed after extraction reduced it to 131 lines; no baseline was increased.
- Final Chromium UI probes passed 2/2: real AgentPanel/useAgentKnowledge, fake isolated controller,
  390-pixel viewport, dark theme, English/Arabic. Five optional skills were inline; chips and
  horizontal overflow were zero; seven creative skills activated automatically; replacing the prompt
  cleared explicit choices. Local Chromium needed a sandbox override. One initial 20-second fixture
  setup timed out while concurrent build/dependency optimization was active; the same final fixture
  passed after those checks completed, without a product change.

The [browser artifact](verification-request-skills-browser-2026-10-13.json) records local component
behavior with a fake controller, not a live model generation or a deployed application check.

## Independent review and scoped convergence

Fresh native read-only review found definite-object routing, copy-reference routing, opaque-ID
deadline bypass and existing-scene ownership defects. Their repairs passed focused regressions.
Additional findings covered empty/unattached Graphics and empty textures, page-planning lifetime
forwarding, prefix-only skill parsing, stable queued identities and continuation seams in Improve,
Clarify, Retry and planned Build. Repairs retain bespoke content, ordinary metadata edits and
current enabled/trust/policy gates. Final fresh native read-only review found no remaining
actionable finding. Its independent checks passed: server 27, intent/creative 48,
engine/planner/witness 110, and final skill lifecycle/revival 31 tests. The earlier Retry test
failures were resolved in the final source and verified by a fresh rerun.

Scoped `speckit-converge` checked SP-008..011: four requirements, eight plan constraints and nine
constitution principles. A final continuation check found one medium partial SP-011 gap: revising a
pending plan could reparse an old skill token after its rename, rather than reuse its captured
semantic brief. Phase11/T270 records the repaired finding. A fail-first real-controller test
reproduced the rename leak; the repair and both rename/collision cases passed independent review.
Final reassessment found zero missing, partial, contradicting or unrequested gaps, appended no
further task, and kept tasks byte-for-byte unchanged during assessment. The later completion update
records these passed gates. This is scoped convergence for this increment, not completion of the
older feature014 release plan.

| Requirement | Implemented evidence                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SP-008      | Shared `run-deadline.ts`, edit and page-planning integration, Stop/timeout/late-callback regressions, private inherited build deadlines.                                             |
| SP-009      | `call-lifetime.ts` and `plan-call.ts`, handler/main configuration, SDK stream retry control, stalled-stream/cache/fallback regressions.                                              |
| SP-010      | Shared explicit-creation grammar, real-document ownership summaries, final reachable scene validation through repair/salvage, partial records and real application events.           |
| SP-011      | Existing enabled registry activation, Arabic creative cues, inline chooser, request snapshots, current enabled filtering, queue/continuation/revival regressions and browser checks. |

## Reproducing the local checks

Use installed owner binaries; no install is needed. From `packages/builder/ai`, run
`node node_modules/vitest/vitest.mjs run src/intent src/skills/creative src/creative` and the
focused engine/planning suites. From `apps/playground`, run the incident controller, knowledge,
prompt-skills, progress, EditRecord, SkillSlash and provider-config suites. From `apps/ai-server`,
run `node node_modules/vitest/vitest.mjs run`; fake HTTP tests require local socket permission.

Production checks use owner `node node_modules/vite/bin/vite.js build`; Storybook uses
`node node_modules/storybook/dist/bin/dispatcher.js build --disable-telemetry --quiet` and
`node node_modules/vitest/vitest.mjs run --config vitest.config.ts SkillSlash.stories.tsx EditRecord.stories.tsx AgentPanel.stories.tsx`.
The full catalog and these stories remain durable UI fixtures; the saved JSON is a separate local
component probe.

The user's “لا، اكتفِ بالمراجعة المحلية” instruction continues to apply. No external Codex CLI
review, full professional-sdd CLI run, paid generation, dependency installation, saved-data
migration, commit, push or deployment occurred. Live latency, token cost and representative model
design quality remain unmeasured. A successful static scene witness cannot prove painted pixels or
that a bespoke narrative matches the original request; runtime probes and real model evaluation
remain separate evidence. No requested implementation or local verification work remains for this
bounded increment.
