# Pre-change Baseline (T001)

**Captured**: 2026-08-29 · **Revision**: `76a70df` plus 82 uncommitted files (the 012 design
milestone) · **Command**: `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify`

## Result: GREEN

```
PNPM_EXIT=0
```

That is **pnpm's own exit code**, captured inside braces — not a wrapper's.
`pnpm verify > log; echo $?` reports the echo's status, which was misread three times during the
design milestone.

| Gate                                   | Outcome                  |
| -------------------------------------- | ------------------------ |
| `format:check`                         | pass                     |
| `test:workspace`                       | pass                     |
| `check:workspace`                      | pass                     |
| `check:components`                     | pass — **58 components** |
| `check:boundaries`                     | pass                     |
| `lint` · `typecheck` · `test:coverage` | pass                     |
| `build` · `check:bundles`              | pass                     |
| `test:storybook` · `build-storybook`   | pass                     |

## Two error strings in the log are deliberate fixtures, not failures

- `builder-richtext` — `[tiptap warn]: Invalid content … Unknown node type: horizontalRule`. A
  negative-path test asserting the read path rejects unknown nodes.
- `builder-shell` — `Error: render exploded`. An error-boundary fixture.

Neither affects the exit code. Verified by grep against the failure patterns, not assumed.

## Correction carried into plan.md and tasks.md

`.specify/agents/HANDOFF.md` records `check:components` at **50**. The real count is **58** — the
tree grew after that note was written. Every downstream target was adjusted:

- **Was** (wrong): 50 → 56 after this feature's 6 new components.
- **Is**: **58 → 64**.

This is why the baseline is captured before the first change rather than inferred later: a target
derived from a stale note would have made the component gate look wrong at exactly the moment it was
right.

## Attribution

Any gate failure after this point is caused by this feature's work, not inherited. The tree was
green when 013 started.
