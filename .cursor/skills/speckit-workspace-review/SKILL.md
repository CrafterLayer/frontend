---
name: speckit-workspace-review
description: Review an implementation against its Spec Kit artifacts and workspace rules
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: workspace:commands/speckit.workspace.review.md
---

# Workspace Implementation Review

Perform a non-destructive, evidence-based review of the current implementation. The
optional focus supplied by the caller is:

```text
$ARGUMENTS
```

## Scope Guard

This command is read-only. Do not modify source, specifications, plans, tasks, context,
handoff files, Git state, dependencies, generated artifacts, or external systems. Tests
and diagnostics may be run when they are safe and relevant, but report any command that
could not run. A review finding does not authorize its fix.

## Required Context

1. Read `.specify/memory/constitution.md`.
2. Read `.specify/agents/context.json` and `.specify/agents/rules/code-review.md`.
3. Load only the task-matching rules routed by `.specify/agents/README.md`.
4. Resolve the active scoped feature and read its `spec.md`, `plan.md`, and `tasks.md`.
   If there is no active feature, say so and review only the explicitly supplied scope.
5. Confirm the affected apps and packages before inspecting implementation.

## Review Procedure

1. Inspect repository status and the actual diff. Prefer the staged diff when reviewing a
   commit candidate; otherwise inspect the relevant working-tree and untracked files.
2. Map the change to specification acceptance scenarios, plan decisions, tasks, and
   constitution gates. Do not invent requirements that are absent from those sources.
3. Run the narrowest useful checks, then owning-package and affected-workspace checks in
   the order defined by the monorepo rule. Never describe an unavailable check as passed.
4. For a material change, delegate one bounded independent read-only review when the
   active agent supports sub-agents. Give it the exact scope and prohibit edits, commits,
   pushes, dependency changes, and external writes. The primary agent remains responsible
   for validating every returned finding.
5. Reject nested or sibling component declarations. For every added UI component, verify
   implementation, local export, typed Storybook story, MDX documentation, and behavioral
   test. Check accessibility, keyboard behavior, RTL, responsiveness, theme states, and
   loading/error/empty behavior when applicable.
6. Check package public APIs, dependency direction, cycles, deep imports, cross-app
   contracts, and build or deployment effects for every affected member.

## Output Contract

Report findings first, ordered `Critical`, `High`, `Medium`, then `Low`. Every finding has
an exact file and line, impact, evidence or reproduction path, and the smallest coherent
correction. Then report:

- checks that passed, with exact commands;
- checks that failed or were unavailable;
- Spec Kit artifact gaps;
- residual risk; and
- whether convergence may proceed.

If no findings remain, say so explicitly without claiming that unrun behavior was
verified. Do not generate a commit message from this command.