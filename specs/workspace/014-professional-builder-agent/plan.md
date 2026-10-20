# Implementation Plan: Professional Builder and Agent

**Branch**: `builder-core` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

## Summary

Current implementation:
[professional reports and chart capabilities](report-capabilities-2026-10-20.md). Extend bounded SVG
chart contracts, Key Stats and deterministic agent tools without a new runtime.

Current implementation: [second-prompt execution and reports](second-prompt-reports-2026-10-20.md).
Repair request ownership, truthful continuation history and deterministic analytical correctness.

Current continuation plan: [creative follow-up edits](creative-followup-2026-10-20.md). Trace and
repair existing-target routing, complete source context and non-destructive application.

Current follow-up plan: [scroll murals and creative build gaps](mural-scroll-2026-10-20.md).
Runtime-owned scrolling/layout and generation guidance are verified together; prior fixes remain.

Current bounded incident plan: [creative agent reliability](reliability-2026-10-20.md). It preserves
kernel-only writes and native independent review, and distinguishes local reproduction from the
unobserved failure on the user's other device.

Current speed implementation and verification scope:
[scene initialization and server latency](scene-speed-2026-10-13.md).

Scoped review exception for that increment (2026-10-13): the user explicitly instructed “لا، اكتفِ
بالمراجعة المحلية” after automatic approval review rejected the external Codex CLI review.
Rationale: the user declined that external action and accepted completed local independent review
with repaired findings. Owner: primary integration agent. Scope: SP-001..004 / SP-T5 / T260 only.
The fresh external runtime review is waived here; no CLI execution or pass is claimed. Removal
condition: a new explicit user instruction authorizing external review for this increment. The
generic constitution and other feature/release gates remain unchanged.

User-authorized speed/reliability and visual follow-up (“1+2”, 2026-10-13) is specified in
[SP-005..007 and T261..264](scene-speed-2026-10-13.md#authorized-reliability-and-visual-follow-up--2026-10-13).
It preserves package direction through public marketing/Builder stylesheet entries and the existing
Playground export rendered-class CSS callback. The same local-only review preference applies to this
continuation; owner: primary integration agent; remove that review exception only after a new
explicit user instruction authorizing an external review action. Local verification remains distinct
from live provider measurements and the broader feature release gates.

Extend the existing one-site kernel with versioned authored React projects. Render code-backed pages
through an isolated page runtime, connect visual selection to stable source identities, add reliable
draft recovery and page commands, then route the Agent through small deterministic tools and
measured model policies. Existing declarative pages stay supported. The approved 2026-10-10
increment adds Frontend dashboards and workflows; generated backends remain outside this feature.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React/React DOM 19.2.8  
**Workspace**: Node 24.19.x, pnpm 11.23.0, Turborepo 2.10.10  
**Primary Dependencies**: Zod, Immer, Zustand vanilla, Vite, Vitest, Storybook, Playwright,
CodeMirror 6, esbuild, Tailwind 4  
**Storage**: existing IndexedDB `VaultStore` with explicit durable/session-only acknowledgement;
content-addressed rebuildable artifacts  
**Testing**: Vitest and property tests, Storybook interaction tests, Playwright
Chromium/Firefox/WebKit, promptfoo/live provider harness, blind human visual review

**Performance Goals**: local edit-to-preview P95 <=500ms; restore acknowledged local source <=2s;
first real authored preview target P50 <=10s/P90 <=20s in the dedicated live benchmark

**Constraints**: one site writer, backwards-compatible v1 migration, no arbitrary npm install,
cross-origin preview, cancellable workers, one substantive component per TSX file  
**Scale**: multi-page marketing sites; one mutating run and one queued request per project; default
three and maximum six path-disjoint generation workers

## Constitution Check

| Gate                                              | Decision                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Spec Kit is the source of truth                   | PASS — feature 014 owns spec, research, contracts, plan, tasks, and checks.              |
| Kernel is the only writer                         | PASS — source changes are CAS-protected site transactions.                               |
| Persisted data is versioned and validated         | PASS — v2 migration and separate structural/compile validation.                          |
| Dependency direction is acyclic                   | PASS — new runtime is layer 2 and imports builder schema only internally.                |
| Apps import the builder family through the facade | PASS — preview is a deployable bootstrap; reusable contracts stay in packages.           |
| UI component artifact completeness                | PASS — every planned component includes export, story, MDX, and behavior test.           |
| Accessibility, RTL, responsive, and theming       | PASS — explicit requirements and browser matrix.                                         |
| Verification and honest evidence                  | PASS — deterministic tests block; live latency and human scores are reported separately. |

ADR 0004 remains valid for marketplace/organization declarative manifests. A new ADR defines
trusted, site-authored code as a distinct artifact category executed only in the isolated runtime.

## Workspace Ownership and Dependency Direction

### Existing members changed

- `builder-schema`: v2 site, code project, page reference, selection/source, insertion, catalog,
  artifact, run, persistence, and bridge contracts.
- `builder-core`: migrations, reference validation, code transactions, page commands, history and
  revision semantics.
- `builder-transforms`: versioned projection/parsing for source-bearing sites.
- `builder-shell`: unified selection, source-aware overlay, insertion anchors, and responsive
  panels.
- `builder-code-view`: lazy CodeMirror surface, diagnostics, completion, diffs, and source
  navigation.
- `builder-ai`: run/tool contracts, context index, model-routing policy, progressive units, and
  costs.
- `builder-editor` facade: public exports and composition ports.
- `builder-shadcn`, `builder-magicui`, `builder-aceternity`, `builder-motion`, and primitives:
  managed runtime catalog artifacts and ordinary React adapters.
- `apps/playground`: product composition, compact Agent, page/map UI, persistence and recovery.
- `apps/ai-server`: provider capability probe, scheduler, usage, prompt caching, and worker
  supervision.
- `apps/evals` and `apps/storybook`: end-to-end, browser, security, performance, and visual
  evidence.
- `workspace-tools`: layer registration and browser/compiler graph checks.

### New members

- `packages/builder/code-runtime` (`@craftkit/builder-code-runtime`, layer 2): contracts, compiler,
  browser bridge client, catalog resolution, source instrumentation, build cache, and export
  assembly.
- `apps/code-preview`: cross-origin static preview bootstrap that loads immutable artifacts and
  exposes the validated bridge. It imports only the Builder facade browser entrypoint.

The facade passes managed catalog ports downward. The runtime never imports extension packages,
shell, editor, apps, or app-owned persistence. Apps do not import each other.

## Public APIs and Data Flow

Public contracts are defined in [data-model.md](data-model.md) and [contracts](contracts/). The key
facade entrypoints are `code-runtime`, `code-runtime/compiler`, `code-runtime/browser`, and
`code-runtime/export`. Browser and compiler dependency graphs remain physically separate.

Generation captures target and base revision, retrieves only relevant files, emits expected-hash
patches into a persisted run draft, compiles the exact draft revision, streams valid artifacts to
the preview, checks function and visual gates, and commits the final source as one site transaction.

Manual invalid source persists independently of a valid artifact. Preview and export consume only
revision-matching artifacts; last-good preview is labelled and can never be silently published.

## UI Component Artifact Matrix

| Component           | Owner                      | Required states and artifacts                               |
| ------------------- | -------------------------- | ----------------------------------------------------------- |
| `AgentDockHeader`   | playground preview feature | compact/default/RTL; TSX, export, story, MDX, test          |
| `AgentContextBar`   | playground preview feature | site/page/instance/shared/stale; full artifact set          |
| `AgentRunCard`      | playground preview feature | queued/running/stopped/failed/done; full artifact set       |
| `QueuedRequestCard` | playground preview feature | editable/stale/missing target; full artifact set            |
| `PersistenceStatus` | playground vault feature   | saving/durable/session-only/error; full artifact set        |
| `PageActionsMenu`   | playground preview feature | normal/home/last/linked; full artifact set                  |
| `SiteMap`           | playground preview feature | empty/selected/shared-impact/RTL; full artifact set         |
| `SelectionToolbar`  | builder shell              | native/source/instance/multi/limited; full artifact set     |
| `InsertionPicker`   | builder shell              | before/after/inside/stale/generating; full artifact set     |
| `SourceImpactBar`   | builder code view          | local/shared/stale; full artifact set                       |
| `CodeEditor`        | builder code view          | loading/valid/invalid/read-only; full artifact set          |
| `CodePreviewFrame`  | builder shell              | loading/matching/older/error/unavailable; full artifact set |

Default geometry is a 48px top bar, 48px tool rail, 320px left panel resizable from 288px to 480px,
288px Inspector, and 44px Agent header. The Composer grows from two to six lines. Both desktop side
panels remain open only when at least 640px remains for Canvas; otherwise opening one replaces the
other without losing drafts. Phone widths use sheets. Fit-to-width changes editor zoom and never the
selected site breakpoint. Release tests measure actual bounding rectangles at the viewport matrix.

## Runtime operational limits

The runtime profile declares compiler and prerender deadlines, memory/output ceilings, allowed
network and asset capabilities, and a five-second preview heartbeat deadline. The application worker
supervisor terminates owned execution after a deadline or missed heartbeat, rejects all subsequent
results, and offers Retry from saved source. Compiler/prerender workers and the preview frame cannot
block editor input or obtain editor authority.

Quota or durable-write failure never advances the durable save sequence. Session memory retains the
draft and exposes recovery/download actions. Artifact cleanup removes rebuildable output before
source or completed run checkpoints; a source missing through external eviction is reported
directly.

## Evaluation protocol

The versioned manifest contains 20 generation briefs and their declared follow-up scenarios. Each
candidate and reference policy receives identical cases in separately reported cold and warm cache
conditions. Evidence records manifest hash, code revision, reference hardware, provider, model,
settings, every attempt, and unknown usage. Three independent blinded raters use an anchored
four-point rubric. Accepted output passes functional and export gates, contains no critical defect,
and reaches the declared visual threshold. Accepted-output cost divides all attributable attempts,
repairs, review, and escalation by accepted outputs; unknown usage is never treated as zero.

Browser release coverage includes light and dark editor chrome, authored site themes, LTR/RTL,
reduced motion, keyboard-complete editing flows, visible focus, labelled controls, correct focus
return, zero critical or serious automated accessibility violations, and documented manual contrast,
zoom, and focus-order review.

Composition roots only assemble these components; no sibling component declarations are nested.

## Implementation Phases

1. **Contracts and vertical slice**: v2 schema/migration, runtime member, catalog port, compiler
   worker, preview bootstrap, one reference TSX page, source handle, literal edit,
   undo/save/reload/export.
2. **Reliable editing and compact Agent**: persistence acknowledgement, recoverable run draft,
   unified selection, toolbar/text/drag behavior, compact dock and queued request.
3. **Pages and insertion**: atomic page commands, stable links, duplication, map/list
   synchronization, exact insertion anchors, shared-impact preview.
4. **Free composition and source UX**: managed catalogs, CodeMirror, broader AST patches, Tailwind,
   dynamic capability rules, multipage preview/export.
5. **Production Agent**: real provider wiring, tools, scheduler, cancellation, model routing, all
   cache layers, usage and accepted-output cost.
6. **Evaluation and rollout**: security/browser/export suites, full corpus, independent visual
   review, feature flags, docs, rollback and full verification.

## Build, Deployment, Migration, and Rollback

- Site v1 migrates deterministically to v2 with empty `codeProjects`; existing page projections stay
  compatible. Writers emit v2 after migration; readers reject unknown future versions.
- `apps/code-preview` is deployed on a dedicated origin with strict CSP and immutable artifact
  paths. Preview-origin configuration is app-owned and environment-specific.
- Worker artifacts are keyed by source/dependency/compiler/runtime/catalog fingerprint. A runtime or
  catalog deployment invalidates affected artifacts without touching sources.
- Feature flags independently gate v2 authoring, source-aware editing, remote Agent generation, and
  export. Rollback disables new creation while retaining the v2 reader and existing sources.
- No downgrade or source deletion occurs during rollback. Existing declarative pages remain the
  fallback creation path until the new path meets release gates.

## Verification

Narrow checks run from changed module to owning package and consumer. Required cross-cutting checks:

```sh
pnpm check:workspace
pnpm check:components
pnpm check:boundaries
pnpm check:graph
pnpm verify
```

Turbo-backed critical tests are rerun once with `--force`. Live provider and human-review evidence
is separate from deterministic local and CI checks. Details are in [quickstart.md](quickstart.md).

## Agent conversation and parallel-task implementation — 2026-10-10

Scope: `apps/playground/src/features/agent` owns the live panel, bounded composer, scrolling hook,
per-build concurrency choice and task display. `builder-ai` retains its real bounded section pool
and ordered landing; changes there are limited to regression coverage or proven integration gaps.
`apps/evals` owns an isolated local browser regression. No new dependency or server rewrite.

Design direction: quiet, dense professional workspace, strong conversation/action hierarchy,
existing tokens and logical RTL geometry, one focused composer edge. Task display uses actual engine
events, not synthetic personas. Existing auto engine maximum eight is a staged legacy behavior,
distinct from the authored scheduler's default-three/max-six contract; the new live panel defaults
to three and offers one/three/six explicitly without silently rewriting legacy callers.

Independent UI work may own only existing panel/composer/thread/header styling, artifacts and the
scrolling hook. The primary owns concurrency contracts, controller wiring, task UI, integration,
browser evidence and continuity. Every new component needs its full five-artifact contract.

## Live telemetry and Pixi creative implementation — 2026-10-11

Approved requirements: PX-001..005. Owners: `builder-ai` provider/agent usage contracts and skills;
`apps/ai-server` measured usage transport; `apps/playground/features/agent` presentation/scroll;
`builder-media-engines` scene kit; `builder-schema` CK reference; `builder-renderer` generated kit
assets; `apps/evals` local browser fixtures. Apps still use the public builder facade. No migration,
new deployable, external writes or paid verification requests.

Additive scene contract: `s.input.down(code)`, `s.input.axis(negativeCodes, positiveCodes)`,
`s.input.set(code, held)` for DOM/touch controls, and `s.input.clear()`; keyboard capture only
within a focused scene, excluding editable controls. `s.fixedTick(fn, options)` uses seconds,
bounded catch-up and returns an unsubscribe. `s.story(chapters, initial?)` exposes `current`,
`go(id)`, `next()`, `back()`, `reset()` and `dispose()`; chapters have unique bounded ids and
enter/leave callbacks. No automatic story timer. Preserve one Pixi namespace and the library
allowlist; regenerate assets with the existing builder.

Usage is an additive optional provider callback/event and wire field/frame validated at ingress.
Retain older peers and context estimates. Only measured counts are actual; missing is unknown. The
chat retains bounded public statuses, not private reasoning, and real section pools/ordered landing.
Existing full component artifacts are required if a new UI component is introduced.

Creative expertise is explicitly forwarded in Plan/full-build lanes, which otherwise disable
automatic skill activation. Match the original brief at planning time and each scene's own contract
at writing time; only the hero also inherits the original creative brief. Retry/Finish preserve this
targeting. An opted-in creative scene bypasses fixed kit-only writing; ordinary sections do not.
Retain existing budgets, dependency resolution and command policy. Attempt retention is bounded at
64, with persisted overflow forcing unknown totals rather than reporting a partial sum.

Delegation: one worker owns telemetry across AI provider/agent files, server adapters and playground
Agent feature (not skill files). Another owns Pixi AI skill files/registration/tests only. Primary
owns scene runtime, schema reference, generated assets, dependencies, docs/governance, browser
fixtures and integration; shared barrels require coordination. No recursive delegation. Final review
uses a fresh read-only worker.

Verify focused tests, owner/consumer types, generated assets, runnable Chromium scenes, chat
scroll/progress/usage regression, component/workspace/boundary checks and the real diff. Record
broader unrun or failing gates. Evals browser tests use a separate DOM/JSX-capable TypeScript
project; the model-quality harness and Node services retain their headless configuration. Evals
typecheck checks both projects. Rollback is reverting this additive source/asset increment; no data
deletion, weakened permission gates or rewritten project dependency locks.

## Baseline quality repair — 2026-10-10

`builder-shell` owns the InspectorPartPanel MDX literal fix. `builder-custom-code` owns the existing
ScriptParamsForm's local export, stylesheet, stories, MDX and behavioral tests. The existing
Storybook globs already include both owners; retain the configuration and its a11y/indexing gates.
No dependency or production composition change, public root export, data migration or deployment.

Use the existing chrome tokens and logical CSS properties. Document the controlled stored-values
contract and preview-only callbacks separately from undoable commits. Do not rewrite the dormant
form or introduce additional UI components merely to complete its artifacts; fix runtime gaps only
when focused checks demonstrate them. Run component/package tests, custom-code types/lint,
changed-file formatting, repository component/boundary contracts and the complete static Storybook
build, plus focused Chromium story interactions and a fresh read-only review. Full release and
unrelated bundle budgets remain separate gates.

Bounded existing-code exception: this artifact-only repair retains ScriptParamsForm's existing
`renderControl`/`renderParam` helpers rather than changing its dormant implementation architecture.
Owner: `builder-custom-code`. Rationale: expanding this build/documentation fix into a form rewrite
would change unrequested behavior. Removal condition: extract substantive control/row components
with full artifacts before new production wiring or substantial form behavior work. This exception
does not permit new nested/sibling production components.

## Approved quality and Frontend increment — 2026-10-10

Scope: `apps/evals` owns Node/Playwright axe evaluation and bounded reports; `builder-media-engines`
owns pinned Embla and its lazy browser entry; `builder-renderer` owns serialized carousel
integration and export/injection; `builder-editor` owns managed-catalog admission; `builder-ai` owns
shared authored design guidance; `apps/ai-server` consumes it through the public wire facade. No new
React UI component.

Keep axe (MPL-2.0) in development evaluation only, never generated-site assets. Embla (MIT) gets a
generated self-contained lazy asset with its full notice, a gzip budget and digest. Carousel pack
stays serializable with native fallback, no DOM reparenting (including React previews), no editor
drag capture, cancellation and exact teardown. Managed catalog builds Embla separately. Its complete
manifest/module fingerprint changes artifact identity; the existing v1 lock/profile identifier stays
compatible because all old pins and modules are retained.

Shared authored teaching chooses composition from the user brief and existing page purpose; it does
not introduce a rigid classifier, mandatory page count, fake backend or unrestricted package
imports. Use mocked provider capture tests for actual prompt wiring and real compiler/catalog tests.
Browser checks exercise published Embla and actual axe positive/negative fixtures without provider
calls. Independent read-only review and scoped evidence are required; the rest of feature 014 is not
complete.

## Deferred Pixi package roadmap — next session, 2026-10-12

Recorded at the user's request on 2026-10-11 for tomorrow's work. **Planning only: not installed,
implemented or agent-admitted.** This backlog does not reopen completed PX-001..005 or authorize
execution today. On an authorized continuation, amend the scoped specification, clarify the first
slice, revalidate dependency versions/licenses and approve its plan/tasks before implementation. The
date is a continuation target, not an automatic scheduled run or a one-day completion promise.

### Priority and outcomes

| Order          | Candidate                                                                       | Concrete capability and acceptance example                                                                                                               | Admission condition                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1              | [@pixi/tilemap v5](https://github.com/pixijs-userland/tilemap)                  | A tile-based 2D level with a working camera and playable controls, using admitted tileset assets                                                         | Verify the Pixi v8 peer range and a lazy adapter using the existing Pixi namespace; tilemap renders a world, not a complete game engine                                                                   |
| 2              | [inkjs](https://github.com/y-lohse/inkjs)                                       | A branching Arabic/English story with actual choices, variables, different outcomes and validated state restoration                                      | Keep story compilation in tooling; admit only a bounded runtime/data contract, not arbitrary imports or external functions                                                                                |
| 3              | [@assetpack/core](https://pixijs.io/assetpack/docs/guide/getting-started/pixi/) | Generate a sprite atlas, optimized images and an asset manifest from approved project assets; compare actual sizes and loading with the original fixture | Build-time dev dependency only, with a declared owner and reproducible outputs; never ship the asset-processing toolchain in editor or exported runtime bundles                                           |
| 4, conditional | [@pixi/layout](https://github.com/pixijs/layout)                                | Responsive in-canvas HUD/inventory layout at narrow/wide widths                                                                                          | Use only for real canvas UI needs; verify Yoga/WASM packaging and extension load order before admission. Ordinary forms/navigation remain accessible DOM                                                  |
| 5, conditional | [@esotericsoftware/spine-pixi-v8](https://esotericsoftware.com/spine-pixi)      | One licensed skeletal character with meaningful idle/move/action transitions and exact teardown                                                          | Resolve [Spine runtime licensing](https://esotericsoftware.com/spine-runtimes-license), obtain licensed skeleton/atlas assets and match editor/runtime export versions before installation or integration |

Start with Tilemap and Inkjs as separate verified slices, then AssetPack. Layout and Spine are
conditional follow-ups, not an automatic install list. Existing Matter, viewport, filters, brush,
rough drawing and sound stay in use; do not add a duplicate engine or replace them without evidence.

### Owners, contracts and compatibility

- `packages/builder/extensions/media-engines/src/studio/` owns runtime adapters and lifecycle tests;
  its manifest owns admitted runtime dependencies. AssetPack's initial tooling owner is the same
  package, through a build-time public/tooling entry only.
- `packages/builder/schema/src/studio/` owns bounded library keys, scene/member references and any
  versioned narrative data/save contract. Existing `s.story()` chapter behavior remains supported;
  new story state must not silently migrate or overwrite saved pages.
- `scripts/build-studio-engines.mjs` and `packages/builder/renderer/src/engines/studio/` own
  generated lazy assets and shared preview/export loading. AssetPack configuration belongs with its
  owning package; outputs carry asset identity/provenance and deterministic manifests. Regenerate
  sources; never hand-edit them.
- `packages/builder/ai/src/skills/` owns precise Arabic/English activation, actual APIs and runnable
  worked examples. `apps/ai-server` consumes teaching only through public builder/wire APIs;
  `apps/evals/src/pixi-creative/` owns deterministic/browser fixtures. Apps never import other apps.
- The primary owns shared contracts, manifest/catalog pins, lockfile, provenance, integration and
  review. Delegate adapter, teaching or QA work only after exact path-disjoint leases are agreed. Do
  not create a new package or new editor UI solely for these dependencies. Any justified new UI
  needs its TSX, local export, typed story, MDX and behavior/accessibility test before acceptance.

### Definition of done for each admitted capability

1. Verify current official compatibility, licenses and exact catalog pins at implementation time.
   Record provenance; measure its gzip/asset budget without raising existing gates to hide growth.
2. Runtime add-ons are separate lazy assets, share one Pixi namespace and do not inflate the main
   editor bundle. Preserve owned cleanup, scene-local input, cancellation, resize, visibility,
   reduced motion and the existing Free-code opt-in. Bound tile counts, story steps and asset input.
3. Wire the real allowlist/API, loader, preview and standalone export before advertising support.
   Studio admission is not managed React catalog admission and must not rewrite project locks.
4. Teach the Agent the implemented capability in planning, relevant scene-writing and Retry/Finish
   contexts. Cover positive creative briefs and negative ordinary-business briefs; skills grant no
   extra authority. Use licensed asset examples and honest missing-asset fallback, not fabricated
   art.
5. Run owner module tests/types first, then real generated-runtime preview and standalone export
   examples at narrow/wide LTR/RTL with keyboard/touch controls and reduced motion. Include
   malformed input, missing assets, bounded execution and disposal regressions. Extend existing
   browser tests to cover each new capability; passing today's fixtures alone does not prove new
   support.
6. Record fresh independent diff review, scoped convergence and measured results. Local fixtures
   prove capability, not stronger model designs, faster generation or lower bills. Representative
   paid-provider evals and blinded visual ratings need separate authorization/availability.

Baseline commands to retain and extend after implementation:

```sh
pnpm --filter @craftkit/builder-media-engines build:studio
pnpm --filter @craftkit/builder-media-engines test
pnpm --filter @craftkit/evals test:pixi-creative:browser
pnpm --filter @craftkit/evals typecheck
pnpm check:workspace
pnpm check:components
pnpm check:boundaries
pnpm check:graph
```

Run owning AI/schema/renderer tests/types and direct-consumer builds as well; full release gates
stay separate. Dependency/asset fingerprints invalidate affected build caches. Rollback disables new
admission/creation while retaining readers and data for existing projects; never delete sources or
validated saves to undo a dependency change. No deployment or external asset upload is implied.

Execution checklist:
[deferred tasks T171–T178](tasks.md#deferred-pixi-package-roadmap--next-session-2026-10-12).

### Execution status — 2026-10-12

Executed at the user's request as CE-001..007 (spec). Tilemap and Inkjs are admitted as lazy assets;
first-party `anim`, `fx` and `dialogue` libraries, the creative planner, the story bible memory,
five creative skills and the StoryBiblePanel were added. Decisions that differ from the roadmap
above:

- **Ink compiles at run time inside the lazy `ink` asset** (64.8 kB gzip, own 66 kB budget).
  Agent-authored scenes carry Ink text and have no tool-side compile step; the compiler never
  reaches editor or ordinary page bundles, and source/JSON/step bounds apply.
- **Tilemap pipe registration on a live renderer** (`tilemap/pipe.ts`), because `ck.scene` loads
  libraries in parallel with stage creation.
- **AssetPack deferred** (native `sharp` build disallowed), **Layout deferred** (no HUD need),
  **Spine deferred** (licence/assets) — recorded in T174/T176/T177.

Ownership followed this plan: runtime in `media-engines/src/studio/libs/`, data contracts in
`schema/src/studio/`, generated assets via `scripts/build-studio-engines.mjs`, teaching in
`ai/src/skills/creative/` and the new `ai/src/creative/` domain, fixtures in
`apps/evals/src/pixi-creative/`, UI in `apps/playground/src/features/agent/`. Evidence:
[verification-creative-engines-2026-10-12.md](verification-creative-engines-2026-10-12.md).

## Empty-canvas incident and request-skills follow-up — 2026-10-13

Execute the bounded implementation and verification plan for SP-008..011 in
[the canonical scene increment](scene-speed-2026-10-13.md#authorized-empty-canvas-and-request-skills-repair--2026-10-13).
The continuing user instruction to use local review supersedes the external CLI review requirement
for this incident follow-up; primary owns the scoped exception until new explicit authorization. Use
fresh native independent review, preserve earlier diffs and report live-provider limits.
