# Continue editing the existing creative artifact

User-authorized continuation, 2026-10-20: follow-up changes and additions must edit the mural or
other existing artifact instead of unexpectedly creating a new one. Preserve all uncommitted
T282–T292 work.

## Scope and acceptance

Owner: `packages/builder/ai` intent, target/context assembly, creative editing guidance and
command/application checks; `apps/playground` existing agent controller/continuity integration.
Direct consumer and `apps/evals` verification may be added if needed. No new UI component,
dependency, package, stored-document rewrite, deployment or paid provider request.

- F1: Requests to modify/extend an existing scene remain edits, including brief anaphoric
  follow-ups. Explicit new-artifact/page requests still create. Do not reinterpret questions as
  mutations.
- F2: Explicit selection/target wins. Without it, use only grounded current-page evidence such as a
  unique relevant artifact or a still-valid successful prior target. Ambiguous targets need
  clarification; never silently choose unrelated content or create a substitute.
- F3: The writer receives the current authored content of the existing target and instructions to
  preserve unrelated scene structure, styles, controls and behavior. Context truncation must not
  masquerade as complete source.
- F4: Updates preserve target identity, sibling content, current user edits and undo. Prevent
  demonstrated destructive/new-artifact fallbacks in the edit path without broadening permissions.
- F5: Regressions cover mural additions, story/game follow-ups, explicit new requests, ambiguity,
  selection/page changes and actual applied content. Distinguish deterministic tests from live
  provider adherence or artistic quality.

## Plan, review and verification

Trace routing, controller target continuity, source context, proposed commands and real application.
Reproduce concrete failure paths before choosing bounded repairs. Prefer existing APIs/state over
new persisted tracking. Keep package direction unchanged and existing oversized files below
baseline. No new component means no new component Storybook contract.

Bounded read-only workers may independently audit controller and source/command paths;
implementation leases are assigned only after evidence and ownership are clear. The primary
integrates, reviews, verifies, converges and updates handoff. Continuing local-only native
independent review applies.

Run focused regressions, owner and affected consumer types/lint/build, workspace boundaries/size,
and browser checks when runtime behavior changes. No original failed prompt/document is available;
do not claim its exact cause or live-model reliability. Rollback is source-only, no migration.

## Implementation evidence

Reproduced before repair:

- Nine follow-up additions, including `أضف مشهد تفاعلي للجدارية`, took creation routes. Immediate
  creative destination grammar now keeps them in the edit route. Explicit new-object wording
  (`Create a new mural`, `اصنع جدارية جديدة`) also had a separate two-case failure: it now appends
  when no explicit target is selected, while the established selection precedence remains.
- Reusing `scene.preset` for an existing preset reset custom program/settings. Four failing
  regressions now preserve program, markup, CSS, metadata and unrelated settings while merging only
  requested parameter changes.
- A proposal prepared from old JS overwrote a newer user JS edit. Authenticated proposal evidence
  now captures the original values of overwritten current-page custom-code properties. The apply
  door refuses conflicts atomically with `stale-source`; untouched properties/siblings remain
  editable and one Undo reverses only the AI transaction.

The writer already received full focused source. A >32k source regression confirms the smaller
scene-cue scan is not source truncation. Reviewed continuation instructions now explicitly preserve
the existing artifact, and a missing edit source no longer gets creation-only ready scenes.

Playground ownership captures explicit targets, exact authored names and grounded prior successful
targets in the original outgoing request. Local ambiguity/missing-target responses do not require
the optional enhancer or a provider. Inferred ownership persists through queues and Retry.
Independent review also exercises ordinary-section follow-ups, explicit medium conflicts and
cross-page identity, including site lenses sharing a transaction log.

## Final local verification

- Intent: 10 files / 2,200 tests passed after the explicit-new and descriptive-destination repairs.
- Plan/application, source conflicts and agent/context: 33 files / 426 tests passed.
- Build regression, including streamed landing, safety and creative kit delivery: 7 files / 90 tests
  passed.
- Intent/context/presets earlier integrated group: 12 files / 2,324 tests passed before the two
  explicit-new cases were added. These groups overlap and are not a combined total.
- Playground controller/model/error/catalog: 15 files / 243 tests passed; after copy/fixture
  extraction, the focused 5 files / 115 tests passed again.
- Builder AI owner, public builder facade, AI-server and Playground consumer TypeScript passed.
  Scoped AI/app ESLint and formatting passed.
- Production AI-server and Playground builds passed. Existing Vite placeholder URL and large lazy
  chunk warnings remain, as recorded by the earlier increments. Configured initial-load budgets
  passed: entry 550,950/896,000, JS 1,087,870/1,151,000 and CSS 145,879/147,000 gzip bytes.
- Workspace 37 members, components 260, file sizes 4,530 files, package boundaries 5,928 files / 37
  packages and `git diff --check` passed. No size baseline was increased.
- Independent native, read-only review: final AI 4 files / 158 tests, app follow-up/failure 3 files
  / 85 tests, and engine error classification 5 tests passed. No actionable findings remain in the
  reviewed behavior. The final copy/fixture extraction and captured skill snapshot received a
  bounded review; catalog/ErrorRecord verification passed 2 files / 73 tests. Review is closed.

The review repaired descriptive destination grammar, explicit new-object routing, named-label
precedence over whole-page intent, ordinary/creative and mixed-medium ambiguity, exact runtime page
ownership, Ask Apply/Preview and reloaded targeted Retry. Actual site lenses with identical node IDs
and a shared transaction log are covered; transaction membership alone is not page identity.

No new component, dependency or persisted schema. Existing error presentation receives a distinct
source-conflict reason. Source guards intentionally do not change the explicit `plan + policy`
compatibility API or foreign script pages for which no original source was captured. Deterministic
tests prove routing, context and application behavior; they do not prove live provider adherence to
preservation instructions or creative quality. The source-property guard is not a general
subtree-topology concurrency guard. Follow-up continuity uses completed successful work; a
deselected anaphoric request queued during a different unfinished run can still inherit the last
completed target, so explicit selection remains authoritative there. No browser rerun, live provider
evaluation, full CI, commit, push or deployment is claimed.

Representative reproducible commands (groups above overlap):

```sh
pnpm --filter @craftkit/builder-ai exec vitest run src/intent --maxWorkers=1
pnpm --filter @craftkit/builder-ai exec vitest run src/plan src/agent/errors.test.ts src/agent/run-agent.test.ts src/agent/scene-edit-context.test.ts --maxWorkers=1
pnpm --filter @craftkit/playground test use-agent-controller src/features/agent/model/creative-followup.test.ts src/features/agent/model/failure-class.test.ts src/features/agent/components/ErrorRecord/ErrorRecord.test.tsx src/features/agent/copy/catalog.test.ts src/features/agent/copy/copy-rules.test.ts --maxWorkers=1
pnpm --filter @craftkit/playground build
pnpm --filter @craftkit/playground check:size
pnpm check:workspace
pnpm check:components
pnpm check:file-sizes
pnpm check:boundaries
```

Convergence: F1–F5 / T293–T297 complete for this local increment. Prior T282–T292 changes remain
uncommitted and preserved. The other device is unchanged until a separately authorized rollout.

## Manual product acceptance

Open or generate a mural, deselect it, then ask for an addition such as
`أضف مشهد تفاعلي مع شخصيات داخل الجدارية`. It should keep the existing artifact and its other
scenes. Repeat with a story/game and test Undo. With two plausible artifacts and no grounded target,
the agent should ask for selection before calling a provider. Explicitly request a new mural without
a selected target to exercise creation. Change the targeted source while a proposal is being
prepared to verify the visible newer-content message and fresh Retry. This product check is not
recorded as a live-provider or browser pass in this increment.
