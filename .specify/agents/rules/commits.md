# Commit Message Generation

Load this file whenever an agent generates, reviews, or applies a commit message.

## Source of Truth

Generate the message from the actual staged diff:

```bash
git status --short
git diff --staged --stat
git diff --staged
```

If nothing is staged, inspect the relevant working-tree diff and the actual contents of
relevant untracked files, then clearly say the proposal is for unstaged changes. `git
diff` does not include untracked files. Never infer changes from chat history or filenames
alone, and never include unrelated files in the message.

## Header

Use Conventional Commits:

```text
type(scope): imperative summary
```

Allowed types are `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`,
`chore`, `style`, and `revert`. Choose a stable scope from the affected app, package, or
workspace concern, such as `storefront`, `ui`, `auth`, `storybook`, or `agents`.

The summary MUST be imperative, specific, and preferably 72 characters or fewer; it MUST
remain at most 100 characters unless repository tooling explicitly defines another limit.
Do not end it with a period.

## Body and Footers

For a non-trivial change, add a body explaining why and what, followed by the exact
verification status:

```text
feat(ui): add documented button component contract

Why:
- establish one reusable button API across applications

What:
- add the component, typed stories, MDX usage docs, and behavior tests
- export it through the UI package public entrypoint

Tests:
- pnpm --filter @workspace/ui test -- Button
- pnpm --filter @workspace/ui build-storybook
```

Use `Tests: not run (<reason>)` when checks did not run. Never write `Tests: passed`
without the exact commands or equivalent concrete evidence. Add `Refs:` for an issue or
Spec Kit feature path when useful.

Breaking changes use `type(scope)!:` and a `BREAKING CHANGE:` footer describing migration.
Keep one cohesive concern per commit; split unrelated concerns before generating text.

## Authorization Boundary

Generating text does not authorize a commit. Present the proposed message first. Run
`git commit` only when the user explicitly requests it, and never push unless separately
authorized.

The reusable editor template is `.specify/agents/templates/commit-message.txt`.
