# Quickstart Validation: Builder B2a Read-Only Canvas

Runnable proof sequence for the feature. Prerequisite: Node 24.19.0 on PATH
(`export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`), workspace installed.

## Narrow sequence (fastest signal first)

```bash
pnpm --filter @craftkit/builder-shell lint && \
pnpm --filter @craftkit/builder-shell typecheck && \
pnpm --filter @craftkit/builder-shell test
pnpm --filter @craftkit/builder-renderer test      # additive prop — 004 suites must stay green
pnpm --filter @craftkit/builder-core test          # registry read — 003 suites must stay green
pnpm --filter @craftkit/builder-schema test
pnpm --filter @craftkit/builder test               # preset surface guard incl. EditorCanvas
pnpm --filter @craftkit/playground test
```

## Workspace gates

```bash
pnpm check:workspace && pnpm check:components && pnpm check:boundaries
pnpm --filter @craftkit/storybook build-storybook && pnpm --filter @craftkit/storybook test:storybook
pnpm verify
```

Storybook check MUST confirm the shell stories are present in the catalog (R12 — the glob
`packages/builder/*/src/**` is expected to match `shell`; absence is a gate failure, not a shrug).

## Law-proof table (suite ⇄ requirement)

| Proof                                                                     | Where                                                                 | FR/SC                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| Hover/select/sweep ⇒ 0 content re-renders (landing + 1k stress)           | shell EditorCanvas.test.tsx (jsdom, injected ports)                   | FR-006, FR-015, SC-001   |
| Geometry updates only via observers; idle ⇒ 0 measures                    | shell rects/rect-index.test.ts (`stats()`)                            | FR-002, SC-002           |
| Undo removing selected node clears chrome (kernel prunes the id)          | shell EditorCanvas.test.tsx + core kernel-laws.test.ts                | FR-007, SC-003           |
| LIVE dir flip re-tracks chrome, zero interaction (composed chain)         | shell EditorCanvas.test.tsx (jsdom) + DirectionFlip play() (Chromium) | FR-011, SC-002           |
| Click selects through kernel; programmatic selection shows identically    | shell EditorCanvas.test.tsx                                           | FR-004, FR-005           |
| Keyboard traversal (siblings, in/out, RTL mirror, Escape) + announcements | shell keyboard/traversal.test.ts + EditorCanvas.test.tsx              | FR-009, FR-010, SC-004   |
| Tool mount/cleanup 1:1; runtime register/dispose; fault isolation         | shell overlay/tool-host.test.ts + playground tests                    | FR-012–FR-014, SC-005    |
| Real-geometry outlines + resize repositioning + RTL                       | EditorCanvas.stories.tsx play() (Chromium)                            | SC-001/002 browser truth |
| Static path byte-identical without attachment                             | renderer render-static tests (unchanged) + new no-prop test           | FR-008, R4               |
| Law-S audit still holds with EditorCanvas mounted                         | shell EditorCanvas.test.tsx (audit re-run)                            | FR-017                   |
| Component contracts + a11y error gate                                     | `check:components` + `test:storybook`                                 | FR-016, SC-006           |

## Boundary negatives (execute, capture, revert)

```bash
# 1. shell importing the preset (upward) must fail check:workspace
#    add "@craftkit/builder": "workspace:*" to packages/builder/shell/package.json → expect
#    BUILDER_LAYER_VIOLATION, exit 1 → revert.
# 2. playground importing builder-shell directly must fail
#    add "@craftkit/builder-shell": "workspace:*" to apps/playground/package.json → expect
#    BUILDER_FAMILY_ACCESS, exit 1 → revert.
```

## Demo (human check)

```bash
pnpm --filter @craftkit/playground dev
# toggle "Edit mode" → hover blocks (outline + name), click to select, arrows to traverse,
# Escape to clear; register the demo extension → select a block → badge appears; dispose → gone.
```
