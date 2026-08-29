# Active Work Handoff

**Status:** Builder **B4 is complete and committed** (`602c690`). The **design milestone** that
follows it is implemented and its Spec Kit artifacts are written. Work is now blocked only on the
user: **nothing since B4 has been committed and commit authorization remains withheld.**

**Updated:** 2026-08-28

**Scope:** `specs/workspace/012-builder-design-chrome-theme` with `packages/builder/theme` (new),
`packages/builder/{shell,editor}`, `apps/playground`, and `apps/storybook`.

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
