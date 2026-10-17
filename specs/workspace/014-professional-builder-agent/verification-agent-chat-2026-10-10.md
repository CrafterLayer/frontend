# Agent conversation and parallel-task verification — 2026-10-10

Follow-up resolution: the baseline Inspector MDX and ScriptParamsForm artifact blockers recorded
below were repaired in
[verification-baseline-quality-2026-10-10.md](verification-baseline-quality-2026-10-10.md). This
chat report's original results and remaining gates are retained as historical evidence.

Scope: CHAT-001..005 / T154..159 in `apps/playground/src/features/agent`, plus the local
`apps/evals` browser regression. Node 24.19.0 / pnpm 11.23.0. The existing staged work was the
baseline, not part of this increment. No dependencies, provider calls, staging, commits, pushes or
deployments were performed. Full feature 014 release acceptance remains open.

## Changes and actual execution

- The conversation observes content and viewport changes. It follows only while pinned; wheel, touch
  and focused-thread keyboard upward intent release it. Hidden zero-size reports retain a reader's
  nonzero offset. Jump to latest resumes following. Browser anchoring no longer competes.
- The writing field sizes to its content, starts at two lines and scrolls independently. Short
  panels use a smaller input/auxiliary budget. Clarification and paused-queue content scroll without
  clipping the toolbar, floating menus, Send or Stop. Controls wrap; model labels retain full
  accessible names; long operation titles use two lines; the writing focus edge is inset.
- The live controller offers one, three or six section workers, default three. The choice reaches
  the real `runAiBuild` pool and is locked during a run/check. Retry/Finish use the selected bounded
  pool and report its actual capacity. A paused queued build uses the choice made before Continue.
- `BuildTaskBoard` shows real row states: active, waiting, drafted, applied and failed, with a
  separate maximum pool count. Drafted work is not applied progress. The existing coordinator keeps
  validation/application ordered and each worker scoped to its own section. A single-target edit
  still uses one writer. This is not a general multi-agent code-project scheduler or a claim that
  every request is parallel.
- `BuildTaskBoard` and `WorkerMenu` have implementation, local export, typed stories, attached MDX
  and behavior tests. EffortMenu's existing missing story/MDX artifacts were completed. Attached MDX
  stories do not also enable `autodocs`.

The engine's staged automatic legacy maximum of eight remains unchanged for callers that do not opt
into this panel control. The authored Source Agent's separate default-three/max-six scheduler was
not rewritten.

## Passed checks

```sh
# cwd: apps/playground
node_modules/.bin/vitest run --config vitest.config.ts \
  src/features/agent/hooks/use-agent-controller.workers.test.tsx \
  src/features/agent/model/run-view.test.ts \
  src/features/agent/components/Composer/Composer.test.tsx \
  src/features/agent/components/ComposerToolbar/ComposerToolbar.test.tsx \
  src/features/agent/components/BuildRecord/BuildRecord.test.tsx \
  src/features/agent/components/BuildTaskBoard/BuildTaskBoard.test.tsx \
  src/features/agent/components/WorkerMenu/WorkerMenu.test.tsx \
  src/features/agent/components/RunRecord/RunRecord.test.tsx \
  src/features/agent/hooks/stick-to-bottom/use-stick-to-bottom.test.ts \
  src/features/agent/components/AgentPanel/AgentPanel.test.tsx \
  src/features/agent/components/UserMessage/UserMessage.test.tsx \
  src/features/agent/components/RunBar/RunBar.test.tsx \
  src/features/agent/components/EffortMenu/EffortMenu.test.tsx
# 13 files, 298 tests, exit 0.

# cwd: repository root; existing/new changed TS/TSX/MJS files supplied explicitly
node_modules/.bin/eslint <changed-source-files> --max-warnings 0
pnpm --filter @craftkit/playground build
pnpm --filter @craftkit/playground typecheck
pnpm check:workspace
pnpm check:boundaries
git diff --check
```

Worker tests exercise actual one/three/six concurrent provider gates, locked choice, reverse
completion with ordered landing, Stop with no late application, unsupported runtime values, retrying
six failed sections with a newly selected pool, and paused queued continuation at one. Existing
controller/landing/catalog checks separately passed 124 tests before the added queue case; these
overlapping counts are not added to the final 298.

## Real Chromium fixture

```sh
# Requires a Playground Vite development server; the fixture is not a production entry.
pnpm --filter @craftkit/evals test:agent-chat:browser http://127.0.0.1:5186
```

Passed nine variants: Arabic/English, light/dark, widths 288/320/480, heights 400/480/720, long
conversation, active edit/build, clarification, paused queue and composing. The narrow Arabic build
also renders the actual long model label, effort picker and free-code switch. At 288×400, that
full-control case retains 95px of conversation before input and more than 80px after nine typed
lines. No composer controls escape the panel. On 720px panels the initial thread takes at least 60%
of the height.

Real wheel movement leaves a nonzero reading offset. Appending content and hiding/reopening preserve
it. Jump to latest, viewport shrinking to 350px, and composer growth keep a pinned reader at the
bottom. Long input scrolls internally; every case checks conversation height after typing. No
uncaught page errors. Fresh browser context; AI endpoints intercepted; no provider calls.
Touch/keyboard intent additionally has focused hook tests, not a real mobile-device claim.

## Storybook and independent review

The default full Storybook build failed at the unchanged staged/HEAD
`packages/builder/shell/src/components/Inspector/InspectorPartPanel.docs.mdx:13`: literal
`<part label> · <block name>` is interpreted as MDX tags. This file was not changed.

A temporary config inherited the original Storybook main/preview and restricted indexing to
AgentPanel, ComposerToolbar, BuildTaskBoard, WorkerMenu, EffortMenu and RunRecord stories/MDX.
Actual Chromium story plays passed 90/90 (six story files; six MDX entries skipped as tests). The
scoped static Storybook build also passed. Commands:

```sh
pnpm --filter @craftkit/storybook exec vitest run --config .agent-chat-qa/vitest.config.ts
pnpm --filter @craftkit/storybook exec storybook build -c .agent-chat-qa -o <unique-private-tmp-dir>
```

The four temporary configuration files were removed after verification. Production Storybook
configuration was not changed. Scoped generated output is disposable under `/private/tmp`. The
task-owned Vite server on 127.0.0.1:5186 was stopped; existing developer servers were untouched.

A fresh independent read-only reviewer inspected the real increment and acceptance artifacts. Its
Medium finding was the unnamed ShortViewport combobox query after adding the native worker select;
repaired by naming the request field, and confirmed in second review. The unstated 60%
short-viewport assertion was changed to the measured >80px contract. Targeted indexing additionally
found duplicate automatic/attached docs in the three new story files; these were repaired and rerun.
Independent focused tests passed 61/61, and a separate queued-continuation rerun passed 1/1. Final
source recheck has no actionable findings. This is scoped review, not a completed full-feature
professional-sdd release workflow.

## Open gates and limitations

- The workspace contract passes for 36 members. Turbo boundaries checks 3380 files across all 36
  packages without issues. Component checking still fails on four existing ScriptParamsForm
  artifacts: export, story, MDX and test. It now counts 221 component folders; neither new chat
  component is missing artifacts.
- Full Storybook remains blocked by the Inspector MDX baseline above. Existing chunk-size,
  placeholder asset and ineffective dynamic-import warnings remain. No gate was weakened.
- Firefox/WebKit, real mobile gestures, full repository coverage/verify and live model/rater
  evaluation were not run. Faster generation and better design quality require real comparative
  output/latency/cost evidence; concurrent gate tests alone do not establish those improvements.
- Preview feedback/repair loops, generated backend authority and other unfinished feature 014 work
  remain outside this increment. Prior bundle-budget failures are separate earlier evidence.
