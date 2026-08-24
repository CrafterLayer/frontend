# Durable Agent Memory

This file stores validated decisions and reusable failure modes. It is not a task log.
Current work belongs in `HANDOFF.md` and `context.json`.

## Validated Decisions

- Spec Kit is the single governance and continuity system for Claude, Codex, Cursor,
  and future agents. Tool-specific files stay thin.
- The repository is expected to become a large multi-application monorepo. Workspace
  scope MUST be explicit before an agent creates specifications or code.
- The root Spec Kit project owns shared governance. Features use scoped directories
  under `specs/apps/`, `specs/packages/`, or `specs/workspace/`. Independent member
  Spec Kit projects are reserved for independently governed or released members.
- The initial frontend baseline is the latest patched React 19.2 line. React 19.2.8
  was verified on 2026-08-24, but agents MUST re-check before dependency installation.
- Architecture is feature-first with component-owned folders, thin routes, explicit
  package APIs, and no app-to-app or package-to-app imports.
- `docs/README.md` is the human-facing documentation index, and
  `docs/architecture/` is the only cross-workspace architecture tree. ADRs live under
  `docs/architecture/decisions/`; feature intent stays in `specs/`, while component API
  docs stay colocated beside components.
- One substantive React component is allowed per `.tsx` file. Nested or hidden sibling
  component declarations are prohibited.
- Every new UI component requires a local export, typed Storybook story, MDX docs, and
  behavior-focused test. These artifacts are one definition of done, not optional tasks.
- Sub-agents are created dynamically for bounded independent work. There is no permanent
  sub-agent registry; the primary agent owns integration and final review.
- Commit messages follow Conventional Commits and are generated from the actual staged
  diff. Agents never auto-commit or push without explicit user authorization.
- Local agent automation is packaged through Spec Kit: `workspace` owns review, handoff,
  and commit-message commands; `react-monorepo-quality` wraps core delivery commands; and
  `professional-sdd` is the full gated workflow. Generated integration skills are never
  edited directly.

## Reusable Failure Modes

- If agents disagree, check whether rules were duplicated outside `.specify/`. Remove
  the duplicate and keep the tool file as a router.
- If Spec Kit writes to the wrong feature, verify both `SPECIFY_INIT_DIR` and
  `SPECIFY_FEATURE_DIRECTORY`; project selection and feature selection are independent.
- If a UI component is implemented without docs, stories, or tests, the work is
  incomplete even when the application builds.
- If parallel work collides, the delegation scopes were not path-disjoint. Stop,
  reconcile through the primary agent, and reassign non-overlapping ownership.
- If a commit message describes uncommitted or unrelated work, regenerate it from
  `git diff --staged` and report anything intentionally left unstaged separately.
- If one integration lacks a workspace command or quality wrapper, reconcile the Spec Kit
  packages for that integration rather than copying a skill directory by hand.
- In Spec Kit 1.0.1, `integration status` reports the preset-composed `plan`, `tasks`, and
  `implement` skills as modified base-managed files. When those are the only nine
  modifications and the preset registry owns all three integrations, treat the warning as
  expected composition; do not force an upgrade without re-checking this behavior.

## Staleness Conditions

Re-validate this file when React changes major version, the monorepo tool is selected,
the workspace layout is created or moved, package boundaries change, Spec Kit changes
its extension, preset, workflow, or monorepo model, or the user changes the
one-component/docs/story/test contract.
