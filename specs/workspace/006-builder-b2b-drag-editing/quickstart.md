# Quickstart Validation: Builder B2b Drag Editing

Runnable proof sequence. Prerequisite: Node 24.19.0 on PATH
(`export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`), workspace installed.

## Narrow sequence (fastest signal first)

```bash
pnpm --filter @craftkit/builder-shell lint && \
pnpm --filter @craftkit/builder-shell typecheck && \
pnpm --filter @craftkit/builder-shell test
pnpm --filter @craftkit/builder test               # preset surface guard incl. Palette/LayersTree
pnpm --filter @craftkit/playground test
```

## Workspace gates

```bash
pnpm check:workspace && pnpm check:components && pnpm check:boundaries
pnpm --filter @craftkit/storybook build-storybook && pnpm --filter @craftkit/storybook test:storybook
pnpm verify
```

Catalog-presence check (R10): the Storybook index MUST contain Palette and LayersTree entries plus
the new EditorCanvas drag story — absence is a gate failure.

## Law-proof table (suite ⇄ requirement)

| Proof                                                                                          | Where                                                       | FR/SC                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------ |
| Session lifecycle: threshold click-vs-drag, Escape, self-cancel                                | shell overlay/drag-session.test.ts                          | FR-001                   |
| Chrome-only sessions: 0 content re-renders press→pre-drop (landing + 1k)                       | shell EditorCanvas.test.tsx                                 | FR-002, FR-015, SC-001   |
| Resolution: halves, into-drop, ancestor walk, self/descendant exclusion, max exemption         | shell overlay/drop-resolver.test.ts                         | FR-003, FR-004           |
| Resolver ≡ door agreement sweep (generated documents)                                          | shell overlay/drop-resolver.test.ts                         | SC-003                   |
| One transaction per drop; zero on cancel; zero on same-position                                | shell EditorCanvas.test.tsx                                 | FR-005, FR-006, SC-002   |
| Palette catalog + runtime liveness + keyboard walk-up insert + no-acceptor announce            | shell components/Palette/Palette.test.tsx                   | FR-007                   |
| Palette drag → one insertNode at resolved gap (host→frame bridge)                              | shell EditorCanvas.test.tsx + Palette.test.tsx              | FR-007, SC-002           |
| LayersTree structure ≡ canvas order; bidirectional selection; reveal; keyboard tree walk       | shell components/LayersTree/LayersTree.test.tsx             | FR-008, SC-006           |
| Alt-moves: reorder/out/in via the same gate, clamps, announcements                             | shell keyboard/move-actions.test.ts + EditorCanvas.test.tsx | FR-009, FR-010, SC-005   |
| Hand-built landing flow: N inserts + M moves = N+M transactions, structure equality            | apps/playground/src/app/App.test.tsx                        | SC-004                   |
| Law-S audit across a full drag interaction                                                     | shell EditorCanvas.test.tsx                                 | FR-014                   |
| RTL: mirrored Alt-moves; indicator follows visual order; live flip mid-session cancels nothing | shell tests + Chromium play()                               | FR-011                   |
| Browser truth: PointerEvent drag → indicator gap → committed order                             | EditorCanvas.stories.tsx DragRearrange play()               | SC-001/002 browser truth |
| editable absent ⇒ B2a byte-compatible                                                          | 005 suites unchanged + explicit no-op test                  | FR-012                   |
| Component contracts + a11y error gate                                                          | check:components + test:storybook                           | FR-013, SC-007           |

## Boundary negatives (execute, capture, revert)

Re-run the 005 pair (shell→blocks-marketing ⇒ BUILDER_LAYER_VIOLATION; playground→shell ⇒
BUILDER_FAMILY_ACCESS) to prove B2b added no edges.

## Smoothness (NOT a merge gate — evidence only)

Manual: `pnpm --filter @craftkit/playground dev` → edit mode → sustained 10s drag across the landing
fixture with DevTools performance overlay; record observed fps in the evidence log. The dedicated
Lane-B job arrives with CI infrastructure.

## Demo (human check)

```bash
pnpm --filter @craftkit/playground dev
# Edit mode → drag blocks between sections (indicator shows the gap; invalid slots refuse),
# Escape cancels cleanly; drag "Hero" from the palette into the page; Alt+↓ reorders the
# selected block; open Layers → click rows ⟷ canvas selection stays in lockstep; undo works.
```
