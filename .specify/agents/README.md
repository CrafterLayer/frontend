# Spec Kit Agent System

This directory is the canonical operational layer shared by Claude, Codex, Cursor,
and future agents. The root entrypoints only route here. Spec Kit owns feature intent
through the constitution, specifications, plans, tasks, and convergence checks.

## Authority and Load Order

Use the smallest useful context in this order:

1. Current user instruction.
2. `.specify/memory/constitution.md` for non-negotiable governance.
3. The active feature's `spec.md`, `plan.md`, and `tasks.md` for feature truth.
4. `.specify/agents/context.json` for the current workspace snapshot.
5. `.specify/agents/HANDOFF.md` only when resuming or transferring unfinished work.
6. `.specify/agents/MEMORY.md` only when validated history affects the task.
7. One relevant rule file from the routing table below.
8. One relevant page from `docs/` when architecture, setup, testing, or operations is in
   scope.
9. Tool-specific adapters only for invocation syntax.

Do not load every rule on every task. Do not copy detailed policy into `AGENTS.md`,
`CLAUDE.md`, or Cursor rules.

## Rule Routing

| Work | Required rule |
| --- | --- |
| React components, hooks, UI architecture, Storybook, component tests | `rules/react-ui.md` |
| Apps, packages, dependency boundaries, cross-app features, Spec Kit scope | `rules/monorepo.md` |
| React Router trees, route/query prefetch, lazy chunks, bundle size | `rules/routing-performance.md` |
| Sub-agents, parallel work, context transfer, interrupted work | `rules/collaboration.md` |
| Reviewing implementation or a diff | `rules/code-review.md` |
| Generating or validating a commit message | `rules/commits.md` |

## Documentation Routing

Use `docs/README.md` as the documentation index, then open only the section relevant to
the task:

| Work | Documentation |
| --- | --- |
| Workspace, package, frontend, or rendering architecture | `docs/architecture/` |
| Durable architecture choice or superseded decision | `docs/architecture/decisions/` |
| Local setup and contribution workflows | `docs/development/` |
| Test strategy, fixtures, accessibility, and Storybook verification | `docs/testing/` |
| Release, recovery, migration, and incident procedures | `docs/runbooks/` |

Feature intent remains in scoped `specs/` artifacts, and component API documentation
remains colocated as `*.docs.mdx`. Do not duplicate either inside `docs/`.

Several rules may apply to a cross-cutting task, but read only those that materially
govern the requested work.

## Installed Spec Kit Operations

The `react-monorepo-quality` preset wraps `plan`, `tasks`, and `implement` so the
monorepo, decomposition, Storybook, MDX, testing, and verification requirements cannot
be reduced to optional cleanup. The `workspace` extension provides:

| Operation | Claude / Cursor | Codex |
| --- | --- | --- |
| Independent implementation review | `/speckit-workspace-review` | `$speckit-workspace-review` |
| Shared context and handoff refresh | `/speckit-workspace-handoff` | `$speckit-workspace-handoff` |
| Diff-based commit message | `/speckit-workspace-commit` | `$speckit-workspace-commit` |

The `routing-performance` extension adds the shared
`speckit.routing-performance.optimize` operation for route/query lazy-boundary and bundle
audits.
The `professional-sdd` workflow runs review, final handoff, and commit-message generation
as explicit engine steps. This makes their status observable and prevents duplicate hook
execution. The commit step generates text only; it never stages, commits, or pushes.

Both workflow review steps always start a fresh Codex reviewer with `gpt-5.6-terra`, even
when Claude or Cursor implements the change. Use `review_model=gpt-5.6-luna` only for an
explicit fast, cost-sensitive triage pass. If Codex or the selected model is unavailable,
the workflow fails closed instead of silently self-reviewing in the implementer context.

Use the installed `professional-sdd` workflow for significant product or platform work:

1. `speckit-constitution` — change governance only when needed.
2. `speckit-specify` — define outcomes and acceptance scenarios.
3. `speckit-clarify` — resolve high-impact ambiguity.
4. `speckit-plan` — choose architecture, tooling, package boundaries, and verification.
5. `speckit-checklist` — validate requirements quality.
6. `speckit-tasks` — create dependency-ordered implementation tasks.
7. `speckit-analyze` — check spec/plan/tasks consistency.
8. `speckit-implement` — implement the approved tasks.
9. Apply `rules/code-review.md` and fix verified findings.
10. `speckit-converge` — append any remaining artifact gaps as tasks.
11. Re-run implementation and mandatory review for convergence tasks.
12. Run final convergence and approve delivery only when no unfinished task remains.

Claude and Cursor invoke skills as `/speckit-<command>`. Codex invokes them as
`$speckit-<command>`.

## Monorepo Targeting

The root `.specify/` project owns workspace governance and cross-cutting work. Scope
root features with `SPECIFY_FEATURE_DIRECTORY`, for example:

```bash
SPECIFY_FEATURE_DIRECTORY="specs/apps/storefront/001-checkout" <agent-command>
SPECIFY_FEATURE_DIRECTORY="specs/packages/ui/001-button-system" <agent-command>
```

To orchestrate the full approved cycle from the CLI, propagate the scoped feature
directory into the workflow process:

```bash
SPECIFY_FEATURE_DIRECTORY="specs/apps/<app>/<feature>" \
  specify workflow run professional-sdd \
  -i 'scope=app:<app>' \
  -i 'feature_directory=specs/apps/<app>/<feature>' \
  -i 'spec=<feature description>' \
  -i 'integration=claude' \
  -i 'review_model=gpt-5.6-terra'
```

Each approval gate is interactive by default. For non-TTY automation, pass the matching
`*_verdict=approve` input. A rejection pauses the gate for corrections and later resume;
it does not silently approve or destroy the run state. `retry` reopens only the paused
gate, so make the required artifact or implementation correction before resuming.

Resume an approved gate with, for example,
`specify workflow resume <run-id> -i 'spec_verdict=approve'`. Use the verdict input that
belongs to the currently paused gate; never pre-approve a later gate before reviewing its
artifact or evidence.

Use `integration=codex` when running through Codex. Cursor remains able to invoke every
installed skill in the IDE; CLI workflow dispatch also requires a callable integration
CLI, so use Claude or Codex for terminal orchestration when Cursor has no CLI command.

If a future app or package gets an independent `.specify/`, target it explicitly with
`SPECIFY_INIT_DIR`. Never rely on an ambiguous nearest directory in automation.

## State Ownership

| File | Owns | Update rule |
| --- | --- | --- |
| `context.json` | Replaceable current workspace facts | Update when stack, paths, scripts, or active scope changes |
| `HANDOFF.md` | Unfinished task transfer | Replace when pausing; reset to idle after verified completion |
| `MEMORY.md` | Durable validated decisions and failure modes | Append or amend only when the knowledge will help future work |
| `memory/constitution.md` | Non-negotiable governance | Amend through `speckit-constitution` with versioning |

Never store secrets, credentials, private payloads, raw logs, or unverified guesses in
continuity files.

## Package Ownership

Local extension, preset, and workflow source lives under `.specify/agents/`. Installed
copies live under `.specify/extensions/`, `.specify/presets/`, and
`.specify/workflows/`. Integration skill folders are generated outputs: never hand-edit
`.claude/skills`, `.agents/skills`, or `.cursor/skills`. Reconcile packages through
`specify extension`, `specify preset`, `specify workflow`, and `specify integration use`.

For a local extension update, run `specify extension add <source> --dev --force`. Spec
Kit 1.0.1 has no local-preset update command: remove the installed preset, add its source
again with the same priority, then activate Claude, Codex, and Cursor once each so every
integration is recomposed. Return the default integration to Claude afterward.
