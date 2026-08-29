# Active Work Handoff

**Status:** Builder **B4 is complete and committed** (`602c690`). The **design milestone** (012) is
implemented, its artifacts are written, and it remains uncommitted — **commit authorization is still
withheld**. The user has chosen what follows it: not B5, but **013, the AI Full-Site Design Agent**.
Its `spec.md`, `plan.md`, Phase 0/1 artifacts, and `tasks.md` (158 tasks) are written, and a green
pre-change baseline is recorded in `013-.../baseline.md` (`PNPM_EXIT=0`, **58 components** — the 50
in this file's older note was stale). **No implementation code has been written for 013.**

**013 is blocked on ONE thing: the user committing 012.** The user asked for Codex to do the writing
to reduce cost. BoundedRelay is verified healthy (authenticated, `proposalsEnabled: true`,
`maxConcurrent: 2`, write roots `packages/builder`, `apps/playground`, `apps/storybook`), but
`codex_worker_workspace` reports `proposalReady: false` — **"The Git working tree is not clean"**,
82 uncommitted files. Codex proposes from an isolated clone, so it can write nothing until the tree
is clean. Do NOT stash as a workaround: 013's Phase 2 edits `renderer` and `schema` files that 012
has already modified, so patches would be built against stale code and conflict on unstash.

**Updated:** 2026-08-29

**Scope (active):** `specs/workspace/013-ai-full-site-design-agent` — workspace, cross-cutting.
Planned members: `packages/builder/{schema,core,transforms,renderer,ai,shell}`,
`packages/builder/extensions/{blocks-marketing,code-view}`, `packages/builder` preset,
`apps/{playground,storybook}`. `@craftkit/builder-theme` is deliberately untouched (editor chrome
stays separate from the generated page design system).

**Scope (previous, still uncommitted):** `specs/workspace/012-builder-design-chrome-theme` with
`packages/builder/theme` (new), `packages/builder/{shell,editor}`, `apps/playground`, and
`apps/storybook`.

**013 decisions already fixed by the user — do not relitigate:** the site WRAPS pages (each page
stays an independently valid `BuilderDocument` at `schemaVersion` 1); reasoning runs client-side
against a replaceable endpoint with a published stage contract, and no reasoning service enters this
workspace; imagery is SELECTED from a local asset library behind a replaceable port, never generated
and never invented. Recorded in the spec's `Resolved Decisions`.

**013's load-bearing finding:** the page's design tokens (`Theme`, `ColorToken`, `MeasurementToken`)
live in `@craftkit/builder-renderer` at layer 2, the same layer as `@craftkit/builder-ai`. ADR 0003
forbids sideways edges, so the agent cannot import the vocabulary it must generate. They move DOWN to
`@craftkit/builder-schema` (layer 0), with re-exports so no consumer import breaks. This is why the
plan touches layer 0 at all. See `research.md` R1.

**Out of scope, do not touch:** `apps/adaptive-spec-router` and
`specs/workspace/010-adaptive-spec-router` are the user's separately-owned, untracked work. The user
said so explicitly. Leave both alone.

## Objective

Give the builder one place where every colour, size and motion value is decided, make that place
overridable at runtime without a fork, and spend the screen on the page being edited rather than on
the editor's own furniture.

## Completed

- **`@craftkit/builder-theme`** (layer 2, new, zero runtime deps): primitive ramps, a closed
  `CHROME_TOKENS` union, light and dark themes written only as primitive references, the layout
  scale, two densities, and a generated `chrome.css`. It closed a real defect: `--bldr-*` tokens
  were never defined anywhere, twenty stylesheets ran on fallbacks, and two files disagreed on
  `--bldr-accent`.
- **Three gates that measure rather than assert**: WCAG contrast computed in Chromium over 18
  pairings x 2 themes; a token-coverage scan across `packages/builder`, `packages/ui` and
  `apps/playground`; and a drift gate holding the checked-in stylesheet equal to its generator.
- **`BuilderShell`** plus `IconRail`, `TopBar`, `StatusBar` (new) and re-skins of `Palette`,
  `LayersTree` and `Inspector`, each with the full six-artifact contract.
- **The playground** composes them, surfaces the kernel's `author` field as provenance for the first
  time since B0, and now lets a person choose the EDITOR's appearance separately from the page's.
- **Twelve defects the browser found after the artifacts were written** — recorded as Phase 7 of
  `tasks.md` with the measurement that exposed each one. Several passed every existing test while
  the product was broken; the most serious is that the dark theme had never applied at all, because
  the stylesheet keyed its explicit-choice blocks on `:root` while the component stamps its own
  element.

## Gates and outcomes

Run `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify` and read the EXIT CODE, not a wrapper's.
`pnpm verify > log; echo $?` reports the ECHO's status — capture pnpm's own exit in braces or check
the log's tail. Three runs were misread that way during this session before the mistake was caught.

`check:components` 50 components. Chromium stories run from `apps/storybook`:
`pnpm exec vitest run --project=storybook <relative path>`.

## Incomplete

- A commit-message proposal for the design milestone, TEXT ONLY. No `git commit`, no `git add`.

## Blockers

- **Commit authorization is withheld.** The user's standing instruction is that agents never commit.
  The user commits themselves.

## Decisions required from the user

1. Authorize (or not) a commit for the design milestone.
2. Choose what follows it: **B5** (per the master plan) or further design work.

## Recovery notes

- Prefix every shell command with
  `PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`; add
  `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` when pnpm attempts a forbidden auto-install.
- `pnpm --filter X test -- path` does NOT filter to that path; pass the path directly, or run
  `pnpm exec vitest run <path>` from inside the package.
- The playground dev server runs on **5175**. Port 5173 serves the user's own out-of-scope app.
- `dev-browser` needs the Node 22 PATH; `saveScreenshot(buf, name)` is a global, not a method on
  `browser`.
- jsdom cannot measure a box, prove an overlap, or resolve a custom property. Every claim about
  size, position, contrast or theme resolution belongs in a Chromium story.
- A CSS gate that reads the stylesheet must strip comments first: a rule's own explanation often
  quotes the pattern the gate forbids.
- Codex delegation goes through the official plugin only (`/codex:rescue --background`), never an
  MCP transport. The plugin's `--effort` flag rejects `ultra`; leave the flag off and let
  `~/.codex/config.toml` apply. Lease work in small, path-disjoint slices.
- Never trust a delegated agent's mutation report. Re-run each mutation yourself.
- **Spec Kit's bash scripts need PyYAML and `/usr/bin/python3` does not have it.**
  `setup-plan.sh` fails with `PyYAML is required to resolve preset template composition`, and
  `agent-context/scripts/bash/update-agent-context.sh` silently SKIPS with exit 0 — which is why
  `.cursor/rules/project-governance.mdc` was still pointing at feature 010 while `CLAUDE.md` and
  `AGENTS.md` pointed at 011. Install PyYAML for the interpreter Spec Kit invokes, or every
  plan/tasks cycle keeps needing the manual fallback: copy `.specify/templates/<name>-template.md`
  directly (verified equivalent — the `react-monorepo-quality` preset wraps COMMANDS only and
  provides no template overrides), and hand-edit the `<!-- SPECKIT START -->` block in all three
  files listed in `agent-context-config.yml`.
- `head` on this machine is shadowed by an HTML tool. Prefix shell commands with
  `PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"` or `head -40` fails with
  `Unknown option: 4`.
