# Project Agent Entry Point

This repository uses Spec Kit as the single source of truth for Claude, Codex, Cursor, and future
coding agents. Do not create an independent agent-governance system or duplicate the detailed rules
in tool-specific files.

## Required Load Order

Before material work:

1. Read `.specify/memory/constitution.md`.
2. Read `.specify/agents/README.md` and `.specify/agents/context.json`.
3. If resuming work, read `.specify/agents/HANDOFF.md`.
4. Read `.specify/agents/MEMORY.md` only when prior decisions or failure modes matter.
5. Read the one task-matching rule under `.specify/agents/rules/`.
6. Read the active feature's `spec.md`, `plan.md`, and `tasks.md` when they exist.
7. Load only the relevant page under `docs/` when architecture, setup, testing, or operations is in
   scope.

The live Spec Kit plan link may also be injected below by the `agent-context` extension. The shared
load order and constitution still apply.

## Non-Negotiable Defaults

- Treat this as a large multi-application monorepo; declare app/package scope first.
- Use the latest patched React 19.2 line; verify the exact version before install.
- Keep one substantive React component per `.tsx` file. Never nest component declarations or hide
  sibling components in the same file.
- Every new UI component requires its implementation, local export, Storybook story, MDX
  documentation, and behavior-focused test.
- Use feature-first boundaries and explicit package public APIs. Apps never import apps; packages
  never import apps.
- Use bounded, non-overlapping sub-agent tasks. The primary agent owns integration, code review,
  verification, and the final result.
- Review the real diff before generating a Conventional Commit message. Never commit, push, deploy,
  or mutate external state without matching user authorization.

## Spec Kit Workflow

For production features use the full path:

`constitution -> specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> review -> converge -> repair -> final review -> handoff -> commit proposal`

Use `.specify/agents/README.md` for command syntax, monorepo targeting, context ownership, and rule
routing.

`docs/README.md` is the human-facing documentation index. Cross-workspace architecture lives only
under `docs/architecture/`; do not create a competing root architecture tree.

The installed `professional-sdd` workflow orchestrates that path. The local Workspace Governance
extension provides `speckit.workspace.review`, `speckit.workspace.handoff`, and
`speckit.workspace.commit`; use their integration-native skill names documented in
`.specify/agents/README.md`.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure, shell commands, and other
important information, read the current plan at
specs/workspace/009-builder-b3c-inline-editing/plan.md
<!-- SPECKIT END -->
