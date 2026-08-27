# Durable Agent Memory

This file stores validated decisions and reusable failure modes. It is not a task log. Current work
belongs in `HANDOFF.md` and `context.json`.

## Validated Decisions

- Spec Kit is the single governance and continuity system for Claude, Codex, Cursor, and future
  agents. Tool-specific files stay thin.
- The repository is expected to become a large multi-application monorepo. Workspace scope MUST be
  explicit before an agent creates specifications or code.
- The root Spec Kit project owns shared governance. Features use scoped directories under
  `specs/apps/`, `specs/packages/`, or `specs/workspace/`. Independent member Spec Kit projects are
  reserved for independently governed or released members.
- The initial frontend baseline is the latest patched React 19.2 line. React 19.2.8 was verified on
  2026-08-24, but agents MUST re-check before dependency installation.
- Architecture is feature-first with component-owned folders, thin routes, explicit package APIs,
  and no app-to-app or package-to-app imports.
- `docs/README.md` is the human-facing documentation index, and `docs/architecture/` is the only
  cross-workspace architecture tree. ADRs live under `docs/architecture/decisions/`; feature intent
  stays in `specs/`, while component API docs stay colocated beside components.
- One substantive React component is allowed per `.tsx` file. Nested or hidden sibling component
  declarations are prohibited.
- Every new UI component requires a local export, typed Storybook story, MDX docs, and
  behavior-focused test. These artifacts are one definition of done, not optional tasks.
- Sub-agents are created dynamically for bounded independent work. There is no permanent sub-agent
  registry; the primary agent owns integration and final review.
- Commit messages follow Conventional Commits and are generated from the actual staged diff. Agents
  never auto-commit or push without explicit user authorization.
- Local agent automation is packaged through Spec Kit: `workspace` owns delegation, review, handoff,
  and commit-message commands; `react-monorepo-quality` wraps core delivery commands; and
  `professional-sdd` is the full gated workflow. Generated integration skills are never edited
  directly.
- `@craftkit/query` creates caller-owned QueryClient instances and never exports a shared singleton.
  Browser roots may retain one client; SSR creates one client per request.
- `@craftkit/routing` targets React Router 8, imports DOM `RouterProvider` from `react-router/dom`,
  and keeps deferred child modules behind stable explicit parent ids.
- Route performance is governed by the Spec Kit `routing-performance` extension: measure production
  chunks, separate code and data prefetch, use repeat-safe intent prefetch, and keep host runtimes
  external from private library builds.
- `@craftkit/icons` is intentionally a metadata-only placeholder. It must remain free of source,
  runtime exports, dependencies, glyphs, tests, builds, and Storybook wiring until a separately
  approved icon-system specification exists.
- The `professional-sdd` workflow uses a fresh Codex invocation with `gpt-5.6-terra` for both
  mandatory implementation reviews, independent of the implementation integration. `gpt-5.6-luna` is
  an explicit fast-triage override, not a silent final-review fallback. If Codex or the selected
  reviewer model is unavailable, fail and report the missing review.
- Cross-runtime delivery uses the transport-neutral `speckit.workspace.delegate` contract. The
  initiating integration remains coordinator; Codex workers receive bounded path-disjoint tasks, and
  the coordinator inspects their real diff and reruns checks before acceptance. Mandatory review
  always starts a fresh read-only Codex context instead of reusing a worker. In `professional-sdd`,
  required delegation is enforced by a separately validated run-local JSON result, and mandatory
  review is launched with explicit read-only, never-approve, and ephemeral Codex flags; prompt
  wording alone is not an execution boundary.
- Codex is the project default integration. Codex-initiated work stays within Codex and does not
  invoke Claude unless the current user explicitly asks for Claude. Claude remains an optional
  entrypoint and may call Codex through the official `codex@openai-codex` plugin for bounded work.
  This one-way routing avoids agent ping-pong and duplicated context; it is not a guarantee of lower
  total token usage.
- The official Claude Code plugin supersedes the local `codex-craftkit-async` and
  `codex-craftkit-worker` experiments. Background jobs expose on-demand `/codex:status` and
  `/codex:result`; these commands do not provide unsolicited continuous progress. A workflow that
  must validate a result in the current step uses the plugin's foreground `--wait` route.

## Reusable Failure Modes

- If agents disagree, check whether rules were duplicated outside `.specify/`. Remove the duplicate
  and keep the tool file as a router.
- If Spec Kit writes to the wrong feature, verify both `SPECIFY_INIT_DIR` and
  `SPECIFY_FEATURE_DIRECTORY`; project selection and feature selection are independent.
- If a UI component is implemented without docs, stories, or tests, the work is incomplete even when
  the application builds.
- If parallel work collides, the delegation scopes were not path-disjoint. Stop, reconcile through
  the primary agent, and reassign non-overlapping ownership.
- If a commit message describes uncommitted or unrelated work, regenerate it from
  `git diff --staged` and report anything intentionally left unstaged separately.
- If one integration lacks a workspace command or quality wrapper, reconcile the Spec Kit packages
  for that integration rather than copying a skill directory by hand.
- In Spec Kit 1.0.1, `integration status` reports the preset-composed `plan`, `tasks`, and
  `implement` skills as modified base-managed files. When those are the only nine modifications and
  the preset registry owns all three integrations, treat the warning as expected composition; do not
  force an upgrade without re-checking this behavior.
- With the current dependency graph, pnpm's `trustPolicy: no-downgrade` rejects transitive
  `semver@6.3.1` from Babel. A one-time reviewed exclusion can generate the lockfile, but never
  persist or broaden a trust exception without explicit approval and a documented removal condition.
- If a delegated implementation thread is reused for mandatory review, the independence gate is
  invalid. Start a fresh read-only Codex review and establish findings from the artifacts and actual
  diff.
- If a workflow claims fail-closed behavior only in agent prose, the gate is not enforced. Require
  an engine-visible result or failing process exit; never assume a successful agent response means
  delegation or least privilege actually occurred.
- If a Claude-to-Codex bridge closes at startup, distinguish project-server name resolution,
  per-machine trust, and writable user-scoped Codex state from Spec Kit composition. Never move
  state or authentication into the repository; required delegation fails closed.
- If Claude shows only a static `Tinkering...` row, it is using the retired synchronous MCP route.
  Let in-flight work terminate, reload plugins or start a fresh session, and use the official plugin;
  do not start a duplicate task based only on a quiet UI label.

## Staleness Conditions

Re-validate this file when React, React Router, TanStack Query, or the selected reviewer model
changes major version or availability; the workspace layout is moved; package boundaries change; an
icon implementation is approved; the Babel dependency no longer requires `semver@6.3.1`; Spec Kit
changes its extension, preset, workflow, or monorepo model; the Codex delivery/review transport or
coordination contract changes; or the user changes the one-component, docs, story, and test
contract.

## Builder Kernel Invariants (validated 2026-08-25, B0)

Stale when: a later ADR supersedes 0003/0004, or a builder milestone re-plans a law.

- The JSON document is the only source of truth. `Node.props`/`responsive` are `JsonValue` BY TYPE;
  `defineBlockSchema` rejects non-JSON-representable zod shapes; dispatch walks every add/replace
  patch value (undefined included — immer encodes `x = undefined` as a replace patch, so
  `op === 'remove'` is the only skippable case).
- One validated door: every mutation is a named command; `defineCommand` erases to a
  `RegisteredCommand` whose `apply(unknown)` parses BEFORE the handler (naive
  `Record<string, CommandDef<S>>` fails strict TS on parameter contravariance).
- Sealed store: the zustand instance is module-private; the public API exposes only the read-only
  facade; every observable document change pairs 1:1 with a transaction; selection/seq are kernel
  bookkeeping, never transactions.
- Determinism: time and identity are injected ports; `ports/system-clock.ts` and
  `ports/system-ids.ts` are the ONLY ambient call sites (lint-enforced); fixed ports make property
  suites and replay bit-for-bit reproducible.
- Registration is all-or-nothing for BOTH tiers: probe every catalog key for clashes before
  inserting anything (a mid-manifest duplicate must not leave orphaned partial contributions — found
  and fixed in the B0 review).
- Tier-2 manifests are a separate `JsonValue`-typed interface (functions unrepresentable) plus a
  structural function walk at hydration; stored schema shapes are JSON descriptors compiled by
  Tier-1, never live zod instances (ADR 0004).
- Builder layer law (schema=0 → core=1 → engines=2 → shell=3 → extensions=4 → preset=5) is enforced
  by `validate-builder-boundaries.mjs` in `check:workspace`; new builder members MUST be added to
  its layer map deliberately (ADR 0003).
- Builder packages are internal-mode (src exports, no build) and headless: tsconfig `headless.json`
  (ES2024-only lib) makes DOM usage a compile error; there is no `setTimeout` headless, so
  persistence coalescing is count-based until B1 hosts.

## Builder View Invariants (validated 2026-08-25, B1)

Stale when: a later ADR supersedes 0003, or a builder milestone re-plans the view layer.

- Layer-2 siblings never import each other: `builder-renderer` receives the kernel BY PROP and owns
  its own `useSyncExternalStore` wiring; context/hook ergonomics live only in `builder-react`; the
  layer-5 preset is the only composer. Apps import ONLY `@craftkit/builder` — both directions are
  CI-fatal in `check:workspace`.
- View snapshots of kernel-side state MUST be kernel-INTRINSIC, never derived inside an event
  listener: the bus has no replay, so a change fired before a subscriber attaches is otherwise
  dropped (found as a High in the B1 review). The catalog version is `kernel.extensions.version()`;
  `useSyncExternalStore`'s post-subscribe snapshot re-check is what makes the intrinsic form
  race-proof.
- Merge-blocking suites assert COUNTS or load-invariant SCALING, never wall-clock: coverage
  instrumentation plus parallel turbo distorts timings 2–8× (SC-006 measured 227 ms best-of-15
  contended vs tens of ms solo). Absolute budgets belong to uncontended evidence runs and, later,
  the dedicated Lane-B job.
- Storybook only gates what its `main.ts` globs include: a new member with stories contributes
  NOTHING to the a11y error gate until a glob covers its path (the five playground components
  shipped ungated until the review caught it).
- `BlockRenderComponent` is the variance-erased stored form
  (`ComponentType<BlockRenderProps<never>>`); the single un-erasure cast lives in the renderer's
  NodeView/StaticNode. Fixture NullRender blocks never mount slot children — tree-walking tests need
  `withPassThroughRenderers`.
- Effects that copy external DOM (CanvasFrame's style mirroring) must be StrictMode-idempotent:
  cleanup removes what the invocation created, not just its observers.
- RTL Testing Library cleanup is NOT automatic without vitest globals; the shared
  `@craftkit/test-config` setup owns `afterEach(cleanup)` — never rely on implicit unmounting across
  tests.

## Builder Canvas Invariants (validated 2026-08-25, B2a)

Stale when: a later ADR supersedes 0003, or a milestone re-plans the canvas/chrome tier.

- Kernel state must be VALID state, not merely stored state: `dispatch`/`undo`/`redo` prune
  selection ids whose node no longer exists. Pruning happens inside the SAME `store.write` (no extra
  notification ⇒ the Law-S 1:1 audit is untouched) and returns the array BY REFERENCE when nothing
  was dropped (⇒ selection subscribers never churn). The alternative — every consumer defending
  itself against a dangling id — is the anti-pattern that produced two independent High findings
  (orphaned tool chrome, a raw node id read aloud by a live region).
- The overlay hot path is React-free BY CONSTRUCTION: React renders the canvas scaffold once, and
  pointer/positioning/tool-mount work happens in plain TS writing prebuilt DOM, batched to one
  frame-rhythm flush. There is no React state that a hover COULD re-render — that is what makes
  "zero content re-renders" a property instead of a fight.
- Geometry currency is observation-only, and the observation set must cover POSITION changes, not
  just size: element resize · frame scroll (capture, so nested scrollers count) · viewport resize ·
  frame-root `dir` · structural mutations (childList + class/style, subtree). A same-size sibling
  reorder fires none of the first four and does not re-run keyed wrappers' refs — it is invisible
  without the structural channel.
- Measure lazily, invalidate in O(1): consumers read the rects they actually need, so a 1,000-node
  document costs nothing per reflow beyond a version bump.
- Chrome geometry uses PHYSICAL coordinates on purpose (measured boxes); logical properties govern
  content-flow styling. Mixing them corrupts the math under RTL. Chrome colors live in shell-owned
  `--bldr-*` tokens, independent of the document's `--t-*` theme.
- Clicking inside the preview iframe moves focus into that browsing context: a host-level key
  handler silently stops receiving keys. Pull focus back after an in-frame click, and also listen
  for keydown inside the frame (keydown does not cross document boundaries, so the two handlers can
  never double-fire).
- Extension-facing abstract contract fields (`OverlayToolRenderer`'s `rect`/`layer` are `unknown` by
  design) get a `define*` authoring helper with ONE cast, the `defineCommand` pattern — and that
  helper MUST be in the preset's curated surface, or app-side extensions cannot author the
  contribution without violating the dependency law.

## Builder Drag-Editing Invariants (validated 2026-08-25, B2b)

Stale when: a later ADR supersedes 0003, or a milestone re-plans the gesture/panel system.

- Gestures are chrome until the commit point: a drag session mutates NOTHING mid-flight — exactly
  one `moveNode`/`insertNode` on drop, byte-identical zero-trace on cancel (Escape, no-target
  release, node vanishing, window blur). The kernel's no-effect rule backs the same-position case
  for free.
- ONE rule authority: `slotAccepts` gates resolver targets AND keyboard moves, and an exhaustive
  deterministic sweep proves it agrees with the command door over the whole payload×parent×slot
  space — gesture parity and resolver≡door are construction properties, not test hopes.
- The host↔frame document boundary is a REAL seam jsdom never shows: pointer events stop reaching
  the frame the moment the pointer leaves it, cross-document press/release never synthesizes a
  click, and `elementFromPoint` is null outside the frame viewport. Any in-frame gesture system
  needs (a) a PERMANENT host-side safety net (move/up + blur→cancel) owned by the mounting effect,
  (b) an explicit viewport-bounds check so "empty canvas" and "left the canvas" are different
  states, and (c) click-suppression flags set only on paths that can actually be followed by a
  same-document click.
- Pointer-activation thresholds apply to EVERY payload source: a palette entry click must release
  while the session is still pending, or the click-insert and drag paths double-fire (caught by the
  acceptance suite as two transactions per click).
- Hot-path structure lookups memoize per document REFERENCE (WeakMap over the immutable doc) — the
  sealed store replaces the reference on every write, so the cache invalidates itself.
- ARIA live regions do not re-announce identical strings (React bails out on same-value state):
  outcome channels carry {text, nonce} with a zero-width toggle. Flat-DOM trees must ship explicit
  `aria-posinset`/`aria-setsize` with `aria-level`. When a FOCUSED element is removed, the browser
  drops focus to body DURING the commit — repair in a layout effect (before paint), never a passive
  one, and never by touching refs during render (the compiler lint forbids both directions).

## Reusable Failure Modes (added 2026-08-25)

- TypeScript excludes dot-directories from `include` even when the directory is named literally
  (e.g. `".storybook"`): such files are silently NEVER type-checked and the ESLint project service
  cannot attach them. List the files explicitly.
- vitest coverage `include` patterns like `src/**/*.tsx` also match `*.stories.tsx` and sink
  thresholds; shared coverage excludes live in `@craftkit/test-config`.
- `pnpm format:check` is the FIRST link of `pnpm verify`: when it fails, none of the later gates ran
  — do not read a verify failure as "only formatting is broken".
- NEVER assert a wall-clock budget inside a merge gate. This repository has now been bitten twice:
  B1's SC-006 ("< 150 ms") measured 227 ms and B2a's SC-004 ("< 1 s") measured 1014 ms — both under
  parallel, coverage-instrumented turbo runs, both with healthy code. Gate the PROPERTY that makes
  the budget hold (load-invariant linear scaling; an in-place style rewrite with the same frame
  document and the same managed style element) and leave absolute numbers to uncontended evidence
  runs and the dedicated Lane-B job.
- A test whose only assertion is a COUNTER (re-renders, notifications) passes identically when the
  interaction silently resolved to nothing. Anchor counter assertions to at least one positive
  observation (chrome visible, correct label) or the proof is vacuous — found by the convergence
  audit on the 1,000-node sweep.
- React 19's compiler-backed `react-hooks` rules reject BOTH writing a ref during render and writing
  a memoized value into a ref inside an effect ("This value cannot be modified"). When a listener
  needs the latest callback, give the listener its OWN effect keyed on that callback instead of
  reaching for a latest-value ref.
- Storybook `play()` may be re-invoked on an already-mounted story (the Interactions panel's Rerun).
  A play function that mutates module-scope state and asserts against a captured absolute value
  fails on rerun; write the assertion relative to the CURRENT state (flip to the opposite direction,
  grow relative to the current height) so reruns prove the same property.
- `memo(function Name() { … <Name/> … })` is a TRAP: the inner function expression's own name
  shadows the memoized export, so recursive children silently use the UN-memoized function and every
  parent re-render drags its whole subtree. Name the inner function differently (`NameInner`) and
  let recursion reference the wrapped const. This hid in B1 for a full milestone because
  setProp/undo never re-render a parent with mounted children — it only surfaced when a convergence
  audit demanded the post-drop render-scope assertion for moveNode (42+ nodes re-rendering where 3
  were correct). Assert render scope for STRUCTURAL commands, not just prop writes.
- Exhaustive sweep tests that build a kernel per attempt time out under parallel coverage
  instrumentation; use ONE probe kernel per document and `undo()` after each successful dispatch
  (one transaction in, one inverse out), plus an explicit generous per-test timeout for legitimate
  whole-space sweeps.

## B3a Invariants & Failure Modes (added 2026-08-26)

- **Notify AFTER recording, always**: `useSyncExternalStore` checks snapshots SYNCHRONOUSLY inside
  the store notification and bails out on "no change" — any state a snapshot derives from (the
  transaction log, history cursors) must be fully recorded BEFORE the observable write, or the
  subscriber lags one event behind FOREVER. B0's dispatch notified before `log.append`; every
  pre-B3a path masked it with a follow-up write (insert→select), and the first single-write path
  (inspector commits) exposed it. Stale-until-next-event symptoms in a uSES consumer ⇒ check the
  producer's write ordering first. (003 §15; kernel-laws regression "log complete AT notification".)
- **Never wrap arbitrary children in a `<label>`**: label text names EVERY labelable descendant, so
  a contributed multi-button control had all its buttons named after the property key instead of
  themselves — caught only by the Chromium a11y gate, invisible in jsdom role queries. Structural
  naming for unknown content = `role="group"` + `aria-labelledby`; explicit label/`htmlFor` for
  controls you own.
- **Draft discipline for controlled editors**: seed the draft on FIRST CHANGE (never focus) and drop
  it whenever the incoming value is not the draft's own commit — then external undo/redo/collab
  always show through mid-focus, and door-rejected states (an emptied `.min(1)` prop) stay visible
  instead of snapping back under the caret.
- **A registry id is a slot name, not a version identity**: cache anything derived from a
  contribution (loaded components) by the contribution OBJECT (WeakMap), never by its id — a
  disposed-then-re-registered id must load the NEW component, and a WeakMap lets disposed defs GC
  away.
- **Transient input must never become authoritative view state**: a keystroke-committed device width
  flapped the frame to 1px and routed inspector writes into the WRONG document bucket. Partial
  numbers are drafts; commit on blur/Enter.
- **The B2b announcement law generalizes**: a live region announces MUTATIONS — content present at
  mount is silent, and a region that unmounts with its component cannot announce that component's
  exit. Entry announcements = post-mount rAF mutation; exit announcements belong to the surface that
  SURVIVES the exit (the composer).

## B3b Invariants & Failure Modes (added 2026-08-26)

- **A permissive door plus a stricter engine equals silent data loss.** When an editing engine
  cannot load a document the door accepted, TipTap/ProseMirror catch their own failure, warn to the
  console, and mount an EMPTY document — the next keystroke then commits that emptiness over the
  user's real content as an ordinary, undoable-looking transaction. Any adopted editor must have its
  schema pinned to the door's whitelist from BOTH sides, and the engine's error hook wired to
  something visible.
- **Recursive zod schemas overflow before any refinement runs.** A depth guard must be an ITERATIVE
  pre-check piped ahead of the shape validation (`z.custom(...).pipe(shape)`), and any "degrade to
  text" escape hatch in the renderer must itself be iterative — otherwise the fallback is what blows
  the stack.
- **Allowlists must be single-sourced across surfaces.** The editor's link protocols and the
  renderer's sanitizer were written separately; typing `example.com` produced a link that looked
  live in the editor and rendered DEAD on the published page, with no error anywhere. One predicate,
  imported by both.
- **A backslash is a slash.** Browsers implement the WHATWG relative-slash state, so `/\evil.com`
  resolves to `https://evil.com`. Any href allowlist that treats a leading `/` as "relative" must
  refuse backslashes outright.
- **Containment gates must cover the workspace ROOT manifest and npm aliases.** A dependency
  declared at the root hoists into every package's resolution path, and `"x": "npm:@scope/pkg@1"`
  defeats any name-only matcher.
- **`EditorContent` (and wrapper components generally) spread unknown props onto a WRAPPER
  element.** An `id` handed to such a component does not reach the focusable/editable node, so
  `<label htmlFor>` silently names nothing. Put a11y attributes on the real element (TipTap:
  `editorProps.attributes`) — and re-apply them when they change, since editor options are frozen at
  creation.
- **A convergence verifier that MUTATES the code is worth more than one that reads it.** B3b's
  rejected-commit reconcile was recorded as "fixed with regression tests"; deleting the fix left
  every suite green. Deleting the line is the only proof a regression test exists.

## Retired Claude-to-Codex Async Bridge (superseded 2026-08-27)

- Codex remains the default and never auto-starts Claude. An explicit Claude coordinator may call
  Codex one way; this avoids agent ping-pong but does not guarantee lower total token usage.
- `codex-craftkit-async` was a read-only experiment that started one ephemeral Codex JSONL call and
  exposed bounded in-memory status. `codex-craftkit-worker` used deprecated `codex mcp-server` for
  synchronous work. The installed official plugin supersedes both; never restore them as a fallback.
- For safe removal, let any in-flight child reach terminal state and close its Claude session before
  deleting `.mcp.json` or the bridge source. The old server cancels live children when its stdio
  connection shuts down, so changing project MCP configuration mid-task can lose the result.
