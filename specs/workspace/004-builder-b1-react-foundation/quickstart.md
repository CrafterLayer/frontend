# Quickstart Validation: Builder B1 View Foundation

Contracts: [contracts/builder-view.md](./contracts/builder-view.md) · entities:
[data-model.md](./data-model.md).

## Prerequisites

Node 24.19.0, pnpm 11.23.0, `pnpm install` clean (no new catalog entries in this feature),
Playwright Chromium present (existing Storybook test infra).

## Narrow verification (run first, in dependency order)

```bash
pnpm --filter @craftkit/builder-react lint && pnpm --filter @craftkit/builder-react typecheck && pnpm --filter @craftkit/builder-react test
pnpm --filter @craftkit/builder-renderer lint && pnpm --filter @craftkit/builder-renderer typecheck && pnpm --filter @craftkit/builder-renderer test
pnpm --filter @craftkit/builder-blocks-marketing lint && pnpm --filter @craftkit/builder-blocks-marketing typecheck && pnpm --filter @craftkit/builder-blocks-marketing test
pnpm --filter @craftkit/builder lint && pnpm --filter @craftkit/builder typecheck && pnpm --filter @craftkit/builder test
pnpm --filter @craftkit/playground lint && pnpm --filter @craftkit/playground typecheck && pnpm --filter @craftkit/playground test && pnpm --filter @craftkit/playground build
```

## Law & spec proofs

| Proof                   | How                                                                                 | Expected                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| SC-002 scoped re-render | renderer test: stress fixture + `onBlockRender` counter + one `setProp`             | exactly 1 callback (target id); 0 on selection change            |
| SC-003 parity + purity  | renderer tests: live vs static content compare; static twice byte-equal             | 100% match                                                       |
| FR-007                  | responsive tests: tablet/mobile/desktop resolution + unknown breakpoint             | overrides per breakpoint only; rejection                         |
| FR-008/SC-004           | playground ThemePicker interaction test                                             | sampled `--t-accent` style changes, no reload                    |
| FR-009                  | dir flip test                                                                       | frame root `dir` toggles; document unchanged except meta command |
| FR-010/FR-013/SC-005    | register demo ext → insert `announcement` → renders; dispose → fallback marker      | 100%                                                             |
| Boundary law            | add a direct `@craftkit/builder-core` dep to playground, run `pnpm check:workspace` | `BUILDER_FAMILY_ACCESS` failure (then revert)                    |
| Sibling law             | add `@craftkit/builder-react` dep to renderer, run `pnpm check:workspace`           | `BUILDER_LAYER_VIOLATION` (then revert)                          |
| Component contract      | delete any block's `.docs.mdx`, run `pnpm check:components`                         | `MISSING_COMPONENT_ARTIFACT` (then revert)                       |
| FR-016                  | `pnpm test:storybook`                                                               | a11y (error level) green for all new stories                     |

## Manual smoke (optional)

```bash
pnpm --filter @craftkit/playground dev
```

Open the printed URL: landing fixture visible inside the frame → switch theme (recolors instantly) →
flip direction (layout mirrors) → register the demo extension and insert the announcement (renders
without reload) → undo twice.

## Affected-workspace verification (run last)

```bash
pnpm check:workspace && pnpm check:components && pnpm check:boundaries
pnpm build-storybook        # catalog includes builder + blocks stories
pnpm verify                 # full chain stays green end-to-end
```
