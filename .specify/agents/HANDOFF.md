# Active Work Handoff

**Status:** Builder **B4 is complete and converged**; every automated gate is green
(`pnpm verify` EXIT=0, all 12 stages). Blocked only on the user: **nothing has been committed and
commit authorization remains withheld.** The single remaining task is a commit-message proposal as
TEXT.

**Updated:** 2026-08-28

**Scope:** `specs/workspace/011-builder-b4-transforms-code-view` with
`packages/builder/{schema,core,transforms,shell,editor,extensions/code-view}`, `apps/playground`,
`packages/{ui,test-config,workspace-tools}`, and `apps/storybook`.

**Active Spec:** `specs/workspace/011-builder-b4-transforms-code-view/spec.md`.

**Out of scope, do not touch:** `apps/adaptive-spec-router` and
`specs/workspace/010-adaptive-spec-router` are the user's separately-owned, untracked work. The user
said so explicitly. Leave both alone.

## Objective

Make the document editable as CODE without ever letting the two representations disagree: a
transforms layer that projects a builder document to canonical text and parses it back into patches,
a code-view panel that applies through the same kernel door every other edit uses, the round-trip
law proven by property testing as a merge-blocking gate, all heavy work off the rendering path, and
the panel's implementation loaded only when it is first opened.

## Completed

- **`@craftkit/builder-transforms`** (layer 2, new, headless): canonical strict two-space JSON
  projection (sorted keys, slot order semantic, absent ≠ present-empty, duplicate keys rejected),
  an own strict parser with one-based error lines, the scoped envelope, and node-granular
  `documentPatches`. Registry-directed `fast-check` generators — validation as ASSERTION, never as
  a filter.
- **`@craftkit/builder-code-view`** (layer 4, new): the manifest with ONE lazy panel and ONE
  projection contribution, a handwritten typed `postMessage` protocol, the worker entry, the client
  (generation counting, one in-flight plus one coalesced, stale drop, payload-aware document
  dedupe), `CodeViewPanel`, `CodeViewErrors`, and a test-only `./testing` subpath.
- **Two dormant B0 contribution points finished**: `projections` AND `panels` are now reachable
  through `RegistryRead`. `panels` is the road every later surface arrives on (B5/B6/B7).
- **Kernel door**: the `applyPatches` command, `-0` canonicalisation at the dispatch door and at
  document open, and `MAX_JSON_DEPTH` / reserved-key refusal in Law J and the document validator.
- **Shell**: `CanvasInlineEditHandle`, so a host can end a live inline edit before opening a second
  editing surface (spec edge case 7).
- **Preset + playground**: surface additions, scenario 10 (select → open → edit → apply → undo),
  and the kernel adapter with globally monotonic revisions.
- **Two independent reviews** (`gpt-5.6-sol`, fresh sessions, opposite lenses) found **17 findings,
  7 HIGH, in a suite that was entirely green**. All fixed; **every mutation re-run by the
  coordinator rather than taken on the fixer's report.** Full record in `tasks.md` § "T033 record".
- **`/speckit-converge`** → Phase 9 (T037–T039), documentation drift only, completed.

## Gates and outcomes (2026-08-28)

`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify` → **EXIT=0**.

| Package                        | Tests |
| ------------------------------ | ----: |
| `@craftkit/builder-schema`     |   120 |
| `@craftkit/builder-core`       |   106 |
| `@craftkit/builder-transforms` |   106 |
| `@craftkit/builder-code-view`  |    86 |
| `@craftkit/builder-shell`      |   571 |
| `@craftkit/builder` (preset)   |    55 |
| `@craftkit/playground`         |    33 |
| `@craftkit/workspace-tools`    |    38 |
| Storybook (Chromium)           |   153 |

`check:workspace` 21 members · `check:components` 44 components · coverage thresholds met in every
package **with no exclusions added and no threshold lowered**.

## Incomplete

- **T036** — a commit-message proposal, TEXT ONLY. No `git commit`, no `git add`, no push.

## Blockers

- **Commit authorization is withheld.** The user's standing instruction is that agents never commit.
  The user commits themselves.

## Decisions required from the user

1. Authorize (or not) a commit for B4.
2. Choose what follows B4: the **design milestone** (the CraftKit mockup the user supplied as the
   reference UI) or **B5**. The design milestone was scheduled to follow B4.

## Next executable steps

1. Produce the B4 commit-message proposal as text (T036) and mark it complete in `tasks.md`.
2. Wait for the user's choice between the design milestone and B5.

## Recovery notes

- Prefix every shell command with
  `PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`; add
  `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` when pnpm attempts a forbidden auto-install.
- `pnpm --filter X test -- path` does NOT filter to that path; pass the path directly, or run
  `pnpm exec vitest run <path>` from inside the package.
- Chromium stories run from `apps/storybook`:
  `pnpm exec vitest run --project=storybook <relative path>`.
- Codex delegation goes through the official plugin only (`/codex:rescue --background --fresh`),
  never an MCP transport. The plugin's `--effort` flag rejects `ultra`; leave the flag off and let
  `~/.codex/config.toml` (`model_reasoning_effort = "ultra"`) apply. **Lease work in small,
  path-disjoint slices** — two oversized jobs stalled for an hour without a single write and had to
  be cancelled and re-cut; the re-cut jobs reached verification in eleven minutes.
- Never trust a delegated agent's mutation report. Re-run each mutation yourself.
