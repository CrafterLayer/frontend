# Active Work Handoff

**Status:** Idle

**Updated:** 2026-08-24

**Scope:** None

**Active Spec:** None

## Objective

No unfinished implementation is currently assigned. Agent governance and Spec Kit are
ready for the first product specification.

## Completed

- Spec Kit integrations are installed for Claude, Codex, and Cursor.
- The project constitution defines React, monorepo, UI completeness, review,
  collaboration, and commit requirements.
- Shared agent routing, memory, handoff, and task-specific rules live under
  `.specify/agents/`.
- The `workspace` extension installs shared review, handoff, and commit-message commands
  used as explicit, observable steps by the professional workflow.
- The `react-monorepo-quality` preset wraps planning, task generation, and implementation
  with mandatory monorepo and complete UI-component gates.
- The `professional-sdd` workflow runs clarify, approval gates, checklist, analysis,
  implementation review, a convergence repair pass, final convergence, and handoff
  plus a non-committing message proposal around the core lifecycle.
- Git is initialized on `main` without creating a commit; the root `.gitignore` covers
  common monorepo outputs, caches, local environment files, and credentials.
- The root `docs/` hub now routes architecture, ADRs, development, testing, and runbook
  documentation without duplicating Spec Kit specs or colocated component docs.

## Next Exact Action

Describe the first product or platform capability, declare its app/package/workspace
scope, set `SPECIFY_FEATURE_DIRECTORY`, then run the installed `professional-sdd`
workflow. Exact syntax is in `.specify/agents/README.md`.

## Changed Files

See the current workspace diff or file listing. Do not use this section as a substitute
for inspecting the actual diff.

## Verification

Spec Kit package, integration, YAML/JSON, generated-skill, hook, and marker checks are
recorded in the completing agent's response. Application lint, types, tests, Storybook,
and builds remain unavailable until the app is scaffolded.

## Blockers

None. Monorepo tooling, framework, package manager, and test runner intentionally remain
open decisions for the first approved technical plan.

## Replacement Template

When pausing unfinished work, replace the sections above with:

- objective and declared monorepo scope;
- active spec, plan, and tasks paths;
- completed work with exact file paths;
- next executable steps in order;
- verification commands and outcomes;
- blockers and required user decisions; and
- any safe rollback or recovery notes.
