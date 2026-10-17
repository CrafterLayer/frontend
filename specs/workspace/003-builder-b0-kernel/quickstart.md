# Quickstart Validation: Builder B0 Kernel Foundation

Runnable proof that the feature works end-to-end. Contracts:
[contracts/builder-kernel.md](./contracts/builder-kernel.md) · entities:
[data-model.md](./data-model.md).

## Prerequisites

- Node 24.19.0 (`.node-version`), pnpm 11.23.0.
- `pnpm install --frozen-lockfile` succeeds (trust-policy exception for `semver@6.3.1` is already
  recorded in `pnpm-workspace.yaml`).

## Narrow verification (run first)

```bash
pnpm --filter @craftkit/builder-schema lint
pnpm --filter @craftkit/builder-schema typecheck
pnpm --filter @craftkit/builder-schema test
pnpm --filter @craftkit/builder-core lint
pnpm --filter @craftkit/builder-core typecheck
pnpm --filter @craftkit/builder-core test          # includes property suites + Lane-A perf assertions
pnpm --filter @craftkit/workspace-tools test       # contract tests + new builder-boundaries tests
```

**Expected**: all green; coverage thresholds (85/90/90/90) met in both builder packages.

## Law proofs (negative checks — each must FAIL the pipeline when violated)

| Proof              | How to check                                                                               | Expected                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Purity (lint)      | add `import { useState } from "react"` in `core/src/state/store.ts`, run core lint         | `no-restricted-imports` error                                  |
| Purity (types)     | add `document.title` anywhere in core, run core typecheck                                  | `Cannot find name 'document'` (ES2024-only lib)                |
| Type-only React OK | `import type { ComponentType } from "react"` in schema                                     | lint + typecheck pass                                          |
| Determinism guard  | call `Date.now()` in `core/src/commands/dispatch.ts`, run core lint                        | `no-restricted-syntax` error (only `ports/system-*.ts` exempt) |
| Layer law          | add `"@craftkit/builder-core": "workspace:*"` to schema's deps, run `pnpm check:workspace` | builder-boundaries violation, non-zero exit                    |
| Tier-2 security    | hydrate a manifest row containing any function value (test exists)                         | rejected `ext/tier2-executable`, nothing registered            |
| JSON purity        | dispatch `setProp` with `undefined`/`NaN`/`bigint`/function (tests exist)                  | rejected at the door, no state change                          |

## Behavior walkthrough (covered by the core test suite)

1. `createBuilder({ ports: { clock: fixedClock(), ids: seededIds("s1") } })` → register
   `fakeExtension` → its block appears in `registry.blocks()`; `fake.tag` dispatches.
2. Build a small page via `insertNode`/`setProp`/`moveNode` → document matches fixture; each command
   produced exactly one transaction with author `"user"`.
3. Undo to the beginning → document equals the initial document exactly; redo all → equals the final
   document exactly.
4. Property suite: ≥1,000 randomized command sessions (fast-check) — undo-all/redo-all round-trips
   hold; replaying the transaction log against the starting document reproduces the final document;
   identical seeds ⇒ identical logs field-for-field.
5. Persist through `createMemoryPersistence()` → reload from snapshot+tail → equal documents; append
   with a stale `expectedSeq` → `persist/seq-conflict`.
6. Stress: `stressDocument(1000)` — full structural validation < 150 ms; one `setProp` notifies
   exactly one `subscribeNode` listener (counted, not timed).
7. Sealed store: the public API exposes no `setState`/raw store; a subscription audit over every
   mutation avenue observes exactly one state change per transaction.

## Affected-workspace verification (run last)

```bash
pnpm check:workspace   # includes the new builder-boundaries validator
pnpm check:components  # unchanged — builder packages have no src/components
pnpm check:boundaries  # turbo graph defense-in-depth
pnpm verify            # full chain — must remain green end-to-end
```

**Expected**: `pnpm verify` exit 0; no existing package's behavior changed
(storybook/ui/query/routing tasks unaffected).
