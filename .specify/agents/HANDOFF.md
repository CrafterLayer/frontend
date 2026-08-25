# Active Work Handoff

**Status:** Requested scope implemented; aggregate workspace verification remains blocked

**Updated:** 2026-08-25

**Scope:** Workspace packages and shared routing-performance governance

**Active Spec:** `specs/workspace/002-routing-query-foundation`

## Objective

Finish the shared query and routing foundations, retain `@craftkit/icons` as an empty
metadata-only package, and converge the Spec Kit routing-performance workflow.

## Completed

- `@craftkit/query` owns explicit QueryClient construction, provider wiring, curated
  exports, cache error callbacks, and per-request SSR isolation guidance.
- `@craftkit/routing` owns React Router 8 exports, a deferred route patcher with ordered
  application/concurrent import dedupe/abort safety/retryable failures, and preloadable
  lazy components with bounded stale-chunk recovery.
- `@craftkit/icons` contains only `package.json`; it has no source, runtime entry,
  dependency, glyph, build, test, or Storybook contract.
- Query and routing production builds externalize host runtimes and pass 8 KiB and 16 KiB
  raw entry budgets respectively.
- The `routing-performance` Spec Kit extension is installed and its generated skills are
  synchronized for Claude, Codex, and Cursor.
- `professional-sdd` dispatches both independent review steps through a fresh Codex
  process using `gpt-5.6-terra` by default; Luna is an explicit fast-triage override only.
- ADR 0002 and the architecture/development indexes describe the package boundaries and
  performance workflow.

## Next Exact Action

Treat workspace-wide stabilization as a separate authorized scope. It requires a decision
on the exact pnpm exception `trustPolicyExclude: semver@6.3.1`, followed by fixes for the
pre-existing Storybook/UI aggregate failures. Do not weaken the global trust policy,
broaden the exception, or change unrelated Storybook/UI files implicitly.

## Changed Files

See the current workspace diff or file listing. Do not use this section as a substitute
for inspecting the actual diff.

## Verification

- Query: lint/typecheck/build/size passed; 4 tests passed with 100% coverage.
- Routing: lint/typecheck/build/size passed; 21 tests passed with 98.11% statement and
  96.72% branch coverage. The tests include real React Router 8 navigation patching.
- Output sizes: query `dist/index.js` 1,523 bytes; routing `dist/index.js` 4,602 bytes.
- Query/routing ESLint, workspace structure validation, component validation, Turbo
  boundaries, graph planning, and independent read-only review passed.
- Spec Kit 1.0.1 reports the expected nine preset-composed managed-file warnings, with no
  missing or invalid manifest paths.

## Blockers

The lockfile was generated after a one-time reviewed exclusion, but an ordinary frozen
install is blocked by pnpm's `no-downgrade` policy for transitive `semver@6.3.1` from the
existing Babel toolchain. Persisting the exact exception requires user approval. The
unchanged baseline also has three separate aggregate failures: root ESLint cannot attach
Storybook's dot-directory files to its TS project, UI coverage counts a stories file and
misses its global threshold, and Storybook rejects simultaneous MDX docs plus the existing
`autodocs` tag. These files were deliberately left unchanged to preserve task scope.

## Replacement Template

When pausing unfinished work, replace the sections above with:

- objective and declared monorepo scope;
- active spec, plan, and tasks paths;
- completed work with exact file paths;
- next executable steps in order;
- verification commands and outcomes;
- blockers and required user decisions; and
- any safe rollback or recovery notes.
