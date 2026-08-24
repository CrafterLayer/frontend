---
name: speckit-workspace-commit
description: Generate a Conventional Commit message from the real diff without committing
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: workspace:commands/speckit.workspace.commit.md
---

# Generate Commit Message

Generate one copy-ready commit message for the requested scope. Optional caller guidance:

```text
$ARGUMENTS
```

## Scope Guard

This command is read-only. It MUST NOT stage files, create a commit, amend history, push,
modify source, or write temporary message files. Generating text is not commit authority.

## Procedure

1. Read `.specify/agents/rules/commits.md` and the active feature artifacts when present.
2. Verify that the workspace is a Git repository.
3. Inspect `git status --short`, `git diff --staged --stat`, and `git diff --staged`.
4. If staged changes exist, use only the staged diff as the message source. If nothing is
   staged, inspect the relevant working-tree diff plus the contents of relevant untracked
   files and label the result clearly as an unstaged proposal. `git diff` does not include
   untracked files, so never summarize them from filenames alone. If no relevant change
   exists, stop without inventing a message.
5. Detect unrelated concerns. If the staged set is not cohesive, recommend a concrete
   split instead of hiding multiple changes under a vague header.
6. Produce a Conventional Commit header `type(scope): imperative summary`. Use the stable
   app, package, or workspace concern as scope. Keep the summary specific and at most 100
   characters, preferably 72 or fewer.
7. For non-trivial work, add `Why:`, `What:`, and `Tests:` sections. List exact checks that
   actually ran; otherwise write `Tests: not run (<reason>)`. Add `Refs:` to the scoped
   Spec Kit feature when useful. Use `!` and a `BREAKING CHANGE:` footer when required.

## Output Contract

Return:

1. whether the proposal is based on staged or unstaged changes;
2. one fenced, copy-ready commit message; and
3. a short warning if the diff should be split or verification evidence is missing.

Do not run `git commit` or `git push`.