# Quickstart Validation: Builder B3b Rich Text

Runnable proof sequence. Prerequisite: Node 24.19.0 on PATH, workspace installed (the wiring step
adds the four tiptap pins — verify the install reports no new trust-policy prompts).

## Narrow sequence (fastest signal first)

```bash
pnpm --filter @craftkit/builder-schema test      # rich-text door whitelist suites
pnpm --filter @craftkit/builder-renderer test    # RichText + sanitization + parity
pnpm --filter @craftkit/builder-richtext lint && \
pnpm --filter @craftkit/builder-richtext typecheck && \
pnpm --filter @craftkit/builder-richtext test    # field behavior + document truth + lazy law
pnpm --filter @craftkit/builder-blocks-marketing test
pnpm --filter @craftkit/builder test             # surface guard incl. RichText/richTextExtension
pnpm --filter @craftkit/playground test          # scenario 8
```

## Workspace gates

```bash
pnpm check:workspace && pnpm check:components && pnpm check:boundaries
pnpm --filter @craftkit/storybook build-storybook && pnpm --filter @craftkit/storybook test:storybook
pnpm verify
```

Catalog-presence: the Storybook index MUST contain RichText (renderer), RichTextField (via
composition), and RichTextBlock entries.

## Law-proof table (suite ⇄ requirement)

| Proof                                                                | Where                                  | FR/SC           |
| -------------------------------------------------------------------- | -------------------------------------- | --------------- |
| Marker + wrapper unwrap; strict door whitelist rejections with paths | schema rich-text tests                 | FR-001          |
| Rich prop resolves to the contributed editor; readonly on disposal   | richtext extension tests via Inspector | FR-002, US1/AC5 |
| One tx per commit; undo/redo lockstep; editor holds no copy          | extension tests + scenario 8           | FR-003, SC-001  |
| Zero-dep render: whitelist semantics, unknown-type degradation       | renderer RichText tests                | FR-004, US2/AC3 |
| Unsafe href table 100% neutralized                                   | renderer sanitization test             | SC-004          |
| Canvas ≡ static markup (text + structure)                            | renderer parity test                   | FR-009, SC-005  |
| Loader invoked 0×/1× (lazy law)                                      | extension containment test             | FR-005, SC-003  |
| Boundary negative (shell→tiptap) + import-graph zero                 | evidence run (executed+reverted)       | FR-005, SC-002  |
| Block adoption with zero panel code                                  | blocks RichTextBlock tests             | FR-006          |
| A11y: labeled toolbar, group labeling, announcements                 | extension + storybook a11y gate        | FR-007, SC-006  |
| RTL editor + rendered                                                | stories (RTL) + tests                  | FR-008          |
| Law-S with the editor mounted                                        | playground scenario 8                  | FR-012          |

## Boundary negatives (execute, capture, revert)

1. Standing pair (shell→blocks-marketing; playground→shell) — still red.
2. NEW: `@craftkit/builder-shell` declaring `@tiptap/react` ⇒ the dependency/boundary gate fails
   with a named violation; reverted; baseline green.

## Demo (human check)

```bash
pnpm --filter @craftkit/playground dev
# Edit mode → select the rich-text block → the inspector shows the rich editor; bold a word,
# add a heading and a list — watch the canvas; undo from the header; enter Preview — the
# SAME content renders with no editor loaded.
```
