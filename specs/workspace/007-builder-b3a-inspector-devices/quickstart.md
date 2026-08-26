# Quickstart Validation: Builder B3a Inspector, Devices & Preview

Runnable proof sequence. Prerequisite: Node 24.19.0 on PATH
(`export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`), workspace installed.

## Narrow sequence (fastest signal first)

```bash
pnpm --filter @craftkit/builder-shell lint && \
pnpm --filter @craftkit/builder-shell typecheck && \
pnpm --filter @craftkit/builder-shell test
pnpm --filter @craftkit/builder-schema test    # additive read — 003 suites stay green
pnpm --filter @craftkit/builder-core test
pnpm --filter @craftkit/builder test           # surface guard incl. Inspector/DeviceBar/PreviewMode
pnpm --filter @craftkit/playground test
```

## Workspace gates

```bash
pnpm check:workspace && pnpm check:components && pnpm check:boundaries
pnpm --filter @craftkit/storybook build-storybook && pnpm --filter @craftkit/storybook test:storybook
pnpm verify
```

Catalog-presence check: the Storybook index MUST contain Inspector, DeviceBar, and PreviewMode
entries — absence is a gate failure.

## Law-proof table (suite ⇄ requirement)

| Proof                                                                                                      | Where                                                                      | FR/SC                    |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| Generated controls match schema kinds/labels/values; zero panel code                                       | shell components/Inspector/Inspector.test.tsx                              | FR-001, SC-001           |
| Transactions ≡ commits (setProp/setResponsive/clear); rejection ⇒ 0 tx + visible reason                    | Inspector.test.tsx                                                         | FR-002, SC-002           |
| Document truth (undo/external edits refresh controls; pruned selection → empty state)                      | Inspector.test.tsx                                                         | FR-003                   |
| Default mapping incl. optional/default unwrap; readonly fallback                                           | shell fields/resolve-field.test.ts                                         | FR-004                   |
| Contribution-first resolution: score wins, ties by order, ≤0 skipped, failure containment                  | resolve-field.test.ts + Inspector.test.tsx                                 | FR-005, SC-004           |
| Bucket thresholds table incl. 767/768/1023/1024; frame width follows device                                | shell devices/buckets.test.ts + DeviceBar.test.tsx + EditorCanvas.test.tsx | FR-006, SC-003           |
| Override edit/marker/clear; bucket renders override, desktop renders base                                  | Inspector.test.tsx + EditorCanvas.test.tsx                                 | FR-007, FR-008, SC-003   |
| Preview: chrome absent, content live, zero-tx round trip, identity during flip, selection restored, Escape | shell components/PreviewMode/PreviewMode.test.tsx + playground             | FR-009, SC-005           |
| Announcements for commits/rejections/bucket/preview                                                        | component tests (named polite regions)                                     | FR-010                   |
| Focus-safe runtime field swap                                                                              | Inspector.test.tsx                                                         | edge case (R8)           |
| Law-S audit with inspector+devices+preview mounted                                                         | playground App.test.tsx                                                    | FR-013                   |
| Browser truth: Chromium edit-changes-canvas + real frame narrowing                                         | Inspector EditWithCanvas play() + EditorCanvas DeviceWidth play()          | SC-001/003 browser truth |
| Component contracts + a11y error gate                                                                      | check:components + test:storybook                                          | FR-012, SC-006           |

## Boundary negatives (execute, capture, revert)

Re-run the standing pair (shell→blocks-marketing ⇒ BUILDER_LAYER_VIOLATION; playground→shell ⇒
BUILDER_FAMILY_ACCESS) to prove B3a added no edges.

## Demo (human check)

```bash
pnpm --filter @craftkit/playground dev
# Edit mode → select a hero → the inspector shows its properties; edit the heading and watch
# the canvas; switch to tablet → the frame narrows and edits write tablet overrides (marker +
# clear); type width 500 → mobile bucket; enter Preview → chrome gone, flip direction (the
# document is untouched), Escape back with selection intact.
```
