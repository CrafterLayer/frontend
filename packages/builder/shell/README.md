# @craftkit/builder-shell

The builder's shell tier — in B2a, the **read-only canvas**: an observer-invalidated geometry index,
hover/selection chrome above the isolated preview, keyboard traversal, and the first live consumer
of the extension contract's `canvasTools` contribution point. Zero editing gestures: nothing here
mutates the document (drag/drop/resize/palette/layers arrive with later milestones).

Normative source:
[`specs/workspace/005-builder-b2a-readonly-canvas`](../../../specs/workspace/005-builder-b2a-readonly-canvas/plan.md).
Layer 3 of the builder dependency law (ADR 0003) — depends only on
`@craftkit/builder-{schema,core,react,renderer}`; `react`/`react-dom` are peers; apps still import
ONLY `@craftkit/builder`.

## Public API

- `EditorCanvas` — the one React component: B1 `CanvasFrame` + `DocumentView` (edit-mode geometry
  attachment) + chrome layer + a11y live region + pointer/keyboard wiring. React renders the
  scaffold once; every per-event path runs in plain-TS machinery with direct DOM writes batched to
  the frame rhythm — **zero document-content re-renders by construction**.
- `createRectIndex` / `RectIndex` / `NodeRect` — geometry index: membership by callback ref,
  invalidation by observation only (element resize, frame scroll, viewport resize, `dir` flip), lazy
  per-node measurement, `onInvalidate` notification, zero idle cost, `stats()` for the Lane-A
  observer-attribution proofs.
- `GeometryPorts` / `systemGeometryPorts` — injectable measure/hit-test/scheduler (jsdom has no
  layout; tests inject fakes — the kernel's Law-D port philosophy applied to geometry).
- `defineCanvasTool` / `CanvasToolTarget` — tool authoring with the concrete target type; the stored
  `OverlayToolDef` keeps the schema's abstract shape (single-cast variance erasure, the
  `defineCommand` pattern). Tools mount imperatively into the chrome layer and MUST return a
  cleanup; failures are contained via `onToolError` and can never break built-in chrome.

## Drag editing (B2b)

`EditorCanvas editable` adds the in-repo drag engine — session state machine + pure drop resolver +
prebuilt drag chrome — on the SAME geometry index and flush rhythm (no dnd library: library drag
state lives in view context and would re-render content mid-drag). One transaction per drop,
zero-trace cancel, resolver≡door rule agreement proven by an exhaustive sweep. `Palette`
(catalog-driven, drag- or keyboard-insert with the walk-up placement rule) and `LayersTree` (ARIA
tree sharing kernel selection both ways) compose beside it; `Alt+Arrows` delivers pointer-free
arrangement parity.

## Inspector, devices & preview (B3a)

`Inspector` generates the selected block's properties panel from its OWN schema — zero panel code
per block: text/select/switch/number defaults (optional/default/nullable unwrapped), an accessible
read-only fallback, one kernel transaction per commit, rejections caught at the door and surfaced
via `aria-describedby`. Field renderers are extensible through the registry's field-type
contribution point (highest `match(schema)` wins, ties by registration order, lazy load,
per-property failure containment, focus-locked swaps). `DeviceBar` + `bucketForWidth` map ANY width
to the editing bucket through one exported threshold constant (`BUCKET_THRESHOLDS`: mobile < 768 ≤
tablet < 1024 ≤ base); `EditorCanvas frameWidth` narrows and centers the frame shell (overlay shares
its origin — a layout-only change), and the inspector's non-base buckets read/write
`responsive[bucket]` with override markers and one-transaction clears. `PreviewMode` renders the
publish-safe path — no attachment, no chrome, live content, Escape from either document, a
view-state direction override, and zero transactions for the whole round trip.

## Performance laws (merge-gated by counting, not wall-clock)

Hover/select/sweep ⇒ 0 content re-renders (proven on the 1,000-node stress document); geometry
updates are 100% observer-attributed (no polling, no per-interaction measurement); browser-truth
positioning is asserted by Storybook play functions in real Chromium.

## Development

```bash
pnpm --filter @craftkit/builder-shell lint
pnpm --filter @craftkit/builder-shell typecheck
pnpm --filter @craftkit/builder-shell test
```
